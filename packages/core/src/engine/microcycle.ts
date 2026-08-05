/**
 * Generator mikrocykli: WeekSkeleton → dni i jednostki w house style trenera.
 * Struktura tygodnia i konwencje z korpusu (engine/house-style.ts),
 * intensywności ze stref (zones/daniels.ts), reguły I-5/I-7/I-8, T-1/T-2.
 */
import type {
  AthleteProfile,
  Microcycle,
  PlannedDay,
  PlannedSegment,
  PlannedWorkout,
  RaceGoal,
  Weekday,
  WeekSkeleton,
} from '../domain/types.ts'
import type { PaceZones } from '../zones/daniels.ts'
import { addDays, diffDays } from '../util/dates.ts'
import { COACH_STYLE, type HouseStyle } from './house-style.ts'

const WEEKDAY_ORDER: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

export function fmtPace(secPerKm: number): string {
  const m = Math.floor(secPerKm / 60)
  const s = Math.round(secPerKm % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

const mid = (r: { loSecPerKm: number; hiSecPerKm: number }) =>
  Math.round((r.loSecPerKm + r.hiSecPerKm) / 2)

// ------------------------------------------------------------ budowa jednostek

function segWarmup(km: number, z: PaceZones): PlannedSegment {
  return {
    type: 'warmup',
    distanceKm: km,
    pace: { loSecPerKm: z.easy.loSecPerKm, hiSecPerKm: z.easy.hiSecPerKm },
    description: `${km} kilometry (tempo rozgrzewkowe)`,
  }
}

function segCooldown(km: number): PlannedSegment {
  return {
    type: 'cooldown',
    distanceKm: km,
    description: `Na koniec treningu ${km} kilometr truchtu.`,
  }
}

function buildEasy(km: number, z: PaceZones): PlannedWorkout {
  return {
    kind: 'easy',
    distanceKm: km,
    ruleRefs: ['I-5'],
    segments: [{
      type: 'easy',
      distanceKm: km,
      pace: z.easy,
      description: `${km} kilometrów (w tempie spokojnym).`,
    }],
  }
}

function buildLong(km: number, z: PaceZones): PlannedWorkout {
  const pace = { loSecPerKm: z.easy.hiSecPerKm, hiSecPerKm: z.easy.hiSecPerKm + 30 }
  return {
    kind: 'long',
    distanceKm: km,
    ruleRefs: ['I-5', 'P-7', 'P-8'],
    segments: [{
      type: 'easy',
      distanceKm: km,
      pace,
      description: `${km} kilometrów (w tempie bardzo spokojnym).`,
    }],
  }
}

function buildHillsDay(easyKm: number, style: HouseStyle, z: PaceZones): PlannedWorkout {
  const repsKm = (style.hillsReps * style.hillsRepM) / 1000
  return {
    kind: 'easy_hills',
    distanceKm: Math.round(easyKm + repsKm + style.cooldownKm),
    ruleRefs: ['I-5'],
    segments: [
      {
        type: 'easy',
        distanceKm: easyKm,
        pace: z.easy,
        description: `${easyKm} kilometrów (w tempie spokojnym)`,
      },
      {
        type: 'hills',
        reps: style.hillsReps,
        repM: style.hillsRepM,
        distanceKm: repsKm,
        description: `podbiegi: ${style.hillsReps}*${style.hillsRepM} metrów (spokojnie).`,
      },
      segCooldown(style.cooldownKm),
    ],
  }
}

function buildQualityIntervals(
  mainKm: number,
  polarized: boolean,
  style: HouseStyle,
  z: PaceZones,
): PlannedWorkout {
  const segments: PlannedSegment[] = [segWarmup(style.warmupKm, z)]
  let main: PlannedSegment
  if (polarized) {
    // peak: Z3 — interwały VO2max @I (I-2)
    const reps = Math.max(4, Math.round(mainKm))
    main = {
      type: 'intervals',
      reps,
      repM: 1000,
      distanceKm: reps,
      pace: z.interval,
      description:
        `${reps}*1 km (w tempie ${fmtPace(mid(z.interval))} na km), ` +
        `przerwy 3 minutowe w truchcie, po ${Math.ceil(reps / 2)} odcinku przerwa 4 minutowa w marszu.`,
    }
  } else if (mainKm >= 9) {
    // base/build: cruise intervals @T (I-1)
    const reps = Math.max(2, Math.round(mainKm / 3))
    main = {
      type: 'intervals',
      reps,
      repM: 3000,
      distanceKm: reps * 3,
      pace: z.threshold,
      description:
        `${reps}*3 km (w tempie ${fmtPace(mid(z.threshold))} na km), przerwy 3 minutowe w marszu.`,
    }
  } else {
    const reps = Math.max(4, Math.round(mainKm))
    main = {
      type: 'intervals',
      reps,
      repM: 1000,
      distanceKm: reps,
      pace: z.threshold,
      description:
        `${reps}*1 km (w tempie ${fmtPace(mid(z.threshold))} na km), przerwy 2 minutowe w marszu.`,
    }
  }
  segments.push(main, segCooldown(style.cooldownKm))
  return {
    kind: 'quality_intervals',
    distanceKm: style.warmupKm + (main.distanceKm ?? 0) + style.cooldownKm,
    ruleRefs: ['I-7', 'I-8', polarized ? 'I-2' : 'I-1'],
    segments,
  }
}

function buildQualityContinuous(
  mainKm: number,
  polarized: boolean,
  style: HouseStyle,
  z: PaceZones,
): PlannedWorkout {
  const segments: PlannedSegment[] = [segWarmup(style.warmupKm, z)]
  let main: PlannedSegment
  if (polarized) {
    const fast = z.threshold.loSecPerKm
    const slow = z.easy.loSecPerKm
    main = {
      type: 'alternating',
      distanceKm: mainKm,
      pace: { loSecPerKm: fast, hiSecPerKm: slow },
      description:
        `${mainKm} km biegu zmiennego (na zmianę 1 km w tempie ${fmtPace(fast)} na km, ` +
        `na 1 km w tempie ${fmtPace(slow)} na km).`,
    }
  } else {
    const from = z.marathon.hiSecPerKm
    const to = mid(z.threshold)
    main = {
      type: 'progression',
      distanceKm: mainKm,
      pace: { loSecPerKm: to, hiSecPerKm: from },
      description:
        `${mainKm} km w tempie narastającym (od ${fmtPace(from)} do ${fmtPace(to)} na km).`,
    }
  }
  segments.push(main, segCooldown(style.cooldownKm))
  return {
    kind: 'quality_continuous',
    distanceKm: style.warmupKm + mainKm + style.cooldownKm,
    ruleRefs: ['I-7', 'I-8', polarized ? 'I-2' : 'I-1'],
    segments,
  }
}

function buildSharpener(style: HouseStyle, z: PaceZones): PlannedWorkout {
  const reps = 5
  const repM = 300
  return {
    kind: 'sharpener',
    distanceKm: Math.round(style.warmupKm + (reps * repM) / 1000 + style.cooldownKm),
    ruleRefs: ['T-1', 'T-2'],
    segments: [
      segWarmup(style.warmupKm, z),
      {
        type: 'intervals',
        reps,
        repM,
        distanceKm: (reps * repM) / 1000,
        pace: z.interval,
        description:
          `${reps}*${repM} metrów (w tempie ${fmtPace(mid(z.interval))} na km), ` +
          'przerwy 1 minutowe w truchcie.',
      },
      segCooldown(style.cooldownKm),
    ],
  }
}

function buildRace(goal: RaceGoal): PlannedWorkout {
  return {
    kind: 'race',
    distanceKm: 0, // dystans startu nie wlicza się do objętości treningowej tygodnia
    ruleRefs: [],
    segments: [{ type: 'race', description: `START: ${goal.name.toUpperCase()}.` }],
  }
}

// ---------------------------------------------------------------- planowanie

export interface MicrocycleInput {
  skeleton: WeekSkeleton
  athlete: AthleteProfile
  zones: PaceZones
  goal?: RaceGoal
  style?: HouseStyle
}

export function generateMicrocycle(input: MicrocycleInput): Microcycle {
  const { skeleton, athlete, zones } = input
  const style = input.style ?? COACH_STYLE
  const available = WEEKDAY_ORDER.filter((wd) => athlete.daysAvailable.includes(wd))
  const dateOf = (wd: Weekday) => addDays(skeleton.weekStart, WEEKDAY_ORDER.indexOf(wd))

  const plan = new Map<Weekday, PlannedWorkout>()

  if (skeleton.raceDate && input.goal) {
    planRaceWeek(plan, skeleton.raceDate, input.goal, available, style, zones, skeleton.weekStart)
  } else {
    planNormalWeek(plan, skeleton, available, style, zones)
  }

  const days: PlannedDay[] = WEEKDAY_ORDER.map((wd) => {
    const workout = plan.get(wd)
    return {
      date: dateOf(wd),
      weekday: wd,
      ...(workout ? { workout } : {}),
    }
  })

  const totalKm = days.reduce((sum, d) => sum + (d.workout?.distanceKm ?? 0), 0)
  const z1 = days.reduce((sum, d) => {
    if (!d.workout) return sum
    return (
      sum +
      d.workout.segments
        .filter((s) => s.type === 'easy' || s.type === 'warmup' || s.type === 'cooldown')
        .reduce((a, s) => a + (s.distanceKm ?? 0), 0)
    )
  }, 0)

  return {
    weekStart: skeleton.weekStart,
    skeleton,
    days,
    totalKm,
    easyShare: totalKm > 0 ? z1 / totalKm : 1,
  }
}

function planRaceWeek(
  plan: Map<Weekday, PlannedWorkout>,
  raceDate: string,
  goal: RaceGoal,
  available: Weekday[],
  style: HouseStyle,
  zones: PaceZones,
  weekStart: string,
): void {
  const raceIdx = diffDays(weekStart, raceDate)
  const raceWd = WEEKDAY_ORDER[raceIdx]
  if (!raceWd) throw new Error('raceDate poza tygodniem mikrocyklu')
  plan.set(raceWd, buildRace(goal))

  // T-2: utrzymać częstotliwość — 2–3 krótkie sesje przed startem; dzień przed wolny
  const before = available.filter((wd) => {
    const i = WEEKDAY_ORDER.indexOf(wd)
    return i < raceIdx - 1
  })
  const sharpenerWd = [...before].sort(
    (a, b) =>
      Math.abs(raceIdx - 3 - WEEKDAY_ORDER.indexOf(a)) -
      Math.abs(raceIdx - 3 - WEEKDAY_ORDER.indexOf(b)),
  )[0]
  for (const wd of before.slice(0, 3)) {
    plan.set(wd, wd === sharpenerWd ? buildSharpener(style, zones) : buildEasy(5, zones))
  }
}

function planNormalWeek(
  plan: Map<Weekday, PlannedWorkout>,
  skeleton: WeekSkeleton,
  available: Weekday[],
  style: HouseStyle,
  zones: PaceZones,
): void {
  const target = skeleton.targetKm
  const polarized = skeleton.intensityModel === 'polarized'
  const inTaper = skeleton.phase === 'taper'
  const workoutsCount = Math.min(
    available.length,
    Math.max(style.minWorkoutsPerWeek, Math.ceil(target / style.typicalKmPerSession)),
  )

  // sloty
  const longWd = inTaper
    ? undefined
    : (style.longRunDayPreference.find((wd) => available.includes(wd)) ?? available.at(-1))
  const qualityWds: Weekday[] = []
  for (const wd of style.qualityDayPreference) {
    if (qualityWds.length >= skeleton.qualitySessions) break
    if (!available.includes(wd) || wd === longWd) continue
    const okGap = qualityWds.every(
      (q) => Math.abs(WEEKDAY_ORDER.indexOf(q) - WEEKDAY_ORDER.indexOf(wd)) >= 2, // I-7
    )
    if (okGap) qualityWds.push(wd)
  }
  let hillsWd = inTaper
    ? undefined
    : style.hillsDayPreference.find(
        (wd) => available.includes(wd) && wd !== longWd && !qualityWds.includes(wd),
      )
  const used = new Set<Weekday>([...(longWd ? [longWd] : []), ...qualityWds, ...(hillsWd ? [hillsWd] : [])])
  if (used.size > workoutsCount && hillsWd) {
    used.delete(hillsWd)
    hillsWd = undefined
  }
  const easyWds = available.filter((wd) => !used.has(wd)).slice(0, Math.max(0, workoutsCount - used.size))

  // objętość
  const longKm = longWd ? Math.min(Math.round(style.longRunShare * target), style.longRunCapKm) : 0
  let qualityMainKm = Math.max(3, Math.round(0.22 * target) - style.warmupKm - style.cooldownKm)
  const hillsRepsKm = (style.hillsReps * style.hillsRepM) / 1000
  const hillsEasyKm = hillsWd ? Math.min(8, Math.max(5, Math.round(0.1 * target))) : 0

  const buildAll = () => {
    plan.clear()
    if (longWd) plan.set(longWd, buildLong(longKm, zones))
    qualityWds.forEach((wd, i) => {
      const w =
        i === 0
          ? buildQualityIntervals(qualityMainKm, polarized, style, zones)
          : buildQualityContinuous(qualityMainKm, polarized, style, zones)
      plan.set(wd, w)
    })
    if (hillsWd) plan.set(hillsWd, buildHillsDay(hillsEasyKm, style, zones))

    const usedKm = [...plan.values()].reduce((s, w) => s + w.distanceKm, 0)
    const remaining = Math.max(0, target - usedKm)
    const perEasy = easyWds.length
      ? Math.min(18, Math.max(5, Math.round(remaining / easyWds.length)))
      : 0
    for (const wd of easyWds) plan.set(wd, buildEasy(perEasy, zones))
  }

  buildAll()

  // I-5: ≥75% objętości w Z1 — w razie potrzeby skróć akcenty
  for (let guard = 0; guard < 8; guard++) {
    const total = [...plan.values()].reduce((s, w) => s + w.distanceKm, 0)
    const z1 = [...plan.values()].reduce(
      (s, w) =>
        s +
        w.segments
          .filter((x) => x.type === 'easy' || x.type === 'warmup' || x.type === 'cooldown')
          .reduce((a, x) => a + (x.distanceKm ?? 0), 0),
      0,
    )
    if (total === 0 || z1 / total >= 0.75 || qualityMainKm <= 3) break
    qualityMainKm -= 1
    buildAll()
  }
}
