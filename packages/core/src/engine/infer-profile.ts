/**
 * Inferencja profilu atlety z historii aktywności (faza 6, ADR-019).
 * „Pokaż mi ostatnie 3 miesiące" — zamiast samooceny liczymy objętość,
 * dni treningowe i kandydatów na wyniki z realnych danych. Wszystko, co
 * stąd wychodzi, jest PROPOZYCJĄ: użytkownik potwierdza wartości w kreatorze
 * albo dostaje je w YAML z komentarzem proweniencji.
 */
import type { Weekday } from '../domain/types.ts'
import type { SyncedActivity } from '../ports/sync.ts'
import { messages } from '../i18n/index.ts'
import { addDays, diffDays, mondayOf, parseIso } from '../util/dates.ts'

/** Okno analizy w pełnych tygodniach (wartość inżynierska — ~3 miesiące formy). */
export const INFER_WINDOW_WEEKS = 16
/** Blok odniesienia dla bieżącej objętości: 4 tygodnie (spójne z athlete.recentWeeklyKm). */
const RECENT_BLOCK_WEEKS = 4
/** Przerwa, którą silnik adaptacji traktuje jako restart (ta sama granica co w adapt.ts). */
const LAYOFF_DAYS = 10

export interface RaceCandidate {
  date: string
  distanceKm: number
  timeSec: number
  name?: string
  /** Skąd podejrzenie startu — pokazujemy użytkownikowi, nie zgadujemy po cichu. */
  reason: string
}

export interface InferredProfile {
  recentWeeklyKm: number
  peakWeeklyKm?: number
  daysAvailable: Weekday[]
  longRunDay?: Weekday
  /** Pełne tygodnie okna, rosnąco — do pokazania użytkownikowi (sparkline). */
  weeklyKm: { weekStart: string; km: number }[]
  raceCandidates: RaceCandidate[]
  caveats: string[]
  /** Zakres pełnych tygodni użyty do inferencji. */
  window: { oldest: string; newest: string }
  /** Opis pochodzenia recentWeeklyKm — trafia do komentarza w YAML. */
  recentBasis: string
}

export type InferenceOutcome =
  | { ok: true; profile: InferredProfile }
  | { ok: false; reason: string }

const WEEKDAYS: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

/** Dystanse standardowe do detekcji startów [km]. */
const STANDARD_DISTANCES = [5, 10, 21.0975, 42.195]
/** Tolerancja dopasowania dystansu do standardu (GPS + zaokrąglenia trasy). */
const DISTANCE_TOLERANCE = 0.03
const RACE_NAME_RE = /\b(bieg|maraton|półmaraton|polmaraton|parkrun|race|run|milowe?)\b/i

const isRun = (a: SyncedActivity): boolean => /run/i.test(a.type)

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
}

function weekdayOf(iso: string): Weekday {
  const dow = parseIso(iso).getUTCDay() // 0 = niedziela
  return WEEKDAYS[(dow + 6) % 7]!
}

/** Kandydaci na starty: dystans standardowy + (nazwa startowa albo tempo w górnym decylu). */
function findRaceCandidates(runs: SyncedActivity[]): RaceCandidate[] {
  const paces = runs
    .filter((r) => r.distanceKm && r.movingTimeSec)
    .map((r) => r.movingTimeSec! / r.distanceKm!)
    .sort((a, b) => a - b)
  // górny decyl tempa = najszybsze 10% biegów okna
  const fastCut = paces.length >= 10 ? paces[Math.floor(paces.length / 10)]! : undefined

  const out: RaceCandidate[] = []
  for (const r of runs) {
    if (!r.distanceKm || !r.movingTimeSec) continue
    const standard = STANDARD_DISTANCES.find(
      (d) => Math.abs(r.distanceKm! - d) / d <= DISTANCE_TOLERANCE,
    )
    if (!standard) continue
    const namedLikeRace = r.name !== undefined && RACE_NAME_RE.test(r.name)
    const pace = r.movingTimeSec / r.distanceKm
    // ostro „<": bieg musi być szybszy od progu, nie równy typowemu tłu
    const topDecile = fastCut !== undefined && pace < fastCut
    if (!namedLikeRace && !topDecile) continue
    const m = messages()
    const label =
      standard === 21.0975 ? m.infer.distanceHalf
        : standard === 42.195 ? m.infer.distanceMarathon
          : `${standard} km`
    const why = [
      m.infer.raceReasonDistance(label),
      ...(namedLikeRace ? [m.infer.raceReasonName] : []),
      ...(topDecile ? [m.infer.raceReasonPace] : []),
    ]
    out.push({
      date: r.date,
      distanceKm: standard,
      timeSec: Math.round(r.movingTimeSec),
      ...(r.name ? { name: r.name } : {}),
      reason: why.join(' + '),
    })
  }
  return out.sort((a, b) => b.date.localeCompare(a.date))
}

