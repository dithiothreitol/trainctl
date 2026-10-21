/**
 * Dekoder plików AKTYWNOŚCI FIT (Garmin, Coros, Polar, Suunto, Wahoo…).
 *
 * Bez SDK Garmina i bez bibliotek (ADR-017 — ta sama logika co przy koderze
 * treningów w trainctl-export, z którego celowo nie importujemy: to dwie
 * niezależne implementacje formatu). Źródła: FIT Protocol z Garmin FIT SDK
 * (nagłówek, rekordy, typy bazowe, CRC) i Profile.xlsx z tego SDK (numery
 * komunikatów, pól i wyliczeń; sprawdzone z profile.py w python-fitparse).
 *
 * Plik: nagłówek 12/14 B → rekordy (definicje i dane) → CRC-16 pliku.
 * Czytamy tylko to, czego potrzebuje porównanie z planem:
 * - file_id (0): `type` = 4 (activity) — inaczej to nie jest aktywność;
 * - session (18): start, sport, czasy, dystans, tętno, podejścia;
 * - activity (34): local_timestamp − timestamp = przesunięcie strefy;
 * - sport (12) i record (20): tylko gdy pliku nie zamyka żadna sesja.
 * Pliki łańcuchowe (kilka FIT sklejonych w jeden) czytamy do końca pierwszego.
 */
import { combineParts, toParsed, type ActivityPart, type ActivityType, type ParsedActivity } from './activity.ts'
import { dateWithOffset, localDateFromMs } from './dates.ts'
import { classifyByPace, elevationGainM, movingTimeSec, type MotionSample } from './measure.ts'

/** 1989-12-31T00:00:00Z w sekundach uniksowych — epoka typu `date_time` (FIT SDK). */
export const FIT_EPOCH_OFFSET_SEC = 631065600

// ---------------------------------------------------------------- prymitywy

/** CRC-16 z FIT Protocol (wariant tablicowy po półbajtach; równoważny CRC-16/ARC). */
const CRC_TABLE = [
  0x0000, 0xcc01, 0xd801, 0x1400, 0xf001, 0x3c00, 0x2800, 0xe401,
  0xa001, 0x6c00, 0x7800, 0xb401, 0x5000, 0x9c01, 0x8801, 0x4400,
]

export function fitCrc(data: Uint8Array, start = 0, end = data.length): number {
  let crc = 0
  for (let i = start; i < end; i++) {
    const byte = data[i]!
    let tmp = CRC_TABLE[crc & 0xf]!
    crc = (crc >> 4) & 0x0fff
    crc = crc ^ tmp ^ CRC_TABLE[byte & 0xf]!
    tmp = CRC_TABLE[crc & 0xf]!
    crc = (crc >> 4) & 0x0fff
    crc = crc ^ tmp ^ CRC_TABLE[(byte >> 4) & 0xf]!
  }
  return crc & 0xffff
}

/** Rozmiar elementu typu bazowego (FIT Protocol, tabela „Base Types"; indeks = numer typu). */
const BASE_SIZE = [1, 1, 1, 2, 2, 4, 4, 1, 4, 8, 1, 2, 4, 1, 8, 8, 8]

/**
 * Wartość pola liczbowego albo `undefined`, gdy pole niesie wartość „invalid"
 * swojego typu bazowego (np. 0xFF dla uint8, 0 dla uint32z). Tablice czytamy
 * do pierwszego elementu — żadne z potrzebnych pól nie jest tablicą.
 */
