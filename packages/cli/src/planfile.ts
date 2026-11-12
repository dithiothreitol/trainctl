/** Plan jako pliki: plan/plan.yaml (źródło prawdy) + plan/PLAN.md (render). */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { parse, stringify } from 'yaml'
import {
  diffDays,
  mondayOf,
  estimateWorkoutMinutes,
  generateMicrocycle,
  shortenWorkout,
  weekTotals,
  applyReturnBlock,
  earliestFeasibleRaceDate,
  getLocale,
  longRunThreshold,
  messages,
  MIN_EASY_KM,
  profileReturnBlock,
  RETURN_RESTART_SHARE,
  paceZones,
  planMacrocycle,
  planStrengthWeek,
  predictRace,
  qualitySessionsFor,
  testDistanceKm,
  volumeBase,
  type Microcycle,
  type PlannedDay,
  type RaceGoal,
  type RacePrediction,
  type ReturnBlock,
  type WeekNote,
  type WeekSkeleton,
} from 'trainctl-core'
import { CONFIG_FILE, type StrengthConfig, type TrainctlConfig } from './config.ts'
import { ui } from './i18n/index.ts'
import { kmLabel } from './format.ts'
import { inspectCalibration, isRoadGoal, roundVdot, zoneCalibration, type Calibration } from './calibration.ts'
import { packageVersion } from './version.ts'

export const PLAN_DIR = 'plan'
// Ścieżki jako napisy POSIX: służą i do zapisu (`join(cwd, PLAN_YAML)` normalizuje
// separator), i do komunikatów — a te mają wyglądać tak samo na każdym systemie.
export const PLAN_YAML = `${PLAN_DIR}/plan.yaml`
export const PLAN_MD = `${PLAN_DIR}/PLAN.md`
/** Najnowsza wersja schematu `plan.yaml`, którą ten kod umie czytać. */
export const PLAN_SCHEMA_VERSION = 1

export const dayFingerprint = (day: PlannedDay): string => createHash('sha256').update(JSON.stringify(day)).digest('hex')

export interface PlanChange {
  at: string
  action: string
  detail: string
}

export interface StoredPlan {
  /**
   * Zatwierdzona baza objętości (adapt --apply). `profileWeeklyKm` to wartość
   * `athlete.recentWeeklyKm` z chwili decyzji: gdy profil się od niej różni,
   * użytkownik świadomie zmienił bazę i regeneracja słucha profilu (ADR-033).
   */
  loadState?: { baselineWeeklyKm: number; effectiveFrom: string; profileWeeklyKm?: number }
  /** Pierwszy tydzień bieżącego cyklu, gdy wcześniejsze tygodnie to historia poprzedniego. */
  cycleStart?: string
  /**
   * Zatwierdzony powrót po przerwie w trakcie planu (B11, `adapt --apply`): regeneracja
   * stosuje go tak samo jak propozycja, dopóki trwa ten sam cykl.
   */
  returnState?: ReturnBlock & { decidedOn: string }
  schemaVersion?: number
  engineVersion?: string
  calibration?: Calibration
  /** Checksums of generated days, used to preserve arbitrary manual edits. */
  generatedDays?: Record<string, string>
  timeBudgets?: Record<string, number>
  preparationMinutes?: number
  generatedAt: string
  /** Język, w którym zapisano opisy jednostek — `trainctl diff` mówi, gdy się rozjedzie. */
  locale?: string
  vdot: number
  vdotSource: 'result' | 'goal-target'
  goal: RaceGoal
  peakKmPlanned: number
  peakKmRecommended: number
  feasibilityWarnings: string[]
  prediction?: RacePrediction
  changes: PlanChange[]
  weeks: Microcycle[]
}

export interface ComputePlanOptions {
  /**
   * Zmiana tygodni PRZED budżetem czasu — skalowanie bazy (regeneracja) albo
   * podmiana tygodni na tygodnie zapisanego planu (propozycja adapt). Budżet
   * działa potem raz, tymi samymi strefami — dlatego regeneracja bez zmian na
   * wejściu daje bajt w bajt ten sam plan.
   */
  beforeTimeBudget?: (plan: StoredPlan) => void
  /**
   * Poniedziałek, od którego budżet czasu działa. Tygodnie wcześniejsze są gotowe
   * — przeszłość przed decyzją z planu bez bazy albo z zapisanego planu, już po
   * budżecie — i nie są przycinane drugi raz (przy małych celach generator nie
   * jest monotoniczny, więc powtórka dałaby inne dni niż te, które biegacz miał),
   * ani nie trafiają do ostrzeżeń: ich nie da się już zmienić. Z granicą siła
   * zostaje na swoich dniach (plan z historią); bez niej — świeży plan — budżet
   * tygodnia rozstawia ją od nowa pod nowe dni biegowe.
   */
  budgetFrom?: string
  /**
   * Poniedziałek, od którego budżet przycina całe tygodnie (domyślnie `budgetFrom`).
   * Rekalibracja zmienia w bieżącym tygodniu tylko tempa: jego przeszłe dni
   * zostają, więc tydzień przycięty od nowa nie zgadzałby się z tym, co w nim jest
   * — limit dnia skraca za długie dni od `budgetFrom`, tygodnie od następnego.
   */
  weeklyBudgetFrom?: string
  /**
   * false = ostrzeżenia budżetu (`budgetWarnings`) liczy wołający na planie, który
   * zapisze — po złożeniu z dni chronionych (regeneracja, propozycja).
   */
  budgetWarnings?: boolean
  /** B11: blok powrotu po przerwie — szkielety od tygodnia powrotu przed generacją tygodni. */
  returnFrom?: ReturnBlock
}

/** Tydzień sprzed granicy budżetu — gotowy, budżet go nie rusza. */
const beforeBoundary = (week: Microcycle, boundary: string | undefined) => boundary !== undefined && week.weekStart < boundary

/**
 * Tydzień złożony z dni dwóch planów (przeszłe albo chronione zostają, reszta
 * przychodzi z nowego): sumy z dni, a objętość po budżecie i to, co dni mieszczą
 * (`layoutKm`, B1), to to, co w nim faktycznie jest — z tym lint porównuje dni (P-3).
 * Wspólne dla propozycji i regeneracji.
 */
export function settleMixedWeek(week: Microcycle): void {
  Object.assign(week, weekTotals(week.days))
  if (week.skeleton.timeCappedKm !== undefined) week.skeleton = { ...week.skeleton, timeCappedKm: roundKm(week.totalKm) }
  if (week.skeleton.layoutKm !== undefined) week.skeleton = { ...week.skeleton, layoutKm: roundKm(week.totalKm) }
}

/**
 * B1: uwagi generatora (`why`) idą za jednostką, gdy `shift` albo `reschedule` przestawia dni
 * tygodnia; uwaga jednostki, której już nie ma w tygodniu, wypada. `moves` to znane
 * przesunięcia (shift: zamiana dwóch dni); bez nich jednostkę szukamy po treści, najpierw
 * na jej dawnym dniu, potem na dniu, który ją dostał — dwie takie same jednostki nie
 * zamieniają się uwagami, a dzień, który miał taką samą jednostkę już wcześniej, nie
 * przejmuje uwagi tej, która się przesunęła.
 */
