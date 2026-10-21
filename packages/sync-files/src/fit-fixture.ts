/**
 * Testowy koder plików FIT — WYŁĄCZNIE do syntetycznych fixture'ów (żadnych
 * realnych aktywności w repo). Poza buildem i paczką: tsconfig.build.json
 * i `files` w package.json go wykluczają.
 *
 * Celowo niezależny od dekodera: CRC liczone bitowo (CRC-16/ARC — wielomian
 * 0xA001 w odwróconej postaci, start 0), a nie tablicą po półbajtach jak
 * w `fit.ts`, żeby test nie potwierdzał błędu tym samym kodem.
 */

const FIT_EPOCH_OFFSET_SEC = 631065600

export const BASE = {
  enum: 0x00,
  sint8: 0x01,
  uint8: 0x02,
  sint16: 0x83,
  uint16: 0x84,
  sint32: 0x85,
  uint32: 0x86,
  string: 0x07,
  uint32z: 0x8c,
} as const

export type BaseName = keyof typeof BASE

const SIZE: Record<BaseName, number> = {
  enum: 1,
  sint8: 1,
  uint8: 1,
  sint16: 2,
  uint16: 2,
  sint32: 4,
  uint32: 4,
  string: 1,
  uint32z: 4,
}

/** Wartość „invalid" — wpisywana, gdy test poda `undefined`. */
const INVALID: Record<BaseName, number> = {
  enum: 0xff,
  sint8: 0x7f,
  uint8: 0xff,
  sint16: 0x7fff,
  uint16: 0xffff,
  sint32: 0x7fffffff,
  uint32: 0xffffffff,
  string: 0,
  uint32z: 0,
}

export interface FieldSpec {
  num: number
  type: BaseName
  /** Rozmiar w bajtach (domyślnie rozmiar typu; większy = tablica). */
  size?: number
}

export interface DevFieldSpec {
  num: number
  size: number
  devIndex: number
}

interface Def {
  fields: FieldSpec[]
  bigEndian: boolean
  devSize: number
}

export function crc16Arc(bytes: ArrayLike<number>): number {
  let crc = 0
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i]!
    for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? (crc >>> 1) ^ 0xa001 : crc >>> 1
  }
  return crc
}

/** ISO 8601 (UTC) → sekundy od epoki FIT. */
export const fitTime = (iso: string): number => Date.parse(iso) / 1000 - FIT_EPOCH_OFFSET_SEC

export class FitBuilder {
  private readonly body: number[] = []
  private readonly defs = new Map<number, Def>()

  private int(value: number, size: number, bigEndian: boolean): void {
    const bytes: number[] = []
    let v = BigInt.asUintN(size * 8, BigInt(Math.trunc(value)))
    for (let i = 0; i < size; i++) {
      bytes.push(Number(v & 0xffn))
      v >>= 8n
    }
    this.body.push(...(bigEndian ? bytes.reverse() : bytes))
  }

  define(
    local: number,
    global: number,
    fields: FieldSpec[],
    opts: { bigEndian?: boolean; devFields?: DevFieldSpec[] } = {},
  ): this {
    const bigEndian = opts.bigEndian ?? false
    const dev = opts.devFields ?? []
    this.body.push(0x40 | (dev.length ? 0x20 : 0) | local, 0, bigEndian ? 1 : 0)
    this.int(global, 2, bigEndian)
    this.body.push(fields.length)
    for (const f of fields) this.body.push(f.num, f.size ?? SIZE[f.type], BASE[f.type])
    if (dev.length) {
      this.body.push(dev.length)
      for (const d of dev) this.body.push(d.num, d.size, d.devIndex)
    }
    this.defs.set(local, { fields, bigEndian, devSize: dev.reduce((a, d) => a + d.size, 0) })
    return this
  }

  private values(local: number, values: (number | undefined)[], devBytes?: number[]): void {
    const def = this.defs.get(local)
    if (!def) throw new Error(`fixture: no definition for local ${local}`)
    def.fields.forEach((f, i) => {
      const size = f.size ?? SIZE[f.type]
      const value = values[i] ?? INVALID[f.type]
      const element = SIZE[f.type]
      // Tablica: pierwszy element z wartością, reszta „invalid".
      this.int(value, element, def.bigEndian)
      for (let at = element; at < size; at += element) this.int(INVALID[f.type], element, def.bigEndian)
    })
    const dev = devBytes ?? new Array<number>(def.devSize).fill(0)
    if (dev.length !== def.devSize) throw new Error('fixture: developer bytes do not match the definition')
    this.body.push(...dev)
  }

  data(local: number, values: (number | undefined)[], devBytes?: number[]): this {
    this.body.push(local & 0x0f)
    this.values(local, values, devBytes)
    return this
  }

  /** Rekord ze skompresowanym czasem: typ lokalny 0–3, przesunięcie 0–31. */
  compressed(local: number, offset: number, values: (number | undefined)[]): this {
    this.body.push(0x80 | ((local & 0x03) << 5) | (offset & 0x1f))
    this.values(local, values)
    return this
  }

  /** Surowe bajty — do składania celowo uszkodzonych plików. */
  raw(...bytes: number[]): this {
    this.body.push(...bytes)
    return this
  }