function readValue(view: DataView, offset: number, size: number, baseType: number, little: boolean): number | undefined {
  const num = baseType & 0x1f
  const elementSize = BASE_SIZE[num]
  if (elementSize === undefined || size < elementSize) return undefined
  switch (num) {
    case 0x00: // enum
    case 0x02: { // uint8
      const v = view.getUint8(offset)
      return v === 0xff ? undefined : v
    }
    case 0x01: { // sint8
      const v = view.getInt8(offset)
      return v === 0x7f ? undefined : v
    }
    case 0x03: { // sint16
      const v = view.getInt16(offset, little)
      return v === 0x7fff ? undefined : v
    }
    case 0x04: { // uint16
      const v = view.getUint16(offset, little)
      return v === 0xffff ? undefined : v
    }
    case 0x05: { // sint32
      const v = view.getInt32(offset, little)
      return v === 0x7fffffff ? undefined : v
    }
    case 0x06: { // uint32
      const v = view.getUint32(offset, little)
      return v === 0xffffffff ? undefined : v
    }
    case 0x08: { // float32
      if (view.getUint32(offset, little) === 0xffffffff) return undefined
      const v = view.getFloat32(offset, little)
      return Number.isFinite(v) ? v : undefined
    }
    case 0x09: { // float64
      if (view.getBigUint64(offset, little) === 0xffffffffffffffffn) return undefined
      const v = view.getFloat64(offset, little)
      return Number.isFinite(v) ? v : undefined
    }
    case 0x0a: { // uint8z
      const v = view.getUint8(offset)
      return v === 0 ? undefined : v
    }
    case 0x0b: { // uint16z
      const v = view.getUint16(offset, little)
      return v === 0 ? undefined : v
    }
    case 0x0c: { // uint32z
      const v = view.getUint32(offset, little)
      return v === 0 ? undefined : v
    }
    case 0x0e: { // sint64
      const v = view.getBigInt64(offset, little)
      return v === 0x7fffffffffffffffn ? undefined : Number(v)
    }
    case 0x0f: { // uint64
      const v = view.getBigUint64(offset, little)
      return v === 0xffffffffffffffffn ? undefined : Number(v)
    }
    case 0x10: { // uint64z
      const v = view.getBigUint64(offset, little)
      return v === 0n ? undefined : Number(v)
    }
    default: // 0x07 string, 0x0d byte — niepotrzebne do porównania z planem
      return undefined
  }
}

// ---------------------------------------------------------------- rekordy

interface FieldDef {
  num: number
  size: number
  baseType: number
}

interface Definition {
  global: number
  little: boolean
  fields: FieldDef[]
  /** Łączny rozmiar pól deweloperskich — pomijamy je w całości. */
  devSize: number
}

/** Numer pola → wartość (tylko pola liczbowe z poprawną wartością). */
export type FitFields = Map<number, number>

const TIMESTAMP_FIELD = 253

/**
 * Przejście po wszystkich komunikatach danych pliku FIT.
 * Rzuca błąd przy uszkodzonym pliku (sygnatura, długość, CRC, brak definicji).
 */
export function readFitMessages(bytes: Uint8Array, onMessage: (global: number, fields: FitFields) => void): void {
  if (bytes.length < 12) throw new Error('FIT: file shorter than the header')
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const headerSize = bytes[0]!
  if (headerSize < 12 || headerSize > bytes.length) throw new Error('FIT: bad header size')
  if (String.fromCharCode(bytes[8]!, bytes[9]!, bytes[10]!, bytes[11]!) !== '.FIT') {
    throw new Error('FIT: missing .FIT signature')
  }
  const dataSize = view.getUint32(4, true)
  if (headerSize >= 14) {
    // CRC nagłówka 0x0000 jest dozwolone (FIT Protocol: „opcjonalne") — nie odrzucamy.
    const headerCrc = view.getUint16(12, true)
    if (headerCrc !== 0 && headerCrc !== fitCrc(bytes, 0, 12)) throw new Error('FIT: bad header CRC')
  }
  const end = headerSize + dataSize
  if (end > bytes.length) throw new Error('FIT: truncated file')
  // CRC pliku liczone od pierwszego bajtu nagłówka do końca danych.
  if (bytes.length >= end + 2 && view.getUint16(end, true) !== fitCrc(bytes, 0, end)) {
    throw new Error('FIT: bad file CRC')
  }

  const defs: (Definition | undefined)[] = []
  let lastTimestamp: number | undefined
  let pos = headerSize
  const need = (n: number): void => {
    if (pos + n > end) throw new Error('FIT: record crosses the end of data')
  }

  const readData = (def: Definition): FitFields => {
    const fields: FitFields = new Map()
    for (const f of def.fields) {
      need(f.size)
      const value = readValue(view, pos, f.size, f.baseType, def.little)
      if (value !== undefined) fields.set(f.num, value)
      pos += f.size
    }
    need(def.devSize)
    pos += def.devSize
    return fields
  }

  while (pos < end) {
    const header = bytes[pos]!
    pos += 1
    if (header & 0x80) {
      // Nagłówek ze skompresowanym czasem: typ lokalny 0–3, 5 bitów przesunięcia
      // względem ostatniego pełnego znacznika czasu (z przeniesieniem co 32 s).
      const def = defs[(header >> 5) & 0x03]
      if (!def) throw new Error('FIT: data record without a definition')
      if (lastTimestamp === undefined) throw new Error('FIT: compressed timestamp without a reference')
      const offset = header & 0x1f
      const low = lastTimestamp % 32
      let timestamp = lastTimestamp - low + offset
      if (offset < low) timestamp += 32
      lastTimestamp = timestamp
      const fields = readData(def)
      if (!fields.has(TIMESTAMP_FIELD)) fields.set(TIMESTAMP_FIELD, timestamp)
      onMessage(def.global, fields)
    } else if (header & 0x40) {
      // Rekord definicji: rezerwa, architektura, numer globalny, pola, [pola deweloperskie].
      need(5)
      const arch = bytes[pos + 1]!
      if (arch !== 0 && arch !== 1) throw new Error('FIT: unknown architecture')
      const little = arch === 0
      const global = view.getUint16(pos + 2, little)
      const count = bytes[pos + 4]!
      pos += 5
      need(count * 3)
      const fields: FieldDef[] = []
      for (let i = 0; i < count; i++) {
        fields.push({ num: bytes[pos]!, size: bytes[pos + 1]!, baseType: bytes[pos + 2]! })
        pos += 3
      }
      let devSize = 0
      if (header & 0x20) {
        need(1)
        const devCount = bytes[pos]!
        pos += 1
        need(devCount * 3)
        for (let i = 0; i < devCount; i++) {
          devSize += bytes[pos + 1]! // numer pola, ROZMIAR, indeks dewelopera
          pos += 3
        }
      }
      defs[header & 0x0f] = { global, little, fields, devSize }
    } else {
      const def = defs[header & 0x0f]
      if (!def) throw new Error('FIT: data record without a definition')
      const fields = readData(def)
      const timestamp = fields.get(TIMESTAMP_FIELD)
      if (timestamp !== undefined) lastTimestamp = timestamp
      onMessage(def.global, fields)
    }
  }
}

