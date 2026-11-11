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
  TuneUpRace,
  WeekSkeleton,
} from '../domain/types.ts'
import { addDays, diffDays, mondayOf } from '../util/dates.ts'
import { messages } from '../i18n/index.ts'
import { COACH_STYLE } from './house-style.ts'
import { SESSION_SHARE_MAX, weekCapacityKm } from './microcycle.ts'
import { goalClass, type GoalClass } from '../domain/goal-class.ts'

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
  switch (goalClass(goal)) {
    case 'base': return { weeks: 0, flags: [] } // P-11: plan bez zawodów nie ma taperu
    case 'ultra': return { weeks: 3, flags: [messages().macro.ultraTaperExtrapolated] }
    case 'marathon': return { weeks: 3, flags: [] } // maraton: 14–21 dni
    case 'half': return { weeks: 2, flags: [] } // HM: 10–14 dni
    case 'short': return { weeks: 1, flags: [] } // 5–10 km: 7–10 dni
  }
}

/** T-9: mini-taper przed startem B — objętość tygodnia w dół o ~20%, makrocykl bez zmian. */
const TUNE_UP_B_FACTOR = 0.8
/**
 * W-12: rytm kalibracji co ~4 tygodnie (mediana odstępu startów w korpusie: 28 dni).
 * Sprawdzian wstawiamy rzadziej — to fallback (W-13), a nie metoda pierwszego wyboru:
 * dopiero gdy przez 6 tygodni nie ma ani startu kontrolnego, ani świeżego wyniku.
 */
const CALIBRATION_GAP_WEEKS = 6
/** Sprawdzian nie ma sensu tuż przed celem — tam kalibruje sam start (T-1…T-5). */
const TEST_MIN_WEEKS_TO_GOAL = 3
/**
 * Ani na starcie planu: przed upływem kilku tygodni nowego bodźca nie ma czego
 * mierzyć — plan właśnie został skalibrowany z wyniku, który ma. Wartość inż.
 */
const TEST_MIN_WEEK_INDEX = 4

/** W-11: dystans sprawdzianu — krótszy niż cel, żeby był ostry, ale mierzalny. */
export function testDistanceKm(goal: RaceGoal): number {
  return goal.distanceKm <= 10 ? 3 : 5
}

/** P-7/P-8: rekomendowana objętość szczytowa dla dystansu docelowego. */
export function recommendedPeakKm(goal: RaceGoal): number {
  switch (goalClass(goal)) {
    case 'base': return 0 // bez dystansu docelowego nie ma progu P-7/P-8
    case 'ultra': return 70 // inż. — brak źródła dla ultra (T-8)
    case 'marathon': return 65 // P-8: >65 km/tydz. → −14 min
    case 'half': return 42 // P-7: >32 km/tydz. + długi >21 km; inż. margines
    case 'short': return 35 // inż. dla 5–10 km
  }
}

export interface MacrocycleInput {
  today: string
  goal: RaceGoal
  athlete: AthleteProfile
}

/**
 * R-8 (korpus, n=3: 2 starty maratońskie i dłuższe, 1 półmaraton): po starcie
 * ≥HM trener rozpisywał ~50% objętości sprzed startu w pierwszym tygodniu
 * (2–3 sesje, pierwszy akcent 7–8 dni po starcie) i wracał do ~100% w drugim.
 * R-10 (inż., bez danych w korpusie): po krótszym celu jeden tydzień ~70%.
 */
const TRANSITION_FACTORS_LONG = [0.5, 1.0]
const TRANSITION_FACTORS_SHORT = [0.7]
/** R-1: 48 h ciszy po maratonie → pierwszy bieg 3. dnia; po HM 2. dnia, po krótszym nazajutrz (inż.). */
const firstRunOffset = (cls: GoalClass) => (cls === 'marathon' || cls === 'ultra' ? 3 : cls === 'half' ? 2 : 1)
/**
 * P-11 (inż.): plan bez zawodów rośnie do udokumentowanego szczytu
 * (`peakWeeklyKm`) albo +15% bieżącej objętości i tam się wypłaszcza.
 */
const BASE_GROWTH = 1.15

/**
 * B3 (inż.): fala w bloku — tygodnie ładowania rosną 0,94 → 0,97 → 1,00 poziomu bloku,
 * po nich odciążenie (P-1: mikrocykl falujący, P-2). Fala działa, gdy trend objętości
 * rośnie w bloku wolniej niż ona sama: plateau albo biegacz blisko szczytu. Szybszy
 * wzrost (do 8% na tydzień, P-3) sam daje rosnące tygodnie.
 */
const BLOCK_WAVE = [0.94, 0.97, 1.0]

interface VolumeWeek { deload: boolean; km: number }

