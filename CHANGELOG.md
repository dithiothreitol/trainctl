# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning: [SemVer](https://semver.org/). Below 1.0.0 the engine's output may
change between minor versions — a regenerated plan can differ.

## [Unreleased]

### Changed

- Running sessions in the multisport schema carry their structure as steps:
  warm-up, repetitions with the pace range and recovery, the mid-series walk,
  strides, hills with the jog down, progression thirds and alternating
  kilometres. Session cards, the FIT file and the intervals.icu workout read
  these steps instead of the stored running workout, which stays for the
  running engine (PLAN-v0.7 E1).
- A multisport workspace whose plan carries the running engine and whose
  profile has only running now answers `why`, `status`, `review` and `adapt`
  the way a running plan does: rule sources and calibration in `why`, the
  workspace status screen, laps and target compliance in `review`, and the
  running analysis in `adapt` (missed sessions, recalibration, the return
  block after a break). `adapt --prepare` stores a session-plan proposal and
  `adapt --apply` changes the sessions; days moved, shortened or approved in
  the session plan stay protected (PLAN-v0.7 E4).
- `why` shows the planned RPE range of a run, as the session card does.
- In the same workspace `log --to … --reason …` records a break as session
  entries, so `adapt` proposes the return block after illness or a layoff
  (B11), and `plan` shows the peak volume, VDOT and the race prediction of the
  running engine (PLAN-v0.7 E2).

- The running engine lays out weeks differently, so the first `trainctl plan`
  after updating rewrites future days of an existing plan. Past, logged,
  pinned and hand-edited days stay (ADR-033).
- An easy run stays below the long run (at most 0.9 of it, S-10) and below 35%
  of a week that has a long run. When the rest of the weekly distance does not
  fit, the long run takes it up to the corpus P90 share, then a free day gets
  another run (S-11), instead of one 15–17 km easy day. With two running days
  the long run takes at most 80% of the week (the corpus P90 for two runs), so
  the other day keeps a run, and an accent takes at most half of the week, so
  the long run stays the longest; the long-run track gives way to the accent
  or the time trial instead of dropping the accent or going over the week.
  With one running day the long run is the week.
  The peak is capped at what the available days can
  hold, so deloads and the taper stay lighter than loading weeks, and `plan`
  says when the days limit the peak. The peak that `plan`, `status` and
  PLAN.md show is the highest week the plan lays out, not the macrocycle's
  target.
- Small weeks: an accent that would carry more than 35% of a week with a long
  run first loses a repetition, then gets a 2 km warm-up, and below that
  becomes an easy run with strides (J-6), which keeps its strides when a day
  time budget shortens it; in the taper the accent stays (T-1). No run besides the long run is shorter than 3 km: two
  2 km strides days become one 4 km day, and the long run beside easy runs is
  at least 3.4 km. A time trial is planned only when the whole session with
  warm-up and cool-down fits the same share; with one accent a week, the time
  trial replaces it instead of adding a second hard day. In a week under about
  8.6 km (a small tune-up week) the 35% share is below 3 km, so the easy run
  keeps 3 km and the shape check accepts it.
- `review` shows execution day by day in the session row layout: the day with
  its date, the session type in its colour, plan, actual, the day's average pace
  where synced runs carry their time (`execution[].paceSecPerKm`), and status.
  A run outside the plan has no type and no plan. Distances and pace follow
  `units`.
- The time estimate of a session counts the mid-series walk of @I repetitions
  and the strides after an easy run (about 0.2 s per metre and a minute back), so
  day and week budgets see the session as it is run. The watch gets both as
  steps: two loops with the walk between them, and a strides loop after the easy
  run (FIT and intervals.icu). A shortened session keeps the mid-series walk in
  its description.
- The race week shows the training planned around the race, without the race
  distance, in the `week` header, the season grid and the table's total, with or
  without a time budget.
- `adapt`, on a week trimmed by the time budget or the days, says how much they
  hold and what to change (`time`, `daysAvailable`) instead of only holding course.
- Days of the plan's first week before it was made, with no log and no run, no
  longer count as unconfirmed sessions in `adapt`, `review` and `status`.
- `status` after the race says "Since the race: N days" (and the end of a base
  plan), as `review` does.
- The I-5 check (at least 75% easy) runs after the rest of the week is
  distributed, so accents are no longer trimmed for distance that easy runs
  carry.
- `why` explains these layout decisions: a hills day turned into an easy run,
  an accent turned into strides, an accent released to an easy run under the
  hard-kilometre ceiling, a week shorter than its target (how much the
  days cannot hold under the easy-run ceiling, shown while the week is still
  short). The
  explanation follows the session when `shift` or `reschedule` moves it, also
  when the week has an identical session on another day.
- Weekly volume grows across the loading blocks so that the peak falls in the
  last block before the taper (T-7, P-12) instead of in the second week, at most
  8% a week (P-3). When the growth is slow, or the runner is already at the
  peak, the loading weeks of a block rise 0.94 → 0.97 → 1.00 of the block level.
  Deloads and the taper are counted from that level.
- An approved volume baseline (`adapt --apply`) replaces the level of the
  current block, and every later week keeps the plan's proportions from it:
  the wave within a block, deloads, the taper and the growth of later blocks
  ("progress from there"). A lower baseline shortens the long-run track with
  the week; a raised one does not lift the plan above its peak unless the
  baseline itself is higher, and the taper after a block at the peak keeps its
  proportions. `adapt` counts a raise from the block level, so a raise during a
  deload no longer cuts the plan, and it does not offer a raise while the time
  budget or the days trim the current week.
