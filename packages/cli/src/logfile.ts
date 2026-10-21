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

/**
 * Wpis sesji siłowej — w tym samym log.jsonl, ale osobny tor (ADR-023): nie
 * nadpisuje wpisu biegu z tej samej daty i nie wchodzi do porównań wykonania.
 */
export interface StrengthLogEntry {
  date: string
  activity: 'strength'
  status: 'done' | 'skipped'
  minutes?: number
  note?: string
  loggedAt: string
}

export function appendLog(cwd: string, entry: LogEntry | StrengthLogEntry): void {
  appendFileSync(join(cwd, LOG_FILE), JSON.stringify(entry) + '\n', 'utf-8')
}

function readAll(cwd: string): (LogEntry | StrengthLogEntry)[] {
  const path = join(cwd, LOG_FILE)
  if (!existsSync(path)) return []
  return readFileSync(path, 'utf-8')
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as LogEntry | StrengthLogEntry)
}

const isStrength = (e: LogEntry | StrengthLogEntry): e is StrengthLogEntry => (e as StrengthLogEntry).activity === 'strength'

/** Wpisy biegowe — to, z czego liczy się wykonanie planu. */
export function readLog(cwd: string): LogEntry[] {
  return readAll(cwd).filter((e): e is LogEntry => !isStrength(e))
}

/** Wpisy siły; ostatni wpis dnia wygrywa, jak w dzienniku biegów. */
export function readStrengthLog(cwd: string): StrengthLogEntry[] {
  return readAll(cwd).filter(isStrength)
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
