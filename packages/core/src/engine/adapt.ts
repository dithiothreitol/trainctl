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
import { addDays, diffDays } from '../util/dates.ts'
import { distanceClass } from '../domain/goal-class.ts'
import { RETURN_RESTART_SHARE } from './macrocycle.ts'
import type { EasyPaceExecution, IntervalsExecution } from './laps.ts'

export interface ExecutionRecord {
  date: string
  plannedKm: number
  actualKm?: number
  kind?: WorkoutKind
  /** Missing evidence is unknown; only an explicit skipped entry is missed. */
  status: 'done' | 'missed' | 'unplanned' | 'rest' | 'unknown'
  source?: 'sync' | 'journal' | 'none'
  /** D2: odcinki akcentu wobec planu, z okrążeń zsynchronizowanego biegu. Fakty do `review`, adaptacja ich nie czyta. */
  intervals?: IntervalsExecution
  /** D3: średnie tempo biegu spokojnego albo długiego wobec zakresu strefy spokojnej. */
  easyPace?: EasyPaceExecution
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
   * B11: rozpoznana przerwa (≥ LAYOFF_DAYS) z przyczyną z dziennika, a także bieżąca
   * przerwa z kontuzją dowolnej długości. Po kontuzji propozycja zmiany planu nie
   * powstaje — powrót ustala specjalista (R-6, R-7).
   */
  layoff?: {
    days: number
    reason?: BreakReason
    /** Ostatni dzień przerwy zapisanej z góry (po dziś, bez luki): blok powrotu zaczyna się po nim. */
    until?: string
  }
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
   * B7, B1: bieżący tydzień przycięty budżetem czasu albo pojemnością dni (objętość
   * rozpisana poniżej celu). Nadwyżka mówi wtedy o czasie, a nie o bazie — bez podniesienia.
   */
  volumeLimited?: boolean
  /**
   * B11: trwa przyjęty blok powrotu. Podniesienie bazy liczyłoby się wtedy od tygodni
   * obniżonych przez krzywą powrotu i zastąpiło ją na stałe — krzywa sama rośnie (P-3).
   */
  returnInProgress?: boolean
  /**
   * B11: bieżąca albo świeżo zakończona przerwa ma już przyjęty blok powrotu — zaczyna się po
   * ostatnim biegu przed nią (także jutro albo po przerwie zapisanej z góry, także w tygodniu,
   * którego krzywa nie obniża, np. w taperze). Bez nowego restartu i bez zmiany bazy przez
   * zgodność. Nowa przerwa po biegach w bloku powrotu to inna przerwa.
   */
  breakHasReturn?: boolean
  /**
   * B11: wpisy dziennika z przyczyną przerwy. O bieżącej przerwie mówią tylko te po
   * ostatnim biegu w oknie — wcześniejsza przerwa, po której biegacz biegał, nie.
   */
  breakLog?: { date: string; reason: BreakReason }[]
  /**
   * B11: dni po dziś zapisane z góry jako opuszczone — z przyczyną albo bez. Przerwa ciągnąca
   * się w nie kończy się później niż dziś, więc blok powrotu zaczyna się po niej.
   */
  skippedAhead?: string[]
  /**
   * B11: objętość sprzed przerwy, od której liczy się blok powrotu — tydzień ładowania
   * planu, nie odciążenie ani taper. Bez niej: `currentWeeklyKm`.
   */
  preBreakWeeklyKm?: number
}

const WINDOW_DAYS = 21
/** Przerwa, po której wracamy konserwatywnie zamiast kontynuować progresję. */
const LAYOFF_DAYS = 10
/** R-5 (7 dni spokojnie po chorobie): przerwa zakończona tyle dni temu nadal daje blok powrotu. */
const RECENT_RETURN_DAYS = 7

/**
 * B11: przerwa, o której mówi `adapt` — bieżąca (bez biegu od ostatniego do dziś) albo
 * zakończona w ostatnim tygodniu: pierwszy bieg (`returnedOn`) po co najmniej LAYOFF_DAYS
 * dniach bez biegania (R-5, R-11). `before` to ostatni bieg przed przerwą — od jego tygodnia
 * CLI liczy objętość sprzed przerwy. Bez przerwy `before` to po prostu ostatni bieg.
 */