- The long run has its own track: it grows by at most 2 km a loading week to
  22 km for a half marathon, 30 km for a marathon and 32 km for an ultra in the
  last block before the taper (J-1, J-2, J-10, N-19), and shortens in deloads.
  When the weekly volume cannot carry the distance's threshold, `plan` says so
  with the numbers.
- Accents progress through the season (J-8): from about 3 km of work at the
  start to the dose the week can carry in the last block, one step a week
  within a block, each block starting from the second week of the previous one.
  The taper keeps that dose; after the race the first accent is the smallest.
- The peak phase uses a 1000/400/200 m ladder at interval pace (J-4) instead of
  1 km repeats. When a week cannot hold the long run, both accents and the hills
  day, the hills day goes first, then the second accent (J-5, I-8).
- Interval segments record their recovery as walk or jog and the longer walk
  halfway through a set, so later views can print them without parsing text.
  Polish descriptions read `4×1 km` and `przerwy 2-minutowe`.
- `why` explains the weekend order the plan keeps: an accent the day after the
  long run is as common in the coaching corpus as the reverse (S-9b), and the
  long run stays the day after a race or time trial (T-11).
- `trainctl rules` explains the rules the engine now cites: S-9b–S-12, P-12,
  J-1, J-2, J-4–J-6, J-8–J-10 and N-19. A rule ID with a letter suffix (`S-9b`)
  is found whatever its case.
- `check` and the MCP `trainctl_check` tool report the season shape checks as
  warnings: a long run shorter than another run, a deload no lighter than its
  loading weeks (a time-trial or tune-up week, lighter by design, is not
  compared), one session over 35% of a week beside the long run, a heavy
  accent after the race and a block that repeats the previous one (ADR-047;
  not when the time budget holds both blocks, which `plan` already says).
  `check --strict` fails on them; a plan from an earlier engine shows them
  until `trainctl plan` regenerates it.
- The weekly time budget caps the macrocycle's peak instead of trimming each
  week on its own (E-2): the peak is the most a loading week can hold in the
  budget with that week's strength, and deloads and the taper are counted from
  it, so a deload is lighter than a loading week and the taper keeps falling.
  When the budget holds the plan back, `plan` says so even above the distance's
  recommendation (for a base goal without the distance's threshold), and with
  strength on it leaves the choice to you: one strength
  session a week (F-14) or more minutes. When the budget also keeps the longest
  run below the distance's threshold, `plan` gives the long-run numbers too. A
  budget too small for even a 3 km week keeps 3 km weeks and lists the weeks
  over the budget.
- When the plan stays below the distance's thresholds, `plan` gives one verdict
  instead of two warnings, naming only the thresholds it misses (the plan peak
  against the recommended peak, the longest run against the distance's
  threshold; with a time budget, the peak without the budget, which has its own
  warning), with the ways out — a race in a later week when the profile allows it
  (counted from today, or from the return after a break),
  `peakWeeklyKm` or `returning` if you have run more before, or a base goal.
- `week` shows one row per session in both the running and the multisport
  plan: day, type, km, time including preparation and the session in short
  notation built from its structure (`RG 3 km · 4×1 km @4:32 p. 2' marsz · SCH 1 km`,
  in English `WU … r. … CD`), with a total under the table and one legend line.
  Easy and long runs show their pace. A multisport week adds a sport column, and
  several sessions on one day share the day label. In a terminal the journal
  status is a symbol (✓ ✗ ~, ▸ for today); plain output and MCP get the word.
  A running week fits in 14 lines at 80 columns. A multisport session line no
  longer repeats the warm-up target; `today` shows it.
- `today` shows the structure of the session with its targets (part, dose,
  pace or power range, recovery), the time including preparation and the next
  session, in at most 18 lines. The worded description moved to `--full` and
  `why`. A multisport day shows each session's steps; the RPE scale is printed
  once per view instead of in every card.
- `plan` shows the season grid instead of the list of phases. The multisport
  overview (`status`) lists the next seven days as session rows.
- `PLAN.md` opens with the season grid and lists each week as session rows in
  the short notation, with one legend line; the worded descriptions stay in
  `plan.yaml` and `why`. Strength sessions are described once in their own
  section, and a strength row names its variant (intro, heavy, maintenance),
  also in `week`. The multisport `PLAN.md` has the same grid and week tables and
  keeps every session's purpose and steps under its week; its headings are no
  longer in English in a Polish file.
- The printable sheet uses the same rows (type, km, time, session, with the
  legend under the title) and writes dates as `27.10` in Polish. The mobile
  page shows the session line and the steps with their targets.
- `plan` in a multisport workspace shows the goal, the horizon, the weekly
  time per sport and the season grid, and says which files it saved instead
  of a bare "Written:".
- A running session in a multisport plan carries a planned RPE range from its
  hardest segment (easy 3–4, intervals 7–8, a time trial 9–10; MS-6, an
  engineering choice), so its card no longer says "No RPE range prescribed".
  It describes intent only: `adapt`, `review` and the replacement intent do not
  read it. The next `plan` rewrites future running sessions once to add it.
- Session coaching texts, card headings and transaction errors moved from code
  into the language catalogs, so the catalog checks and the English leak test
  now cover multisport output; the transaction errors are no longer English in a
  Polish session.

### Added

- `trainctl season` (and the MCP tool `trainctl_season`): the season grid, one
  row per week with the phase, planned km, the main sets of the accents and the
  long run, the current week marked and deload weeks arrowed. Read-only. In the
  multisport plan the grid shows sessions and time per week.
- `--full` on `today` and `week` (and `full` on the MCP tools) prints the full
  session cards: the worded description of a running session, the purpose and
  guidance of a multisport one.
- Heart rate as a second target: with `athlete.hrMax: { bpm, measured }` and
  `athlete.sex` in the profile, easy and long runs get a heart-rate ceiling at
  LT1 (78.9% of HRmax for men, 83.6% for women, Z-2), shown after the pace in
  `week`, `today`, `PLAN.md` and the printable sheet, explained in `why`, and
  written above the steps of the workout pushed to intervals.icu. Pace stays
  the target (Z-3); accents keep pace only; `review` and `adapt` do not judge
  heart rate. Without `sex` there is no ceiling and `why` says why (N-13). An
  estimated HRmax (`measured: false`) brings one warning per view (Z-5). The
  `init` wizard asks for HRmax, whether it was measured, and sex; `init
  --from-intervals` proposes the highest heart rate in the history as an
  estimate. The profile now rejects an unknown `sex`.
- Miles: `units: imperial` in `trainctl.yaml` or the global `--units` flag shows
  distances in miles and pace per mile in `week`, `today`, `season`, `plan`,
  `status`, `PLAN.md`, the printable sheet and the mobile page; repeats are
  written in metres (`4×1000 m`) and swimming stays per 100 m. `plan.yaml`,
  `log.jsonl`, `--json`, MCP `structuredContent` and sync stay in kilometres.
  `log --km` and the wizard take distances in the profile unit and store
  kilometres; the wizard asks for the unit first. The MCP `trainctl_log` tool
  takes kilometres, like the data it returns. In the running plan, `plan`
  refreshes `PLAN.md` when only its view changed, for example after switching
  units; `PLAN.md` follows the profile, so a one-off `--units` flag does not
  convert it. Migrating to the multisport schema keeps `units` and `notation`. Diagnostic
  messages in `adapt`, `review` and the race pack still use kilometres.
- The plugin's session start tells the agent how old the execution data is: the
  last pull date from `sync.json` (as in `trainctl status`) and its age in days,
  or that there is no `sync.json` yet. Nothing is fetched in the background.
- `notation: club` in `trainctl.yaml` writes sessions with the codes of Polish
  club plans: OWB1 for easy and long runs, BNP for a progression, BZ for the
  alternating run, WT for reps (RT up to 300 m, BC3 from 2 km), SB for hills and
  RT for strides, with a legend under the view. It applies to the session rows of
  `week`, `season`, `plan`, PLAN.md and the exports, in Polish only; English
  keeps the neutral notation. The warm-up, cool-down and recovery keep RG, SCH
  and p. Data (`--json`, MCP `structuredContent`), `plan.yaml` and the workouts
  sent to intervals.icu do not change. The mapping is an engineering choice
  (FOUNDATIONS E-4).
- Laps: `pull` and the data refresh in `review` keep the laps of each run in
  `sync.json`: distance, time, heart rate and, where the source gives them, the
  lap's role (work, rest, warm-up, cool-down) and how it closed (manual, by
  distance, by time). They come from FIT `lap` messages, TCX `<Lap>` elements
  and, for intervals.icu, one extra request per run
  (`GET /activity/{id}/intervals`); a rate-limit answer stops these requests
  and keeps the activities. `init --from-intervals` does not fetch laps. Laps
  already in `sync.json` stay when a later pull does not bring them. GPX has no
  laps.
