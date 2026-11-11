import { describe, expect, it } from 'vitest'
import type { AthleteProfile, Microcycle, RaceGoal, Weekday, WeekSkeleton } from '../domain/types.ts'
import { planMacrocycle } from './macrocycle.ts'
import { paceZones } from '../zones/daniels.ts'
import { setLocale } from '../i18n/index.ts'
import { fmtPace, generateMicrocycle, kmText, SESSION_SHARE_MAX, weekCapacityKm } from './microcycle.ts'

// Ten plik weryfikuje HOUSE STYLE TRENERA, czyli polskie brzmienie opisów
// (korpus 2020–2025). Angielski ma własny plik — microcycle-i18n.test.ts.
//
// Język ustawiamy na poziomie MODUŁU, nie w beforeAll: ciała `describe`
// wykonują się w fazie zbierania testów, czyli zanim beforeAll zdąży wystartować,
// a niektóre z nich budują mikrocykl od razu (`const mc = generateMicrocycle(...)`).
setLocale('pl')

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

describe('B1: liczba biegów i układ tygodnia (S-10, S-11)', () => {
  const DAYS: Record<number, Weekday[]> = { 3: ['tue', 'thu', 'sat'], 4: ['tue', 'thu', 'sat', 'sun'], 5: ['tue', 'wed', 'thu', 'sat', 'sun'] }
  const runs = (mc: Microcycle) => mc.days.flatMap((d) => (d.workout ? [d.workout] : []))
  for (const days of [3, 4, 5]) {
    for (const km of [30, 45, 60]) {
      it(`${days} dni, ${km} km: bieg spokojny pod długim, żadna jednostka ponad 35% obok długiego`, () => {
        const mc = generateMicrocycle({ skeleton: skeleton({ targetKm: km, qualitySessions: days >= 4 ? 2 : 1 }), athlete: { ...athlete, daysAvailable: DAYS[days]! }, zones })
        const long = runs(mc).find((w) => w.kind === 'long')!
        for (const w of runs(mc).filter((x) => x.kind === 'easy')) {
          expect(w.distanceKm).toBeLessThanOrEqual(0.9 * long.distanceKm + 0.05) // S-10
          expect(w.distanceKm).toBeGreaterThanOrEqual(3) // E-3: MIN_EASY_KM
        }
        if (runs(mc).length >= 3) {
          for (const w of runs(mc).filter((x) => x.kind !== 'long')) expect(w.distanceKm).toBeLessThanOrEqual(SESSION_SHARE_MAX * mc.totalKm + 0.05)
        }
        // tydzień krótszy od zamiaru zapisuje, ile dni mieszczą, i mówi o tym uwagą
        if (mc.totalKm < km - 0.5) {
          expect(mc.skeleton.layoutKm).toBeCloseTo(mc.totalKm, 1)
          expect(mc.notes).toContainEqual(expect.objectContaining({ code: 'volumeShort', targetKm: km }))
        } else expect(mc.skeleton.layoutKm).toBeUndefined()
      })
    }
  }

  it('reszta ponad sufit dostaje kolejny dzień zamiast biegu dłuższego od długiego', () => {
    // dawny P1 w odciążeniu: długie 13 km i spokojne 15 km
    const mc = generateMicrocycle({ skeleton: skeleton({ targetKm: 36, deload: true }), athlete, zones })
    const long = runs(mc).find((w) => w.kind === 'long')!
    expect(Math.max(...runs(mc).filter((w) => w.kind !== 'long').map((w) => w.distanceKm))).toBeLessThan(long.distanceKm)
    expect(mc.totalKm).toBeCloseTo(36, 0)
  })

  it('dzień podbiegów, który musi wziąć resztę kilometrów, zostawia uwagę z datą (B1.4)', () => {
    const mc = generateMicrocycle({ skeleton: skeleton({ targetKm: 52, qualitySessions: 1 }), athlete: { ...athlete, daysAvailable: ['tue', 'thu', 'sat'] }, zones })
    expect(mc.notes).toContainEqual({ code: 'hillsDropped', date: '2026-08-06' })
    expect(mc.days.find((d) => d.date === '2026-08-06')!.workout!.kind).toBe('easy')
  })

  it('pojemność dni: dwa dni mieszczą mniej niż trzy, trzy mniej niż pięć', () => {
    const cap = (daysAvailable: Weekday[]) => weekCapacityKm({ ...athlete, daysAvailable }, daysAvailable.length >= 4 ? 2 : 1, 120)
    const two = cap(['sat', 'sun']), three = cap(DAYS[3]!), five = cap(DAYS[5]!)
    expect(two).toBeGreaterThan(30)
    expect(two).toBeLessThan(three)
    expect(three).toBeLessThan(five)
  })

  it('makrocykl nie planuje szczytu, którego dni nie mieszczą, i mówi o tym', () => {
    const macro = planMacrocycle({
      today: '2026-08-03',
      goal: { name: 'HM', date: '2026-11-29', distanceKm: 21.0975, priority: 'A' },
      athlete: { ...athlete, recentWeeklyKm: 70, daysAvailable: DAYS[3]! },
    })
    const capacity = weekCapacityKm({ ...athlete, daysAvailable: DAYS[3]! }, 1, 120)
    expect(macro.peakKmPlanned).toBe(capacity)
    expect(Math.max(...macro.weeks.map((w) => w.targetKm))).toBeLessThanOrEqual(capacity)
    expect(macro.feasibilityWarnings.join(' ')).toContain(`tydzień mieści ${capacity} km`)
  })
})

