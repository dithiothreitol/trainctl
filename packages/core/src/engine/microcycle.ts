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
  TuneUpRace,
  Weekday,
  WeekSkeleton,
} from '../domain/types.ts'
import type { PaceZones } from '../zones/daniels.ts'
import { messages } from '../i18n/index.ts'
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

/**
 * Odmiana liczebnika przeniesiona do i18n (`pluralPl`/`pluralEn`) — tu zostaje
 * tylko alias na bieżący katalog, bo generator wywołuje go w kilkunastu miejscach.
 */
export const kmText = (n: number): string => messages().units.km(n)

// ------------------------------------------------------------ budowa jednostek

function segWarmup(km: number, z: PaceZones): PlannedSegment {
  return {
    type: 'warmup',
    distanceKm: km,
    pace: { loSecPerKm: z.easy.loSecPerKm, hiSecPerKm: z.easy.hiSecPerKm },
    description: messages().workout.warmup(km),
  }
}

function segCooldown(km: number): PlannedSegment {
  return {
    type: 'cooldown',
    distanceKm: km,
    description: messages().workout.cooldown(km),
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
      description: messages().workout.easy(km),
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
      description: messages().workout.veryEasy(km),
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
        description: messages().workout.easyBeforeHills(easyKm),
      },
      {
        type: 'hills',
        reps: style.hillsReps,
        repM: style.hillsRepM,
        distanceKm: repsKm,
        description: messages().workout.hills(style.hillsReps, style.hillsRepM),
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
      recoverySec: 180,
      description: messages().workout.intervalsVo2(
        reps, fmtPace(mid(z.interval)), 3, Math.ceil(reps / 2), 4,
      ),
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
      recoverySec: 180,
      description: messages().workout.intervals3Km(reps, fmtPace(mid(z.threshold)), 3),
    }
  } else {
    const reps = Math.max(4, Math.round(mainKm))
    main = {
      type: 'intervals',
      reps,
      repM: 1000,
      distanceKm: reps,
      pace: z.threshold,
      recoverySec: 120,
      description: messages().workout.intervalsKm(reps, fmtPace(mid(z.threshold)), 2),
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
      description: messages().workout.alternating(mainKm, fmtPace(fast), fmtPace(slow)),
    }
  } else {
    const from = z.marathon.hiSecPerKm
    const to = mid(z.threshold)
    main = {
      type: 'progression',
      distanceKm: mainKm,
      pace: { loSecPerKm: to, hiSecPerKm: from },
      description: messages().workout.progression(mainKm, fmtPace(from), fmtPace(to)),
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
        recoverySec: 60,
        description: messages().workout.intervalsShort(reps, repM, fmtPace(mid(z.interval)), 1),
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
    segments: [{ type: 'race', description: messages().workout.raceGoal(goal.name) }],
  }
}

/** Start kontrolny B/C — w korpusie zapisywany dokładnie tak: „START W FALENICY." */
function buildTuneUp(race: TuneUpRace): PlannedWorkout {
  const what = race.name ? race.name.toUpperCase() : `${race.distanceKm} KM`
  return {
    kind: 'race',
    distanceKm: 0,
    ruleRefs: ['T-10', 'T-11', 'T-12'],
    segments: [{ type: 'race', description: messages().workout.raceOther(what) }],
  }
}

/**
 * Sprawdzian all-out (W-11): rozgrzewka z celem, część główna BEZ celu tempa —
 * to pomiar, nie realizacja tempa. Cel na zegarku sterowałby wynikiem, który
 * ma dopiero powstać.
 */
function buildTest(distanceKm: number, style: HouseStyle, z: PaceZones): PlannedWorkout {
  return {
    kind: 'test',
    distanceKm: style.warmupKm + distanceKm + style.cooldownKm,
    ruleRefs: ['W-11', 'W-12', 'W-13'],
    segments: [
      segWarmup(style.warmupKm, z),
      {
        type: 'race',
        distanceKm,
        description: messages().workout.timeTrial(distanceKm),
      },
      segCooldown(style.cooldownKm),
    ],
  }
}

// ---------------------------------------------------------------- planowanie

export interface MicrocycleInput {
  skeleton: WeekSkeleton
  athlete: AthleteProfile
  zones: PaceZones
  goal?: RaceGoal
  style?: HouseStyle
  /** Dystans sprawdzianu, gdy skeleton go przewiduje (W-11). */
  testDistanceKm?: number
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
    planNormalWeek(plan, skeleton, available, style, zones, input.testDistanceKm)
  }

  const days: PlannedDay[] = WEEKDAY_ORDER.map((wd) => {
    const workout = plan.get(wd)
    return {
      date: dateOf(wd),
      weekday: wd,
      ...(workout ? { workout } : {}),
    }
  })

  return {
    weekStart: skeleton.weekStart,
    skeleton,
    days,
    ...weekTotals(days),
  }
}

