import { describe, expect, it } from 'vitest'
import type { Microcycle, PlannedWorkout, RaceGoal, Weekday } from '../domain/types.ts'
import { addDays } from '../util/dates.ts'
import { longRunThreshold, seasonLine, seasonProfile, seasonShapeIssues } from './season.ts'

const WD: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

function week(start: string, workouts: Partial<Record<Weekday, PlannedWorkout>>, phase: Microcycle['skeleton']['phase'] = 'build'): Microcycle {
  const days = WD.map((weekday, i) => ({ date: addDays(start, i), weekday, ...(workouts[weekday] ? { workout: workouts[weekday] } : {}) }))
  const totalKm = days.reduce((s, d) => s + (d.workout?.distanceKm ?? 0), 0)
  return {
    weekStart: start, days, totalKm, easyShare: 1,
    skeleton: { weekStart: start, index: 0, phase, intensityModel: 'pyramidal', targetKm: totalKm, deload: false, keepIntensity: false, keepFrequency: false, qualitySessions: 1, flags: [], ruleRefs: [] },
  }
}
const easy = (km: number): PlannedWorkout => ({ kind: 'easy', distanceKm: km, ruleRefs: [], segments: [{ type: 'easy', distanceKm: km, description: '' }] })
const long = (km: number): PlannedWorkout => ({ ...easy(km), kind: 'long' })
const marathon: RaceGoal = { kind: 'race', name: 'M', date: '2027-04-25', distanceKm: 42.195, priority: 'A' }
const half: RaceGoal = { ...marathon, distanceKm: 21.0975 }

describe('longBelowGoal', () => {
  it('maraton: 25 km spełnia P-8 („najdłuższy <25 km" jest karany)', () => {
    const weeks = [week('2027-01-04', { tue: easy(10), sat: long(25) })]
    expect(seasonShapeIssues({ goal: marathon, weeks }).some((i) => i.code === 'longBelowGoal')).toBe(false)
    const short = [week('2027-01-04', { tue: easy(10), sat: long(24.9) })]
    expect(seasonShapeIssues({ goal: marathon, weeks: short }).some((i) => i.code === 'longBelowGoal')).toBe(true)
  })
  it('półmaraton: 21 km nie spełnia J-2 (wymaga >21 km)', () => {
    const weeks = [week('2027-01-04', { tue: easy(10), sat: long(21) })]
    expect(seasonShapeIssues({ goal: half, weeks }).some((i) => i.code === 'longBelowGoal')).toBe(true)
  })
})

describe('akcenty w profilu sezonu', () => {
  const steady: PlannedWorkout = {
    kind: 'quality_continuous', distanceKm: 10, ruleRefs: [],
    segments: [
      { type: 'warmup', distanceKm: 3, description: '' },
      { type: 'steady', distanceKm: 6, description: '' },
      { type: 'cooldown', distanceKm: 1, description: '' },
    ],
  }
  const hills: PlannedWorkout = {
    kind: 'easy_hills', distanceKm: 13, ruleRefs: [],
    segments: [
      { type: 'easy', distanceKm: 6, description: '' },
      { type: 'hills', reps: 15, repM: 200, distanceKm: 6, description: '' },
      { type: 'cooldown', distanceKm: 1, description: '' },
    ],
  }
  it('odcinek steady liczy się jako praca poza Z1, podbiegi w połowie', () => {
    const [row] = seasonProfile([week('2027-01-04', { tue: steady, thu: hills, sat: long(18) })])
    expect(row!.accents.map((a) => a.hardKm)).toEqual([6, 3])
  })
  it('dawka bez słów w żadnym języku', () => {
    const line = seasonLine(seasonProfile([week('2027-01-04', { tue: steady, thu: hills, sat: long(18) })])[0]!)
    expect(line.replace(/quality_continuous|easy_hills|build/g, '').replace(/\bkm\b/g, '')).not.toMatch(/[a-ząćęłńóśźż]{3,}/i)
  })
})