// ---------------------------------------------------------------- aktywność

const MESG_FILE_ID = 0
const MESG_SPORT = 12
const MESG_SESSION = 18
const MESG_RECORD = 20
const MESG_ACTIVITY = 34
/** file_id.type: 4 = activity (Profile, typ `file`). */
const FILE_TYPE_ACTIVITY = 4

/**
 * Sport FIT → typ w nazewnictwie intervals.icu/Stravy (Profile: `sport`, `sub_sport`).
 * sport: 1 running, 2 cycling, 4 fitness_equipment, 5 swimming, 10 training,
 * 11 walking, 17 hiking. sub_sport: 1 treadmill, 3 trail, 20 strength_training,
 * 45 indoor_running, 58 virtual_activity.
 */
export function fitSportType(sport: number | undefined, subSport: number | undefined): ActivityType | undefined {
  if (sport === undefined) return undefined
  switch (sport) {
    case 1:
      if (subSport === 3) return 'TrailRun'
      if (subSport === 1 || subSport === 45 || subSport === 58) return 'VirtualRun'
      return 'Run'
    case 2:
      return 'Ride'
    case 5:
      return 'Swim'
    case 11:
      return 'Walk'
    case 17:
      return 'Hike'
    case 4:
    case 10:
      return subSport === 20 ? 'WeightTraining' : 'Other'
    default:
      return 'Other'
  }
}

const fitTimeToMs = (t: number): number => (t + FIT_EPOCH_OFFSET_SEC) * 1000

/**
 * Najszersza strefa czasowa na świecie to UTC−12…UTC+14. Przesunięcie spoza
 * tego zakresu oznacza uszkodzony `local_timestamp` — wtedy strefa maszyny.
 */
const MAX_UTC_OFFSET_SEC = 14 * 3600

interface RecordSample {
  t?: number
  d?: number
  hr?: number
  alt?: number
}

const scaled = (v: number | undefined, scale: number, offset = 0): number | undefined =>
  v === undefined ? undefined : v / scale - offset

/** Sesja FIT → część aktywności. Bez czasu startu sesja jest bezużyteczna. */
function sessionPart(f: FitFields, fallbackType: ActivityType | undefined): ActivityPart | undefined {
  const elapsed = scaled(f.get(7), 1000) // total_elapsed_time [s], skala 1000
  const timer = scaled(f.get(8), 1000) // total_timer_time [s], skala 1000
  const distance = scaled(f.get(9), 100) // total_distance [m], skala 100
  const startTime = f.get(2) ?? (f.has(TIMESTAMP_FIELD) && elapsed !== undefined ? f.get(TIMESTAMP_FIELD)! - elapsed : undefined)
  if (startTime === undefined) return undefined
  const part: ActivityPart = {
    startMs: fitTimeToMs(startTime),
    type: fitSportType(f.get(5), f.get(6)) ?? fallbackType ?? 'Other',
  }
  if (distance !== undefined) part.distanceM = distance
  if (timer !== undefined) part.movingTimeSec = timer
  if (elapsed !== undefined) part.elapsedTimeSec = elapsed
  const hr = f.get(16) // avg_heart_rate [bpm]
  if (hr !== undefined) part.avgHr = hr
  const ascent = f.get(22) // total_ascent [m]
  if (ascent !== undefined) part.elevationGainM = ascent
  return part
}

