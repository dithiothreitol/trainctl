/**
 * Lint planu (`trainctl check`): świeży plan z generatora przechodzi bez ustaleń,
 * a każde złamanie inwariantu ręczną edycją ma swój kod, poprawny poziom
 * (error = integralność pliku, warn = odstępstwo od reguły) i właściwe ID reguły.
 */
import { describe, expect, it } from 'vitest'
import type {
  AthleteProfile,
  Microcycle,
  PlannedDay,
  PlannedWorkout,
  RaceGoal,
  StrengthSession,
  Weekday,
} from '../domain/types.ts'
import { paceZones, vdotFromRace } from '../zones/daniels.ts'
import { planMacrocycle, testDistanceKm } from './macrocycle.ts'
import { generateMicrocycle, weekTotals } from './microcycle.ts'
import { planStrengthWeek } from './strength.ts'
import { validatePlan, type PlanIssue } from './validate.ts'

const TODAY = '2026-08-05'

const athlete: AthleteProfile = {
  recentWeeklyKm: 50,
  peakWeeklyKm: 80,
  daysAvailable: ['tue', 'wed', 'thu', 'sat', 'sun'],
  longRunDay: 'sat',
  results: [{ date: '2026-03-30', distanceKm: 10, timeSec: 2700 }],
}

const marathon: RaceGoal = {
  date: '2026-11-29', // niedziela; 17 tygodni od 2026-08-03
  distanceKm: 42.195,
  name: 'Maraton testowy',
  priority: 'A',
}

function buildWeeks(goal: RaceGoal, profile: AthleteProfile = athlete): Microcycle[] {
  const zones = paceZones(vdotFromRace(10, 2700))
  const macro = planMacrocycle({ today: TODAY, goal, athlete: profile })
  return macro.weeks.map((skeleton) =>
    generateMicrocycle({ skeleton, athlete: profile, zones, goal, testDistanceKm: testDistanceKm(goal) }),
  )
}

/** Siła rozstawiona jak w planfile.applyStrength — z ciągłością odstępu między tygodniami. */
function withStrength(weeks: Microcycle[]): void {
  let last: string | undefined
  for (const week of weeks) {
    const { byDate } = planStrengthWeek({
      week,
      phase: week.skeleton.phase,
      deload: week.skeleton.deload,
      ...(last ? { lastSessionDate: last } : {}),
    })
    for (const day of week.days) {
      const s = byDate.get(day.date)
      if (s) day.strength = s
      else delete day.strength
    }
    const dates = [...byDate.keys()].sort()
    if (dates.length) last = dates.at(-1)
  }
}

const session = (): StrengthSession => ({
  kind: 'heavy',
  description: 'siła',
  durationMin: 35,
  ruleRefs: [],
})

const codes = (issues: PlanIssue[]) => issues.map((i) => i.code)
const check = (weeks: Microcycle[], goal: RaceGoal = marathon) => validatePlan({ weeks, goal })

/** Po celowej mutacji dni przywraca spójność sum — żeby test widział TYLKO badane odstępstwo. */
const resync = (week: Microcycle) => Object.assign(week, weekTotals(week.days))

describe('świeży plan przechodzi lint bez ustaleń', () => {
  it('maraton, 17 tygodni', () => {
    expect(check(buildWeeks(marathon))).toEqual([])
  })

  it('półmaraton ze startem kontrolnym B w sobotę', () => {
    const goal: RaceGoal = { ...marathon, date: '2026-11-15', distanceKm: 21.0975, name: 'HM' }
    const weeks = buildWeeks(goal, {
      ...athlete,
      tuneUpRaces: [{ date: '2026-09-19', distanceKm: 10, priority: 'B' }],
    })
    expect(check(weeks, goal)).toEqual([])
  })

  it('plan z modułem siły', () => {
    const weeks = buildWeeks(marathon)
    withStrength(weeks)
    expect(check(weeks)).toEqual([])
  })

  it('pusty kalendarz startów → plan ze sprawdzianem też przechodzi', () => {
    const weeks = buildWeeks(marathon, { ...athlete, results: [] })
    expect(check(weeks)).toEqual([])
  })
})