- `review` sets the sessions of the week against their targets ("Against the
  targets"). For an interval session it matches the work laps to the planned
  repetitions by order and length: how many of the planned reps were found,
  their paces and how many fell within the target range, plus reps beyond the
  plan. Auto laps every kilometre do not fit the structure and read "no laps
  matching the plan"; a run without laps reads "no laps in the data". Lap roles
  are read per run, so an easy run with auto laps on the same day lends the
  session nothing; TCX marks only rests, so its warm-up laps are told apart from
  the reps by pace. Easy and
  long runs get their average pace against the easy range (the long run's
  slower range included). A 3 s/km margin covers measurement error. Heart rate
  is not judged (Z-3, Z-6), the plan does not change, and the facts are in
  `execution[].intervals` and `execution[].easyPace` of `--json` and MCP.
- `review` proposes a fresh result when the reps of the last two interval
  sessions ran faster than the target (at least two thirds of them each time):
  a tune-up race within four weeks first, then a time trial in the plan, else
  a new race result or a time trial (W-12, W-13). Only sessions after the
  latest result in `athlete.results` and inside the 21-day window count. It is
  a sentence and `calibration` in the data; the plan does not change.

- A break during the plan: `trainctl log --date … --to … --status skipped
  --reason illness|injury|travel|other` records every day of the break, also in
  advance (`--to` or `--reason` alone already means skipped); a run synced
  later on a day logged in advance still counts (with `TRAINCTL_TODAY` "in
  advance" is judged by the simulated date), days with a recorded run (logged or
  synced) stay as they are, a day
  logged again replaces its earlier reason, rest days in the range stay rest
  days, the reason is case-insensitive, `--commit` names the whole range, and a
  weekday name in `--to` counts from `--date` (a multisport workspace and
  `--strength` reject `--to` and `--reason` instead of logging one session)
  (`--date mon --to fri` is one week). The MCP
  `trainctl_log` tool and the log prompt take the same fields. Days of a break
  logged with a reason do not count against compliance unless you ran on them,
  so a short break does not lower the baseline. After a break of 10 days or more,
  counted from your last run (also one before the plan or the 21-day window),
  `adapt` proposes a return block you can approve with `--prepare` and
  `--apply`, also in the morning before
  today's session and during the first week back (not when the break already
  has a return block, approved or from an `athlete.returning` set after your
  last run, running or about to start; a break that lasts
  into a later week gets a proposal that moves the block, from the same earlier
  volume); when the break is logged
  ahead, with or without a reason (rest days between the logged days count as
  part of it), the block starts the day after its last day:
  about 55% of the earlier volume, at least 7 days easy after illness (R-5) or
  the loading weeks of the first block easy after any other break (R-11; the
  taper keeps its intensity), the long run shrinking with the week, growth
  within P-3 until the plan catches up, a deload at 0.7 of the return's last
  loading week (P-2; a return that starts in a deload week starts at the
  restart level), and
  no time trial in the return block (the accent it replaced comes back). The
  earlier volume is the plan's last loading week up to your last run before the
  break, not a
  deload or taper week and not the plan's target during the break, so it stays
  the same when you run `adapt` again, also when your last run was before the
  plan; the taper inside a return block keeps falling, also after a tune-up
  race in the last loading week. An injury logged anywhere in the break
  (also on the day of the last run) decides, also before the
  21-day analysis window and also in a break shorter than 10 days: `adapt`
  proposes no volume change and `adapt --prepare` prepares no plan
  change at all, not even a recalibration (R-6, R-7). An approved return survives
  `trainctl plan` like an approved baseline (ADR-033) and replaces it; the
  proposal says so when it replaces one. During a return, approved or from
  `athlete.returning`, `adapt` neither raises nor lowers the baseline, from
  the first (partial) week on: the return curve grows on its own, and the
  break still in the analysis window is not low compliance. A tune-up race in the
  easy part of a return stays in the plan, and `plan` says the return rule
  does not expect it; a B race week stays lighter than the curve by the
  mini-taper (T-9). After the A race only the first week is without a long
  run and strength (R-8, R-9); a return block in the weeks after it keeps both.