describe('B2: rama i minimalna dawka przy małej objętości', () => {
  const small = (targetKm: number) => generateMicrocycle({ skeleton: skeleton({ targetKm }), athlete, zones })
  it('akcent ponad 35% tygodnia: najpierw mniej odcinków, potem rozgrzewka 2 km', () => {
    const at = (km: number) => small(km).days.find((d) => d.workout?.kind === 'quality_intervals')?.workout
    expect(at(22)!.segments.find((s) => s.type === 'intervals')!.reps).toBe(3) // 3 + 3 + 1 = 7 ≤ 7,7
    expect(at(22)!.segments[0]!.distanceKm).toBe(3)
    expect(at(18)!.segments[0]!.distanceKm).toBe(2) // 2 + 3 + 1 = 6 ≤ 6,3
  })
  it('gdy i mała rama przekracza udział: bieg spokojny z przebieżkami w miejscu akcentu (J-6)', () => {
    const mc = small(14)
    expect(mc.days.some((d) => d.workout && ['quality_intervals', 'quality_continuous'].includes(d.workout.kind))).toBe(false)
    const strides = mc.days.filter((d) => d.workout?.ruleRefs.includes('J-6'))
    expect(strides.length).toBeGreaterThan(0)
    expect(strides[0]!.workout!.segments[0]!.description).toContain('przebieżek')
    expect(mc.notes).toContainEqual({ code: 'accentAsStrides', date: strides[0]!.date })
  })
  it('sprawdzian tylko wtedy, gdy cała jednostka z ramą mieści się w 35% tygodnia', () => {
    const goal: RaceGoal = { name: 'HM', date: '2027-03-28', distanceKm: 21.0975, priority: 'A' }
    const macro = planMacrocycle({ today: '2026-10-22', goal, athlete: { ...athlete, recentWeeklyKm: 12, peakWeeklyKm: 50, results: [] } })
    for (const w of macro.weeks.filter((x) => x.testPlanned)) expect(3 + 5 + 1).toBeLessThanOrEqual(SESSION_SHARE_MAX * w.targetKm)
  })
  it('przy jednym akcencie w tygodniu sprawdzian go zastępuje (T-12, W-13)', () => {
    const goal: RaceGoal = { name: 'HM', date: '2027-03-28', distanceKm: 21.0975, priority: 'A' }
    const macro = planMacrocycle({ today: '2026-10-22', goal, athlete: { ...athlete, daysAvailable: ['tue', 'thu', 'sat'], results: [] } })
    const testWeeks = macro.weeks.filter((w) => w.testPlanned)
    expect(testWeeks.length).toBeGreaterThan(0)
    for (const w of testWeeks) expect(w.qualitySessions).toBe(0)
  })
})