/**
 * B3: trajektoria objętości tygodni przed taperem. Trend tygodni ładowania rośnie od
 * `start` geometrycznie tak, żeby szczyt wypadł w ostatnim tygodniu ładowania przed
 * taperem (T-7, P-12), nie szybciej niż RAMP_PER_LOAD_WEEK (P-3). Plan bez startu rośnie
 * w tempie P-3 do szczytu i tam się wypłaszcza (P-11). Odciążenie to DELOAD_FACTOR
 * poziomu bloku przed nim (P-2). Zwraca też poziom ostatniego bloku — od niego taper.
 */
function volumeSchedule(loadWeeks: number, start: number, peak: number, baseOnly: boolean): { weeks: VolumeWeek[]; peakLevel: number } {
  const deloads: boolean[] = []
  let since = 0
  for (let i = 0; i < loadWeeks; i++) {
    since++
    // ostatni tydzień przed taperem nie jest odciążeniem — taper sam odciąża
    const deload = since >= DELOAD_EVERY && i !== loadWeeks - 1
    if (deload) since = 0
    deloads.push(deload)
  }
  const loading = deloads.filter((d) => !d).length
  const s0 = Math.min(start, peak)
  const growth = baseOnly
    ? RAMP_PER_LOAD_WEEK
    : Math.min(RAMP_PER_LOAD_WEEK, Math.max(1, Math.pow(peak / Math.max(1, s0), 1 / Math.max(1, loading - 1))))
  const trend = (k: number) => Math.min(peak, s0 * Math.pow(growth, k))

  const weeks: VolumeWeek[] = []
  let k = 0
  let level = s0
  for (let i = 0; i < loadWeeks;) {
    if (deloads[i]) {
      weeks.push({ deload: true, km: Math.round(level * DELOAD_FACTOR) })
      i++
      continue
    }
    // blok: kolejne tygodnie ładowania do najbliższego odciążenia
    let end = i
    while (end < loadWeeks && !deloads[end]) end++
    const size = end - i
    const first = trend(k)
    level = trend(k + size - 1)
    const wave = level / first < 1 / BLOCK_WAVE[0]!
    for (let j = 0; j < size; j++) {
      const fromEnd = size - 1 - j
      weeks.push({ deload: false, km: Math.round(wave ? level * BLOCK_WAVE[Math.max(0, BLOCK_WAVE.length - 1 - fromEnd)]! : trend(k + j)) })
    }
    k += size
    i = end
  }
  return { weeks, peakLevel: level }
}

/** Tygodnie po starcie celu A — makrocykl nie kończy się w dniu zawodów. */
function transitionWeeks(goal: RaceGoal, weeks: WeekSkeleton[]): WeekSkeleton[] {
  const raceWeek = weeks.at(-1)
  if (!raceWeek) return []
  const before = weeks.slice(-5, -1)
  const base = before.length ? before.reduce((s, w) => s + w.targetKm, 0) / before.length : raceWeek.targetKm
  const cls = goalClass(goal)
  const long = cls === 'half' || cls === 'marathon' || cls === 'ultra'
  const factors = long ? TRANSITION_FACTORS_LONG : TRANSITION_FACTORS_SHORT
  const earliestRun = addDays(goal.date, firstRunOffset(cls))
  return factors.map((factor, j): WeekSkeleton => {
    const weekStart = addDays(raceWeek.weekStart, 7 * (j + 1))
    return {
      weekStart,
      index: raceWeek.index + 1 + j,
      phase: 'transition',
      intensityModel: 'pyramidal',
      targetKm: Math.round(base * factor),
      deload: false,
      keepIntensity: false,
      keepFrequency: false,
      // pierwszy tydzień wyłącznie spokojnie; akcent wraca w drugim (R-8)
      qualitySessions: j === 0 ? 0 : 1,
      ...(j === 0 && earliestRun > weekStart ? { earliestRun } : {}),
      flags: [messages().macro.transitionWeek(j + 1, factors.length)],
      ruleRefs: long ? (j === 0 ? ['R-1', 'R-2', 'R-8'] : ['R-8', 'R-9']) : ['R-10'],
    }
  })
}

/**
 * Data ostatniego wyniku startowego PRZED początkiem planu — punkt zerowy rytmu
 * kalibracji (W-12). Wyniki z horyzontu planu zerują rytm w swoim tygodniu
 * (pętla w `planMacrocycle`); wcześniej liczył się tylko najświeższy wynik, a jego
 * data spoza początku planu dawała ujemny odstęp przycięty do zera — i sprawdzian
 * lądował tydzień po świeżym wyniku na 10 km (regeneracja liczona od pierwotnej
 * daty startu planu, ADR-033).
 */
function lastResultBefore(athlete: AthleteProfile, firstWeek: string): string | undefined {
  return athlete.results.map((r) => r.date).filter((d) => d < firstWeek).sort().at(-1)
}

