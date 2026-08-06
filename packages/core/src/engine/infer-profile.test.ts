import { describe, expect, it } from 'vitest'
import type { SyncedActivity } from '../ports/sync.ts'
import { addDays, mondayOf } from '../util/dates.ts'
import { setLocale } from '../i18n/index.ts'
import { inferProfile } from './infer-profile.ts'

// Ten plik weryfikuje LOGIKĘ inferencji; komunikaty czytamy po polsku dla
// czytelności asercji. Kompletność tłumaczeń pilnuje i18n/i18n.test.ts.
setLocale('pl')

// „dziś" = środa; ostatni pełny tydzień kończy się w niedzielę 2026-08-02
const TODAY = '2026-08-05'
const CURRENT_MONDAY = mondayOf(TODAY) // 2026-08-03

let idCounter = 0
function run(date: string, distanceKm: number, extra: Partial<SyncedActivity> = {}): SyncedActivity {
  return {
    externalId: `a${idCounter++}`,
    date,
    type: 'Run',
    distanceKm,
    movingTimeSec: Math.round(distanceKm * 330), // ~5:30/km — spokojne tło
    ...extra,
  }
}

/** Regularne tygodnie: wt 8, cz 10, sb long, nd 6 — weekOffset licząc wstecz od bieżącego. */
function regularWeek(weekOffset: number, longKm = 18): SyncedActivity[] {
  const monday = addDays(CURRENT_MONDAY, -7 * weekOffset)
  return [
    run(addDays(monday, 1), 8),
    run(addDays(monday, 3), 10),
    run(addDays(monday, 5), longKm),
    run(addDays(monday, 6), 6),
  ]
}

describe('inferProfile — regularna historia', () => {
  const activities = Array.from({ length: 16 }, (_, i) => regularWeek(i + 1)).flat()
  const result = inferProfile(activities, TODAY)

  it('liczy medianę objętości z ostatnich 4 pełnych tygodni', () => {
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.profile.recentWeeklyKm).toBe(42) // 8+10+18+6
    expect(result.profile.recentBasis).toContain('mediana')
  })

  it('rozpoznaje dni treningowe i długie wybieganie w sobotę', () => {
    if (!result.ok) return
    expect(result.profile.daysAvailable).toEqual(['tue', 'thu', 'sat', 'sun'])
    expect(result.profile.longRunDay).toBe('sat')
  })

  it('bez wahań objętości nie proponuje peakWeeklyKm powyżej recent', () => {
    if (!result.ok) return
    expect(result.profile.peakWeeklyKm).toBeUndefined()
    expect(result.profile.weeklyKm).toHaveLength(16)
  })

  it('bieżący, niepełny tydzień nie zaniża mediany', () => {
    const withCurrent = [...activities, run(addDays(CURRENT_MONDAY, 1), 3)]
    const r = inferProfile(withCurrent, TODAY)
    expect(r.ok && r.profile.recentWeeklyKm).toBe(42)
  })
})

describe('inferProfile — historia z cięższym blokiem w przeszłości', () => {
  it('peak = najwyższy pełny tydzień okna, recent = ostatni blok', () => {
    // tygodnie 5–8 wstecz cięższe (long 30 → 54 km), ostatnie 4 regularne 42 km
    const activities = [
      ...Array.from({ length: 4 }, (_, i) => regularWeek(i + 1)).flat(),
      ...Array.from({ length: 4 }, (_, i) => regularWeek(i + 5, 30)).flat(),
      ...Array.from({ length: 8 }, (_, i) => regularWeek(i + 9)).flat(),
    ]
    const r = inferProfile(activities, TODAY)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.profile.recentWeeklyKm).toBe(42)
    expect(r.profile.peakWeeklyKm).toBe(54)
  })
})

