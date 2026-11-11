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
import type { BreakReason, RaceResult, WorkoutKind } from '../domain/types.ts'
import { messages } from '../i18n/index.ts'
import { diffDays } from '../util/dates.ts'
import { distanceClass } from '../domain/goal-class.ts'
import { RETURN_RESTART_SHARE } from './macrocycle.ts'

export interface ExecutionRecord {
  date: string
  plannedKm: number
  actualKm?: number
  kind?: WorkoutKind
  /** Missing evidence is unknown; only an explicit skipped entry is missed. */
  status: 'done' | 'missed' | 'unplanned' | 'rest' | 'unknown'
  source?: 'sync' | 'journal' | 'none'
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
  /** B11: restart do przyjęcia jako blok powrotu — objętość sprzed przerwy i czy to choroba. */
  returnBlock?: { previousWeeklyKm: number; illness: boolean }
}

export interface AdaptationProposal {
  dataStatus: 'complete' | 'incomplete' | 'empty'
  unknownSessions: number
  windowDays: number
  complianceKm: number
  missedSessions: number
  diagnosis: string[]
  actions: AdaptationAction[]
  warnings: string[]
  /**
   * B11: rozpoznana przerwa (≥ LAYOFF_DAYS) z przyczyną z dziennika. Po kontuzji
   * propozycja zmiany planu nie powstaje — powrót ustala specjalista (R-6, R-7).
   */
  layoff?: { days: number; reason?: BreakReason }
}

export interface AdaptationInput {
  today: string
  /** Ostatnie dni wykonania — zwykle 21–28. */
  execution: ExecutionRecord[]
  /** Bieżąca objętość docelowa z planu [km/tydz.]. */
  currentWeeklyKm: number
  /** Wyniki startów nowsze niż kalibracja planu. */
  newResults?: RaceResult[]
  calibrationChanged?: boolean
  /** Dystans ostatniego startu — dla protokołu powrotu (R-1/R-3). */
  lastRace?: { date: string; distanceKm: number }
  /**
   * Sprawdziany i starty kontrolne wykonane w oknie, których wyniku nie ma
   * jeszcze w `athlete.results` — pętla kalibracji jest niedomknięta (W-11).
   */
  uncalibratedTests?: { date: string; distanceKm: number; timeSec?: number }[]
  /**
   * Przyczyna przerwy podana wprost (B11) — liczy się jak jeszcze jeden wpis `breakLog`,
   * więc nie omija reguły „kontuzja pierwsza” (R-6, R-7).
   */
  breakReason?: BreakReason
  /**
   * B11: trwa przyjęty blok powrotu. Podniesienie bazy liczyłoby się wtedy od tygodni
   * obniżonych przez krzywą powrotu i zastąpiło ją na stałe — krzywa sama rośnie (P-3).
   */
  returnInProgress?: boolean
  /**
   * B11: wpisy dziennika z przyczyną przerwy. O bieżącej przerwie mówią tylko te po
   * ostatnim biegu w oknie — wcześniejsza przerwa, po której biegacz biegał, nie.
   */
  breakLog?: { date: string; reason: BreakReason }[]
  /**
   * B11: objętość sprzed przerwy, od której liczy się blok powrotu — tydzień ładowania
   * planu, nie odciążenie ani taper. Bez niej: `currentWeeklyKm`.
   */
  preBreakWeeklyKm?: number
}

const WINDOW_DAYS = 21
/** Przerwa, po której wracamy konserwatywnie zamiast kontynuować progresję. */
const LAYOFF_DAYS = 10

