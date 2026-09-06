/**
 * Solver renegocjacji tygodnia (FOUNDATIONS §10.7, filar 3 z SPEC).
 *
 * Wejście: tydzień + dni, w których nie da się trenować.
 * Wyjście: najlepszy możliwy układ + **jawna lista kompromisów** — co zostało
 * przesunięte i co poświęcono. Solver nigdy nie udaje, że da się wszystko
 * upchnąć: jeśli miejsc jest mniej niż jednostek, mówi którą odpuszcza i dlaczego.
 *
 * Ograniczenia twarde (nie do złamania):
 *  - dzień startu stoi w miejscu, dzień przed startem zostaje lekki,
 *  - w dniu zablokowanym nie ma treningu.
 * Ograniczenia miękkie (funkcja celu, każde z uzasadnieniem):
 *  S-1 ≥48 h między akcentami · S-2 chroń długie · S-3 zachowaj liczbę akcentów
 *  S-9 różnicuj obciążenie · house style: preferowane dni akcentów i długiego.
 */
import type { Microcycle, PlannedDay, PlannedWorkout, Weekday, WorkoutKind } from '../domain/types.ts'
import { messages } from '../i18n/index.ts'
import { diffDays } from '../util/dates.ts'
import { estimateWorkoutMinutes } from '../engine/duration.ts'

const QUALITY: ReadonlySet<WorkoutKind> = new Set([
  'quality_intervals',
  'quality_continuous',
  'sharpener',
  'test', // sprawdzian jest wysiłkiem maksymalnym — obowiązuje go S-1 jak akcent
])

/**
 * Kolejność poświęcania, gdy brakuje miejsc — od najmniej kosztownej straty.
 * Sprawdzian tuż przy długim: odpuszczony test to nie jeden trening mniej,
 * tylko brak kalibracji stref na kolejne tygodnie (W-11).
 */
const DROP_ORDER: WorkoutKind[] = [
  'easy',
  'easy_hills',
  'sharpener',
  'quality_continuous',
  'quality_intervals',
  'test',
  'long',
]

export interface RescheduleRequest {
  timeBudgets?: Record<string, number>
  preparationMinutes?: number
  pinnedDates?: string[]
  /** Already completed/past days: fixed for this solve, without storing a pin. */
  fixedDates?: string[]
  strategy?: 'long' | 'quality'
  week: Microcycle
  /** Daty, w których użytkownik nie może trenować (np. „w czwartek release"). */
  blockedDates: string[]
  /** Dni tygodnia dostępne z profilu — puste = bez ograniczeń. */
  availableDays?: Weekday[]
  /** Preferowane dni akcentów i długiego (house style). */
  qualityDayPreference?: Weekday[]
  longRunDayPreference?: Weekday[]
}

export interface RescheduleResult {
  /** Nowy układ tygodnia — te same jednostki, inne dni. */
  days: PlannedDay[]
  moved: { kind: WorkoutKind; from: string; to: string }[]
  dropped: { kind: WorkoutKind; from: string; reason: string }[]
  tradeoffs: string[]
  warnings: string[]
  score: number
  /** Czy cokolwiek się zmieniło względem wejścia. */
  changed: boolean
}

interface Slot {
  date: string
  weekday: Weekday
  index: number
}

interface Item {
  workout: PlannedWorkout
  timeAdjustment?: PlannedDay['timeAdjustment']
  originalDate: string
}

const WEEKDAY_ORDER: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