export function followNotes(week: Microcycle, before: PlannedDay[], moves?: Record<string, string>): void {
  if (!week.notes?.length) return
  const keyOf = (d: PlannedDay | undefined) => (d?.workout ? JSON.stringify(d.workout) : undefined)
  const keyBefore = (date: string) => keyOf(before.find((d) => d.date === date))
  const notes = week.notes.flatMap((n): WeekNote[] => {
    if (!('date' in n)) return [n]
    if (moves) return [{ ...n, date: moves[n.date] ?? n.date }]
    const key = keyBefore(n.date)
    if (key === undefined) return []
    const stays = keyOf(week.days.find((d) => d.date === n.date)) === key
    const now = stays ? n.date : week.days.find((d) => keyOf(d) === key && keyBefore(d.date) !== key)?.date
    return now ? [{ ...n, date: now }] : []
  })
  if (notes.length) week.notes = notes
  else delete week.notes
}

/**
 * Uwagi generatora tygodnia mieszanego (B1, `why`): uwaga dnia idzie z planu, z którego
 * pochodzi ten dzień — dzień zachowany ze starego planu nie dostaje uwagi o układzie,
 * którego nie ma. Uwagi całego tygodnia (bez daty) — z nowego planu.
 */
export function mergeWeekNotes(old: WeekNote[] | undefined, fresh: WeekNote[] | undefined, freshDates: Set<string>): WeekNote[] | undefined {
  const dated = (n: WeekNote) => ('date' in n ? n.date : undefined)
  const notes = [
    ...(fresh ?? []).filter((n) => dated(n) === undefined || freshDates.has(dated(n)!)),
    ...(old ?? []).filter((n) => dated(n) !== undefined && !freshDates.has(dated(n)!)),
  ]
  return notes.length ? notes : undefined
}