describe('integralność pliku (error)', () => {
  // Plik bywa pusty albo obcięty (przerwana edycja, `git show` na złej ścieżce).
  // Lint ma o tym opowiedzieć — dokładnie on jest komendą „po ręcznej edycji".
  it('weeksMissing + goalMissing: pusty dokument to dwa ustalenia, nie wyjątek', () => {
    const issues = validatePlan({ weeks: undefined, goal: undefined })
    expect(codes(issues)).toEqual(['goalMissing', 'weeksMissing'])
    expect(issues.every((i) => i.severity === 'error')).toBe(true)
  })

  it('weeksMissing: weeks innego typu niż lista', () => {
    const issues = validatePlan({ weeks: 7 as unknown as Microcycle[], goal: marathon })
    expect(codes(issues)).toEqual(['weeksMissing'])
  })

  it('goalMissing: cel bez daty nie wywraca reszty kontroli', () => {
    const goal = { ...marathon, date: undefined } as unknown as RaceGoal
    const issues = validatePlan({ weeks: buildWeeks(marathon), goal })
    expect(codes(issues)).toEqual(['goalMissing'])
  })

  it('malformed: tydzień bez weekStart wypada z kontroli, ale jest zgłoszony', () => {
    const weeks = buildWeeks(marathon)
    delete (weeks[1] as unknown as Record<string, unknown>)['weekStart']
    const issues = check(weeks)
    const hit = issues.find((i) => i.code === 'malformed')
    expect(hit?.severity).toBe('error')
    expect(hit?.date).toBe('#2')
  })

  it('weekdayMismatch: pole weekday niezgodne z kalendarzem', () => {
    const weeks = buildWeeks(marathon)
    weeks[0]!.days[2]!.weekday = 'sun' as Weekday
    const issues = check(weeks)
    const hit = issues.find((i) => i.code === 'weekdayMismatch')
    expect(hit?.severity).toBe('error')
    expect(hit?.kind).toBe('sun')
    expect(hit?.otherKind).toBe('wed')
  })

  it('dayOutOfPlace: data nie na swojej pozycji tygodnia', () => {
    const weeks = buildWeeks(marathon)
    weeks[0]!.days[2]!.date = '2026-08-20'
    expect(codes(check(weeks))).toContain('dayOutOfPlace')
  })

  it('weekStartNotMonday + weeksNotContiguous', () => {
    const weeks = buildWeeks(marathon)
    weeks[1]!.weekStart = '2026-08-11' // wtorek
    const found = codes(check(weeks))
    expect(found).toContain('weekStartNotMonday')
    expect(found).toContain('weeksNotContiguous')
  })

  it('weekLength: tydzień z sześcioma dniami', () => {
    const weeks = buildWeeks(marathon)
    weeks[0]!.days.pop()
    const hit = check(weeks).find((i) => i.code === 'weekLength')
    expect(hit?.severity).toBe('error')
    expect(hit?.actual).toBe(6)
  })

  it('totalKmDesync: suma tygodnia rozjechana z dniami', () => {
    const weeks = buildWeeks(marathon)
    weeks[0]!.totalKm += 10
    const hit = check(weeks).find((i) => i.code === 'totalKmDesync')
    expect(hit?.severity).toBe('error')
    expect(hit?.actual).toBe(weeks[0]!.totalKm)
  })

  it('easyShareDesync: zapisany udział Z1 rozjechany z dniami', () => {
    const weeks = buildWeeks(marathon)
    weeks[0]!.easyShare = 0.1
    expect(codes(check(weeks))).toContain('easyShareDesync')
  })

  it('workoutKmDesync: distanceKm jednostki niezgodne z segmentami', () => {
    const weeks = buildWeeks(marathon)
    const day = weeks[0]!.days.find((d) => d.workout)!
    day.workout!.distanceKm += 5
    resync(weeks[0]!)
    const hit = check(weeks).find((i) => i.code === 'workoutKmDesync')
    expect(hit?.severity).toBe('error')
    expect(hit?.date).toBe(day.date)
  })

  it('raceDayMissing: plan zgubił dzień startu', () => {
    const weeks = buildWeeks(marathon)
    const raceDay = weeks.at(-1)!.days.find((d) => d.workout?.kind === 'race')!
    delete raceDay.workout
    resync(weeks.at(-1)!)
    const hit = check(weeks).find((i) => i.code === 'raceDayMissing')
    expect(hit?.severity).toBe('error')
    expect(hit?.date).toBe(marathon.date)
  })
})

