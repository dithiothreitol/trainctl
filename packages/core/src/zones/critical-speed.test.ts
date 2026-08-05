import { describe, expect, it } from 'vitest'
import { criticalSpeed, csPredictTimeSec, csToSecPerKm } from './critical-speed.ts'

describe('critical speed', () => {
  // Z-7: protokół 1200 m + 3600 m; przykład: 1200 m w 4:00, 3600 m w 13:30
  const model = criticalSpeed(
    { distanceM: 1200, timeSec: 240 },
    { distanceM: 3600, timeSec: 810 },
  )

  it('CS i D-prime z dokładnej arytmetyki modelu liniowego', () => {
    expect(model.cs).toBeCloseTo(2400 / 570, 6) // ≈ 4.2105 m/s
    expect(model.dPrime).toBeCloseTo(1200 - model.cs * 240, 6)
    expect(model.warnings).toEqual([])
  })

  it('predykcja odtwarza punkty wejściowe', () => {
    expect(csPredictTimeSec(model, 1200)).toBeCloseTo(240, 6)
    expect(csPredictTimeSec(model, 3600)).toBeCloseTo(810, 6)
  })

  it('CS → s/km', () => {
    expect(csToSecPerKm(model.cs)).toBeCloseTo(1000 / (2400 / 570), 6)
  })

  it('kolejność prób bez znaczenia', () => {
    const swapped = criticalSpeed(
      { distanceM: 3600, timeSec: 810 },
      { distanceM: 1200, timeSec: 240 },
    )
    expect(swapped.cs).toBeCloseTo(model.cs, 9)
  })

  it('ostrzeżenia poza zakresem protokołu (Z-7)', () => {
    const short = criticalSpeed(
      { distanceM: 400, timeSec: 70 },
      { distanceM: 3600, timeSec: 810 },
    )
    expect(short.warnings.some((w) => w.includes('<2 min'))).toBe(true)

    const long = criticalSpeed(
      { distanceM: 1200, timeSec: 240 },
      { distanceM: 10000, timeSec: 2500 },
    )
    expect(long.warnings.some((w) => w.includes('>20 min'))).toBe(true)
  })
})
