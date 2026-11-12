/**
 * Angielski katalog tekstów domenowych — ŹRÓDŁO TYPU dla pozostałych języków.
 * Dodanie klucza tutaj wymusza jego dodanie w `core-pl.ts` (błąd `tsc`).
 *
 * Opisy jednostek celowo NIE są kalką z polskiego: polska wersja niesie głos
 * trenera z korpusu („przerwy 2-minutowe w marszu"), a angielska ma brzmieć jak
 * zapis prawdziwego anglojęzycznego planu („2 min walk recovery"). Ta sama
 * treść fizjologiczna, dwa naturalne idiomy.
 */
import { formatNumber, formatPace } from './locale.ts'

const n = (value: number) => formatNumber('en', value)
const km = (value: number) => `${n(value)} km`

export const coreEn = {
  shorten: {
    badBudget: 'Use whole minutes: budget and strength 0–1440, preparation 0–120.',
    repeats: (reps: number, meters: number, pace: string, recovery: number) => `${reps} × ${meters} m at ${pace}/km; ${recovery} s recovery after each repetition`,
    setBreak: (afterRep: number, sec: number, mode: 'walk' | 'jog') => `after repetition ${afterRep} an extra ${sec} s ${mode === 'walk' ? 'walking' : 'jogging'}`,
  },
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
    transition: 'transition',
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
    easyStrides: (value: number, count: number, meters: number) =>
      `${km(value)} easy, finishing with ${count} strides of about ${meters} m.`,
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
      'write the result into trainctl.yaml (athlete.results), that is what recalibrates your zones.',
    raceGoal: (name: string) => `RACE: ${name.toUpperCase()}.`,
    raceOther: (what: string) => `RACE: ${what}.`,
    restDay: 'rest day',
  },

  /**
   * PLAN-v0.7 C1: notacja jednostki generowana ze struktury (`sessionLine`). Skróty
   * neutralne (decyzja 2), objaśnione jednym wierszem legendy pod widokiem.
   */
  notation: {
    warmup: 'WU',
    cooldown: 'CD',
    recovery: 'r.',
    walk: 'walk',
    jog: 'jog',
    hills: 'hills',
    strides: 'strides',
    timeTrial: 'time trial',
    race: 'RACE',
    drill: 'drill',
    sendoff: 'on',
    strength: 'strength',
    /** Dłuższa przerwa w połowie serii: po którym odcinku. */
    afterRep: (rep: number) => `after rep ${rep}`,
    /** `unit`: km albo mi (C9) — tempo w notacji jest na jednostkę widoku. */
    legend: (unit: string) => `WU warm-up · CD cool-down · r. recovery · pace in min/${unit}`,
    /** C10: the club codes are Polish; in English the club setting keeps the neutral legend. */
    clubLegend: (unit: string) => `WU warm-up · CD cool-down · r. recovery · pace in min/${unit}`,
    /** Nazwy części jednostki w widoku struktury (`today`, C2). */
    part: {
      warmup: 'warm-up', cooldown: 'cool-down', easy: 'easy', steady: 'steady', intervals: 'main set',
      hills: 'hills', progression: 'progression', alternating: 'alternating', race: 'race',
      timeTrial: 'time trial', strides: 'strides', work: 'work', drill: 'drill', rest: 'rest',
    },
    /** Zbieg po podbiegu jako przerwa. */
    jogDown: 'jog down',
    /** C8: pułap tętna dopisany do biegu spokojnego i długiego („HR ≤149"). */
    hr: 'HR',
    /** C8: pułap tętna w opisie treningu wypychanego do kalendarza (tekst nad krokami). */
    hrNote: (bpm: number) => `HR ≤${bpm} bpm (Z-2): ceiling for easy running; pace stays the target.`,
  },

  /**
   * PLAN-v0.7 C6: coaching sesji planu v2 — przepisy (MS-6, „inż.”), kroki,
   * uzasadnienia i wskazówki wysiłku. Opis zamiaru, nie strefa ani ocena wykonania.
   * Tekst trafia do `plan.yaml` w języku z chwili generowania.
   */
  coaching: {
    /** Wskazówka RPE słowami: od bardzo lekko do mocno, osobno dla pływania. */
    cue: {
      veryEasy: 'Very easy; relaxed, unhurried breathing.',
      easy: 'Comfortable conversation in full sentences.',
      easySwim: 'Relaxed exhalation into the water; unforced technique.',
      moderate: 'Purposeful effort; short sentences possible.',
      moderateSwim: 'Steady rhythm; maintain the catch.',
      hard: 'Hard, not a sprint; keep enough in reserve for the last repetition.',
      hardSwim: 'Hard but controlled stroke and breathing; no breath holding.',
    },
    byFeel: 'by feel',
    label: {
      objective: 'Objective', why: 'Why', success: 'Success', adjustment: 'Adjustment',
      phase: 'Phase', cycleWeek: 'Cycle week', planGoal: 'Plan goal', experience: 'Experience',
    },
    context: {
      standalone: 'Standalone session without a specified plan phase.',
      reduced: 'Reduced work allows recovery between loading blocks.',
      taper: 'A short stimulus maintains rhythm with less volume before the event.',
      dose: 'Experience and available time limit the dose; progression does not require increasing intensity.',
      brick: 'Brick: practise a calm bike-to-run transition and controlled pacing after the change of sport.',
    },
    /** Cel biegu z planu biegowego w planie v2, według rodzaju jednostki. */
    running: {
      test: 'Measure current running fitness while preserving the test protocol.',
      race: 'Execute the race goal with a controlled opening pace.',
      long: 'Develop durability and maintain form as fatigue builds.',
      hills: 'Practise uphill rhythm and running strength with controlled form.',
      progression: 'Develop control of progressive pacing without sudden acceleration.',
      intervals: 'Develop the ability to sustain the prescribed segment pace; keep the planned recoveries.',
      easy: 'Build aerobic endurance with comfortable breathing.',
      success: 'Keep the prescribed pace ranges and consistent form through the finish; log duration and RPE afterwards.',
      adjustment: 'Slow down if form deteriorates; use the plan tool to shorten the session while preserving warm-up and cool-down.',
    },
    level: { trained: 'trained', regular: 'regular', new: 'new or unspecified' },
    /** Uzasadnienie wyboru przepisu (MS-6). */
    reason: {
      race: 'The race remains a separate event; its distance and duration come from the goal, not the weekly training template.',
      hard: 'The shorter event distance and declared training experience allow a short, bounded set of harder repetitions.',
      sustained: 'A longer event or regular experience favours controlled subthreshold work over very hard repetitions.',
      technique: 'The drill isolates a skill; the following main set transfers it to normal movement.',
      openers: 'Before the event there are few repetitions; additional time stays easy.',
      tempo: 'Base or a lighter week favours moderate power and full recoveries.',
      swimCss: 'Repeated lengths with rests practise even pacing without requiring one long continuous effort.',
      swimTimed: 'Without current CSS, time and RPE guide the harder repetitions; rests allow breathing and technique to recover.',
      runRepeats: 'Short repetitions with recoveries practise an even, harder effort. Pace comes from a current running result; otherwise RPE guides the effort.',
      easy: 'Easy intensity develops consistency and technique without adding another hard session.',
    },
    /** Przepisy MS-6: nazwa i cel sesji. */
    recipe: {
      race: { title: 'Race', objective: 'Execute the event goal using a separate pacing plan and course conditions.' },
      brickBike: { title: 'Bike before transition', objective: 'Hold an even effort and finish with reserves for the run.' },
      brickRun: { title: 'Run off the bike', objective: 'Practise running after cycling; start gently and settle into your stride.' },
      bikeOpeners: { title: 'Short openers', objective: 'Maintain the rhythm of harder riding with a small work dose.' },
      bikeTempo: { title: 'Controlled tempo', objective: 'Develop sustained, even moderate effort.' },
      bikeAerobicPower: { title: 'Aerobic power: short repetitions', objective: 'Develop repeatable hard efforts without sprinting.' },
      bikeThreshold: { title: 'Threshold repetitions', objective: 'Practise even power near FTP without fading across repetitions.' },
      bikeSustained: { title: 'Sustained subthreshold repetitions', objective: 'Develop sustained, strong but controlled riding.' },
      swimOpeners: { title: 'Short pre-race repetitions', objective: 'Maintain pace awareness and freshness with few repetitions.' },
      swimControlledSpeed: { title: 'Controlled speed', objective: 'Keep an effective catch and rhythm during short, hard repetitions.' },
      swimCssRepeats: { title: 'Even repetitions near CSS', objective: 'Practise repeatable pace and technique across repetitions.' },
      swimTimedRepeats: { title: 'Timed repetitions by feel' },
      technique: {
        title: 'Technique and relaxed rhythm',
        objectiveSwim: 'Improve alignment, exhalation and relaxed arm recovery, then transfer the skill to freestyle.',
        objective: 'Practise smooth, even movement without increasing effort.',
      },
      runRepeats: { title: 'Controlled running repetitions', objective: 'Practise even-paced repetitions with controlled running form.' },
      endurance: { title: 'Easy endurance', objective: 'Extend comfortable effort while maintaining stable technique.' },
      aerobic: { title: 'Easy aerobic training', objective: 'Build aerobic endurance without accumulating heavy fatigue.' },
    },
    /** Instrukcje kroków. */
    step: {
      recoverySwim: 'Rest at the wall after every repetition, including the last.',
      recovery: 'Move very easily after every repetition, including the last.',
      warmup: 'Start very gently; gradually settle rhythm and breathing.',
      cooldown: 'Gradually reduce effort and relax your movement.',
      drillBreathing: 'Easy freestyle: look down, exhale into the water and turn for a natural breath. Do not lengthen breath holds.',
      drillRecovery: 'Relaxed freestyle recovery: skim the fingertips above the surface. Do not force the shoulder; then return to normal freestyle.',
      drillName: 'Technique drill',
      transfer: 'Transfer the practised skill to easy freestyle.',
      swimRepeats: 'Keep rhythm and stroke quality consistent from the first repetition to the last.',
      swimSpare: 'Swim easily; maintain relaxed alignment.',
      swimFinish: 'Swim easily and finish at the wall.',
      lastRep: 'Make the last repetition as controlled as the first; do not exceed the target.',
      drill: 'Keep a smooth rhythm; relax the shoulders without adding force.',
      brick: 'Control breathing and rhythm through the sport transition; do not accelerate into fatigue.',
      even: 'Keep an even effort and relaxed technique.',
    },
    /** Dostosowania zapisane przy sesji. */
    adjust: {
      replacedQuality: 'Quality work replaced by an easy session because of experience or recovery.',
      swimNoSet: 'Too little time for a complete quality set; easy swimming selected.',
      swimTimed: 'Without usable CSS or room for complete lengths: timed repetitions by RPE, without guessing distance. Finish at the wall.',
      noSet: 'Too little time for a complete set with warm-up and recoveries; easy training selected.',
      noDrill: 'The budget does not fit a drill and follow-up main set; complete an easy session.',
      rpeOnly: 'Intensity is guided by RPE 1–10; a missing current measurement is not replaced by another sport’s result.',
      slowDown: 'If effort or form falls outside the guidance, slow down or shorten the set. Do not make up missed repetitions.',
    },
    /** Kryteria wykonania. */
    success: {
      race: 'Execute the separate race plan; record your result and observations from the event.',
      technique: 'Transfer the drill cue to the main set: keep relaxed breathing and smooth movement.',
      intervals: 'Keep the prescribed effort and full recoveries; compare pace or power in the first and last repetitions.',
      easy: 'Keep comfortable breathing and stable form; finish with reserves.',
      log: 'Log duration, perceived effort (RPE) and any reduction in repetitions.',
    },
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
    walk: 'Walk',
    jog: 'Jog',
    stride: 'Stride',
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
    strength: 'Strength',
  },

  syncNotice: {
    raceRejected: (dates: string) => `intervals.icu did not accept the races (${dates}) in any form; they are not in the calendar.`,
    strengthRejected: (dates: string) => `intervals.icu did not accept the strength sessions (${dates}); the running sessions are pushed.`,
    raceFallback: (dates: string) => `intervals.icu did not accept race events (${dates}); they were pushed as ordinary calendar entries.`,
  },

  syncError: {
    badKey: ' — check the API key (Settings → Developer Settings)',
    rateLimit: ' — request limit (5000/day, 2500/15 min)',
  },

  strength: {
    transitionNote:
      'First week after the race: no strength yet — it comes back next week with one lighter session (R-9).',
    sessionIntro: () =>
      'Strength, getting into it, ~35 min: squat or deadlift + lunges + calf raises, 3 sets × 6 reps at a weight ' +
      'you could lift 8–10 times (~75% 1RM) — learning the movement before the heavy weeks (F-18). Never to failure (S-7).',
    sessionMaintenance: () =>
      'Maintenance strength, ~25 min: squat or deadlift + calf raises, 2 sets × 3–5 reps HEAVY (≥80% 1RM), ' +
      '2–3 min rest. One session a week keeps what the block built (F-12, F-14). Never to failure (S-7).',
    peakNote:
      'Peak: one strength session a week — enough to keep the adaptation while running takes priority (F-12, F-14).',
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
      'clash with accents or with the 48 h spacing. Widen `strength.days` in trainctl.yaml, ' +
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
    raceDurationUnknown: 'Race duration is unknown; no training window can be confirmed.',
    raceConflict: (date: string) => `Race calendar conflict at ${date}: multiple races in one week or a tune-up during taper. Resolve the calendar explicitly.`,
    raceDateInPast: 'Race date is in the past — set the next goal in trainctl.yaml',
    baseEndInPast: 'The end date of the base plan (goal.until) is in the past',
    transitionWeek: (week: number, total: number) => `after the race: week ${week} of ${total} back to training (R-8)`,
    ultraTaperExtrapolated: 'T-8: ultra — extrapolated, no direct source',
    returnBlock: (start: number, previous: number) =>
      `return after a break: the first block is easy running only, from ${n(start)} km/week (about half of the ${n(previous)} km/week before the break), ` +
      'growing back within P-3 — R-11, engineering values with no study behind the parameters',
    daysCapVolume: (planned: number, wanted: number, days: number) =>
      `${days === 1 ? '1 running day holds' : `${days} running days hold`} ${planned} km/week without overloading one session (S-10, E-3) — ` +
      `the plan stops there instead of ${wanted} km/week; another running day would add the rest`,
    compressedPlan: (weeks: number) =>
      `only ${weeks} weeks to the race — the plan is compressed, without a full progression`,
    peakBelowRecommended: (planned: number, recommended: number, distanceKm: number) =>
      `plan peaks at ${planned} km/week, below the ${recommended} km/week recommended for ` +
      `${n(distanceKm)} km (P-7/P-8) — the time goal carries risk`,
    timeTrialForCalibration: 'time trial: no races on the calendar — zone calibration',
  },

  adapt: {
    incompleteData: 'Execution data is incomplete. Missing records do not prove a training break; confirm skipped sessions or refresh the data before changing volume.',
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
      `timeSec: ${timeSec} } → trainctl diff → trainctl plan.`,
    timeSecPlaceholder: '<time in seconds>',
    restartAfterLayoff: (weeklyKm: number, days: number) =>
      `Restart: volume ×0.5–0.6 (≈${weeklyKm} km/week) after ${days} days off, ` +
      'the first block easy only until the next deload (R-11), then the plan grows back within P-3. ' +
      'We do not make up the missed kilometres.',
    restartExtrapolated:
      'The post-layoff restart protocol is an extrapolation with no direct source (R-5, R-11) — ' +
      'treat it as a starting point, not a rule.',
    restartAfterIllness: (weeklyKm: number, days: number) =>
      `Return after illness: volume ×0.5–0.6 (≈${weeklyKm} km/week) after ${days} days off, ` +
      'at least 7 days easy only (to the end of the week they end in, R-5), then the plan grows back within P-3. ' +
      'We do not make up the missed kilometres.',
    injuryReturn:
      'The break was an injury: the engine proposes no volume. When and how much to run again is a decision ' +
      'for you and a specialist (R-6, R-7); after that, record the return and run adapt again.',
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
    complianceLimited: (pct: number, km: number) =>
      `You run more than the plan (${pct}% of volume), but the time budget or the days hold about ${km} km this week. ` +
      'The surplus is about time, not the baseline: to let the plan use it, raise the budget under `time` or add a day to `daysAvailable`.',
    raiseVolume: (raised: number) =>
      `Raise the base in trainctl.yaml to ≈${raised} km/week — but the next cycle will still ` +
      'cap growth at ~10%/week; volume jumps do not buy fitness any faster.',
    onTrack: (pct: number, missed: number) =>
      `Execution matches the plan (${pct}% of volume, ${missed} sessions missed).`,
    holdCourse: 'No changes — carry on with the current mesocycle.',
    returnPlanned: 'The plan already has an approved return block for this break; there is nothing new to prepare (R-5, R-11).',
    returnInProgress: 'A return block is running: the return curve sets the volume, so compliance in a window that still holds the break does not change the baseline (R-5, R-11).',
    missedQuality: (count: number) =>
      `Accents missed: ${count}. Those, not the kilometres, build the top end of your fitness.`,
    shiftInsteadOfLosing:
      'If work keeps eating your accents — move them (trainctl shift) instead of losing them. ' +
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
      'If you can, move the accent before the work block or to another day (trainctl shift) — ' +
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
    blockedStrength: (date: string) => `Strength removed from blocked day ${date}.`,
    badConstraints: 'Invalid time budget or preparation time.',
    pinnedConflict: (date: string) => `Protected day ${date} conflicts with the availability or time budget.`,
    noTime: 'No available time window; the session was dropped rather than compressed.',
    longRunOffPreferredDay: (weekday: string) => `long run outside its preferred day (${weekday})`,
    dateOutsideWeek: (date: string) => `${date} is outside this week — ignored`,
    cannotBlockRaceDay: 'the race day cannot be blocked — the solver does not move it',
    droppedEasy: 'ran out of days — an easy session costs least (volume, not stimulus)',
    droppedOther: 'ran out of days after the blocked dates',
    droppedLine: (kind: string, from: string, reason: string) =>
      `dropped: ${kind} from ${from} — ${reason}`,
    tradeoffLine: (note: string) => `trade-off: ${note}`,
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
    allWithheld: (count: number, sources: string) =>
      `The window holds ${count} activities, but ${sources} does not expose their data through ` +
      'the intervals.icu API — there is nothing to infer a profile from. Connect your watch ' +
      '(Garmin, Coros, Wahoo) to intervals.icu directly, not through Strava.',
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