export function inferProfile(activities: SyncedActivity[], today: string): InferenceOutcome {
  const currentMonday = mondayOf(today)
  const oldestMonday = addDays(currentMonday, -INFER_WINDOW_WEEKS * 7)
  const newest = addDays(currentMonday, -1) // niedziela ostatniego PEŁNEGO tygodnia

  const runs = activities.filter(
    (a) => isRun(a) && a.date >= oldestMonday && a.date <= today && (a.distanceKm ?? 0) > 0,
  )
  const m = messages()
  if (runs.length === 0) return { ok: false, reason: m.infer.noRuns }

  // km per pełny tydzień (bieżący, niepełny tydzień nie zaniża mediany)
  const kmByWeek = new Map<string, number>()
  for (let i = 0; i < INFER_WINDOW_WEEKS; i++) {
    kmByWeek.set(addDays(oldestMonday, i * 7), 0)
  }
  for (const r of runs) {
    const ws = mondayOf(r.date)
    if (!kmByWeek.has(ws)) continue // bieżący tydzień
    kmByWeek.set(ws, kmByWeek.get(ws)! + r.distanceKm!)
  }
  const weeklyKm = [...kmByWeek.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekStart, km]) => ({ weekStart, km: Math.round(km * 10) / 10 }))

  const activeWeeks = weeklyKm.filter((w) => w.km > 0)
  if (activeWeeks.length < RECENT_BLOCK_WEEKS) {
    return { ok: false, reason: m.infer.tooFewWeeks(activeWeeks.length, INFER_WINDOW_WEEKS) }
  }

  const caveats: string[] = []

  // przerwa na końcu okna — spójnie z regułą restartu w adapt (≥10 dni)
  const lastRunDate = runs.map((r) => r.date).sort().at(-1)!
  const tailGap = diffDays(lastRunDate, today)
  if (tailGap >= LAYOFF_DAYS) {
    caveats.push(m.infer.layoffAtEnd(tailGap, lastRunDate))
  }

  // blok odniesienia: 4 tygodnie kończące się na ostatnim AKTYWNYM tygodniu
  // (bez findLastIndex — lib targetu jest starsze niż ES2023)
  let lastActiveIdx = -1
  for (let i = weeklyKm.length - 1; i >= 0; i--) {
    if (weeklyKm[i]!.km > 0) {
      lastActiveIdx = i
      break
    }
  }
  const blockStart = Math.max(0, lastActiveIdx - RECENT_BLOCK_WEEKS + 1)
  const block = weeklyKm.slice(blockStart, lastActiveIdx + 1)
  const blockActive = block.filter((w) => w.km > 0)
  if (blockActive.length < 2) {
    return { ok: false, reason: m.infer.tooFewInBlock }
  }
  if (blockActive.length < block.length) {
    caveats.push(m.infer.zeroWeeksInBlock(block[0]!.weekStart, block.at(-1)!.weekStart))
  }
  const recentWeeklyKm = Math.round(median(blockActive.map((w) => w.km)))
  const recentBasis = m.infer.recentBasis(
    blockActive.length, block[0]!.weekStart, block.at(-1)!.weekStart,
  )

  // szczyt okna: najwyższy pełny tydzień — sufit, który organizm już zniósł
  const peakWeeklyKm = Math.round(Math.max(...weeklyKm.map((w) => w.km)))

  // dni treningowe: dni z udziałem ≥10% biegów, dopełniane do minimum 3 najczęstszymi
  const countByDay = new Map<Weekday, number>()
  for (const r of runs) {
    const d = weekdayOf(r.date)
    countByDay.set(d, (countByDay.get(d) ?? 0) + 1)
  }
  const byFrequency = [...countByDay.entries()].sort((a, b) => b[1] - a[1])
  const picked = new Set<Weekday>(
    byFrequency.filter(([, n]) => n / runs.length >= 0.1).map(([d]) => d),
  )
  for (const [d] of byFrequency) {
    if (picked.size >= 3) break
    picked.add(d)
  }
  const daysAvailable = WEEKDAYS.filter((d) => picked.has(d))

  // długie wybieganie: dzień tygodnia dominujący wśród 8 najdłuższych biegów okna
  const longest = [...runs].sort((a, b) => (b.distanceKm ?? 0) - (a.distanceKm ?? 0)).slice(0, 8)
  const longCount = new Map<Weekday, number>()
  for (const r of longest) {
    const d = weekdayOf(r.date)
    longCount.set(d, (longCount.get(d) ?? 0) + 1)
  }
  const longTop = [...longCount.entries()].sort((a, b) => b[1] - a[1])[0]
  const longRunDay = longTop && longTop[1] >= 3 ? longTop[0] : undefined
  if (!longRunDay) caveats.push(m.infer.noFixedLongRunDay)

  return {
    ok: true,
    profile: {
      recentWeeklyKm,
      ...(peakWeeklyKm > recentWeeklyKm ? { peakWeeklyKm } : {}),
      daysAvailable,
      ...(longRunDay ? { longRunDay } : {}),
      weeklyKm,
      raceCandidates: findRaceCandidates(runs),
      caveats,
      window: { oldest: oldestMonday, newest },
      recentBasis,
    },
  }
}