describe('postRaceAccentHeavy', () => {
  const intervals = (reps: number): PlannedWorkout => ({
    kind: 'quality_intervals', distanceKm: 4 + reps, ruleRefs: [],
    segments: [
      { type: 'warmup', distanceKm: 3, description: '' },
      { type: 'intervals', reps, repM: 1000, distanceKm: reps, description: '' },
      { type: 'cooldown', distanceKm: 1, description: '' },
    ],
  })
  it('sufit to ostatni blok budowania, nie najlżejszy tydzień całego budowania', () => {
    const deload = week('2027-01-11', { tue: easy(8), sat: long(12) })
    deload.skeleton.deload = true
    const weeks = [
      week('2027-01-04', { tue: intervals(2), sat: long(16) }),
      deload,
      week('2027-01-18', { tue: intervals(4), sat: long(18) }),
      week('2027-01-25', { tue: intervals(3), sat: long(8) }, 'transition'),
    ]
    expect(seasonShapeIssues({ goal: half, weeks }).some((i) => i.code === 'postRaceAccentHeavy')).toBe(false)
    weeks[3] = week('2027-01-25', { tue: intervals(5), sat: long(8) }, 'transition')
    expect(seasonShapeIssues({ goal: half, weeks }).some((i) => i.code === 'postRaceAccentHeavy')).toBe(true)
  })
})

describe('postRaceAccentHeavy: sufit odporny na jedną krótką jednostkę', () => {
  const accent = (main: number): PlannedWorkout => ({
    kind: 'quality_intervals', distanceKm: 4 + main, ruleRefs: [],
    segments: [
      { type: 'warmup', distanceKm: 3, description: '' },
      { type: 'intervals', reps: main, repM: 1000, distanceKm: main, description: '' },
      { type: 'cooldown', distanceKm: 1, description: '' },
    ],
  })
  it('jeden akcent 1 km w bloku nie zbija sufitu do 1 km', () => {
    const weeks = [
      week('2027-01-04', { tue: accent(6), sun: accent(1), sat: long(18) }),
      week('2027-01-11', { tue: accent(6), sun: accent(5), sat: long(18) }),
      week('2027-01-18', { tue: accent(5), sat: long(8) }, 'transition'),
    ]
    expect(seasonShapeIssues({ goal: half, weeks }).some((i) => i.code === 'postRaceAccentHeavy')).toBe(false)
  })
})

describe('longRunThreshold: klasa dystansu jak w recommendedPeakKm', () => {
  it('maraton, półmaraton, 10 km, ultra', () => {
    expect(longRunThreshold({ kind: 'race', distanceKm: 42.195 })).toMatchObject({ km: 25, ruleRefs: ['P-8', 'J-1'] })
    expect(longRunThreshold({ kind: 'race', distanceKm: 21.0975 })).toMatchObject({ km: 21, ruleRefs: ['J-2', 'P-7'] })
    expect(longRunThreshold({ kind: 'race', distanceKm: 10 })).toBeUndefined()
    // ultra nie ma progu w źródłach (T-8) — lint się nie wypowiada
    expect(longRunThreshold({ kind: 'race', distanceKm: 50 })).toBeUndefined()
  })
})

describe('postRaceAccentHeavy: mediana i kolejność cykli', () => {
  const accent = (main: number): PlannedWorkout => ({
    kind: 'quality_intervals', distanceKm: 4 + main, ruleRefs: [],
    segments: [
      { type: 'warmup', distanceKm: 3, description: '' },
      { type: 'intervals', reps: main, repM: 1000, distanceKm: main, description: '' },
      { type: 'cooldown', distanceKm: 1, description: '' },
    ],
  })
  const flagged = (weeks: Microcycle[]) => seasonShapeIssues({ goal: half, weeks }).filter((i) => i.code === 'postRaceAccentHeavy').map((i) => i.date)

  it('parzysta liczba akcentów: średnia dwóch środkowych (1 i 6 km → 3,5 km)', () => {
    const weeks = [
      week('2027-01-04', { tue: accent(1), sun: accent(6), sat: long(18) }),
      week('2027-01-11', { tue: accent(3), sat: long(8) }, 'transition'),
    ]
    expect(flagged(weeks)).toEqual([])
    weeks[1] = week('2027-01-11', { tue: accent(4), sat: long(8) }, 'transition')
    expect(flagged(weeks)).toEqual(['2027-01-11'])
  })

  it('kilka cykli: tydzień przejściowy porównany z budowaniem przed nim, nie z następnym cyklem', () => {
    const weeks = [
      week('2027-01-04', { tue: accent(4), sat: long(18) }),
      week('2027-01-11', { tue: accent(4), sat: long(8) }, 'transition'),
      week('2027-01-18', { tue: easy(8), sat: long(12) }, 'base'),
      week('2027-01-25', { tue: accent(2), sat: long(14) }),
    ]
    expect(flagged(weeks)).toEqual([])
  })
})

