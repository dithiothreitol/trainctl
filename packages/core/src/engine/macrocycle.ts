/**
 * Planer makrocyklu: kalendarz → szkielety tygodni (fazy, objętość, TID, taper).
 * Implementuje reguły FOUNDATIONS §10.2 (I-*), §10.3 (P-*), §10.5 (T-*).
 * Wartości oznaczone „inż." to parametry inżynierskie zgodne z kierunkiem reguły,
 * ale bez liczby w źródle — do kalibracji backtestem na korpusie.
 */
import type {
  AthleteProfile,
  IntensityModel,
  MacroPhase,
  MacrocyclePlan,
  RaceGoal,
  WeekSkeleton,
} from '../domain/types.ts'
import { addDays, diffDays, mondayOf } from '../util/dates.ts'

/** P-2: tydzień odciążenia po 3 tygodniach ładowania. Współczynnik 0,7 — inż. */
const DELOAD_EVERY = 4
const DELOAD_FACTOR = 0.7
/** P-3: ramp rate jako narzędzie planowania — domyślnie ≤10%/tydz. */
const RAMP_PER_LOAD_WEEK = 1.08 // inż., mieści się w P-3
/** P-9/kontekst amatorski: sufit bezpieczeństwa planera. */
const SANITY_CAP_KM = 120

/** T-5: mnożniki taperu względem ostatniego tygodnia ładowania (monotoniczne, T-4). */
const TAPER_MULTIPLIERS: Record<number, number[]> = {
  1: [0.55],
  2: [0.7, 0.5],
  3: [0.75, 0.6, 0.45],
}

export function taperWeeksFor(goal: RaceGoal): { weeks: number; flags: string[] } {
  if (goal.distanceKm > 42.5) return { weeks: 3, flags: ['T-8: ultra — ekstrapolacja bez źródła'] }
  if (goal.distanceKm >= 42.0) return { weeks: 3, flags: [] } // maraton: 14–21 dni
  if (goal.distanceKm >= 20.9) return { weeks: 2, flags: [] } // HM: 10–14 dni
  return { weeks: 1, flags: [] } // 5–10 km: 7–10 dni
}

/** P-7/P-8: rekomendowana objętość szczytowa dla dystansu docelowego. */
export function recommendedPeakKm(goal: RaceGoal): number {
  if (goal.distanceKm > 42.5) return 70 // inż. — brak źródła dla ultra (T-8)
  if (goal.distanceKm >= 42.0) return 65 // P-8: >65 km/tydz. → −14 min
  if (goal.distanceKm >= 20.9) return 42 // P-7: >32 km/tydz. + długi >21 km; inż. margines
  return 35 // inż. dla 5–10 km
}

export interface MacrocycleInput {
  today: string
  goal: RaceGoal
  athlete: AthleteProfile
}

export function planMacrocycle(input: MacrocycleInput): MacrocyclePlan {
  const { today, goal, athlete } = input
  const firstWeek = mondayOf(today)
  const raceWeek = mondayOf(goal.date)
  const totalWeeks = Math.floor(diffDays(firstWeek, raceWeek) / 7) + 1
  if (totalWeeks < 1) throw new Error('Data startu w przeszłości')

  const feasibilityWarnings: string[] = []
  const taper = taperWeeksFor(goal)
  const taperWeeks = Math.min(taper.weeks, Math.max(1, totalWeeks - 1))
  const loadWeeks = totalWeeks - taperWeeks
  if (totalWeeks < 6) {
    feasibilityWarnings.push(
      `tylko ${totalWeeks} tyg. do startu — plan skompresowany, bez pełnej progresji`,
    )
  }

  // Objętość: ramp od recentWeeklyKm do osiągalnego szczytu (P-3), sufit z historii
  const start = athlete.recentWeeklyKm
  const cap = Math.min(athlete.peakWeeklyKm ?? start * 1.4, SANITY_CAP_KM)
  const recommended = recommendedPeakKm(goal)
  const loadOnly = Math.max(0, loadWeeks - Math.floor(loadWeeks / DELOAD_EVERY))
  const reachable = start * Math.pow(RAMP_PER_LOAD_WEEK, Math.max(0, loadOnly - 1))
  const peakPlanned = Math.round(Math.min(recommended, cap, reachable))
  if (peakPlanned < recommended) {
    feasibilityWarnings.push(
      `szczyt planu ${peakPlanned} km/tydz. poniżej rekomendacji ${recommended} km/tydz. ` +
        `dla ${goal.distanceKm} km (P-7/P-8) — cel czasowy obarczony ryzykiem`,
    )
  }

  // Fazy przed taperem: base/build piramidalnie (I-1), peak polaryzacja (I-2)
  const baseWeeks = Math.max(0, Math.round(loadWeeks * 0.4))
  const peakWeeks = Math.max(loadWeeks >= 3 ? 1 : 0, Math.round(loadWeeks * 0.2))
  const buildWeeks = Math.max(0, loadWeeks - baseWeeks - peakWeeks)

  const qualityPerWeek = athlete.daysAvailable.length >= 4 ? 2 : 1 // I-8

  const weeks: WeekSkeleton[] = []
  let loadTarget = start
  let sinceDeload = 0
  for (let i = 0; i < totalWeeks; i++) {
    const weekStart = addDays(firstWeek, i * 7)
    const inTaper = i >= loadWeeks
    let phase: MacroPhase
    let intensityModel: IntensityModel
    if (inTaper) {
      phase = i === totalWeeks - 1 ? 'race' : 'taper'
      intensityModel = 'polarized' // I-2 + T-1: intensywność zostaje
    } else if (i < baseWeeks) {
      phase = 'base'
      intensityModel = 'pyramidal'
    } else if (i < baseWeeks + buildWeeks) {
      phase = 'build'
      intensityModel = 'pyramidal'
    } else {
      phase = 'peak'
      intensityModel = 'polarized'
    }

    let targetKm: number
    let deload = false
    const flags: string[] = [...(i === 0 ? taper.flags : [])]
    const ruleRefs: string[] = []

    if (inTaper) {
      const multipliers = TAPER_MULTIPLIERS[taperWeeks]!
      const m = multipliers[i - loadWeeks]!
      targetKm = Math.round(loadTarget * m)
      ruleRefs.push('T-1', 'T-2', 'T-3', 'T-4', 'T-5')
    } else {
      sinceDeload++
      if (sinceDeload >= DELOAD_EVERY && i !== loadWeeks - 1) {
        deload = true
        sinceDeload = 0
        targetKm = Math.round(loadTarget * DELOAD_FACTOR)
        ruleRefs.push('P-2')
      } else {
        loadTarget = Math.min(loadTarget * RAMP_PER_LOAD_WEEK, peakPlanned)
        targetKm = Math.round(loadTarget)
        ruleRefs.push('P-1', 'P-3')
      }
      ruleRefs.push(intensityModel === 'pyramidal' ? 'I-1' : 'I-2')
    }

    weeks.push({
      weekStart,
      index: i,
      phase,
      intensityModel,
      targetKm,
      deload,
      keepIntensity: inTaper, // T-1
      keepFrequency: inTaper, // T-2
      qualitySessions: phase === 'race' ? 1 : qualityPerWeek,
      ...(phase === 'race' ? { raceDate: goal.date } : {}),
      flags,
      ruleRefs,
    })
  }

  return { goal, weeks, peakKmPlanned: peakPlanned, peakKmRecommended: recommended, feasibilityWarnings }
}