- `trainctl rules` explains R-5, R-6, R-7 and R-11.
- `athlete.returning: { since, previousWeeklyKm }` for a return after two
  weeks or more without running (R-11): the plan restarts at 50–60% of the
  earlier volume (more when you have been back for some weeks, at most P-3
  growth a week), keeps the first block after `since` easy with no time trial
  (a return that began weeks before the plan has less of it left, or none), and
  grows back within P-3. Added after an approved baseline, the return replaces
  it, as an approved return does (one volume decision at a time). Once `recentWeeklyKm` is above the earlier volume, the return no
  longer applies; a `since` date in the future does not apply yet. Added during
  a plan, the field starts a return block from `since` on the next
  `trainctl plan` and keeps it for the rest of the cycle, also after an
  approved return when it describes a later break. `plan` mentions the
  return, at the start of the plan or added later, while its block is still
  ahead. A plan with no deload
  before the taper keeps the first half of its loading weeks easy, so accents
  come back before the taper. `init` asks for it, and `init --from-intervals` proposes it when
  the history ends with two weeks off (in the wizard Enter accepts the proposal
  and 0 declines it; the volume before the break is at least the current one
  and the first day back is within the last six weeks, otherwise the plan would
  ignore the return).
- `trainctl rules E-3` lists the engine's fixed values that have no source
  (easy-run cap, accent share, phase split, recoveries, race-week sessions),
  each marked in code for review.
- Season shape checks in the engine (`seasonProfile`, `seasonShapeIssues`):
  long run not the longest, deload not lighter, one session carrying the week,
  heavy accent after the race, repeated blocks, long run below the distance
  threshold, run on a test matrix of 576 synthetic profiles.
- FOUNDATIONS §10.15: corpus measurements of run count, volume and long-run
  trajectory, accent dose and weekend order, with rules S-9b–S-12, P-12,
  J-8–J-10 and the return-after-break heuristic R-11.

### Fixed

- `review`: the day-by-day execution table is headed Plan / Actual / Status
  instead of reusing the before/after labels of plan changes; the days-to-race
  line no longer repeats its label.
- Decimal numbers follow the output language (`21,1 km` and `VDOT 47,7` in
  Polish, `21.1 km` in English) instead of raw values such as `21.0975`. The
  change history in PLAN.md quotes entries as recorded in plan.yaml.
- Journal statuses are words from the catalogue (`wykonany`, `opuszczony`,
  `zmieniony` in Polish); `--json` and MCP data keep the raw enum.
- A one-week phase reads `taper: week 22`, not `weeks 22–22`.
- Wrapping keeps URLs and file paths whole on their own line, so links stay
  clickable.
- `why` counts the age of each race result from today, like `status`, names
  the date the plan's zones were calibrated, and says when `trainctl plan`
  would now calibrate them from a different result or from none.
- `trainctl log` reads numbers with one rule for `--km`, `--rpe`, `--minutes`
  and the interactive prompt: a decimal comma (`8,5`) is accepted, hex and
  exponent forms are not, and the distance is stored to 0.1 m and echoed as
  stored.
- Hand-edited `log.jsonl` values are read with the limits `trainctl log`
  applies: numbers written as text or with a comma are accepted, values the
  CLI would reject are ignored, and a missing final newline no longer merges
  the next entry into the last one. A line that is not a JSON object is
  skipped instead of stopping every command; `status` lists the ignored lines
  and values.
- `week` prints one volume when the target equals the planned total.

## [0.6.0] — 2026-11-04

### Fixed

- Fractional pace now rounds correctly across minute boundaries in CLI and
  Intervals.icu work/recovery steps.
- Hard running and timed swimming repetitions explain their actual intent;
  standalone sessions do not imply a known training phase.
- Multisport rule links now refer to MULTISPORT rather than running foundations.

### Added

- Phase-specific cycling and swimming recipes with objectives, rationale,
  success criteria, warm-up, main work, recovery and cool-down.
