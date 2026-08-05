import { describe, expect, it } from 'vitest'
import type { RaceResult } from '../domain/types.ts'
import { predictRace, riegelTimeSec } from './predict.ts'

const hm90: RaceResult = { date: '2026-03-30', distanceKm: 21.0975, timeSec: 90 * 60 }
const tenK40: RaceResult = { date: '2026-05-01', distanceKm: 10, timeSec: 40 * 60 }
const fiveK: RaceResult = { date: '2026-06-01', distanceKm: 5, timeSec: 19 * 60 + 30 }

describe('Riegel', () => {
  it('wzór T2 = T1·(D2/D1)^1.06', () => {
    expect(riegelTimeSec(2400, 10, 20)).toBeCloseTo(2400 * Math.pow(2, 1.06), 6)
  })
})

describe('predictRace', () => {
  it('W-1: zawsze przedział lo < mid < hi', () => {
    const p = predictRace([tenK40], 21.0975, { today: '2026-08-05' })
    expect(p.loSec).toBeLessThan(p.midSec)
    expect(p.midSec).toBeLessThan(p.hiSec)
    expect(p.ruleRefs).toContain('W-1')
  })

  it('W-2: maraton z HM przez mnożnik 2,28 z pasmem MAE 5,67%', () => {
    const p = predictRace([hm90, tenK40], 42.195, { today: '2026-08-05' })
    expect(p.method).toBe('hm-multiplier')
    expect(p.midSec).toBe(Math.round(90 * 60 * 2.28)) // 3:25:12
    expect(p.loSec).toBe(Math.round(90 * 60 * 2.28 * (1 - 0.0567)))
    expect(p.ruleRefs).toContain('W-2')
  })

  it('W-4: maraton bez HM → VDOT z ostrzeżeniem', () => {
    const p = predictRace([tenK40], 42.195, { today: '2026-08-05' })
    expect(p.method).toBe('vdot')
    expect(p.warnings.some((w) => w.includes('W-4'))).toBe(true)
  })

  it('W-3: wolny maraton dostaje szerokie pasmo i ostrzeżenie', () => {
    const slow10k: RaceResult = { date: '2026-05-01', distanceKm: 10, timeSec: 65 * 60 }
    const p = predictRace([slow10k], 42.195, { today: '2026-08-05' })
    expect(p.midSec).toBeGreaterThan(4 * 3600)
    expect((p.hiSec - p.loSec) / p.midSec).toBeCloseTo(2 * 0.1043, 2)
    expect(p.warnings.some((w) => w.includes('10,43%'))).toBe(true)
  })

  it('W-7: ultra bez durability → szeroki przedział, nie punkt', () => {
    const p = predictRace([hm90], 100, { today: '2026-08-05' })
    expect(p.method).toBe('riegel-ultra')
    expect(p.hiSec / p.loSec).toBeGreaterThan(1.25)
    expect(p.warnings.some((w) => w.includes('ultra'))).toBe(true)
  })

  it('W-8: durability z historii zawęża przedział ultra', () => {
    const p = predictRace([hm90], 100, { today: '2026-08-05', durabilityFactor: 0.2 })
    expect(p.hiSec / p.loSec).toBeLessThan(1.15)
    const base = riegelTimeSec(hm90.timeSec, hm90.distanceKm, 100)
    expect(p.midSec).toBe(Math.round(base * 1.2))
  })

  it('wybór źródła: najbliższy dystans logarytmicznie', () => {
    const p = predictRace([fiveK, tenK40, hm90], 10, { today: '2026-08-05' })
    expect(p.basedOn).toBe(tenK40)
  })

  it('wyniki starsze niż ~1,5 roku odsuwane na koniec', () => {
    const old10k: RaceResult = { date: '2023-01-01', distanceKm: 10, timeSec: 38 * 60 }
    const p = predictRace([old10k, fiveK], 10, { today: '2026-08-05' })
    expect(p.basedOn).toBe(fiveK)
  })

  it('brak wyników → wyjątek', () => {
    expect(() => predictRace([], 10)).toThrow()
  })
})
