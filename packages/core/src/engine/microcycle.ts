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
  WeekNote,
  WeekSkeleton,
} from '../domain/types.ts'
import { paceZones, type PaceZones } from '../zones/daniels.ts'
import { messages } from '../i18n/index.ts'
import { addDays, diffDays } from '../util/dates.ts'
import { COACH_STYLE, type HouseStyle } from './house-style.ts'

const WEEKDAY_ORDER: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

export function fmtPace(secPerKm: number): string {
  const m = Math.floor(secPerKm / 60)
  const s = Math.round(secPerKm % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

/**
 * E-3 (inż.): sufit pojedynczego biegu spokojnego. Korpus nie ma reguły — to
 * granica, przy której reszta kilometrów przestaje być „spokojną uzupełniającą".
 */
const EASY_RUN_CAP_KM = 18
/** E-3 (inż.): część główna akcentu ≈ 22% tygodnia przed odjęciem rozgrzewki i schłodzenia. */
const QUALITY_MAIN_SHARE = 0.22
/** J-8 (korpus): na początku przygotowania ~3 km poza Z1 na sesję; stąd rośnie dawka akcentu (B5). */
const START_DOSE_KM = 3
/**
 * J-4 (korpus): drabinka 1000/400/200 m @I w szczycie — trzy serie odcinków po kolei.
 * Przerwy w truchcie: 2' po 1000 m, 1' po 400 i 200 m (E-3, inż.).
 */
const LADDER = [{ repM: 1000, recoverySec: 120 }, { repM: 400, recoverySec: 60 }, { repM: 200, recoverySec: 60 }] as const
const LADDER_SET_KM = LADDER.reduce((s, r) => s + r.repM, 0) / 1000
/** E-3 (inż.): kilometry poza Z1 najwyżej 25% tygodnia — margines pod I-5 (≥75% Z1). */
const HARD_SHARE_MAX = 0.25
/** S-10 (korpus): najdłuższy inny bieg spokojny ≤ 0,9 długiego — P90 stosunku 0,67–0,91 w 130 tygodniach. */
const EASY_TO_LONG_MAX = 0.9
/**
 * E-3 (inż.): jedna jednostka poza długim, startem i sprawdzianem najwyżej 35% tygodnia.
 * Ten sam próg ma lint kształtu `sessionShareHigh` i warunek sprawdzianu w makrocyklu.
 */
export const SESSION_SHARE_MAX = 0.35
/** E-3 (inż.): najkrótszy bieg spokojny — krótsza reszta dolicza się do długiego. Poniżej zakresu korpusu (decyzja 1). */
export const MIN_EASY_KM = 3
/** Rama akcentu: rozgrzewka i najmniejsza liczba odcinków kilometrowych. */
interface Frame { warmupKm: number; minReps: number }
/** E-3 (inż.): co najmniej 4 odcinki kilometrowe — zapis korpusu bez reguły w FOUNDATIONS. */
const standardFrame = (style: HouseStyle): Frame => ({ warmupKm: style.warmupKm, minReps: 4 })
/**
 * E-3 (inż.): ramy przy małej objętości, po kolei, gdy pełna przekroczyłaby
 * SESSION_SHARE_MAX tygodnia — najpierw mniej odcinków, potem krótsza rozgrzewka.
 */
const SMALLER_FRAMES = (style: HouseStyle): Frame[] => [{ warmupKm: style.warmupKm, minReps: 3 }, { warmupKm: 2, minReps: 3 }]
/** E-3 (inż.): przebieżki w biegu, który zastępuje akcent — J-6 opisuje je jako praktykę, bez liczb. */
const STRIDES = { count: 6, meters: 80 }
const round1 = (km: number) => Math.round(km * 10) / 10
/** Sufit w dół do 0,1 km: zaokrąglony w górę przekraczałby próg, z którego powstał. */
const floor1 = (km: number) => Math.floor(km * 10 + 1e-9) / 10
/**
 * §10.15 (korpus): sufit udziału długiego w tygodniu — P90 według objętości (130
 * tygodni), w środkach pasm 30–40, 40–50, 50–60, 60–70 i ≥70 km. Między środkami
 * interpolacja liniowa (inż.): schodek na granicy pasma skracałby długie o 3 km przy
 * +1 km tygodnia. Poniżej 30 km korpus ma 5 tygodni — obowiązuje pasmo 30–40 km
 * (inż., decyzja 1 z PLAN-v0.7).
 */
const LONG_SHARE_P90: [weekKm: number, share: number][] = [[35, 0.53], [45, 0.52], [55, 0.46], [65, 0.41], [75, 0.36]]
/**
 * S-10 (korpus, §10.15): tydzień z dwoma biegami — pasmo <30 km, mediana 2 biegi — ma
 * długie na 0,78 tygodnia, P90 0,80. Sufit udziału długiego w takim tygodniu (n = 6, słabo).
 */
const TWO_RUN_LONG_SHARE_P90 = 0.8
export function longShareCeiling(weekKm: number): number {
  const [first] = LONG_SHARE_P90
  if (weekKm <= first![0]) return first![1]
  for (let i = 1; i < LONG_SHARE_P90.length; i++) {
    const [km, share] = LONG_SHARE_P90[i]!
    const [prevKm, prevShare] = LONG_SHARE_P90[i - 1]!
    if (weekKm <= km) return prevShare + ((share - prevShare) * (weekKm - prevKm)) / (km - prevKm)
  }
  return LONG_SHARE_P90.at(-1)![1]
}

/** Środek zakresu tempa — tempo wpisywane w opis odcinka. */
export const paceMid = (r: { loSecPerKm: number; hiSecPerKm: number }): number =>
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
      s.description = s.description.replace(/\d+:\d{2}/g, fmtPace(paceMid(s.pace)))
    } else if (s.type === 'progression') {
      s.pace = { loSecPerKm: paceMid(zones.threshold), hiSecPerKm: zones.marathon.hiSecPerKm }
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

/** J-6: bieg spokojny z przebieżkami w miejscu akcentu, gdy tydzień jest za mały na akcent z ramą. */
function buildStrides(km: number, z: PaceZones): PlannedWorkout {
  return {
    kind: 'easy',
    distanceKm: km,
    ruleRefs: ['I-5', 'J-6'],
    segments: [{
      type: 'easy',
      distanceKm: km,
      pace: z.easy,
      description: messages().workout.easyStrides(km, STRIDES.count, STRIDES.meters),
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
  frame: Frame = standardFrame(style),
): PlannedWorkout {
  const segments: PlannedSegment[] = [segWarmup(frame.warmupKm, z)]
  let main: PlannedSegment
  if (polarized) {
    // peak: Z3 — interwały VO2max @I (I-2)
    const reps = Math.max(frame.minReps, Math.round(mainKm))
    main = {
      type: 'intervals',
      reps,
      repM: 1000,
      distanceKm: reps,
      pace: z.interval,
      recoverySec: 180, // E-3 (inż.): przerwy 3' trucht przy odcinkach @I, z korpusu bez reguły
      recoveryMode: 'jog',
      // E-3 (inż.): 4' marsz po połowie serii — zapis korpusu
      setBreak: { afterRep: Math.ceil(reps / 2), sec: 240, mode: 'walk' },
      description: messages().workout.intervalsVo2(
        reps, fmtPace(paceMid(z.interval)), 3, Math.ceil(reps / 2), 4,
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
      recoverySec: 180, // E-3 (inż.)
      recoveryMode: 'walk',
      description: messages().workout.intervals3Km(reps, fmtPace(paceMid(z.threshold)), 3),
    }
  } else {
    const reps = Math.max(frame.minReps, Math.round(mainKm))
    main = {
      type: 'intervals',
      reps,
      repM: 1000,
      distanceKm: reps,
      pace: z.threshold,
      recoverySec: 120, // E-3 (inż.): 2' marsz — zapis korpusu, bez reguły w FOUNDATIONS
      recoveryMode: 'walk',
      description: messages().workout.intervalsKm(reps, fmtPace(paceMid(z.threshold)), 2),
    }
  }
  segments.push(main, segCooldown(style.cooldownKm))
  return {
    kind: 'quality_intervals',
    distanceKm: frame.warmupKm + (main.distanceKm ?? 0) + style.cooldownKm,
    ruleRefs: ['I-7', 'I-8', polarized ? 'I-2' : 'I-1'],
    segments,
  }
}

/** J-4: drabinka w szczycie — serie 1000/400/200 m @I, co najmniej dwie (dawka ~3,2 km). */
function buildLadder(mainKm: number, style: HouseStyle, z: PaceZones, frame: Frame): PlannedWorkout {
  const sets = Math.max(2, Math.round(mainKm / LADDER_SET_KM))
  const pace = fmtPace(paceMid(z.interval))
  const main: PlannedSegment[] = LADDER.map(({ repM, recoverySec }) => ({
    type: 'intervals',
    reps: sets,
    repM,
    distanceKm: (sets * repM) / 1000,
    pace: z.interval,
    recoverySec,
    recoveryMode: 'jog',
    description: messages().workout.intervalsShort(sets, repM, pace, recoverySec / 60),
  }))
  return {
    kind: 'quality_intervals',
    distanceKm: Math.round((frame.warmupKm + sets * LADDER_SET_KM + style.cooldownKm) * 10) / 10,
    ruleRefs: ['I-7', 'I-8', 'I-2', 'J-4'],
    segments: [segWarmup(frame.warmupKm, z), ...main, segCooldown(style.cooldownKm)],
  }
}

function buildQualityContinuous(
  mainKm: number,
  polarized: boolean,
  style: HouseStyle,
  z: PaceZones,
  frame: Frame = standardFrame(style),
): PlannedWorkout {
  const segments: PlannedSegment[] = [segWarmup(frame.warmupKm, z)]
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
    const to = paceMid(z.threshold)
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
    distanceKm: frame.warmupKm + mainKm + style.cooldownKm,
    ruleRefs: ['I-7', 'I-8', polarized ? 'I-2' : 'I-1'],
    segments,
  }
}

/** E-3 (inż.): przedstartowe 5×300 m @I — utrzymanie intensywności w tygodniu startu (T-1). */
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
        recoveryMode: 'jog',
        description: messages().workout.intervalsShort(reps, repM, fmtPace(paceMid(z.interval)), 1),
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

  let notes: WeekNote[] = []
  if (skeleton.raceDate && input.goal) {
    planRaceWeek(plan, skeleton.raceDate, input.goal, available, style, zones, skeleton.weekStart, skeleton.sessionCount)
  } else {
    notes = planNormalWeek(plan, skeleton, available, style, zones, input.testDistanceKm)
  }

  const days: PlannedDay[] = WEEKDAY_ORDER.map((wd) => {
    const workout = plan.get(wd)
    return {
      date: dateOf(wd),
      weekday: wd,
      ...(workout ? { workout } : {}),
    }
  })

  const totals = weekTotals(days)
  // Dni mieszczą mniej niż zamiar (B1): zapis obok `targetKm`, z nim lint porównuje sumy.
  // Wartość z poprzedniego przebiegu (regeneracja z zapisanego szkieletu) nie przechodzi.
  const { layoutKm: _previous, ...base } = skeleton
  const short = !skeleton.raceDate && totals.totalKm < skeleton.targetKm - 0.5
  return {
    weekStart: skeleton.weekStart,
    skeleton: short ? { ...base, layoutKm: round1(totals.totalKm) } : base,
    days,
    ...totals,
    ...(notes.length ? { notes } : {}),
  }
}

/**
 * Największa objętość tygodnia ładowania do `upToKm`, którą dni biegacza mieszczą pod
 * sufitami jednostek (S-10, E-3): makrocykl nie planuje szczytu, którego nie da się
 * rozpisać, bo wtedy odciążenie i taper liczone od zamiaru wychodzą cięższe od tygodni,
 * które biegacz naprawdę ma (B1). Próbny tydzień budowania i szczytu; tempo nie zmienia
 * kilometrów, więc strefy są stałe. Układ nie jest monotoniczny (dzień podbiegów zostaje
 * albo wypada), dlatego przegląd idzie od góry co 1 km.
 */
export function weekCapacityKm(athlete: AthleteProfile, qualitySessions: number, upToKm: number, style: HouseStyle = COACH_STYLE): number {
  const zones = paceZones(50)
  const fits = (km: number) => (['pyramidal', 'polarized'] as const).every((model) => {
    const week = generateMicrocycle({
      skeleton: {
        weekStart: '2026-01-05', index: 1, phase: model === 'polarized' ? 'peak' : 'build', intensityModel: model,
        targetKm: km, deload: false, keepIntensity: false, keepFrequency: false, qualitySessions, flags: [], ruleRefs: [],
      },
      athlete,
      zones,
      style,
    })
    return week.totalKm >= km - 0.5
  })
  for (let km = Math.round(upToKm); km > 0; km--) if (fits(km)) return km
  return 0
}

/**
 * Objętość tygodnia, którą biegacz faktycznie ma: po budżecie czasu z profilu
 * (`timeCappedKm`, E-2), po pojemności dni (`layoutKm`, B1), bez nich — zamiar
 * makrocyklu (`targetKm`). Co pokazuje albo skaluje „bieżącą objętość", czyta ją
 * stąd; samo `targetKm` jest wejściem skalowania bazy, nie tym, co rozpisano na dni.
 */
export const plannedWeekKm = (skeleton: Pick<WeekSkeleton, 'targetKm' | 'timeCappedKm' | 'layoutKm'>): number =>
  skeleton.timeCappedKm ?? skeleton.layoutKm ?? skeleton.targetKm

/**
 * Kilometry poza Z1 jednej jednostki: wszystko poza rozgrzewką, schłodzeniem
 * i biegiem spokojnym; podbiegi w połowie, bo `distanceKm` liczy też zbieg.
 * Jedna definicja dla generatora (sufit mocnych km) i lintów sezonu.
 */
export function hardKmOf(workout: PlannedWorkout): number {
  return workout.segments.reduce((a, s) =>
    a + (['easy', 'warmup', 'cooldown'].includes(s.type) ? 0 : s.type === 'hills' ? (s.distanceKm ?? 0) / 2 : s.distanceKm ?? 0), 0)
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
  // E-3 (inż.): bez liczby sesji ze szkieletu cztery; biegi spokojne po 5 km
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
): WeekNote[] {
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
  // dzień podbiegów tylko wtedy, gdy jego najmniejsza wersja mieści się w udziale jednej
  // jednostki — inaczej przy małej objętości „wypadałby" co tydzień
  // (przy dwóch dniach podbiegów i tak nie ma: dzień zajmują długie i akcent)
  const hillsFit = buildHillsDay(MIN_EASY_KM, style, zones).distanceKm <= SESSION_SHARE_MAX * target
  // R-11: pierwszy blok po przerwie bez podbiegów (easyOnly)
  let hillsWd = inTaper || recovering || !hillsFit || skeleton.easyOnly
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
  // Dni wolne do dołożenia biegu (S-11): najpierw te, które trener zostawia na bieganie,
  // dni odpoczynku z house style na końcu.
  const restLast = (wd: Weekday) => (style.restDays.includes(wd) ? 1 : 0)
  const spareDays = free.filter((wd) => wd !== longWd && !used.has(wd) && !easyWds.includes(wd))
    .sort((a, b) => restLast(a) - restLast(b))

  // Tydzień, który nie może mieć trzech biegów (dwa dni), nie ma udziału jednej jednostki
  // do pilnowania: jeden z dwóch biegów ma połowę tygodnia z definicji. Długie ma tam sufit
  // z pasma dwóch biegów (P90 0,80, §10.15) i zostawia drugiemu biegowi co najmniej
  // MIN_EASY_KM — inaczej tor B4 zjada cały tydzień. Zostają twarde sufity: 35 km i S-10.
  const maxRuns = (peakWd ? 1 : 0) + used.size + easyWds.length + spareDays.length
  const shares = maxRuns >= 3

  // objętość
  // E-3 + S-10: bieg spokojny ma co najmniej MIN_EASY_KM i najwyżej 0,9 długiego, więc
  // długie obok niego ma co najmniej MIN_EASY_KM / EASY_TO_LONG_MAX (gdy tydzień mieści oba)
  const longFloorKm = Math.ceil((MIN_EASY_KM / EASY_TO_LONG_MAX) * 10) / 10
  const longFloor = target >= longFloorKm + MIN_EASY_KM ? longFloorKm : 0
  // sufit do 0,1 km jak pozostałe biegi: pełne km spłaszczały długie przy wzroście tygodnia o 1 km
  // jeden dostępny dzień: długie to cały tydzień — drugiego biegu nie ma gdzie postawić
  const twoRunCeil = maxRuns === 2 && longFloor ? floor1(Math.min(TWO_RUN_LONG_SHARE_P90 * target, target - MIN_EASY_KM)) : target
  const longCeil = Math.min(style.longRunCapKm, shares ? floor1(longShareCeiling(target) * target) : twoRunCeil)
  // B4: tor długiego z makrocyklu jest podłogą; sufit udziału (P90) i 35 km — górą
  const longKm = longWd ? Math.max(longFloor, Math.min(longCeil, Math.max(skeleton.longKm ?? 0, Math.min(Math.round(style.longRunShare * target), style.longRunCapKm)))) : 0
  // udział jednej jednostki liczony od objętości tygodnia — od zamiaru, a gdy dni go nie
  // mieszczą, od tego, co rozpisano (tak liczy lint), w drugim przebiegu niżej. Tylko obok
  // długiego, jak lint `sessionShareHigh`: w taperze (bez długiego) akcent zostaje (T-1)
  let shareCap = shares && longWd ? floor1(SESSION_SHARE_MAX * target) : Infinity
  // sufit biegu spokojnego: 18 km (E-3) i pod długim (S-10)
  const easyCap = Math.min(EASY_RUN_CAP_KM, longKm > 0 ? floor1(EASY_TO_LONG_MAX * longKm) : Infinity)
  // Taper i tydzień startowy trzymają liczbę biegów z ostatniego tygodnia ładowania (T-2):
  // bez dokładania dnia i bez usuwania krótkiego biegu.
  const fixedCount = skeleton.keepFrequency && skeleton.sessionCount !== undefined
  // E-3 (inż.): część główna akcentu co najmniej 3 km i ~22% tygodnia — dawka z objętości.
  // B5 (J-8): dawka rośnie w sezonie od START_DOSE_KM do dawki z objętości w ostatnim
  // tygodniu ładowania; pozycję w bloku i po odciążeniu daje makrocykl (accentProgress).
  const volumeDose = Math.max(3, Math.round(QUALITY_MAIN_SHARE * target) - style.warmupKm - style.cooldownKm)
  // Sufit dawki jednego akcentu z sufitu mocnych kilometrów tygodnia (E-3: 25%) po odjęciu
  // podbiegów: progresja idzie do niego, a nie ponad — inaczej sufit spłaszczyłby różne
  // pozycje w sezonie do tej samej dawki (P-1, lint `staleProgression`).
  const hillsHardKm = hillsWd ? (style.hillsReps * style.hillsRepM) / 1000 : 0
  const doseCap = Math.min(volumeDose, Math.floor(((HARD_SHARE_MAX * target - hillsHardKm) / Math.max(1, qualityWds.length)) * 2) / 2)
  const progress = skeleton.accentProgress ?? 1
  let qualityMainKm = doseCap <= START_DOSE_KM ? Math.max(3, doseCap)
    : Math.round((START_DOSE_KM + (doseCap - START_DOSE_KM) * progress) * 2) / 2
  // J-4: w szczycie interwały @I to drabinka 1000/400/200 m
  const ladder = skeleton.phase === 'peak'
  // E-3 (inż.): spokojne wprowadzenie przed podbiegami 5–8 km, ~10% tygodnia
  const hillsEasyKm = hillsWd ? Math.min(8, Math.max(5, Math.round(0.1 * target))) : 0

  // Akcent z pełną ramą; gdy przekroczyłby udział jednej jednostki, mała rama (B2),
  // a gdy i ona — bieg spokojny z przebieżkami (undefined).
  // Po starcie (R-8, B5.4) akcent od najmniejszej ramy — nie cięższy od bloku budowania.
  const frames = recovering ? SMALLER_FRAMES(style) : [standardFrame(style), ...SMALLER_FRAMES(style)]
  const accent = (i: number, mainKm: number): PlannedWorkout | undefined => {
    const build = (frame: Frame) => i === 0
      ? ladder ? buildLadder(mainKm, style, zones, frame) : buildQualityIntervals(mainKm, polarized, style, zones, frame)
      : buildQualityContinuous(mainKm, polarized, style, zones, frame)
    return frames.map(build).find((w) => w.distanceKm <= shareCap)
  }

  // Akcenty zwolnione przez sufit mocnych kilometrów albo objętość tygodnia stają się dniami spokojnymi.
  const released = new Set<Weekday>()
  let withHills = hillsWd !== undefined
  // dzień podbiegów w najmniejszej wersji (spokojne wprowadzenie MIN_EASY_KM), gdy tydzień go nie mieści
  let smallHills = false
  let notes: WeekNote[] = []

  /** Rozpisuje tydzień przy danej dawce akcentu; zwraca kilometry, których dni nie mieszczą. */
  const layout = (mainKm: number): number => {
    plan.clear()
    notes = []
    if (peakWd && peakWorkout) plan.set(peakWd, peakWorkout)
    const strides: Weekday[] = []
    const easy = [...easyWds]
    qualityWds.forEach((wd, i) => {
      const w = released.has(wd) ? undefined : accent(i, mainKm)
      if (w) plan.set(wd, w)
      else if (released.has(wd)) easy.push(wd)
      else {
        strides.push(wd)
        notes.push({ code: 'accentAsStrides', date: addDays(skeleton.weekStart, idxOf(wd)) })
      }
    })
    const hillsDay = hillsWd && withHills
      ? (smallHills ? [MIN_EASY_KM] : [hillsEasyKm, MIN_EASY_KM]).map((km) => buildHillsDay(km, style, zones)).find((w) => w.distanceKm <= shareCap)
      : undefined
    if (hillsWd && hillsDay) plan.set(hillsWd, hillsDay)
    else if (hillsWd) {
      easy.push(hillsWd)
      notes.push({ code: 'hillsDropped', date: addDays(skeleton.weekStart, idxOf(hillsWd)) })
    }
    let remaining = Math.max(0, target - longKm - sumKm(plan))
    // przebieżki pierwsze: zastępują akcent, więc nie wypadają przy małej reszcie
    const slots = [...strides, ...easy]
    const spare = spareDays.filter((wd) => !plan.has(wd) && !slots.includes(wd))
    // Ile może jeszcze wziąć długie (do sufitu udziału, P90). W tygodniu startu kontrolnego
    // albo sprawdzianu tylko krótką resztę: ten tydzień ma być lżejszy.
    const longRoom = longWd ? Math.max(0, Math.min(longCeil - longKm, peakWd ? MIN_EASY_KM : Infinity)) : 0
    // S-11: kolejny dzień dopiero wtedy, gdy reszty nie mieszczą dni spokojne (sufit biegu
    // i udział jednej jednostki, E-3) ani długie — i bieg zostaje nie krótszy niż MIN_EASY_KM
    const perRunCap = Math.min(easyCap, shareCap)
    while (!fixedCount && spare.length && remaining > slots.length * perRunCap + longRoom + 0.05 &&
      remaining / (slots.length + 1) >= MIN_EASY_KM) slots.push(spare.shift()!)
    // E-3: biegu krótszego niż MIN_EASY_KM nie ma — zwykły dzień spokojny wypada
    while (!fixedCount && slots.length > strides.length && remaining + 0.05 < slots.length * MIN_EASY_KM) slots.pop()
    // Przebieżki zastępują akcent, ale też nie są krótsze niż MIN_EASY_KM: dwa dni po 2 km
    // to jeden po 4 km. Reszta idzie do długiego (B2).
    while (!fixedCount && longWd && slots.length && remaining + 0.05 < slots.length * MIN_EASY_KM) {
      const wd = slots.pop()!
      const date = addDays(skeleton.weekStart, idxOf(wd))
      if (strides.includes(wd)) strides.splice(strides.indexOf(wd), 1)
      notes = notes.filter((n) => !(n.code === 'accentAsStrides' && n.date === date))
    }
    // W tygodniu z długim i co najmniej trzema biegami żaden spokojny nie przekracza udziału
    // jednej jednostki. Bez długiego (taper, pierwszy tydzień po starcie) jego rolę ma
    // najdłuższy bieg spokojny, a przy dwóch biegach jeden ma połowę tygodnia z definicji —
    // tak samo liczy lint `sessionShareHigh`.
    const runCap = longWd && plan.size + 1 + slots.length >= 3 ? perRunCap : easyCap
    for (const [i, wd] of slots.entries()) {
      const km = Math.min(runCap, round1(remaining / (slots.length - i)))
      // Taper trzyma liczbę biegów (T-2), ale bieg poniżej kilometra to nie bieg (E-3, inż.):
      // dzień zostaje wolny, a jego kilometry przechodzą na kolejne dni
      if (km < 1) continue
      plan.set(wd, strides.includes(wd) ? buildStrides(km, zones) : buildEasy(km, zones))
      remaining = Math.max(0, remaining - km)
    }
    let long = longKm
    // Reszta, której dni spokojne nie mieszczą, wydłuża długie (do `longRoom`), a reszta
    // krótsza niż bieg (E-3: MIN_EASY_KM) dolicza się do długiego także ponad sufit udziału
    // (B2: krótsza reszta idzie do innego biegu); twardy sufit 35 km zostaje.
    if (longWd && remaining > 0.05) {
      const extra = Math.min(remaining, longRoom)
      long = round1(long + extra)
      remaining = Math.max(0, round1(remaining - extra))
      if (remaining > 0.05 && remaining < MIN_EASY_KM) {
        const rest = Math.min(remaining, style.longRunCapKm - long)
        long = round1(long + rest)
        remaining = Math.max(0, round1(remaining - rest))
      }
    }
    if (longWd) plan.set(longWd, buildLong(long, zones))
    return remaining
  }

  // Reszta, której dni nie mieszczą, zamienia najpierw dzień podbiegów w dzień spokojny
  // (B1: tak trener robi z dniem doklejanym do spokojnego biegu), dopiero potem zostaje uwagą.
  const settle = (mainKm: number): number => {
    const left = layout(mainKm)
    if (left < MIN_EASY_KM || !withHills || !hillsWd) return left
    withHills = false
    return layout(mainKm)
  }

  let left = settle(qualityMainKm)
  // I-5: ≥75% objętości w Z1 — liczone na tygodniu z rozdaną resztą kilometrów
  // dawka leży na siatce 0,5 km, a krok pętli to 1 km — bez zejścia poniżej 3 km (E-3)
  for (let guard = 0; guard < 8 && z1Share(plan) < 0.75 - 1e-9 && qualityMainKm > 3; guard++) left = settle(qualityMainKm = Math.max(3, qualityMainKm - 1))

  // Akcent minimalny jest opcjonalny: nie podnosi tygodnia ponad zamiar i nie łamie
  // sufitu mocnych kilometrów (od tego, co tydzień faktycznie ma — I-5 dotyczy
  // przebiegniętej objętości). Najpierw krótszy dzień podbiegów, potem dodatki przed
  // głównym akcentem: podbiegi są dodatkiem, nie zamiennikiem interwałów płaskich (J-5),
  // drugi akcent wypada przed pierwszym (I-8). Zwolniony dzień staje się spokojny.
  const hardKm = () => [...plan.values()].filter((w) => w.kind !== 'race').reduce((n, w) => n + hardKmOf(w), 0)
  const fits = () => sumKm(plan) <= target + 0.05 && hardKm() <= Math.min(target, sumKm(plan)) * HARD_SHARE_MAX
  if (!fits() && withHills && hillsWd && !smallHills) {
    smallHills = true
    left = settle(qualityMainKm)
  }
  for (const kind of ['easy_hills', 'quality_continuous', 'quality_intervals'] as const) {
    for (const wd of [...plan.keys()]) {
      if (fits()) break
      if (plan.get(wd)?.kind !== kind) continue
      if (kind === 'easy_hills') withHills = false
      else released.add(wd)
      left = settle(qualityMainKm)
    }
  }
  // Tydzień krótszy od zamiaru: jednostki mierzone udziałem w tym, co faktycznie rozpisano.
  // Każde zmniejszenie obniża sumę, więc przebiegi idą do punktu stałego (zbieżność ~0,35
  // na przebieg, sufit zaokrąglany w dół).
  // Przebieg rusza, gdy któraś jednostka poza długim, startem i sprawdzianem ma więcej
  // niż SESSION_SHARE_MAX rozpisanej sumy — tak samo liczy lint `sessionShareHigh`.
  const overShare = () => [...plan].some(([wd, w]) =>
    wd !== longWd && w.kind !== 'race' && w.kind !== 'test' && w.distanceKm > SESSION_SHARE_MAX * sumKm(plan) + 1e-9)
  for (let pass = 0; pass < 12 && shares && longWd && overShare(); pass++) {
    const next = floor1(SESSION_SHARE_MAX * sumKm(plan))
    if (next >= shareCap) break
    shareCap = next
    left = settle(qualityMainKm)
  }
  if (left > 0.5) notes.push({ code: 'volumeShort', targetKm: target, plannedKm: round1(sumKm(plan)) })
  return notes
}

const sumKm = (plan: Map<Weekday, PlannedWorkout>): number => [...plan.values()].reduce((s, w) => s + w.distanceKm, 0)

/** Udział Z1 jak w `weekTotals`: rozgrzewka, schłodzenie, bieg spokojny i zbieg z podbiegów. */
function z1Share(plan: Map<Weekday, PlannedWorkout>): number {
  const total = sumKm(plan)
  if (total === 0) return 1
  const z1 = [...plan.values()].reduce((s, w) => s +
    w.segments.filter((x) => x.type === 'easy' || x.type === 'warmup' || x.type === 'cooldown').reduce((a, x) => a + (x.distanceKm ?? 0), 0) +
    w.segments.filter((x) => x.type === 'hills').reduce((a, x) => a + (x.distanceKm ?? 0) / 2, 0), 0)
  return z1 / total
}
