/**
 * Warstwa sync w CLI: klucz API z env/pliku, push planu i pull wykonania.
 * Klucz NIGDY nie trafia do tren.yaml (plik jest w repo użytkownika) —
 * czytamy z env TREN_INTERVALS_API_KEY albo z .tren-secret (gitignore).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { addDays, type SyncProvider, type SyncedActivity, type SyncedWellness } from '@tren/core'
import { IntervalsIcuProvider, toPushableWorkout } from '@tren/sync-intervalsicu'
import { ui } from './i18n/index.ts'
import { loadPlan, type StoredPlan } from './planfile.ts'

export const SECRET_FILE = '.tren-secret'
export const SYNC_FILE = 'sync.json'

export interface SyncSnapshot {
  pulledAt: string
  activities: SyncedActivity[]
  wellness: SyncedWellness[]
}

export function readApiKey(cwd: string): string {
  const fromEnv = process.env['TREN_INTERVALS_API_KEY']?.trim()
  if (fromEnv) return fromEnv
  const path = join(cwd, SECRET_FILE)
  if (existsSync(path)) {
    const key = readFileSync(path, 'utf-8').trim()
    if (key) return key
  }
  throw new Error(ui().sync.missingKey(SECRET_FILE))
}

/** Czy klucz jest osiągalny — bez rzucania (kreator pyta o pobranie historii tylko wtedy). */
export function hasApiKey(cwd: string): boolean {
  try {
    readApiKey(cwd)
    return true
  } catch {
    return false
  }
}

export type ProviderFactory = (cwd: string) => SyncProvider

export const defaultProviderFactory: ProviderFactory = (cwd) =>
  new IntervalsIcuProvider({ apiKey: readApiKey(cwd) })

/** Treningi z planu w zakresie dat — do wypchnięcia na zegarek. */
export function workoutsToPush(plan: StoredPlan, from: string, to: string) {
  return plan.weeks
    .flatMap((w) => w.days)
    .filter((d) => d.date >= from && d.date <= to)
    .map((d) => toPushableWorkout(d, plan.goal.name))
    .filter((w): w is NonNullable<typeof w> => w !== undefined)
}

export function writeSnapshot(cwd: string, snapshot: SyncSnapshot): void {
  writeFileSync(join(cwd, SYNC_FILE), JSON.stringify(snapshot, null, 1), 'utf-8')
}

export function readSnapshot(cwd: string): SyncSnapshot | undefined {
  const path = join(cwd, SYNC_FILE)
  if (!existsSync(path)) return undefined
  return JSON.parse(readFileSync(path, 'utf-8')) as SyncSnapshot
}

/** Porównanie wykonania z planem — baza pod adaptację w fazie 5. */
export interface Comparison {
  date: string
  plannedKm: number
  actualKm?: number
  /** Klucz statusu — niezależny od języka; etykietę dokłada warstwa prezentacji. */
  status: 'matched' | 'shorter' | 'longer' | 'missed' | 'unplanned'
}

export function compare(plan: StoredPlan, activities: SyncedActivity[], from: string, to: string): Comparison[] {
  const byDate = new Map<string, SyncedActivity[]>()
  for (const a of activities) {
    if (a.date < from || a.date > to) continue
    byDate.set(a.date, [...(byDate.get(a.date) ?? []), a])
  }
  const out: Comparison[] = []
  const seen = new Set<string>()
  for (const week of plan.weeks) {
    for (const day of week.days) {
      if (day.date < from || day.date > to) continue
      const acts = byDate.get(day.date) ?? []
      const actualKm = acts.reduce((s, a) => s + (a.distanceKm ?? 0), 0)
      const plannedKm = day.workout?.distanceKm ?? 0
      seen.add(day.date)
      if (!day.workout && acts.length === 0) continue
      let status: Comparison['status']
      if (!day.workout) status = 'unplanned'
      else if (acts.length === 0) status = 'missed'
      else if (actualKm < plannedKm * 0.85) status = 'shorter'
      else if (actualKm > plannedKm * 1.15) status = 'longer'
      else status = 'matched'
      out.push({
        date: day.date,
        plannedKm,
        ...(acts.length ? { actualKm: Math.round(actualKm * 10) / 10 } : {}),
        status,
      })
    }
  }
  for (const [date, acts] of byDate) {
    if (seen.has(date)) continue
    out.push({
      date,
      plannedKm: 0,
      actualKm: Math.round(acts.reduce((s, a) => s + (a.distanceKm ?? 0), 0) * 10) / 10,
      status: 'unplanned',
    })
  }
  return out.sort((a, b) => a.date.localeCompare(b.date))
}

export function defaultRange(today: string, days: number): { from: string; to: string } {
  return days >= 0
    ? { from: today, to: addDays(today, days) }
    : { from: addDays(today, days), to: today }
}

export function planOrThrow(cwd: string): StoredPlan {
  return loadPlan(cwd)
}
