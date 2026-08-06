/**
 * Angielski katalog tekstów interfejsu — ŹRÓDŁO TYPU dla `cli-pl.ts`.
 * Teksty domenowe (opisy jednostek, diagnozy) mieszkają w `@tren/core`;
 * tutaj jest wyłącznie to, co należy do warstwy CLI/MCP: nazwy komend,
 * nagłówki, podpowiedzi, komunikaty błędów i opisy narzędzi agenta.
 */
import { formatNumber } from '@tren/core'

const n = (value: number) => formatNumber('en', value)

export const cliEn = {
  common: {
    nextStep: (command: string) => `next step: ${command}`,
    saved: (what: string) => `Saved ${what}`,
    outsidePlan: (date: string, from: string, to: string) =>
      `${date}: outside the plan range (${from} → ${to}).`,
    noPlan: 'No plan yet — run: tren plan',
    missingConfig: (file: string) => `No ${file} — run: tren init`,
    configErrors: (file: string, errors: string) => `Errors in ${file}:\n  - ${errors}`,
    cancelled: 'cancelled',
    interrupted: 'interrupted',
    needsTerminal: (command: string) =>
      `Interactive mode needs a terminal (use: ${command}).`,
  },

  init: {
    created: (file: string) => `Created ${file}`,
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
    fillGoal: 'fill in the goal section in tren.yaml → tren plan',
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
    whyHint: (date: string) => `why this session: tren why --date ${date}`,
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
    weekHint: (date: string) => `see the week: tren week --date ${date}`,
    bothDates: 'Give both dates (--from and --to) or neither — then you pick from a list.',
    sameWeekOnly: 'shift works within a single week (full renegotiation — tren reschedule)',
    notRaceDay: 'The race day stays put.',
    dayBeforeRaceLight: 'The day before the race stays easy — no accent goes there.',
    outsidePlan: (date: string) => `Date ${date} is outside the plan`,
    accentsTooClose: (a: string, b: string) =>
      `accents on ${a} and ${b} are back to back — rule I-7 asks for ≥48 h between quality sessions`,
    strengthSameDay: (date: string) =>
      `${date}: an accent landed on a strength day — S-5 advises against heavy lifting alongside ` +
      'a quality session; move the gym or regenerate the plan (tren plan)',
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
    adaptHint: 'suggested corrections: tren adapt',
    noPlanSkipped: 'No plan — comparison skipped.',
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
    noSnapshot: 'No sync.json — analysis from the journal only. Full data: tren pull',
    diagnosis: 'Diagnosis',
    proposals: 'Proposals',
    applyHint: (weeklyKm: number) =>
      `To apply: athlete.recentWeeklyKm: ${weeklyKm} in tren.yaml → tren diff → tren plan. ` +
      'The engine never rewrites the plan on its own.',
  },

  desk: {
    title: (date: string) => `Desk day · ${date}`,
    subtitle: (from: string, to: string) => `work ${from}–${to}`,
    heavyDay: 'heavy cognitive day',
    missingSection:
      'No desk section in tren.yaml. Add for example:\n' +
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
    previewHint: 'this is a preview; apply with: tren reschedule --apply (same --block)',
    none: '—',
  },

  diff: {
    title: 'Differences: saved plan → plan from current tren.yaml',
    upToDate: 'Plan is current — no differences against a regeneration from tren.yaml.',
    manualShifts: 'the plan contains manual shifts — they will show up as differences',
    weekGone: (weekStart: string) => `- week ${weekStart}: disappears from the plan`,
    weekVolume: (weekStart: string, before: number, after: number) =>
      `~ week ${weekStart}: volume ${n(before)} → ${n(after)} km`,
    dayChanged: (date: string, before: string, after: string) => `~ ${date}: ${before} → ${after}`,
    weekNew: (weekStart: string, km: number) => `+ week ${weekStart}: new (${n(km)} km)`,
    applyHint: 'to apply: tren plan (overwrites plan/ — you have it in git)',
    localeChanged: (planLocale: string, current: string) =>
      `the plan was generated in "${planLocale}", you are running in "${current}" — ` +
      'run tren plan to regenerate the descriptions',
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
      'in Garmin Connect. Cable-free alternative: tren push.',
    needDate: 'Give the session date (--date).',
    raceDayNotWorkout: 'That is race day — we do not export it as a workout.',
    restDayNothing: (date: string) => `${date} is a rest day — there is nothing to export.`,
    noWorkouts: 'The plan contains no sessions to export.',
    needTargetOrPrediction:
      'The race pack needs a target time (goal.targetTimeSec) or a prediction ' +
      '(a race result in athlete.results) — there is nothing to compute splits from.',
    pickWhat: 'Give the export kind: tren export --what plan|workout|calendar|print|race',
    scenarioGoal: 'goal',
    scenarioBold: 'bold',
    scenarioSafe: 'safe',
    provenanceWithPrediction: (method: string, generatedAt: string) =>
      `Range from the prediction (${method}, W-1) based on the results in tren.yaml; even pacing ` +
      `is an assumption of this sheet (eng., W-10). Generated ${generatedAt}.`,
    provenanceGoalOnly: (generatedAt: string) =>
      'Target time from tren.yaml only — no prediction from a race result (add one to ' +
      `athlete.results). Even pacing is an assumption of this sheet (eng.). Generated ${generatedAt}.`,
    splitsAndBand: (scenarios: string) => `splits + pace band (${scenarios})`,
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
    subtitle: (from: string, today: string, goalName: string, goalDate: string) =>
      `${from} → ${today} · ${goalName} (${goalDate})`,
    refreshFailed: (error: string) =>
      `Could not refresh the data (${error}) — reviewing the last snapshot.`,
    noKey: 'No API key — reviewing from the journal and the last snapshot (tren pull once you have one).',
    doneSessions: 'Sessions done',
    volume: 'Volume',
    volumeValue: (actualKm: number, plannedKm: number) =>
      `${n(actualKm)} of ${n(plannedKm)} km planned`,
    signals: 'Signals',
    noSignals: 'No corrections needed — the plan matches reality.',
    seeAdapt: 'there are suggested corrections — details: tren adapt',
    ahead: (weekStart: string) => `Ahead of you · week of ${weekStart}`,
    todo: 'To do',
  },

  wizard: {
    header: 'tren — profile setup',
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
  },

  print: {
    columns: { day: 'Day', date: 'Date', km: 'Km', workout: 'Session', done: '✓' },
    weekTitle: (index: number) => `Week ${index}`,
    weekMeta: (weekStart: string, phase: string, km: number) =>
      `from ${weekStart} · ${phase} · ${n(km)} km`,
    deload: 'deload',
    subtitle: (weeks: number, peakKm: number, vdot: number, generatedAt: string) =>
      `${weeks}-week plan · peak ${n(peakKm)} km/week · VDOT ${n(vdot)} · generated ${generatedAt}`,
    footer: 'Generated by tren. Session rationale: tren why --date <date>.',
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

  sync: {
    missingKey: (secretFile: string) =>
      'No intervals.icu API key. Set the TREN_INTERVALS_API_KEY environment variable ' +
      `or save the key in ${secretFile} (add it to .gitignore!).\n` +
      'Key: intervals.icu → Settings → Developer Settings.',
  },
}

export type CliMessages = typeof cliEn
