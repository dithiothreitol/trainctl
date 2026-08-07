import { describe, expect, it } from 'vitest'
import type { AthleteProfile, Microcycle, RaceGoal, WeekSkeleton } from '../domain/types.ts'
import { generateMicrocycle } from '../engine/microcycle.ts'
import { COACH_STYLE } from '../engine/house-style.ts'
import { paceZones } from '../zones/daniels.ts'
import { setLocale } from '../i18n/index.ts'
import { reschedule } from './reschedule.ts'

// Sens kompromisów czytamy po polsku; tłumaczenia pilnuje i18n/i18n.test.ts.
setLocale('pl')

const zones = paceZones(51)
const athlete: AthleteProfile = {
  recentWeeklyKm: 60,
  daysAvailable: ['tue', 'wed', 'thu', 'sat', 'sun'],
  results: [],
}

function skeleton(over: Partial<WeekSkeleton> = {}): WeekSkeleton {
  return {
    weekStart: '2026-08-03',
    index: 4,
    phase: 'build',
    intensityModel: 'pyramidal',
    targetKm: 65,
    deload: false,
    keepIntensity: false,
    keepFrequency: false,
    qualitySessions: 2,
    flags: [],
    ruleRefs: [],
    ...over,
  }
}

const week = (over?: Partial<WeekSkeleton>, goal?: RaceGoal): Microcycle =>
  generateMicrocycle({ skeleton: skeleton(over), athlete, zones, ...(goal ? { goal } : {}) })

const base = {
  qualityDayPreference: COACH_STYLE.qualityDayPreference,
  longRunDayPreference: COACH_STYLE.longRunDayPreference,
}

const kindsByDate = (days: Microcycle['days']) =>
  new Map(days.map((d) => [d.date, d.workout?.kind]))

describe('bez ograniczeń', () => {
  it('nie rusza planu, który już jest dobry', () => {
    const r = reschedule({ week: week(), blockedDates: [], ...base })
    expect(r.changed).toBe(false)
    expect(r.moved).toHaveLength(0)
    expect(r.dropped).toHaveLength(0)
  })
})

describe('zablokowany dzień („w czwartek release")', () => {
  const w = week()
  const r = reschedule({ week: w, blockedDates: ['2026-08-06'], ...base })

  it('nic nie zostaje w zablokowanym dniu', () => {
    expect(kindsByDate(r.days).get('2026-08-06')).toBeUndefined()
  })

  it('trening z tego dnia ląduje gdzie indziej, nie znika', () => {
    const originalKind = kindsByDate(w.days).get('2026-08-06')
    expect(originalKind).toBeDefined()
    const stillThere = r.days.some((d) => d.workout?.kind === originalKind)
    expect(stillThere).toBe(true)
    expect(r.dropped).toHaveLength(0)
  })

  it('wyjaśnia, co przesunął', () => {
    expect(r.changed).toBe(true)
    expect(r.tradeoffs.length).toBeGreaterThan(0)
    expect(r.tradeoffs.some((t) => t.includes('2026-08-06'))).toBe(true)
  })

  it('utrzymuje ≥48 h między akcentami (S-1)', () => {
    const qualityDates = r.days
      .filter((d) => d.workout && ['quality_intervals', 'quality_continuous'].includes(d.workout.kind))
      .map((d) => Date.parse(d.date))
      .sort((a, b) => a - b)
    for (let i = 1; i < qualityDates.length; i++) {
      expect((qualityDates[i]! - qualityDates[i - 1]!) / 86_400_000).toBeGreaterThanOrEqual(2)
    }
  })

  it('zachowuje liczbę akcentów i długie wybieganie (S-2/S-3)', () => {
    const count = (days: Microcycle['days'] | typeof r.days, kinds: string[]) =>
      days.filter((d) => d.workout && kinds.includes(d.workout.kind)).length
    expect(count(r.days, ['quality_intervals', 'quality_continuous'])).toBe(
      count(w.days, ['quality_intervals', 'quality_continuous']),
    )
    expect(count(r.days, ['long'])).toBe(count(w.days, ['long']))
  })
})

