/**
 * Koder plików FIT z treningiem strukturalnym (Garmin i zgodne).
 *
 * Format binarny: nagłówek 14 B + rekordy (definicje i dane) + CRC-16.
 * Komunikaty: file_id (typ = workout), workout, workout_step.
 * Powtórzenia zapisujemy krokiem `repeat_until_steps_cmplt`, który wskazuje
 * indeks pierwszego kroku pętli i liczbę powtórzeń.
 *
 * Cele tempa: FIT nie zna „tempa" — zna prędkość. Zapisujemy zakres prędkości
 * w mm/s (m/s × 1000), zamieniając s/km na m/s. Szybsze tempo = wyższa prędkość,
 * więc granice zakresu zamieniają się miejscami.
 */
import type { PlannedWorkout, PaceRange } from '@tren/core'

// ---------------------------------------------------------------- prymitywy

const CRC_TABLE = [
  0x0000, 0xcc01, 0xd801, 0x1400, 0xf001, 0x3c00, 0x2800, 0xe401,
  0xa001, 0x6c00, 0x7800, 0xb401, 0x5000, 0x9c01, 0x8801, 0x4400,
]

export function fitCrc(data: Uint8Array, seed = 0): number {
  let crc = seed
  for (const byte of data) {
    let tmp = CRC_TABLE[crc & 0xf]!
    crc = (crc >> 4) & 0x0fff
    crc = crc ^ tmp ^ CRC_TABLE[byte & 0xf]!
    tmp = CRC_TABLE[crc & 0xf]!
    crc = (crc >> 4) & 0x0fff
    crc = crc ^ tmp ^ CRC_TABLE[(byte >> 4) & 0xf]!
  }
  return crc & 0xffff
}

/** Typy bazowe FIT (numer + rozmiar w bajtach). */
const T = {
  enum: { id: 0x00, size: 1 },
  uint8: { id: 0x02, size: 1 },
  uint16: { id: 0x84, size: 2 },
  uint32: { id: 0x86, size: 4 },
  uint32z: { id: 0x8c, size: 4 },
  string: { id: 0x07, size: 0 },
} as const

type FieldType = keyof typeof T

interface FieldDef {
  num: number
  type: FieldType
  size?: number
}

interface Message {
  globalNum: number
  localNum: number
  fields: FieldDef[]
  values: (number | string)[]
}

class ByteWriter {
  private bytes: number[] = []
  u8(v: number) { this.bytes.push(v & 0xff) }
  u16(v: number) { this.u8(v); this.u8(v >> 8) }
  u32(v: number) { this.u16(v); this.u16(v >> 16) }
  str(v: string, size: number) {
    const encoded = new TextEncoder().encode(v)
    for (let i = 0; i < size; i++) this.u8(i < encoded.length ? encoded[i]! : 0)
  }
  raw(): Uint8Array { return Uint8Array.from(this.bytes) }
  get length() { return this.bytes.length }
}

function writeDefinition(w: ByteWriter, msg: Message): void {
  w.u8(0x40 | msg.localNum) // rekord definicji
  w.u8(0) // rezerwa
  w.u8(0) // architektura: little-endian
  w.u16(msg.globalNum)
  w.u8(msg.fields.length)
  for (const f of msg.fields) {
    w.u8(f.num)
    w.u8(f.size ?? T[f.type].size)
    w.u8(T[f.type].id)
  }
}

function writeData(w: ByteWriter, msg: Message): void {
  w.u8(msg.localNum)
  msg.fields.forEach((f, i) => {
    const value = msg.values[i]
    switch (f.type) {
      case 'enum':
      case 'uint8':
        w.u8(Number(value))
        break
      case 'uint16':
        w.u16(Number(value))
        break
      case 'uint32':
      case 'uint32z':
        w.u32(Number(value))
        break
      case 'string':
        w.str(String(value), f.size ?? 1)
        break
    }
  })
}

// -------------------------------------------------------- model kroków FIT

/** intensity: 0 active, 1 rest, 2 warmup, 3 cooldown. */
type Intensity = 0 | 1 | 2 | 3

interface FitStep {
  name: string
  /** 0 = czas (ms), 1 = dystans (cm), 6 = repeat_until_steps_cmplt. */
  durationType: 0 | 1 | 6
  durationValue: number
  /** 0 = prędkość, 2 = brak celu (open). */
  targetType: 0 | 2
  targetValue: number
  low: number
  high: number
  intensity: Intensity
}

