/**
 * Angielski katalog tekstów interfejsu — ŹRÓDŁO TYPU dla `cli-pl.ts`.
 * Teksty domenowe (opisy jednostek, diagnozy) mieszkają w `@trainctl/core`;
 * tutaj jest wyłącznie to, co należy do warstwy CLI/MCP: nazwy komend,
 * nagłówki, podpowiedzi, komunikaty błędów i opisy narzędzi agenta.
 */
import { formatNumber, pluralEn } from '@trainctl/core'

const n = (value: number) => formatNumber('en', value)

export const cliEn = {
  /** Opisy komend i flag — to, co widać w `trainctl --help`. */
  cmd: {
    banner: 'plan as code, coach as your agent’s tool',
    lang: 'interface language: en | pl (or TRAINCTL_LANG / language in trainctl.yaml)',
    init: 'create your profile (interactive in a terminal)',
    initTemplate: 'write the template without asking',
    initFromIntervals: 'propose a profile from intervals.icu history (needs an API key)',
    plan: 'generate the plan from trainctl.yaml → plan/plan.yaml + plan/PLAN.md',
    today: 'what to run today',
    week: 'week overview; -i browses with arrow keys',
    weekInteractive: 'browse weeks with keys (←/→, s, q)',
    log: 'record a completed session',
    shift: 'swap sessions within a week (no arguments: pick from a list)',
    why: 'why this session — its purpose and the rules behind it',
    adapt: 'review execution and propose plan corrections',
    desk: 'desk day: training windows, breaks, the pace-over-feel rule',
    review: 'the Monday ritual: what happened, what it means, what is ahead',
    push: 'push planned sessions to intervals.icu (→ watch)',
    pull: 'pull completed activities and wellness; compare with the plan',
    export: 'watch file (FIT), calendar (ICS), printable sheet or race pack',
    reschedule: 'rearrange the week around busy days (solver: accents, 48 h, long run)',
    diff: 'what would change if the plan were regenerated from trainctl.yaml',
    check: 'lint the plan: engine invariants + file integrity; errors fail the exit code (CI)',
    optStrict: 'warnings also fail the exit code (for CI)',
    optDate: 'date (defaults to today)',
    optDateOther: 'a date other than today',
    optDateWeek: 'any date inside the week you care about',
    optStatus: 'done|skipped|modified',
    optKm: 'kilometres covered',
    optTime: 'time as MM:SS or HH:MM:SS',
    optNote: 'note (how it felt, conditions)',
    optFrom: 'source date',
    optTo: 'target date',
    optFromRange: 'range start (defaults to today)',
    optToRange: 'range end',
    optDaysAhead: 'how many days ahead (default 14)',
    optDaysBack: 'how many days back (default 28)',
    optReviewDays: 'how many days back to review (default 7)',
    optHeavy: 'today was cognitively heavy (long sessions with agents)',
    optBlock: 'days you cannot train on',
    optWhichWeek: 'which week (defaults to the current one)',
    optApply: 'save the changes (without it, preview only)',
    optExportWhat: 'plan | workout | calendar | print | race',
    optExportDate: 'session to export (for --what workout)',
    firstSteps: 'First steps: ',
    interactively: 'Interactive: ',
    pickFromList: ' (pick from a list) · ',
    browseArrows: ' (browse with arrows)',
    colorsHint: 'Colours: NO_COLOR=1 disables them, TRAINCTL_ASCII=1 forces ASCII glyphs.',
    spinnerPush: 'sending sessions to intervals.icu…',
    spinnerPull: 'fetching data from intervals.icu…',
    spinnerReview: 'preparing the weekly review…',
    spinnerInit: 'fetching your history from intervals.icu…',
  },

  common: {
    nextStep: (command: string) => `next step: ${command}`,
    saved: (what: string) => `Saved ${what}`,
    outsidePlan: (date: string, from: string, to: string) =>
      `${date}: outside the plan range (${from} → ${to}).`,
    noPlan: 'No plan yet — run: trainctl plan',
    missingConfig: (file: string) => `No ${file} — run: trainctl init`,
    configErrors: (file: string, errors: string) => `Errors in ${file}:\n  - ${errors}`,
    cancelled: 'cancelled',
    interrupted: 'interrupted',
    needsTerminal: (command: string) =>
      `Interactive mode needs a terminal (use: ${command}).`,
    labelOk: 'OK',
    labelWarn: '!',
    labelError: 'ERROR',
    badTime: (text: string) => `Invalid time "${text}" — use MM:SS or HH:MM:SS`,
  },

  init: {
    created: (file: string) => `Created ${file}`,
    createdAgents: (file: string) =>
      `Created ${file} — the coach instructions for your agent (Claude Code, Codex)`,
    fillProfile:
      'Fill in the profile — especially results: we calibrate zones from race results, ' +
      'not from watch readings.',
    exists: (file: string) => `${file} already exists — edit it or delete it before running init again.`,
    fromIntervals: (file: string) => `Created ${file} from your intervals.icu history`,
    window: 'Data window',
    currentVolume: 'Current volume',
    windowPeak: 'Window peak',
    trainingDays: 'Training days',
    longRunDay: 'Long run day',
    lastFourWeeks: 'Last four weeks',
    raceCandidates: 'Possible races for zone calibration (confirm before adding!)',
    noRaceCandidates: 'I found no race candidates — add a calibration result by hand.',
    fillGoal: 'fill in the goal section in trainctl.yaml → trainctl plan',
    gitignoreHeader: 'trainctl — secrets, never commit these',
    gitignoreUpdated: (patterns: string) =>
      `Added to .gitignore: ${patterns} — that is where the intervals.icu key goes`,
    unnamed: 'unnamed',
  },

  plan: {
    weeksOfPlan: (weeks: number) => `${weeks} weeks of plan`,
    volumePeak: 'Volume peak',
    recommendedForDistance: 'Recommended for this distance',
    vdot: 'VDOT',
    vdotFromResult: 'from a race result',
    vdotFromGoal: 'from the goal — needs recalibration',
    prediction: 'Predicted finish',
    predictionMethod: (method: string) => `(method: ${method})`,
    predictionAlwaysRange: 'Always a range, never a single number (W-1).',
    goalAmbitious: (target: string) =>
      `The goal of ${target} is bolder than the predicted range — reachable in a perfect cycle, or worth revising.`,
    goalConservative: (target: string) => `The goal of ${target} is conservative against the prediction.`,
    goalInRange: (target: string) => `The goal of ${target} sits inside the predicted range.`,
    structure: 'Structure',
    phaseSpan: (phase: string, from: number, to: number) => `${phase}: weeks ${from}–${to}`,
  },

  today: {
    daysToRace: (days: number) => `${days} days to race`,
    weekOf: (index: number, total: number) => `week ${index}/${total}`,
    deload: 'deload',
    restDayTitle: 'Rest day',
    restDayBody: 'Rest is part of the plan — adaptation happens in recovery.',
    logged: (status: string) => `Logged: ${status}`,
    whyHint: (date: string) => `why this session: trainctl why --date ${date}`,
    strengthTitle: (minutes: number) => `Strength · ~${n(minutes)} min`,
    strengthAloneDay: 'No running today — a clean day for the gym (no clash with running).',
    strengthWithEasy:
      'Keep it separate from the run: ≥3 h apart (S-4). An easy run alongside strength is fine — ' +
      'submaximal effort 24 h after lifting shows no impairment (S-5).',
    strengthWithLong:
      'Keep it apart from the long run: ≥3 h (S-4). If you have the choice — gym AFTER the run, ' +
      'not before; the long run is the more important session today.',
    strengthWithQuality: (kind: string) =>
      `CAREFUL: today also has ${kind} — S-5 advises against pairing heavy strength with a quality ` +
      'session. Move the gym to another day (or skip it this week).',
  },

  week: {
    title: (index: number, total: number, weekStart: string) =>
      `Week ${index}/${total} · from ${weekStart}`,
    subtitle: (phase: string, model: string, targetKm: number, plannedKm: number) =>
      `${phase} (${model}) · target ${n(targetKm)} km · planned ${n(plannedKm)} km`,
    deloadUpper: 'DELOAD',
    columns: { day: 'day', date: 'date', km: 'km', workout: 'workout' },
    rest: 'rest',
    strengthTag: (minutes: number) => `+ STRENGTH ~${n(minutes)} min`,
    raceThisWeek: (date: string) => `Race this week: ${date}`,
    taperNote: 'Taper: volume drops, but intensity and session count stay (T-1/T-2).',
  },

  log: {
    outsidePlan: (date: string) => `Date ${date} is outside the plan range.`,
    unknownStatus: (status: string) => `Unknown status "${status}" — use done|skipped|modified.`,
    saved: (date: string, status: string) => `Logged ${date}: ${status}.`,
  },

  shift: {
    swapped: (from: string, to: string) => `Swapped sessions ${from} ↔ ${to}`,
    weekHint: (date: string) => `see the week: trainctl week --date ${date}`,
    bothDates: 'Give both dates (--from and --to) or neither — then you pick from a list.',
    sameWeekOnly: 'shift works within a single week (full renegotiation — trainctl reschedule)',
    notRaceDay: 'The race day stays put.',
    dayBeforeRaceLight: 'The day before the race stays easy — no accent goes there.',
    outsidePlan: (date: string) => `Date ${date} is outside the plan`,
    accentsTooClose: (a: string, b: string) =>
      `accents on ${a} and ${b} are back to back — rule I-7 asks for ≥48 h between quality sessions`,
    strengthSameDay: (date: string) =>
      `${date}: an accent landed on a strength day — S-5 advises against heavy lifting alongside ` +
      'a quality session; move the gym or regenerate the plan (trainctl plan)',
    strengthDayBefore: (date: string, next: string) =>
      `${date}: the strength session falls the day before an accent (${next}) — ` +
      'S-5 asks for ≥24 h after heavy lifting',
  },

  why: {
    title: (date: string) => `Why this session · ${date}`,
    phaseLine: (phase: string, model: string) => `phase: ${phase} (${model})`,
    deloadWeek: 'deload week',
    restDay:
      'Rest day. Adaptation happens in recovery — the coach’s plans assumed ' +
      '2–3 rest days a week (corpus: Mon 94%, Fri 92%).',
    rules: 'Rules',
    strengthRules: 'Strength rules',
    strengthPurposeTitle: 'What strength is for',
    strengthPurpose:
      'The point is running economy — a lower oxygen cost at the same speed (F-8, and the effect ' +
      'is small: ~2–8% in studies of 10+ weeks). It is NOT "injury protection" — the only ' +
      'meta-analysis on runners came out non-significant (F-9). Honestly: for runners aged 34–45 ' +
      'the effect on economy is also non-significant (F-15), and the evidence for performance ' +
      'stops at 1.5–10 km in a laboratory (F-17). Strength disappears from the plan in the taper (F-13).',
    sourcesHint: (section: string) => `sources and parameters: docs/science/FOUNDATIONS.md ${section}`,
  },

  push: {
    pushed: (count: number, provider: string, from: string, to: string) =>
      `Pushed ${count} sessions to ${provider} (${from} → ${to})`,
    removedStale: (count: number, dates: string) =>
      `Removed ${count} stale entries: ${dates}`,
    nothingToPush: (from: string, to: string) => `Nothing to push in the range ${from} → ${to}.`,
    columns: { date: 'date', workout: 'workout' },
    willSync: 'They will reach the watch at its next sync.',
    upsertHint: 'pushing the same days again overwrites them (upsert by external_id)',
  },

  pull: {
    title: (provider: string) => `Pulled from ${provider}`,
    activities: 'Activities',
    activitiesValue: (total: number, runs: number, km: number) =>
      `${total} (running: ${runs}, ${n(km)} km)`,
    wellnessEntries: 'Wellness entries',
    savedTo: 'Saved to',
    mismatches: 'Plan ↔ execution mismatches',
    columns: { date: 'date', planned: 'planned', actual: 'actual', status: 'status' },
    allMatched: 'Execution matches the plan across the whole range.',
    adaptHint: 'suggested corrections: trainctl adapt',
    noPlanSkipped: 'No plan — comparison skipped.',
    dataWithheld: (count: number, sources: string) =>
      `${count} of these activities come from ${sources}, and intervals.icu does not pass their ` +
      'data through the API (Strava forbids re-export). They have no distance and no type, so ' +
      'they cannot be compared with the plan. Connect your watch to intervals.icu directly.',
  },

  compare: {
    matched: 'on plan',
    shorter: 'shorter',
    longer: 'longer',
    missed: 'not done',
    unplanned: 'unplanned',
  },

  adapt: {
    title: (days: number, today: string) => `Execution review · ${days} days to ${today}`,
    volumeDone: 'Volume completed',
    missedSessions: 'Sessions missed',
    noSnapshot: 'No sync.json — analysis from the journal only. Full data: trainctl pull',
    diagnosis: 'Diagnosis',
    proposals: 'Proposals',
    applyHint: (weeklyKm: number) =>
      `To apply: athlete.recentWeeklyKm: ${weeklyKm} in trainctl.yaml → trainctl diff → trainctl plan. ` +
      'The engine never rewrites the plan on its own.',
  },

  desk: {
    title: (date: string) => `Desk day · ${date}`,
    subtitle: (from: string, to: string) => `work ${from}–${to}`,
    heavyDay: 'heavy cognitive day',
    missingSection:
      'No desk section in trainctl.yaml. Add for example:\n' +
      'desk:\n  workStart: "09:00"\n  workEnd: "17:00"\n  lunchMinutes: 45\n  prefer: evening',
    proposedWindow: (label: string, from: string, to: string) =>
      `Suggested window: ${label} (${from}–${to})`,
    noWindowFits: 'No window in the working day fits this session.',
    windows: 'Training windows',
    columns: { window: 'window', hours: 'hours', status: 'status' },
    fits: 'fits',
    tooShort: 'too short',
    noRunToday: 'No running today',
    breaksStay: 'The sitting breaks stay — they are not training.',
    breaksCount: (count: number) => `Sitting breaks (${count})`,
    notes: 'Notes',
    rulesHint: (rules: string) => `rules: ${rules} — docs/science/FOUNDATIONS.md §10.10`,
  },

  reschedule: {
    title: (weekStart: string) => `Week renegotiation · from ${weekStart}`,
    blockedDates: (dates: string) => `blocked: ${dates}`,
    noBlocks: 'no blocked days',
    unchanged: 'The week stays as it is — nothing needs moving.',
    columns: { day: 'day', date: 'date', before: 'before', after: 'after' },
    whatChanges: 'What changes',
    applied: (files: string) => `Applied — saved ${files}`,
    previewHint: 'this is a preview; apply with: trainctl reschedule --apply (same --block)',
    none: '—',
  },

  diff: {
    title: 'Differences: saved plan → plan from current trainctl.yaml',
    upToDate: 'Plan is current — no differences against a regeneration from trainctl.yaml.',
    manualShifts: 'the plan contains manual shifts — they will show up as differences',
    weekGone: (weekStart: string) => `- week ${weekStart}: disappears from the plan`,
    weekVolume: (weekStart: string, before: number, after: number) =>
      `~ week ${weekStart}: volume ${n(before)} → ${n(after)} km`,
    dayChanged: (date: string, before: string, after: string) => `~ ${date}: ${before} → ${after}`,
    weekNew: (weekStart: string, km: number) => `+ week ${weekStart}: new (${n(km)} km)`,
    applyHint: 'to apply: trainctl plan (overwrites plan/ — you have it in git)',
    localeChanged: (planLocale: string, current: string) =>
      `the plan was generated in "${planLocale}", you are running in "${current}" — ` +
      'run trainctl plan to regenerate the descriptions',
  },

  check: {
    title: 'Plan lint',
    subtitle: (file: string) => `invariants and file integrity, checked against ${file}`,
    passed: (weeks: number, sessions: number) =>
      `No issues: ${weeks} ${pluralEn(weeks, { one: 'week', other: 'weeks' })} and ` +
      `${sessions} ${pluralEn(sessions, { one: 'session', other: 'sessions' })} hold every invariant.`,
    errorsSection: 'File integrity',
    warnsSection: 'Rule deviations',
    summary: (errors: number, warns: number) =>
      `${errors} ${pluralEn(errors, { one: 'error', other: 'errors' })}, ` +
      `${warns} ${pluralEn(warns, { one: 'warning', other: 'warnings' })}`,
    strictHint: 'warnings do not change the exit code — add --strict to make them fail (CI)',
    strictNote: 'strict mode: warnings count as failures',
    malformed: (where: string) =>
      `entry ${where}: missing required fields (weekStart/days or date) — fix the YAML or regenerate the plan`,
    weekLength: (weekStart: string, days: number) =>
      `week ${weekStart}: has ${days} ${pluralEn(days, { one: 'day', other: 'days' })} instead of 7`,
    weekStartNotMonday: (weekStart: string) => `week ${weekStart}: weekStart is not a Monday`,
    weeksNotContiguous: (weekStart: string, prev: string) =>
      `week ${weekStart}: does not start exactly 7 days after the previous week (${prev})`,
    dayOutOfPlace: (date: string, shouldBe: string) =>
      `${date}: out of place — this position in the week belongs to ${shouldBe}`,
    weekdayMismatch: (date: string, stored: string, real: string) =>
      `${date}: the "weekday" field says ${stored}, the calendar says ${real}`,
    totalKmDesync: (weekStart: string, fromDays: number, stored: number) =>
      `week ${weekStart}: totalKm says ${n(stored)} km, the days sum to ${n(fromDays)} km`,
    easyShareDesync: (weekStart: string, fromDaysPct: number, storedPct: number) =>
      `week ${weekStart}: easyShare says ${storedPct}%, recomputed from the days it is ${fromDaysPct}%`,
    workoutKmDesync: (date: string, kind: string, fromSegments: number, stored: number) =>
      `${date} (${kind}): distanceKm says ${n(stored)} km, the segments sum to ${n(fromSegments)} km`,
    raceDayMissing: (date: string) => `${date}: no race on the goal date — the plan lost its target`,
    accentGap: (a: string, b: string, ka: string, kb: string) =>
      `${a} → ${b}: ${ka} and ${kb} less than 48 h apart`,
    workoutBeforeRace: (date: string, kind: string, raceDate: string) =>
      `${date}: ${kind} on the day before the race/test (${raceDate}) — that day stays free`,
    longInTaper: (date: string) =>
      `${date}: long run inside the taper — the taper cuts volume, and the long run is its biggest block`,
    hillsInTaper: (date: string) =>
      `${date}: hill session inside the taper — the engine never schedules hills there`,
    strengthInTaper: (date: string) =>
      `${date}: strength in the taper/race week — strength stops entirely for the taper`,
    strengthOnQualityDay: (date: string, kind: string) =>
      `${date}: strength on the same day as an accent (${kind})`,
    strengthDayBeforeQuality: (date: string, kind: string, next: string) =>
      `${date}: heavy strength the day before an accent (${next}: ${kind}) — the strength deficit lasts up to 48 h`,
    strengthOnLongDay: (date: string, kind: string) =>
      `${date}: strength on the same day as ${kind} — double eccentric load on the same muscles`,
    strengthGap: (a: string, b: string) => `${a} → ${b}: strength sessions less than 48 h apart`,
    easyShareLow: (weekStart: string, pct: number) =>
      `week ${weekStart}: ${pct}% of the volume is easy — the target is ≥75%`,
    longOverCap: (date: string, km: number, cap: number) =>
      `${date}: long run of ${n(km)} km is over the ${n(cap)} km cap — no evidence of benefit beyond it`,
    qualityWithoutFrame: (date: string, kind: string) =>
      `${date} (${kind}): missing a warm-up or a cool-down — an accent carries both`,
    taperNotMonotonic: (weekStart: string, km: number, prevKm: number) =>
      `week ${weekStart}: ${n(km)} km is more than the week before (${n(prevKm)} km) — taper volume falls monotonically`,
  },

  exportCmd: {
    unknownKind: (what: string) => `Unknown export kind "${what}" — plan|workout|print|calendar|race.`,
    titles: {
      plan: 'Whole plan exported for the watch (FIT)',
      workout: 'Session exported for the watch (FIT)',
      calendar: 'Calendar export (ICS)',
      print: 'Printable schedule (HTML)',
      race: 'Race-day pack (HTML)',
    },
    summary: (files: number, kb: string) => `${files} file(s) · ${kb} kB`,
    andMore: (count: number, dir: string) => `…and ${count} more in ${dir}/`,
    printHint: 'Open it in a browser and print (Ctrl+P) — the layout is set for A4.',
    calendarHint: 'Import the .ics into Google Calendar / Outlook — sessions become all-day events.',
    fitHint:
      'Copy the .fit files into GARMIN/Workouts on the watch (mass-storage mode) or import them ' +
      'in Garmin Connect. Cable-free alternative: trainctl push.',
    needDate: 'Give the session date (--date).',
    raceDayNotWorkout: 'That is race day — we do not export it as a workout.',
    restDayNothing: (date: string) => `${date} is a rest day — there is nothing to export.`,
    noWorkouts: 'The plan contains no sessions to export.',
    needTargetOrPrediction:
      'The race pack needs a target time (goal.targetTimeSec) or a prediction ' +
      '(a race result in athlete.results) — there is nothing to compute splits from.',
    pickWhat: 'Give the export kind: trainctl export --what plan|workout|calendar|print|race',
    scenarioGoal: 'goal',
    scenarioBold: 'bold',
    scenarioSafe: 'safe',
    provenanceWithPrediction: (method: string, generatedAt: string) =>
      `Range from the prediction (${method}, W-1) based on the results in trainctl.yaml; even pacing ` +
      `is an assumption of this sheet (eng., W-10). Generated ${generatedAt}.`,
    provenanceGoalOnly: (generatedAt: string) =>
      'Target time from trainctl.yaml only — no prediction from a race result (add one to ' +
      `athlete.results). Even pacing is an assumption of this sheet (eng.). Generated ${generatedAt}.`,
    splitsAndBand: (scenarios: string) => `splits + pace band (${scenarios})`,
    /** Człon nazwy pliku — przechodzi przez `safeName`, więc bez znaków spoza ASCII. */
    fileRacePack: 'race-pack',
    filePrintout: 'schedule',
    calendarEntries: (count: number) => `${count} sessions in the calendar`,
    printedWeeks: (weeks: number) => `${weeks} weeks to print`,
    heat: {
      columns: { temperature: 'temperature', pace: 'pace', loss: 'loss' },
      scenarioColumn: (label: string) => `scenario “${label}”`,
      lossValue: (secPerKm: number) => `+${n(secPerKm)} s/km`,
      note: (scenarioLabel: string, curveLabel: string, tOptC: number) =>
        `The correction applies to the “${scenarioLabel}” scenario (the one on the band) — the other ` +
        'columns of the splits table assume optimal conditions. Model: El Helou 2012 ' +
        `(n=1.79 M marathon finishers), curve “${curveLabel}”, optimum ${n(tOptC)} °C. This shifts the ` +
        'POPULATION AVERAGE, it is not a forecast for you (weather explains ~10–33% of pace variance). ' +
        'Above 25 °C the model stays silent — no data. Humidity, wind and sun are deliberately left ' +
        'out: in observational data their effect turned out to be an artefact of temperature.',
    },
  },

  review: {
    title: 'Week in review',
    pastWeek: 'Behind you',
    subtitle: (from: string, today: string, goalName: string, goalDate: string) =>
      `${from} → ${today} · ${goalName} (${goalDate})`,
    refreshFailed: (error: string) =>
      `Could not refresh the data (${error}) — reviewing the last snapshot.`,
    noKey: 'No API key — reviewing from the journal and the last snapshot (trainctl pull once you have one).',
    doneSessions: 'Sessions done',
    volume: 'Volume',
    volumeValue: (actualKm: number, plannedKm: number) =>
      `${n(actualKm)} of ${n(plannedKm)} km planned`,
    signals: 'Signals',
    noSignals: 'No corrections needed — the plan matches reality.',
    seeAdapt: 'there are suggested corrections — details: trainctl adapt',
    ahead: (weekStart: string) => `Ahead of you · week of ${weekStart}`,
    todo: 'To do',
    phase: 'Phase',
    volumeAhead: (km: number, sessions: number) => `${n(km)} km across ${sessions} sessions`,
    toRace: 'To race day',
    toRaceValue: (days: number) => `${days} days`,
    raceThisWeek: (date: string) =>
      `Race this week: ${date} — the day before stays clear (T-10).`,
    timeTrialThisWeek: (date: string) =>
      `Time trial: ${date} — write the result into trainctl.yaml afterwards, or the zones stall (W-11).`,
    keySession: 'Key session',
    todoWriteResult: 'write the measured result into athlete.results → trainctl diff → trainctl plan',
    todoSeeAdapt: 'review the proposals: trainctl adapt (you approve changes in trainctl.yaml)',
    todoPush: 'send the coming week to your watch: trainctl push --days 7',
    todoPrint: 'a sheet for the fridge: trainctl export --what print',
    todoReschedule:
      'if sessions keep falling out because of work — move them (trainctl reschedule) instead of losing them',
    todoNextRace: (date: string, what: string) => `next tune-up race: ${date} (${what})`,
  },

  wizard: {
    header: 'trainctl — profile setup',
    enterSkips: 'Enter skips optional questions.',
    goal: 'Goal',
    goalName: 'Race name',
    goalDate: 'Race date',
    goalDistance: 'Distance',
    goalTarget: 'Target time',
    defaultGoalName: 'Target race',
    yourRunning: 'Your running',
    recentVolume: 'Volume over recent weeks [km]',
    peakVolume: 'All-time weekly peak [km]',
    trainingDays: 'Training days',
    resultHeader: 'Race result for zone calibration',
    resultWhy: 'We compute zones from a race result — threshold readings from a watch run too fast.',
    resultDistance: 'Distance of your last race',
    resultTime: 'Time',
    resultDate: 'Race date',
    deskHeader: 'Desk mode',
    workStart: 'Work starts',
    workEnd: 'Work ends',
    hintDate: 'YYYY-MM-DD',
    hintDistance: '5 · 10 · hm · m · km',
    hintTime: 'HH:MM:SS',
    hintOptional: 'optional',
    hintTimeOptional: 'HH:MM:SS, optional',
    hintHour: 'HH:MM',
    hintHourOptional: 'HH:MM, optional',
    hintDays: 'e.g. tue wed thu sat sun',
    yesNoHint: '(Y/n)',
    enterAccepts: (value: string) => `Enter = ${value}`,
    errTime: 'Time as MM:SS or HH:MM:SS',
    errDistance: 'Give a distance: 5, 10, hm, m or a number of kilometres',
    errUnknownDay: (day: string, allowed: string) => `Unknown day "${day}" — use: ${allowed}`,
    errNoDays: 'Give at least one day',
    errDate: 'Date as YYYY-MM-DD',
    errBadDate: 'Invalid date',
    errKm: 'Give a number of kilometres',
    errHour: 'Time as HH:MM',
    intervalsFound: 'I found an intervals.icu key — pull your history and propose a profile?',
    intervalsFetching: 'pulling the last 16 weeks…',
    intervalsProposed: 'proposals from your history — Enter accepts the value at each question',
    intervalsRange: (from: string, to: string, maxKm: number) => `${from} → ${to}, max ${n(maxKm)} km`,
    raceLooksLike: (label: string, reason: string) =>
      `This looks like a race in your history: ${label} (${reason})`,
    useThisResult: 'Use this result for calibration?',
    dayCodes: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
  },

  picker: {
    exportWhat: 'What should I export?',
    exportPrint: 'Printable schedule',
    exportPrintHint: 'HTML for A4 — Ctrl+P',
    exportRace: 'Race-day pack',
    exportRaceHint: 'splits + a pace band to cut out',
    exportPlan: 'Whole plan for the watch',
    exportPlanHint: '.fit files for every session',
    exportWorkout: 'One session for the watch',
    exportWorkoutHint: 'a single .fit',
    exportCalendar: 'Calendar',
    exportCalendarHint: '.ics for Google/Outlook',
    whichWorkout: 'Which session?',
    whichDay: 'Which day should it move to?',
    whatToMove: 'Which session should move?',
    keys: 'arrows/digits · Enter confirms · q cancels',
    weekKeys: '←/→ weeks · t today · s move a session · q quit',
    selectKeys: '  ↑↓ pick · 1–9 jump · Enter confirms · Esc cancels',
    raceLocked: 'RACE — cannot be moved',
    noWeekForToday: 'I found no week covering today’s date.',
    previewClosed: 'preview closed',
    shiftNeedsTerminal:
      'Interactive mode needs a terminal. Give the dates directly:\n' +
      '  trainctl shift --from 2026-08-04 --to 2026-08-05',
  },

  print: {
    columns: { day: 'Day', date: 'Date', km: 'Km', workout: 'Session', done: '✓' },
    weekTitle: (index: number) => `Week ${index}`,
    weekMeta: (weekStart: string, phase: string, km: number) =>
      `from ${weekStart} · ${phase} · ${n(km)} km`,
    deload: 'deload',
    subtitle: (weeks: number, peakKm: number, vdot: number, generatedAt: string) =>
      `${weeks}-week plan · peak ${n(peakKm)} km/week · VDOT ${n(vdot)} · generated ${generatedAt}`,
    footer: 'Generated by trainctl. Session rationale: trainctl why --date <date>.',
    strengthTag: (minutes: number) => `[+ strength ~${n(minutes)} min]`,
    rest: '—',
  },

  racePack: {
    title: (raceName: string) => `${raceName} — race-day pack`,
    subtitle: (date: string, distanceKm: number) => `${date} · ${n(distanceKm)} km`,
    splits: 'Cumulative splits',
    band: (scenario: string) => `Pace band — ${scenario}`,
    finish: 'FINISH',
    km: 'km',
    cutHint: '✂ cut along the dashed line, wrap around your wrist, tape it shut',
    conditions: 'Adjust for conditions',
  },

  calendar: {
    strengthSummary: (minutes: number) => `strength ~${n(minutes)} min`,
  },

  envFile: {
    unprotected: (envFile: string, ignoreFile: string) =>
      `${envFile} is loaded and this directory is a git repository, but no ${ignoreFile} ` +
      `appears to exclude it. Add a line "${envFile}" to ${ignoreFile} before your next ` +
      'commit — an API key that reaches git history stays there even after you delete the file.',
  },

  sync: {
    missingKey: (secretFile: string) =>
      'No intervals.icu API key. Set TRAINCTL_INTERVALS_API_KEY in the environment, ' +
      `in a .env file, or save the key in ${secretFile} — and make sure git ignores it.\n` +
      'Key: intervals.icu → Settings → Developer Settings.',
  },

  /** plan/PLAN.md — the document the athlete actually reads. */
  planMd: {
    heading: (goalName: string, date: string) => `Plan: ${goalName} — ${date}`,
    goalTime: (time: string) => ` · target ${time}`,
    meta: (generatedAt: string, vdot: number, source: string, peakKm: number) =>
      `Generated ${generatedAt} · VDOT ${n(vdot)} (${source}) · peak ${n(peakKm)} km/week.`,
    vdotFromResult: 'from a race result',
    vdotFromGoal: 'from the goal — recalibrate!',
    prediction: (distanceKm: number, lo: string, hi: string, method: string) =>
      `Predicted over ${n(distanceKm)} km: **${lo}–${hi}** (method: ${method}; W-1: always a range).`,
    weekHeading: (index: number, weekStart: string, label: string) =>
      `Week ${index} — from ${weekStart} (${label})`,
    columns: { day: 'Day', date: 'Date', workout: 'Session' },
    strengthTag: (minutes: number) => ` **+ STRENGTH** ~${n(minutes)} min`,
    deload: 'deload',
    rest: '—',
    changes: 'Changes',
    changeLine: (at: string, action: string, detail: string) => `${at}: ${action} — ${detail}`,
    noCalibration:
      'No race result from the last 18 months and no goal.targetTimeSec — ' +
      'there is nothing to calibrate the zones from (Z-6: we calibrate from results, not from a watch).',
    zonesFromGoal:
      'zones calibrated from the time goal rather than a real result — add a race to athlete.results',
  },

  /** trainctl.yaml — template and validation. Paths stay as they are; only the wording is translated. */
  configFile: {
    templateHeader: [
      '# trainctl — athlete profile and training goal.',
      '# Fill this in and run: trainctl plan',
    ],
    templateLanguage: 'interface and plan language: en | pl (default: en)',
    templateAthlete: {
      sex: 'male | female | unspecified',
      recentWeeklyKm: 'average of the last ~4 weeks',
      peakWeeklyKm: 'highest volume you have held (optional)',
      results: 'race results for zone calibration (Z-6: not from a watch!)',
      exampleResultName: 'example 10 km',
      tuneUpRaces: 'tune-up races on the way (B = mini-taper, C = run through)',
      tuneUpExampleName: 'Autumn 10K',
    },
    templateGoal: {
      name: 'Half marathon',
      targetTime: 'optional time goal — trainctl plan will judge how realistic it is',
    },
    templateDesk: 'desk mode (trainctl desk) — optional',
    templateDeskPrefer: 'morning | lunch | evening',
    templateStrength: {
      section: 'strength 2×/week alongside running (opt-in; needs access to weights)',
      enabled: 'the point is running economy (F-8) — NOT "injury protection" (F-9)',
      days: 'optional: preferred days',
    },
    inferredHeader: (from: string, to: string) => [
      '# trainctl — athlete profile and training goal.',
      `# Profile proposed from your intervals.icu history (full weeks ${from} → ${to}).`,
      '# These are proposals — correct anything that does not match reality.',
    ],
    inferredPeak: 'highest full week in the window',
    inferredDays: 'days holding ≥10% of the window’s runs',
    inferredLongRun: 'dominant day of your longest runs',
    inferredResults: 'add a race result once you have confirmed the candidates printed by the command',
    inferredResultsWhy: '(zones come from race results, not from watch readings — Z-6)',
    inferredGoal: 'FILL THIS IN — without a goal `trainctl plan` refuses (by design)',
    inferredGoalName: 'Target race',
    inferredGoalDate: 'race date',
    inferredResultHint: 'add a race result — that is what calibrates the zones (not the watch)',
    generatedByWizard: '# Written by `trainctl init`. Edit freely, then run `trainctl plan`.',
    validate: {
      missingSection: (path: string) => `${path}: section missing`,
      numberGtZero: (path: string) => `${path}: a number > 0 is required`,
      nonEmptyDays: (path: string) => `${path}: a non-empty list of days is required`,
      unknownDay: (path: string, day: string) => `${path}: unknown day "${day}"`,
      listOptional: (path: string) => `${path}: a list is required (may be empty)`,
      listRequired: (path: string) => `${path}: a list is required`,
      isoDate: (path: string) => `${path}: format YYYY-MM-DD`,
      seconds: (path: string) => `${path}: a number of seconds > 0`,
      priorityBc: (path: string) => `${path}: B or C (A is the goal in the goal section)`,
      required: (path: string) => `${path}: required`,
      boolean: (path: string) => `${path}: true or false`,
      hourFormat: (path: string) => `${path}: format HH:MM`,
    },
  },

  /** Explanations of the rules from docs/science/FOUNDATIONS.md §10, in plain language. */
  rules: {
    'I-1': 'base/build: a pyramidal distribution — plenty of easy running, accents around threshold (Casado 2022; Knopp 2024)',
    'I-2': 'pre-competition: switch to polarized — the pyramid→polarized sequence won the RCT (Filipas 2022)',
    'I-5': '≥75% of weekly volume in the easy zone, whatever the model (Haugen 2022; Knopp 2024)',
    'I-7': '≥48 h between quality sessions — the hard day / easy day principle (Casado 2022)',
    'I-8': 'two accents a week at ≥4 sessions, one at 3 (Casado 2022)',
    'P-1': 'load undulates rather than climbing in a line — undulating progression gave +22% VO₂max vs +11% linear (RCT Costa 2019)',
    'P-2': 'every fourth week is a deload (Costa 2019)',
    'P-3': 'volume growth ≤10%/week as a planning tool — this is NOT an injury threshold (Damsted 2018)',
    'P-7': 'half marathon: >32 km/week and long runs >21 km go with a better result (Fokkema 2020)',
    'P-8': 'marathon: >65 km/week goes with a result ~14 min better (Fokkema 2020)',
    'T-1': 'taper: intensity STAYS — holding it has an independent effect (Wang 2023, SMD −0.55)',
    'T-2': 'taper: the number of sessions STAYS (Wang 2023, SMD −0.53)',
    'T-3': 'taper: volume alone comes down, by 41–60% (Wang 2023)',
    'T-4': 'a strictly decreasing taper week over week — "strict" gave a median of −5:32 over the marathon (Smyth 2021, n=158,117)',
    'T-5': 'taper length follows the distance: 5–10 km ~a week, HM ~2 weeks, marathon 2–3 weeks (Wang 2023; Knopp 2024)',
    'T-9': 'B-priority race: a mini-taper (weekly volume −20%), macrocycle unchanged — one race does not undo the progression',
    'T-10': 'the day before a race is off — that is what the coach did in 34 of 45 races in the corpus',
    'T-11': 'the long run STAYS the day after a race, easy — the corpus pattern (Saturday race → Sunday long)',
    'T-12': 'a race IS the accent of its week, not an addition to it — we do not add a second quality session',
    'W-11': 'zones come from an all-out run: a time trial is equivalent to a race here (Daniels & Gilbert)',
    'W-12': 'recalibrate roughly every 4 weeks — the median gap between races in the coaching corpus',
    'W-13': 'a real race beats a manufactured time trial; the trial appears only when the race calendar is empty',
    'F-1': 'strength 2–3×/week as the base dose (Blagrove 2018 — a description of study practice, not a dose-response)',
    'F-2': 'aim for ≥24 strength sessions across the block — below that the effect is non-significant (Berryman 2018, SMD 0.63 vs 0.10)',
    'F-3': 'a strength block runs 10–14 weeks; 6–8 weeks is not enough (Eihara 2022)',
    'F-4': 'heavy: ≥80% 1RM, compound, free weights — the heavier the lift, the larger the effect on economy (Llanos-Lagos 2024)',
    'F-13': 'taper: strength leaves the plan — 4 weeks of detraining does not undo the adaptation (Berryman 2020, note: n=8)',
    'S-4': 'strength and running the same day: the ≥3 h gap is documented (Schumann 2022); 6 h is an engineering margin',
    'S-5': 'heavy strength no later than 24 h before a quality session — the strength deficit lasts up to 48 h (de Carvalho e Silva 2022)',
  },

  /** What each session kind is for — the physiological purpose, one sentence. */
  kindPurpose: {
    easy: 'Aerobic volume in the easy zone — the foundation of adaptation, at no recovery cost.',
    long: 'Long run: base endurance, running economy and resistance to fatigue (durability).',
    easy_hills:
      'Easy running plus hills: specific strength and economy at minimal cost (the coach’s house style).',
    quality_intervals:
      'Interval session — the stimulus follows the phase: around threshold (pyramidal) or VO₂max (polarized).',
    quality_continuous:
      'Continuous accent — a progression run or alternating pace; pace control and work around threshold.',
    sharpener:
      'A short pre-race accent: it holds intensity through the taper (T-1) without a volume cost.',
    test:
      'Time trial — a measurement, not a workout: the result recomputes your zones for the coming weeks (W-11). ' +
      'It appears because the calendar holds no race that would do the same job better (W-13).',
    race: 'Race — the goal of this cycle.',
  },

  /** MCP tool descriptions — the agent’s interface to the engine. */
  mcp: {
    dirLine: (dir: string, locale: string) => `training directory: ${dir} · language: ${locale}`,
    isoDate: 'date in YYYY-MM-DD format',
    init:
      'Create a trainctl.yaml template (athlete profile and goal) in the training directory. ' +
      'Never overwrites an existing file. With fromIntervals=true it proposes a profile from ' +
      '16 weeks of intervals.icu history (needs an API key): every value carries a provenance ' +
      'comment, and race candidates come back FOR CONFIRMATION with the user — add them to ' +
      'athlete.results only once they agree.',
    initFromIntervals: 'profile from intervals.icu history',
    plan:
      'Generate the training plan from trainctl.yaml → plan/plan.yaml + plan/PLAN.md. ' +
      'Returns a summary: volume peak, predicted finish (a range) and how realistic the goal is. ' +
      'OVERWRITES an existing plan — when in doubt run trainctl_diff first.',
    planDate: '“today” (defaults to the current date)',
    today: 'The session for today (or a given date): description, distance, status from the journal.',
    week:
      'The whole training week (phase, target km, day by day, statuses from the journal). ' +
      'Use it BEFORE renegotiating the week (trainctl_shift) so you can see the context.',
    weekDate: 'any date inside the week you care about',
    log: 'Record a completed session in the journal (log.jsonl).',
    logStatus: 'defaults to done',
    logKm: 'kilometres covered',
    logTime: 'time as MM:SS or HH:MM:SS',
    logNote: 'how it felt, conditions, remarks',
    shift:
      'Week renegotiation: swap the sessions of two dates within THE SAME week ' +
      '(e.g. “release on Thursday — move the intervals”). Protects race day and the day before it; ' +
      'warns when the 48 h rule between accents (I-7) would break.',
    shiftFrom: 'date of the session to move',
    shiftTo: 'target date (the two sessions are swapped)',
    why:
      'Explain a session: its physiological purpose plus the rules behind it ' +
      '(IDs from docs/science/FOUNDATIONS.md).',
    adapt:
      'Compare execution (sync.json + journal) with the plan and propose corrections: a realistic ' +
      'volume, a restart after a break, a post-race protocol, zone recalibration. ' +
      'RETURNS PROPOSALS — it does not change the plan. To apply: edit trainctl.yaml + trainctl_plan.',
    adaptDate: 'reference date (defaults to today)',
    desk:
      'Desk day: training windows around working hours, sitting breaks, and the rule for running ' +
      'after demanding mental work (then go by pace, not by feel). Set heavy=true when the day was ' +
      'cognitively heavy (long sessions with agents). Needs a desk section in trainctl.yaml.',
    deskHeavy: 'a cognitively heavy day',
    export:
      'Write the plan to a file: `plan` = the whole plan as .fit workouts for the watch, ' +
      '`workout` = a single .fit session (needs date), `calendar` = .ics for Google/Outlook, ' +
      '`print` = an HTML sheet laid out for A4, `race` = the race-day pack (splits + a paper pace ' +
      'band; needs a time goal or a prediction). Files land in the export/ directory. ' +
      'When the user wants a session “on the watch” without a cable — consider trainctl_push first.',
    exportDate: 'session to export when what=workout',
    reschedule:
      'Rearrange THE WHOLE week around days the user cannot train on (“release on Thursday”, ' +
      '“away Tue–Wed”). The solver keeps ≥48 h between accents, protects the long run and the ' +
      'accent count, and when days run out it says which session it sacrifices and why. ' +
      'Preview only by default; apply=true saves the plan. To move a single session use trainctl_shift.',
    rescheduleBlock: 'days with no possibility of training',
    rescheduleDate: 'a date identifying the week (defaults to the current one)',
    rescheduleApply: 'true = save the changes to the plan',
    push:
      'Push planned sessions to intervals.icu — they reach the watch (Garmin/Coros/Wahoo) as ' +
      'structured workouts with pace targets. Needs an API key (env TRAINCTL_INTERVALS_API_KEY or ' +
      'a .trainctl-secret file). Pushing again overwrites the same days (upsert).',
    pushFrom: 'range start (defaults to today)',
    pushTo: 'range end',
    pushDays: 'how many days ahead, default 14',
    pull:
      'Fetch completed activities and wellness data from intervals.icu, save a snapshot (sync.json) ' +
      'and compare execution with the plan (mismatches: shorter/longer/not done/unplanned).',
    pullDays: 'how many days back, default 28',
    review:
      'The whole weekly review in one call: the days behind vs the plan, signals worth acting on, ' +
      'the week ahead (phase, volume, key session, races/time trials) and a list of concrete ' +
      'actions. Use THIS instead of calling trainctl_pull + trainctl_adapt + trainctl_week in sequence — ' +
      'e.g. when the user asks “how did I do?” or starts a new week. Works without an API key too ' +
      '(then from the journal and the last snapshot). Changes nothing in the plan.',
    reviewDays: 'how many days back to summarise, default 7',
    reviewDate: 'reference date (defaults to today)',
    diff:
      'Dry run: what regenerating the plan from the current trainctl.yaml would change (new results, ' +
      'a changed profile). Saves nothing.',
    check:
      'Lint the plan file against the engine invariants: ≥48 h between accents (I-7), the day before ' +
      'a race stays free (T-10), taper shape (T-4/T-5, F-13), strength adjacency (S-5), ≥75% easy ' +
      'volume (I-5) and file-internal consistency (sums, dates, the goal race present). ERRORS mean ' +
      'plan/plan.yaml is internally inconsistent (usually a manual edit); WARNINGS mean a rule ' +
      'deviation someone may have chosen. Run it after hand-editing the plan file. Changes nothing.',
    checkStrict: 'true = warnings also count as failures',
  },

  /** AGENTS.md — the coach persona dropped into the training directory by `trainctl init`. */
  agentsMd: (): string => `# Coach — instructions for the agent

This directory is a training plan as code. You have the \`trainctl_*\` MCP tools
(or the \`trainctl\` CLI) and you act as a coach, not just a command runner.

## Rituals

- **Start of the week** → \`trainctl_review\`. One call instead of pull + adapt +
  week. Relay the result in plain language and propose at most two things to do.
- **Before any change to the week** → \`trainctl_week\` first, to see the context.
  “Move the intervals” without looking at the week is guesswork.
- **After a race or a time trial** → ask for the time and propose an entry in
  \`athlete.results\`. A measurement with no result written down changes nothing —
  the zones still come from the older run.

## Rules

1. **Do not regenerate the plan without asking.** \`trainctl_plan\` overwrites the
   existing plan. When in doubt: \`trainctl_diff\` (shows the differences, saves nothing).
2. **Adaptation proposes, it does not rewrite.** \`trainctl_adapt\` returns proposals;
   applying them is a deliberate edit of \`trainctl.yaml\` → \`trainctl_diff\` → \`trainctl_plan\`.
3. **Ask for context before you start computing.** A missed week means one thing
   after illness and another after a crunch at work — the first needs a careful
   return, the second usually just a reshuffle of days.
4. **Race day does not move.** \`trainctl_shift\` will refuse; do not work around it
   by regenerating the plan with a different date.
5. **Do not invent numbers.** Paces, volumes and rules come from the engine; if
   something is not in a tool’s output, say “I don’t know” rather than estimate.
6. **Cite reasons, not just commands.** \`trainctl_why\` gives the purpose of a session
   and the rules behind it (IDs from \`docs/science/FOUNDATIONS.md\`) — that is the
   value a coach adds over a list of workouts.

## What not to do

- Do not give medical advice (pain, injury, illness → a doctor, not an agent).
- Do not “make up” missed kilometres on the following days — it works against
  the progression.
- Do not judge fitness from watch heart rate or HRV; calibration comes from race
  and time-trial results.

## Files

| file | what it is |
|---|---|
| \`trainctl.yaml\` | profile, goal, tune-up races — the **only** file you edit by hand |
| \`plan/plan.yaml\` | the generated plan (source of truth for the commands) |
| \`plan/PLAN.md\` | the same plan, for reading |
| \`log.jsonl\` | the execution journal |
| \`sync.json\` | snapshot of intervals.icu data |

Git is the change history — commit after every change to the plan, so it is
visible what changed and why.
`,
}

export type CliMessages = typeof cliEn
