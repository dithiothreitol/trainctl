/**
 * Wspólny wynik parserów FIT/TCX/GPX — przed normalizacją do `SyncedActivity`.
 * Jednostki „surowe" (metry, sekundy); zamianę na km i tempo robi `files.ts`.
 *
 * Nazewnictwo typów jak w intervals.icu/Stravie, bo CLI rozpoznaje bieg
 * wyrażeniem `/^(run|running|trailrun|…|virtualrun|treadmill…)$/i` na `type`.
 */

/** Typy, które parsery zwracają. Wszystko spoza listy trafia do `Other`. */
export type ActivityType =
  | 'Run'
  | 'TrailRun'
  | 'VirtualRun'
  | 'Ride'
  | 'Walk'
  | 'Hike'
  | 'Swim'
  | 'WeightTraining'
  | 'Other'

export interface ParsedActivity {
  /** Lokalna data startu `YYYY-MM-DD` (strefa: patrz README — ograniczenia TCX/GPX). */
  date: string
  /** Chwila startu w UTC (ISO 8601) — do sortowania; `SyncedActivity` jej nie niesie. */
  startTime: string
  type: ActivityType
  /** Nazwa nadana aktywności w źródle (TCX `Notes`, GPX `trk/name`). FIT jej nie ma. */
  name?: string
  distanceM?: number
  /** Czas ruchu: FIT `total_timer_time`, TCX suma `TotalTimeSeconds`, GPX z punktów. */
  movingTimeSec?: number
  elapsedTimeSec?: number
  elevationGainM?: number
  avgHr?: number
}

export const isRunType = (type: ActivityType): boolean =>
  type === 'Run' || type === 'TrailRun' || type === 'VirtualRun'

/** Fragment aktywności: sesja FIT albo `Activity` z multisportowego TCX. */
export interface ActivityPart {
  /** Start w ms od epoki uniksowej (UTC). */
  startMs: number
  type: ActivityType
  distanceM?: number
  movingTimeSec?: number
  elapsedTimeSec?: number
  elevationGainM?: number
  avgHr?: number
}

const sum = (values: (number | undefined)[]): number | undefined => {
  const present = values.filter((v): v is number => v !== undefined)
  return present.length ? present.reduce((a, b) => a + b, 0) : undefined
}

/**
 * Multisport (triathlon, duathlon, brick): z planem biegowym porównujemy
 * wyłącznie bieg, więc sumujemy tylko części biegowe — 40 km roweru nie może
 * udawać 40 km biegu. Gdy części biegowych brak, sumujemy wszystkie, a typ
 * bierzemy z pierwszej. Start zawsze z pierwszej części (data całego zdarzenia).
 * Tętno: średnia ważona czasem ruchu (albo czasem całkowitym, gdy ruchu brak).
 */
export function combineParts(parts: ActivityPart[]): ActivityPart | undefined {
  if (parts.length === 0) return undefined
  const ordered = [...parts].sort((a, b) => a.startMs - b.startMs)
  const first = ordered[0]!
  if (ordered.length === 1) return first
  const runs = ordered.filter((p) => isRunType(p.type))
  const chosen = runs.length > 0 ? runs : ordered
  const combined: ActivityPart = { startMs: first.startMs, type: chosen[0]!.type }
  const distanceM = sum(chosen.map((p) => p.distanceM))
  const movingTimeSec = sum(chosen.map((p) => p.movingTimeSec))
  const elapsedTimeSec = sum(chosen.map((p) => p.elapsedTimeSec))
  const elevationGainM = sum(chosen.map((p) => p.elevationGainM))
  if (distanceM !== undefined) combined.distanceM = distanceM
  if (movingTimeSec !== undefined) combined.movingTimeSec = movingTimeSec
  if (elapsedTimeSec !== undefined) combined.elapsedTimeSec = elapsedTimeSec
  if (elevationGainM !== undefined) combined.elevationGainM = elevationGainM
  let hrWeight = 0
  let hrSum = 0
  for (const p of chosen) {
    const weight = p.movingTimeSec ?? p.elapsedTimeSec ?? 0
    if (p.avgHr === undefined || weight <= 0) continue
    hrWeight += weight
    hrSum += p.avgHr * weight
  }
  if (hrWeight > 0) combined.avgHr = hrSum / hrWeight
  return combined
}

/** Złożenie wyniku z części i daty — ten sam kształt dla FIT i TCX. */
export function toParsed(part: ActivityPart, date: string, name?: string): ParsedActivity {
  const parsed: ParsedActivity = {
    date,
    startTime: new Date(part.startMs).toISOString(),
    type: part.type,
  }
  if (name) parsed.name = name
  if (part.distanceM !== undefined) parsed.distanceM = part.distanceM
  if (part.movingTimeSec !== undefined) parsed.movingTimeSec = Math.round(part.movingTimeSec)
  if (part.elapsedTimeSec !== undefined) parsed.elapsedTimeSec = Math.round(part.elapsedTimeSec)
  if (part.elevationGainM !== undefined) parsed.elevationGainM = Math.round(part.elevationGainM)
  if (part.avgHr !== undefined) parsed.avgHr = Math.round(part.avgHr)
  return parsed
}
