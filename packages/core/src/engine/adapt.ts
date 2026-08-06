/**
 * Adaptacja planu na danych wykonania (FOUNDATIONS §10.3, §10.6).
 *
 * Zasada nadrzędna: silnik **proponuje**, nie przepisuje planu po cichu.
 * Wynikiem jest diagnoza + lista działań z uzasadnieniem — użytkownik (albo
 * agent) decyduje, co zastosować. To bezpośrednia konsekwencja filaru
 * plan-as-code: zmiana planu ma być widocznym diffem.
 *
 * Czego NIE robimy (anty-wzorce §10.12):
 *  - nie liczymy ACWR i nie mówimy językiem ryzyka urazu (P-4),
 *  - nie „nadrabiamy" opuszczonych kilometrów (dokładanie objętości po przerwie
 *    to odwrotność tego, co wynika z P-1/P-3),
 *  - nie udzielamy porad medycznych (R-7).
 */
import type { RaceResult, WorkoutKind } from '../domain/types.ts'
import { messages } from '../i18n/index.ts'
import { diffDays } from '../util/dates.ts'

export interface ExecutionRecord {
  date: string
  plannedKm: number
  actualKm?: number
  kind?: WorkoutKind
  /** Dzień z planu bez wykonania i bez logu = pominięty. */
  status: 'done' | 'missed' | 'unplanned' | 'rest'
}

export interface AdaptationAction {
  type:
    | 'recalibrate-zones'
    | 'reduce-volume'
    | 'hold-course'
    | 'post-race-recovery'
    | 'conservative-restart'
    | 'raise-baseline'
  detail: string
  suggestedWeeklyKm?: number
  ruleRefs: string[]
}

export interface AdaptationProposal {
  windowDays: number
  complianceKm: number
  missedSessions: number
  diagnosis: string[]
  actions: AdaptationAction[]
  warnings: string[]
}

export interface AdaptationInput {
  today: string
  /** Ostatnie dni wykonania — zwykle 21–28. */
  execution: ExecutionRecord[]
  /** Bieżąca objętość docelowa z planu [km/tydz.]. */
  currentWeeklyKm: number
  /** Wyniki startów nowsze niż kalibracja planu. */
  newResults?: RaceResult[]
  /** Dystans ostatniego startu — dla protokołu powrotu (R-1/R-3). */
  lastRace?: { date: string; distanceKm: number }
  /**
   * Sprawdziany i starty kontrolne wykonane w oknie, których wyniku nie ma
   * jeszcze w `athlete.results` — pętla kalibracji jest niedomknięta (W-11).
   */
  uncalibratedTests?: { date: string; distanceKm: number; timeSec?: number }[]
}

const WINDOW_DAYS = 21
/** Przerwa, po której wracamy konserwatywnie zamiast kontynuować progresję. */
const LAYOFF_DAYS = 10