export function computePlan(config: TrainctlConfig, today: string, calibrationDate = today, opts: ComputePlanOptions = {}): StoredPlan {
  const { athlete, goal } = config
  // Wybór wyniku (540 dni, wykluczenia, Z-10) ma jedną implementację — inspectCalibration;
  // z niej korzysta też `why`, żeby podpowiedź o rekalibracji mówiła to, co zrobi plan.
  // Z-10 (inż.): wynik z trailu nie kalibruje stref szosowych — czas w terenie mówi
  // o terenie tak samo jak o formie. Gdy innych wyników brak, używamy go z ostrzeżeniem.
  const roadGoal = isRoadGoal(goal)
  const calibration = inspectCalibration(athlete.results, calibrationDate, roadGoal)
  const selected = calibration.selected
  // wyniki, które przeszły zasadę wyboru (z wybranym) — z nich liczy się też predykcja
  const usable = calibration.candidates.filter((c) => c.reason === 'selected' || c.reason === 'lower-vdot').map((c) => c.result)
  const trailOnly = roadGoal && selected?.terrain === 'trail'
  // źródło stref i VDOT — ta sama funkcja co podpowiedź `why` (zoneCalibration)
  const zoneFrom = zoneCalibration(selected, goal)
  if (zoneFrom.source === 'none') throw new Error(ui().planMd.noCalibration)
  const { source: vdotSource, vdot } = zoneFrom
  const zones = paceZones(vdot)
  // B7: budżet tygodnia (E-2) ogranicza szczyt makrocyklu, zamiast przycinać tygodnie
  // osobno — odciążenie i taper liczą się wtedy od szczytu, który budżet mieści
  const free = planMacrocycle({ today, goal, athlete })
  // Budżet, w którym nie mieści się nawet najkrótszy bieg, nie zeruje planu: sufit nie
  // schodzi poniżej MIN_EASY_KM, a tygodnie ponad budżetem przycina fitTimeBudget
  // z ostrzeżeniem. Każdy taki budżet daje ten sam sufit, więc ciaśniejszy budżet nigdy
  // nie daje większej objętości.
  const budgetCap = config.time?.weeklyMinutes ? Math.max(MIN_EASY_KM, weeklyBudgetPeakKm(config, zones, free.peakKmPlanned)) : undefined
  const capped = budgetCap !== undefined && budgetCap < free.peakKmPlanned
  const macro = capped ? planMacrocycle({ today, goal, athlete, peakCapKm: budgetCap }) : free
  // B11: zatwierdzony powrót (`adapt --apply`) albo powrót z profilu zaczęty po starcie
  // planu (pole dopisane w trakcie, B8) — blok powrotu od `since`. Jedna decyzja naraz:
  // wygrywa nowsza przerwa — powrót z profilu po zatwierdzonym opisuje kolejną przerwę
  const fromProfile = profileReturnBlock(athlete, today, calibrationDate)
  const profileReturn = fromProfile && (!opts.returnFrom || fromProfile.since > opts.returnFrom.since) ? fromProfile : undefined
  const returnFrom = profileReturn ?? opts.returnFrom
  // Blok powrotu działa na plan z budżetem i bez niego, więc różnica między nimi to
  // wyłącznie budżet — krzywa powrotu nie trafia do ostrzeżenia E-2
  const withReturn = (weeks: WeekSkeleton[]) => (returnFrom ? applyReturnBlock(weeks, returnFrom) : weeks)
  const skeletons = withReturn(macro.weeks)
  const freeReturned = capped ? withReturn(free.weeks) : skeletons
  if (capped) {
    // zamiar bez budżetu tydzień po tygodniu — z niego „bez budżetu" w ostrzeżeniu E-2
    const freeTarget = new Map(freeReturned.map((w) => [w.weekStart, w.targetKm]))
    for (const w of skeletons) {
      const target = freeTarget.get(w.weekStart)
      if (target !== undefined && target > w.targetKm) w.uncappedKm = target
    }
  }
  let previousFrequency: number | undefined
  const weeks = skeletons.map((skeleton) => {
    if (skeleton.keepFrequency && previousFrequency !== undefined) skeleton.sessionCount = previousFrequency
    const week = generateMicrocycle({ skeleton, athlete, zones, goal, testDistanceKm: testDistanceKm(goal) })
    if (!skeleton.keepFrequency) previousFrequency = week.days.filter(d => d.workout).length
    return week
  })
  if (config.strength?.enabled) applyStrength(weeks, config.strength)
  // tydzień obniżony przez sufit z budżetu to tydzień „po budżecie" (E-2): lint porównuje
  // jego sumy z tym, co rozpisano, a ostrzeżenie — z zamiarem bez budżetu (`uncappedKm`)
  for (const week of weeks) if (week.skeleton.uncappedKm !== undefined) week.skeleton = { ...week.skeleton, timeCappedKm: roundKm(week.totalKm) }
  const plan: StoredPlan = {
    schemaVersion: PLAN_SCHEMA_VERSION,
    engineVersion: packageVersion(),
    calibration,
    generatedAt: today,
    locale: getLocale(),
    vdot: roundVdot(vdot),
    vdotSource,
    goal,
    peakKmPlanned: macro.peakKmPlanned,
    peakKmRecommended: macro.peakKmRecommended,
    feasibilityWarnings: [...macro.feasibilityWarnings],
    changes: [],
    weeks,
  }

  // plan bazowy nie ma dystansu docelowego, więc i predykcji (P-11)
  if (usable.length > 0 && goal.kind !== 'base') {
    plan.prediction = predictRace(usable, goal.distanceKm, { today: calibrationDate })
  }
  if (vdotSource === 'goal-target') {
    plan.feasibilityWarnings.push(ui().planMd.zonesFromGoal)
  }
  if (trailOnly) plan.feasibilityWarnings.push(ui().planMd.trailOnlyCalibration)
  // powrót z profilu w trakcie planu mówi o sobie tak jak powrót na starcie planu (R-11) —
  // dopóki blok trwa: tydzień bieżący albo późniejszy jest jeszcze na krzywej albo spokojny.
  // Potem ostrzeżenie opisywałoby blok, którego w planie przed biegaczem już nie ma. Każdy
  // powrót patrzy na swoje tygodnie: ze startu planu — przed blokiem w trakcie, ten w trakcie
  // — od swojego `since`.
  const ahead = (w: WeekSkeleton) => w.weekStart >= mondayOf(calibrationDate) && w.ruleRefs.includes('R-11')
  const midStart = returnFrom ? mondayOf(returnFrom.since) : undefined
  const returnAhead = midStart !== undefined && skeletons.some((w) => ahead(w) && w.weekStart >= midStart)
  // Powrót ze startu planu (volumeBase): regeneracja liczy plan od startu, więc makrocykl
  // powtarza ostrzeżenie przez cały cykl — znika, gdy jego spokojny blok jest już za biegaczem
  const startReturn = volumeBase(athlete, today)
  const startAhead = skeletons.some((w) => ahead(w) && (midStart === undefined || w.weekStart < midStart))
  if (startReturn.returning && !startAhead) {
    const text = messages().macro.returnBlock(startReturn.start, athlete.returning!.previousWeeklyKm)
    plan.feasibilityWarnings = plan.feasibilityWarnings.filter((w) => w !== text)
  }
  if (profileReturn && returnAhead) plan.feasibilityWarnings.push(messages().macro.returnBlock(Math.round(RETURN_RESTART_SHARE * profileReturn.previousWeeklyKm), profileReturn.previousWeeklyKm))
  // R-5, R-11: start kontrolny w spokojnym bloku powrotu zostaje, bo to kalendarz biegacza
  // (ADR-011), ale plan mówi, że reguła powrotu go nie przewiduje
  for (const w of plan.weeks) {
    const race = w.skeleton.tuneUp
    // przyszłe względem dzisiejszej daty, nie startu planu (regeneracja liczy plan od startu)
    if (w.skeleton.easyOnly && race && race.date >= calibrationDate) {
      plan.feasibilityWarnings.push(ui().planMd.tuneUpInReturn(race.date, w.skeleton.ruleRefs.includes('R-5') ? 'R-5' : 'R-11'))
    }
  }
  opts.beforeTimeBudget?.(plan)
  if (config.time) fitTimeBudget(plan.weeks, config, zones, testDistanceKm(goal), { from: opts.budgetFrom, weeklyFrom: opts.weeklyBudgetFrom ?? opts.budgetFrom })
  // Szczyt planu to to, co rozpisano (cały cykl — tak samo liczą regeneracja i propozycja),
  // a nie cel makrocyklu: dni (B1), budżet (B7) i blok powrotu (B11) potrafią go obniżyć.
  // Werdykt po powrocie patrzy jednak tylko na tygodnie od powrotu: tygodnie sprzed przerwy
  // minęły i nie mówią, dokąd plan jeszcze dojdzie. Powrót w taperze: szczyt był przed
  // przerwą, werdyktu o szczycie nie ma.
  plan.peakKmPlanned = Math.max(...cycleWeeksOf(plan).map((w) => w.totalKm))
  if (config.time && opts.budgetWarnings !== false) plan.feasibilityWarnings.push(...budgetWarnings(plan, config, today))
  const loadingPhase = (phase: string) => ['base', 'build', 'peak'].includes(phase)
  const returnMonday = returnFrom ? mondayOf(returnFrom.since) : undefined
  const plannedAhead = returnMonday ? cycleWeeksOf(plan).filter((w) => w.weekStart >= returnMonday && loadingPhase(w.skeleton.phase)) : []
  const verdictPeak = plannedAhead.length ? Math.max(...plannedAhead.map((w) => w.totalKm)) : plan.peakKmPlanned
  // B8: werdykt wykonalności — szczyt i najdłuższe wybieganie wobec progów dystansu
  // (P-7/P-8, J-2; ten sam próg co lint `longBelowGoal`) i trzy wyjścia, jednym blokiem
  // zamiast dwóch ostrzeżeń. Liczony na planie po budżecie czasu; po powrocie — na
  // tygodniach od powrotu, także najdłuższe wybieganie.
  const threshold = goal.kind === 'base' ? undefined : longRunThreshold(goal)
  const verdictWeeks = plannedAhead.length ? plannedAhead : cycleWeeksOf(plan).filter((w) => loadingPhase(w.skeleton.phase))
  const longest = Math.max(0, ...verdictWeeks.flatMap((w) => w.days).filter((d) => d.workout?.kind === 'long').map((d) => d.workout!.distanceKm))
  const longShort = threshold !== undefined && longest > 0 && !(threshold.inclusive ? longest >= threshold.km : longest > threshold.km)
  // szczyt obniżony przez budżet ma własne ostrzeżenie (E-2) — werdykt mówi o profilu,
  // a po przerwie o profilu z blokiem powrotu, nadal bez budżetu
  const returnedAhead = returnMonday ? freeReturned.filter((w) => w.weekStart >= returnMonday && loadingPhase(w.phase)) : []
  const freePeak = returnMonday
    ? returnedAhead.length ? Math.max(...returnedAhead.map((w) => w.targetKm)) : Infinity
    : free.peakKmPlanned
  const peakShort = goal.kind !== 'base' && freePeak < macro.peakKmRecommended
  // ostrzeżenie makrocyklu o szczycie zastępuje werdykt albo ostrzeżenie budżetu
  const peakText = messages().macro.peakBelowRecommended(macro.peakKmPlanned, macro.peakKmRecommended, goal.distanceKm)
  if (peakShort || longShort || capped) plan.feasibilityWarnings = plan.feasibilityWarnings.filter((w) => w !== peakText)
  if (peakShort || (longShort && !capped)) {
    // po bloku powrotu data liczy się od powrotu, ze startu bloku (RETURN_RESTART_SHARE, ten
    // sam co applyReturnBlock) — powrót jest decyzją, więc obowiązuje także wtedy, gdy profil
    // ma jeszcze objętość sprzed przerwy (B11.5). Bez powrotu: od dzisiejszej daty, nie od
    // startu planu — regeneracja liczy plan od startu, a rada dotyczy planu zaczętego dziś.
    const ret = returnFrom
    const reachableFrom = ret
      ? earliestFeasibleRaceDate({ ...athlete, recentWeeklyKm: Math.round(RETURN_RESTART_SHARE * ret.previousWeeklyKm), returning: { since: ret.since, previousWeeklyKm: ret.previousWeeklyKm } }, goal, ret.since)
      : earliestFeasibleRaceDate(athlete, goal, calibrationDate)
    // w werdykcie tylko progi, do których plan nie dochodzi — spełniony próg w zdaniu
    // „nie dochodzi do progów” czytałby się jak brak. Szczyt obcięty budżetem ma własne
    // ostrzeżenie (E-2), więc werdykt podaje szczyt profilu bez budżetu — ten, od którego
    // liczy się też data osiągalności
    plan.feasibilityWarnings.push(ui().planMd.verdict({
      distanceKm: goal.distanceKm,
      ...(peakShort ? { peak: { km: capped ? freePeak : verdictPeak, recommendedKm: plan.peakKmRecommended } } : {}),
      ...(plannedAhead.length ? { afterReturn: true } : {}),
      ...(longShort && threshold ? { longest: { km: longest, thresholdKm: threshold.km, atLeast: threshold.inclusive, rules: threshold.ruleRefs.join(', ') } } : {}),
      // data osiągalności to niedziela tygodnia startu: start w tym samym tygodniu (np. w sobotę)
      // ma ten sam plan, więc rada „przesuń start” dotyczy dopiero późniejszego tygodnia
      ...(reachableFrom && mondayOf(reachableFrom) > mondayOf(goal.date) ? { reachableFrom } : {}),
    }))
  }
  // B4 + B7: budżet ogranicza szczyt, a długie zostaje poniżej progu dystansu — ostrzeżenie
  // budżetu mówi o szczycie, więc liczby długiego osobno (bez werdyktu: wyjściem są minuty)
  if (longShort && capped && !peakShort && threshold) {
    plan.feasibilityWarnings.push(ui().planMd.timeCapsLong({ km: longest, thresholdKm: threshold.km, atLeast: threshold.inclusive, rules: threshold.ruleRefs.join(', ') }))
  }
  plan.generatedDays = Object.fromEntries(plan.weeks.flatMap((w) => w.days).map((d) => [d.date, dayFingerprint(d)]))
  return plan
}

