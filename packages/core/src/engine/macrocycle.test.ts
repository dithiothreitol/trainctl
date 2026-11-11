import { describe, expect, it } from 'vitest'
import type { AthleteProfile, RaceGoal } from '../domain/types.ts'
import { messages } from '../i18n/index.ts'
import { earliestFeasibleRaceDate, longGoalKm, planMacrocycle, recommendedPeakKm, taperWeeksFor } from './macrocycle.ts'

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

describe('B3: trajektoria objętości (P-12, T-7, P-3)', () => {
  const half: RaceGoal = { name: 'HM', date: '2027-03-28', distanceKm: 21.0975, priority: 'A' }
  const today = '2026-10-22'
  const noPeak = (recentWeeklyKm: number): AthleteProfile => ({ recentWeeklyKm, daysAvailable: athlete.daysAvailable, results: [] })
  const loadBlocks = (weeks: ReturnType<typeof planMacrocycle>['weeks']) => {
    const blocks: number[][] = [[]]
    for (const w of weeks.filter((x) => ['base', 'build', 'peak'].includes(x.phase))) {
      if (w.deload) blocks.push([])
      else blocks.at(-1)!.push(w.targetKm)
    }
    return blocks.filter((b) => b.length)
  }

  it('szczyt w ostatnim bloku ładowania przed taperem, nie w drugim tygodniu (P1)', () => {
    const plan = planMacrocycle({ today, goal: half, athlete: noPeak(45) })
    const blocks = loadBlocks(plan.weeks)
    const peak = Math.max(...blocks.flat())
    expect(Math.max(...blocks.at(-1)!)).toBe(peak)
    // przy wolnym wzroście przedostatni blok bywa w zaokrągleniu szczytu; wcześniejsze są niżej
    for (const block of blocks.slice(0, -2)) expect(Math.max(...block)).toBeLessThan(peak)
    // poziomy bloków nie maleją
    for (let i = 1; i < blocks.length; i++) expect(Math.max(...blocks[i]!)).toBeGreaterThanOrEqual(Math.max(...blocks[i - 1]!))
  })

  it('wolny wzrost: tydzień w bloku rośnie falą 0,94 → 0,97 → 1,00 poziomu bloku', () => {
    const plan = planMacrocycle({ today, goal: half, athlete: noPeak(45) })
    const [first] = loadBlocks(plan.weeks)
    expect(first).toHaveLength(3)
    const [a, b, c] = first!
    expect(a!).toBeLessThan(b!)
    expect(b!).toBeLessThan(c!)
    expect(a! / c!).toBeCloseTo(0.94, 1)
  })

  it('biegacz na szczycie: fala wokół plateau, odciążenie 0,7 poziomu bloku', () => {
    const plan = planMacrocycle({ today, goal: half, athlete: { ...athlete, recentWeeklyKm: 50, peakWeeklyKm: 50 } })
    const blocks = loadBlocks(plan.weeks)
    for (const block of blocks.filter((b) => b.length === 3)) expect(block).toEqual([47, 49, 50])
    for (const d of plan.weeks.filter((w) => w.deload)) expect(d.targetKm).toBe(35)
  })

  it('szybki wzrost z małej bazy: P-3 między kolejnymi tygodniami ładowania, szczyt na końcu', () => {
    const plan = planMacrocycle({ today, goal: half, athlete: { ...athlete, recentWeeklyKm: 12, peakWeeklyKm: 50 } })
    const load = plan.weeks.filter((w) => ['base', 'build', 'peak'].includes(w.phase) && !w.deload)
    // ≤10% na tydzień; przy kilkunastu km zaokrąglenie do pełnego km to krok 1 km
    for (let i = 1; i < load.length; i++) expect(load[i]!.targetKm - load[i - 1]!.targetKm).toBeLessThanOrEqual(Math.max(1, 0.1 * load[i - 1]!.targetKm) + 0.5)
    expect(load.at(-1)!.targetKm).toBe(plan.peakKmPlanned)
  })

  it('taper liczony od poziomu ostatniego bloku (T-4, T-5)', () => {
    const plan = planMacrocycle({ today, goal: half, athlete: noPeak(45) })
    const taper = plan.weeks.find((w) => w.phase === 'taper')!
    expect(taper.targetKm).toBe(Math.round(plan.peakKmPlanned * 0.7))
  })
})

