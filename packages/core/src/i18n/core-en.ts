/**
 * Angielski katalog tekstów domenowych — ŹRÓDŁO TYPU dla pozostałych języków.
 * Dodanie klucza tutaj wymusza jego dodanie w `core-pl.ts` (błąd `tsc`).
 *
 * Opisy jednostek celowo NIE są kalką z polskiego: polska wersja niesie głos
 * trenera z korpusu („przerwy 2 minutowe w marszu"), a angielska ma brzmieć jak
 * zapis prawdziwego anglojęzycznego planu („2 min walk recovery"). Ta sama
 * treść fizjologiczna, dwa naturalne idiomy.
 */
import { formatNumber, formatPace } from './locale.ts'

const n = (value: number) => formatNumber('en', value)
const km = (value: number) => `${n(value)} km`

export const coreEn = {
  units: {
    km,
    meters: (value: number) => `${n(value)} m`,
    minutes: (value: number) => `${n(value)} min`,
    kmPerWeek: (value: number) => `${n(value)} km/week`,
    pace: formatPace,
  },

  dates: {
    invalidIso: (iso: string) => `Invalid ISO date: ${iso}`,
  },

  weekday: {
    mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday',
    fri: 'Friday', sat: 'Saturday', sun: 'Sunday',
  },
  weekdayShort: {
    mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun',
  },

  kind: {
    easy: 'easy run',
    long: 'long run',
    easy_hills: 'hills',
    quality_intervals: 'intervals',
    quality_continuous: 'tempo',
    sharpener: 'sharpener',
    test: 'time trial',
    race: 'RACE',
  },

  phase: {
    base: 'base',
    build: 'build',
    peak: 'peak',
    taper: 'taper',
    race: 'race week',
  },

  intensityModel: {
    pyramidal: 'pyramidal',
    polarized: 'polarized',
  },

  /** Opisy segmentów — angielski idiom biegowy. */
  workout: {
    warmup: (value: number) => `${km(value)} warm-up`,
    cooldown: (value: number) => `${km(value)} cool-down jog to finish.`,
    easy: (value: number) => `${km(value)} easy.`,
    veryEasy: (value: number) => `${km(value)} very easy.`,
    easyBeforeHills: (value: number) => `${km(value)} easy`,
    hills: (reps: number, repM: number) => `hills: ${reps} × ${repM} m (relaxed).`,
    intervalsKm: (reps: number, pace: string, recoveryMin: number) =>
      `${reps} × 1 km @ ${pace}/km, ${recoveryMin} min walk recovery.`,
    intervals3Km: (reps: number, pace: string, recoveryMin: number) =>
      `${reps} × 3 km @ ${pace}/km, ${recoveryMin} min walk recovery.`,
    /** VO₂max: trucht między odcinkami, dłuższa przerwa marszowa w połowie serii. */
    intervalsVo2: (reps: number, pace: string, jogMin: number, halfway: number, walkMin: number) =>
      `${reps} × 1 km @ ${pace}/km, ${jogMin} min jog recovery, ` +
      `${walkMin} min walk after rep ${halfway}.`,
    intervalsShort: (reps: number, repM: number, pace: string, jogMin: number) =>
      `${reps} × ${repM} m @ ${pace}/km, ${jogMin} min jog recovery.`,
    alternating: (totalKm: number, fast: string, easyPace: string) =>
      `${km(totalKm)} alternating (1 km @ ${fast}/km, 1 km @ ${easyPace}/km).`,
    progression: (totalKm: number, from: string, to: string) =>
      `${km(totalKm)} progression run (${from} → ${to}/km).`,
    timeTrial: (value: number) =>
      `${km(value)} time trial (all-out, fully rested) — ` +
      'write the result into tren.yaml (athlete.results), that is what recalibrates your zones.',
    raceGoal: (name: string) => `RACE: ${name.toUpperCase()}.`,
    raceOther: (what: string) => `RACE: ${what}.`,
    restDay: 'rest day',
  },

  /**
   * Nazwy kroków treningu w pliku FIT — czyta je zegarek w biegu.
   * Limit 23 znaków (STEP_NAME_SIZE): krótko i jednoznacznie.
   */
  fitStep: {
    warmup: 'Warm-up',
    cooldown: 'Cool-down',
    rep: 'Rep',
    recovery: 'Recovery',
    hillRep: 'Hill',
    hillDown: 'Jog down',
    repeat: (reps: number) => `Repeat ${reps}x`,
    alternating: 'Alternating',
    faster: 'Faster',
    slower: 'Slower',
    progression: 'Progression',
    progressionPart: (index: number, total: number) => `Build ${index}/${total}`,
    easy: 'Easy',
    steady: 'Steady',
    timed: 'All out',
  },

  /** Tytuły treningów wypychanych do intervals.icu (widoczne w kalendarzu i na zegarku). */
  syncName: {
    easy: 'Easy run',
    long: 'Long run',
    easy_hills: 'Hills',
    quality_intervals: 'Intervals',
    quality_continuous: 'Tempo',
    sharpener: 'Pre-race sharpener',
    test: 'Time trial',
    race: 'RACE',
  },

  syncError: {
    badKey: ' — check the API key (Settings → Developer Settings)',
    rateLimit: ' — request limit (5000/day, 2500/15 min)',
  },

  strength: {
    session: () =>
      'Heavy strength, ~35 min: squat or deadlift + lunges + calf raises, ' +
      '3 sets × 4–6 reps HEAVY (≥80% 1RM — the last rep is hard but the movement holds), ' +
      '2–3 min rest. Compound lifts, free weights. Never to failure (S-7).',
    taperNote: 'Taper: strength is off — four weeks without the gym does not undo the adaptation (F-13).',
    shortfallByAccents: (placed: number, target: number) =>
      `Only ${placed} of ${target} strength sessions fit this week — accents and the long run ` +
      'come first (S-5); we do not squeeze strength in at the cost of running quality.',
    shortfallByDays: (placed: number, target: number, days: string) =>
      `Only ${placed} of ${target} strength sessions fit this week — the days you chose (${days}) ` +
      'clash with accents or with the 48 h spacing. Widen `strength.days` in tren.yaml, ' +
      'or leave it empty and let the engine pick.',
  },

  predict: {
    noResults: 'No results to calibrate from (W-1)',
    ultraNoModel: 'ultra: no prediction model with verified accuracy — estimated range only',
    noHalfMarathon:
      'no half-marathon result — the VDOT prediction runs optimistic for the marathon (W-4)',
    outOfRiegelRange:
      'source result outside the 3.5–230 min range where the extrapolation holds (W-5)',
  },

  zones: {
    sameDuration: 'The two trials must have different durations',
    trialTooShort: 'shorter trial <2 min — critical speed overestimated (Z-7)',
    trialTooLong: 'longer trial >20 min — outside the model range (Z-7)',
    negativeDPrime: "D' is negative — the trials are inconsistent, repeat the test",
  },

  macro: {
    raceDateInPast: 'Race date is in the past',
    ultraTaperExtrapolated: 'T-8: ultra — extrapolated, no direct source',
    compressedPlan: (weeks: number) =>
      `only ${weeks} weeks to the race — the plan is compressed, without a full progression`,
    peakBelowRecommended: (planned: number, recommended: number, distanceKm: number) =>
      `plan peaks at ${planned} km/week, below the ${recommended} km/week recommended for ` +
      `${n(distanceKm)} km (P-7/P-8) — the time goal carries risk`,
    timeTrialForCalibration: 'time trial: no races on the calendar — zone calibration',
  },

  adapt: {
    layoffDiagnosis: (days: number) =>
      `${days} days without running — the plan from before the break is out of date.`,
    postRaceDiagnosis: (days: number, distanceKm: number) =>
      `${days} days after a ${n(distanceKm)} km race — recovery window.`,
    newResultDiagnosis: (distanceKm: number, date: string) =>
      `New result: ${n(distanceKm)} km (${date}) — zones need recomputing.`,
    uncalibratedTestDiagnosis: (date: string, distanceKm: number) =>
      `The measurement on ${date} (${n(distanceKm)} km) has no result in athlete.results — ` +
      'zones are still computed from the older race.',
    uncalibratedTestAction: (date: string, distanceKm: number, timeSec: string) =>
      `Add the result to athlete.results: { date: "${date}", distanceKm: ${n(distanceKm)}, ` +
      `timeSec: ${timeSec} } → tren diff → tren plan.`,
    timeSecPlaceholder: '<time in seconds>',
    restartAfterLayoff: (weeklyKm: number, days: number) =>
      `Restart: volume ×0.5–0.6 (≈${weeklyKm} km/week) after ${days} days off, ` +
      'no Z3 sessions for 5–7 days, then normal progression. ' +
      'We do not make up the missed kilometres.',
    restartExtrapolated:
      'The post-layoff restart protocol is an extrapolation with no direct source (R-5) — ' +
      'treat it as a starting point, not a rule.',
    postRaceUltra:
      'Ultra: a longer silence than after a marathon, return by feel — there is no data ' +
      'to give you a specific protocol.',
    postRaceMarathon:
      'First 48 h with no running. Then 40 min around LT1 pace every other day ' +
      '(48/96/144 h) — returning at 48 h does not impair recovery and improves ' +
      'jump performance by 96 h.',
    postRaceShort:
      'Easy running ~40 min every other day; no accents until the end of the first week.',
    noUltraSources: 'No sources for ultra recovery — we do NOT extrapolate the marathon rule (R-3).',
    recalibrateFromResult:
      'Recalibrate zones from race results, not from watch readings.',
    olderResultStillUsed: 'zones are still computed from the older race result.',
    timeTrialWithoutResult:
      'A time trial with no result written down is a workout that changed nothing.',
    complianceLow: (pct: number, actualKm: number, plannedKm: number) =>
      `You completed ${pct}% of the planned volume (${actualKm} of ${plannedKm} km).`,
    reduceVolume: (realistic: number) =>
      'The plan is written for a volume you are not running. Bring the base down to ' +
      `≈${realistic} km/week (your average of the last 3 weeks) and progress from there. ` +
      'A plan you complete fully beats a bolder plan you complete 60% of.',
    complianceHigh: (pct: number) => `You consistently exceed the plan (${pct}% of volume).`,
    raiseVolume: (raised: number) =>
      `Raise the base in tren.yaml to ≈${raised} km/week — but the next cycle will still ` +
      'cap growth at ~10%/week; volume jumps do not buy fitness any faster.',
    onTrack: (pct: number, missed: number) =>
      `Execution matches the plan (${pct}% of volume, ${missed} sessions missed).`,
    holdCourse: 'No changes — carry on with the current mesocycle.',
    missedQuality: (count: number) =>
      `Accents missed: ${count}. Those, not the kilometres, build the top end of your fitness.`,
    shiftInsteadOfLosing:
      'If work keeps eating your accents — move them (tren shift) instead of losing them. ' +
      'Two quality sessions a week is the target (I-8).',
  },

  desk: {
    badTime: (value: string) => `Bad time "${value}" — expected HH:MM`,
    endBeforeStart: 'workEnd must be later than workStart',
    windowMorning: 'morning',
    windowLunch: 'lunch',
    windowEvening: 'evening',
    stairSnack: '3 min of stairs (exercise snack)',
    walkBreak: (minutes: number) => `${n(minutes)} min walk`,
    heavyDayPaceNotFeel:
      'Heavy cognitive day and an accent on the plan: run it BY PACE from the watch, ' +
      'not by feel. Mental fatigue raises perceived effort while the physiology is unchanged ' +
      '(heart rate, lactate, VO₂ all the same) and cuts time to exhaustion by ~15%. ' +
      'If the target pace "will not come" despite a normal heart rate — that is perception, not form.',
    moveAccentEarlier:
      'If you can, move the accent before the work block or to another day (tren shift) — ' +
      'a session to exhaustion before demanding mental work degrades that work too.',
    easyIsSafe:
      'An easy session after a heavy mental day is safe — do not race the watch, ' +
      'stay at the slow end of easy pace.',
    nothingFits: (needMin: number) =>
      `No window fits ${needMin} min — shorten the session or move it to another day. ` +
      'A shortened session done beats a full one skipped.',
    restDayBreaks: 'No running today — the sitting breaks stay, they are not training.',
    lowAdherenceByDesign:
      'Design the breaks for low adherence: hitting half of them beats planning a perfect ' +
      'rhythm and abandoning it after a week (a 6-month office RCT changed no behaviour).',
    sittingIsNotInjuryRisk:
      'Hours at the screen do not change the structure of your training plan — sitting is not ' +
      'a documented risk factor for running injuries. The breaks are for metabolism, not for running.',
  },

  solver: {
    longRunOffPreferredDay: (weekday: string) => `long run outside its preferred day (${weekday})`,
    longRunNextToAccent: (date: string) =>
      `long run sits next to the accent on ${date} — two hard days back to back (S-9)`,
    dateOutsideWeek: (date: string) => `${date} is outside this week — ignored`,
    cannotBlockRaceDay: 'the race day cannot be blocked — the solver does not move it',
    droppedEasy: 'ran out of days — an easy session costs least (volume, not stimulus)',
    droppedOther: 'ran out of days after the blocked dates',
    noMakeUp:
      'We do not make up the dropped kilometres on the following days — piling volume on ' +
      'after a missed session works against the progression (P-1/P-3).',
  },

  heat: {
    invalidTemp: 'Invalid temperature.',
    tooCold: (tempC: number, minC: number) =>
      `${tempC} °C is below the data range (from ${minC} °C). The model only describes the warm ` +
      'side of the curve — cold carries its own cost (wind, footing, clothing) that we do not ' +
      'compute here, so returning "no loss" would be misleading.',
    tooHot: (tempC: number, maxC: number) =>
      `${tempC} °C is beyond the model data (up to ${maxC} °C) — above that line mass races get ` +
      'cancelled (WBGT 21 °C is the recommended threshold) and any number would be extrapolation. ' +
      'Run by feel and stay on top of hydration.',
    curveElite: 'front of the field',
    curveFastAmateur: 'fast amateur',
    curveMedian: 'middle of the field',
    curveBackHalf: 'back half of the field',
  },

  infer: {
    noRuns: 'No runs in the 16-week window — fill in the profile by hand.',
    tooFewWeeks: (active: number, window: number) =>
      `Only ${active} active weeks out of the last ${window} — not enough for a reliable ` +
      'inference. Enter your volume by hand.',
    tooFewInBlock:
      'Fewer than 2 active weeks in the most recent training block — enter your volume by hand.',
    layoffAtEnd: (days: number, date: string) =>
      `Last run ${days} days ago (${date}) — the engine will treat this as a restart after a ` +
      'break; the volume below refers to your last active block.',
    zeroWeeksInBlock: (from: string, to: string) =>
      `The reference block (${from} → ${to}) contains zero weeks (holiday? illness?) — ` +
      'the median is taken from the active weeks only.',
    noFixedLongRunDay: 'Your long run has no fixed day in the history — pick one yourself.',
    recentBasis: (weeks: number, from: string, to: string) =>
      `median of ${weeks} active weeks ${from} → ${to} (intervals.icu)`,
    raceReasonDistance: (label: string) => `~${label} distance`,
    raceReasonName: 'race-like name',
    raceReasonPace: 'pace in the top decile of the window',
    distanceHalf: 'half marathon',
    distanceMarathon: 'marathon',
  },
}

/**
 * Kontrakt katalogu. Bez `as const`: stringi mają być typu `string`, żeby polski
 * mógł mieć własne brzmienie — kompilator ma pilnować KOMPLETU kluczy i sygnatur
 * funkcji, nie zgodności treści.
 */
export type CoreMessages = typeof coreEn