/**
 * Poziom bloku dla każdego tygodnia (B3): najwyższy cel kolejnych tygodni ładowania
 * między odciążeniami; odciążenie, taper, start i blok po starcie dostają poziom
 * ostatniego bloku przed nimi (pierwszego, gdy żadnego nie było wcześniej).
 */
function blockLevels(weeks: Microcycle[]): Map<string, number> {
  const normal = (w: Microcycle) => !w.skeleton.deload && ['base', 'build', 'peak'].includes(w.skeleton.phase)
  const levels = new Map<string, number>()
  const runs: Microcycle[][] = []
  for (const [i, week] of weeks.entries()) {
    if (!normal(week)) continue
    if (i > 0 && normal(weeks[i - 1]!) && runs.length) runs.at(-1)!.push(week)
    else runs.push([week])
  }
  const runLevel = new Map(runs.flatMap((run) => {
    const level = Math.max(...run.map((w) => w.skeleton.targetKm))
    return run.map((w) => [w.weekStart, level] as const)
  }))
  let last = runs[0] ? Math.max(...runs[0].map((w) => w.skeleton.targetKm)) : undefined
  for (const week of weeks) {
    const own = runLevel.get(week.weekStart)
    if (own !== undefined) last = own
    levels.set(week.weekStart, own ?? last ?? week.skeleton.targetKm)
  }
  return levels
}

/**
 * Poziom bloku tygodnia (B3) — ten sam, od którego `scaleToBaseline` liczy proporcję.
 * Z niego `adapt` liczy podniesienie bazy, więc propozycja w odciążeniu albo taperze nie
 * zamienia „podnieś” w cięcie.
 */
export function blockLevelOf(weeks: Microcycle[], weekStart: string): number | undefined {
  return blockLevels(weeks).get(weekStart)
}

/**
 * Skalowanie objętości do zatwierdzonej bazy — jedna arytmetyka dla propozycji
 * (`adapt --prepare`, ADR-029) i regeneracji z zapisaną bazą (ADR-033), żeby
 * `plan` tuż po `adapt --apply` odtwarzał zatwierdzone dni. Baza zastępuje poziom
 * bloku w tygodniu decyzji (B3), a każdy tydzień od poniedziałku decyzji skaluje się
 * w tej samej proporcji: fala w bloku, odciążenia, taper i wzrost kolejnych bloków
 * zostają — biegacz „progresuje od tej bazy” (P-3). Podniesiona baza nie wyprowadza
 * planu ponad jego szczyt sprzed decyzji (sufit z historii i pojemność dni), chyba że
 * sama jest wyżej. Budżet czasu stosuje potem computePlan, raz, od tego samego
 * poniedziałku (`budgetFrom`); tygodnie wcześniejsze przechodzą z `reference`.
 * Siła to osobny tor: korekta objętości jej nie przestawia — też z `reference`.
 */
export function scaleToBaseline(weeks: Microcycle[], opts: {
  baselineKm: number
  decidedOn: string
  config: TrainctlConfig
  goal: RaceGoal
  vdot: number
  /**
   * Plan bez bazy: tygodnie sprzed decyzji przechodzą z niego bez zmian, a siła
   * (sesje dni i notatki tygodnia) — do tygodni skalowanych.
   */
  reference: Microcycle[]
}): Microcycle[] {
  const zones = paceZones(opts.vdot)
  const levels = blockLevels(weeks)
  const from = mondayOf(opts.decidedOn)
  const ahead = weeks.filter((w) => w.weekStart >= from)
  const anchor = ahead[0] ? levels.get(ahead[0].weekStart) ?? ahead[0].skeleton.targetKm : opts.baselineKm
  const factor = opts.baselineKm / Math.max(1, anchor)
  const ceiling = factor > 1 ? Math.max(opts.baselineKm, ...ahead.map((w) => w.skeleton.targetKm)) : Infinity
  const strengthDays = new Map(opts.reference.flatMap((w) => w.days).map((d) => [d.date, d.strength]))
  const referenceWeeks = new Map(opts.reference.map((w) => [w.weekStart, w]))
  return weeks.map((week) => {
    // tygodnie przed decyzją to przeszłość, której decyzja nie dotyczy — takie, jak
    // w planie bez bazy (kopia: computePlan zmienia tygodnie w miejscu, a to mogą
    // być tygodnie zapisanego planu)
    if (week.weekStart < from) return structuredClone(referenceWeeks.get(week.weekStart) ?? week)
    const skeleton = structuredClone(week.skeleton)
    delete skeleton.timeCappedKm
    delete skeleton.uncappedKm
    const before = skeleton.targetKm
    // podniesienie: blok, który przekroczyłby szczyt sprzed decyzji, trafia na niego cały —
    // fala, odciążenie i taper po nim w tej samej proporcji (P-2, T-4), bez spłaszczenia
    const effective = Math.min(factor, ceiling / Math.max(1, levels.get(week.weekStart) ?? before))
    skeleton.targetKm = Math.round(before * effective)
    // tor długiego (B4) jest podłogą generatora: po redukcji maleje razem z tygodniem
    if (skeleton.longKm !== undefined && skeleton.targetKm < before && before > 0) skeleton.longKm = Math.round((skeleton.longKm * skeleton.targetKm) / before)
    const generated = generateMicrocycle({ skeleton, athlete: opts.config.athlete, goal: opts.goal, zones, testDistanceKm: testDistanceKm(opts.goal) })
    for (const day of generated.days) {
      const strength = strengthDays.get(day.date)
      if (strength) day.strength = structuredClone(strength)
    }
    const notes = referenceWeeks.get(week.weekStart)?.strengthNotes
    if (notes?.length) generated.strengthNotes = [...notes]
    return generated
  })
}

