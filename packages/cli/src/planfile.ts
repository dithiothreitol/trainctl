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
  getLocale,
  messages,
  paceZones,
  planMacrocycle,
  planStrengthWeek,
  predictRace,
  testDistanceKm,
  vdotFromRace,
  type Microcycle,
  type PlannedDay,
  type RaceGoal,
  type RacePrediction,
} from 'trainctl-core'
import { CONFIG_FILE, type StrengthConfig, type TrainctlConfig } from './config.ts'
import { ui } from './i18n/index.ts'
import { inspectCalibration, type Calibration } from './calibration.ts'
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
  /** 'keep' = siła zostaje tam, gdzie była (plan z historią); 'reapply' = świeży plan. */
  budgetStrength?: 'reapply' | 'keep'
  /**
   * Poniedziałek, od którego budżet czasu działa. Tygodnie wcześniejsze są już
   * gotowe — przyszły z planu bez bazy albo z zapisanego planu (przeszłość przed
   * decyzją) — i drugi raz nie są przycinane: przy małych celach generator nie
   * jest monotoniczny, więc powtórka dałaby inne dni niż te, które biegacz miał.
   */
  budgetFrom?: string
}

export function computePlan(config: TrainctlConfig, today: string, calibrationDate = today, opts: ComputePlanOptions = {}): StoredPlan {
  const { athlete, goal } = config
  const recent = athlete.results.filter(
    (r) => !r.excluded && r.date <= calibrationDate && diffDays(r.date, calibrationDate) <= 540,
  )
  // Z-10 (inż.): wynik z trailu nie kalibruje stref szosowych — czas w terenie mówi
  // o terenie tak samo jak o formie. Gdy innych wyników brak, używamy go z ostrzeżeniem.
  const roadGoal = goal.terrain !== 'trail' && goal.terrain !== 'ultra'
  const road = roadGoal ? recent.filter((r) => r.terrain !== 'trail') : recent
  const usable = road.length ? road : recent
  const trailOnly = roadGoal && road.length === 0 && recent.length > 0
  let vdot: number
  let vdotSource: StoredPlan['vdotSource']
  if (usable.length > 0) {
    vdot = Math.max(...usable.map((r) => vdotFromRace(r.distanceKm, r.timeSec)))
    vdotSource = 'result'
  } else if (goal.targetTimeSec && goal.kind !== 'base') {
    vdot = vdotFromRace(goal.distanceKm, goal.targetTimeSec)
    vdotSource = 'goal-target'
  } else {
    throw new Error(ui().planMd.noCalibration)
  }
  const zones = paceZones(vdot)
  const macro = planMacrocycle({ today, goal, athlete })
  let previousFrequency: number | undefined
  const weeks = macro.weeks.map((skeleton) => {
    if (skeleton.keepFrequency && previousFrequency !== undefined) skeleton.sessionCount = previousFrequency
    const week = generateMicrocycle({ skeleton, athlete, zones, goal, testDistanceKm: testDistanceKm(goal) })
    if (!skeleton.keepFrequency) previousFrequency = week.days.filter(d => d.workout).length
    return week
  })
  if (config.strength?.enabled) applyStrength(weeks, config.strength)
  const plan: StoredPlan = {
    schemaVersion: PLAN_SCHEMA_VERSION,
    engineVersion: packageVersion(),
    calibration: inspectCalibration(athlete.results, calibrationDate, roadGoal),
    generatedAt: today,
    locale: getLocale(),
    vdot: Math.round(vdot * 10) / 10,
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
  // objętość świeżej generacji, zanim hak podmieni tygodnie i zanim zadziała budżet
  const generatedKm = new Map(plan.weeks.map((w) => [w.weekStart, w.totalKm]))
  opts.beforeTimeBudget?.(plan)
  if (config.time) {
    // Szczyt bez budżetu: sumy dni tygodni bieżącego cyklu, które budżet dostaje
    // (po skalowaniu w haku — redukcja nie jest „winą" budżetu). Tydzień przycięty
    // już wcześniej (zapisany plan w propozycji, przeszłość sprzed decyzji) liczy
    // się objętością świeżej generacji — inaczej rekalibracja zgubiłaby ostrzeżenie.
    // Suma dni, nie cel szkieletu: przy dwóch dniach biegowych cel bywa nieosiągalny.
    const macroPeak = Math.max(...cycleWeeksOf(plan).map((w) =>
      w.skeleton.timeCappedKm !== undefined ? generatedKm.get(w.weekStart) ?? w.totalKm : w.totalKm))
    const budget = fitTimeBudget(plan.weeks, config, zones, testDistanceKm(goal), opts.budgetStrength ?? 'reapply', opts.budgetFrom)
    plan.feasibilityWarnings.push(...budget.warnings)
    plan.peakKmPlanned = Math.max(...cycleWeeksOf(plan).map((w) => w.totalKm))
    // Ostrzeżenie, gdy budżet wyraźnie (ponad tolerancję P-3, 0,5 km) obniża szczyt
    // poniżej rekomendacji — z szczytem bez budżetu, bo ten bywa niższy niż
    // rekomendacja (baza biegacza, mało dni) i „więcej minut" da tylko tyle.
    if (budget.capped && plan.peakKmPlanned < plan.peakKmRecommended && plan.peakKmPlanned + 0.5 < macroPeak) {
      plan.feasibilityWarnings.push(ui().planMd.timeCapsVolume(plan.peakKmPlanned, macroPeak, plan.peakKmRecommended))
    }
  }
  plan.generatedDays = Object.fromEntries(plan.weeks.flatMap((w) => w.days).map((d) => [d.date, dayFingerprint(d)]))
  return plan
}

/**
 * Skalowanie objętości do zatwierdzonej bazy — jedna arytmetyka dla propozycji
 * (`adapt --prepare`, ADR-029) i regeneracji z zapisaną bazą (ADR-033), żeby
 * `plan` tuż po `adapt --apply` odtwarzał zatwierdzone dni. Kotwica to pełny
 * tydzień budowania (bez odpoczynkowych, taperu, startu i bloku po starcie):
 * pierwszy po dacie decyzji, a gdy takiego nie ma (decyzja w taperze) — ostatni
 * przed nią. Tygodnie od poniedziałku decyzji skalowane proporcjonalnie od zamiaru
 * makrocyklu (budżet czasu stosuje potem computePlan, raz, od tego samego
 * poniedziałku — `budgetFrom`); wcześniejsze przechodzą z `reference`. Siła to
 * osobny tor: korekta objętości jej nie przestawia — też przychodzi z `reference`.
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
  // Kotwica to pełny tydzień budowania: nie odpoczynkowy, nie taper, start ani blok
  // po starcie (połowa objętości) — inaczej „redukcja" podniosłaby resztę planu.
  // Decyzja w taperze: ostatni taki tydzień przed nią.
  const normal = (w: Microcycle) => !w.skeleton.deload && !['taper', 'race', 'transition'].includes(w.skeleton.phase)
  const anchor =
    weeks.find((w) => w.weekStart > opts.decidedOn && normal(w)) ??
    [...weeks].reverse().find((w) => w.weekStart <= opts.decidedOn && normal(w)) ??
    weeks.find((w) => w.days.some((d) => d.date > opts.decidedOn))
  const from = mondayOf(opts.decidedOn)
  const strengthDays = new Map(opts.reference.flatMap((w) => w.days).map((d) => [d.date, d.strength]))
  const referenceWeeks = new Map(opts.reference.map((w) => [w.weekStart, w]))
  return weeks.map((week) => {
    // tygodnie przed decyzją to przeszłość, której decyzja nie dotyczy — takie, jak
    // w planie bez bazy (kopia: computePlan zmienia tygodnie w miejscu, a to mogą
    // być tygodnie zapisanego planu)
    if (week.weekStart < from) return structuredClone(referenceWeeks.get(week.weekStart) ?? week)
    const skeleton = structuredClone(week.skeleton)
    delete skeleton.timeCappedKm
    skeleton.targetKm = Math.round((opts.baselineKm * skeleton.targetKm) / Math.max(1, anchor?.skeleton.targetKm ?? skeleton.targetKm))
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
function fitTimeBudget(weeks: Microcycle[], config: TrainctlConfig, zones: ReturnType<typeof paceZones>, testKm: number, strength: 'reapply' | 'keep', from?: string): { warnings: string[]; capped: boolean } {
  const ready = (week: Microcycle) => from !== undefined && week.weekStart < from
  const time = config.time!
  const minutesOf = (d: PlannedDay) =>
    (d.workout ? estimateWorkoutMinutes(d.workout, PREPARATION_MINUTES) : 0) + (d.strength?.durationMin ?? 0)
  const runMinutes = (w: Microcycle) => w.days.reduce((s, d) => s + (d.workout ? estimateWorkoutMinutes(d.workout, PREPARATION_MINUTES) : 0), 0)
  const weekMinutes = (w: Microcycle) => w.days.reduce((s, d) => s + (d.workout || d.strength ? minutesOf(d) : 0), 0)
  const easyMinPerKm = zones.easy.hiSecPerKm / 60
  let capped = false
  if (time.weeklyMinutes) {
    for (let i = 0; i < weeks.length; i++) {
      if (ready(weeks[i]!)) continue
      // Siła wraca dopiero po pętli (applyStrength) — jej minuty liczymy z tygodnia
      // przed regeneracją, inaczej kolejny przebieg uznałby tydzień za zmieszczony.
      const strengthMinutes = weeks[i]!.days.reduce((s, d) => s + (d.strength?.durationMin ?? 0), 0)
      // Cel podawany generatorowi maleje z przebiegu na przebieg i nie przekracza
      // tego, co generator faktycznie rozpisał: rozpisana objętość bywa wyższa od celu
      // (minima jednostek), a cel szkieletu — nieosiągalny (mało dni, limit długiego).
      // Redukcja liczona od którejś z nich mogłaby tydzień podnieść albo nie zejść
      // pod budżet w czterech przebiegach.
      let requested = weeks[i]!.skeleton.targetKm
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
        regenerated.skeleton = { ...week.skeleton, timeCappedKm: roundKm(regenerated.totalKm) }
        for (const day of regenerated.days) {
          const session = week.days.find((d) => d.date === day.date)?.strength
          if (session) day.strength = structuredClone(session)
        }
        // notatki siły tygodnia (PLAN.md) idą razem z sesjami — przy 'reapply' i tak
        // ustawi je od nowa applyStrength, przy 'keep' nie ma kto
        if (week.strengthNotes?.length) regenerated.strengthNotes = [...week.strengthNotes]
        weeks[i] = regenerated
        capped = true
      }
    }
    // świeży plan: siła rozstawiona od nowa pod nowe dni biegowe; plan z historią
    // (propozycja) — siła zostaje, korekta objętości jej nie przestawia
    if (capped && strength === 'reapply' && config.strength?.enabled) applyStrength(weeks, config.strength)
  }
  const tooLong: string[] = []
  for (const week of weeks) {
    if (ready(week)) continue
    let shortened = false
    for (const day of week.days) {
      const cap = isWeekend(day.weekday) ? time.weekendMinutes : time.weekdayMinutes
      if (cap === undefined || !day.workout || minutesOf(day) <= cap) continue
      if (['race', 'test'].includes(day.workout.kind)) {
        tooLong.push(day.date)
        continue
      }
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
      } else {
        tooLong.push(day.date)
      }
    }
    Object.assign(week, weekTotals(week.days))
    // Skrócone dni obniżają objętość tygodnia — zapisujemy ją obok zamiaru (targetKm),
    // inaczej lint zgłaszałby P-3 na świeżo wygenerowanym planie.
    if (shortened) {
      week.skeleton = { ...week.skeleton, timeCappedKm: roundKm(week.totalKm) }
      capped = true
    }
  }
  const overWeek = time.weeklyMinutes ? weeks.filter((w) => !w.skeleton.raceDate && weekMinutes(w) > time.weeklyMinutes!).map((w) => w.weekStart) : []
  return {
    capped,
    warnings: [
      ...(tooLong.length ? [ui().planMd.timeDayTooShort(tooLong.join(', '))] : []),
      ...(overWeek.length ? [ui().planMd.timeWeekOver(overWeek.join(', '))] : []),
    ],
  }
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
      `${week.totalKm} km`,
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
