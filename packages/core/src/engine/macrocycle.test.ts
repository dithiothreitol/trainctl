import { describe, expect, it } from 'vitest'
import type { AthleteProfile, RaceGoal, Weekday } from '../domain/types.ts'
import { messages } from '../i18n/index.ts'
import { applyReturnBlock, earliestFeasibleRaceDate, longGoalKm, planMacrocycle, recommendedPeakKm, taperWeeksFor, volumeBase } from './macrocycle.ts'
import { generateMicrocycle } from './microcycle.ts'
import { paceZones } from '../zones/daniels.ts'
import { addDays } from '../util/dates.ts'

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

  // różna liczba tygodni ładowania, także wielokrotności trzech i czterech: odciążenie nie wypada
  // w ostatnim tygodniu ładowania, a szczyt jest zaokrąglany do kilometra
  it.each([20, 24, 25, 29, 30, 33, 35, 37, 40])('najwcześniejsza data przy %i km/tydz.: plan z nią dochodzi do progu, tydzień wcześniej już nie', (km) => {
    const athlete = { ...runner, recentWeeklyKm: km, peakWeeklyKm: 50 }
    const date = earliestFeasibleRaceDate(athlete, half, today)!
    const peak = (d: string) => planMacrocycle({ today, goal: { ...half, date: d }, athlete }).peakKmPlanned
    expect(peak(date)).toBeGreaterThanOrEqual(recommendedPeakKm(half))
    const earlier = new Date(Date.parse(date + 'T00:00:00Z') - 7 * 86_400_000).toISOString().slice(0, 10)
    expect(peak(earlier)).toBeLessThan(recommendedPeakKm(half))
  })

  it('biegacz, który w oknie powrotu już odbudował objętość, nie wraca do 60% (R-11, P-3)', () => {
    // powrót 35 dni temu, dziś 45 km z 50 km sprzed przerwy
    const rebuilt: AthleteProfile = { ...runner, recentWeeklyKm: 45, returning: { since: '2026-09-17', previousWeeklyKm: 50 } }
    const { start } = volumeBase(rebuilt, today)
    expect(start).toBeGreaterThan(0.6 * 50)
    expect(start).toBeLessThanOrEqual(45)
    // w dniu powrotu granica to nadal 60%
    expect(volumeBase({ ...rebuilt, returning: { since: today, previousWeeklyKm: 50 } }, today).start).toBe(30)
  })

  it('bieżąca objętość ponad poziom sprzed przerwy: powrót się dokonał, plan startuje od niej', () => {
    const past: AthleteProfile = { ...runner, recentWeeklyKm: 50, returning: { since: '2026-10-01', previousWeeklyKm: 40 } }
    expect(volumeBase(past, today)).toEqual({ start: 50, level: 50, returning: false })
    expect(planMacrocycle({ today, goal: half, athlete: past }).weeks[0]!.easyOnly).toBeUndefined()
  })

  it('krótki plan bez odciążenia przed taperem: spokojna połowa tygodni ładowania, akcenty wracają przed taperem', () => {
    // start za 6 tygodni: 4 tygodnie ładowania bez odciążenia i taper
    const short = planMacrocycle({ today, goal: { ...half, date: '2026-11-29' }, athlete: back })
    const loading = short.weeks.filter((w) => ['base', 'build', 'peak'].includes(w.phase))
    expect(loading.some((w) => w.deload)).toBe(false)
    expect(loading.filter((w) => w.easyOnly)).toHaveLength(Math.ceil(loading.length / 2))
    expect(loading.at(-1)!.qualitySessions).toBeGreaterThan(0)
  })

  it('powrót z datą w przyszłości jeszcze się nie zaczął', () => {
    const future: AthleteProfile = { ...runner, recentWeeklyKm: 40, returning: { since: '2026-11-20', previousWeeklyKm: 50 } }
    expect(volumeBase(future, today)).toEqual({ start: 40, level: 40, returning: false })
  })

  it('profil z historii: bieżąca objętość równa tej sprzed przerwy, powrót trwa (R-11)', () => {
    // init --from-intervals i kreator wpisują objętość sprzed przerwy jako bieżącą
    const inferred: AthleteProfile = { ...runner, recentWeeklyKm: 42, returning: { since: '2026-10-19', previousWeeklyKm: 42 } }
    const { start, returning } = volumeBase(inferred, today)
    expect(returning).toBe(true)
    expect(start).toBeLessThanOrEqual(Math.round(0.6 * 42))
    expect(planMacrocycle({ today, goal: half, athlete: inferred }).weeks[0]!.easyOnly).toBe(true)
  })
})

