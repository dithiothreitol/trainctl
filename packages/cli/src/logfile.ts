/** Dziennik wykonania: log.jsonl — jedna linia JSON na wpis (append-only). */
import { appendFileSync, closeSync, existsSync, openSync, readFileSync, readSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { ui } from './i18n/index.ts'
import { parseDecimal } from './format.ts'

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
  const path = join(cwd, LOG_FILE)
  // ręczna edycja bez końcowego znaku nowej linii skleiłaby nowy wpis z ostatnim;
  // czytamy tylko ostatni bajt, nie cały dziennik
  appendFileSync(path, (endsWithoutNewline(path) ? '\n' : '') + JSON.stringify(entry) + '\n', 'utf-8')
}

function endsWithoutNewline(path: string): boolean {
  if (!existsSync(path)) return false
  const size = statSync(path).size
  if (size === 0) return false
  const fd = openSync(path, 'r')
  try {
    const last = Buffer.alloc(1)
    readSync(fd, last, 0, 1, size - 1)
    return last[0] !== 0x0a
  } finally { closeSync(fd) }
}

function readAll(cwd: string): (LogEntry | StrengthLogEntry)[] {
  const path = join(cwd, LOG_FILE)
  if (!existsSync(path)) return []
  return readFileSync(path, 'utf-8')
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => normalize(JSON.parse(l) as Record<string, unknown>))
}

/** Czas wpisany tak, jak przyjmuje go CLI („58:30"), albo liczba tekstem, także z przecinkiem („8,5"). */
function fromText(key: string, text: string): number {
  if (key.endsWith('Sec') && text.includes(':')) {
    try { return parseTime(text.trim()) } catch { return NaN }
  }
  return parseDecimal(text)
}

/**
 * Granice wartości dziennika — jedne dla `trainctl log` (walidacja wejścia) i dla
 * odczytu ręcznie edytowanego log.jsonl. RPE całkowite 1–10 (CR-10 bez zera, P-6),
 * minuty siły całkowite 1–300, dystans nieujemny, czasy dodatnie.
 */
export const LOG_LIMITS = {
  km: (v: number): boolean => Number.isFinite(v) && v >= 0,
  timeSec: (v: number): boolean => Number.isFinite(v) && v > 0,
  testTimeSec: (v: number): boolean => Number.isFinite(v) && v > 0,
  rpe: (v: number): boolean => Number.isInteger(v) && v >= 1 && v <= 10,
  minutes: (v: number): boolean => Number.isInteger(v) && v >= 1 && v <= 300,
}

/**
 * log.jsonl bywa edytowany ręcznie. Liczby zapisane tekstem („8") zamieniamy na
 * liczby, wartości spoza liczb (null, „osiem") pomijamy — raz, przy odczycie,
 * zamiast osobnej ochrony w każdej komendzie. Status zostaje, jak jest: widok
 * pokazuje nieznany status bez zmian (logStatusText). 0 km przy opuszczonej
 * sesji to brak dystansu, nie informacja.
 */
function normalize(raw: Record<string, unknown>): LogEntry | StrengthLogEntry {
  const entry = { ...raw }
  for (const key of ['km', 'timeSec', 'testTimeSec', 'rpe', 'minutes'] as const) {
    if (!(key in entry)) continue
    const value = typeof entry[key] === 'string' && (entry[key] as string).trim() ? fromText(key, entry[key] as string) : entry[key]
    if (typeof value === 'number' && LOG_LIMITS[key](value)) entry[key] = value
    else delete entry[key]
  }
  if (entry['status'] === 'skipped' && entry['km'] === 0) delete entry['km']
  return entry as unknown as LogEntry | StrengthLogEntry
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
