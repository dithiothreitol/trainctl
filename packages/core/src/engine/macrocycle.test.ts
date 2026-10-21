import { describe, expect, it } from 'vitest'
import type { AthleteProfile, RaceGoal } from '../domain/types.ts'
import { messages } from '../i18n/index.ts'
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
  const full = planMacrocycle({ today: '2026-08-05', goal: marathon, athlete })
  // cykl do startu; blok po starcie (R-8) ma własne testy niżej
  const plan = { ...full, weeks: full.weeks.filter((w) => w.phase !== 'transition') }

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
    expect(compressed.weeks.filter((w) => w.phase !== 'transition')).toHaveLength(3)
    // treść ostrzeżenia zależy od języka — sprawdzamy przez katalog, nie przez literał
    expect(
      compressed.feasibilityWarnings.some((w) => w === messages().macro.compressedPlan(3)),
    ).toBe(true)
    expect(compressed.weeks.find((w) => w.raceDate)!.phase).toBe('race')
  })

  it('wytrenowany powyżej rekomendacji nie dostaje cięcia objętości', () => {
    const hm = planMacrocycle({
      today: '2026-08-05',
      goal: { ...marathon, date: '2026-10-25', distanceKm: 21.0975 },
      athlete: { ...athlete, recentWeeklyKm: 60, peakWeeklyKm: 75 },
    })
    expect(hm.peakKmPlanned).toBeGreaterThanOrEqual(60) // nie tniemy do 42 (P-7)
    expect(hm.feasibilityWarnings).toHaveLength(0)
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

describe('planMacrocycle — rytm kalibracji liczy wyniki z horyzontu planu (W-12)', () => {
  const athlete: AthleteProfile = {
    recentWeeklyKm: 55,
    daysAvailable: ['tue', 'wed', 'thu', 'sat', 'sun'],
    results: [{ date: '2026-03-29', distanceKm: 10, timeSec: 2580 }],
  }
  const goal: RaceGoal = { name: 'HM', date: '2026-11-29', distanceKm: 21.0975, priority: 'A' }
  const tests = (a: AthleteProfile) => planMacrocycle({ today: '2026-08-03', goal, athlete: a }).weeks.filter((w) => w.testPlanned).map((w) => w.weekStart)

  it('wynik wpisany w trakcie planu przesuwa kolejny sprawdzian o pełny odstęp od siebie', () => {
    const withResult = tests({ ...athlete, results: [...athlete.results, { date: '2026-09-05', distanceKm: 10, timeSec: 2400 }] })
    // żaden sprawdzian w ciągu pięciu tygodni po świeżym wyniku
    expect(withResult.filter((w) => w > '2026-08-31' && w < '2026-10-05')).toEqual([])
    // przed wynikiem rytm liczy się od starszego wyniku, jak w planie bez nowego wpisu
    expect(withResult.filter((w) => w < '2026-08-31')).toEqual(tests(athlete).filter((w) => w < '2026-08-31'))
  })
})

describe('blok po starcie (R-8, R-10) i plan bez startu (P-11)', () => {
  const plan = planMacrocycle({ today: '2026-08-05', goal: marathon, athlete })
  const raceIdx = plan.weeks.findIndex((w) => w.raceDate)
  const transition = plan.weeks.slice(raceIdx + 1)
  const before = plan.weeks.slice(raceIdx - 4, raceIdx)
  const base = before.reduce((s, w) => s + w.targetKm, 0) / before.length

  it('po maratonie dwa tygodnie przejściowe: ~50%, potem ~100% średniej 4 tygodni przed tygodniem startu', () => {
    expect(transition.map((w) => w.phase)).toEqual(['transition', 'transition'])
    expect(transition[0]!.targetKm).toBe(Math.round(base * 0.5))
    expect(transition[1]!.targetKm).toBe(Math.round(base))
    expect(transition[0]!.weekStart).toBe('2026-11-30')
  })
  it('pierwszy tydzień bez akcentu, pierwszy bieg 3. dnia po maratonie (R-1); drugi z jednym akcentem', () => {
    expect(transition[0]).toMatchObject({ qualitySessions: 0, earliestRun: '2026-12-02', ruleRefs: ['R-1', 'R-2', 'R-8'] })
    expect(transition[1]).toMatchObject({ qualitySessions: 1 })
    expect(transition[1]!.earliestRun).toBeUndefined()
  })
  it('po 10 km jeden tydzień ~70% (R-10), pierwszy bieg nazajutrz', () => {
    const tenK = planMacrocycle({ today: '2026-08-05', goal: { ...marathon, distanceKm: 10 }, athlete })
    const after = tenK.weeks.filter((w) => w.phase === 'transition')
    expect(after).toHaveLength(1)
    expect(after[0]!.ruleRefs).toEqual(['R-10'])
    expect(after[0]!.earliestRun).toBeUndefined() // start w niedzielę, poniedziałek to już dzień po
  })
  it('plan bazowy: same tygodnie bazy z odciążeniem, bez taperu, startu i bloku po starcie', () => {
    const basePlan = planMacrocycle({ today: '2026-08-05', goal: { kind: 'base', name: 'Base', date: '2026-10-25', distanceKm: 0, priority: 'A' }, athlete })
    expect(new Set(basePlan.weeks.map((w) => w.phase))).toEqual(new Set(['base']))
    expect(basePlan.weeks.some((w) => w.raceDate)).toBe(false)
    expect(basePlan.weeks.some((w) => w.deload)).toBe(true)
    expect(basePlan.weeks.every((w) => w.ruleRefs.includes('P-11'))).toBe(true)
    expect(basePlan.peakKmRecommended).toBe(0)
    expect(Math.max(...basePlan.weeks.map((w) => w.targetKm))).toBeLessThanOrEqual(athlete.peakWeeklyKm!)
  })
})