- Named swimming drills, RPE guidance without current calibration, and
  bounded progression for bike/run bricks.
- Coaching instructions in CLI/MCP, JSON/YAML, Markdown, HTML, ICS and
  Intervals.icu; FIT step notes and explicit recovery power/pace.
- MS-6 documents recipe parameters, evidence boundaries and device limits.

### Changed

- CLI workout cards separate objectives, structure, rationale and adjustments
  with coloured headings. Planned peak RPE has a labelled ten-step colour scale;
  recovery targets have separate rows, and durations use minutes and seconds.
- Replacement and shortening previews compare structured cards; confirmation
  shows a concise summary. Plain/MCP output keeps headings and numeric RPE.
- FTP/CSS without a current dated source now uses subjective effort guidance.
- Shortening preserves complete repetitions and the minimum quality stimulus.
- A time budget too small for a quality set explicitly produces an easy session.

### Distribution and limits

- Available on npm as six packages at version 0.6.0 (`latest`), and on GitHub
  with a self-contained Codex plugin and terminal examples.
- Training recipe parameters remain documented engineering choices; independent
  coaching review and tests on physical Garmin/Suunto watches are still pending.
- FIT step notes may be truncated to 254 UTF-8 bytes; full instructions remain
  available through CLI/MCP and text exports.

## [0.5.0] — 2026-11-04

### Added

- Cycling, swimming and mixed-sport plans with separate profiles, time volumes,
  equipment constraints, session IDs and multisport race groups.
- Reviewed substitutions in all six directions between running, cycling and
  swimming, with time budgets, trade-offs and restoration of the original session.
- Schema v1 to v2 migration with preview/apply, protected history, journal entries
  for the sport actually performed, and recovery after interrupted writes.
- Multisport FIT, ICS and HTML exports, calendar withdrawal/reactivation, and
  activity matching across Intervals.icu and imported FIT/TCX/GPX files.
- A self-contained Codex plugin bundle with 21 training tools, six skills and
  `trainctl_workspace` for selecting the training directory explicitly.
- `--color auto|always|never` and `--plain`; responsive tables, consistent sport
  colours, readable help and separate session metadata in the CLI.

### Fixed

- `week --session` now selects the requested session, including other weeks,
  and rejects unknown IDs or conflicting sport filters.
- `init --from-intervals` respects agent setup and commit options; a conflicting
  `--sports` option is rejected before contacting the provider or writing files.
- CLI logs of a spontaneous sport change now use the same default `modified`
  status as MCP unless an explicit status is supplied.
- Codex no longer treats the plugin cache as the training workspace. A server
  session binds to one selected directory and keeps its credential context separate.
- Interactive selectors and the week browser now emit valid terminal control
  sequences. Narrow layouts preserve labels, full IDs and Unicode graphemes.

### Dependencies and validation

- Updated the MCP SDK, Zod, Vitest/Vite and transitive dependencies; adapted the
  test runner to Vitest 4. The dependency audit returned no known advisories.
- CI checks source, installed npm tarballs and relocated plugin bundles on Linux
  and Windows. Export checks use Garmin FIT SDK and ICAL.js independently.

### Known limits

- Cycling/swimming templates and substitution limits remain explicit engineering
  choices; a substitution is not a claim of physiological equivalence.
- Physical-watch acceptance is separate from file/parser validation. Suunto
  account pairing and live Google Calendar import were not completed in this audit.
- Multisport groups export linked sessions; swimming FIT send-off is unsupported,
  and pace is descriptive when stroke is the executable target.

## [0.4.0] — 2026-10-21

### Fixed — found by running every command on a fresh directory

- `review` on a Sunday no longer reports the whole week's volume next to the
  number of *remaining* sessions ("52 km across 1 sessions"); it shows what is
  left of the week's target.
- A directory without `trainctl.yaml` now points to `trainctl init` instead of
  `trainctl plan`, which would only have pointed back to `init`.
- `why` no longer prints "About 0 minutes" for a rest day, no longer states the
  session's purpose twice, and lists each rule once with its text and
  provenance instead of in two separate sections.
- `log` answers with what the plan had for that day next to what was recorded,
  says when an entry falls on a rest day, and returns structured `data` for MCP.
- Messages print `plan/plan.yaml` on every system (Windows printed `plan\plan.yaml`).
- A plan generated by another minor version of the engine is reported in
  `today`, `week`, `why`, `review` and `check` (informational; never fails
  `--strict`). A plan file with a newer schema is refused with advice to
  upgrade trainctl.
- Rule sources link to `docs/science/FOUNDATIONS.md` on GitHub, pinned to the
  release tag — the file is not part of the npm package, so the relative path
  in `why`, `desk` and `AGENTS.md` led nowhere after installation.

### Changed — `trainctl plan` keeps what you decided (ADR-033)

- On an existing plan, `plan` regenerates **only the future**. Past and logged
  days, pinned days, hand edits, approved shortenings and days whose new session
  would exceed a saved time budget stay as they are. An approved volume baseline
  from `adapt --apply` is kept until you change `athlete.recentWeeklyKm`.
  Previously every regeneration silently discarded all of that — including on
  the documented path "add a race result → `trainctl plan`".
- The same training cycle keeps its phase boundaries; a different goal distance,
  or a new goal after the race, starts a new cycle and keeps the earlier weeks
  as history ("week 2/12" counts the current cycle). On race day the race
  counts as done only when most of its distance is logged or synced (a day
  logged as skipped never counts), so a morning shakeout before a postponed
  race keeps the same cycle.
- Right after `adapt --apply`, `plan` reproduces the approved days, including
  strength sessions, time-budget caps and the day of the decision. Later,
  strength follows the current phases and `strength.days`.
