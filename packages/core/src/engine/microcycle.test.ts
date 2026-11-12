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
  // tygodnie odciążenia planu 12 km/tydz. (macierz B0): przy długim 3 km sufit S-10 dawał
  // biegi 2,7 km, a dwa dni przebieżek po 2,1–2,2 km zostawały mimo E-3
  it.each([
    ['3 dni, 10 km bez toru długiego', ['tue', 'thu', 'sat'] as Weekday[], {}],
    ['4 dni, tor długiego, akcenty jako przebieżki', ['tue', 'thu', 'sat', 'sun'] as Weekday[], { longKm: 6, qualitySessions: 2 }],
    ['5 dni, tor długiego', ['tue', 'wed', 'thu', 'sat', 'sun'] as Weekday[], { longKm: 6, qualitySessions: 2 }],
  ])('tydzień 9 km (%s): żaden bieg poza długim nie jest krótszy niż 3 km (E-3, S-10)', (_name, days, over) => {
    const mc = generateMicrocycle({ skeleton: skeleton({ targetKm: 9, deload: true, accentProgress: 0, ...over }), athlete: { ...athlete, daysAvailable: days }, zones })
    const runs = mc.days.filter((d) => d.workout).map((d) => d.workout!)
    const long = runs.find((w) => w.kind === 'long')!
    expect(mc.totalKm).toBeCloseTo(9, 1)
    for (const w of runs.filter((x) => x !== long)) {
      expect(w.distanceKm).toBeGreaterThanOrEqual(3)
      expect(w.distanceKm).toBeLessThanOrEqual(long.distanceKm)
    }
    // uwaga o przebieżkach tylko przy dniach, które je mają
    for (const n of mc.notes ?? []) if (n.code === 'accentAsStrides') expect(mc.days.find((d) => d.date === n.date)?.workout?.ruleRefs).toContain('J-6')
  })
  // dwa dni biegowe i tor długiego ponad tydzień (półmaraton 22 km, maraton 30 km): długie
  // zjadało cały tydzień, drugi dzień wypadał (§10.15: przy dwóch biegach długie ≤ 0,80)
  it.each([[23, 22], [24, 22], [25, 30], [33, 30], [12, 22]])('dwa dni, tydzień %i km, tor długiego %i km: dwa biegi, długie najwyżej 0,80 tygodnia', (targetKm, longKm) => {
    const mc = generateMicrocycle({ skeleton: skeleton({ targetKm, longKm, qualitySessions: 1 }), athlete: { ...athlete, daysAvailable: ['sat', 'sun'] }, zones })
    const runs = mc.days.filter((d) => d.workout)
    expect(runs).toHaveLength(2)
    const long = runs.find((d) => d.workout!.kind === 'long')!.workout!
    expect(long.distanceKm).toBeLessThanOrEqual(Math.max(0.8 * targetKm, targetKm - 3) + 0.05)
    for (const d of runs) expect(d.workout!.distanceKm).toBeGreaterThanOrEqual(3)
  })
  // dwa dni z akcentem przy małej objętości: akcent z pełną ramą (7 km) był dłuższy od długiego
  it.each([['peak', 13], ['build', 12], ['build', 14]] as const)('dwa dni, %s, tydzień %i km: akcent nie dłuższy od długiego (J-1, S-2)', (phase, targetKm) => {
    const mc = generateMicrocycle({ skeleton: skeleton({ phase, intensityModel: phase === 'peak' ? 'polarized' : 'pyramidal', targetKm, qualitySessions: 1 }), athlete: { ...athlete, daysAvailable: ['tue', 'wed'] }, zones })
    const runs = mc.days.filter((d) => d.workout).map((d) => d.workout!)
    const long = runs.find((w) => w.kind === 'long')!
    expect(runs).toHaveLength(2)
    for (const w of runs) expect(w.distanceKm).toBeLessThanOrEqual(long.distanceKm)
  })
  // dwa dni: tor długiego (B4) nie wypycha jedynego akcentu i nie przekracza tygodnia ze sprawdzianem
  it('dwa dni, szczyt z torem długiego 30 km w tygodniu 34 km: akcent zostaje, tydzień w zamiarze (B4, J-1)', () => {
    const mc = generateMicrocycle({ skeleton: skeleton({ phase: 'peak', intensityModel: 'polarized', targetKm: 34, longKm: 30, qualitySessions: 1 }), athlete: { ...athlete, daysAvailable: ['sat', 'sun'] }, zones })
    const runs = mc.days.filter((d) => d.workout).map((d) => d.workout!)
    expect(runs.some((w) => ['quality_intervals', 'quality_continuous'].includes(w.kind))).toBe(true)
    expect(mc.totalKm).toBeLessThanOrEqual(34 + 0.5)
    const long = runs.find((w) => w.kind === 'long')!
    for (const w of runs) expect(w.distanceKm).toBeLessThanOrEqual(long.distanceKm)
  })
  it('dwa dni, tydzień sprawdzianu z torem długiego: tydzień nie przekracza zamiaru (B4, T-10)', () => {
    const mc = generateMicrocycle({ skeleton: skeleton({ targetKm: 31, longKm: 24, qualitySessions: 1, testPlanned: true }), athlete: { ...athlete, daysAvailable: ['sat', 'sun'] }, zones, testDistanceKm: 5 })
    expect(mc.days.some((d) => d.workout?.kind === 'test')).toBe(true)
    expect(mc.totalKm).toBeLessThanOrEqual(31 + 0.5)
  })
  it('szkielet ze starszego silnika (bez firstAfterRace): pierwszy tydzień po starcie nadal bez długiego (R-8)', () => {
    const mc = generateMicrocycle({ skeleton: skeleton({ phase: 'transition', targetKm: 20, qualitySessions: 0 }), athlete, zones })
    expect(mc.days.some((d) => d.workout?.kind === 'long')).toBe(false)
  })
  it('taper przy małej objętości (bez długiego): akcent zostaje, nie zamienia się w przebieżki (T-1)', () => {
    const mc = generateMicrocycle({ skeleton: skeleton({ phase: 'taper', intensityModel: 'polarized', targetKm: 16.8, keepFrequency: true, keepIntensity: true, sessionCount: 4, qualitySessions: 1 }), athlete, zones })
    expect(mc.days.some((d) => d.workout && ['quality_intervals', 'quality_continuous'].includes(d.workout.kind))).toBe(true)
    expect((mc.notes ?? []).some((n) => n.code === 'accentAsStrides')).toBe(false)
  })
  it.each([[4, 3], [5, 3], [5, 4]])('taper ze stałą liczbą %i biegów i %i km (T-2): mniej biegów zamiast biegów krótszych niż kilometr', (sessionCount, targetKm) => {
    const days: AthleteProfile = { ...athlete, daysAvailable: ['mon', 'tue', 'thu', 'sat', 'sun'] }
    const mc = generateMicrocycle({ skeleton: skeleton({ phase: 'taper', intensityModel: 'polarized', targetKm, keepFrequency: true, keepIntensity: true, sessionCount, qualitySessions: 0 }), athlete: days, zones })
    const runs = mc.days.filter((x) => x.workout)
    expect(runs.length).toBeGreaterThan(0)
    for (const d of runs) expect(d.workout!.distanceKm, d.date).toBeGreaterThanOrEqual(1)
  })
  it('jeden dzień biegowy: długie to cały tydzień, pojemność dni nie spada do 6 km', () => {
    const one: AthleteProfile = { ...athlete, daysAvailable: ['sun'] }
    expect(weekCapacityKm(one, 1, 20)).toBeGreaterThanOrEqual(15)
    const mc = generateMicrocycle({ skeleton: skeleton({ targetKm: 15, qualitySessions: 1 }), athlete: one, zones })
    expect(mc.days.filter((d) => d.workout).map((d) => d.workout!.distanceKm)).toEqual([15])
  })
  it('przy jednym akcencie w tygodniu sprawdzian go zastępuje (T-12, W-13)', () => {
    const goal: RaceGoal = { name: 'HM', date: '2027-03-28', distanceKm: 21.0975, priority: 'A' }
    const macro = planMacrocycle({ today: '2026-10-22', goal, athlete: { ...athlete, daysAvailable: ['tue', 'thu', 'sat'], results: [] } })
    const testWeeks = macro.weeks.filter((w) => w.testPlanned)
    expect(testWeeks.length).toBeGreaterThan(0)
    for (const w of testWeeks) expect(w.qualitySessions).toBe(0)
  })
})