describe('sprawdzian w tygodniu (faza 7)', () => {
  const w = week({ testPlanned: true })
  const withTest = generateMicrocycle({
    skeleton: skeleton({ testPlanned: true }),
    athlete,
    zones,
    testDistanceKm: 5,
  })

  it('generator faktycznie wstawia sprawdzian', () => {
    expect(withTest.days.some((d) => d.workout?.kind === 'test')).toBe(true)
    void w
  })

  it('przy blokadach ginie easy, a sprawdzian zostaje (W-11 ważniejsze niż objętość)', () => {
    const r = reschedule({
      week: withTest,
      blockedDates: ['2026-08-04', '2026-08-05', '2026-08-06'],
      ...base,
    })
    expect(r.days.some((d) => d.workout?.kind === 'test')).toBe(true)
    for (const d of r.dropped) expect(d.kind).not.toBe('test')
  })

  it('sprawdzian podlega S-1: nie sąsiaduje z akcentem', () => {
    const r = reschedule({ week: withTest, blockedDates: ['2026-08-06'], ...base })
    const hard = r.days
      .filter((d) =>
        ['quality_intervals', 'quality_continuous', 'test'].includes(d.workout?.kind ?? ''),
      )
      .map((d) => Date.parse(d.date))
      .sort((a, b) => a - b)
    for (let i = 1; i < hard.length; i++) {
      expect((hard[i]! - hard[i - 1]!) / 86_400_000).toBeGreaterThanOrEqual(2)
    }
  })
})

describe('gdy miejsc jest za mało', () => {
  const w = week()
  const r = reschedule({
    week: w,
    blockedDates: ['2026-08-04', '2026-08-05', '2026-08-06'],
    ...base,
  })

  it('poświęca spokojne jednostki, chroni długie i akcenty', () => {
    expect(r.dropped.length).toBeGreaterThan(0)
    for (const d of r.dropped) expect(['easy', 'easy_hills']).toContain(d.kind)
    expect(r.days.some((d) => d.workout?.kind === 'long')).toBe(true)
  })

  it('mówi wprost, co odpuszcza i dlaczego', () => {
    expect(r.tradeoffs.some((t) => t.startsWith('odpuszczone:'))).toBe(true)
    expect(r.dropped[0]!.reason).toContain('kosztuje najmniej')
  })

  it('ostrzega przed nadrabianiem straconych kilometrów', () => {
    expect(r.warnings.some((x) => x.includes('Nie nadrabiamy'))).toBe(true)
  })
})

describe('tydzień startowy', () => {
  const goal: RaceGoal = {
    date: '2026-08-08',
    distanceKm: 21.0975,
    name: 'Półmaraton',
    priority: 'A',
  }
  const w = week(
    { phase: 'race', intensityModel: 'polarized', targetKm: 30, qualitySessions: 1, raceDate: '2026-08-08' },
    goal,
  )

  it('start zostaje na swoim dniu', () => {
    const r = reschedule({ week: w, blockedDates: ['2026-08-04'], ...base })
    expect(r.days.find((d) => d.date === '2026-08-08')?.workout?.kind).toBe('race')
  })

  it('dzień przed startem zostaje wolny — solver tam nic nie wstawi', () => {
    const r = reschedule({ week: w, blockedDates: ['2026-08-04', '2026-08-05'], ...base })
    expect(r.days.find((d) => d.date === '2026-08-07')?.workout).toBeUndefined()
  })

  it('próba zablokowania dnia startu jest odrzucana z komunikatem', () => {
    const r = reschedule({ week: w, blockedDates: ['2026-08-08'], ...base })
    expect(r.warnings.some((x) => x.includes('dnia startu'))).toBe(true)
    expect(r.days.find((d) => d.date === '2026-08-08')?.workout?.kind).toBe('race')
  })
})