const FIT_EPOCH_OFFSET = 631065600 // 1989-12-31T00:00:00Z w sekundach uniksowych

export function paceToSpeedRange(pace: PaceRange): { low: number; high: number } {
  // s/km → mm/s; szybsze tempo (mniej sekund) = większa prędkość
  const toMmPerSec = (secPerKm: number) => Math.round((1000 / secPerKm) * 1000)
  const fast = toMmPerSec(pace.loSecPerKm)
  const slow = toMmPerSec(pace.hiSecPerKm)
  if (fast === slow) {
    // pojedyncza wartość — zegarek potrzebuje zakresu, dajemy ±3%
    return { low: Math.round(slow * 0.97), high: Math.round(fast * 1.03) }
  }
  return { low: Math.min(fast, slow), high: Math.max(fast, slow) }
}

const RECOVERY_PACE: PaceRange = { loSecPerKm: 360, hiSecPerKm: 420 }

/** Rozwinięcie naszego treningu na płaską listę kroków FIT (z pętlami). */
export function toFitSteps(workout: PlannedWorkout): FitStep[] {
  const steps: FitStep[] = []
  const distanceStep = (
    name: string,
    km: number,
    pace: PaceRange | undefined,
    intensity: Intensity,
  ): FitStep => {
    const range = pace ? paceToSpeedRange(pace) : undefined
    return {
      name,
      durationType: 1,
      durationValue: Math.round(km * 1000 * 100), // cm
      targetType: range ? 0 : 2,
      targetValue: 0,
      low: range?.low ?? 0,
      high: range?.high ?? 0,
      intensity,
    }
  }
  const timeStep = (name: string, sec: number, pace: PaceRange | undefined, intensity: Intensity): FitStep => {
    const range = pace ? paceToSpeedRange(pace) : undefined
    return {
      name,
      durationType: 0,
      durationValue: Math.round(sec * 1000), // ms
      targetType: range ? 0 : 2,
      targetValue: 0,
      low: range?.low ?? 0,
      high: range?.high ?? 0,
      intensity,
    }
  }

  for (const seg of workout.segments) {
    switch (seg.type) {
      case 'warmup':
        steps.push(distanceStep('Rozgrzewka', seg.distanceKm ?? 2, seg.pace, 2))
        break
      case 'cooldown':
        steps.push(distanceStep('Trucht', seg.distanceKm ?? 1, RECOVERY_PACE, 3))
        break
      case 'intervals':
      case 'hills': {
        const reps = seg.reps ?? 1
        const loopStart = steps.length
        const isHills = seg.type === 'hills'
        if (seg.repM) {
          steps.push(
            distanceStep(isHills ? 'Podbieg' : 'Odcinek', seg.repM / 1000, isHills ? undefined : seg.pace, 0),
          )
        } else {
          steps.push(timeStep('Odcinek', 180, seg.pace, 0))
        }
        if (seg.recoverySec) {
          steps.push(timeStep('Przerwa', seg.recoverySec, RECOVERY_PACE, 1))
        } else if (isHills) {
          steps.push(distanceStep('Zbieg', (seg.repM ?? 200) / 1000, undefined, 1))
        }
        if (reps > 1) {
          steps.push({
            name: `Powtórz ${reps}x`,
            durationType: 6,
            durationValue: loopStart,
            targetType: 2,
            targetValue: reps,
            low: 0,
            high: 0,
            intensity: 0,
          })
        }
        break
      }
      case 'alternating': {
        const total = Math.round(seg.distanceKm ?? 0)
        const pairs = Math.floor(total / 2)
        if (pairs < 1 || !seg.pace) {
          steps.push(distanceStep('Bieg zmienny', total, seg.pace, 0))
          break
        }
        const loopStart = steps.length
        const fast: PaceRange = { loSecPerKm: seg.pace.loSecPerKm, hiSecPerKm: seg.pace.loSecPerKm }
        const slow: PaceRange = { loSecPerKm: seg.pace.hiSecPerKm, hiSecPerKm: seg.pace.hiSecPerKm }
        steps.push(distanceStep('Szybciej', 1, fast, 0))
        steps.push(distanceStep('Wolniej', 1, slow, 1))
        steps.push({
          name: `Powtórz ${pairs}x`,
          durationType: 6,
          durationValue: loopStart,
          targetType: 2,
          targetValue: pairs,
          low: 0,
          high: 0,
          intensity: 0,
        })
        break
      }
      case 'progression': {
        const total = seg.distanceKm ?? 0
        if (!seg.pace || total < 3) {
          steps.push(distanceStep('Tempo narastające', total, seg.pace, 0))
          break
        }
        const third = Math.round((total / 3) * 10) / 10
        const from = seg.pace.hiSecPerKm
        const to = seg.pace.loSecPerKm
        for (let i = 0; i < 3; i++) {
          const v = Math.round(from + ((to - from) * i) / 2)
          steps.push(distanceStep(`Narastająco ${i + 1}/3`, third, { loSecPerKm: v, hiSecPerKm: v }, 0))
        }
        break
      }
      case 'easy':
      case 'steady':
        steps.push(distanceStep(seg.type === 'easy' ? 'Spokojnie' : 'Tempo', seg.distanceKm ?? 0, seg.pace, 0))
        break
      case 'race':
        // Sprawdzian: krok na dystans BEZ celu tempa (ADR-020) — zegarek ma mierzyć,
        // nie pilnować tempa. Sam start nie ma dystansu w planie i nie daje kroku.
        if (seg.distanceKm) steps.push(distanceStep('Na czas', seg.distanceKm, undefined, 0))
        break
    }
  }
  return steps
}