describe('B5: progresja akcentów i repertuar (J-8, J-4, J-5, R-8)', () => {
  const continuousKm = (accentProgress: number) => generateMicrocycle({ skeleton: skeleton({ targetKm: 60, accentProgress }), athlete, zones })
    .days.find((d) => d.workout?.kind === 'quality_continuous')!.workout!.segments.find((s) => s.type === 'progression')!.distanceKm!

  it('dawka rośnie z pozycją w sezonie: od 3 km (J-8) do sufitu dawki tygodnia', () => {
    expect(continuousKm(0)).toBe(3)
    expect(continuousKm(0.5)).toBeGreaterThan(continuousKm(0))
    expect(continuousKm(1)).toBeGreaterThan(continuousKm(0.5))
  })

  it('szczyt: interwały @I to drabinka 1000/400/200 m w truchcie (J-4)', () => {
    const mc = generateMicrocycle({ skeleton: skeleton({ phase: 'peak', intensityModel: 'polarized' }), athlete, zones })
    const ladder = mc.days.find((d) => d.workout?.ruleRefs.includes('J-4'))!.workout!
    const reps = ladder.segments.filter((s) => s.type === 'intervals')
    expect(reps.map((s) => s.repM)).toEqual([1000, 400, 200])
    for (const s of reps) {
      expect(s.recoveryMode).toBe('jog')
      expect(s.pace!.hiSecPerKm).toBeLessThanOrEqual(zones.interval.hiSecPerKm + 1)
    }
  })

  it('taper: 1 km @I z dłuższą przerwą marszową w połowie serii (C1)', () => {
    const mc = generateMicrocycle({ skeleton: skeleton({ phase: 'taper', intensityModel: 'polarized', keepIntensity: true, keepFrequency: true, targetKm: 40 }), athlete, zones })
    const vo2 = mc.days.find((d) => d.workout?.kind === 'quality_intervals')!.workout!.segments.find((s) => s.type === 'intervals')!
    expect(vo2.repM).toBe(1000)
    expect(vo2.recoveryMode).toBe('jog')
    expect(vo2.setBreak).toEqual({ afterRep: Math.ceil(vo2.reps! / 2), sec: 240, mode: 'walk' })
  })

  it('odcinki @T: przerwa w marszu w polu segmentu; zapis „4×1 km", „2-minutowe" (decyzja 4)', () => {
    const s = generateMicrocycle({ skeleton: skeleton(), athlete, zones }).days.find((d) => d.workout?.kind === 'quality_intervals')!
      .workout!.segments.find((x) => x.type === 'intervals')!
    expect(s.recoveryMode).toBe('walk')
    expect(s.description).toMatch(/^\d+×1 km/)
    expect(s.description).toContain('2-minutowe')
  })

  it('tydzień, który nie mieści długiego, akcentu i podbiegów: wypadają podbiegi, nie interwały (J-5)', () => {
    // długie 15 km z toru (maraton): długie, akcent i podbiegi to 33 km przy celu 30
    const mc = generateMicrocycle({ skeleton: skeleton({ targetKm: 30, qualitySessions: 1, longKm: 15 }), athlete: { ...athlete, daysAvailable: ['tue', 'thu', 'sat'] }, zones })
    expect(mc.days.some((d) => d.workout?.kind === 'quality_intervals')).toBe(true)
    expect(mc.days.some((d) => d.workout?.kind === 'easy_hills')).toBe(false)
    expect(mc.notes).toContainEqual({ code: 'hillsDropped', date: '2026-08-06' })
  })

  it('po starcie akcent od najmniejszej ramy: 3 odcinki (R-8, B5.4)', () => {
    const mc = generateMicrocycle({ skeleton: skeleton({ phase: 'transition', qualitySessions: 1, accentProgress: 0, targetKm: 44 }), athlete, zones })
    expect(mc.days.find((d) => d.workout?.kind === 'quality_intervals')!.workout!.segments.find((s) => s.type === 'intervals')!.reps).toBe(3)
  })
})