- A `plan/plan.yaml` that cannot be read (a merge conflict, a missing goal) is
  never overwritten silently: `plan` refuses until it is fixed or `--fresh` is
  given, and `status` no longer suggests a `plan` that would fail.
- `trainctl diff` shows exactly the regeneration `plan` would perform.
  `plan --fresh` (MCP `fresh`) starts over and lists what it discards.
- Fixed: a race result recorded inside the plan's horizon did not reset the
  calibration rhythm (W-12), so a regeneration could schedule a time trial a
  week after a fresh 10 km result.

### Added — a CLI you can script

- `--json` on every command prints `{ code, data, output }` — the same data the
  MCP tools return (ADR-035).
- `-C <dir>` / `TRAINCTL_DIR` for the CLI, as the MCP server already had.
- `TRAINCTL_TODAY=YYYY-MM-DD` simulates the date; every CLI and MCP output
  announces it, and past-day protection and proposal expiry follow it (ADR-034).
- Relative dates in the CLI: `today`, `tomorrow`, `yesterday`, `+N`/`-N`,
  weekday names in English and Polish. MCP tools stay ISO-only.
- `trainctl log` without flags in a terminal asks: pick a session from the last
  week, then status, distance, time, RPE and a note.
- `trainctl status` / `trainctl_status`: profile validity, engine version,
  calibration, key source (never its value), `.env` protection, last pull,
  journal, saved proposals with their validity today, uncommitted files.
- `--commit [message]` on `init`, `plan`, `log`, `shift`, `reschedule --apply`,
  `adapt --apply` and `shorten --apply` (MCP `commit`) commits exactly the files
  the command changed — never secrets, `sync.json` or other staged changes
  (ADR-040). `init --commit` includes `.gitignore` when it created it or when it
  had no uncommitted changes before the secret patterns were added.
- `today` shows the estimated duration and the next session.
- `trainctl completion bash|zsh|fish|pwsh`, examples under `trainctl help <command>`.
- Usage errors (unknown command or flag, a date that is not a date) exit with 2.

### Added — trainctl in Claude Code and Codex (ADR-036)

- A plugin in `plugin/`, with this repository as its marketplace for both agents:
  `/plugin marketplace add dithiothreitol/trainctl` + `/plugin install trainctl@trainctl`
  in Claude Code, `codex plugin marketplace add dithiothreitol/trainctl` in Codex.
  It bundles the MCP server, the coach persona and four task skills
  (`review`, `debrief`, `shorten`, `what-if`), and in Claude Code two hooks: the
  coach instructions at session start in a training directory, and
  `trainctl check` after an edit of `plan/plan.yaml`.
- Skills are generated from the same text as `AGENTS.md`
  (`node tools/plugin/render-skills.ts`); `plugin.test.ts` fails on drift.
- `trainctl init --agent claude|codex|all` (MCP `agent`) writes
  `.claude/settings.json` or `.codex/config.toml`; existing files are never
  overwritten.
- MCP: `trainctl_rule` explains a rule by ID with its source class and a link to
  FOUNDATIONS for this version; resources `trainctl://plan`, `trainctl://config`,
  `trainctl://agents`, `trainctl://rules/{id}`; prompts `weekly-review` and
  `debrief`. CLI: `trainctl rules [id]`.
- `trainctl check` returns its findings as `data` (`--json`, MCP, the hook).
- `tools/release/bump-version.mjs` moves every pinned version together: packages,
  plugin manifests, MCP configs, the hook and the CI examples.

### Added — execution without a hub, a fuller calendar, context from the watch (ADR-037)

- New package `trainctl-sync-files`: reads exported FIT, TCX and GPX files
  (also `.gz`, as in Strava and Garmin bulk exports) as a pull-only source, with
  no dependencies. `trainctl pull --from <folder>` (MCP `from`) and
  `sync.files` in `trainctl.yaml` for `review` without an API key. Skipped files
  are named. The same run exported in two formats (start within 60 s, similar
  distance) counts once, keeping the richest file: FIT, then TCX, then GPX.
  `init` adds `activities/` to `.gitignore`.
- The sync port is split into `ActivitySource` (pull) and `SyncProvider`
  (pull + push).
- `push` sends races as race events (`RACE_A`/`B`/`C`) and strength sessions as
  separate `WeightTraining` entries, in their own requests: if intervals.icu
  refuses either form, a race falls back to an ordinary entry, a warning says
  so, and the running sessions are pushed regardless. Cleanup of stale entries
  now covers every `trainctl-` entry, not only workouts. **Not yet verified on a
  live intervals.icu account.**
- `review` quotes resting heart rate, sleep and weight from the synced wellness
  data, and RPE recorded in the hub where the journal has none — verbatim, with
  the source, never averaged or turned into a verdict. HRV and CTL/ATL are
  deliberately left out (H-1, P-4).

### Added — the engine: time, life after the race, a plan without a race

- **Time budget** (`time.weeklyMinutes`, `weekdayMinutes`, `weekendMinutes`,
  E-2): weeks over the weekly budget get a lower volume target, days over their
  limit are shortened with the same rules as `shorten` and carry the trade-off;
  the plan says when the budget lowers the peak below the level recommended
  for the distance, and what the peak would be without it (P-7/P-8). Races and
  time trials are never cut.
  A week keeps its macrocycle target; the volume the budget leaves is stored
  next to it (`timeCappedKm`), and `week`, `adapt`, `diff` and `export` show it.
  A zone recalibration from `adapt` changes paces: day limits shorten
  sessions that no longer fit from the current week, the weekly budget lowers
  volume from the next week on, and volume goes up again through `plan`.
