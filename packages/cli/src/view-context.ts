/**
 * PLAN-v0.7 E4: kontekst widoku planu biegowego nad planem v2. Czytniki planu biegowego
 * (`loadPlan`, `loadConfig`, dziennik, lista propozycji) zwracają w nim widok zamiast plików
 * v1, więc `why`, `status`, `review` i `adapt` idą tą samą ścieżką w obu schematach.
 * AsyncLocalStorage, bo `review` czeka na synchronizację, a serwer MCP może obsługiwać
 * kilka wywołań naraz — widok nie może przeciec do innego katalogu ani wywołania.
 */
import { AsyncLocalStorage } from 'node:async_hooks'
import type { TrainctlConfig } from './config.ts'
import type { LogEntry, StrengthLogEntry } from './logfile.ts'
import type { StoredPlan } from './planfile.ts'

/** Wiersz listy propozycji (`status`) — ten sam kształt co propozycje planu biegowego. */
export interface ViewProposalRow {
  id: string
  kind: string
  createdFor: string
  preparedOn: string | null
  changes: number
  firstDate: string | null
  state: 'valid' | 'stale'
}

export interface RunningView {
  plan: StoredPlan
  config: TrainctlConfig
  journal: { runs: LogEntry[]; strength: StrengthLogEntry[] }
  /** Propozycja planu biegowego zapisana jako propozycja v2 (`--apply` ścieżką v2); zwraca jej ID. */
  propose(plan: StoredPlan, changes: { date: string; before: string; after: string }[]): string
  /** Propozycje v2 w kształcie listy propozycji planu biegowego. */
  proposals(): ViewProposalRow[]
  /** Wpis dziennika planu biegowego zapisany jako wpis sesji v2 (przerwa B11). */
  record(entry: LogEntry | StrengthLogEntry): void
}

const store = new AsyncLocalStorage<{ cwd: string; view: RunningView }>()

/** Widok otwarty dla tego katalogu; poza kontekstem albo dla innego katalogu go nie ma. */
export function activeView(cwd: string): RunningView | undefined {
  const current = store.getStore()
  return current && current.cwd === cwd ? current.view : undefined
}

export function inRunningView<T>(cwd: string, view: RunningView, fn: () => T): T {
  return store.run({ cwd, view }, fn)
}

/** Zapis planu biegowego w widoku byłby zapisem v1 w katalogu v2 — plan zmienia się ścieżką v2. */
export function assertNoView(cwd: string): void {
  if (activeView(cwd)) throw new Error('E4: running view is read-only')
}
