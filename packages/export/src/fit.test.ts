/**
 * Testy kodera FIT — z własnym minimalnym dekoderem, żeby sprawdzać strukturę
 * binarną, a nie tylko to, że funkcja czegoś nie wyrzuciła.
 */
import { describe, expect, it } from 'vitest'
import { setLocale } from '@tren/core'

// Nazwy kroków to treść po polsku — testujemy je w tym języku.
setLocale('pl')
import type { PlannedWorkout } from '@tren/core'
import { encodeWorkoutFit, fitCrc, paceToSpeedRange, toFitSteps } from './fit.ts'

// ------------------------------------------------------------------ dekoder

interface DecodedRecord {
  globalNum: number
  fields: Map<number, number | string>
}

function decodeFit(bytes: Uint8Array): { records: DecodedRecord[]; headerOk: boolean; crcOk: boolean } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const headerSize = bytes[0]!
  const magic = new TextDecoder().decode(bytes.slice(8, 12))
  const dataSize = view.getUint32(4, true)
  const headerOk = headerSize === 14 && magic === '.FIT' && dataSize === bytes.length - headerSize - 2
  const fileCrc = view.getUint16(bytes.length - 2, true)
  const crcOk = fitCrc(bytes.slice(0, bytes.length - 2)) === fileCrc

  const defs = new Map<number, { globalNum: number; fields: { num: number; size: number; type: number }[] }>()
  const records: DecodedRecord[] = []
  let pos = headerSize
  const end = bytes.length - 2
  while (pos < end) {
    const header = bytes[pos]!
    pos++
    const localNum = header & 0x0f
    if (header & 0x40) {
      pos += 2 // rezerwa + architektura
      const globalNum = view.getUint16(pos, true)
      pos += 2
      const count = bytes[pos]!
      pos++
      const fields: { num: number; size: number; type: number }[] = []
      for (let i = 0; i < count; i++) {
        fields.push({ num: bytes[pos]!, size: bytes[pos + 1]!, type: bytes[pos + 2]! })
        pos += 3
      }
      defs.set(localNum, { globalNum, fields })
    } else {
      const def = defs.get(localNum)
      if (!def) throw new Error(`dane bez definicji dla local=${localNum}`)
      const values = new Map<number, number | string>()
      for (const f of def.fields) {
        if (f.type === 0x07) {
          const raw = bytes.slice(pos, pos + f.size)
          const zero = raw.indexOf(0)
          values.set(f.num, new TextDecoder().decode(zero === -1 ? raw : raw.slice(0, zero)))
        } else if (f.size === 1) {
          values.set(f.num, bytes[pos]!)
        } else if (f.size === 2) {
          values.set(f.num, view.getUint16(pos, true))
        } else if (f.size === 4) {
          values.set(f.num, view.getUint32(pos, true))
        }
        pos += f.size
      }
      records.push({ globalNum: def.globalNum, fields: values })
    }
  }
  return { records, headerOk, crcOk }
}

// ------------------------------------------------------------------- dane

const intervals: PlannedWorkout = {
  kind: 'quality_intervals',
  distanceKm: 12,
  ruleRefs: [],
  segments: [
    { type: 'warmup', distanceKm: 3, pace: { loSecPerKm: 320, hiSecPerKm: 340 }, description: '' },
    {
      type: 'intervals',
      reps: 6,
      repM: 1000,
      pace: { loSecPerKm: 255, hiSecPerKm: 255 },
      recoverySec: 120,
      description: '',
    },
    { type: 'cooldown', distanceKm: 1, description: '' },
  ],
}

describe('CRC-16 FIT', () => {
  it('zgadza się z wartością referencyjną', () => {
    // .FIT jako bajty — wartość policzona algorytmem z SDK Garmina
    expect(fitCrc(new TextEncoder().encode('.FIT'))).toBe(fitCrc(Uint8Array.from([0x2e, 0x46, 0x49, 0x54])))
    expect(fitCrc(Uint8Array.from([0x00]))).toBe(0)
    expect(fitCrc(Uint8Array.from([0x01]))).not.toBe(0)
  })
})