- **Transition block after the goal race** (R-8): after a half marathon or
  longer, two weeks — about half the pre-race volume, easy only, first run on
  the third day after a marathon (R-1), then back to normal with one accent;
  one week at ~70% after a shorter goal (R-10). Strength returns in the second
  week (R-9). Measured first: `tools/corpus/post_race_profile.py` (three long
  races in the corpus — a weak basis, stated as such). `today` and `why` say
  "after the race" instead of "outside the plan", and a new goal set during the
  block starts its cycle after it.
- **A plan without a race** (`goal.kind: base`, `until`, P-11): base weeks only,
  deload every fourth week, growth to your documented peak and a plateau; no
  taper, no prediction, no race pack.
- **Strength variants and journal**: two weeks of getting into it (F-18), then
  heavy sessions, one maintenance session a week in the peak (F-12, F-14);
  `trainctl log --strength done|skipped [--minutes]` (MCP `strength`) records a
  session without touching the run entry of the same day; `review` and `today`
  show it.
- **Trail results** no longer calibrate road zones while a road result exists
  (Z-10); a trail-only calibration is used with a warning.
- Rules E-2, F-18, P-11, R-8, R-9, R-10 and Z-10 in FOUNDATIONS §10, marked as
  engineering choices where no source exists. The corpus backtest is unchanged
  (volume 1.04, Δ accents 0, Δ sessions 0, tune-ups 6/6).

### Docs

- README command tables list `shorten` and the missing flags; tool lists no
  longer carry a count that drifts. `docs.test.ts` keeps both READMEs and the
  MCP README in step with `bin.ts` and `server.ts`.
- CI examples install the published package (`npx trainctl@<version>`) instead
  of cloning the engine and running Node 23.
- `CLAUDE.md` for coding agents working on this repository.

## [0.3.0] — 2026-09-06

### Added — everyday coaching workflows

- `shorten --minutes 40` / `trainctl_shorten` saves a single-session proposal,
  accounting for preparation, recovery and strength. Reduced quality variants
  preserve pace and bookends; easy replacements explicitly give up the original
  purpose. Approved exceptions survive adaptation and carry their rationale
  when moved. All use the existing proposal ID and expiry protections.
- `why` explains the stored session's goal, phase, dose, neighboring demanding
  sessions, execution and time constraints; it identifies manual edits.
- `review --prepare` / `trainctl_review(prepare=true)` combines execution facts
  with a saved diff for approval, or explains why no change can be prepared.
  Seven-day reports cover exactly seven dates; refresh includes the 21-day
  adaptation window. No test result means a request for data, not a timestamp-only
  recalibration patch. CLI, MCP and agent onboarding support both languages.

### Fixed — training workflow audit

- Generated weeks reconcile actual session distances with their budget. Small
  budgets no longer force minimum-size quality sessions; lint reports mileage
  and easy-share deviations instead of suppressing low-volume warnings.
- Zone-only recalibration preserves approved workout structure and volume.
  Volume changes are anchored in upcoming weeks; accepted baselines are saved
  in the plan instead of replaying progression from its original date.
- Proposals expire at the next local calendar day. Historical date selection
  cannot bypass protection of past sessions. Manual swaps also respect recorded
  sessions, race dates, pins and time budgets.
- Race distance is separate from training volume. Training compliance excludes
  both planned and actual races. Unknown race duration is no longer 15 minutes.
- Hill returns count toward distance and duration. FIT and intervals.icu preserve
  alternating/progression remainders; estimates count the final exported recovery.
- Conflicting tune-ups are rejected explicitly. Generation respects the preferred
  long-run day; taper carries frequency forward and reports infeasible schedules.
  Full-day blocks also remove strength, with a visible trade-off.
- `log --test-time MM:SS` (MCP: `testTime`) stores the measured segment separately.
  Whole-session time is never suggested as the test result. Synced completed
  tests also trigger a request for their missing result.
- Input validation rejects non-finite numbers, negative distances, malformed
  times and impossible calendar dates.

Validation: 641 passing tests, including 21 audit regression cases and 35
coaching-workflow regression cases. Type checks, builds and installation of all
five packages verified, including CLI workflows, FIT/mobile export and MCP.

## [0.2.0] — 2026-09-05

### Reviewed adaptation and time-aware scheduling

- Execution data now distinguishes unknown from explicitly skipped sessions.
  Pull, review and adaptation share running-only classification and the latest
  journal correction. Shorter sync refreshes retain older history.
- `adapt --prepare` saves an inspectable, content-addressed plan proposal;
  `adapt --apply <id>` applies exactly that proposal and rejects changed inputs
  or edited proposal files. Past, logged, pinned and manually edited days stay
  intact. Applicable patches cover volume and calibration; recovery remains an
  individual coaching decision.
- `reschedule --time YYYY-MM-DD=minutes --pin YYYY-MM-DD --preparation minutes`
  honors time budgets including preparation, recoveries and strength. Preview
  exposes alternatives (`--strategy long|quality`) and dropped sessions.
- Plans retain calibration inputs and generated-day checksums. `why` explains
  result selection and rule provenance; `excluded`/`exclusionReason` let runners
  retain unsuitable race results without using them for zones or predictions.
- MCP tools return structured domain data with output schemas and annotations.
- `export --what mobile --date YYYY-MM-DD`: standalone responsive workout HTML,
  including light/dark mode, session steps, purpose and expandable reasoning.
- Fixed new-result detection comparing a result collection against itself,
  cycling counting toward a planned run, and the sync test's dependence on the
  current calendar date. `pull --date` makes historical sync ranges explicit.

