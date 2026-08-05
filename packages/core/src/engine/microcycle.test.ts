import { describe, expect, it } from 'vitest'
import type { AthleteProfile, RaceGoal, WeekSkeleton } from '../domain/types.ts'
import { paceZones } from '../zones/daniels.ts'
import { fmtPace, generateMicrocycle, kmText } from './microcycle.ts'

const zones = paceZones(51)

const athlete: AthleteProfile = {
  recentWeeklyKm: 55,
  daysAvailable: ['tue', 'wed', 'thu', 'sat', 'sun'],
  results: [],
}

function skeleton(over: Partial<WeekSkeleton> = {}): WeekSkeleton {
  return {
    weekStart: '2026-08-03',
    index: 4,
    phase: 'build',
    intensityModel: 'pyramidal',
    targetKm: 60,
    deload: false,
    keepIntensity: false,
    keepFrequency: false,
    qualitySessions: 2,
    flags: [],
    ruleRefs: [],
    ...over,
  }
}

describe('generateMicrocycle — tydzień standardowy (build, 60 km)', () => {
  const mc = generateMicrocycle({ skeleton: skeleton(), athlete, zones })

  it('7 dni, poniedziałek i piątek wolne (house style)', () => {
    expect(mc.days).toHaveLength(7)
    expect(mc.days[0]!.workout).toBeUndefined() // mon
    expect(mc.days[4]!.workout).toBeUndefined() // fri
  })

  it('objętość ±15% celu', () => {
    expect(mc.totalKm).toBeGreaterThan(60 * 0.85)
    expect(mc.totalKm).toBeLessThan(60 * 1.15)
  })

  it('dokładnie 2 akcenty, odstęp ≥48 h (I-7/I-8)', () => {
    const quality = mc.days.filter((d) =>
      d.workout && ['quality_intervals', 'quality_continuous'].includes(d.workout.kind),
    )
    expect(quality).toHaveLength(2)
    const [a, b] = quality
    expect(Math.abs(
      new Date(a!.date).getTime() - new Date(b!.date).getTime(),
    ) / 86_400_000).toBeGreaterThanOrEqual(2)
  })

  it('długie wybieganie w sobotę, ~35% tygodnia, bardzo spokojnie', () => {
    const sat = mc.days[5]!
    expect(sat.workout?.kind).toBe('long')
    expect(sat.workout!.distanceKm).toBeGreaterThanOrEqual(Math.round(0.3 * 60))
    expect(sat.workout!.distanceKm).toBeLessThanOrEqual(35)
    expect(sat.workout!.segments[0]!.description).toContain('bardzo spokojnym')
  })

  it('house signature: akcent = rozgrzewka 3 km + główna + 1 km truchtu', () => {
    const q = mc.days.find((d) => d.workout?.kind === 'quality_intervals')!.workout!
    expect(q.segments[0]!.type).toBe('warmup')
    expect(q.segments[0]!.distanceKm).toBe(3)
    expect(q.segments.at(-1)!.type).toBe('cooldown')
    expect(q.segments.at(-1)!.description).toContain('truchtu')
  })

  it('I-5: udział Z1 ≥ 0,75', () => {
    expect(mc.easyShare).toBeGreaterThanOrEqual(0.75)
  })

  it('piramidalnie: akcenty w tempie progowym (T), nie VO2', () => {
    const q = mc.days.find((d) => d.workout?.kind === 'quality_intervals')!.workout!
    const main = q.segments.find((s) => s.type === 'intervals')!
    const t = zones.threshold
    expect(main.pace!.loSecPerKm).toBeGreaterThanOrEqual(t.loSecPerKm - 1)
    expect(main.pace!.hiSecPerKm).toBeLessThanOrEqual(t.hiSecPerKm + 1)
  })
})

describe('generateMicrocycle — polaryzacja (peak)', () => {
  const mc = generateMicrocycle({
    skeleton: skeleton({ phase: 'peak', intensityModel: 'polarized' }),
    athlete,
    zones,
  })

  it('interwały @I (Z3), bieg zmienny jako drugi akcent (I-2)', () => {
    const qi = mc.days.find((d) => d.workout?.kind === 'quality_intervals')!.workout!
    const main = qi.segments.find((s) => s.type === 'intervals')!
    expect(main.pace!.hiSecPerKm).toBeLessThanOrEqual(zones.interval.hiSecPerKm + 1)
    const qc = mc.days.find((d) => d.workout?.kind === 'quality_continuous')!.workout!
    expect(qc.segments.some((s) => s.type === 'alternating')).toBe(true)
  })
})

