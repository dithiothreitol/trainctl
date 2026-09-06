/** Dziennik wykonania: log.jsonl — jedna linia JSON na wpis (append-only). */
import { appendFileSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ui } from './i18n/index.ts'

export const LOG_FILE = 'log.jsonl'

export interface LogEntry {
  date: string
  status: 'done' | 'skipped' | 'modified'
  km?: number
  timeSec?: number
  /** Elapsed time of the measured race/test segment, excluding warmup/cooldown. */
  testTimeSec?: number
  /**
   * Wysiłek sesji w skali CR-10 (1–10, Foster). Zbieranie uzasadnia P-6 (sRPE);
   * granica użycia: silnik te wartości wyłącznie przechowuje i cytuje — nigdy
   * nie kalibruje z nich stref (Z-4) ani nie liczy gotowości (ADR-027).
   */
  rpe?: number
  note?: string
  loggedAt: string
}

export function appendLog(cwd: string, entry: LogEntry): void {
  appendFileSync(join(cwd, LOG_FILE), JSON.stringify(entry) + '\n', 'utf-8')
}

export function readLog(cwd: string): LogEntry[] {
  const path = join(cwd, LOG_FILE)
  if (!existsSync(path)) return []
  return readFileSync(path, 'utf-8')
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as LogEntry)
}

/** Ostatni wpis dla daty (późniejszy nadpisuje wcześniejszy w interpretacji). */
export function logFor(cwd: string, date: string): LogEntry | undefined {
  return readLog(cwd)
    .filter((e) => e.date === date)
    .at(-1)
}

/** "MM:SS" lub "HH:MM:SS" → sekundy. */
export function parseTime(text: string): number {
  const parts = text.split(':').map(Number)
  if (!/^\d+:\d{2}(?::\d{2})?$/.test(text) || parts.some(p => !Number.isFinite(p) || p < 0) || parts.slice(1).some(p => p >= 60) || parts.every(p => p === 0) || parts.length < 2 || parts.length > 3) {
    throw new Error(ui().common.badTime(text))
  }
  return parts.reduce((acc, p) => acc * 60 + p, 0)
}