describe('B11: blok powrotu po przerwie w trakcie planu', () => {
  const half: RaceGoal = { name: 'HM', date: '2027-03-28', distanceKm: 21.0975, priority: 'A' }
  const plan = planMacrocycle({ today: '2026-10-22', goal: half, athlete: { recentWeeklyKm: 45, daysAvailable: ['tue', 'wed', 'thu', 'sat', 'sun'], results: [] } })
  const since = '2026-12-16'
  const at = plan.weeks.findIndex((w) => w.weekStart === '2026-12-14')

  it('po chorobie: tygodnie przed powrotem bez zmian, od powrotu 55% objętości sprzed przerwy, 7 dni spokojnie (R-5)', () => {
    const weeks = applyReturnBlock(plan.weeks, { since, previousWeeklyKm: 50, illness: true })
    expect(weeks.slice(0, at)).toEqual(plan.weeks.slice(0, at))
    expect(weeks[at]!.targetKm).toBe(Math.min(plan.weeks[at]!.targetKm, Math.round(0.55 * 50)))
    // powrót w środę 2026-12-16: siódmy dzień to wtorek 12-22, więc spokojne są oba tygodnie
    for (const w of weeks.slice(at, at + 2)) {
      expect(w.easyOnly).toBe(true)
      expect(w.qualitySessions).toBe(0)
      expect(w.ruleRefs).toContain('R-5')
    }
    expect(weeks[at + 2]!.easyOnly).toBeUndefined()
    // powrót w poniedziałek: 7 dni to jeden tydzień
    const monday = applyReturnBlock(plan.weeks, { since: '2026-12-14', previousWeeklyKm: 50, illness: true })
    expect(monday[at]!.easyOnly).toBe(true)
    expect(monday[at + 1]!.easyOnly).toBeUndefined()
    // wzrost w tempie P-3, aż krzywa dogoni plan; taper i start z planu, gdy krzywa jest wyżej
    for (let i = at + 1; i < weeks.length; i++) expect(weeks[i]!.targetKm).toBeLessThanOrEqual(plan.weeks[i]!.targetKm)
    expect(weeks.at(-1)).toEqual(plan.weeks.at(-1))
  })

  it('odciążenie w bloku powrotu to ułamek ostatniego tygodnia ładowania krzywej (P-2)', () => {
    const weeks = applyReturnBlock(plan.weeks, { since, previousWeeklyKm: 50, illness: false })
    const deload = weeks.findIndex((w, i) => i > at && w.deload)
    const loadingBefore = weeks.slice(at, deload).filter((w) => !w.deload && ['base', 'build', 'peak'].includes(w.phase)).length
    // przypadek ma sens tylko wtedy, gdy przed odciążeniem jest kilka tygodni ładowania krzywej
    expect(loadingBefore).toBeGreaterThanOrEqual(2)
    const lastCurve = 0.55 * 50 * Math.pow(1.08, loadingBefore - 1)
    expect(weeks[deload]!.targetKm).toBe(Math.min(plan.weeks[deload]!.targetKm, Math.round(0.7 * lastCurve)))
  })

  it('po innej przerwie: pierwszy blok z odciążeniem spokojnie, bez sprawdzianu (R-11)', () => {
    const weeks = applyReturnBlock(plan.weeks, { since, previousWeeklyKm: 50, illness: false })
    const deload = weeks.findIndex((w, i) => i >= at && w.deload)
    for (const w of weeks.slice(at, deload + 1)) {
      expect(w.easyOnly).toBe(true)
      expect(w.testPlanned).toBeUndefined()
      expect(w.ruleRefs).toContain('R-11')
    }
    expect(weeks[deload + 1]!.easyOnly).toBeUndefined()
  })

  it.each([
    ['półmaraton', half],
    ['maraton', { name: 'M', date: '2027-03-28', distanceKm: 42.195, priority: 'A' } as RaceGoal],
  ])('%s: taper w bloku powrotu nie jest cięższy od tygodnia przed nim (T-4), z każdego tygodnia powrotu', (_name, goal) => {
    const base = planMacrocycle({ today: '2026-10-22', goal, athlete: { recentWeeklyKm: 60, daysAvailable: ['tue', 'wed', 'thu', 'sat', 'sun'], results: [] } })
    const raceAt = base.weeks.findIndex((w) => w.phase === 'race')
    for (const [from, w] of base.weeks.entries()) {
      if (from >= raceAt) break
      for (const previousWeeklyKm of [30, 45, 60, 80]) for (const illness of [true, false]) {
        const weeks = applyReturnBlock(base.weeks, { since: w.weekStart, previousWeeklyKm, illness })
        for (let i = Math.max(1, from); i <= raceAt; i++) {
          if (weeks[i]!.phase !== 'taper' && weeks[i]!.phase !== 'race') continue
          expect(weeks[i]!.targetKm, `${w.weekStart} ${previousWeeklyKm} ${illness} → ${weeks[i]!.weekStart}`).toBeLessThanOrEqual(weeks[i - 1]!.targetKm)
        }
      }
    }
  })

  it('trzy dni: sprawdzian wypada z bloku powrotu, a akcent, który zastępował, wraca (T-12, W-13)', () => {
    const three = planMacrocycle({ today: '2026-10-22', goal: half, athlete: { recentWeeklyKm: 45, daysAvailable: ['tue', 'thu', 'sat'], results: [] } })
    const testAt = three.weeks.findIndex((w, i) => i > 1 && w.testPlanned)
    expect(testAt).toBeGreaterThan(1)
    expect(three.weeks[testAt]!.qualitySessions).toBe(0)
    // choroba tydzień przed sprawdzianem: tydzień sprawdzianu jest już po spokojnym, ale pod krzywą
    const weeks = applyReturnBlock(three.weeks, { since: three.weeks[testAt - 1]!.weekStart, previousWeeklyKm: 50, illness: true })
    expect(weeks[testAt]!.targetKm).toBeLessThan(three.weeks[testAt]!.targetKm)
    expect(weeks[testAt]!.easyOnly).toBeUndefined()
    expect(weeks[testAt]!.testPlanned).toBeUndefined()
    expect(weeks[testAt]!.qualitySessions).toBe(1)
  })

  it('po innej przerwie zaczętej w odciążeniu: spokojny blok trwa do następnego odciążenia (R-11)', () => {
    const deloadAt = plan.weeks.findIndex((w, i) => i > 2 && w.deload)
    const next = plan.weeks.findIndex((w, i) => i > deloadAt && w.deload)
    const weeks = applyReturnBlock(plan.weeks, { since: plan.weeks[deloadAt]!.weekStart, previousWeeklyKm: 50, illness: false })
    for (const w of weeks.slice(deloadAt, next + 1)) expect(w.easyOnly, w.weekStart).toBe(true)
    expect(weeks[next + 1]!.easyOnly).toBeUndefined()
  })

  it('po innej przerwie w ostatnim bloku (bez odciążenia przed taperem): spokojna połowa tygodni ładowania', () => {
    // 7 tygodni ładowania (LLLD LLL) i taper: ostatni blok ma trzy tygodnie
    const seven = planMacrocycle({ today: '2026-10-22', goal: { ...half, date: '2026-12-20' }, athlete: { recentWeeklyKm: 45, daysAvailable: ['tue', 'wed', 'thu', 'sat', 'sun'], results: [] } })
    const lastDeload = seven.weeks.map((w) => w.deload).lastIndexOf(true)
    const taperAt = seven.weeks.findIndex((w) => w.phase === 'taper')
    const n = taperAt - (lastDeload + 1)
    expect(n).toBeGreaterThan(1)
    const weeks = applyReturnBlock(seven.weeks, { since: seven.weeks[lastDeload + 1]!.weekStart, previousWeeklyKm: 50, illness: false })
    const block = weeks.slice(lastDeload + 1, taperAt)
    expect(block.filter((w) => w.easyOnly)).toHaveLength(Math.ceil(n / 2))
    expect(block.at(-1)!.easyOnly).toBeUndefined()
  })

  it('tor długiego w bloku powrotu maleje razem z tygodniem — dwa dni biegowe nie robią z tygodnia jednego długiego', () => {
    const marathon: RaceGoal = { name: 'M', date: '2027-03-28', distanceKm: 42.195, priority: 'A' }
    const base = planMacrocycle({ today: '2026-10-22', goal: marathon, athlete: { recentWeeklyKm: 60, daysAvailable: ['sat', 'sun'], results: [] } })
    const late = base.weeks.findIndex((w, i) => i > 10 && !w.deload && (w.longKm ?? 0) >= 20)
    expect(late).toBeGreaterThan(10)
    const weeks = applyReturnBlock(base.weeks, { since: base.weeks[late]!.weekStart, previousWeeklyKm: 60, illness: true })
    const w = weeks[late]!
    expect(w.targetKm).toBeLessThan(base.weeks[late]!.targetKm)
    expect(w.longKm! / w.targetKm).toBeCloseTo(base.weeks[late]!.longKm! / base.weeks[late]!.targetKm, 1)
  })

  it('start kontrolny w ostatnim tygodniu ładowania nie jest odniesieniem taperu w bloku powrotu (T-9, T-5)', () => {
    const base = planMacrocycle({ today: '2026-10-22', goal: half, athlete: { recentWeeklyKm: 45, daysAvailable: ['tue', 'wed', 'thu', 'sat', 'sun'], results: [] } })
    const taperAt = base.weeks.findIndex((w) => w.phase === 'taper')
    const lastLoading = base.weeks[taperAt - 1]!
    // start B w ostatnim tygodniu ładowania: mini-taper obniża cel tego tygodnia (T-9)
    const withTuneUp = planMacrocycle({ today: '2026-10-22', goal: half, athlete: { recentWeeklyKm: 45, daysAvailable: ['tue', 'wed', 'thu', 'sat', 'sun'], results: [], tuneUpRaces: [{ date: addDays(lastLoading.weekStart, 6), distanceKm: 10, priority: 'B' }] } })
    expect(withTuneUp.weeks[taperAt - 1]!.tuneUp).toBeDefined()
    const since = withTuneUp.weeks[taperAt - 4]!.weekStart
    const plain = applyReturnBlock(base.weeks, { since, previousWeeklyKm: 30, illness: false })
    const tuned = applyReturnBlock(withTuneUp.weeks, { since, previousWeeklyKm: 30, illness: false })
    // odniesieniem taperu jest ostatni pełny tydzień ładowania bloku, nie tydzień z mini-taperem
    const full = tuned.map((w, i) => (i < taperAt && !w.deload && !w.tuneUp && ['base', 'build', 'peak'].includes(w.phase) ? i : -1)).filter((i) => i >= 0)
    const ref = full.at(-1)!
    // taper lżejszy niż ten tydzień (T-4) i nie cięższy niż w tym samym planie bez startu
    expect(tuned[taperAt]!.targetKm).toBeLessThan(tuned[ref]!.targetKm)
    expect(tuned[taperAt]!.targetKm).toBeLessThanOrEqual(plain[taperAt]!.targetKm)
  })

  it('powrót z profilu: spokojny blok liczy się od `since`, nie od startu planu (R-11)', () => {
    const athlete = (since: string) => ({ recentWeeklyKm: 30, daysAvailable: ['tue', 'wed', 'thu', 'sat', 'sun'] as Weekday[], results: [], returning: { since, previousWeeklyKm: 50 } })
    // powrót 5 tygodni przed startem planu: blok po przerwie już za biegaczem
    const late = planMacrocycle({ today: '2026-10-22', goal: half, athlete: athlete('2026-09-17') })
    expect(late.weeks.some((w) => w.easyOnly)).toBe(false)
    // powrót 2 tygodnie przed startem: spokojne tylko tygodnie do końca bloku od powrotu
    const recent = planMacrocycle({ today: '2026-10-22', goal: half, athlete: athlete('2026-10-08') })
    expect(recent.weeks.filter((w) => w.easyOnly).map((w) => w.weekStart)).toEqual(['2026-10-19', '2026-10-26'])
  })

  it('start kontrolny B w bloku powrotu: tydzień lżejszy od krzywej o mini-taper (T-9)', () => {
    const base = planMacrocycle({ today: '2026-10-22', goal: half, athlete: { recentWeeklyKm: 45, daysAvailable: ['tue', 'wed', 'thu', 'sat', 'sun'], results: [] } })
    const taperAt = base.weeks.findIndex((w) => w.phase === 'taper')
    const raceWeek = base.weeks[taperAt - 1]!
    const withTuneUp = planMacrocycle({ today: '2026-10-22', goal: half, athlete: { recentWeeklyKm: 45, daysAvailable: ['tue', 'wed', 'thu', 'sat', 'sun'], results: [], tuneUpRaces: [{ date: addDays(raceWeek.weekStart, 6), distanceKm: 10, priority: 'B' }] } })
    const weeks = applyReturnBlock(withTuneUp.weeks, { since: withTuneUp.weeks[taperAt - 4]!.weekStart, previousWeeklyKm: 30, illness: false })
    const loadingBefore = weeks.map((w, i) => (i < taperAt - 1 && !w.deload && ['base', 'build', 'peak'].includes(w.phase) ? i : -1)).filter((i) => i >= 0)
    // tydzień startu lżejszy od poprzedniego tygodnia ładowania krzywej, nie równy krzywej
    expect(weeks[taperAt - 1]!.targetKm).toBeLessThan(weeks[loadingBefore.at(-1)!]!.targetKm)
  })

  it('choroba w drugim tygodniu po starcie: tydzień spokojny (R-5), ale długie wybieganie zostaje (R-8)', () => {
    const t2 = plan.weeks.findIndex((w, i) => w.phase === 'transition' && plan.weeks[i - 1]?.phase === 'transition')
    expect(t2).toBeGreaterThan(0)
    const weeks = applyReturnBlock(plan.weeks, { since: plan.weeks[t2]!.weekStart, previousWeeklyKm: 50, illness: true })
    expect(weeks[t2]!.easyOnly).toBe(true)
    const mc = generateMicrocycle({ skeleton: weeks[t2]!, athlete: { recentWeeklyKm: 45, daysAvailable: ['tue', 'wed', 'thu', 'sat', 'sun'], results: [] }, zones: paceZones(50), goal: half })
    expect(mc.days.some((d) => d.workout?.kind === 'long')).toBe(true)
    // pierwszy tydzień po starcie nadal bez długiego
    const first = generateMicrocycle({ skeleton: plan.weeks[t2 - 1]!, athlete: { recentWeeklyKm: 45, daysAvailable: ['tue', 'wed', 'thu', 'sat', 'sun'], results: [] }, zones: paceZones(50), goal: half })
    expect(first.days.some((d) => d.workout?.kind === 'long')).toBe(false)
  })

  it('po innej przerwie zaczętej w taperze: taper trzyma intensywność (T-1), tygodnie po starcie swoje reguły (R-8)', () => {
    const taperAt = plan.weeks.findIndex((w) => w.phase === 'taper')
    const weeks = applyReturnBlock(plan.weeks, { since: plan.weeks[taperAt]!.weekStart, previousWeeklyKm: 20, illness: false })
    for (const [i, w] of weeks.entries()) {
      if (i < taperAt) continue
      expect(w.easyOnly, w.weekStart).toBeUndefined()
      expect(w.qualitySessions, w.weekStart).toBe(plan.weeks[i]!.qualitySessions)
    }
    // objętość i tak idzie za krzywą powrotu
    expect(weeks[taperAt]!.targetKm).toBeLessThan(plan.weeks[taperAt]!.targetKm)
  })

  it('sprawdzian wypada z całego bloku powrotu, także z tygodni po spokojnym (kalibracja zmierzyłaby przerwę)', () => {
    const weeks = applyReturnBlock(plan.weeks, { since, previousWeeklyKm: 50, illness: true })
    const inBlock = weeks.map((w, i) => i > at && w.targetKm < plan.weeks[i]!.targetKm)
    // przypadek ma sens tylko wtedy, gdy plan miał sprawdzian w bloku po pierwszym tygodniu
    expect(plan.weeks.some((w, i) => inBlock[i] && w.testPlanned)).toBe(true)
    for (const [i, w] of weeks.entries()) {
      if (!inBlock[i]) continue
      expect(w.testPlanned).toBeUndefined()
      expect(w.ruleRefs).not.toContain('W-13')
    }
  })
})