export function writePlan(cwd: string, plan: StoredPlan): void {
  mkdirSync(join(cwd, PLAN_DIR), { recursive: true })
  // Bez aliasów YAML (`pace: *a1`): plan jest dokumentem, który użytkownik czyta
  // i edytuje (plan-as-code), a alias zmusza go do skakania po pliku — i sprawia,
  // że edycja jednego miejsca po cichu zmienia inne.
  writeFileSync(join(cwd, PLAN_YAML), stringify(plan, { aliasDuplicateObjects: false }), 'utf-8')
  writeFileSync(join(cwd, PLAN_MD), renderMarkdown(plan), 'utf-8')
}

/** Przygotowanie wliczone w budżet czasu — to samo domyślne 15 minut co w E-1. */
const PREPARATION_MINUTES = 15

const isWeekend = (wd: string) => wd === 'sat' || wd === 'sun'

/** Plik planu czyta i edytuje człowiek — bez szumu zmiennoprzecinkowego (25.000000000000004). */
const roundKm = (km: number) => Math.round(km * 10) / 10

/**
 * Budżet czasu z profilu (E-2, wartość inżynierska) — dwa kroki:
 *  1. tydzień ponad `weeklyMinutes` dostaje niższy cel kilometrów (nadwyżka minut
 *     przeliczona po wolniejszej granicy tempa spokojnego) i jest generowany
 *     od nowa — objętość wypłaszcza się na tym, co się mieści;
 *  2. dzień ponad limitem dnia przechodzi przez to samo skracanie co `shorten`
 *     (E-1), z jawnym `timeAdjustment` i utratą celu, gdy wariant jej wymaga.
 * Starty i sprawdziany nie są skracane; co się nie mieści, zostaje ostrzeżeniem.
 */
function fitTimeBudget(
  weeks: Microcycle[], config: TrainctlConfig, zones: ReturnType<typeof paceZones>, testKm: number,
  bounds: { from: string | undefined; weeklyFrom: string | undefined },
): void {
  const ready = (week: Microcycle) => beforeBoundary(week, bounds.from)
  const weeklyReady = (week: Microcycle) => beforeBoundary(week, bounds.weeklyFrom)
  const time = config.time!
  const minutesOf = (d: PlannedDay) =>
    (d.workout ? estimateWorkoutMinutes(d.workout, PREPARATION_MINUTES) : 0) + (d.strength?.durationMin ?? 0)
  const runMinutes = (w: Microcycle) => w.days.reduce((s, d) => s + (d.workout ? estimateWorkoutMinutes(d.workout, PREPARATION_MINUTES) : 0), 0)
  const easyMinPerKm = zones.easy.hiSecPerKm / 60
  if (time.weeklyMinutes) {
    let capped = false
    for (let i = 0; i < weeks.length; i++) {
      if (weeklyReady(weeks[i]!)) continue
      // Siła wraca dopiero po pętli (applyStrength) — jej minuty liczymy z tygodnia
      // przed regeneracją, inaczej kolejny przebieg uznałby tydzień za zmieszczony.
      const strengthMinutes = weeks[i]!.days.reduce((s, d) => s + (d.strength?.durationMin ?? 0), 0)
      // Cel podawany generatorowi maleje z przebiegu na przebieg i nie przekracza
      // tego, co generator faktycznie rozpisał: rozpisana objętość bywa wyższa od celu
      // (minima jednostek), a cel szkieletu — nieosiągalny (mało dni, limit długiego).
      // Redukcja liczona od którejś z nich mogłaby tydzień podnieść albo nie zejść
      // pod budżet w czterech przebiegach. Budżet tylko obniża: tydzień przycięty
      // wcześniej po szybszej rekalibracji nie rośnie — objętość podnosi `plan`.
      let requested = weeks[i]!.skeleton.targetKm
      const uncappedKm = weeks[i]!.skeleton.uncappedKm ?? roundKm(weeks[i]!.totalKm)
      for (let pass = 0; pass < 4; pass++) {
        const week = weeks[i]!
        if (week.skeleton.raceDate) break
        const minutes = runMinutes(week) + strengthMinutes
        if (minutes <= time.weeklyMinutes) break
        requested = Math.min(requested, week.totalKm)
        const target = Math.max(5, Math.floor(requested - (minutes - time.weeklyMinutes) / easyMinPerKm))
        if (target >= requested) break
        requested = target
        const regenerated = generateMicrocycle({ skeleton: { ...week.skeleton, targetKm: target }, athlete: config.athlete, zones, goal: config.goal, testDistanceKm: testKm })
        // zamiar makrocyklu zostaje w targetKm; budżet zapisuje obok objętość, którą
        // generator faktycznie rozpisał (bywa wyżej niż cel), bo z nią lint porównuje sumy (P-3)
        regenerated.skeleton = { ...week.skeleton, timeCappedKm: roundKm(regenerated.totalKm), uncappedKm }
        for (const day of regenerated.days) {
          const session = week.days.find((d) => d.date === day.date)?.strength
          if (session) day.strength = structuredClone(session)
        }
        // notatki siły tygodnia (PLAN.md) idą razem z sesjami — w świeżym planie i tak
        // ustawi je od nowa applyStrength, w planie z historią nie ma kto
        if (week.strengthNotes?.length) regenerated.strengthNotes = [...week.strengthNotes]
        weeks[i] = regenerated
        capped = true
      }
    }
    // świeży plan (bez granicy): siła rozstawiona od nowa pod nowe dni biegowe; plan
    // z historią — siła zostaje, korekta objętości jej nie przestawia, a applyStrength
    // ruszyłby też gotowe tygodnie
    if (capped && bounds.from === undefined && config.strength?.enabled) applyStrength(weeks, config.strength)
  }
  for (const week of weeks) {
    if (ready(week)) continue
    let shortened = false
    const uncappedKm = week.skeleton.uncappedKm ?? roundKm(week.totalKm)
    for (const day of week.days) {
      const cap = isWeekend(day.weekday) ? time.weekendMinutes : time.weekdayMinutes
      if (cap === undefined || !day.workout || minutesOf(day) <= cap) continue
      // startów i sprawdzianów nie skracamy — zostają w ostrzeżeniu (budgetWarnings)
      if (['race', 'test'].includes(day.workout.kind)) continue
      const result = shortenWorkout(day.workout, cap, { preparationMinutes: PREPARATION_MINUTES, strengthMinutes: day.strength?.durationMin ?? 0 })
      if (result.workout && (result.status === 'shortened' || result.status === 'easy-alternative')) {
        // ponowne skrócenie (np. po rekalibracji) nie gubi pierwotnej jednostki ani utraty celu
        const earlier = day.timeAdjustment
        day.timeAdjustment = {
          originalKind: earlier?.originalKind ?? day.workout.kind,
          originalDistanceKm: earlier?.originalDistanceKm ?? day.workout.distanceKm,
          budgetMinutes: cap,
          status: earlier?.status === 'easy-alternative' ? 'easy-alternative' : result.status,
          origin: 'profile',
        }
        day.workout = result.workout
        shortened = true
      }
    }
    Object.assign(week, weekTotals(week.days))
    // Skrócone dni obniżają objętość tygodnia — zapisujemy ją obok zamiaru (targetKm),
    // inaczej lint zgłaszałby P-3 na świeżo wygenerowanym planie.
    if (shortened) week.skeleton = { ...week.skeleton, timeCappedKm: roundKm(week.totalKm), uncappedKm }
  }
}