const NAME_SIZE = 32
const STEP_NAME_SIZE = 24

/** Trening → bajty pliku .fit. */
export function encodeWorkoutFit(
  workout: PlannedWorkout,
  name: string,
  opts: { createdAtSec?: number } = {},
): Uint8Array {
  const steps = toFitSteps(workout)
  const body = new ByteWriter()

  const fileId: Message = {
    globalNum: 0,
    localNum: 0,
    fields: [
      { num: 0, type: 'enum' }, // type = 5 (workout)
      { num: 1, type: 'uint16' }, // manufacturer
      { num: 2, type: 'uint16' }, // product
      { num: 3, type: 'uint32z' }, // serial
      { num: 4, type: 'uint32' }, // time_created
    ],
    values: [
      5,
      255, // development
      0,
      0,
      Math.max(0, Math.round((opts.createdAtSec ?? 0) - FIT_EPOCH_OFFSET)),
    ],
  }
  writeDefinition(body, fileId)
  writeData(body, fileId)

  const workoutMsg: Message = {
    globalNum: 26,
    localNum: 1,
    fields: [
      { num: 4, type: 'enum' }, // sport = 1 (running)
      { num: 5, type: 'uint32z' }, // capabilities
      { num: 6, type: 'uint16' }, // num_valid_steps
      { num: 8, type: 'string', size: NAME_SIZE }, // wkt_name
    ],
    values: [1, 0, steps.length, name.slice(0, NAME_SIZE - 1)],
  }
  writeDefinition(body, workoutMsg)
  writeData(body, workoutMsg)

  const stepFields: FieldDef[] = [
    { num: 254, type: 'uint16' }, // message_index
    { num: 0, type: 'string', size: STEP_NAME_SIZE }, // wkt_step_name
    { num: 1, type: 'enum' }, // duration_type
    { num: 2, type: 'uint32' }, // duration_value
    { num: 3, type: 'enum' }, // target_type
    { num: 4, type: 'uint32' }, // target_value
    { num: 5, type: 'uint32' }, // custom_target_value_low
    { num: 6, type: 'uint32' }, // custom_target_value_high
    { num: 7, type: 'enum' }, // intensity
  ]
  let defined = false
  steps.forEach((step, index) => {
    const msg: Message = {
      globalNum: 27,
      localNum: 2,
      fields: stepFields,
      values: [
        index,
        step.name.slice(0, STEP_NAME_SIZE - 1),
        step.durationType,
        step.durationValue,
        step.targetType,
        step.targetValue,
        step.low,
        step.high,
        step.intensity,
      ],
    }
    if (!defined) {
      writeDefinition(body, msg)
      defined = true
    }
    writeData(body, msg)
  })

  const data = body.raw()
  const header = new ByteWriter()
  header.u8(14)
  header.u8(0x20) // protokół 2.0
  header.u16(2100) // profil
  header.u32(data.length)
  header.str('.FIT', 4)
  const headerNoCrc = header.raw()
  const headerCrc = fitCrc(headerNoCrc)
  const full = new ByteWriter()
  for (const b of headerNoCrc) full.u8(b)
  full.u16(headerCrc)
  for (const b of data) full.u8(b)
  const withoutFileCrc = full.raw()
  const fileCrc = fitCrc(withoutFileCrc)
  const out = new ByteWriter()
  for (const b of withoutFileCrc) out.u8(b)
  out.u16(fileCrc)
  return out.raw()
}