  build(
    opts: { headerSize?: 12 | 14; headerCrc?: 'valid' | 'zero' | 'corrupt'; fileCrc?: 'valid' | 'corrupt' | 'omit' } = {},
  ): Uint8Array {
    const headerSize = opts.headerSize ?? 14
    const header: number[] = [headerSize, 0x20]
    header.push(2132 & 0xff, 2132 >> 8) // wersja profilu (dowolna — dekoder jej nie sprawdza)
    const n = this.body.length
    header.push(n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff)
    header.push(...[...'.FIT'].map((c) => c.charCodeAt(0)))
    if (headerSize === 14) {
      const mode = opts.headerCrc ?? 'valid'
      const crc = mode === 'zero' ? 0 : crc16Arc(header) ^ (mode === 'corrupt' ? 0x5555 : 0)
      header.push(crc & 0xff, crc >> 8)
    }
    const file = [...header, ...this.body]
    const mode = opts.fileCrc ?? 'valid'
    if (mode !== 'omit') {
      const crc = crc16Arc(file) ^ (mode === 'corrupt' ? 0x0101 : 0)
      file.push(crc & 0xff, crc >> 8)
    }
    return Uint8Array.from(file)
  }
}

// ------------------------------------------------- typowy plik aktywności

export interface SessionSpec {
  start: string
  sport: number
  subSport?: number
  elapsedSec?: number
  timerSec?: number
  distanceM?: number
  avgHr?: number
  ascentM?: number
}

export interface ActivitySpec {
  /** file_id.type; 4 = activity (domyślnie). */
  fileType?: number
  sessions: SessionSpec[]
  /** Przesunięcie strefy w komunikacie `activity`; `undefined` = brak komunikatu. */
  utcOffsetSec?: number
  bigEndian?: boolean
  /** Pola deweloperskie w definicji sesji (rozmiary w bajtach). */
  devFieldSizes?: number[]
}

export const FILE_ID_FIELDS: FieldSpec[] = [
  { num: 0, type: 'enum' }, // type
  { num: 1, type: 'uint16' }, // manufacturer
  { num: 2, type: 'uint16' }, // product
  { num: 3, type: 'uint32z' }, // serial_number
  { num: 4, type: 'uint32' }, // time_created
]

export const SESSION_FIELDS: FieldSpec[] = [
  { num: 253, type: 'uint32' }, // timestamp
  { num: 2, type: 'uint32' }, // start_time
  { num: 5, type: 'enum' }, // sport
  { num: 6, type: 'enum' }, // sub_sport
  { num: 7, type: 'uint32' }, // total_elapsed_time (ms)
  { num: 8, type: 'uint32' }, // total_timer_time (ms)
  { num: 9, type: 'uint32' }, // total_distance (cm)
  { num: 16, type: 'uint8' }, // avg_heart_rate
  { num: 22, type: 'uint16' }, // total_ascent
]

export const ACTIVITY_FIELDS: FieldSpec[] = [
  { num: 253, type: 'uint32' }, // timestamp
  { num: 0, type: 'uint32' }, // total_timer_time (ms)
  { num: 1, type: 'uint16' }, // num_sessions
  { num: 5, type: 'uint32' }, // local_timestamp
]

export function fileIdValues(fileType: number, created: number): number[] {
  return [fileType, 255, 0, 12345, created]
}

export function sessionValues(s: SessionSpec): (number | undefined)[] {
  const start = fitTime(s.start)
  const scale = (v: number | undefined, k: number) => (v === undefined ? undefined : Math.round(v * k))
  return [
    start + (s.elapsedSec ?? 0),
    start,
    s.sport,
    s.subSport ?? 0,
    scale(s.elapsedSec, 1000),
    scale(s.timerSec, 1000),
    scale(s.distanceM, 100),
    s.avgHr,
    s.ascentM,
  ]
}

/** Plik aktywności: file_id → sesje → activity (z przesunięciem strefy). */
export function activityFit(spec: ActivitySpec): Uint8Array {
  const bigEndian = spec.bigEndian ?? false
  const first = spec.sessions[0]
  const created = first ? fitTime(first.start) : 0
  const b = new FitBuilder()
    .define(0, 0, FILE_ID_FIELDS, { bigEndian })
    .data(0, fileIdValues(spec.fileType ?? 4, created))
  const devFields = (spec.devFieldSizes ?? []).map((size, i) => ({ num: i, size, devIndex: 0 }))
  b.define(1, 18, SESSION_FIELDS, { bigEndian, devFields })
  let end = created
  for (const s of spec.sessions) {
    const devBytes = devFields.length ? devFields.flatMap((d) => new Array<number>(d.size).fill(0xab)) : undefined
    b.data(1, sessionValues(s), devBytes)
    end = Math.max(end, fitTime(s.start) + (s.elapsedSec ?? 0))
  }
  if (spec.utcOffsetSec !== undefined) {
    const timer = spec.sessions.reduce((a, s) => a + (s.timerSec ?? 0), 0)
    b.define(2, 34, ACTIVITY_FIELDS, { bigEndian }).data(2, [
      end,
      Math.round(timer * 1000),
      spec.sessions.length,
      end + spec.utcOffsetSec,
    ])
  }
  return b.build()
}