export function analyzeExecution(input: AdaptationInput): AdaptationProposal {
  const from = new Date(Date.parse(input.today) - (WINDOW_DAYS - 1) * 86_400_000)
    .toISOString()
    .slice(0, 10)
  const window = input.execution
    .filter((e) => e.date >= from && e.date <= input.today)
    .sort((a, b) => a.date.localeCompare(b.date))

  const training = window.filter(e => e.kind !== 'race')
  const plannedKm = training.reduce((s, e) => s + e.plannedKm, 0)
  const actualKm = training.reduce((s, e) => s + (e.actualKm ?? 0), 0)
  const compliance = plannedKm > 0 ? actualKm / plannedKm : 1
  const missedSessions = window.filter((e) => e.status === 'missed').length
  const unknownSessions = window.filter((e) => e.status === 'unknown').length
  const observed = window.some((e) => e.status === 'done' || e.status === 'missed' || e.status === 'unplanned')
  const staleWindow = window.length > 0 && diffDays(window.at(-1)!.date, input.today) > 1
  const dataStatus = !observed ? 'empty' : unknownSessions || staleWindow ? 'incomplete' : 'complete'
  const missedQuality = window.filter(
    (e) => e.status === 'missed' && (e.kind === 'quality_intervals' || e.kind === 'quality_continuous'),
  ).length

  const diagnosis: string[] = []
  const actions: AdaptationAction[] = []
  const warnings: string[] = []
  const m = messages()
  if (dataStatus !== 'complete') warnings.push(m.adapt.incompleteData)

  // 1) Najdłuższa przerwa bez biegania w oknie
  const runDays = window.filter((e) => (e.actualKm ?? 0) > 0).map((e) => e.date)
  const lastRun = runDays.at(-1)
  const observedDays = window.length ? Math.min(WINDOW_DAYS, diffDays(window[0]!.date, input.today) + 1) : 0
  const layoff = lastRun ? diffDays(lastRun, input.today) : observedDays
  // B11: przyczyna bieżącej przerwy — wpisy po ostatnim biegu w całym wykonaniu, nie tylko
  // w oknie (przerwa bywa dłuższa niż okno). Kontuzja w którejkolwiek części przerwy wygrywa
  // (R-6, R-7: powrót ustala specjalista), potem choroba (R-5), potem najnowszy wpis.
  const lastRunEver = input.execution.filter((e) => e.date <= input.today && (e.actualKm ?? 0) > 0).map((e) => e.date).sort().at(-1)
  const breakEntries = (input.breakLog ?? [])
    .filter((l) => l.date <= input.today && (lastRunEver === undefined || l.date > lastRunEver))
    .sort((a, z) => a.date.localeCompare(z.date))
  // przyczyna podana wprost to jeszcze jeden wpis — nie omija reguły „kontuzja pierwsza”
  const reasons = [...breakEntries.map((l) => l.reason), ...(input.breakReason ? [input.breakReason] : [])]
  const breakReason = (['injury', 'illness'] as const).find((r) => reasons.includes(r)) ?? reasons.at(-1)
  const layoffFound = dataStatus === 'complete' && layoff >= LAYOFF_DAYS
  if (layoffFound) {
    diagnosis.push(m.adapt.layoffDiagnosis(layoff))
    if (breakReason === 'injury') {
      // R-6, R-7: po kontuzji silnik nie proponuje objętości — powrót ustala specjalista
      warnings.push(m.adapt.injuryReturn)
    } else {
      // B11: restart do przyjęcia jako blok powrotu — po chorobie R-5, po innej przerwie R-11
      const illness = breakReason === 'illness'
      const previousWeeklyKm = input.preBreakWeeklyKm ?? input.currentWeeklyKm
      const restartKm = Math.round(previousWeeklyKm * RETURN_RESTART_SHARE)
      actions.push({
        type: 'conservative-restart',
        detail: illness ? m.adapt.restartAfterIllness(restartKm, layoff) : m.adapt.restartAfterLayoff(restartKm, layoff),
        suggestedWeeklyKm: restartKm,
        ruleRefs: illness ? ['R-5', 'P-3'] : ['R-11', 'P-3'],
        returnBlock: { previousWeeklyKm, illness },
      })
      warnings.push(m.adapt.restartExtrapolated)
    }
  }

  // 2) Świeży start — protokół powrotu (R-1/R-2/R-3)
  if (input.lastRace) {
    const sinceRace = diffDays(input.lastRace.date, input.today)
    if (sinceRace >= 0 && sinceRace <= 6) {
      const ultra = distanceClass(input.lastRace.distanceKm) === 'ultra'
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
  if (input.calibrationChanged && !input.newResults?.length) {
    actions.push({ type: 'recalibrate-zones', detail: m.adapt.recalibrateFromResult, ruleRefs: ['Z-9', 'Z-6'] })
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
  if (dataStatus === 'complete' && plannedKm > 0 && layoff < LAYOFF_DAYS) {
    if (compliance < 0.7) {
      const realistic = Math.max(10, Math.round((actualKm / Math.max(1, observedDays)) * 7))
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
    } else if (compliance > 1.2 && missedSessions === 0 && !actions.some(a => a.type === 'post-race-recovery') && !input.returnInProgress) {
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
    dataStatus,
    unknownSessions,
    windowDays: WINDOW_DAYS,
    complianceKm: Math.round(compliance * 100) / 100,
    missedSessions,
    diagnosis,
    actions,
    warnings,
    ...(layoffFound ? { layoff: { days: layoff, ...(breakReason ? { reason: breakReason } : {}) } } : {}),
  }
}
