/**
 * Skan katalogu z wyeksportowanymi aktywnościami (eksport zbiorczy Stravy,
 * Garmin Connect, Coros, Polar Flow…) → znormalizowane `SyncedActivity`.
 *
 * Zasada: pojedynczy zły plik nigdy nie przerywa skanu — trafia do `skipped`
 * z powodem, który CLI zamienia na komunikat. Wyjątek leci tylko wtedy, gdy
 * wskazanej ścieżki nie ma wcale (to błąd konfiguracji, nie pliku).
 */
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import type { SyncedActivity } from 'trainctl-core'
import { isRunType, type ParsedActivity } from './activity.ts'
import { parseFitActivity } from './fit.ts'
import { parseGpxActivity } from './gpx.ts'
import { parseTcxActivity } from './tcx.ts'

export type SkipReason = 'unreadable' | 'not-an-activity' | 'unsupported' | 'duplicate'

export interface SkippedFile {
  file: string
  reason: SkipReason
}

export interface ScanResult {
  activities: SyncedActivity[]
  skipped: SkippedFile[]
}

/**
 * Wartość inżynierska: górna granica rozmiaru pliku i treści po rozpakowaniu
 * `.gz` (ochrona przed „bombą" gzip). Większy plik pomijamy jako `unsupported`,
 * zamiast wczytywać go w całości do pamięci.
 */
export const MAX_FILE_BYTES = 50 * 1024 * 1024

type Format = 'fit' | 'tcx' | 'gpx'

interface FileKind {
  format: Format
  gzip: boolean
  /** Nazwa pliku bez rozszerzenia aktywności (`123.fit.gz` → `123`). */
  stem: string
}

const FORMATS: Format[] = ['fit', 'tcx', 'gpx']

/** Porównanie po kodach znaków — niezależne od locale maszyny (kolejność deterministyczna). */
const compare = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)

export function activityFileKind(fileName: string): FileKind | undefined {
  const lower = fileName.toLowerCase()
  for (const format of FORMATS) {
    if (lower.endsWith(`.${format}`)) return { format, gzip: false, stem: fileName.slice(0, -(format.length + 1)) }
    if (lower.endsWith(`.${format}.gz`)) return { format, gzip: true, stem: fileName.slice(0, -(format.length + 4)) }
  }
  return undefined
}

/**
 * Pliki ukryte i katalogi ukryte (`.git`, `._plik.fit` z macOS) pomijamy —
 * wartość inżynierska: to śmieci systemowe, nie eksporty aktywności.
 * Dowiązań do katalogów nie śledzimy (ochrona przed pętlą).
 */
function walk(dir: string, files: string[], skipped: SkippedFile[]): void {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    skipped.push({ file: dir, reason: 'unreadable' })
    return
  }
  entries.sort((a, b) => compare(a.name, b.name))
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) walk(full, files, skipped)
    else if (entry.isFile() || entry.isSymbolicLink()) files.push(full)
  }
}

/** XML w kodowaniu z prologu (`encoding="windows-1250"`), domyślnie UTF-8 (BOM zdejmuje TextDecoder). */
function decodeXml(bytes: Uint8Array): string {
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, 256))
  const label = /<\?xml[^>]*\bencoding\s*=\s*["']([\w.:-]+)["']/i.exec(head)?.[1]
  if (label) {
    try {
      return new TextDecoder(label).decode(bytes)
    } catch {
      // nieznana etykieta kodowania — próbujemy UTF-8
    }
  }
  return new TextDecoder('utf-8').decode(bytes)
}

function parse(format: Format, bytes: Uint8Array): ParsedActivity | undefined {
  switch (format) {
    case 'fit':
      return parseFitActivity(bytes)
    case 'tcx':
      return parseTcxActivity(decodeXml(bytes))
    case 'gpx':
      return parseGpxActivity(decodeXml(bytes))
  }
}

type Outcome = { parsed: ParsedActivity; externalId: string } | { reason: SkipReason }

function readActivityFile(file: string, kind: FileKind): Outcome {
  let raw: Uint8Array
  try {
    if (statSync(file).size > MAX_FILE_BYTES) return { reason: 'unsupported' }
    raw = readFileSync(file)
  } catch {
    return { reason: 'unreadable' }
  }
  let bytes = raw
  if (kind.gzip) {
    try {
      bytes = gunzipSync(raw, { maxOutputLength: MAX_FILE_BYTES })
    } catch (error) {
      const tooLarge = (error as { code?: string }).code === 'ERR_BUFFER_TOO_LARGE'
      return { reason: tooLarge ? 'unsupported' : 'unreadable' }
    }
  }
  let parsed: ParsedActivity | undefined
  try {
    parsed = parse(kind.format, bytes)
  } catch {
    return { reason: 'unreadable' }
  }
  if (!parsed) return { reason: 'not-an-activity' }
  // Skrót z TREŚCI (po rozpakowaniu): stabilny przy zmianie nazwy, a ta sama
  // aktywność wyeksportowana dwa razy (np. `.fit` i `.fit.gz`) daje jeden wpis.
  const externalId = 'file-' + createHash('sha1').update(bytes).digest('hex').slice(0, 16)
  return { parsed, externalId }
}