/**
 * B7: najwyższa objętość tygodnia ładowania (do `upToKm`), która mieści się w budżecie
 * tygodnia z profilu razem z siłą, jaka w takim tygodniu wypada (E-2). Próbny tydzień
 * budowania i szczytu, przegląd od góry co 1 km — jak pojemność dni (B1).
 */
function weeklyBudgetPeakKm(config: TrainctlConfig, zones: ReturnType<typeof paceZones>, upToKm: number): number {
  const minutes = config.time!.weeklyMinutes!
  const qualitySessions = qualitySessionsFor(config.athlete)
  const fits = (km: number) => (['pyramidal', 'polarized'] as const).every((model) => {
    const week = generateMicrocycle({
      skeleton: {
        weekStart: '2026-01-05', index: 6, phase: model === 'polarized' ? 'peak' : 'build', intensityModel: model,
        targetKm: km, deload: false, keepIntensity: false, keepFrequency: false, qualitySessions, flags: [], ruleRefs: [],
      },
      athlete: config.athlete, zones, goal: config.goal,
    })
    const run = week.days.reduce((s, d) => s + (d.workout ? estimateWorkoutMinutes(d.workout, PREPARATION_MINUTES) : 0), 0)
    const strength = config.strength?.enabled
      ? [...planStrengthWeek({ week, phase: week.skeleton.phase, deload: false, blockWeek: 6, ...(config.strength.days?.length ? { daysPreference: config.strength.days } : {}) }).byDate.values()]
        .reduce((s, x) => s + x.durationMin, 0)
      : 0
    return run + strength <= minutes
  })
  for (let km = Math.round(upToKm); km > 0; km--) if (fits(km)) return km
  return 0
}

/**
 * Ostrzeżenia budżetu czasu (E-2) liczone na planie, który biegacz dostaje — także
 * po złożeniu z dni chronionych — i tylko dla tego, co da się jeszcze zmienić:
 * dni od `from` za długie na limit dnia (starty, sprawdziany, jednostki, których nie
 * da się skrócić), tygodnie z takimi dniami ponad budżetem tygodnia oraz szczyt
 * tygodni w całości od `from` obniżony przez budżet poniżej rekomendacji — z tym,
 * ile tygodnie miałyby bez budżetu (`uncappedKm`), bo to bywa mniej niż rekomendacja
 * (baza biegacza, mało dni, redukcja) i „więcej minut" da tylko tyle. Tolerancja
 * P-3 (0,5 km): zaokrąglenie generatora to nie przycięcie.
 */
export function budgetWarnings(plan: StoredPlan, config: TrainctlConfig, from: string): string[] {
  const time = config.time
  if (!time) return []
  const minutesOf = (d: PlannedDay) =>
    (d.workout ? estimateWorkoutMinutes(d.workout, PREPARATION_MINUTES) : 0) + (d.strength?.durationMin ?? 0)
  const weeks = cycleWeeksOf(plan)
  const tooLong = weeks.flatMap((w) => w.days).filter((d) => {
    const cap = isWeekend(d.weekday) ? time.weekendMinutes : time.weekdayMinutes
    return d.date >= from && d.workout !== undefined && cap !== undefined && minutesOf(d) > cap
  }).map((d) => d.date)
  const overWeek = time.weeklyMinutes
    ? weeks.filter((w) => w.days.some((d) => d.date >= from) && !w.skeleton.raceDate &&
      w.days.reduce((s, d) => s + (d.workout || d.strength ? minutesOf(d) : 0), 0) > time.weeklyMinutes!).map((w) => w.weekStart)
    : []
  const ahead = weeks.filter((w) => w.weekStart >= from)
  const peak = Math.max(0, ...ahead.map((w) => w.totalKm))
  const withoutBudget = Math.max(0, ...ahead.map((w) => w.skeleton.uncappedKm ?? w.totalKm))
  const binds = ahead.some((w) => w.skeleton.timeCappedKm !== undefined) && peak + 0.5 < withoutBudget
  const capsVolume = binds && peak < plan.peakKmRecommended
  // B7: budżet trzyma plan poniżej zamiaru, choć nad rekomendacją — tygodnie stoją na tym
  // poziomie, a progresję niosą długie i akcenty; biegacz ma wiedzieć, co budżet kosztuje
  const holdsVolume = binds && !capsVolume
  const strength = config.strength?.enabled === true
  return [
    ...(tooLong.length ? [ui().planMd.timeDayTooShort(tooLong.join(', '))] : []),
    ...(overWeek.length ? [ui().planMd.timeWeekOver(overWeek.join(', '))] : []),
    ...(capsVolume ? [ui().planMd.timeCapsVolume(peak, withoutBudget, plan.peakKmRecommended, strength)] : []),
    // plan bazowy nie ma dystansu, więc i progu P-7/P-8, który budżet by spełniał
    ...(holdsVolume ? [ui().planMd.timeHoldsVolume(peak, withoutBudget, strength, plan.goal.kind !== 'base')] : []),
  ]
}

/**
 * Rozstawienie siły na ciągu tygodni. Ciąg, a nie tydzień po tygodniu osobno:
 * odstęp ≥48 h musi obowiązywać także na styku niedziela→poniedziałek.
 * Używane przy generacji planu i ponownie po renegocjacji tygodnia.
 */