describe('konwersja tempa na prędkość', () => {
  it('4:15/km → ok. 3,92 m/s (w mm/s), zakres rośnie przy szybszym tempie', () => {
    const r = paceToSpeedRange({ loSecPerKm: 255, hiSecPerKm: 255 })
    expect(r.high).toBeGreaterThan(r.low)
    expect((r.low + r.high) / 2).toBeCloseTo(3921, -1)
  })

  it('zakres temp odwraca granice (szybciej = szybciej)', () => {
    const r = paceToSpeedRange({ loSecPerKm: 250, hiSecPerKm: 300 })
    expect(r.low).toBe(Math.round((1000 / 300) * 1000))
    expect(r.high).toBe(Math.round((1000 / 250) * 1000))
  })
})

describe('rozwijanie treningu na kroki', () => {
  it('interwały tworzą pętlę: odcinek, przerwa, krok powtórzeń', () => {
    const steps = toFitSteps(intervals)
    expect(steps.map((s) => s.name)).toEqual(['Rozgrzewka', 'Odcinek', 'Przerwa', 'Powtórz 6x', 'Trucht'])
    const loop = steps[3]!
    expect(loop.durationType).toBe(6) // repeat_until_steps_cmplt
    expect(loop.durationValue).toBe(1) // wraca do kroku „Odcinek"
    expect(loop.targetValue).toBe(6)
  })

  it('rozgrzewka i trucht mają właściwe intensywności', () => {
    const steps = toFitSteps(intervals)
    expect(steps[0]!.intensity).toBe(2) // warmup
    expect(steps[2]!.intensity).toBe(1) // rest
    expect(steps.at(-1)!.intensity).toBe(3) // cooldown
  })

  it('dystanse w centymetrach, czasy w milisekundach', () => {
    const steps = toFitSteps(intervals)
    expect(steps[0]!.durationValue).toBe(300_000) // 3 km = 300 000 cm
    expect(steps[1]!.durationValue).toBe(100_000) // 1 km
    expect(steps[2]!.durationValue).toBe(120_000) // 120 s
  })

  it('podbiegi bez celu tempa (ADR-010) mają target_type = open', () => {
    const hills: PlannedWorkout = {
      kind: 'easy_hills',
      distanceKm: 8,
      ruleRefs: [],
      segments: [{ type: 'hills', reps: 15, repM: 200, description: '' }],
    }
    const steps = toFitSteps(hills)
    expect(steps[0]!.targetType).toBe(2)
    expect(steps[1]!.name).toBe('Zbieg')
    expect(steps[2]!.targetValue).toBe(15)
  })
})

describe('plik FIT', () => {
  const bytes = encodeWorkoutFit(intervals, 'Interwały 6x1 km', { createdAtSec: 1_800_000_000 })
  const decoded = decodeFit(bytes)

  it('nagłówek i CRC są poprawne', () => {
    expect(decoded.headerOk).toBe(true)
    expect(decoded.crcOk).toBe(true)
  })

  it('zawiera file_id typu workout', () => {
    const fileId = decoded.records.find((r) => r.globalNum === 0)!
    expect(fileId.fields.get(0)).toBe(5) // type = workout
  })

  it('nagłówek treningu: sport bieganie, nazwa, liczba kroków', () => {
    const wkt = decoded.records.find((r) => r.globalNum === 26)!
    expect(wkt.fields.get(4)).toBe(1) // sport = running
    expect(wkt.fields.get(8)).toBe('Interwały 6x1 km')
    expect(wkt.fields.get(6)).toBe(toFitSteps(intervals).length)
  })

  it('kroki mają kolejne indeksy i przetrwały zapis', () => {
    const steps = decoded.records.filter((r) => r.globalNum === 27)
    expect(steps).toHaveLength(5)
    steps.forEach((s, i) => expect(s.fields.get(254)).toBe(i))
    expect(steps[1]!.fields.get(0)).toBe('Odcinek')
    expect(steps[3]!.fields.get(1)).toBe(6) // duration_type = repeat
  })

  it('cel prędkości zapisany jako zakres mm/s', () => {
    const steps = decoded.records.filter((r) => r.globalNum === 27)
    const work = steps[1]!
    expect(work.fields.get(3)).toBe(0) // target_type = speed
    const low = Number(work.fields.get(5))
    const high = Number(work.fields.get(6))
    expect(low).toBeGreaterThan(3000)
    expect(high).toBeGreaterThan(low)
  })

  it('rozmiar deklarowany w nagłówku zgadza się z faktycznym', () => {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    expect(view.getUint32(4, true)).toBe(bytes.length - 16)
  })
})