describe('B4: tor długiego wybiegania (J-1, J-2, J-10, N-19)', () => {
  const today = '2026-10-22'
  const half: RaceGoal = { name: 'HM', date: '2027-03-28', distanceKm: 21.0975, priority: 'A' }
  const runner: AthleteProfile = { recentWeeklyKm: 45, daysAvailable: ['tue', 'wed', 'thu', 'sat', 'sun'], results: [] }
  const loading = (weeks: ReturnType<typeof planMacrocycle>['weeks']) => weeks.filter((w) => ['base', 'build', 'peak'].includes(w.phase))

  it('cel długiego według dystansu; krótszy cel i plan bez startu bez toru', () => {
    expect(longGoalKm(half)).toBe(22)
    expect(longGoalKm(marathon)).toBe(30)
    expect(longGoalKm({ ...marathon, distanceKm: 100 })).toBe(32)
    expect(longGoalKm({ ...marathon, distanceKm: 10 })).toBeUndefined()
    const tenK = planMacrocycle({ today, goal: { ...half, distanceKm: 10 }, athlete: runner })
    expect(tenK.weeks.every((w) => w.longKm === undefined)).toBe(true)
  })

  it('półmaraton: długie rośnie najwyżej 2 km na tydzień ładowania i dochodzi do 22 km w ostatnim bloku', () => {
    const weeks = loading(planMacrocycle({ today, goal: half, athlete: runner }).weeks)
    const load = weeks.filter((w) => !w.deload)
    for (let i = 1; i < load.length; i++) expect(load[i]!.longKm! - load[i - 1]!.longKm!).toBeLessThanOrEqual(2)
    expect(load.at(-1)!.longKm).toBe(22)
    // cel nie przychodzi w pierwszej połowie planu
    expect(load.slice(0, Math.floor(load.length / 2)).every((w) => w.longKm! < 22)).toBe(true)
  })

  it('odciążenie skraca długie tak jak objętość (P-2)', () => {
    const weeks = loading(planMacrocycle({ today, goal: half, athlete: runner }).weeks)
    for (const [i, w] of weeks.entries()) {
      if (!w.deload) continue
      const prev = weeks.slice(0, i).reverse().find((x) => !x.deload)!
      expect(w.longKm).toBe(Math.round(prev.longKm! * 0.7))
    }
  })

  it('maraton: tor kończy się na 30 km, nie ponad 35 (N-19)', () => {
    const plan = planMacrocycle({ today: '2026-08-05', goal: marathon, athlete })
    const longs = loading(plan.weeks).filter((w) => !w.deload).map((w) => w.longKm!)
    expect(Math.max(...longs)).toBeLessThanOrEqual(30)
  })
})