export function applyStrength(weeks: Microcycle[], strength: StrengthConfig): void {
  let lastSessionDate: string | undefined
  // tydzień bloku siły: liczymy tygodnie, w których siła w ogóle wchodzi do planu
  let blockWeek = 0
  for (const week of weeks) {
    const { byDate, notes } = planStrengthWeek({
      week,
      phase: week.skeleton.phase,
      deload: week.skeleton.deload,
      blockWeek,
      ...(strength.days?.length ? { daysPreference: strength.days } : {}),
      ...(lastSessionDate ? { lastSessionDate } : {}),
    })
    if (!['taper', 'race'].includes(week.skeleton.phase)) blockWeek++
    for (const day of week.days) {
      const session = byDate.get(day.date)
      if (session) day.strength = session
      else delete day.strength
    }
    const dates = [...byDate.keys()].sort()
    if (dates.length) lastSessionDate = dates[dates.length - 1]
    if (notes.length) week.strengthNotes = notes
    else delete week.strengthNotes
  }
}

/**
 * Minimum, na którym opierają się komendy: cel z datą i lista tygodni.
 * Plik bywa pusty albo obcięty (przerwana edycja, `git show` na złej ścieżce) —
 * lepiej powiedzieć to zdaniem niż wywalić się na `null.goal`.
 */
function looksLikePlan(value: unknown): value is StoredPlan {
  if (!value || typeof value !== 'object') return false
  const plan = value as Partial<StoredPlan>
  return (
    !!plan.goal &&
    typeof plan.goal === 'object' &&
    typeof plan.goal.date === 'string' &&
    Array.isArray(plan.weeks)
  )
}

/**
 * Surowy dokument planu, bez kontroli kształtu — wyłącznie dla `trainctl check`,
 * które o połamanym pliku ma zgłosić ustalenie lintu, a nie rzucić wyjątkiem.
 */
export function readPlanDocument(cwd: string): unknown {
  const path = join(cwd, PLAN_YAML)
  if (!existsSync(path)) {
    // Pusty katalog to krok `init`, nie `plan` — inaczej `today` odsyła do `plan`,
    // a `plan` dopiero powie, że brakuje profilu.
    throw new Error(existsSync(join(cwd, CONFIG_FILE)) ? ui().common.noPlan : ui().common.missingConfig(CONFIG_FILE))
  }
  return parse(readFileSync(path, 'utf-8'))
}

export function loadPlan(cwd: string): StoredPlan {
  const doc = readPlanDocument(cwd)
  if (!looksLikePlan(doc)) {
    throw new Error(ui().common.planMalformed(PLAN_YAML))
  }
  if (typeof doc.schemaVersion === 'number' && doc.schemaVersion > PLAN_SCHEMA_VERSION) {
    throw new Error(ui().common.planSchemaNewer(PLAN_YAML, doc.schemaVersion))
  }
  return doc
}

/**
 * Plan z dowolnego pliku — do porównań scenariuszowych (`diff --plan`):
 * inna gałąź (git show gałąź:plan/plan.yaml > plik), worktree, kopia robocza.
 */
export function loadPlanFile(path: string): StoredPlan {
  if (!existsSync(path)) {
    throw new Error(ui().diff.otherPlanMissing(path))
  }
  const doc = parse(readFileSync(path, 'utf-8'))
  if (!looksLikePlan(doc)) {
    throw new Error(ui().diff.otherPlanInvalid(path))
  }
  return doc
}

export type ExistingPlan =
  | { status: 'missing' }
  | { status: 'ok'; plan: StoredPlan }
  | { status: 'unreadable'; reason: 'parse' | 'shape' }
  | { status: 'unreadable'; reason: 'schema'; version: number }

/**
 * Co powiedzieć o pliku planu, którego nie da się użyć. Nowszy schemat to plan
 * z nowszego trainctl (np. od drugiej osoby z repo) — rada to aktualizacja, nie
 * `--fresh`, które porzuciłoby poprawny plan z przypięciami i historią.
 */
export function unusablePlanMessage(found: Extract<ExistingPlan, { status: 'unreadable' }>): string {
  return found.reason === 'schema'
    ? ui().common.planSchemaNewer(PLAN_YAML, found.version)
    : ui().plan.unreadable(PLAN_YAML, ui().plan.unreadableReason[found.reason])
}

/**
 * Istniejący plik planu i to, czy da się go użyć. Niesparsowalny (znaczniki
 * konfliktu merge'a), bez celu i tygodni albo z nowszym schematem to
 * `unreadable` — `plan` odmawia wtedy cichego nadpisania (historia, przypięcia
 * i zatwierdzona baza zginęłyby bez słowa) i nadpisuje dopiero na jawne `--fresh`.
 */
export function readExistingPlan(cwd: string): ExistingPlan {
  if (!existsSync(join(cwd, PLAN_YAML))) return { status: 'missing' }
  let doc: unknown
  try {
    doc = parse(readFileSync(join(cwd, PLAN_YAML), 'utf-8'))
  } catch {
    return { status: 'unreadable', reason: 'parse' }
  }
  if (!looksLikePlan(doc)) return { status: 'unreadable', reason: 'shape' }
  if (typeof doc.schemaVersion === 'number' && doc.schemaVersion > PLAN_SCHEMA_VERSION) return { status: 'unreadable', reason: 'schema', version: doc.schemaVersion }
  return { status: 'ok', plan: doc }
}

/** Ostatni dzień planu — po starcie plan trwa dalej blokiem przejściowym (R-8). */
export const planEnd = (plan: StoredPlan): string => plan.weeks.at(-1)?.days.at(-1)?.date ?? plan.goal.date

/** Tygodnie bieżącego cyklu — bez historii poprzedniego, która została w pliku. */
export const cycleWeeksOf = (plan: StoredPlan): Microcycle[] =>
  plan.cycleStart ? plan.weeks.filter((w) => w.weekStart >= plan.cycleStart!) : plan.weeks

/**
 * Położenie tygodnia w jego cyklu — „tydzień 3/14" liczy tygodnie tego cyklu,
 * a nie historię poprzedniego, która została w pliku.
 */
export function weekPosition(plan: StoredPlan, week: Microcycle): { index: number; total: number } {
  const start = plan.cycleStart
  if (!start) return { index: plan.weeks.indexOf(week), total: plan.weeks.length }
  const inCycle = week.weekStart >= start
  const group = plan.weeks.filter((w) => (w.weekStart >= start) === inCycle)
  return { index: group.indexOf(week), total: group.length }
}

export function findDay(
  plan: StoredPlan,
  date: string,
): { week: Microcycle; day: PlannedDay } | undefined {
  for (const week of plan.weeks) {
    for (const day of week.days) {
      if (day.date === date) return { week, day }
    }
  }
  return undefined
}

