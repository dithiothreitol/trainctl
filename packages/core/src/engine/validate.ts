/**
 * Lint planu (faza `trainctl check`): plik plan/plan.yaml jest edytowalny ręcznie
 * (plan-as-code), więc inwarianty, które generator gwarantuje w chwili zapisu,
 * mogą zostać złamane później — przez edycję, ręczny merge albo błąd narzędzia.
 *
 * Dwie klasy ustaleń, celowo rozdzielone:
 *  - `error` — plik jest wewnętrznie niespójny (sumy, daty, brak dnia startu):
 *    stan, którego nie wytwarza żadna ścieżka narzędzia;
 *  - `warn`  — plan łamie regułę metodyczną (I-5, I-7, T-4, T-10, S-5, F-13):
 *    stan osiągalny świadomą decyzją (np. `shift` ostrzega i pozwala),
 *    więc nie blokuje, dopóki użytkownik nie poprosi o tryb ścisły.
 *
 * Walidator NIE implementuje reguł po raz drugi — sprawdza stany końcowe,
 * które generator (macrocycle/microcycle/strength) i solver już definiują,
 * i cytuje te same ID z docs/science/FOUNDATIONS.md §10.
 */
import type { Microcycle, RaceGoal, PlannedWorkout, Weekday, WorkoutKind } from '../domain/types.ts'
import { COACH_STYLE, type HouseStyle } from './house-style.ts'
import { weekTotals } from './microcycle.ts'
import { addDays, diffDays, mondayOf } from '../util/dates.ts'