describe('odstępstwa od reguł (warn)', () => {
  it('accentGap [I-7]: akcent w przeddzień startu — także na styku jednostek race/test', () => {
    const weeks = buildWeeks(marathon)
    const raceWeek = weeks.at(-1)!
    const sharpenerDay = raceWeek.days.find((d) => d.workout?.kind === 'sharpener')!
    const saturday = raceWeek.days[5]!
    saturday.workout = sharpenerDay.workout!
    delete sharpenerDay.workout
    resync(raceWeek)
    const issues = check(weeks)
    const hit = issues.find((i) => i.code === 'accentGap')
    expect(hit?.severity).toBe('warn')
    expect(hit?.ruleRefs).toEqual(['I-7'])
    // akcent dzień przed startem zgłasza I-7, nie duplikat z T-10
    expect(codes(issues)).not.toContain('workoutBeforeRace')
  })

  it('workoutBeforeRace [T-10]: bieg spokojny w przeddzień startu', () => {
    const weeks = buildWeeks(marathon)
    const raceWeek = weeks.at(-1)!
    const easyDay = raceWeek.days.find((d) => d.workout?.kind === 'easy')!
    const saturday = raceWeek.days[5]!
    saturday.workout = easyDay.workout!
    delete easyDay.workout
    resync(raceWeek)
    const hit = check(weeks).find((i) => i.code === 'workoutBeforeRace')
    expect(hit?.severity).toBe('warn')
    expect(hit?.ruleRefs).toEqual(['T-10'])
  })

  it('longInTaper [T-5] i hillsInTaper: objętość wstawiona w taper', () => {
    const weeks = buildWeeks(marathon)
    const taper = weeks.find((w) => w.skeleton.phase === 'taper')!
    const loadWeek = weeks.find((w) => w.days.some((d) => d.workout?.kind === 'long'))!
    const long = loadWeek.days.find((d) => d.workout?.kind === 'long')!.workout!
    const hills = weeks
      .flatMap((w) => w.days)
      .find((d) => d.workout?.kind === 'easy_hills')!.workout!
    taper.days[0]!.workout = long
    taper.days[3]!.workout = hills
    resync(taper)
    const issues = check(weeks)
    expect(issues.find((i) => i.code === 'longInTaper')?.ruleRefs).toEqual(['T-5'])
    expect(codes(issues)).toContain('hillsInTaper')
  })

  it('strengthInTaper [F-13]', () => {
    const weeks = buildWeeks(marathon)
    const taper = weeks.find((w) => w.skeleton.phase === 'taper')!
    taper.days[0]!.strength = session()
    expect(check(weeks).find((i) => i.code === 'strengthInTaper')?.ruleRefs).toEqual(['F-13'])
  })

  it('strengthOnQualityDay / strengthDayBeforeQuality / strengthGap [S-5]', () => {
    const weeks = buildWeeks(marathon)
    const week = weeks[0]!
    const qualityIdx = week.days.findIndex((d) => d.workout?.kind === 'quality_intervals')
    week.days[qualityIdx]!.strength = session()
    week.days[qualityIdx - 1]!.strength = session()
    const issues = check(weeks)
    for (const code of ['strengthOnQualityDay', 'strengthDayBeforeQuality', 'strengthGap'] as const) {
      const hit = issues.find((i) => i.code === code)
      expect(hit?.severity).toBe('warn')
      expect(hit?.ruleRefs).toEqual(['S-5'])
    }
  })

  it('strengthOnLongDay: siła w dniu długiego', () => {
    const weeks = buildWeeks(marathon)
    const longDay = weeks[0]!.days.find((d) => d.workout?.kind === 'long')!
    longDay.strength = session()
    expect(codes(check(weeks))).toContain('strengthOnLongDay')
  })

  it('longOverCap [P-8]: długie ponad sufit house style', () => {
    const weeks = buildWeeks(marathon)
    const longDay = weeks[0]!.days.find((d) => d.workout?.kind === 'long')!
    longDay.workout!.distanceKm = 40
    longDay.workout!.segments[0]!.distanceKm = 40
    resync(weeks[0]!)
    const hit = check(weeks).find((i) => i.code === 'longOverCap')
    expect(hit?.ruleRefs).toEqual(['P-8'])
    expect(hit?.actual).toBe(40)
    expect(hit?.expected).toBe(35)
  })

  it('qualityWithoutFrame: akcent bez rozgrzewki', () => {
    const weeks = buildWeeks(marathon)
    const day = weeks[0]!.days.find((d) => d.workout?.kind === 'quality_intervals')!
    day.workout!.segments = day.workout!.segments.filter((s) => s.type !== 'warmup')
    day.workout!.distanceKm = day.workout!.segments.reduce((a, s) => a + (s.distanceKm ?? 0), 0)
    resync(weeks[0]!)
    expect(codes(check(weeks))).toContain('qualityWithoutFrame')
  })

  it('taperNotMonotonic [T-4]: tydzień taperu cięższy od poprzedniego', () => {
    const weeks = buildWeeks(marathon)
    const idx = weeks.findIndex((w) => w.skeleton.phase === 'taper')
    const taper = weeks[idx]!
    const easy = weeks
      .flatMap((w) => w.days)
      .find((d) => d.workout?.kind === 'easy')!.workout!
    // dzień wolny w taperze dostaje tyle spokojnych km, by przebić poprzedni tydzień
    const rest = taper.days.find((d) => !d.workout)!
    const target = weekTotals(weeks[idx - 1]!.days).totalKm
    const bigEasy: PlannedWorkout = {
      ...easy,
      distanceKm: target,
      segments: [{ ...easy.segments[0]!, distanceKm: target }],
    }
    rest.workout = bigEasy
    resync(taper)
    const hit = check(weeks).find((i) => i.code === 'taperNotMonotonic')
    expect(hit?.severity).toBe('warn')
    expect(hit?.ruleRefs).toEqual(['T-4'])
  })
})