describe('linty oceniają bieżący cykl', () => {
  it('długie 30 km z poprzedniego cyklu nie spełnia progu nowego półmaratonu', () => {
    const weeks = [
      week('2026-12-07', { tue: easy(10), sat: long(30) }),
      week('2027-01-04', { tue: easy(10), sat: long(18) }),
    ]
    const codes = (cycleStart?: string) => seasonShapeIssues({ goal: half, weeks, ...(cycleStart ? { cycleStart } : {}) }).map((i) => i.code)
    expect(codes()).not.toContain('longBelowGoal')
    expect(codes('2027-01-04')).toContain('longBelowGoal')
  })
})

describe('siedemnasta runda: długie wobec akcentów, R-8 bez budowania', () => {
  const continuous = (main: number): PlannedWorkout => ({
    kind: 'quality_continuous', distanceKm: 4 + main, ruleRefs: [],
    segments: [
      { type: 'warmup', distanceKm: 3, description: '' },
      { type: 'steady', distanceKm: main, description: '' },
      { type: 'cooldown', distanceKm: 1, description: '' },
    ],
  })
  it('akcent dłuższy od długiego to longNotLongest (J-1, S-2)', () => {
    const weeks = [week('2027-01-04', { tue: continuous(8), sat: long(10) })]
    expect(seasonShapeIssues({ goal: half, weeks }).some((i) => i.code === 'longNotLongest')).toBe(true)
  })
  it('plan bez budowania: R-8 z ostatniego bloku ładowania (szczyt)', () => {
    const weeks = [
      week('2027-01-04', { tue: continuous(3), sat: long(16) }, 'peak'),
      week('2027-01-11', { tue: continuous(6), sat: long(8) }, 'transition'),
    ]
    expect(seasonShapeIssues({ goal: half, weeks }).some((i) => i.code === 'postRaceAccentHeavy')).toBe(true)
  })
})

describe('osiemnasta runda: dwa długie w tygodniu, R-8 w kolejnym cyklu', () => {
  const continuous = (main: number): PlannedWorkout => ({
    kind: 'quality_continuous', distanceKm: 4 + main, ruleRefs: [],
    segments: [
      { type: 'warmup', distanceKm: 3, description: '' },
      { type: 'steady', distanceKm: main, description: '' },
      { type: 'cooldown', distanceKm: 1, description: '' },
    ],
  })
  it('dwa długie: porównujemy najdłuższe z nich z resztą tygodnia', () => {
    const weeks = [week('2027-01-04', { tue: easy(14), sat: long(12), sun: long(16) })]
    expect(seasonShapeIssues({ goal: half, weeks }).some((i) => i.code === 'longNotLongest')).toBe(false)
  })
  it('drugi cykl bez budowania: sufit z jego bloku ładowania, nie z budowania poprzedniego cyklu', () => {
    const weeks = [
      week('2027-01-04', { tue: continuous(6), sat: long(18) }),
      week('2027-01-11', { tue: easy(6), sat: long(8) }, 'transition'),
      week('2027-01-18', { tue: continuous(3), sat: long(14) }, 'base'),
      week('2027-01-25', { tue: continuous(5), sat: long(8) }, 'transition'),
    ]
    expect(seasonShapeIssues({ goal: half, weeks }).filter((i) => i.code === 'postRaceAccentHeavy').map((i) => i.date)).toEqual(['2027-01-25'])
  })
})

