/** Dziennik wykonania: log.jsonl — jedna linia JSON na wpis (append-only). */
import { appendFileSync, closeSync, existsSync, openSync, readFileSync, readSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { BREAK_REASONS, type BreakReason } from 'trainctl-core'
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
  /** Przyczyna opuszczenia (B11): przerwa zapisana `log --to … --reason …`. */
  reason?: BreakReason
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

/**
 * Separator przed nowym wierszem JSONL: ręczna edycja bez końcowego znaku nowej
 * linii skleiłaby nowy wpis z ostatnim. Jedna reguła dla obu zapisów dziennika
 * (`appendLog` tutaj, wpisy sesji v2 w sports-commands.ts).
 */
export const lineSeparator = (tail: string): string => (tail !== '' && !tail.endsWith('\n') ? '\n' : '')

export function appendLog(cwd: string, entry: LogEntry | StrengthLogEntry): void {
  const path = join(cwd, LOG_FILE)
  appendFileSync(path, lineSeparator(lastChar(path)) + JSON.stringify(entry) + '\n', 'utf-8')
}

/** Ostatni znak pliku bez czytania całości (dziennik rośnie); brak pliku to ''. */
function lastChar(path: string): string {
  try {
    const size = statSync(path).size
    if (size === 0) return ''
    const fd = openSync(path, 'r')
    try {
      const last = Buffer.alloc(1)
      readSync(fd, last, 0, 1, size - 1)
      return last.toString('latin1')
    } finally { closeSync(fd) }
  } catch {
    return ''
  }
}

/** Ostatni wpis każdej daty — późniejszy nadpisuje wcześniejszy; jedna reguła dla wszystkich widoków. */
export function latestByDate<T extends { date: string }>(entries: T[]): Map<string, T> {
  return new Map(entries.map((e) => [e.date, e]))
}

function readAll(cwd: string, dropped: string[] = [], broken: string[] = []): (LogEntry | StrengthLogEntry)[] {
  const path = join(cwd, LOG_FILE)
  if (!existsSync(path)) return []
  // Ręczna edycja bywa niedokończona: wiersz, który nie jest obiektem JSON, pomijamy
  // i zgłaszamy („wiersz N"), zamiast wywracać każdą komendę czytającą dziennik.
  return readFileSync(path, 'utf-8').split('\n').flatMap((line, index) => {
    if (!line.trim()) return []
    const parsed = parseLine(line)
    if (!parsed) { broken.push(ui().common.logLine(index + 1)); return [] }
    return [normalize(parsed, dropped)]
  })
}

function parseLine(line: string): Record<string, unknown> | undefined {
  try {
    const value: unknown = JSON.parse(line)
    return value !== null && typeof value === 'object' && !Array.isArray(value) && typeof (value as { date?: unknown }).date === 'string'
      ? value as Record<string, unknown> : undefined
  } catch {
    return undefined
  }
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
 * minuty siły całkowite 1–300, dystans 0–500 km, czasy dodatnie.
 */
const positiveSeconds = (v: number): boolean => Number.isFinite(v) && v > 0
/** 500 km (inż.): sufit literówki („8500" zamiast „8.5"), z zapasem dla ultra. */
export const LOG_KM_MAX = 500

export const LOG_LIMITS = {
  km: (v: number): boolean => Number.isFinite(v) && v >= 0 && v <= LOG_KM_MAX,
  timeSec: positiveSeconds,
  testTimeSec: positiveSeconds,
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
function normalize(raw: Record<string, unknown>, dropped: string[] = []): LogEntry | StrengthLogEntry {
  const entry = { ...raw }
  for (const key of ['km', 'timeSec', 'testTimeSec', 'rpe', 'minutes'] as const) {
    if (!(key in entry)) continue
    const value = typeof entry[key] === 'string' && (entry[key] as string).trim() ? fromText(key, entry[key] as string) : entry[key]
    if (typeof value === 'number' && LOG_LIMITS[key](value)) entry[key] = value
    else {
      dropped.push(`${String(entry['date'] ?? '?')} ${key}`)
      delete entry[key]
    }
  }
  if (entry['status'] === 'skipped' && entry['km'] === 0) delete entry['km']
  // przyczyna przerwy spoza listy (B11) nie trafia do diagnozy adapt
  if ('reason' in entry && !(BREAK_REASONS as readonly unknown[]).includes(entry['reason'])) {
    dropped.push(`${String(entry['date'] ?? '?')} reason`)
    delete entry['reason']
  }
  return entry as unknown as LogEntry | StrengthLogEntry
}

const isStrength = (e: LogEntry | StrengthLogEntry): e is StrengthLogEntry => (e as StrengthLogEntry).activity === 'strength'

/**
 * Dziennik do zmiany planu: uszkodzony wiersz mógł być wpisem dnia, który trzeba
 * chronić, więc każda ścieżka zmieniająca plan albo doradzająca zmianę (regeneracja,
 * propozycje, `shift`, `reschedule`, diagnoza `adapt`) najpierw czeka, aż plik zostanie
 * poprawiony. Widoki (`today`, `week`, `review`, `status`) tylko go pomijają i ostrzegają.
 */
export function readLogForChanges(cwd: string): LogEntry[] {
  const journal = readJournal(cwd)
  if (journal.broken.length) throw new Error(ui().common.logBroken(LOG_FILE, journal.broken.join(', ')))
  return journal.runs
}

/**
 * Cały dziennik jednym odczytem: wpisy biegowe i siłowe osobno, wartości pominięte
 * przy odczycie (poza granicami LOG_LIMITS albo nie liczby, „data pole") i wiersze,
 * których nie da się odczytać („wiersz N"). Widoki je pomijają, `status` je wymienia,
 * a zmiana planu (recordedDates) czeka, aż plik zostanie poprawiony.
 */
export function readJournal(cwd: string): { runs: LogEntry[]; strength: StrengthLogEntry[]; dropped: string[]; broken: string[] } {
  const dropped: string[] = [], broken: string[] = []
  const all = readAll(cwd, dropped, broken)
  return { runs: all.filter((e): e is LogEntry => !isStrength(e)), strength: all.filter(isStrength), dropped, broken }
}

/** Wpisy biegowe — to, z czego liczy się wykonanie planu. */
export function readLog(cwd: string): LogEntry[] {
  return readJournal(cwd).runs
}

/** Wpisy siły; ostatni wpis dnia wygrywa, jak w dzienniku biegów. */
export function readStrengthLog(cwd: string): StrengthLogEntry[] {
  return readJournal(cwd).strength
}

/** Ostatni wpis dla daty (późniejszy nadpisuje wcześniejszy w interpretacji). */
export function logFor(cwd: string, date: string): LogEntry | undefined {
  return latestByDate(readLog(cwd)).get(date)
}

/** "MM:SS" lub "HH:MM:SS" → sekundy. */
export function parseTime(text: string): number {
  const parts = text.split(':').map(Number)
  if (!/^\d+:\d{2}(?::\d{2})?$/.test(text) || parts.some(p => !Number.isFinite(p) || p < 0) || parts.slice(1).some(p => p >= 60) || parts.every(p => p === 0) || parts.length < 2 || parts.length > 3) {
    throw new Error(ui().common.badTime(text))
  }
  return parts.reduce((acc, p) => acc * 60 + p, 0)
}