/** Plik bez `session` (przerwany zapis, część eksporterów): suma z punktów `record`. */
function recordsPart(records: RecordSample[], sportType: ActivityType | undefined): ActivityPart | undefined {
  const timed = records.filter((r): r is RecordSample & { t: number } => r.t !== undefined)
  const first = timed[0]
  const last = timed[timed.length - 1]
  if (!first || !last) return undefined
  const samples: MotionSample[] = timed
    .filter((r): r is RecordSample & { t: number; d: number } => r.d !== undefined)
    .map((r) => ({ t: r.t, d: r.d }))
  const distance = samples.length ? samples[samples.length - 1]!.d : undefined
  const moving = samples.length >= 2 ? movingTimeSec(samples) : undefined
  const part: ActivityPart = {
    startMs: fitTimeToMs(first.t),
    type: sportType ?? classifyByPace(distance, moving),
    elapsedTimeSec: last.t - first.t,
  }
  if (distance !== undefined) part.distanceM = distance
  if (moving !== undefined) part.movingTimeSec = moving
  // Średnia z próbek, nie ważona czasem — zapis „smart" bywa nierówny, ale
  // to ścieżka awaryjna; plik z sesją niesie średnią policzoną przez zegarek.
  const hrs = records.map((r) => r.hr).filter((v): v is number => v !== undefined)
  if (hrs.length) part.avgHr = hrs.reduce((a, b) => a + b, 0) / hrs.length
  const gain = elevationGainM(records.map((r) => r.alt).filter((v): v is number => v !== undefined))
  if (gain !== undefined) part.elevationGainM = gain
  return part
}

/**
 * Bajty pliku FIT → aktywność. `undefined`, gdy plik jest poprawny, ale nie jest
 * aktywnością (np. trening, kurs, ustawienia) albo nie niesie żadnych danych.
 * Rzuca błąd, gdy plik jest uszkodzony (zła sygnatura, długość, CRC).
 */
export function parseFitActivity(bytes: Uint8Array): ParsedActivity | undefined {
  let fileType: number | undefined
  const sessions: FitFields[] = []
  const records: RecordSample[] = []
  let activity: FitFields | undefined
  let sport: FitFields | undefined

  readFitMessages(bytes, (global, f) => {
    switch (global) {
      case MESG_FILE_ID:
        fileType ??= f.get(0)
        break
      case MESG_SESSION:
        sessions.push(f)
        break
      case MESG_ACTIVITY:
        activity = f
        break
      case MESG_SPORT:
        sport ??= f
        break
      case MESG_RECORD: {
        const sample: RecordSample = {}
        const t = f.get(TIMESTAMP_FIELD)
        const d = scaled(f.get(5), 100) // distance [m], skala 100
        const hr = f.get(3) // heart_rate [bpm]
        // enhanced_altitude (78) ma pierwszeństwo przed altitude (2); obie: skala 5, offset 500 m.
        const alt = scaled(f.get(78) ?? f.get(2), 5, 500)
        if (t !== undefined) sample.t = t
        if (d !== undefined) sample.d = d
        if (hr !== undefined) sample.hr = hr
        if (alt !== undefined) sample.alt = alt
        records.push(sample)
        break
      }
    }
  })

  if (fileType !== FILE_TYPE_ACTIVITY) return undefined
  const sportType = sport ? fitSportType(sport.get(0), sport.get(1)) : undefined
  const parts = sessions
    .map((s) => sessionPart(s, sportType))
    .filter((p): p is ActivityPart => p !== undefined)
  const part = parts.length ? combineParts(parts) : recordsPart(records, sportType)
  if (!part) return undefined

  const ts = activity?.get(TIMESTAMP_FIELD)
  const localTs = activity?.get(5) // local_timestamp
  const offset = ts !== undefined && localTs !== undefined ? localTs - ts : undefined
  const date =
    offset !== undefined && Math.abs(offset) <= MAX_UTC_OFFSET_SEC
      ? dateWithOffset(part.startMs, offset)
      : localDateFromMs(part.startMs)
  return toParsed(part, date)
}