describe('inferProfile — przerwy i dziury', () => {
  it('przerwa ≥10 dni na końcu okna: caveat + objętość z ostatniego aktywnego bloku', () => {
    // biegał tygodnie 3..16 wstecz, ostatnie 2 tygodnie nic
    const activities = Array.from({ length: 14 }, (_, i) => regularWeek(i + 3)).flat()
    const r = inferProfile(activities, TODAY)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.profile.caveats.some((c) => c.includes('restart po przerwie'))).toBe(true)
    expect(r.profile.recentWeeklyKm).toBe(42) // z bloku sprzed przerwy, nie 0
  })

  it('dziura urlopowa w bloku odniesienia: mediana z tygodni aktywnych + caveat', () => {
    // tydzień -2 pusty (urlop), reszta regularna
    const activities = Array.from({ length: 16 }, (_, i) => i + 1)
      .filter((offset) => offset !== 2)
      .flatMap((offset) => regularWeek(offset))
    const r = inferProfile(activities, TODAY)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.profile.recentWeeklyKm).toBe(42)
    expect(r.profile.caveats.some((c) => c.includes('zerowe'))).toBe(true)
  })

  it('mniej niż 4 aktywne tygodnie → uczciwe „za mało danych"', () => {
    const activities = [regularWeek(1), regularWeek(2), regularWeek(3)].flat()
    const r = inferProfile(activities, TODAY)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.reason).toContain('za mało')
  })

  it('konto bez biegów → czytelna odmowa', () => {
    const r = inferProfile([run('2026-07-14', 40, { type: 'Ride' })], TODAY)
    expect(r.ok).toBe(false)
  })
})

describe('inferProfile — filtr typów', () => {
  it('Ride i Walk nie wchodzą do objętości biegowej', () => {
    const activities = [
      ...Array.from({ length: 16 }, (_, i) => regularWeek(i + 1)).flat(),
      ...Array.from({ length: 16 }, (_, i) =>
        run(addDays(CURRENT_MONDAY, -7 * (i + 1)), 60, { type: 'Ride' }),
      ),
      run(addDays(CURRENT_MONDAY, -3), 5, { type: 'Walk' }),
    ]
    const r = inferProfile(activities, TODAY)
    expect(r.ok && r.profile.recentWeeklyKm).toBe(42)
  })
})

describe('inferProfile — kandydaci na starty', () => {
  it('dystans standardowy + startowa nazwa → kandydat z powodem', () => {
    const raceDate = addDays(CURRENT_MONDAY, -10)
    const activities = [
      ...Array.from({ length: 16 }, (_, i) => regularWeek(i + 1)).flat(),
      run(raceDate, 10.05, { name: 'Bieg Niepodległości', movingTimeSec: 2550 }),
    ]
    const r = inferProfile(activities, TODAY)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const c = r.profile.raceCandidates.find((x) => x.date === raceDate)
    expect(c).toBeDefined()
    expect(c!.distanceKm).toBe(10)
    expect(c!.timeSec).toBe(2550)
    expect(c!.reason).toContain('nazwa')
  })

  it('szybki trening na dystansie niestandardowym NIE jest kandydatem', () => {
    const activities = [
      ...Array.from({ length: 16 }, (_, i) => regularWeek(i + 1)).flat(),
      run(addDays(CURRENT_MONDAY, -4), 7.3, { movingTimeSec: 7.3 * 250 }), // szybko, ale 7,3 km
    ]
    const r = inferProfile(activities, TODAY)
    expect(r.ok && r.profile.raceCandidates).toEqual([])
  })

  it('dystans standardowy w tempie z górnego decyla → kandydat nawet bez nazwy', () => {
    const raceDate = addDays(CURRENT_MONDAY, -18)
    const activities = [
      ...Array.from({ length: 16 }, (_, i) => regularWeek(i + 1)).flat(),
      run(raceDate, 5.05, { movingTimeSec: Math.round(5.05 * 240) }), // 4:00/km vs tło 5:30
    ]
    const r = inferProfile(activities, TODAY)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.profile.raceCandidates.some((c) => c.date === raceDate && c.reason.includes('decyl'))).toBe(true)
  })
})
