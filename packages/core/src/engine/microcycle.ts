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

/** Change generated pace targets only; distances, recoveries and placement survive. */
export function recalibrateWorkout(workout: PlannedWorkout, zones: PaceZones, polarized: boolean): PlannedWorkout {
  const next = structuredClone(workout)
  for (const s of next.segments) {
    if (s.type === 'easy' || s.type === 'warmup') {
      s.pace = workout.kind === 'long'
        ? { loSecPerKm: zones.easy.hiSecPerKm, hiSecPerKm: zones.easy.hiSecPerKm + 30 } : { ...zones.easy }
    } else if (s.type === 'intervals') {
      s.pace = { ...(polarized || workout.kind === 'sharpener' ? zones.interval : zones.threshold) }
      s.description = s.description.replace(/\d+:\d{2}/g, fmtPace(mid(s.pace)))
    } else if (s.type === 'progression') {
      s.pace = { loSecPerKm: mid(zones.threshold), hiSecPerKm: zones.marathon.hiSecPerKm }
      s.description = messages().workout.progression(s.distanceKm ?? 0, fmtPace(s.pace.hiSecPerKm), fmtPace(s.pace.loSecPerKm))
    } else if (s.type === 'alternating') {
      s.pace = { loSecPerKm: zones.threshold.loSecPerKm, hiSecPerKm: zones.easy.loSecPerKm }
      s.description = messages().workout.alternating(s.distanceKm ?? 0, fmtPace(s.pace.loSecPerKm), fmtPace(s.pace.hiSecPerKm))
    }
  }
  return next
}

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
    distanceKm: easyKm + 2 * repsKm + style.cooldownKm,
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
        distanceKm: 2 * repsKm, // uphill work plus the return to the starting point
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
    raceDistanceKm: goal.distanceKm,
    ...(goal.targetTimeSec ? { estimatedRaceTimeSec: goal.targetTimeSec } : {}),
    segments: [{ type: 'race', distanceKm: goal.distanceKm, description: messages().workout.raceGoal(goal.name) }],
  }
}

/** Start kontrolny B/C — w korpusie zapisywany dokładnie tak: „START W FALENICY." */
function buildTuneUp(race: TuneUpRace): PlannedWorkout {
  const what = race.name ? race.name.toUpperCase() : `${race.distanceKm} KM`
  return {
    kind: 'race',
    distanceKm: 0,
    raceDistanceKm: race.distanceKm,
    ruleRefs: ['T-10', 'T-11', 'T-12'],
    segments: [{ type: 'race', distanceKm: race.distanceKm, description: messages().workout.raceOther(what) }],
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
  const defaults = input.style ?? COACH_STYLE
  const style = athlete.longRunDay
    ? { ...defaults, longRunDayPreference: [athlete.longRunDay, ...defaults.longRunDayPreference.filter(d => d !== athlete.longRunDay)] }
    : defaults
  const dateOf = (wd: Weekday) => addDays(skeleton.weekStart, WEEKDAY_ORDER.indexOf(wd))
  // po starcie: dni przed najwcześniejszym biegiem wypadają z puli (R-1)
  const available = WEEKDAY_ORDER.filter((wd) => athlete.daysAvailable.includes(wd) && (!skeleton.earliestRun || dateOf(wd) >= skeleton.earliestRun))

  const plan = new Map<Weekday, PlannedWorkout>()

  if (skeleton.raceDate && input.goal) {
    planRaceWeek(plan, skeleton.raceDate, input.goal, available, style, zones, skeleton.weekStart, skeleton.sessionCount)
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
    if (!d.workout || d.workout.kind === 'race') return sum
    return (
      sum +
      d.workout.segments
        .filter((s) => s.type === 'easy' || s.type === 'warmup' || s.type === 'cooldown')
        .reduce((a, s) => a + (s.distanceKm ?? 0), 0) +
      d.workout.segments.filter(s => s.type === 'hills').reduce((a, s) => a + ((s.reps ?? 0) * (s.repM ?? 0)) / 1000, 0)
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
  sessionCount?: number,
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
  for (const wd of before.slice(0, Math.max(0, (sessionCount ?? 4) - 1))) {
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
  // blok po starcie: bez podbiegów, a w pierwszym tygodniu także bez długiego (R-8)
  const recovering = skeleton.phase === 'transition'
  const workoutsCount = Math.min(
    available.length,
    skeleton.sessionCount ?? Math.max(style.minWorkoutsPerWeek, Math.ceil(target / style.typicalKmPerSession)),
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
  const longWd = inTaper || (recovering && skeleton.qualitySessions === 0)
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
  let hillsWd = inTaper || recovering
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
          .reduce((a, x) => a + (x.distanceKm ?? 0), 0) +
        w.segments.filter(x => x.type === 'hills').reduce((a, x) => a + (x.distanceKm ?? 0) / 2, 0),
      0,
    )
    if (total === 0 || z1 / total >= 0.75 || qualityMainKm <= 3) break
    qualityMainKm -= 1
    buildAll()
  }

  // Reconcile actual sessions with the macro budget. Minimum-sized accents are
  // optional; they must never force an unrequested increase in weekly distance.
  const total = () => [...plan.values()].reduce((n, w) => n + w.distanceKm, 0)
  const hardKm = () => [...plan.values()].filter(w => w.kind !== 'race').reduce((n, w) => n + w.segments.reduce((a, s) =>
    a + (['easy', 'warmup', 'cooldown'].includes(s.type) ? 0 : s.type === 'hills' ? (s.distanceKm ?? 0) / 2 : s.distanceKm ?? 0), 0), 0)
  for (const kind of ['quality_continuous', 'quality_intervals', 'easy_hills'] as const) {
    for (const [wd, workout] of plan) {
      if (total() <= target && hardKm() <= target * 0.25) break
      if (workout.kind === kind) plan.set(wd, buildEasy(0, zones))
    }
  }
  // Distribute the residual only to easy running; keep race/test and long intact.
  for (const [wd, w] of plan) if (w.kind === 'easy') plan.set(wd, buildEasy(0, zones))
  const easySlots = [...plan.keys()].filter(wd => plan.get(wd)?.kind === 'easy')
  for (const wd of free) {
    if (plan.size >= workoutsCount) break
    if (!plan.has(wd)) { plan.set(wd, buildEasy(0, zones)); easySlots.push(wd) }
  }
  let remaining = Math.max(0, target - total())
  for (const [i, wd] of easySlots.entries()) {
    const km = Math.min(18, Math.round(remaining / (easySlots.length - i) * 10) / 10)
    if (km > 0) plan.set(wd, buildEasy(km, zones))
    else plan.delete(wd)
    remaining = Math.max(0, remaining - km)
  }
  // An all-quality template can leave no easy slot: release its smallest accent.
  if (remaining > 0.5 && !easySlots.length) {
    const replace = [...plan].reverse().find(([, w]) => w.kind === 'quality_continuous' || w.kind === 'easy_hills')
    if (replace) plan.set(replace[0], buildEasy(Math.min(18, replace[1].distanceKm + remaining), zones))
  }
  remaining = Math.max(0, target - total())
  for (const wd of free) {
    if (remaining <= 0.05) break
    if (plan.has(wd)) continue
    const km = Math.min(18, Math.round(remaining * 10) / 10)
    plan.set(wd, buildEasy(km, zones))
    remaining -= km
  }
}
