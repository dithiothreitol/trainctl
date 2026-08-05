import { describe, expect, it } from 'vitest'
import type { AthleteProfile, RaceGoal } from '../domain/types.ts'
import { planMacrocycle, recommendedPeakKm, taperWeeksFor } from './macrocycle.ts'

const athlete: AthleteProfile = {
  recentWeeklyKm: 50,
  peakWeeklyKm: 80,
  daysAvailable: ['tue', 'wed', 'thu', 'sat', 'sun'],
  results: [],
}

const marathon: RaceGoal = {
  date: '2026-11-29', // niedziela; 17 tygodni od 2026-08-03
  distanceKm: 42.195,
  name: 'Maraton testowy',
  priority: 'A',
}

describe('taperWeeksFor / recommendedPeakKm', () => {
  it('długość taperu wg dystansu (T-5)', () => {
    expect(taperWeeksFor({ ...marathon, distanceKm: 10 }).weeks).toBe(1)
    expect(taperWeeksFor({ ...marathon, distanceKm: 21.0975 }).weeks).toBe(2)
    expect(taperWeeksFor(marathon).weeks).toBe(3)
    const ultra = taperWeeksFor({ ...marathon, distanceKm: 100 })
    expect(ultra.weeks).toBe(3)
    expect(ultra.flags.some((f) => f.includes('T-8'))).toBe(true)
  })

  it('rekomendacje objętości (P-7/P-8)', () => {
    expect(recommendedPeakKm(marathon)).toBe(65)
    expect(recommendedPeakKm({ ...marathon, distanceKm: 21.0975 })).toBe(42)
  })
})

describe('planMacrocycle — maraton, 17 tygodni', () => {
  const plan = planMacrocycle({ today: '2026-08-05', goal: marathon, athlete })

  it('liczba i wyrównanie tygodni (poniedziałki)', () => {
    expect(plan.weeks).toHaveLength(17)
    expect(plan.weeks[0]!.weekStart).toBe('2026-08-03')
    expect(plan.weeks[16]!.weekStart).toBe('2026-11-23')
    for (const w of plan.weeks) {
      expect(new Date(w.weekStart + 'T00:00:00Z').getUTCDay()).toBe(1)
    }
  })

  it('ostatnie 3 tygodnie to taper zakończony tygodniem startowym', () => {
    const phases = plan.weeks.map((w) => w.phase)
    expect(phases.slice(14)).toEqual(['taper', 'taper', 'race'])
    expect(plan.weeks[16]!.raceDate).toBe('2026-11-29')
  })

  it('T-4: taper monotonicznie malejący; T-1/T-2: flagi zachowania intensywności i częstotliwości', () => {
    const [t1, t2, race] = plan.weeks.slice(14)
    expect(t1!.targetKm).toBeGreaterThan(t2!.targetKm)
    expect(t2!.targetKm).toBeGreaterThan(race!.targetKm)
    for (const w of [t1!, t2!, race!]) {
      expect(w.keepIntensity).toBe(true)
      expect(w.keepFrequency).toBe(true)
    }
  })

  it('fazy: base→build→peak przed taperem; TID piramidalny → polaryzacja (I-1/I-2)', () => {
    const load = plan.weeks.slice(0, 14)
    expect(load[0]!.phase).toBe('base')
    expect(load.at(-1)!.phase).toBe('peak')
    const firstPolarized = plan.weeks.findIndex((w) => w.intensityModel === 'polarized')
    expect(firstPolarized).toBeGreaterThan(0)
    // od pierwszej polaryzacji nie ma powrotu do piramidy
    for (const w of plan.weeks.slice(firstPolarized)) {
      expect(w.intensityModel).toBe('polarized')
    }
  })

  it('P-2: deload co 4. tydzień ładowania, objętość ×0,7', () => {
    const deloads = plan.weeks.filter((w) => w.deload)
    expect(deloads.length).toBeGreaterThanOrEqual(2)
    expect(deloads[0]!.index).toBe(3)
    for (const d of deloads) {
      const prev = plan.weeks[d.index - 1]!
      expect(d.targetKm).toBeLessThan(prev.targetKm)
    }
  })

  it('P-3: wzrost między kolejnymi tygodniami ładowania ≤10%', () => {
    const load = plan.weeks.slice(0, 14).filter((w) => !w.deload)
    for (let i = 1; i < load.length; i++) {
      expect(load[i]!.targetKm / load[i - 1]!.targetKm).toBeLessThanOrEqual(1.101)
    }
  })

  it('szczyt: ≤ historycznego maksimum i ≤ rekomendacji; osiągnięty przed taperem', () => {
    expect(plan.peakKmPlanned).toBeLessThanOrEqual(65)
    expect(plan.peakKmPlanned).toBeLessThanOrEqual(80)
    const lastLoad = plan.weeks[13]!
    expect(lastLoad.targetKm).toBe(plan.peakKmPlanned)
  })

  it('I-8: 2 sesje jakościowe przy 5 dniach dyspozycyjności; 1 w tygodniu startowym', () => {
    expect(plan.weeks[0]!.qualitySessions).toBe(2)
    expect(plan.weeks[16]!.qualitySessions).toBe(1)
  })
})

describe('planMacrocycle — przypadki brzegowe', () => {
  it('niska baza objętości → ostrzeżenie o wykonalności (P-8)', () => {
    const low = planMacrocycle({
      today: '2026-08-05',
      goal: marathon,
      athlete: { ...athlete, recentWeeklyKm: 25, peakWeeklyKm: 40 },
    })
    expect(low.peakKmPlanned).toBeLessThan(65)
    expect(low.feasibilityWarnings.some((w) => w.includes('P-7/P-8'))).toBe(true)
  })

  it('krótki horyzont → plan skompresowany, taper obcięty', () => {
    const compressed = planMacrocycle({
      today: '2026-08-05',
      goal: { ...marathon, date: '2026-08-23' }, // 3 tygodnie
      athlete,
    })
    expect(compressed.weeks).toHaveLength(3)
    expect(compressed.feasibilityWarnings.some((w) => w.includes('skompresowany'))).toBe(true)
    expect(compressed.weeks.at(-1)!.phase).toBe('race')
  })

  it('3 dni dyspozycyjności → 1 sesja jakościowa (I-8)', () => {
    const busy = planMacrocycle({
      today: '2026-08-05',
      goal: marathon,
      athlete: { ...athlete, daysAvailable: ['tue', 'thu', 'sun'] },
    })
    expect(busy.weeks[0]!.qualitySessions).toBe(1)
  })

  it('start w przeszłości → wyjątek', () => {
    expect(() =>
      planMacrocycle({ today: '2026-08-05', goal: { ...marathon, date: '2026-07-01' }, athlete }),
    ).toThrow()
  })
})