const WEEKDAY_ORDER: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** Akcenty w rozumieniu I-7: start i sprawdzian też (T-12 — „start JEST akcentem"). */
const ACCENT_KINDS: ReadonlySet<WorkoutKind> = new Set([
  'quality_intervals',
  'quality_continuous',
  'sharpener',
  'test',
  'race',
])

/** Jednostki, których siła nie może poprzedzać ani im towarzyszyć (S-5, jak w engine/strength.ts). */
const STRENGTH_SENSITIVE: ReadonlySet<WorkoutKind> = new Set([
  'quality_intervals',
  'quality_continuous',
  'test',
  'race',
])

/** Typy segmentów liczone jako Z1 — dokładnie ta sama definicja, co w generatorze (I-5). */
const Z1_SEGMENT_TYPES = new Set(['easy', 'warmup', 'cooldown'])

export type PlanIssueCode =
  // integralność pliku (error)
  | 'weeksMissing'
  | 'goalMissing'
  | 'malformed'
  | 'weekLength'
  | 'weekStartNotMonday'
  | 'weeksNotContiguous'
  | 'dayOutOfPlace'
  | 'weekdayMismatch'
  | 'totalKmDesync'
  | 'easyShareDesync'
  | 'workoutKmDesync'
  | 'raceDayMissing'
  // odstępstwa metodyczne (warn)
  | 'accentGap'
  | 'workoutBeforeRace'
  | 'longInTaper'
  | 'hillsInTaper'
  | 'strengthInTaper'
  | 'strengthOnQualityDay'
  | 'strengthDayBeforeQuality'
  | 'strengthOnLongDay'
  | 'strengthGap'
  | 'easyShareLow'
  | 'longOverCap'
  | 'qualityWithoutFrame'
  | 'taperNotMonotonic'

export interface PlanIssue {
  code: PlanIssueCode
  severity: 'error' | 'warn'
  /** ID reguł z FOUNDATIONS §10; puste = integralność pliku albo house style bez ID. */
  ruleRefs: string[]
  /** Dzień, którego dotyczy problem (dla spraw tygodniowych: poniedziałek tygodnia). */
  date: string
  /** Drugi dzień pary — odstępy i sąsiedztwa. */
  otherDate?: string
  /** Rodzaj jednostki (albo zapisany weekday przy `weekdayMismatch`). */
  kind?: string
  otherKind?: string
  /** Kontrole liczbowe: wartość oczekiwana i zastana w pliku. */
  expected?: number
  actual?: number
}

export interface ValidatePlanInput {
  /**
   * Wejście pochodzi z pliku edytowanego ręcznie, więc pola mogą nie istnieć
   * albo mieć zły typ. Kontrola kształtu należy do walidatora — `check` ma o
   * połamanym pliku ZGŁOSIĆ ustalenie, a nie wywrócić się na nim.
   */
  weeks: Microcycle[] | undefined
  goal: RaceGoal | undefined
  style?: HouseStyle
}

const isIso = (value: unknown): value is string => typeof value === 'string' && ISO_DATE.test(value)

/** Suma kilometrów segmentów głównych (nie-Z1) jednostki — do progu tłumienia I-5. */
function mainSegmentsKm(workout: PlannedWorkout): number {
  return workout.segments
    .filter((s) => !Z1_SEGMENT_TYPES.has(s.type))
    .reduce((sum, s) => sum + (s.distanceKm ?? 0), 0)
}

export function validatePlan(input: ValidatePlanInput): PlanIssue[] {
  const style = input.style ?? COACH_STYLE
  const issues: PlanIssue[] = []
  const error = (issue: Omit<PlanIssue, 'severity'>) => issues.push({ ...issue, severity: 'error' })
  const warn = (issue: Omit<PlanIssue, 'severity'>) => issues.push({ ...issue, severity: 'warn' })

  // --- 0. kształt dokumentu: pusty albo obcięty plan.yaml (niedokończona edycja,
  // zły `git show`) nie ma listy tygodni ani celu. To ustalenie lintu, nie wyjątek.
  const goalDate = input.goal && isIso(input.goal.date) ? input.goal.date : undefined
  if (!goalDate) error({ code: 'goalMissing', ruleRefs: [], date: '' })
  if (!Array.isArray(input.weeks)) {
    error({ code: 'weeksMissing', ruleRefs: [], date: '' })
    return issues
  }

  // Tygodnie bez weekStart/days wypadają z dalszych kontroli zamiast je wywracać.
  const weeks: Microcycle[] = []
  for (const [wi, week] of input.weeks.entries()) {
    if (!week || !isIso(week.weekStart) || !Array.isArray(week.days)) {
      error({ code: 'malformed', ruleRefs: [], date: `#${wi + 1}`, kind: 'week' })
      continue
    }
    weeks.push(week)
  }

  // --- 1. struktura kalendarza: 7 dni, poniedziałkowy weekStart, ciągłość
  for (const [wi, week] of weeks.entries()) {
    if (mondayOf(week.weekStart) !== week.weekStart) {
      error({ code: 'weekStartNotMonday', ruleRefs: [], date: week.weekStart })
    }
    const prev = weeks[wi - 1]
    if (prev && diffDays(prev.weekStart, week.weekStart) !== 7) {
      error({ code: 'weeksNotContiguous', ruleRefs: [], date: week.weekStart, otherDate: prev.weekStart })
    }
    if (week.days.length !== 7) {
      error({ code: 'weekLength', ruleRefs: [], date: week.weekStart, expected: 7, actual: week.days.length })
    }
    for (const [di, day] of week.days.entries()) {
      if (!day || !isIso(day.date)) {
        error({ code: 'malformed', ruleRefs: [], date: `${week.weekStart} #${di + 1}`, kind: 'day' })
        continue
      }
      const shouldBe = addDays(week.weekStart, di)
      if (week.days.length === 7 && day.date !== shouldBe) {
        error({ code: 'dayOutOfPlace', ruleRefs: [], date: day.date, otherDate: shouldBe })
      }
      const realWeekday = WEEKDAY_ORDER[diffDays(mondayOf(day.date), day.date)]
      if (realWeekday && day.weekday !== realWeekday) {
        error({ code: 'weekdayMismatch', ruleRefs: [], date: day.date, kind: day.weekday, otherKind: realWeekday })
      }
    }
  }

  // od tego miejsca dni bez poprawnej daty nie uczestniczą w kontrolach
  const cleanWeeks = weeks.map((week) => ({
    week,
    days: week.days.filter((d) => d && isIso(d.date)),
  }))

  // --- 2. spójność sum: totalKm i easyShare w pliku vs przeliczone z dni (jak generator)
  const recomputed = new Map<string, { totalKm: number; easyShare: number }>()
  for (const { week, days } of cleanWeeks) {
    const totals = weekTotals(days)
    recomputed.set(week.weekStart, totals)
    if (typeof week.totalKm === 'number' && Math.abs(totals.totalKm - week.totalKm) > 0.5) {
      error({
        code: 'totalKmDesync', ruleRefs: [], date: week.weekStart,
        expected: totals.totalKm, actual: week.totalKm,
      })
    }
    if (typeof week.easyShare === 'number' && Math.abs(totals.easyShare - week.easyShare) > 0.02) {
      error({
        code: 'easyShareDesync', ruleRefs: [], date: week.weekStart,
        expected: Math.round(totals.easyShare * 100) / 100, actual: Math.round(week.easyShare * 100) / 100,
      })
    }

    // --- 3. spójność jednostek: distanceKm vs suma segmentów (tolerancja 1 km —
    // generator zaokrągla całość np. dnia z podbiegami)
    for (const day of days) {
      const w = day.workout
      if (!w || !Array.isArray(w.segments)) continue
      const sum = w.segments.reduce((a, s) => a + (s.distanceKm ?? 0), 0)
      if (Math.abs(sum - w.distanceKm) > 1) {
        error({
          code: 'workoutKmDesync', ruleRefs: [], date: day.date, kind: w.kind,
          expected: Math.round(sum * 10) / 10, actual: w.distanceKm,
        })
      }
    }
  }

  const allDays = cleanWeeks
    .flatMap(({ days }) => days)
    .sort((a, b) => a.date.localeCompare(b.date))
  const dayByDate = new Map(allDays.map((d) => [d.date, d]))

  // --- 4. dzień startu docelowego istnieje i jest startem (tylko gdy cel ma datę)
  if (goalDate) {
    const raceDay = allDays.find((d) => d.date === goalDate && d.workout?.kind === 'race')
    if (!raceDay) {
      error({ code: 'raceDayMissing', ruleRefs: [], date: goalDate })
    }
  }

  // --- 5. I-7: ≥48 h między akcentami — w całym planie, także na styku tygodni
  const accents = allDays.filter((d) => d.workout && ACCENT_KINDS.has(d.workout.kind))
  for (let i = 1; i < accents.length; i++) {
    const prev = accents[i - 1]!
    const cur = accents[i]!
    const gap = diffDays(prev.date, cur.date)
    if (gap > 0 && gap < 2) {
      warn({
        code: 'accentGap', ruleRefs: ['I-7'], date: prev.date, otherDate: cur.date,
        kind: prev.workout!.kind, otherKind: cur.workout!.kind,
      })
    }
  }

  // --- 6. T-10: dzień przed startem/sprawdzianem wolny (korpus: 76%).
  // Akcent dzień przed startem zgłasza już kontrola I-7 — tu tylko pozostałe jednostki.
  for (const day of allDays) {
    const kind = day.workout?.kind
    if (kind !== 'race' && kind !== 'test') continue
    const before = dayByDate.get(addDays(day.date, -1))
    if (before?.workout && !ACCENT_KINDS.has(before.workout.kind)) {
      warn({
        code: 'workoutBeforeRace', ruleRefs: ['T-10'], date: before.date, otherDate: day.date,
        kind: before.workout.kind,
      })
    }
  }

  // --- 7. kształt taperu: bez długiego (T-5), bez podbiegów (house style),
  // bez siły (F-13 — także w tygodniu startowym)
  for (const { week, days } of cleanWeeks) {
    const phase = week.skeleton?.phase
    if (phase !== 'taper' && phase !== 'race') continue
    for (const day of days) {
      if (day.workout?.kind === 'long') {
        warn({ code: 'longInTaper', ruleRefs: ['T-5'], date: day.date })
      }
      if (day.workout?.kind === 'easy_hills') {
        warn({ code: 'hillsInTaper', ruleRefs: [], date: day.date })
      }
      if (day.strength) {
        warn({ code: 'strengthInTaper', ruleRefs: ['F-13'], date: day.date })
      }
    }
  }

  // --- 8. T-4: taper spada monotonicznie (tydzień startowy ma stały, krótki
  // układ 2–3 sesji — nie podlega tej kontroli)
  for (const [wi, { week }] of cleanWeeks.entries()) {
    if (week.skeleton?.phase !== 'taper') continue
    const prev = cleanWeeks[wi - 1]?.week
    if (!prev) continue
    const cur = recomputed.get(week.weekStart)!
    const before = recomputed.get(prev.weekStart)
    if (before && cur.totalKm > before.totalKm + 0.5) {
      warn({
        code: 'taperNotMonotonic', ruleRefs: ['T-4'], date: week.weekStart,
        expected: before.totalKm, actual: cur.totalKm,
      })
    }
  }

  // --- 9. S-5: siła nie w dniu jakości/startu, nie dzień przed nimi,
  // nie w dniu długiego/podbiegów, ≥48 h między sesjami siły
  const strengthDays = allDays.filter((d) => d.strength)
  for (const day of strengthDays) {
    const kind = day.workout?.kind
    if (kind && STRENGTH_SENSITIVE.has(kind)) {
      warn({ code: 'strengthOnQualityDay', ruleRefs: ['S-5'], date: day.date, kind })
    } else if (kind === 'long' || kind === 'easy_hills') {
      warn({ code: 'strengthOnLongDay', ruleRefs: [], date: day.date, kind })
    }
    const next = dayByDate.get(addDays(day.date, 1))
    const nextKind = next?.workout?.kind
    if (next && nextKind && STRENGTH_SENSITIVE.has(nextKind)) {
      warn({
        code: 'strengthDayBeforeQuality', ruleRefs: ['S-5'], date: day.date,
        otherDate: next.date, otherKind: nextKind,
      })
    }
  }
  for (let i = 1; i < strengthDays.length; i++) {
    const gap = diffDays(strengthDays[i - 1]!.date, strengthDays[i]!.date)
    if (gap > 0 && gap < 2) {
      warn({
        code: 'strengthGap', ruleRefs: ['S-5'], date: strengthDays[i - 1]!.date,
        otherDate: strengthDays[i]!.date,
      })
    }
  }

  // --- 10. I-5: ≥75% objętości w Z1. Generator przy niskiej objętości sam
  // akceptuje niedobór, gdy część główna akcentu osiągnie podłogę (~4 km po
  // zaokrągleniach powtórzeń) — te tygodnie tłumimy, żeby świeży plan nie
  // ostrzegał sam na siebie. Zgłaszamy tylko, gdy akcent dałoby się jeszcze skrócić.
  for (const { week, days } of cleanWeeks) {
    const totals = recomputed.get(week.weekStart)!
    if (totals.totalKm === 0 || totals.easyShare >= 0.75) continue
    const shrinkable = days.some(
      (d) =>
        d.workout &&
        (d.workout.kind === 'quality_intervals' || d.workout.kind === 'quality_continuous') &&
        mainSegmentsKm(d.workout) > 4.5,
    )
    if (shrinkable) {
      warn({
        code: 'easyShareLow', ruleRefs: ['I-5'], date: week.weekStart,
        expected: 0.75, actual: Math.round(totals.easyShare * 100) / 100,
      })
    }
  }

  // --- 11. sufit długiego z house style (Fokkema 2020, kontekst P-8)
  for (const day of allDays) {
    if (day.workout?.kind === 'long' && day.workout.distanceKm > style.longRunCapKm + 0.5) {
      warn({
        code: 'longOverCap', ruleRefs: ['P-8'], date: day.date,
        expected: style.longRunCapKm, actual: day.workout.distanceKm,
      })
    }
  }

  // --- 12. rama akcentu z korpusu: rozgrzewka (86,8%) i trucht na koniec (89,0%)
  for (const day of allDays) {
    const w = day.workout
    if (!w || !Array.isArray(w.segments)) continue
    if (w.kind !== 'quality_intervals' && w.kind !== 'quality_continuous' && w.kind !== 'test') continue
    const hasWarmup = w.segments.some((s) => s.type === 'warmup')
    const hasCooldown = w.segments.some((s) => s.type === 'cooldown')
    if (!hasWarmup || !hasCooldown) {
      warn({ code: 'qualityWithoutFrame', ruleRefs: [], date: day.date, kind: w.kind })
    }
  }

  // błędy przed ostrzeżeniami, wewnątrz grup chronologicznie
  const rank = (i: PlanIssue) => (i.severity === 'error' ? 0 : 1)
  return issues.sort((a, b) => rank(a) - rank(b) || a.date.localeCompare(b.date))
}