function toSynced(parsed: ParsedActivity, externalId: string, fallbackName: string): SyncedActivity {
  const activity: SyncedActivity = {
    externalId,
    date: parsed.date,
    type: parsed.type,
    name: parsed.name ?? fallbackName,
    source: 'file',
  }
  if (parsed.distanceM !== undefined) activity.distanceKm = Math.round(parsed.distanceM / 10) / 100
  if (parsed.movingTimeSec !== undefined) activity.movingTimeSec = parsed.movingTimeSec
  if (parsed.elapsedTimeSec !== undefined) activity.elapsedTimeSec = parsed.elapsedTimeSec
  if (parsed.elevationGainM !== undefined) activity.elevationGainM = parsed.elevationGainM
  if (parsed.avgHr !== undefined) activity.avgHr = parsed.avgHr
  if (parsed.distanceM !== undefined && parsed.distanceM > 0 && parsed.movingTimeSec) {
    activity.avgPaceSecPerKm = Math.round(parsed.movingTimeSec / (parsed.distanceM / 1000))
  }
  return activity
}

/**
 * Ten sam bieg w dwóch formatach (eksport Garmina .fit i Stravy .gpx) ma inne
 * bajty, ale ten sam start. Ta sama rodzina aktywności (bieg po szosie, trailu
 * i bieżni to jedna rodzina) i start w ±60 s = duplikat; zostaje plik najbogatszy
 * w dane (FIT > TCX > GPX). 60 s to wartość inżynierska — znaczniki czasu formatów
 * różnią się zaokrągleniem, dwa różne biegi nie.
 */
const DUPLICATE_WINDOW_MS = 60_000
const FORMAT_RANK: Record<string, number> = { fit: 0, tcx: 1, gpx: 2 }
const sameFamily = (a: ParsedActivity['type'], b: ParsedActivity['type']) => a === b || (isRunType(a) && isRunType(b))

/**
 * Katalog (rekurencyjnie) albo pojedynczy plik → aktywności posortowane po dacie.
 * Rozszerzenia: `.fit .tcx .gpx` i ich warianty `.gz`, bez względu na wielkość liter.
 * W katalogu inne pliki są ignorowane; wskazany wprost plik o innym
 * rozszerzeniu trafia do `skipped` jako `unsupported`.
 * Rzuca błąd systemu plików (np. `ENOENT`), gdy samej ścieżki nie ma.
 */
export function scanActivityFiles(path: string): ScanResult {
  const skipped: SkippedFile[] = []
  const candidates: string[] = []
  if (statSync(path).isDirectory()) {
    walk(path, candidates, skipped)
  } else if (activityFileKind(basename(path))) {
    candidates.push(path)
  } else {
    skipped.push({ file: path, reason: 'unsupported' })
  }

  const seen = new Set<string>()
  const found: { parsed: ParsedActivity; activity: SyncedActivity; format: string; file: string }[] = []
  for (const file of candidates) {
    const kind = activityFileKind(basename(file))
    if (!kind) continue
    const outcome = readActivityFile(file, kind)
    if ('reason' in outcome) {
      skipped.push({ file, reason: outcome.reason })
      continue
    }
    if (seen.has(outcome.externalId)) continue
    seen.add(outcome.externalId)
    found.push({ parsed: outcome.parsed, activity: toSynced(outcome.parsed, outcome.externalId, kind.stem), format: kind.format, file })
  }

  // duplikaty między formatami: po starcie w czasie, z przesuwanym oknem — O(n log n)
  const timed = found
    .map((f) => ({ ...f, at: Date.parse(f.parsed.startTime) }))
    .sort((a, b) => a.at - b.at || (FORMAT_RANK[a.format] ?? 9) - (FORMAT_RANK[b.format] ?? 9))
  const kept: typeof timed = []
  for (const f of timed) {
    let twin = -1
    for (let k = kept.length - 1; k >= 0 && f.at - kept[k]!.at <= DUPLICATE_WINDOW_MS; k--) {
      if (sameFamily(kept[k]!.parsed.type, f.parsed.type)) {
        twin = k
        break
      }
    }
    if (twin === -1) {
      kept.push(f)
      continue
    }
    // zostaje bogatszy format; drugi plik jest wymieniony w pominiętych, nie znika po cichu
    if ((FORMAT_RANK[f.format] ?? 9) < (FORMAT_RANK[kept[twin]!.format] ?? 9)) {
      skipped.push({ file: kept[twin]!.file, reason: 'duplicate' })
      kept[twin] = f
    } else {
      skipped.push({ file: f.file, reason: 'duplicate' })
    }
  }

  kept.sort(
    (a, b) =>
      compare(a.activity.date, b.activity.date) ||
      compare(a.parsed.startTime, b.parsed.startTime) ||
      compare(a.activity.externalId, b.activity.externalId),
  )
  return { activities: kept.map((f) => f.activity), skipped }
}