/**
 * Sumy tygodnia liczone z dni — jedno źródło dla generatora, walidatora
 * (`trainctl check`) i `reschedule --apply`, który po przestawieniu tygodnia
 * musi je przeliczyć, inaczej zapisany plan kłamie w totalKm po odpuszczonej sesji.
 */
export function weekTotals(days: PlannedDay[]): { totalKm: number; easyShare: number } {
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
  return { totalKm, easyShare: totalKm > 0 ? z1 / totalKm : 1 }
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
  testDistanceKm?: number,
): void {
  const target = skeleton.targetKm
  const polarized = skeleton.intensityModel === 'polarized'
  const inTaper = skeleton.phase === 'taper'
  const workoutsCount = Math.min(
    available.length,
    Math.max(style.minWorkoutsPerWeek, Math.ceil(target / style.typicalKmPerSession)),
  )

  // Start kontrolny / sprawdzian zajmuje swój dzień PRZED rozdaniem reszty:
  // to on jest akcentem tygodnia, a nie doklejką do gotowego układu (T-12).
  const idxOf = (wd: Weekday) => WEEKDAY_ORDER.indexOf(wd)
  let peakWd: Weekday | undefined
  let peakWorkout: PlannedWorkout | undefined
  if (skeleton.tuneUp) {
    const offset = diffDays(skeleton.weekStart, skeleton.tuneUp.date)
    peakWd = WEEKDAY_ORDER[offset]
    if (peakWd) peakWorkout = buildTuneUp(skeleton.tuneUp)
  } else if (skeleton.testPlanned && testDistanceKm) {
    // sprawdzian tam, gdzie trener stawia starty: weekend, preferencyjnie sobota (korpus 80%)
    peakWd = style.longRunDayPreference.find((wd) => available.includes(wd)) ?? available.at(-1)
    if (peakWd) peakWorkout = buildTest(testDistanceKm, style, zones)
  }
  // T-10: dzień przed startem/sprawdzianem zostaje wolny (korpus: 76% startów)
  const dayBeforePeak = peakWd ? WEEKDAY_ORDER[idxOf(peakWd) - 1] : undefined

  // sloty — dzień startu i dzień przed nim wypadają z puli
  const free = available.filter((wd) => wd !== peakWd && wd !== dayBeforePeak)
  // T-11: długie wybieganie ZOSTAJE po starcie (w korpusie: sobota start → niedziela long)
  const longWd = inTaper
    ? undefined
    : (style.longRunDayPreference.find((wd) => free.includes(wd)) ?? free.at(-1))
  const qualityWds: Weekday[] = []
  for (const wd of style.qualityDayPreference) {
    if (qualityWds.length >= skeleton.qualitySessions) break
    if (!free.includes(wd) || wd === longWd) continue
    const okGap = [...qualityWds, ...(peakWd ? [peakWd] : [])].every(
      (q) => Math.abs(idxOf(q) - idxOf(wd)) >= 2, // I-7 — start też jest akcentem
    )
    if (okGap) qualityWds.push(wd)
  }
  let hillsWd = inTaper
    ? undefined
    : style.hillsDayPreference.find(
        (wd) => free.includes(wd) && wd !== longWd && !qualityWds.includes(wd),
      )
  const used = new Set<Weekday>([...(longWd ? [longWd] : []), ...qualityWds, ...(hillsWd ? [hillsWd] : [])])
  if (used.size > workoutsCount && hillsWd) {
    used.delete(hillsWd)
    hillsWd = undefined
  }
  const easyWds = free.filter((wd) => !used.has(wd)).slice(0, Math.max(0, workoutsCount - used.size))

  // objętość
  const longKm = longWd ? Math.min(Math.round(style.longRunShare * target), style.longRunCapKm) : 0
  let qualityMainKm = Math.max(3, Math.round(0.22 * target) - style.warmupKm - style.cooldownKm)
  const hillsRepsKm = (style.hillsReps * style.hillsRepM) / 1000
  const hillsEasyKm = hillsWd ? Math.min(8, Math.max(5, Math.round(0.1 * target))) : 0

  const buildAll = () => {
    plan.clear()
    if (peakWd && peakWorkout) plan.set(peakWd, peakWorkout)
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
