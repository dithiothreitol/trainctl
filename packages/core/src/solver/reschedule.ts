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
import { diffDays } from '../util/dates.ts'

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
        notes.push(`długie wybieganie poza preferowanym dniem (${slot.weekday})`)
      }
    }
    // S-3: akcenty się liczą; sprawdzian wyżej — bez niego nie ma czym kalibrować stref
    if (QUALITY.has(kind)) {
      score += kind === 'test' ? 220 : 150
      if (req.qualityDayPreference?.includes(slot.weekday)) score += 30
    }
    if (kind === 'easy' || kind === 'easy_hills') score += 40

    // Zostawanie na miejscu waży więcej niż preferencje dni: to renegocjacja,
    // nie reoptymalizacja. Bez tego solver tasowałby poprawny plan przy każdym
    // uruchomieniu, goniąc za drobnymi punktami za „ładniejszy" układ.
    // Waga niższa niż kara za złamanie S-1 — realny konflikt nadal wygrywa.
    if (slot.date === item.originalDate) score += 120
  }

  // S-9: nie wrzucaj długiego tuż po akcencie (monotonia obciążenia)
  const longSlot = placed.find((p) => p.item.workout.kind === 'long')
  if (longSlot) {
    for (const date of qualityDates) {
      if (Math.abs(diffDays(date, longSlot.slot.date)) === 1) {
        score -= 60
        notes.push(`długie wybieganie sąsiaduje z akcentem ${date} — dwa ciężkie dni z rzędu (S-9)`)
      }
    }
  }

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
  const raceDay = week.days.find((d) => d.workout?.kind === 'race')
  const dayBeforeRace = raceDay ? week.days.find((d) => diffDays(d.date, raceDay.date) === 1) : undefined

  const warnings: string[] = []
  for (const date of req.blockedDates) {
    if (!week.days.some((d) => d.date === date)) {
      warnings.push(`data ${date} jest poza tym tygodniem — pominięta`)
    }
  }
  if (raceDay && blocked.has(raceDay.date)) {
    warnings.push('dnia startu nie da się zablokować — solver go nie rusza')
    blocked.delete(raceDay.date)
  }

  // jednostki do rozstawienia (bez startu) i wolne sloty
  const items: Item[] = week.days
    .filter((d) => d.workout && d.workout.kind !== 'race')
    .map((d) => ({ workout: d.workout!, originalDate: d.date }))

  const slots: Slot[] = week.days
    .filter((d) => {
      if (blocked.has(d.date)) return false
      if (raceDay && d.date === raceDay.date) return false
      if (dayBeforeRace && d.date === dayBeforeRace.date) return false // dzień przed startem lekki
      if (req.availableDays?.length && !req.availableDays.includes(d.weekday)) return false
      return true
    })
    .map((d, i) => ({ date: d.date, weekday: d.weekday, index: i }))

  const fixed = raceDay?.workout ? [{ date: raceDay.date, workout: raceDay.workout }] : []

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
          ? 'zabrakło dnia — spokojna jednostka kosztuje najmniej (objętość, nie bodziec)'
          : 'zabrakło dnia po zablokowaniu terminów',
    })
  }

  const best = search(keep, slots, req, fixed)
  const days: PlannedDay[] = week.days.map((d) => {
    const base: PlannedDay = { date: d.date, weekday: d.weekday }
    if (raceDay && d.date === raceDay.date && d.workout) base.workout = d.workout
    // Siła nie bierze udziału w tasowaniu (to nie jest jednostka biegowa), ale
    // MUSI przetrwać: solver buduje dni od zera, więc bez tego wiersza
    // `reschedule --apply` po cichu kasowałby sesje siłowe z całego tygodnia.
    // Walidacja nowego sąsiedztwa (S-5) należy do warstwy, która zna konfigurację.
    if (d.strength) base.strength = d.strength
    return base
  })
  const moved: RescheduleResult['moved'] = []
  if (best) {
    best.assignment.forEach((item, i) => {
      if (!item) return
      const slot = slots[i]!
      const target = days.find((d) => d.date === slot.date)!
      target.workout = item.workout
      if (slot.date !== item.originalDate) {
        moved.push({ kind: item.workout.kind, from: item.originalDate, to: slot.date })
      }
    })
  }

  const tradeoffs: string[] = []
  for (const m of moved) tradeoffs.push(`${m.kind}: ${m.from} → ${m.to}`)
  for (const d of dropped) tradeoffs.push(`odpuszczone: ${d.kind} z ${d.from} — ${d.reason}`)
  for (const note of best?.notes ?? []) tradeoffs.push(`kompromis: ${note}`)
  if (dropped.length) {
    warnings.push(
      'Nie nadrabiamy odpuszczonych kilometrów w kolejnych dniach — dokładanie objętości ' +
        'po wypadniętej sesji działa przeciw progresji (P-1/P-3).',
    )
  }

  return {
    days,
    moved,
    dropped,
    tradeoffs,
    warnings,
    score: best?.score ?? 0,
    changed: moved.length > 0 || dropped.length > 0,
  }
}

export { WEEKDAY_ORDER as SOLVER_WEEKDAY_ORDER }