See [the workflow guide](docs/REVIEWED-ADAPTATION.md) for examples and boundaries.

### Added

- `trainctl log --rpe <1–10>` (CLI and the `trainctl_log` MCP tool): session
  effort on the CR-10 scale, stored in the journal and shown by `today`. The
  engine only stores and quotes it — it never converts feelings into zones,
  paces or volume (ADR-027; collection is grounded in P-6, the refusal in Z-4).
- The weekly review has a new section, *How it felt*: journal entries with an
  RPE or a note from the reviewed window, quoted verbatim (the last entry per
  day wins). No aggregation, no thresholds — the trail is material for a
  conversation with the coach-agent, not input to arithmetic.
- `AGENTS.md` grew a debrief ritual (after a logged session, ask how it went
  and record it; when the feeling clashes with the session's role, ask one
  question about context), rule 8 — feelings are for conversation, not
  arithmetic — and an opt-in offer of a scheduled Monday debrief.
- `docs/examples/proactive-review.md`: the coach speaks first — a weekly
  check-in from the agent's scheduler or cron, with the consent and
  propose-don't-apply rules spelled out.

## [0.1.1] — 2026-08-08

### Fixed

- **0.1.0 could not run once installed.** The packages published their
  TypeScript sources with `exports` and `bin` pointing at `.ts` files, which
  works in the repository but not from `node_modules`: Node deliberately refuses
  to strip types there (`ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`), so
  `npx trainctl` died on startup. The packages now ship compiled JavaScript with
  type declarations and source maps, built by `pnpm build`, with the TypeScript
  sources alongside. 0.1.0 is deprecated on npm.
- Export filenames dropped the Polish `ł` — `interwały` became `interwa-y.fit`,
  and a race called *Bieg Wrocławski* produced `bieg-wroc-awski.ics`. Letters
  that Unicode does not decompose (`ł ø đ ß æ œ`) are transliterated now.
- The MCP server reported a hard-coded `0.1.0` in its handshake regardless of
  the package version; both binaries read their own manifest now.

### Added

- `trainctl --version` — the bug-report template asked for it before it existed.
- `packaging.test.ts`: the published entry points must be built files, versions
  must match across packages, and package descriptions must be English.
- CI installs the packed tarballs into a clean directory and runs the CLI and
  the MCP server from `node_modules` — the check that 0.1.0 lacked.

### Changed

- Package descriptions on npm are English (they were Polish in 0.1.0).

## [0.1.0] — 2026-08-07

First public release.

### Engine

- Macrocycle: base → build → peak → taper, pyramidal-to-polarised progression,
  deload every fourth week, taper length by race distance.
- Microcycle: session shapes from a corpus of 50 coaching plans; ≥75% of weekly
  volume in the easy zone; ≥48 h between quality sessions.
- Zone calibration from **race results**, never from watch threshold readings.
- Finish prediction as a range, never a single number.
- Tune-up races (B/C) with a mini-taper; a time trial only as a fallback when
  the race calendar is empty.
- Week re-solver: rearranges training around days you cannot train, and when
  days run out it names the session it sacrifices and why.
- Optional strength track, justified by running economy — not injury prevention.
- Desk mode: training windows around office hours; after cognitively heavy days,
  run by pace rather than by feel.

### Interfaces

- CLI: 16 commands, colour output, interactive pickers, ASCII and `NO_COLOR`
  fallbacks.
- MCP server: 16 tools over the same handlers, so the agent and the CLI can
  never disagree.
- `check`: lint for the plan file — engine invariants (48 h between accents,
  taper shape, strength adjacency, ≥75% easy volume) and file-internal
  consistency, each finding with its FOUNDATIONS rule ID. Warnings keep exit
  code 0; errors (and warnings under `--strict`) return 1, so a training
  repo can run it in CI.
- `diff --plan <file>`: compare the current plan against another plan file —
  the what-if workflow, where a scenario (moved race, dropped tune-up) lives
  on a git branch or in a copied directory and the diff shows what changed
  before anything is decided: the goal (name, distance, date, target time),
  VDOT, prediction, and week by week the volume, each session's distance, its
  segment layout and the strength track.
- `AGENTS.md` teaches the agent to correlate sources it can see (calendar,
  issue tracker, on-call) with the training week — propose `reschedule` before
  a conflict, `desk --heavy` after a cognitively heavy day — always naming the
  signal and never applying without a yes.
- Export: `.fit` workouts (own encoder, verified against an independent parser),
  `.ics` calendar, A4 printout, race-day pack with splits and a paper pace band.
- intervals.icu sync: push planned sessions to the watch, pull execution and
  wellness, compare with the plan.
- English and Polish, with declension and locale-correct number formats.

### Packaging

- Five packages, published from source with no build step: `trainctl` (CLI,
  `npx trainctl`), `trainctl-core`, `trainctl-mcp` (`npx -y trainctl-mcp`),
  `trainctl-export`, `trainctl-sync-intervalsicu`. Node ≥ 22.18 runs them
  through native type stripping, so what you install is what you can read.
- Four runtime dependencies in total: `commander`, `yaml`,
  `@modelcontextprotocol/sdk`, `zod`.
- CI on Linux and Windows, Node 22.18 and 24.

### Known limits

- Activities that reach intervals.icu **through Strava** carry no data through
  its API. `trainctl` reports this explicitly rather than showing "0 runs", but
  cannot work around it — connect the watch to intervals.icu directly.
- Long runs are always generated easy. Measured against the corpus this matches
  71% of the coach's long runs; the remaining 29% are a shorter, separate
  pattern that the engine does not produce yet.
- The backtest calibrates VDOT to an engineering value rather than to the
  athlete's own race results.