export function analyzeExecution(input: AdaptationInput): AdaptationProposal {
  const from = new Date(Date.parse(input.today) - WINDOW_DAYS * 86_400_000)
    .toISOString()
    .slice(0, 10)
  const window = input.execution
    .filter((e) => e.date >= from && e.date <= input.today)
    .sort((a, b) => a.date.localeCompare(b.date))

  const plannedKm = window.reduce((s, e) => s + e.plannedKm, 0)
  const actualKm = window.reduce((s, e) => s + (e.actualKm ?? 0), 0)
  const compliance = plannedKm > 0 ? actualKm / plannedKm : 1
  const missedSessions = window.filter((e) => e.status === 'missed').length
  const missedQuality = window.filter(
    (e) => e.status === 'missed' && (e.kind === 'quality_intervals' || e.kind === 'quality_continuous'),
  ).length

  const diagnosis: string[] = []
  const actions: AdaptationAction[] = []
  const warnings: string[] = []
  const m = messages()

  // 1) Najdłuższa przerwa bez biegania w oknie
  const runDays = window.filter((e) => (e.actualKm ?? 0) > 0).map((e) => e.date)
  const lastRun = runDays.at(-1)
  const layoff = lastRun ? diffDays(lastRun, input.today) : WINDOW_DAYS
  if (layoff >= LAYOFF_DAYS) {
    const restartKm = Math.round(input.currentWeeklyKm * 0.55)
    diagnosis.push(m.adapt.layoffDiagnosis(layoff))
    actions.push({
      type: 'conservative-restart',
      detail: m.adapt.restartAfterLayoff(restartKm, layoff),
      suggestedWeeklyKm: restartKm,
      ruleRefs: ['R-5', 'P-3'],
    })
    warnings.push(m.adapt.restartExtrapolated)
  }

  // 2) Świeży start — protokół powrotu (R-1/R-2/R-3)
  if (input.lastRace) {
    const sinceRace = diffDays(input.lastRace.date, input.today)
    if (sinceRace >= 0 && sinceRace <= 6) {
      const ultra = input.lastRace.distanceKm > 42.5
      diagnosis.push(m.adapt.postRaceDiagnosis(sinceRace, input.lastRace.distanceKm))
      actions.push({
        type: 'post-race-recovery',
        detail: ultra
          ? m.adapt.postRaceUltra
          : sinceRace < 2
            ? m.adapt.postRaceMarathon
            : m.adapt.postRaceShort,
        ruleRefs: ultra ? ['R-3'] : ['R-1', 'R-2'],
      })
      if (ultra) warnings.push(m.adapt.noUltraSources)
    }
  }

  // 3) Nowy wynik startu → rekalibracja stref
  if (input.newResults?.length) {
    const latest = [...input.newResults].sort((a, b) => a.date.localeCompare(b.date)).at(-1)!
    diagnosis.push(m.adapt.newResultDiagnosis(latest.distanceKm, latest.date))
    actions.push({
      type: 'recalibrate-zones',
      detail: m.adapt.recalibrateFromResult,
      ruleRefs: ['Z-9', 'Z-6'],
    })
  }

  // 3b) Sprawdzian/start kontrolny bez wyniku w profilu — pętla kalibracji stoi
  for (const t of input.uncalibratedTests ?? []) {
    diagnosis.push(m.adapt.uncalibratedTestDiagnosis(t.date, t.distanceKm))
    actions.push({
      type: 'recalibrate-zones',
      detail:
        `${m.adapt.uncalibratedTestAction(
          t.date, t.distanceKm, String(t.timeSec ?? m.adapt.timeSecPlaceholder),
        )} ${m.adapt.timeTrialWithoutResult}`,
      ruleRefs: ['W-11', 'Z-6'],
    })
  }

  // 4) Zgodność objętości
  if (plannedKm > 0 && layoff < LAYOFF_DAYS) {
    if (compliance < 0.7) {
      const realistic = Math.max(10, Math.round((actualKm / WINDOW_DAYS) * 7))
      diagnosis.push(
        m.adapt.complianceLow(
          Math.round(compliance * 100), Math.round(actualKm), Math.round(plannedKm),
        ),
      )
      actions.push({
        type: 'reduce-volume',
        detail: m.adapt.reduceVolume(realistic),
        suggestedWeeklyKm: realistic,
        ruleRefs: ['P-1', 'P-3'],
      })
    } else if (compliance > 1.2 && missedSessions === 0) {
      const raised = Math.round(input.currentWeeklyKm * 1.1)
      diagnosis.push(m.adapt.complianceHigh(Math.round(compliance * 100)))
      actions.push({
        type: 'raise-baseline',
        detail: m.adapt.raiseVolume(raised),
        suggestedWeeklyKm: raised,
        ruleRefs: ['P-3'],
      })
    } else {
      diagnosis.push(m.adapt.onTrack(Math.round(compliance * 100), missedSessions))
      actions.push({ type: 'hold-course', detail: m.adapt.holdCourse, ruleRefs: [] })
    }
  }

  // 5) Akcenty: sygnał jakościowy niezależny od kilometrów
  if (missedQuality >= 2) {
    diagnosis.push(m.adapt.missedQuality(missedQuality))
    warnings.push(m.adapt.shiftInsteadOfLosing)
  }

  return {
    windowDays: WINDOW_DAYS,
    complianceKm: Math.round(compliance * 100) / 100,
    missedSessions,
    diagnosis,
    actions,
    warnings,
  }
}