/** Sekundy → „H:MM:SS"/„M:SS". Zaokrąglamy CAŁOŚĆ, inaczej 3599,7 s dałoby „59:60". */
export function fmtTime(sec: number): string {
  const total = Math.round(sec)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`
}

export function workoutText(day: PlannedDay): string {
  if (!day.workout) return ui().planMd.rest
  const segments = day.workout.segments
  // Człon schłodzenia rozpoznajemy po TYPIE, nie po treści opisu: dopasowanie do
  // tekstu („Na koniec treningu…") działało tylko po polsku i cicho przestawało
  // po zmianie brzmienia opisu.
  const cooldown = segments.findIndex((s) => s.type === 'cooldown')
  const parts = segments.map((s) => s.description)
  if (cooldown === -1) return parts.join(' + ')
  const mains = parts.filter((_, i) => i !== cooldown).join(' + ')
  // człony bywają już zakończone kropką — nie dokładamy drugiej
  return `${mains.replace(/\.\s*$/, '')}. ${parts[cooldown]}`
}

export function renderMarkdown(plan: StoredPlan): string {
  const m = ui().planMd
  const core = messages()
  const lines: string[] = []
  const target = plan.goal.targetTimeSec ? m.goalTime(fmtTime(plan.goal.targetTimeSec)) : ''
  lines.push(`# ${plan.goal.kind === 'base' ? m.headingBase(plan.goal.name, plan.goal.date) : m.heading(plan.goal.name, plan.goal.date)}${target}`)
  lines.push('')
  lines.push(
    m.meta(
      plan.generatedAt,
      plan.vdot,
      plan.vdotSource === 'result' ? m.vdotFromResult : m.vdotFromGoal,
      plan.peakKmPlanned,
    ),
  )
  if (plan.prediction) {
    lines.push(
      m.prediction(
        plan.goal.distanceKm,
        fmtTime(plan.prediction.loSec),
        fmtTime(plan.prediction.hiSec),
        plan.prediction.method,
      ),
    )
  }
  for (const w of plan.feasibilityWarnings) lines.push(`> ⚠ ${w}`)
  for (const week of plan.weeks) {
    const sk = week.skeleton
    const label = [
      core.phase[sk.phase] ?? sk.phase,
      core.intensityModel[sk.intensityModel],
      kmLabel(week.totalKm),
      ...(sk.deload ? [m.deload] : []),
    ].join(' · ')
    lines.push('', `## ${m.weekHeading(weekPosition(plan, week).index + 1, week.weekStart, label)}`, '')
    lines.push(
      `| ${m.columns.day} | ${m.columns.date} | ${m.columns.workout} |`,
      '|---|---|---|',
    )
    for (const day of week.days) {
      const [, mo, d] = day.date.split('-')
      const strength = day.strength ? m.strengthTag(day.strength.durationMin) : ''
      lines.push(
        `| ${core.weekdayShort[day.weekday]} | ${Number(d)}.${mo} | ${workoutText(day)}${strength} |`,
      )
    }
    for (const note of week.strengthNotes ?? []) lines.push(`> ${note}`)
  }
  if (plan.changes.length) {
    lines.push('', `## ${m.changes}`, '')
    // Historia zmian to zapis z plan.yaml w brzmieniu z chwili zmiany (język CLI z tamtej
    // chwili, surowe liczby). PLAN.md cytuje ją bez przeróbek: zamiana samych liczb
    // w tekście pisanym w innym języku dawałaby pół-tłumaczenie.
    for (const c of plan.changes) lines.push(`- ${m.changeLine(c.at, c.action, c.detail)}`)
  }
  lines.push('')
  return lines.join('\n')
}

const QUALITY_KINDS = new Set(['quality_intervals', 'quality_continuous', 'sharpener', 'test', 'race'])

/** Zamiana treningów między dwoma datami tego samego tygodnia (renegocjacja ręczna). */
export function shiftWorkout(
  plan: StoredPlan,
  fromDate: string,
  toDate: string,
): { warnings: string[] } {
  const t = ui().shift
  const from = findDay(plan, fromDate)
  const to = findDay(plan, toDate)
  if (!from) throw new Error(t.outsidePlan(fromDate))
  if (!to) throw new Error(t.outsidePlan(toDate))
  if (from.week.weekStart !== to.week.weekStart) {
    throw new Error(t.sameWeekOnly)
  }
  if (from.day.pinned || to.day.pinned) throw new Error(ui().improve.pinnedShift)
  if (from.day.workout?.kind === 'race' || to.day.workout?.kind === 'race') throw new Error(t.notRaceDay)
  const race = from.week.days.find(d => d.workout?.kind === 'race')?.date ?? from.week.skeleton.raceDate
  if (race) {
    if (fromDate === race || toDate === race) throw new Error(t.notRaceDay)
    const dayBefore = diffDays(fromDate, race) === 1 ? fromDate : diffDays(toDate, race) === 1 ? toDate : null
    const moved = dayBefore === toDate ? from.day.workout : to.day.workout
    if (dayBefore && moved) {
      throw new Error(t.dayBeforeRaceLight)
    }
  }
  for (const [day, workout] of [[from.day, to.day.workout], [to.day, from.day.workout]] as const) {
    const budget = plan.timeBudgets?.[day.date]
    const minutes = (workout ? estimateWorkoutMinutes(workout, plan.preparationMinutes ?? 15) : 0) + (day.strength?.durationMin ?? 0)
    if (budget !== undefined && minutes > budget) {
      throw new Error(ui().improve.badBudget)
    }
  }
  const before = structuredClone(from.week.days)
  const tmp = from.day.workout
  const adjustment = from.day.timeAdjustment
  if (to.day.workout) from.day.workout = to.day.workout
  else delete from.day.workout
  if (tmp) to.day.workout = tmp
  else delete to.day.workout
  if (to.day.timeAdjustment) from.day.timeAdjustment = to.day.timeAdjustment
  else delete from.day.timeAdjustment
  if (adjustment) to.day.timeAdjustment = adjustment
  else delete to.day.timeAdjustment
  followNotes(from.week, before, { [fromDate]: toDate, [toDate]: fromDate })

  const warnings: string[] = []
  const qualityDays = from.week.days
    .filter((d) => d.workout && QUALITY_KINDS.has(d.workout.kind))
    .map((d) => d.date)
  for (let i = 1; i < qualityDays.length; i++) {
    const gap = Math.abs(diffDays(qualityDays[i - 1]!, qualityDays[i]!))
    if (gap < 2) {
      warnings.push(t.accentsTooClose(qualityDays[i - 1]!, qualityDays[i]!))
    }
  }

  // Siła zostaje na swoim dniu (przesuwamy bieganie, nie siłownię), ale
  // przesunięcie akcentu mogło ją postawić obok jednostki jakościowej albo
  // dzień przed nią — S-5 tego zabrania, więc musimy o tym powiedzieć.
  for (const day of from.week.days) {
    if (!day.strength) continue
    const sameDay = day.workout && QUALITY_KINDS.has(day.workout.kind)
    const next = from.week.days.find((d) => diffDays(day.date, d.date) === 1)
    const dayBeforeQuality = next?.workout && QUALITY_KINDS.has(next.workout.kind)
    if (sameDay) {
      warnings.push(t.strengthSameDay(day.date))
    } else if (dayBeforeQuality) {
      warnings.push(t.strengthDayBefore(day.date, next!.date))
    }
  }
  return { warnings }
}