describe('generateMicrocycle — tydzień startowy', () => {
  const goal: RaceGoal = {
    date: '2026-08-08', // sobota
    distanceKm: 21.0975,
    name: 'Półmaraton testowy',
    priority: 'A',
  }
  const mc = generateMicrocycle({
    skeleton: skeleton({
      phase: 'race',
      intensityModel: 'polarized',
      targetKm: 25,
      keepIntensity: true,
      keepFrequency: true,
      qualitySessions: 1,
      raceDate: '2026-08-08',
    }),
    athlete,
    zones,
    goal,
  })

  it('start w dniu wyścigu, dzień przed — wolny', () => {
    expect(mc.days[5]!.workout?.kind).toBe('race')
    expect(mc.days[5]!.workout!.segments[0]!.description).toContain('PÓŁMARATON')
    expect(mc.days[4]!.workout).toBeUndefined()
  })

  it('T-1/T-2: przed startem sharpener z intensywnością + krótkie spokojne, bez długiego', () => {
    const kinds = mc.days.map((d) => d.workout?.kind).filter(Boolean)
    expect(kinds).toContain('sharpener')
    expect(kinds).not.toContain('long')
    const easies = mc.days.filter((d) => d.workout?.kind === 'easy')
    for (const e of easies) expect(e.workout!.distanceKm).toBeLessThanOrEqual(6)
  })

  it('po starcie odpoczynek', () => {
    expect(mc.days[6]!.workout).toBeUndefined()
  })
})

describe('generateMicrocycle — przypadki brzegowe', () => {
  it('3 dni dostępne, 1 akcent: struktura się domyka', () => {
    const mc = generateMicrocycle({
      skeleton: skeleton({ qualitySessions: 1, targetKm: 40 }),
      athlete: { ...athlete, daysAvailable: ['tue', 'thu', 'sun'] },
      zones,
    })
    const workouts = mc.days.filter((d) => d.workout)
    expect(workouts.length).toBeLessThanOrEqual(3)
    const quality = workouts.filter((d) =>
      ['quality_intervals', 'quality_continuous'].includes(d.workout!.kind),
    )
    expect(quality).toHaveLength(1)
  })

  it('taper: bez długiego i bez podbiegów, intensywność zostaje', () => {
    const mc = generateMicrocycle({
      skeleton: skeleton({
        phase: 'taper',
        intensityModel: 'polarized',
        targetKm: 35,
        keepIntensity: true,
        keepFrequency: true,
      }),
      athlete,
      zones,
    })
    const kinds = mc.days.map((d) => d.workout?.kind).filter(Boolean)
    expect(kinds).not.toContain('long')
    expect(kinds).not.toContain('easy_hills')
    expect(kinds.some((k) => k === 'quality_intervals' || k === 'quality_continuous')).toBe(true)
  })

  it('fmtPace formatuje sekundy', () => {
    expect(fmtPace(255)).toBe('4:15')
    expect(fmtPace(300)).toBe('5:00')
    expect(fmtPace(329)).toBe('5:29')
  })
})

describe('polska odmiana liczebników', () => {
  it('kilometr / kilometry / kilometrów', () => {
    expect(kmText(1)).toBe('1 kilometr')
    expect(kmText(3)).toBe('3 kilometry')
    expect(kmText(5)).toBe('5 kilometrów')
    expect(kmText(11)).toBe('11 kilometrów')
    expect(kmText(12)).toBe('12 kilometrów')
    expect(kmText(22)).toBe('22 kilometry')
    expect(kmText(23)).toBe('23 kilometry')
    expect(kmText(25)).toBe('25 kilometrów')
  })

  it('opisy jednostek używają poprawnej formy', () => {
    const mc = generateMicrocycle({ skeleton: skeleton({ targetKm: 65 }), athlete, zones })
    const long = mc.days.find((d) => d.workout?.kind === 'long')!.workout!
    expect(long.segments[0]!.description).not.toMatch(/\d+ kilometrów \(w tempie bardzo/)
  })
})
