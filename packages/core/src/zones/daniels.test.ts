import { describe, expect, it } from 'vitest'
import {
  fractionAtDuration,
  paceZones,
  predictTimeSec,
  vdotFromRace,
  velocityAtVo2,
  vo2AtVelocity,
} from './daniels.ts'

describe('równania Danielsa-Gilberta', () => {
  it('kotwica z literatury: 5 km w 19:57 → VDOT ≈ 50', () => {
    const vdot = vdotFromRace(5, 19 * 60 + 57)
    expect(vdot).toBeGreaterThan(49.4)
    expect(vdot).toBeLessThan(50.6)
  })

  it('velocityAtVo2 odwraca vo2AtVelocity', () => {
    for (const v of [150, 200, 250, 300, 350]) {
      expect(velocityAtVo2(vo2AtVelocity(v))).toBeCloseTo(v, 6)
    }
  })

  it('F(t) maleje z czasem trwania wysiłku', () => {
    expect(fractionAtDuration(10)).toBeGreaterThan(fractionAtDuration(30))
    expect(fractionAtDuration(30)).toBeGreaterThan(fractionAtDuration(120))
  })

  it('round-trip: predykcja czasu z VDOT wyliczonego z tego samego dystansu', () => {
    for (const [distanceKm, timeSec] of [
      [5, 1200],
      [10, 2500],
      [21.0975, 5500],
      [42.195, 11400],
    ] as const) {
      const vdot = vdotFromRace(distanceKm, timeSec)
      expect(predictTimeSec(distanceKm, vdot)).toBeCloseTo(timeSec, 0)
    }
  })

  it('szybszy wynik → wyższy VDOT; wyższy VDOT → szybsza predykcja', () => {
    expect(vdotFromRace(10, 2400)).toBeGreaterThan(vdotFromRace(10, 2700))
    expect(predictTimeSec(10, 55)).toBeLessThan(predictTimeSec(10, 50))
  })

  it('ekwiwalencja tabelaryczna: 5 km 19:57 ≈ 10 km 41:21 (ta sama forma)', () => {
    const v5 = vdotFromRace(5, 19 * 60 + 57)
    const v10 = vdotFromRace(10, 41 * 60 + 21)
    expect(Math.abs(v5 - v10)).toBeLessThan(0.7)
  })
})

describe('strefy tempa', () => {
  const zones = paceZones(50)

  it('kotwica: próg (T) przy VDOT 50 w okolicach 4:15–4:20/km', () => {
    const mid = (zones.threshold.loSecPerKm + zones.threshold.hiSecPerKm) / 2
    expect(mid).toBeGreaterThan(248)
    expect(mid).toBeLessThan(268)
  })

  it('porządek stref: R szybsze niż I, I < T, T < M, M < E (w s/km rosnąco)', () => {
    expect(zones.repetition.loSecPerKm).toBeLessThan(zones.interval.loSecPerKm)
    expect(zones.interval.loSecPerKm).toBeLessThan(zones.threshold.loSecPerKm)
    expect(zones.threshold.loSecPerKm).toBeLessThan(zones.marathon.loSecPerKm)
    expect(zones.marathon.loSecPerKm).toBeLessThan(zones.easy.loSecPerKm)
  })

  it('LT1 wolniejsze niż LT2 (Z-1: LT1 < LT2 w prędkości)', () => {
    expect(zones.lt1SecPerKm).toBeGreaterThan(zones.lt2SecPerKm)
  })

  it('zakresy wewnętrznie spójne (lo szybsze niż hi)', () => {
    for (const r of [zones.easy, zones.marathon, zones.threshold, zones.interval, zones.repetition]) {
      expect(r.loSecPerKm).toBeLessThan(r.hiSecPerKm)
    }
  })
})