describe('dziewiętnasta runda: bieżący cykl bez cycleStart', () => {
  it('plan z historią bez cycleStart: linty od pierwszego tygodnia ładowania po bloku przejściowym', () => {
    const weeks = [
      week('2026-12-07', { tue: easy(10), sat: long(30) }),
      week('2026-12-14', { tue: easy(6), sat: long(8) }, 'transition'),
      week('2026-12-21', { tue: easy(10), sat: long(18) }),
    ]
    expect(seasonShapeIssues({ goal: half, weeks }).map((i) => i.code)).toContain('longBelowGoal')
  })
})

describe('dwudziesta pierwsza runda: cykl bez tygodni ładowania', () => {
  it('cykl z samym taperem i startem: bez longBelowGoal', () => {
    const weeks = [week('2027-01-04', { tue: easy(8), sat: easy(6) }, 'taper'), week('2027-01-11', { tue: easy(5) }, 'race')]
    expect(seasonShapeIssues({ goal: half, weeks }).map((i) => i.code)).not.toContain('longBelowGoal')
  })
  it('nowy cykl zaczęty taperem po bloku przejściowym: linty nie sięgają do poprzedniego cyklu', () => {
    const deload = week('2026-12-07', { tue: easy(15), sat: long(13) })
    deload.skeleton.deload = true
    const weeks = [
      deload,
      week('2026-12-14', { tue: easy(6), sat: long(8) }, 'transition'),
      week('2026-12-21', { tue: easy(8), sat: easy(6) }, 'taper'),
      week('2026-12-28', { tue: easy(5) }, 'race'),
    ]
    expect(seasonShapeIssues({ goal: half, weeks }).map((i) => i.code)).not.toContain('longNotLongest')
  })
})

