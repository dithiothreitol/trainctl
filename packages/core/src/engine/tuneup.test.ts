/**
 * Starty kontrolne i sprawdziany (faza 7): T-9…T-12, W-11…W-13.
 * Wzorzec z korpusu: kalibrujemy prawdziwymi startami co ~4 tyg., sprawdzian
 * jest fallbackiem dla pustego kalendarza — nie metodą pierwszego wyboru.
 */
import { describe, expect, it } from 'vitest'
import type { AthleteProfile, RaceGoal } from '../domain/types.ts'
import { paceZones } from '../zones/daniels.ts'
import { planMacrocycle, testDistanceKm } from './macrocycle.ts'
import { generateMicrocycle } from './microcycle.ts'

const TODAY = '2026-08-05'
const zones = paceZones(50)

const base: AthleteProfile = {
  recentWeeklyKm: 50,
  peakWeeklyKm: 80,
  daysAvailable: ['tue', 'wed', 'thu', 'sat', 'sun'],
  results: [{ date: '2026-07-25', distanceKm: 10, timeSec: 2400 }],
}

const marathon: RaceGoal = {
  date: '2026-11-29',
  distanceKm: 42.195,
  name: 'Maraton testowy',
  priority: 'A',
}

const withRaces = (dates: { date: string; priority: 'B' | 'C' }[]): AthleteProfile => ({
  ...base,
  tuneUpRaces: dates.map((d) => ({ ...d, distanceKm: 10, name: 'Bieg kontrolny' })),
})

describe('starty kontrolne w makrocyklu', () => {
  const athlete = withRaces([
    { date: '2026-09-05', priority: 'B' }, // sobota, tydzień 5
    { date: '2026-10-10', priority: 'C' }, // sobota, tydzień 10
  ])
  const plan = planMacrocycle({ today: TODAY, goal: marathon, athlete })
  const weekOf = (date: string) => plan.weeks.find((w) => w.tuneUp?.date === date)

  it('start B/C ląduje w swoim tygodniu i nie zmienia liczby tygodni planu', () => {
    expect(plan.weeks).toHaveLength(17)
    expect(weekOf('2026-09-05')).toBeDefined()
    expect(weekOf('2026-10-10')).toBeDefined()
  })

  it('T-9: start B obniża objętość tygodnia, start C nie', () => {
    // odniesienie: ten sam plan bez startów — porównujemy ten sam indeks tygodnia,
    // bo sąsiedni tydzień może być deloadem i zaciemniałby pomiar
    const reference = planMacrocycle({ today: TODAY, goal: marathon, athlete: base })
    const b = weekOf('2026-09-05')!
    const c = weekOf('2026-10-10')!
    expect(b.targetKm).toBeLessThan(reference.weeks[b.index]!.targetKm)
    expect(b.ruleRefs).toContain('T-9')
    expect(c.targetKm).toBe(reference.weeks[c.index]!.targetKm)
    expect(c.ruleRefs).not.toContain('T-9')
  })

  it('T-9: mini-taper nie cofa progresji — kolejny tydzień wraca do trendu', () => {
    const b = weekOf('2026-09-05')!
    const after = plan.weeks[b.index + 1]!
    expect(after.targetKm).toBeGreaterThan(b.targetKm)
  })

  it('T-12: start jest akcentem tygodnia, nie dodatkiem', () => {
    const b = weekOf('2026-09-05')!
    const normal = plan.weeks[1]!
    expect(b.qualitySessions).toBe(normal.qualitySessions - 1)
  })

  it('startów po dacie celu nie wpinamy', () => {
    const late = planMacrocycle({
      today: TODAY,
      goal: marathon,
      athlete: withRaces([{ date: '2026-12-12', priority: 'B' }]),
    })
    expect(late.weeks.some((w) => w.tuneUp)).toBe(false)
  })
})