function scoreArrangement(
  assignment: (Item | undefined)[],
  slots: Slot[],
  req: RescheduleRequest,
  fixed: { date: string; workout: PlannedWorkout }[],
): { score: number; notes: string[] } {
  const notes: string[] = []
  let score = 0

  const placed = assignment
    .map((item, i) => (item ? { item, slot: slots[i]! } : undefined))
    .filter((x): x is { item: Item; slot: Slot } => x !== undefined)

  const qualityDates = [
    ...placed.filter((p) => QUALITY.has(p.item.workout.kind)).map((p) => p.slot.date),
    ...fixed.filter((f) => QUALITY.has(f.workout.kind)).map((f) => f.date),
  ].sort()

  // S-1: ≥48 h między akcentami — twardy priorytet w funkcji celu
  for (let i = 1; i < qualityDates.length; i++) {
    const gap = diffDays(qualityDates[i - 1]!, qualityDates[i]!)
    if (gap < 2) {
      score -= 1000
      notes.push(`akcenty ${qualityDates[i - 1]} i ${qualityDates[i]} bez 48 h przerwy (S-1)`)
    }
  }

  for (const { item, slot } of placed) {
    const kind = item.workout.kind

    // S-2: długie wybieganie na preferowanym dniu (weekend)
    if (kind === 'long') {
      score += 200
      if (req.longRunDayPreference?.includes(slot.weekday)) {
        score += 60
      } else {
        // dzień tygodnia przez katalog: surowy klucz („wed") w polskim zdaniu
        // czytał się jak przeoczenie tłumaczenia — bo nim był
        notes.push(messages().solver.longRunOffPreferredDay(messages().weekday[slot.weekday]))
      }
    }
    // S-3: akcenty się liczą; sprawdzian wyżej — bez niego nie ma czym kalibrować stref
    if (QUALITY.has(kind)) {
      score += kind === 'test' ? 220 : 150
      if (req.strategy === 'quality') score += 200
      if (req.qualityDayPreference?.includes(slot.weekday)) score += 30
    }
    if (kind === 'easy' || kind === 'easy_hills') score += 40

    // Zostawanie na miejscu waży więcej niż preferencje dni: to renegocjacja,
    // nie reoptymalizacja. Bez tego solver tasowałby poprawny plan przy każdym
    // uruchomieniu, goniąc za drobnymi punktami za „ładniejszy" układ.
    // Waga niższa niż kara za złamanie S-1 — realny konflikt nadal wygrywa.
    if (slot.date === item.originalDate) score += 120
  }

  // Nie ma tu kary za długie obok akcentu — patrz `tools/corpus/long_run_profile.py`
  // i FOUNDATIONS S-9a. Wcześniej solver odejmował 60 punktów, powołując się na
  // S-9, ale S-9 mówi o RÓŻNICOWANIU obciążenia dziennego, nie o sąsiedztwie.
  // Nasze długie jest zawsze spokojne, więc para akcent → długie to właśnie
  // różnicowanie, nie dwa ciężkie dni. Korpus: ze 73 długich, dla których znamy
  // dzień poprzedni, 52 wypadają nazajutrz po akcencie i 16 po starcie (93%),
  // a 73% z nich jest czysto spokojne. Kara odpychała plan od wzorca trenera
  // przy każdej renegocjacji — i przeczyła własnemu T-11 („długie ZOSTAJE
  // dzień po starcie"), który ten sam układ uznaje za poprawny.

  return { score, notes }
}

/** Przeszukanie z nawrotami — tydzień ma ≤7 slotów, więc pełny przegląd jest tani. */
function search(
  items: Item[],
  slots: Slot[],
  req: RescheduleRequest,
  fixed: { date: string; workout: PlannedWorkout }[],
): { assignment: (Item | undefined)[]; score: number; notes: string[] } | undefined {
  let best: { assignment: (Item | undefined)[]; score: number; notes: string[] } | undefined
  const assignment: (Item | undefined)[] = new Array(slots.length).fill(undefined)

  const place = (itemIndex: number): void => {
    if (itemIndex === items.length) {
      const { score, notes } = scoreArrangement(assignment, slots, req, fixed)
      if (!best || score > best.score) {
        best = { assignment: [...assignment], score, notes }
      }
      return
    }
    for (let s = 0; s < slots.length; s++) {
      if (assignment[s]) continue
      const slot = slots[s]!
      const budget = req.timeBudgets?.[slot.date]
      const strength = req.week.days.find((d) => d.date === slot.date)?.strength?.durationMin ?? 0
      if (budget !== undefined && estimateWorkoutMinutes(items[itemIndex]!.workout, req.preparationMinutes ?? 15) + strength > budget) continue
      assignment[s] = items[itemIndex]
      place(itemIndex + 1)
      assignment[s] = undefined
    }
  }
  place(0)
  return best
}