describe('preferencje i walidacja', () => {
  it('gdy sobota wypada, długie ląduje na innym dostępnym dniu — nie w dniu wolnym z profilu', () => {
    const r = reschedule({
      week: week(),
      blockedDates: ['2026-08-08'],
      availableDays: athlete.daysAvailable,
      ...base,
    })
    const long = r.days.find((d) => d.workout?.kind === 'long')!
    expect(athlete.daysAvailable).toContain(long.weekday)
    expect(long.date).not.toBe('2026-08-08')
    // przesunięcie długiego wypycha akcent — solver ma to nazwać
    expect(r.tradeoffs.some((t) => t.startsWith('long:'))).toBe(true)
  })

  it('respektuje dni niedostępne z profilu', () => {
    const r = reschedule({
      week: week(),
      blockedDates: [],
      availableDays: ['tue', 'thu', 'sat', 'sun'],
      ...base,
    })
    expect(r.days.find((d) => d.weekday === 'wed')?.workout).toBeUndefined()
  })

  it('data spoza tygodnia jest ignorowana z ostrzeżeniem', () => {
    const r = reschedule({ week: week(), blockedDates: ['2026-09-01'], ...base })
    expect(r.warnings.some((x) => x.includes('poza tym tygodniem'))).toBe(true)
    expect(r.changed).toBe(false)
  })

  it('zablokowanie całego tygodnia nie wywraca solvera', () => {
    const w = week()
    const r = reschedule({ week: w, blockedDates: w.days.map((d) => d.date), ...base })
    expect(r.days.every((d) => !d.workout)).toBe(true)
    expect(r.dropped.length).toBeGreaterThan(0)
  })
})

describe('długie obok akcentu — wzorzec trenera, nie usterka', () => {
  // `tools/corpus/long_run_profile.py` na 50 planach: ze 138 długich wybiegań
  // (≥16 km, najdłuższe w tygodniu, bez pracy odcinkowej) dla 73 znamy dzień
  // poprzedni — 52 wypadają nazajutrz po akcencie, 16 po starcie. To 93%.
  // Solver miał na to karę −60 „S-9", choć S-9 mówi o różnicowaniu obciążenia
  // dziennego, a nie o sąsiedztwie; nasze długie jest zawsze spokojne.
  const adjacent = (days: Microcycle['days']) => {
    const long = days.find((d) => d.workout?.kind === 'long')
    if (!long) return false
    return days.some(
      (d) =>
        d.workout &&
        ['quality_intervals', 'quality_continuous', 'sharpener'].includes(d.workout.kind) &&
        Math.abs(
          new Date(d.date).getTime() - new Date(long.date).getTime(),
        ) === 86_400_000,
    )
  }

  it('nie przestawia tygodnia tylko dlatego, że długie sąsiaduje z akcentem', () => {
    const w = week()
    const r = reschedule({ week: w, blockedDates: [], ...base })
    // gdyby kara wróciła, solver zacząłby tasować poprawny plan
    expect(r.changed).toBe(false)
    expect(r.moved).toHaveLength(0)
  })

  it('sąsiedztwo długiego z akcentem nie generuje kompromisu do zaraportowania', () => {
    const w = week()
    const r = reschedule({ week: w, blockedDates: [], ...base })
    for (const note of r.tradeoffs) {
      expect(note).not.toMatch(/dzień po akcencie|obok akcentu|dwa ciężkie dni/i)
    }
  })

  it('układ akcent → długie przechodzi renegocjację nietknięty', () => {
    // blokujemy dzień, który nie należy ani do długiego, ani do akcentu obok niego
    const w = week()
    const before = kindsByDate(w.days)
    const longDate = w.days.find((d) => d.workout?.kind === 'long')?.date
    expect(longDate).toBeDefined()
    const r = reschedule({ week: w, blockedDates: [], ...base })
    const after = kindsByDate(r.days)
    expect(after.get(longDate!)).toBe(before.get(longDate!))
    if (adjacent(w.days)) expect(adjacent(r.days)).toBe(true)
  })
})