describe('tydzień ze startem kontrolnym — mikrocykl', () => {
  const athlete = withRaces([{ date: '2026-09-05', priority: 'B' }])
  const plan = planMacrocycle({ today: TODAY, goal: marathon, athlete })
  const skeleton = plan.weeks.find((w) => w.tuneUp)!
  const week = generateMicrocycle({ skeleton, athlete, zones, goal: marathon })
  const dayOf = (date: string) => week.days.find((d) => d.date === date)!

  it('start stoi w swoim dniu, w house style trenera', () => {
    const race = dayOf('2026-09-05')
    expect(race.workout?.kind).toBe('race')
    expect(race.workout?.segments[0]?.description).toContain('START W BIEG KONTROLNY')
  })

  it('T-10: dzień przed startem jest wolny', () => {
    expect(dayOf('2026-09-04').workout).toBeUndefined()
  })

  it('T-11: długie wybieganie zostaje nazajutrz po starcie', () => {
    const next = dayOf('2026-09-06')
    expect(next.workout?.kind).toBe('long')
  })

  it('I-7: żaden akcent nie sąsiaduje ze startem', () => {
    const quality = week.days.filter(
      (d) => d.workout?.kind === 'quality_intervals' || d.workout?.kind === 'quality_continuous',
    )
    for (const q of quality) {
      expect(Math.abs(Date.parse(q.date) - Date.parse('2026-09-05')) / 86_400_000).toBeGreaterThan(1)
    }
  })

  it('start nie wnosi kilometrów do objętości tygodnia', () => {
    expect(dayOf('2026-09-05').workout?.distanceKm).toBe(0)
  })
})

describe('sprawdzian jako fallback (W-13)', () => {
  it('przy pustym kalendarzu startów plan dostaje sprawdziany', () => {
    const plan = planMacrocycle({ today: TODAY, goal: marathon, athlete: base })
    const tests = plan.weeks.filter((w) => w.testPlanned)
    expect(tests.length).toBeGreaterThanOrEqual(1)
    for (const w of tests) {
      expect(w.phase).not.toBe('taper')
      expect(w.phase).not.toBe('race')
      expect(w.deload).toBe(false)
      expect(w.index).toBeGreaterThanOrEqual(4) // nie na starcie planu
      expect(plan.weeks.length - 1 - w.index).toBeGreaterThanOrEqual(3) // nie pod celem
    }
  })

  it('gdy w kalendarzu SĄ starty, sprawdzianów nie ma wcale', () => {
    const plan = planMacrocycle({
      today: TODAY,
      goal: marathon,
      athlete: withRaces([{ date: '2026-09-05', priority: 'B' }]),
    })
    expect(plan.weeks.some((w) => w.testPlanned)).toBe(false)
  })

  it('odstęp między sprawdzianami co najmniej rytm kalibracji (W-12)', () => {
    const plan = planMacrocycle({ today: TODAY, goal: marathon, athlete: base })
    const idx = plan.weeks.filter((w) => w.testPlanned).map((w) => w.index)
    for (let i = 1; i < idx.length; i++) {
      expect(idx[i]! - idx[i - 1]!).toBeGreaterThanOrEqual(6)
    }
  })

  it('dystans zależy od celu: 3 km dla dychy, 5 km dla HM i maratonu', () => {
    expect(testDistanceKm({ ...marathon, distanceKm: 10 })).toBe(3)
    expect(testDistanceKm({ ...marathon, distanceKm: 21.0975 })).toBe(5)
    expect(testDistanceKm(marathon)).toBe(5)
  })
})

describe('sprawdzian w mikrocyklu', () => {
  const plan = planMacrocycle({ today: TODAY, goal: marathon, athlete: base })
  const skeleton = plan.weeks.find((w) => w.testPlanned)!
  const week = generateMicrocycle({
    skeleton,
    athlete: base,
    zones,
    goal: marathon,
    testDistanceKm: testDistanceKm(marathon),
  })
  const test = week.days.find((d) => d.workout?.kind === 'test')

  it('jednostka istnieje i ma rozgrzewkę oraz część na czas', () => {
    expect(test).toBeDefined()
    const seg = test!.workout!.segments
    expect(seg[0]?.type).toBe('warmup')
    expect(seg.some((s) => s.type === 'race' && s.distanceKm === 5)).toBe(true)
    expect(seg.at(-1)?.type).toBe('cooldown')
  })

  it('opis mówi wprost, po co to jest — wynik do tren.yaml', () => {
    expect(test!.workout!.segments[1]!.description).toContain('na czas')
    expect(test!.workout!.segments[1]!.description).toContain('results')
  })

  it('część główna NIE ma celu tempa (ADR-020: to pomiar, nie realizacja tempa)', () => {
    const main = test!.workout!.segments.find((s) => s.type === 'race')!
    expect(main.pace).toBeUndefined()
  })

  it('dzień przed sprawdzianem wolny, cytowane reguły W-11…W-13', () => {
    const i = week.days.findIndex((d) => d.workout?.kind === 'test')
    expect(week.days[i - 1]?.workout).toBeUndefined()
    expect(test!.workout!.ruleRefs).toEqual(['W-11', 'W-12', 'W-13'])
  })
})
