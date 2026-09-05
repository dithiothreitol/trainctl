/**
 * Warstwa sync w CLI: klucz API z env/pliku, push planu i pull wykonania.
 * Klucz NIGDY nie trafia do trainctl.yaml (plik jest w repo użytkownika) —
 * czytamy z env TRAINCTL_INTERVALS_API_KEY albo z .trainctl-secret (gitignore).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { addDays, type SyncProvider, type SyncedActivity, type SyncedWellness } from 'trainctl-core'
import { IntervalsIcuProvider, toPushableWorkout } from 'trainctl-sync-intervalsicu'
import { buildExecution } from './execution.ts'
import type { LogEntry } from './logfile.ts'
import { ui } from './i18n/index.ts'
import { loadPlan, type StoredPlan } from './planfile.ts'

export const SECRET_FILE = '.trainctl-secret'
export const SYNC_FILE = 'sync.json'

export interface SyncSnapshot {
  pulledAt: string
  from?: string
  to?: string
  activities: SyncedActivity[]
  wellness: SyncedWellness[]
}

export function readApiKey(cwd: string): string {
  const fromEnv = process.env['TRAINCTL_INTERVALS_API_KEY']?.trim()
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
  const previous = readSnapshot(cwd)
  if (previous && snapshot.from && snapshot.to) {
    const outside = (date: string) => date < snapshot.from! || date > snapshot.to!
    const merged = new Map(previous.activities.filter((a) => outside(a.date)).map((a) => [a.externalId, a]))
    for (const a of snapshot.activities) merged.set(a.externalId, a)
    snapshot = { ...snapshot, activities: [...merged.values()],
      wellness: [...previous.wellness.filter((w) => outside(w.date)), ...snapshot.wellness] }
  }
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
  status: 'matched' | 'shorter' | 'longer' | 'missed' | 'unplanned' | 'unknown'
}

export function compare(plan: StoredPlan, activities: SyncedActivity[], from: string, to: string, logs: LogEntry[] = []): Comparison[] {
  return buildExecution(plan, activities, logs, to)
    .filter((e) => e.date >= from && e.status !== 'rest')
    .map((e) => {
      const status: Comparison['status'] = e.status === 'unknown' ? 'unknown'
        : e.status === 'missed' ? 'missed' : e.status === 'unplanned' ? 'unplanned'
        : (e.actualKm ?? 0) < e.plannedKm * 0.85 ? 'shorter'
        : (e.actualKm ?? 0) > e.plannedKm * 1.15 ? 'longer' : 'matched'
      return { date: e.date, plannedKm: e.plannedKm, status, ...(e.actualKm !== undefined ? { actualKm: e.actualKm } : {}) }
    })
}

export function defaultRange(today: string, days: number): { from: string; to: string } {
  return days >= 0
    ? { from: today, to: addDays(today, days) }
    : { from: addDays(today, days), to: today }
}

export function planOrThrow(cwd: string): StoredPlan {
  return loadPlan(cwd)
}