describe('etap 2: linty kształtu na syntetycznych tygodniach', () => {
  const codes = (weeks: Microcycle[]) => seasonShapeIssues({ goal: half, weeks }).map((i) => i.code)
  const quality = (main: number): PlannedWorkout => ({
    kind: 'quality_intervals', distanceKm: 4 + main, ruleRefs: [],
    segments: [
      { type: 'warmup', distanceKm: 3, description: '' },
      { type: 'intervals', reps: main, repM: 1000, distanceKm: main, description: '' },
      { type: 'cooldown', distanceKm: 1, description: '' },
    ],
  })

  it('sessionShareHigh: bieg spokojny ponad 35% tygodnia obok długiego (P1, czwartek 17 km)', () => {
    expect(codes([week('2027-01-04', { tue: easy(8), thu: easy(17), sat: long(19) })])).toContain('sessionShareHigh')
    expect(codes([week('2027-01-04', { tue: easy(8), thu: easy(14), sat: long(19) })])).not.toContain('sessionShareHigh')
  })

  it('sessionShareHigh: tydzień bez długiego i tydzień z dwoma biegami nie mają czego chronić', () => {
    expect(codes([week('2027-01-04', { tue: quality(4), thu: easy(13), sat: easy(13) }, 'taper')])).not.toContain('sessionShareHigh')
    expect(codes([week('2027-01-04', { tue: easy(10), sat: long(12) })])).not.toContain('sessionShareHigh')
  })

  it('deloadNotLighter: odciążenie cięższe od sąsiedniego tygodnia ładowania (P-2)', () => {
    const deload = week('2027-01-11', { tue: easy(10), sat: long(16) })
    deload.skeleton.deload = true
    const weeks = [week('2027-01-04', { tue: easy(8), sat: long(16) }), deload, week('2027-01-18', { tue: easy(12), sat: long(18) })]
    expect(seasonShapeIssues({ goal: half, weeks }).filter((i) => i.code === 'deloadNotLighter').map((i) => i.values)).toEqual([[26, 24]])
  })

  it('sessionShareHigh: bieg o długości najkrótszego biegu (3 km) w tygodniu poniżej 8,6 km nie jest za duży (E-3)', () => {
    const small = week('2027-01-04', { tue: easy(3), thu: long(5) })
    expect(seasonShapeIssues({ goal: half, weeks: [{ ...small, days: small.days.map((d) => d.weekday === 'sat' ? { ...d, workout: { kind: 'race', distanceKm: 0, ruleRefs: [], segments: [] } } : d) }] }).filter((i) => i.code === 'sessionShareHigh')).toEqual([])
    // dłuższy bieg nadal tak
    const heavy = week('2027-01-04', { tue: easy(3.5), thu: long(4.5) })
    expect(seasonShapeIssues({ goal: half, weeks: [{ ...heavy, days: heavy.days.map((d) => d.weekday === 'sat' ? { ...d, workout: { kind: 'race', distanceKm: 0, ruleRefs: [], segments: [] } } : d) }] }).filter((i) => i.code === 'sessionShareHigh')).toHaveLength(1)
  })

  it('deloadNotLighter: tydzień sprawdzianu i startu kontrolnego nie jest odniesieniem (T-9, T-10)', () => {
    const deload = week('2027-01-11', { tue: easy(10), sat: long(16) })
    deload.skeleton.deload = true
    // po odciążeniu tydzień sprawdzianu, lżejszy z założenia; dalej zwykły tydzień ładowania
    const test = week('2027-01-18', { tue: easy(8), sat: long(14) })
    test.skeleton.testPlanned = true
    const tuneUp = week('2027-01-04', { tue: easy(6), sat: long(12) })
    tuneUp.skeleton.tuneUp = { date: '2027-01-10', distanceKm: 10, priority: 'B' }
    const weeks = [tuneUp, deload, test, week('2027-01-25', { tue: easy(12), sat: long(18) })]
    expect(seasonShapeIssues({ goal: half, weeks }).filter((i) => i.code === 'deloadNotLighter')).toEqual([])
  })

  it('staleProgression: dwa bloki budowania kończą się tą samą dawką i tym samym długim (P-1)', () => {
    const block = (start: string, km: number) => week(start, { tue: quality(4), sat: long(km) })
    const deload = week('2027-01-25', { tue: quality(3), sat: long(12) })
    deload.skeleton.deload = true
    const same = [block('2027-01-04', 18), block('2027-01-11', 18), block('2027-01-18', 18), deload, block('2027-02-01', 18), block('2027-02-08', 18)]
    expect(codes(same)).toContain('staleProgression')
    const growing = [...same.slice(0, 5), block('2027-02-08', 20)]
    expect(codes(growing)).not.toContain('staleProgression')
  })

  it('staleProgression: bloki porównane tydzień do tygodnia od końca, bez tygodnia sprawdzianu', () => {
    const block = (start: string, km: number) => week(start, { tue: quality(4), sat: long(km) })
    const test = (start: string) => {
      const w = week(start, { tue: quality(4), sat: long(16) })
      w.skeleton.testPlanned = true
      return w
    }
    const deload = week('2027-01-25', { tue: quality(3), sat: long(12) })
    deload.skeleton.deload = true
    // drugi blok kończy się sprawdzianem: porównujemy pozostałe pozycje, a tam długie rośnie
    const rising = [block('2027-01-04', 18), block('2027-01-11', 18), block('2027-01-18', 18), deload, block('2027-02-01', 18), block('2027-02-08', 20), test('2027-02-15')]
    expect(codes(rising)).not.toContain('staleProgression')
    const flat = [block('2027-01-04', 18), block('2027-01-11', 18), block('2027-01-18', 18), deload, block('2027-02-01', 18), block('2027-02-08', 18), test('2027-02-15')]
    expect(codes(flat)).toContain('staleProgression')
  })

  it('staleProgression: jeden porównywalny tydzień to za mało — szczyt przed taperem nie jest powtórzonym blokiem', () => {
    const block = (start: string, km: number) => week(start, { tue: quality(4), sat: long(km) })
    const deload = week('2027-01-25', { tue: quality(3), sat: long(12) })
    deload.skeleton.deload = true
    const peakWeek = [block('2027-01-04', 18), block('2027-01-11', 20), block('2027-01-18', 22), deload, block('2027-02-01', 22)]
    expect(codes(peakWeek)).not.toContain('staleProgression')
  })
})