describe('B5: krok dawki akcentu w sezonie', () => {
  const today = '2026-10-22'
  const half: RaceGoal = { name: 'HM', date: '2027-03-28', distanceKm: 21.0975, priority: 'A' }
  const plan = planMacrocycle({ today, goal: half, athlete: { recentWeeklyKm: 45, daysAvailable: ['tue', 'wed', 'thu', 'sat', 'sun'], results: [] } })
  const blocks: typeof plan.weeks[] = [[]]
  for (const w of plan.weeks.filter((x) => ['base', 'build', 'peak'].includes(x.phase))) {
    if (w.deload) blocks.push([])
    else blocks.at(-1)!.push(w)
  }

  it('tydzień w bloku dodaje krok; blok po odciążeniu startuje z poziomu drugiego tygodnia poprzedniego', () => {
    expect(blocks[0]![0]!.accentProgress).toBe(0)
    expect(blocks[0]![1]!.accentProgress).toBeGreaterThan(0)
    expect(blocks[1]![0]!.accentProgress).toBe(blocks[0]![1]!.accentProgress)
    expect(blocks.at(-1)!.at(-1)!.accentProgress).toBe(1)
  })

  it('taper trzyma dawkę ostatniego bloku (T-1), blok po starcie zaczyna od zera (R-8)', () => {
    for (const w of plan.weeks.filter((x) => x.phase === 'taper' || x.phase === 'race')) expect(w.accentProgress).toBe(1)
    for (const w of plan.weeks.filter((x) => x.phase === 'transition')) expect(w.accentProgress).toBe(0)
  })
})

describe('B8: powrót po przerwie (R-11) i data, od której próg jest osiągalny', () => {
  const today = '2026-10-22'
  const half: RaceGoal = { name: 'HM', date: '2027-03-28', distanceKm: 21.0975, priority: 'A' }
  const runner: AthleteProfile = { recentWeeklyKm: 12, daysAvailable: ['tue', 'wed', 'thu', 'sat', 'sun'], results: [] }
  const back = { ...runner, returning: { since: '2026-10-19', previousWeeklyKm: 45 } }

  it('start z 50–60% objętości sprzed przerwy, szczyt liczony od niej', () => {
    const plan = planMacrocycle({ today, goal: half, athlete: back })
    const first = plan.weeks[0]!
    expect(first.targetKm).toBeGreaterThanOrEqual(Math.round(0.5 * 45 * 0.94))
    expect(first.targetKm).toBeLessThanOrEqual(Math.round(0.6 * 45))
    expect(plan.peakKmPlanned).toBeGreaterThan(planMacrocycle({ today, goal: half, athlete: runner }).peakKmPlanned)
    expect(plan.feasibilityWarnings.join(' ')).toContain('R-11')
  })

  it('pierwszy blok z odciążeniem wyłącznie spokojnie, bez sprawdzianu', () => {
    const plan = planMacrocycle({ today, goal: half, athlete: { ...back, results: [] } })
    const firstDeload = plan.weeks.findIndex((w) => w.deload)
    for (const w of plan.weeks.slice(0, firstDeload + 1)) {
      expect(w.qualitySessions).toBe(0)
      expect(w.easyOnly).toBe(true)
      expect(w.testPlanned).toBeUndefined()
      expect(w.ruleRefs).toContain('R-11')
    }
    expect(plan.weeks[firstDeload + 1]!.easyOnly).toBeUndefined()
  })

  it('powrót sprzed ponad 6 tygodni już nie działa — bieżąca objętość mówi sama', () => {
    const old = { ...runner, returning: { since: '2026-08-01', previousWeeklyKm: 45 } }
    expect(planMacrocycle({ today, goal: half, athlete: old }).weeks[0]!.targetKm).toBe(planMacrocycle({ today, goal: half, athlete: runner }).weeks[0]!.targetKm)
  })

  it('najwcześniejsza data startu: jest przy sufice z historii, nie ma bez niego', () => {
    expect(earliestFeasibleRaceDate(runner, half, today)).toBeUndefined()
    const date = earliestFeasibleRaceDate({ ...runner, peakWeeklyKm: 50 }, half, today)!
    expect(date > today).toBe(true)
    expect(new Date(date + 'T00:00:00Z').getUTCDay()).toBe(0)
    // plan z tą datą dochodzi do rekomendowanego szczytu
    const plan = planMacrocycle({ today, goal: { ...half, date }, athlete: { ...runner, peakWeeklyKm: 50 } })
    expect(plan.peakKmPlanned).toBeGreaterThanOrEqual(recommendedPeakKm(half))
  })
})