export function recentBreak(execution: Pick<ExecutionRecord, 'date' | 'actualKm'>[], today: string): { before?: string; returnedOn?: string } {
  const runs = [...new Set(execution.filter((e) => e.date <= today && (e.actualKm ?? 0) > 0).map((e) => e.date))].sort()
  const last = runs.at(-1)
  if (!last) return {}
  if (diffDays(last, today) >= LAYOFF_DAYS) return { before: last }
  const ended = runs.flatMap((run, i) => {
    const before = runs[i - 1]
    return before && diffDays(run, today) < RECENT_RETURN_DAYS && diffDays(before, run) >= LAYOFF_DAYS ? [{ before, returnedOn: run }] : []
  }).at(-1)
  return ended ?? { before: last }
}

export function analyzeExecution(input: AdaptationInput): AdaptationProposal {
  const from = new Date(Date.parse(input.today) - (WINDOW_DAYS - 1) * 86_400_000)
    .toISOString()
    .slice(0, 10)
  // Dzisiejsza sesja bez wpisu jeszcze się nie odbyła albo nie skończyła: nie jest ani brakiem
  // danych, ani opuszczeniem. Inaczej `adapt` rano (choćby po `log --to yesterday` z README)
  // widział dane niepełne i nie proponował powrotu.
  const window = input.execution
    .filter((e) => e.date >= from && e.date <= input.today && !(e.date === input.today && e.status === 'unknown'))
    .sort((a, b) => a.date.localeCompare(b.date))

  // B11: dzień przerwy zapisanej z przyczyną nie jest niezgodnością z planem — zgodność
  // objętości i opuszczone sesje liczą się z pozostałych dni okna. Inaczej krótka przerwa
  // (choroba, wyjazd) dawała stałą redukcję bazy, a po niej R-5 wraca do planu bez cięcia.
  // Dzień przerwy z biegiem (wyjazd zapisany z góry, a biegacz pobiegł) liczy się normalnie.
  const ranOn = new Set(window.filter((e) => (e.actualKm ?? 0) > 0).map((e) => e.date))
  const excused = new Set((input.breakLog ?? []).map((l) => l.date).filter((date) => !ranOn.has(date)))
  const training = window.filter(e => e.kind !== 'race' && !excused.has(e.date))
  const plannedKm = training.reduce((s, e) => s + e.plannedKm, 0)
  const actualKm = training.reduce((s, e) => s + (e.actualKm ?? 0), 0)
  const compliance = plannedKm > 0 ? actualKm / plannedKm : 1
  const missedSessions = window.filter((e) => e.status === 'missed' && !excused.has(e.date)).length
  const unknownSessions = window.filter((e) => e.status === 'unknown').length
  const observed = window.some((e) => e.status === 'done' || e.status === 'missed' || e.status === 'unplanned')
  const staleWindow = window.length > 0 && diffDays(window.at(-1)!.date, input.today) > 1
  const dataStatus = !observed ? 'empty' : unknownSessions || staleWindow ? 'incomplete' : 'complete'
  const missedQuality = window.filter(
    (e) => e.status === 'missed' && !excused.has(e.date) && (e.kind === 'quality_intervals' || e.kind === 'quality_continuous'),
  ).length

  const diagnosis: string[] = []
  const actions: AdaptationAction[] = []
  const warnings: string[] = []
  const m = messages()
  if (dataStatus !== 'complete') warnings.push(m.adapt.incompleteData)

  // 1) Przerwa bez biegania: bieżąca (od ostatniego biegu do dziś) albo zakończona w ostatnim
  // tygodniu — biegacz wrócił jednym, dwoma biegami, a blok powrotu nadal ma sens (R-5: co
  // najmniej 7 dni spokojnie po chorobie; R-11). Zakończona luka liczy się jak bieżąca: dni
  // od biegu przed nią do pierwszego biegu po niej, w całym wykonaniu (przerwa bywa dłuższa
  // niż okno).
  const observedDays = window.length ? Math.min(WINDOW_DAYS, diffDays(window[0]!.date, input.today) + 1) : 0
  const lastRunEver = input.execution.filter((e) => e.date <= input.today && (e.actualKm ?? 0) > 0).map((e) => e.date).sort().at(-1)
  // bieżąca przerwa od ostatniego biegu w całym wykonaniu, także sprzed okna (plan zaczęty
  // w trakcie przerwy, przerwa dłuższa niż okno); bez żadnego biegu — tyle, ile widać
  const currentGap = lastRunEver ? diffDays(lastRunEver, input.today) : observedDays
  const brk = recentBreak(input.execution, input.today)
  // Przerwa zakończona przy trwającym bloku powrotu (przyjętym albo z profilu): blok już
  // prowadzi powrót — drugi restart liczyłby się od obniżonych tygodni i składał redukcje
  const ended = currentGap < LAYOFF_DAYS && brk.returnedOn && brk.before && !input.returnInProgress && !input.breakHasReturn
    ? { before: brk.before, run: brk.returnedOn }
    : undefined
  const layoff = ended ? diffDays(ended.before, ended.run) : currentGap
  // B11: przyczyna przerwy — wpisy od dnia biegu przed nią (kontuzja albo choroba w trakcie
  // biegu zaczyna przerwę tego samego dnia) do dziś, a przy przerwie zakończonej do pierwszego
  // biegu po niej. Kontuzja w którejkolwiek części przerwy wygrywa (R-6, R-7: powrót ustala
  // specjalista), potem choroba (R-5), potem najnowszy wpis.
  const breakFrom = ended ? ended.before : lastRunEver
  const breakEntries = (input.breakLog ?? [])
    .filter((l) => l.date <= input.today && (breakFrom === undefined || l.date >= breakFrom) && (!ended || l.date < ended.run))
    .sort((a, z) => a.date.localeCompare(z.date))
  // przerwa trwająca, zapisana także na kolejne dni (z góry, bez luki): blok powrotu zaczyna
  // się po jej końcu, a nie jutro — inaczej spokojne dni R-5/R-11 mijałyby w czasie przerwy
  const logged = new Set([...(input.breakLog ?? []).map((l) => l.date), ...(input.skippedAhead ?? [])])
  let until = input.today
  while (!ended && logged.has(addDays(until, 1))) until = addDays(until, 1)
  const breakUntil = until > input.today ? until : undefined
  const reasons = breakEntries.map((l) => l.reason)
  const breakReason = (['injury', 'illness'] as const).find((r) => reasons.includes(r)) ?? reasons.at(-1)
  const layoffFound = dataStatus === 'complete' && layoff >= LAYOFF_DAYS
  // R-6, R-7: kontuzja w bieżącej przerwie — każdej długości — to brak propozycji objętości;
  // powrót ustala specjalista
  const injury = breakReason === 'injury'
  if (injury) warnings.push(m.adapt.injuryReturn)
  if (layoffFound) {
    diagnosis.push(m.adapt.layoffDiagnosis(layoff))
    // przyjęty powrót, który dopiero się zacznie, już prowadzi tę przerwę
    if (input.breakHasReturn && !injury) diagnosis.push(m.adapt.returnPlanned)
    if (!injury && !input.breakHasReturn) {
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

  // 4) Zgodność objętości. W trakcie bloku powrotu objętość prowadzi krzywa (R-5, R-11), a okno
  // zawiera jeszcze przerwę — obniżenie bazy zastąpiłoby powrót i złożyło drugie cięcie
  if ((input.returnInProgress || input.breakHasReturn) && dataStatus === 'complete' && layoff < LAYOFF_DAYS && !injury) {
    diagnosis.push(m.adapt.returnInProgress)
    actions.push({ type: 'hold-course', detail: m.adapt.holdCourse, ruleRefs: ['R-5', 'R-11'] })
  } else if (dataStatus === 'complete' && plannedKm > 0 && layoff < LAYOFF_DAYS && !injury) {
    if (compliance < 0.7) {
      // tempo z dni, które się liczą: bez dni przerwy zapisanej z przyczyną
      const countedDays = observedDays - window.filter((e) => excused.has(e.date)).length
      const realistic = Math.max(10, Math.round((actualKm / Math.max(1, countedDays)) * 7))
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
    } else if (compliance > 1.2 && missedSessions === 0 && !actions.some(a => a.type === 'post-race-recovery') && !input.volumeLimited) {
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
    ...(layoffFound || injury ? { layoff: { days: layoff, ...(breakReason ? { reason: breakReason } : {}), ...(breakUntil ? { until: breakUntil } : {}) } } : {}),
  }
}