export function planMacrocycle(input: MacrocycleInput): MacrocyclePlan {
  const { today, goal, athlete } = input
  const firstWeek = mondayOf(today)
  const raceWeek = mondayOf(goal.date)
  const baseOnly = goal.kind === 'base'
  const totalWeeks = Math.floor(diffDays(firstWeek, raceWeek) / 7) + 1
  if (totalWeeks < 1) throw new Error(baseOnly ? messages().macro.baseEndInPast : messages().macro.raceDateInPast)

  const feasibilityWarnings: string[] = []
  const taper = taperWeeksFor(goal)
  const taperWeeks = baseOnly ? 0 : Math.min(taper.weeks, Math.max(1, totalWeeks - 1))
  const loadWeeks = totalWeeks - taperWeeks
  if (totalWeeks < 6 && !baseOnly) {
    feasibilityWarnings.push(
      messages().macro.compressedPlan(totalWeeks),
    )
  }

  const qualityPerWeek = athlete.daysAvailable.length >= 4 ? 2 : 1 // I-8

  // Objętość: ramp od recentWeeklyKm do osiągalnego szczytu (P-3), sufit z historii
  const start = athlete.recentWeeklyKm
  // E-3 (inż.): bez `peakWeeklyKm` sufit to bieżąca objętość +40% — brak źródła
  const historyCap = Math.min(athlete.peakWeeklyKm ?? start * 1.4, SANITY_CAP_KM)
  const recommended = recommendedPeakKm(goal)
  const loadOnly = Math.max(0, loadWeeks - Math.floor(loadWeeks / DELOAD_EVERY))
  const reachable = start * Math.pow(RAMP_PER_LOAD_WEEK, Math.max(0, loadOnly - 1))
  // P-7/P-8 to podłoga dla niedotrenowanych, nie sufit: atlecie z bazą powyżej
  // rekomendacji utrzymujemy (lekko rozwijamy) jego wolumen zamiast go ciąć.
  // E-3 (inż.): plan ze startem celuje w bieżącą objętość +15% (sufit z historii), nie niżej niż rekomendacja P-7/P-8
  const targetPeak = baseOnly
    ? Math.min(athlete.peakWeeklyKm ?? start * BASE_GROWTH, historyCap)
    : Math.max(recommended, Math.min(start * 1.15, historyCap))
  // ile szczytu plan miałby bez limitu dni — ostrzeżenie mówi, co daje dodatkowy dzień
  const withoutDays = Math.round(Math.min(targetPeak, historyCap, reachable))
  // B1: szczyt nie wyższy niż to, co dni biegacza mieszczą pod sufitami jednostek
  const peakPlanned = weekCapacityKm(athlete, qualityPerWeek, withoutDays)
  if (peakPlanned < withoutDays) feasibilityWarnings.push(messages().macro.daysCapVolume(peakPlanned, withoutDays, athlete.daysAvailable.length))
  if (!baseOnly && peakPlanned < recommended) {
    feasibilityWarnings.push(
      messages().macro.peakBelowRecommended(peakPlanned, recommended, goal.distanceKm),
    )
  }

  // Fazy przed taperem: base/build piramidalnie (I-1), peak polaryzacja (I-2).
  // Podział 40% bazy i 20% szczytu to E-3 (inż.) — źródła podają kolejność faz, nie proporcje.
  const baseWeeks = Math.max(0, Math.round(loadWeeks * 0.4))
  const peakWeeks = Math.max(loadWeeks >= 3 ? 1 : 0, Math.round(loadWeeks * 0.2))
  const buildWeeks = Math.max(0, loadWeeks - baseWeeks - peakWeeks)

  // Starty kontrolne: tylko te w oknie planu i przed celem A (T-9…T-12)
  const tuneUps = (athlete.tuneUpRaces ?? [])
    .filter((r) => r.date >= firstWeek && r.date < goal.date)
    .sort((a, b) => a.date.localeCompare(b.date))
  const tuneUpByWeek = new Map<string, TuneUpRace>()
  for (const r of tuneUps) {
    const ws = mondayOf(r.date)
    // A race is a calendar commitment; never silently discard one.
    const prev = tuneUpByWeek.get(ws)
    if (prev || diffDays(firstWeek, ws) / 7 >= loadWeeks) throw new Error(messages().macro.raceConflict(r.date))
    tuneUpByWeek.set(ws, r)
  }

  const weeks: WeekSkeleton[] = []
  const volume = volumeSchedule(loadWeeks, start, peakPlanned, baseOnly)
  // rytm kalibracji: liczony od ostatniego wyniku, resetowany startem kontrolnym (W-12)
  const lastResult = lastResultBefore(athlete, firstWeek)
  const resultDates = athlete.results.map((r) => r.date)
  let weeksSinceCalibration = lastResult
    ? Math.max(0, Math.floor(diffDays(mondayOf(lastResult), firstWeek) / 7))
    : CALIBRATION_GAP_WEEKS
  for (let i = 0; i < totalWeeks; i++) {
    const weekStart = addDays(firstWeek, i * 7)
    // wynik w tym tygodniu to kalibracja tak samo jak start kontrolny (W-12)
    if (resultDates.some((d) => d >= weekStart && d < addDays(weekStart, 7))) weeksSinceCalibration = 0
    const inTaper = i >= loadWeeks
    let phase: MacroPhase
    let intensityModel: IntensityModel
    if (inTaper) {
      phase = i === totalWeeks - 1 ? 'race' : 'taper'
      intensityModel = 'polarized' // I-2 + T-1: intensywność zostaje
    } else if (baseOnly || i < baseWeeks) {
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
      targetKm = Math.round(volume.peakLevel * m)
      ruleRefs.push('T-1', 'T-2', 'T-3', 'T-4', 'T-5')
    } else {
      const planned = volume.weeks[i]!
      deload = planned.deload
      targetKm = planned.km
      ruleRefs.push(...(deload ? ['P-2'] : ['P-1', 'P-3']), intensityModel === 'pyramidal' ? 'I-1' : 'I-2')
    }

    // Start kontrolny B/C: mini-taper bez ruszania makrocyklu (T-9).
    // Trajektoria zostaje nietknięta — obniżamy tylko realizację tego tygodnia,
    // żeby jeden start nie cofał całej progresji objętości.
    const tuneUp = tuneUpByWeek.get(weekStart)
    if (tuneUp && !inTaper) {
      if (tuneUp.priority === 'B') {
        targetKm = Math.round(targetKm * TUNE_UP_B_FACTOR)
        ruleRefs.push('T-9')
      }
      // start JEST akcentem tygodnia — nie dokładamy do niego drugiego (T-12)
      ruleRefs.push('T-10', 'T-11', 'T-12')
      flags.push(`start kontrolny ${tuneUp.priority}: ${tuneUp.date}`)
      weeksSinceCalibration = 0
    } else {
      weeksSinceCalibration++
    }

    // Sprawdzian — wyłącznie jako fallback (W-13): brak startów w rytmie kalibracji,
    // faza ładowania, z dala od celu. Nigdy w taperze ani w tygodniu ze startem.
    const weeksToGoal = totalWeeks - 1 - i
    const wantsTest =
      !tuneUp &&
      // cała jednostka z ramą, nie sam dystans pomiaru, mieści się w udziale jednej sesji (B2)
      COACH_STYLE.warmupKm + testDistanceKm(goal) + COACH_STYLE.cooldownKm <= SESSION_SHARE_MAX * targetKm &&
      !inTaper &&
      !deload &&
      !tuneUps.some(r => Math.abs(diffDays(weekStart, r.date)) < CALIBRATION_GAP_WEEKS * 7) &&
      i >= TEST_MIN_WEEK_INDEX &&
      weeksSinceCalibration >= CALIBRATION_GAP_WEEKS &&
      weeksToGoal >= TEST_MIN_WEEKS_TO_GOAL
    if (wantsTest) {
      ruleRefs.push('W-11', 'W-12', 'W-13')
      flags.push(messages().macro.timeTrialForCalibration)
      weeksSinceCalibration = 0
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
      ...(inTaper ? { sessionCount: Math.min(new Set(athlete.daysAvailable).size, Math.max(COACH_STYLE.minWorkoutsPerWeek, Math.ceil(volume.peakLevel / COACH_STYLE.typicalKmPerSession))) } : {}),
      // start kontrolny liczy się jako akcent tygodnia (T-12), sprawdzian też (W-13)
      // przy jednym akcencie w tygodniu start albo sprawdzian go zastępuje, a nie dochodzi obok
      qualitySessions:
        phase === 'race' ? 1 : tuneUp || wantsTest ? qualityPerWeek - 1 : qualityPerWeek,
      ...(phase === 'race' ? { raceDate: goal.date } : {}),
      ...(tuneUp && !inTaper ? { tuneUp } : {}),
      ...(wantsTest ? { testPlanned: true } : {}), // dzień wybiera mikrocykl (house style)
      flags,
      ruleRefs,
    })
  }

  if (baseOnly) {
    for (const w of weeks) w.ruleRefs.push('P-11')
    return { goal, weeks, peakKmPlanned: peakPlanned, peakKmRecommended: recommended, feasibilityWarnings }
  }
  return { goal, weeks: [...weeks, ...transitionWeeks(goal, weeks)], peakKmPlanned: peakPlanned, peakKmRecommended: recommended, feasibilityWarnings }
}