describe('I-5 z podłogą generatora', () => {
  const mkDay = (date: string, weekday: Weekday, workout?: PlannedWorkout): PlannedDay => ({
    date,
    weekday,
    ...(workout ? { workout } : {}),
  })

  const quality = (mainKm: number): PlannedWorkout => ({
    kind: 'quality_intervals',
    distanceKm: 3 + mainKm + 1,
    ruleRefs: [],
    segments: [
      { type: 'warmup', distanceKm: 3, description: 'w' },
      { type: 'intervals', distanceKm: mainKm, description: 'q' },
      { type: 'cooldown', distanceKm: 1, description: 'c' },
    ],
  })

  function mkWeek(mainKm: number): Microcycle {
    const days: PlannedDay[] = [
      mkDay('2026-08-03', 'mon'),
      mkDay('2026-08-04', 'tue', quality(mainKm)),
      mkDay('2026-08-05', 'wed'),
      mkDay('2026-08-06', 'thu'),
      mkDay('2026-08-07', 'fri'),
      mkDay('2026-08-08', 'sat'),
      mkDay('2026-08-09', 'sun'),
    ]
    return {
      weekStart: '2026-08-03',
      skeleton: {
        weekStart: '2026-08-03',
        index: 0,
        phase: 'base',
        intensityModel: 'pyramidal',
        targetKm: 10,
        deload: false,
        keepIntensity: false,
        keepFrequency: false,
        qualitySessions: 1,
        flags: [],
        ruleRefs: [],
      },
      days,
      ...weekTotals(days),
    }
  }

  it('udział Z1 poniżej 75% przy akcencie do skrócenia → ostrzeżenie [I-5]', () => {
    const hit = check([mkWeek(8)]).find((i) => i.code === 'easyShareLow')
    expect(hit?.severity).toBe('warn')
    expect(hit?.ruleRefs).toEqual(['I-5'])
  })

  it('ta sama proporcja przy akcencie na podłodze generatora → cisza', () => {
    // 3+4+1: Z1 = 4/8 = 50%, ale część główna ≤ 4,5 km — generator sam akceptuje
    // taki tydzień przy niskiej objętości, więc lint nie ostrzega świeżego planu
    expect(codes(check([mkWeek(4)]))).not.toContain('easyShareLow')
  })
})