export function reschedule(req: RescheduleRequest): RescheduleResult {
  const { week } = req
  const blocked = new Set(req.blockedDates)
  const pinned = new Set([...(req.pinnedDates ?? []), ...(req.fixedDates ?? []), ...week.days.filter((d) => d.pinned).map((d) => d.date)])
  if (!Number.isInteger(req.preparationMinutes ?? 15) || (req.preparationMinutes ?? 15) < 0 || (req.preparationMinutes ?? 15) > 120) throw new Error(messages().solver.badConstraints)
  for (const [date, minutes] of Object.entries(req.timeBudgets ?? {})) {
    if (!week.days.some((d) => d.date === date) || !Number.isInteger(minutes) || minutes < 0 || minutes > 1440) throw new Error(messages().solver.badConstraints)
  }
  for (const date of pinned) {
    const day = week.days.find((d) => d.date === date)
    if (!day || (blocked.has(date) && (day.workout || day.strength))) throw new Error(messages().solver.pinnedConflict(date))
    const budget = req.timeBudgets?.[date]
    const needed = (day.workout ? estimateWorkoutMinutes(day.workout, req.preparationMinutes ?? 15) : 0) + (day.strength?.durationMin ?? 0)
    if (budget !== undefined && needed > budget) throw new Error(messages().solver.pinnedConflict(date))
  }
  const raceDay = week.days.find((d) => d.workout?.kind === 'race')
  const dayBeforeRace = raceDay ? week.days.find((d) => diffDays(d.date, raceDay.date) === 1) : undefined

  const warnings: string[] = []
  for (const date of req.blockedDates) {
    if (!week.days.some((d) => d.date === date)) {
      warnings.push(messages().solver.dateOutsideWeek(date))
    }
  }
  if (raceDay && blocked.has(raceDay.date)) {
    warnings.push(messages().solver.cannotBlockRaceDay)
    blocked.delete(raceDay.date)
  }

  // jednostki do rozstawienia (bez startu) i wolne sloty
  const items: Item[] = week.days
    .filter((d) => d.workout && d.workout.kind !== 'race' && !pinned.has(d.date))
    .map((d) => ({ workout: d.workout!, originalDate: d.date, ...(d.timeAdjustment ? { timeAdjustment: d.timeAdjustment } : {}) }))

  const slots: Slot[] = week.days
    .filter((d) => {
      if (blocked.has(d.date)) return false
      if (pinned.has(d.date)) return false
      if (raceDay && d.date === raceDay.date) return false
      if (dayBeforeRace && d.date === dayBeforeRace.date) return false // dzień przed startem lekki
      if (req.availableDays?.length && !req.availableDays.includes(d.weekday)) return false
      return true
    })
    .map((d, i) => ({ date: d.date, weekday: d.weekday, index: i }))

  const fixed = week.days.filter((d) => d.workout && (d.workout.kind === 'race' || pinned.has(d.date))).map((d) => ({ date: d.date, workout: d.workout! }))

  // brak miejsc dla wszystkich — poświęcamy wg ustalonej kolejności
  const dropped: RescheduleResult['dropped'] = []
  const keep = [...items]
  while (keep.length > slots.length) {
    let victimIndex = -1
    for (const kind of DROP_ORDER) {
      victimIndex = keep.findIndex((i) => i.workout.kind === kind)
      if (victimIndex !== -1) break
    }
    if (victimIndex === -1) victimIndex = keep.length - 1
    const victim = keep.splice(victimIndex, 1)[0]!
    dropped.push({
      kind: victim.workout.kind,
      from: victim.originalDate,
      reason:
        victim.workout.kind === 'easy' || victim.workout.kind === 'easy_hills'
          ? messages().solver.droppedEasy
          : messages().solver.droppedOther,
    })
  }

  let best = search(keep, slots, req, fixed)
  if (req.timeBudgets || req.strategy === 'quality') {
    // At most seven sessions: enumerate subsets to avoid dropping easy runs
    // merely because a long run cannot fit in any time window.
    best = undefined
    let chosen: Item[] = []
    for (let mask = 0; mask < 2 ** items.length; mask++) {
      const subset = items.filter((_, i) => (mask & (1 << i)) !== 0)
      if (subset.length > slots.length || subset.length < chosen.length) continue
      const candidate = search(subset, slots, req, fixed)
      if (candidate && (!best || subset.length > chosen.length || candidate.score > best.score)) {
        best = candidate
        chosen = subset
      }
    }
    dropped.splice(0)
    for (const item of items.filter((item) => !chosen.includes(item))) {
      dropped.push({ kind: item.workout.kind, from: item.originalDate, reason: messages().solver.noTime })
    }
  }
  const days: PlannedDay[] = week.days.map((d) => {
    const base: PlannedDay = { date: d.date, weekday: d.weekday }
    if (((raceDay && d.date === raceDay.date) || pinned.has(d.date)) && d.workout) base.workout = d.workout
    if (base.workout && d.timeAdjustment) base.timeAdjustment = d.timeAdjustment
    if (d.pinned || req.pinnedDates?.includes(d.date)) base.pinned = true
    // Siła nie bierze udziału w tasowaniu (to nie jest jednostka biegowa), ale
    // MUSI przetrwać: solver buduje dni od zera, więc bez tego wiersza
    // `reschedule --apply` po cichu kasowałby sesje siłowe z całego tygodnia.
    // Walidacja nowego sąsiedztwa (S-5) należy do warstwy, która zna konfigurację.
    if (d.strength && !blocked.has(d.date)) base.strength = d.strength
    return base
  })
  const moved: RescheduleResult['moved'] = []
  if (best) {
    best.assignment.forEach((item, i) => {
      if (!item) return
      const slot = slots[i]!
      const target = days.find((d) => d.date === slot.date)!
      target.workout = item.workout
      if (item.timeAdjustment) target.timeAdjustment = item.timeAdjustment
      if (slot.date !== item.originalDate) {
        moved.push({ kind: item.workout.kind, from: item.originalDate, to: slot.date })
      }
    })
  }

  const tradeoffs: string[] = week.days.filter(d => d.strength && blocked.has(d.date)).map(d => messages().solver.blockedStrength(d.date))
  for (const m of moved) tradeoffs.push(`${m.kind}: ${m.from} → ${m.to}`)
  for (const d of dropped) tradeoffs.push(messages().solver.droppedLine(d.kind, d.from, d.reason))
  for (const note of best?.notes ?? []) tradeoffs.push(messages().solver.tradeoffLine(note))
  if (dropped.length) {
    warnings.push(
      messages().solver.noMakeUp,
    )
  }

  return {
    days,
    moved,
    dropped,
    tradeoffs,
    warnings,
    score: best?.score ?? 0,
    changed: moved.length > 0 || dropped.length > 0 || days.some((d, i) => d.pinned !== week.days[i]?.pinned || !!d.strength !== !!week.days[i]?.strength),
  }
}

export { WEEKDAY_ORDER as SOLVER_WEEKDAY_ORDER }
