/**
 * Angielski katalog tekstów interfejsu — ŹRÓDŁO TYPU dla `cli-pl.ts`.
 * Teksty domenowe (opisy jednostek, diagnozy) mieszkają w `trainctl-core`;
 * tutaj jest wyłącznie to, co należy do warstwy CLI/MCP: nazwy komend,
 * nagłówki, podpowiedzi, komunikaty błędów i opisy narzędzi agenta.
 */
import { formatNumber, pluralEn } from 'trainctl-core'
import { improveEn } from './improve-en.ts'
import { coachEn } from './coach-en.ts'

const n = (value: number) => formatNumber('en', value)

export const cliEn = {
  coach: coachEn,
  improve: improveEn,
  /** Opisy komend i flag — to, co widać w `trainctl --help`. */
  cmd: {
    banner: 'plan as code, coach as your agent’s tool',
    lang: 'interface language: en | pl (or TRAINCTL_LANG / language in trainctl.yaml)',
    version: 'print the installed version',
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
    optDiffPlan: 'compare with another plan file instead (a scenario branch or worktree)',
    optAgent: 'also write agent integration files: claude | codex | all',
    rules: 'the engine rules by ID, with their source class; one rule in full',
    optFresh: 'regenerate from scratch: discard kept past days, approvals, pins and budgets (they stay in git)',
    optDate: 'date (defaults to today)',
    optDateOther: 'a date other than today',
    optDateWeek: 'any date inside the week you care about',
    optStatus: 'done|skipped|modified',
    optKm: 'kilometres covered',
    optTime: 'time as MM:SS or HH:MM:SS',
    optRpe: 'session effort as a whole number 1–10 (CR-10)',
    optStrength: 'log a strength session instead of a run: done | skipped',
    optMinutes: 'minutes of the strength session',
    optNote: 'note (how it felt, conditions)',
    optFrom: 'source date',
    optTo: 'target date',
    optFromRange: 'range start (defaults to today)',
    optToRange: 'range end',
    optDaysAhead: 'how many days ahead (default 14)',
    optDaysBack: 'how many days back (default 28)',
    optPullFrom: 'read exported FIT/TCX/GPX files from this folder (or file) instead of intervals.icu',
    optReviewDays: 'how many days back to review (default 7)',
    optHeavy: 'today was cognitively heavy (long sessions with agents)',
    optBlock: 'days you cannot train on',
    optWhichWeek: 'which week (defaults to the current one)',
    optApply: 'save the changes (without it, preview only)',
    optExportWhat: 'plan | workout | calendar | print | race | mobile',
    optExportDate: 'session to export (for --what workout)',
    firstSteps: 'First steps: ',
    interactively: 'Interactive: ',
    pickFromList: ' (pick from a list) · ',
    browseArrows: ' (browse with arrows)',
    colorsHint: 'Colours: NO_COLOR=1 disables them, TRAINCTL_ASCII=1 forces ASCII glyphs.',
    datesHint:
      'Dates: YYYY-MM-DD, today/tomorrow/yesterday, +N/-N days, or a weekday (mon…sun). ' +
      'log, review, adapt and pull look back; the other commands look ahead.',
    dirHint: 'Directory: -C <path> or TRAINCTL_DIR; TRAINCTL_TODAY=YYYY-MM-DD simulates the date (always announced).',
    optJson: 'print JSON ({ code, data, output }) instead of formatted text',
    optDir: 'training directory (defaults to TRAINCTL_DIR, then the current directory)',
    optCommit: 'commit the files this command changed (optionally with your own message)',
    status: 'state of the training directory: profile, plan, data, proposals, git',
    completion: 'print a shell completion script: bash | zsh | fish | pwsh',
    completionShell: (shells: string) => `Unknown shell — use one of: ${shells}`,
    dirMissing: (dir: string) => `Directory ${dir} does not exist.`,
    examples: 'Examples:',
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
    planMalformed: (file: string) =>
      `${file} is not a usable plan (no goal/weeks) — run trainctl check to see what is broken, ` +
      'or trainctl plan to regenerate it',
    missingConfig: (file: string) => `No ${file} — run: trainctl init`,
    planFromOldEngine: (current: string) =>
      `This plan predates engine 0.2.0; running ${current}. trainctl diff shows what a regeneration would change.`,
    planFromOtherEngine: (planVersion: string, current: string) =>
      `This plan was generated by engine ${planVersion}; running ${current}. Before 1.0 a regeneration ` +
      'may produce different weeks — trainctl diff shows the differences.',
    planSchemaNewer: (file: string, version: number) =>
      `${file} uses plan schema ${version}, newer than this trainctl understands (1) — upgrade trainctl.`,
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
    gitignoreHeader: 'trainctl — secrets and GPS tracks, never commit these',
    gitignoreUpdated: (patterns: string) =>
      `Added to .gitignore: ${patterns} — the intervals.icu key and exported GPS tracks stay out of git`,
    unnamed: 'unnamed',
    agentUnknown: (agent: string, allowed: string) => `Unknown agent "${agent}" — use one of: ${allowed}.`,
    agentHint: 'using Claude Code or Codex? trainctl init --agent claude|codex adds the integration files',
    agentCreated: (file: string) => `Created ${file} — agent integration for this directory`,
    agentExists: (file: string) => `${file} already exists — not changed. Merge this into it:`,
    agentClaudeNext:
      'Claude Code: trust this folder, then run /plugin install trainctl@trainctl once ' +
      '(the plugin brings the MCP tools, the coach skills and a check after plan edits).',
    agentCodexNext: 'Codex: trust this project; it reads AGENTS.md and starts the trainctl MCP server from .codex/config.toml.',
    agentQuestion: 'Which agent do you use here?',
    agentNone: 'none / later',
    gitignoreNotCommitted: '.gitignore had uncommitted changes of yours, so it was left out of the commit — review and commit it yourself.',
  },

  plan: {
    weeksOfPlan: (weeks: number) => `${weeks} weeks of plan`,
    baseUntil: (date: string) => `base training until ${date}`,
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
    regenSection: 'What the regeneration changes',
    sameCycle: (start: string) =>
      `Same training cycle: phases stay anchored to ${start}; future days follow trainctl.yaml.`,
    newCycleVolume: (km: number) =>
      `The new cycle starts from ${n(km)} km/week (athlete.recentWeeklyKm, or the approved baseline) — update the profile if your training changed.`,
    newCycle: (weekStart: string) =>
      `New training cycle from ${weekStart} (different goal distance, or the previous race is behind you); ` +
      'earlier weeks stay as history.',
    changedDays: 'Days changed',
    keptDays: 'Days kept as they were',
    reasons: {
      past: 'past',
      recorded: 'logged',
      pinned: 'pinned',
      approved: 'approved time exception',
      edited: 'manual edit',
      budget: 'over its time budget',
    },
    loadKept: (km: number, date: string) =>
      `Kept the approved baseline of ${n(km)} km/week from ${date} (adapt). ` +
      'Changing athlete.recentWeeklyKm in trainctl.yaml overrides it.',
    loadCleared: (km: number) =>
      `athlete.recentWeeklyKm changed since the approved baseline of ${n(km)} km/week — the profile wins.`,
    droppedWeeks: (weeks: string) => `Weeks no longer in the plan: ${weeks} (the previous version is in git).`,
    moreLines: (count: number) => `… and ${count} more — trainctl diff lists every difference.`,
    upToDate: 'Plan is current — trainctl.yaml produces the same future days; nothing written.',
    unreadable: (file: string, reason: string) =>
      `${file} cannot be used (${reason}) — fix it (a merge conflict?) or run trainctl plan --fresh to start over; the previous version is in git.`,
    unreadableReason: { parse: 'not valid YAML', shape: 'no goal or weeks' },
    overwroteUnreadable: (file: string) => `The previous ${file} could not be used and was replaced — it is in git if you need it.`,
    freshDropped: (items: string) => `Regenerated from scratch (--fresh), discarding: ${items}. The previous plan is in git.`,
    freshItems: {
      loadState: (km: number) => `the approved baseline (${n(km)} km/week)`,
      pinned: (count: number) => `${count} pinned ${pluralEn(count, { one: 'day', other: 'days' })}`,
      budgets: (count: number) => `${count} time ${pluralEn(count, { one: 'budget', other: 'budgets' })}`,
      approved: (count: number) => `${count} approved time ${pluralEn(count, { one: 'exception', other: 'exceptions' })}`,
      edited: (count: number) => `${count} manually edited ${pluralEn(count, { one: 'day', other: 'days' })}`,
      history: (count: number) => `${count} change-log ${pluralEn(count, { one: 'entry', other: 'entries' })}`,
    },
  },

  today: {
    daysToRace: (days: number) => `${days} days to race`,
    daysAfterRace: (days: number) => `${days} ${pluralEn(days, { one: 'day', other: 'days' })} after the race`,
    weekOf: (index: number, total: number) => `week ${index}/${total}`,
    deload: 'deload',
    restDayTitle: 'Rest day',
    restDayBody: 'Rest is part of the plan — adaptation happens in recovery.',
    logged: (status: string) => `Logged: ${status}`,
    whyHint: (date: string) => `why this session: trainctl why --date ${date}`,
    strengthLogged: (status: string) => `Strength logged: ${status}`,
    estimate: (minutes: number) => `about ${minutes} min including preparation`,
    next: (date: string, weekday: string, kind: string, km: number) => `next: ${weekday} ${date} · ${kind} · ${n(km)} km`,
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
    badRpe: (rpe: string) =>
      `RPE "${rpe}" is off the scale — use a whole number 1–10 (10 = maximal effort).`,
    saved: (date: string, status: string) => `Logged ${date}: ${status}.`,
    planned: 'Planned',
    recorded: 'Recorded',
    testTime: (time: string) => `test segment ${time}`,
    unplanned: 'The plan had a rest day here — the entry counts as an unplanned run.',
    strengthSaved: (date: string, status: string) => `Logged strength ${date}: ${status}.`,
    strengthStatus: (value: string) => `Strength status "${value}" — use done or skipped.`,
    strengthOnly: 'A strength entry takes only --minutes and --note; log the run separately.',
    strengthMinutes: 'Strength minutes: a whole number 1–300.',
    strengthUnplanned: 'No strength was planned on this day — the entry is kept as an extra session.',
    prompt: {
      which: 'Which session?',
      status: 'Status',
      statusHint: 'done / skipped / modified',
      km: 'Kilometres',
      time: 'Time',
      timeHint: 'MM:SS or H:MM:SS, Enter skips',
      testTime: 'Time of the measured segment only',
      rpe: 'Effort 1–10 (RPE)',
      rpeHint: 'Enter skips',
      note: 'Note',
      noteHint: 'how it went, conditions — Enter skips',
      badStatus: 'Use done, skipped or modified (d / s / m).',
      logged: 'logged',
    },
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
    ruleLine: (id: string, text: string | undefined, origin: string) =>
      text ? `${id} — ${text} · ${origin}` : `${id} · ${origin}`,
    strengthPurposeTitle: 'What strength is for',
    strengthPurpose:
      'The point is running economy — a lower oxygen cost at the same speed (F-8, and the effect ' +
      'is small: ~2–8% in studies of 10+ weeks). It is NOT "injury protection" — the only ' +
      'meta-analysis on runners came out non-significant (F-9). Honestly: for runners aged 34–45 ' +
      'the effect on economy is also non-significant (F-15), and the evidence for performance ' +
      'stops at 1.5–10 km in a laboratory (F-17). Strength disappears from the plan in the taper (F-13).',
    sourcesHint: (url: string, section: string) => `sources and parameters: ${url} ${section}`,
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
    filesLabel: (path: string) => `activity files (${path})`,
    filesMissing: (path: string) => `No activity export at ${path} — point --from (or sync.files in trainctl.yaml) at a folder of FIT, TCX or GPX files.`,
    filesSkipped: (count: number, sample: string) =>
      `${count} ${pluralEn(count, { one: 'file was', other: 'files were' })} skipped (duplicate, not an activity, unreadable or unsupported): ${sample}`,
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
    unknown: 'No execution data',
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
    rulesHint: (rules: string, url: string) => `rules: ${rules} — ${url} §10.10`,
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
    manualShifts: 'the plan contains manual changes — regeneration keeps those days as they are',
    metadataOnly: 'no day changes; plan metadata would be refreshed (engine version, calibration, approved baseline)',
    weekGone: (weekStart: string) => `- week ${weekStart}: disappears from the plan`,
    weekVolume: (weekStart: string, before: number, after: number) =>
      `~ week ${weekStart}: volume ${n(before)} → ${n(after)} km`,
    weekTotalKm: (weekStart: string, before: number, after: number) =>
      `~ week ${weekStart}: total of the days ${n(before)} → ${n(after)} km`,
    dayChanged: (date: string, before: string, after: string) => `~ ${date}: ${before} → ${after}`,
    dayDistance: (date: string, kind: string, before: number, after: number) =>
      `~ ${date}: ${kind} ${n(before)} → ${n(after)} km`,
    daySegments: (date: string, kind: string) =>
      `~ ${date}: ${kind} — same volume, different segments`,
    strengthAdded: (date: string, durationMin: number) =>
      `+ ${date}: strength added (${durationMin} min)`,
    strengthGone: (date: string) => `- ${date}: strength dropped`,
    strengthDuration: (date: string, before: number, after: number) =>
      `~ ${date}: strength ${before} → ${after} min`,
    weekNew: (weekStart: string, km: number) => `+ week ${weekStart}: new (${n(km)} km)`,
    applyHint: 'to apply: trainctl plan — past, logged, pinned and approved days stay; --fresh starts over',
    localeChanged: (planLocale: string, current: string) =>
      `the plan was generated in "${planLocale}", you are running in "${current}" — ` +
      'run trainctl plan to regenerate the descriptions',
    titleFile: (path: string) => `Differences: current plan → ${path}`,
    identical: (path: string) => `The current plan and ${path} are identical.`,
    otherPlanMissing: (path: string) =>
      `No plan file at ${path} — from a branch: git show <branch>:plan/plan.yaml > scenario.yaml`,
    otherPlanInvalid: (path: string) =>
      `${path} is not a plan file (no goal/weeks) — from a branch: ` +
      'git show <branch>:plan/plan.yaml > scenario.yaml',
    goalDesc: (name: string, distanceKm: number, date: string, time: string) =>
      `${name}, ${n(distanceKm)} km, ${date}${time ? ` (${time})` : ''}`,
    goalChanged: (before: string, after: string) => `goal: ${before} → ${after}`,
    vdotChanged: (before: number, after: number) => `VDOT: ${n(before)} → ${n(after)}`,
    predictionChanged: (before: string, after: string) => `prediction: ${before} → ${after}`,
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
    weeksMissing: (file: string) =>
      `${file}: no list of weeks (weeks:) — the file is empty or truncated; regenerate: trainctl plan`,
    goalMissing: (file: string) =>
      `${file}: no goal with a date (goal.date) — fix the YAML or regenerate the plan`,
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
    noRaceInBase: 'A base plan has no race — the race pack needs a goal race (goal.kind: race).',
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
    noKey: 'No API key — reviewing from the journal and the last snapshot (trainctl pull once you have one, or trainctl pull --from <export folder>).',
    fromFiles: (label: string) => `Refreshed from ${label}.`,
    strength: 'Strength',
    strengthValue: (done: number, planned: number, skipped: number) =>
      `${done} of ${planned} planned${skipped ? `, ${skipped} skipped` : ''}`,
    feelFromHub: (date: string, rpe: number, source: string) => `${date} · RPE ${n(rpe)} · from ${source}`,
    wellness: 'From your watch (quoted, not interpreted)',
    wellnessLine: (date: string, restingHr?: number, sleepSec?: number, weightKg?: number) => {
      const parts = [
        ...(restingHr !== undefined ? [`resting HR ${n(restingHr)}`] : []),
        ...(sleepSec !== undefined ? [`sleep ${Math.floor(Math.round(sleepSec / 60) / 60)}:${String(Math.round(sleepSec / 60) % 60).padStart(2, '0')}`] : []),
        ...(weightKg !== undefined ? [`${n(weightKg)} kg`] : []),
      ]
      return parts.length ? `${date} · ${parts.join(' · ')}` : undefined
    },
    doneSessions: 'Sessions done',
    volume: 'Volume',
    volumeValue: (actualKm: number, plannedKm: number) =>
      `${n(actualKm)} of ${n(plannedKm)} km planned`,
    feel: 'How it felt',
    feelLine: (date: string, rpe: number | undefined, note: string | undefined) =>
      [date, ...(rpe !== undefined ? [`RPE ${rpe}`] : []), ...(note ? [`“${note}”`] : [])].join(
        ' · ',
      ),
    signals: 'Signals',
    noSignals: 'No corrections needed — the plan matches reality.',
    seeAdapt: 'there are suggested corrections — details: trainctl adapt',
    ahead: (weekStart: string) => `Ahead of you · week of ${weekStart}`,
    todo: 'To do',
    phase: 'Phase',
    volumeAhead: (remainingKm: number, totalKm: number, sessions: number) => {
      const across = `across ${sessions} ${pluralEn(sessions, { one: 'session', other: 'sessions' })}`
      return remainingKm === totalKm ? `${n(totalKm)} km ${across}` : `${n(remainingKm)} of ${n(totalKm)} km left ${across}`
    },
    toRace: 'To race day',
    toRaceValue: (days: number) => `${days} days`,
    baseEnd: 'Base plan until',
    raceThisWeek: (date: string) =>
      `Race this week: ${date} — the day before stays clear (T-10).`,
    timeTrialThisWeek: (date: string) =>
      `Time trial: ${date} — write the result into trainctl.yaml afterwards, or the zones stall (W-11).`,
    keySession: 'Key session',
    todoWriteResult: 'write the measured result into athlete.results → trainctl diff → trainctl plan',
    todoSeeAdapt: 'review the proposals: trainctl adapt --prepare, then approve the saved ID with --apply',
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

  clock: {
    simulated: (env: string, date: string) =>
      `simulated date ${date} (${env}) — "today", past-day protection and proposal expiry follow it`,
    badSimulatedDate: (env: string, value: string) => `${env}="${value}" is not a date — use YYYY-MM-DD or unset it.`,
  },

  rulesCmd: {
    title: 'Engine rules',
    subtitle: (count: number) => `${count} rules · ID — what it says · where it comes from`,
    unknown: (id: string, known: string) => `No rule "${id}". Known IDs: ${known}`,
  },

  dates: {
    badInput: (input: string) =>
      `"${input}" is not a date — use YYYY-MM-DD, today/tomorrow/yesterday, +N/-N or a weekday (mon…sun)`,
  },

  commit: {
    done: (sha: string, files: string) => `Committed ${sha}: ${files}`,
    noGit: 'Not a git repository — nothing committed (the change itself is saved).',
    nothing: 'Nothing to commit — the files are unchanged.',
    failed: (detail: string) => `The change is saved, but git commit failed: ${detail}`,
    init: 'trainctl init: profile and coach instructions',
    plan: (goal: string, date: string) => `trainctl plan: ${goal} (${date})`,
    log: (date: string, status: string) => `trainctl log: ${date} ${status}`,
    shift: (from: string, to: string) => `trainctl shift: ${from} ↔ ${to}`,
    reschedule: (weekStart: string) => `trainctl reschedule: week of ${weekStart}`,
    apply: (id: string) => `trainctl: apply reviewed proposal ${id}`,
  },

  status: {
    title: 'Training directory',
    profile: 'Profile',
    language: 'Language',
    ok: 'valid',
    missing: 'missing — trainctl init',
    invalid: 'has errors (below)',
    plan: 'Plan',
    goal: 'Goal',
    toRace: 'To race day',
    daysToRace: (days: number) => (days >= 0 ? `${days} ${pluralEn(days, { one: 'day', other: 'days' })}` : `${-days} ${pluralEn(-days, { one: 'day', other: 'days' })} ago`),
    weeks: 'This cycle',
    weeksSessions: (weeks: number, sessions: number) => `${weeks} ${pluralEn(weeks, { one: 'week', other: 'weeks' })}, ${sessions} ${pluralEn(sessions, { one: 'session', other: 'sessions' })}`,
    generated: 'Phases anchored to',
    engine: 'Engine',
    engineOther: (planVersion: string, current: string) => `${planVersion} (running ${current} — see trainctl diff)`,
    engineOld: (current: string) => `before 0.2.0 (running ${current})`,
    loadState: 'Approved baseline',
    loadStateValue: (km: number, date: string) => `${n(km)} km/week since ${date}`,
    noPlan: 'No plan yet.',
    calibration: 'Zone calibration',
    calibrationSelected: (date: string, km: number, ageDays: number, vdot: number) =>
      `${date} · ${n(km)} km · ${ageDays} ${pluralEn(ageDays, { one: 'day', other: 'days' })} old · VDOT ${n(vdot)}`,
    calibrationFromGoal: (vdot: number) => `from the goal time (VDOT ${n(vdot)}) — add a race result to athlete.results`,
    calibrationNone: 'no result recorded in the plan',
    data: 'Data',
    key: 'intervals.icu key',
    keyFromEnv: 'environment variable',
    keyNone: 'none — offline mode (export works without it)',
    envProtected: 'ignored by git',
    envUnprotected: 'NOT ignored by git',
    never: 'never pulled',
    syncValue: (pulledAt: string, activities: number, withheld: number) =>
      `pulled ${pulledAt}, ${activities} ${pluralEn(activities, { one: 'activity', other: 'activities' })}` +
      (withheld ? `, ${withheld} without data (Strava)` : ''),
    empty: 'empty',
    logValue: (entries: number, date: string, status: string) =>
      `${entries} ${pluralEn(entries, { one: 'entry', other: 'entries' })}, last ${date} (${status})`,
    unconfirmed: (dates: string) => `Unconfirmed sessions this week: ${dates} — trainctl log or trainctl pull.`,
    proposals: 'Proposals',
    columns: { id: 'id', kind: 'kind', for: 'for', state: 'state', changes: 'changes' },
    state: {
      valid: 'valid today',
      expired: 'expired — prepare again',
      stale: 'inputs changed — prepare again',
      invalid: 'unreadable',
    },
    git: 'Git',
    noGit: 'Not a git repository — the history of your training lives nowhere. git init is enough.',
    clean: 'Everything committed.',
    dirty: (files: string) => `Uncommitted: ${files}`,
    next: (steps: string) => `next: ${steps}`,
  },

  examples: {
    plan: [
      'trainctl plan                 # regenerate the future, keep the past and approvals',
      'trainctl diff                 # the same changes, without saving',
      'trainctl plan --fresh         # start over (the old plan stays in git)',
    ],
    log: [
      'trainctl log                  # in a terminal: pick the session and answer a few questions',
      'trainctl log --km 8 --time 41:20 --rpe 4 --note "felt good"',
      'trainctl log --date yesterday --status skipped --note "work"',
      'trainctl log --strength done --minutes 30',
    ],
    shorten: [
      'trainctl shorten --minutes 40           # today, as a proposal',
      'trainctl shorten --minutes 30 --date thu',
      'trainctl shorten --apply <id> --commit  # approve what you reviewed',
    ],
    adapt: [
      'trainctl adapt                # proposals only',
      'trainctl adapt --prepare      # a concrete patch to review',
      'trainctl adapt --apply <id>   # apply exactly what you reviewed',
    ],
    review: [
      'trainctl review               # the last seven days and the week ahead',
      'trainctl review --date sun    # the week that ended last Sunday',
      'trainctl review --prepare     # with exact changes for approval',
    ],
    reschedule: [
      'trainctl reschedule --block thu sat           # preview',
      'trainctl reschedule --time tue=40 --pin sun   # 40 minutes on Tuesday, keep Sunday',
      'trainctl reschedule --block thu --apply --commit',
    ],
    export: [
      'trainctl export --what plan                  # .fit workouts for the watch',
      'trainctl export --what workout --date tomorrow',
      'trainctl export --what calendar              # .ics',
    ],
    diff: [
      'trainctl diff                                # what trainctl plan would change',
      'git show what-if:plan/plan.yaml > /tmp/s.yaml && trainctl diff --plan /tmp/s.yaml',
    ],
    push: ['trainctl push --days 7', 'trainctl push --from mon --to sun'],
    pull: ['trainctl pull --days 28', 'trainctl pull --date -7   # a range ending a week ago', 'trainctl pull --from ./activities   # exported FIT/TCX/GPX, no account'],
    status: ['trainctl status', 'trainctl status --json | jq .proposals'],
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
    headingBase: (goalName: string, date: string) => `Plan: ${goalName} — base training until ${date}`,
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
    timeCapsVolume: (peak: number, recommended: number) =>
      `Your time budget caps the plan at ${n(peak)} km/week, below the ${n(recommended)} km/week recommended for ` +
      'this distance (P-7/P-8). More minutes, or a closer goal, changes that (E-2).',
    timeDayTooShort: (dates: string) =>
      `These sessions do not fit the day's time budget even shortened (races and time trials are never cut): ${dates} (E-2).`,
    timeWeekOver: (weeks: string) => `These weeks stay over the weekly time budget: ${weeks} (E-2).`,
    trailOnlyCalibration:
      'Zones come from a trail result — terrain slows a trail race, so road paces may be too easy. Add a road result (Z-10).',
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
    baseGoalName: 'Base training',
    templateTime: {
      section: 'time you actually have, preparation and strength included (optional)',
      weekly: 'minutes per week — volume levels off at what fits (E-2)',
      weekday: 'minutes on Mon–Fri — longer sessions are shortened (E-1)',
      weekend: 'minutes on Sat–Sun',
    },
    templateSync: {
      section: 'execution without an intervals.icu account (optional)',
      files: 'folder of exported FIT/TCX/GPX files — trainctl pull and review read it',
    },
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
      goalKind: (path: string) => `${path}: race (default) or base`,
      minutes: (path: string) => `${path}: whole minutes between 15 and 2000`,
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
    'F-12': 'strength twice a week in the base, 0–1 a week in the competition period (Haugen 2022)',
    'F-14': 'one strength session a week keeps the gains of a block (Rønnestad 2010 — data from cyclists, an extrapolation)',
    'F-18': 'the first two weeks of a strength block learn the movement at ~75% 1RM before the heavy weeks — an engineering choice, no source',
    'R-1': 'after a marathon, 48 h without running, then light running — 40 min easy at 48/96/144 h (Martínez-Navarro 2021)',
    'R-2': 'running again 48 h after a marathon does not slow recovery (Martínez-Navarro 2021)',
    'R-8': 'after a race of half marathon or longer, two transition weeks: ~50% of the pre-race volume easy only, then ~100% with one accent (coaching corpus, n=3; Martínez-Navarro 2021)',
    'R-9': 'strength returns in the second week after the race, one lighter session — an engineering choice, no source',
    'R-10': 'after a shorter goal race, one transition week at ~70% — an engineering choice; no data behind it',
    'P-11': 'a plan without a race grows to your documented peak (or +15%) and levels off there, deload every fourth week — an engineering choice',
    'E-2': 'the time budget from trainctl.yaml caps weekly volume and shortens sessions with the same rules as E-1 — an engineering choice, no source',
    'Z-10': 'a trail result does not calibrate road zones while a road result exists — an engineering choice; VDOT tables come from road and track',
  },

  /** What each session kind is for — the physiological purpose, one sentence. */
  kindPurpose: {
    easy: 'Easy running contributes low-intensity kilometers to the weekly training volume.',
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
      'On an existing plan it regenerates the FUTURE only: past, logged, pinned, hand-edited and approved days ' +
      'stay, and an approved baseline from adapt is kept. fresh=true starts over. Ask before calling it; ' +
      'trainctl_diff shows exactly the same changes without saving.',
    planFresh: 'true = regenerate from scratch, discarding kept days and approvals (ask the user first)',
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
    logRpe:
      'session effort as a whole number 1–10 (CR-10, 10 = maximal). Ask the runner after the session — never guess it.',
    logNote: 'how it felt, conditions, remarks',
    logStrength: 'done | skipped — records a strength session instead of a run (only minutes and note apply).',
    logMinutes: 'duration of the strength session in minutes',
    shift:
      'Week renegotiation: swap the sessions of two dates within THE SAME week ' +
      '(e.g. “release on Thursday — move the intervals”). Protects race day and the day before it; ' +
      'warns when the 48 h rule between accents (I-7) would break.',
    shiftFrom: 'date of the session to move',
    shiftTo: 'target date (the two sessions are swapped)',
    why:
      'Explain the stored session: purpose, race goal, phase, actual dose, neighboring demanding sessions, time budget, execution and manual edits, plus the rules behind it ' +
      '(IDs from docs/science/FOUNDATIONS.md).',
    adapt:
      'Compare execution (sync.json + journal) with the plan and propose corrections: a realistic ' +
      'volume, a restart after a break, a post-race protocol, zone recalibration. ' +
      'By default returns proposals only. Use prepare=true to save a concrete patch; show its changes and ask the runner to approve it before calling apply with its ID. Changed inputs invalidate the patch.',
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
    pullFrom: 'path (relative to the training directory) of a folder or file with exported FIT/TCX/GPX activities; read instead of intervals.icu.',
    review:
      'The whole weekly review in one call: the days behind vs the plan, signals worth acting on, ' +
      'the week ahead (phase, volume, key session, races/time trials) and a list of concrete ' +
      'actions. Use THIS instead of calling trainctl_pull + trainctl_adapt + trainctl_week in sequence — ' +
      'e.g. when the user asks “how did I do?” or starts a new week. Works without an API key too ' +
      '(then from the journal and the last snapshot). Use prepare=true when asked for concrete changes to approve. Show the saved diff and warnings, then call trainctl_adapt(apply=ID) only after approval. The review itself changes nothing in the plan.',
    reviewDays: 'how many days back to summarise, default 7',
    reviewDate: 'reference date (defaults to today)',
    diff:
      'Dry run: what regenerating the plan from the current trainctl.yaml would change (new results, ' +
      'a changed profile). Saves nothing. With plan=<path> it compares the current plan against ' +
      'another plan.yaml instead — the what-if workflow: a scenario lives on a git branch or in a ' +
      'copied directory (changed race date, dropped tune-up), and the diff shows goal, prediction ' +
      'and week-by-week changes before the user decides.',
    diffPlan: 'path to another plan.yaml to compare against (scenario branch, worktree, copy)',
    check:
      'Lint the plan file against the engine invariants: ≥48 h between accents (I-7), the day before ' +
      'a race stays free (T-10), taper shape (T-4/T-5, F-13), strength adjacency (S-5), ≥75% easy ' +
      'volume (I-5) and file-internal consistency (sums, dates, the goal race present). ERRORS mean ' +
      'plan/plan.yaml is internally inconsistent (usually a manual edit); WARNINGS mean a rule ' +
      'deviation someone may have chosen. Run it after hand-editing the plan file. Changes nothing.',
    checkStrict: 'true = warnings also count as failures',
    rule:
      'Explain one engine rule by its ID (as cited in trainctl_why, trainctl_check or plan ruleRefs): what it says, ' +
      'whether it comes from published research, the coaching corpus or an engineering choice, and the link to ' +
      'FOUNDATIONS.md for this engine version. Without an id it lists every rule. Read-only.',
    ruleId: 'rule ID, e.g. I-7 or T-10; omit to list all',
    initAgent: 'also write agent integration files: claude → .claude/settings.json, codex → .codex/config.toml, all → both.',
    promptReview: 'Weekly review with the trainctl coach: what happened, what it means, what is ahead.',
    promptReviewText: (date: string) =>
      `Run trainctl_review${date ? ` with date=${date}` : ''}. Relay it in plain language: the days behind against the plan, ` +
      'the signals worth acting on and the key session ahead. Quote RPE and notes verbatim, propose at most two things, ' +
      'and ask before treating unknown sessions as missed. Do not change the plan without my explicit yes.',
    promptDebrief: 'Debrief after a run: record how it went.',
    promptDebriefText: (date: string) =>
      `I finished a session${date ? ` on ${date}` : ' today'}. Check what was planned (trainctl_today), ask me for distance, ` +
      'time, effort 1–10 and one sentence of notes, then record it with trainctl_log. If the feeling clashes with the ' +
      'session’s role, ask one question about context instead of drawing conclusions.',
    promptDate: 'YYYY-MM-DD (optional)',
    resourcePlan: 'The training plan rendered for reading (plan/PLAN.md).',
    resourceConfig: 'The athlete profile and goal (trainctl.yaml).',
    resourceAgents: 'Coach instructions for the agent in this directory (AGENTS.md).',
    resourceRule: 'One engine rule by ID, with its source class.',
    resourceMissing: (file: string) => `${file} does not exist in the training directory yet.`,
    status:
      'State of the training directory in one call: whether trainctl.yaml validates, which engine version ' +
      'generated the plan, where the API key comes from and whether .env is protected, when data was last pulled, ' +
      'the journal, saved proposals with their validity today, and uncommitted files. Read-only — start here ' +
      'when something looks off.',
    commit:
      'true = after a successful write, git-commit exactly the files this tool changed (never secrets). ' +
      'This writes to the user’s git history — use it only when they asked for commits.',
  },

  /** AGENTS.md — the coach persona dropped into the training directory by `trainctl init`. */
  agentsMd: (foundationsUrl: string): string => `# Coach — instructions for the agent

This directory is a training plan as code. You have the \`trainctl_*\` MCP tools
(or the \`trainctl\` CLI) and you act as a coach, not just a command runner.

## Rituals

- **Only 40 minutes today** → \`trainctl_shorten(minutes=40)\`. The budget includes preparation and strength. Show the exact before/after, any lost purpose and warnings; use the returned ID only after approval. Never silently substitute an easy run for quality work.
- **Why this workout** → \`trainctl_why\`. Lead with purpose, current phase and the actual dose, then explain placement and sources. Manual edits have no inferred intention.
- **Review and propose changes** → \`trainctl_review(prepare=true)\`. Show execution gaps and the saved changes. Approve with \`trainctl_adapt(apply=ID)\`; do not regenerate or sync between preview and approval.
- **Start of the week** → \`trainctl_review\`. One call instead of pull + adapt +
  week. Relay the result in plain language and propose at most two things to do.
- **Something looks off** (a proposal will not apply, data seems missing, the
  plan reads oddly) → \`trainctl_status\` first: config, engine version, key,
  last pull, proposals with their validity, uncommitted files.
- **Before any change to the week** → \`trainctl_week\` first, to see the context.
  “Move the intervals” without looking at the week is guesswork.
- **After a race or a time trial** → ask for the time and propose an entry in
  \`athlete.results\`. A measurement with no result written down changes nothing —
  the zones still come from the older run. After the goal race the plan continues
  with transition weeks (R-8); when the user names the next goal, change \`goal\` in
  \`trainctl.yaml\` → \`trainctl_diff\` → \`trainctl_plan\` — the new cycle starts
  after the transition and keeps the history.
- **After a logged session** → a short debrief. Ask how it went and write it
  down (\`trainctl_log\` with rpe 1–10 and a note) — the trail of feelings comes
  back in the weekly review. When the feeling clashes with the session's role
  (an easy run described as “barely alive”), ask one question about context —
  sleep, work, life — instead of drawing conclusions from a single entry.
- **Got a scheduler at hand?** If the environment you run in can execute
  recurring tasks, offer the user an automatic Monday debrief
  (\`trainctl_review\`) — once, and with their consent, never silently.
- **After a hand edit of \`plan/plan.yaml\`** → \`trainctl_check\`. Errors mean the
  file went inconsistent; warnings carry FOUNDATIONS rule IDs worth relaying.

## Rules

1. **Do not regenerate the plan without asking.** \`trainctl_plan\` rewrites the future
   weeks (past, logged, pinned and approved days stay; fresh=true starts over).
   When in doubt: \`trainctl_diff\` (the same changes, saves nothing).
2. **Adaptation proposes, it does not rewrite.** \`trainctl_adapt\` returns proposals;
   use prepare=true for a concrete patch. Show its session changes and warnings, then ask\n   for approval before calling apply with that ID. If inputs changed, prepare a new proposal.\n   Missing execution data is unknown, not proof of a skipped session.
3. **Ask for context before you start computing.** A missed week means one thing
   after illness and another after a crunch at work — the first needs a careful
   return, the second usually just a reshuffle of days.
4. **Race day does not move.** \`trainctl_shift\` will refuse; do not work around it
   by regenerating the plan with a different date.
5. **Do not invent numbers.** Paces, volumes and rules come from the engine; if
   something is not in a tool’s output, say “I don’t know” rather than estimate.
6. **Cite reasons, not just commands.** \`trainctl_why\` gives the purpose of a session
   and the rules behind it (IDs from [docs/science/FOUNDATIONS.md](${foundationsUrl})) — that is the
   value a coach adds over a list of workouts.
7. **A what-if question gets a scenario, not an overwrite.** “What if the race
   moves three weeks?” → git branch or a copied directory, change \`trainctl.yaml\`
   THERE, regenerate there, then \`trainctl_diff\` with plan=<path to the scenario’s
   plan.yaml> and show the differences. The real plan stays untouched until the
   user decides.
8. **Feelings are material for conversation, not arithmetic.** RPE and journal
   notes may be quoted and laid side by side (“third week in a row you write
   ‘heavy’”), but never converted into zones, paces or volume (Z-4). Recurring
   heaviness is a reason to talk — and maybe \`trainctl_adapt\` — not for a
   silent correction.

## Correlate what you can see

The trainctl tools are not your only eyes. If you also see the user’s calendar,
issue tracker, on-call schedule or work repositories, connect them to the week
instead of waiting to be told:

- A release, a deadline or travel landing on a training day → propose
  \`trainctl_reschedule\` with those days blocked **before** the conflict happens
  (“Thursday is the release — move the intervals to Wednesday?”).
- A cognitively heavy day — long agent sessions, a dense review queue, an
  incident → \`trainctl_desk\` with heavy=true; after such a day the accent runs
  by pace, not by feel (S-8).

Two boundaries: propose, never apply without a yes, and name the signal you
used (“I saw the release in the calendar”) so a wrong guess is easy to correct.
Health data only from sources the user connected for exactly that purpose.

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
