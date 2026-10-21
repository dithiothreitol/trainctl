# Reviewed adaptation and time budgets

> **Since 0.4.0, `trainctl plan` keeps what you approved here.** Regenerating an
> existing plan changes only future days that are not logged, pinned, hand-edited,
> shortened by an approved proposal or over a saved time budget, and it keeps the
> approved volume baseline until you change `athlete.recentWeeklyKm` (ADR-033).
> `trainctl diff` shows the same regeneration without saving.

The CLI and MCP use the same operations. The examples below use a training
directory containing `trainctl.yaml` and a generated plan.

## Three coaching workflows

```sh
trainctl shorten --minutes 40
trainctl why
trainctl review --prepare
# Apply only the ID from the proposal you just reviewed:
trainctl adapt --apply <id>
```

`shorten` saves a single-session proposal for today; `--date YYYY-MM-DD` selects
another day. The time includes the plan's preparation allowance (15 minutes by
default), recoveries and any strength session. A tighter stored budget still
applies. Quality variants retain pace, warm-up, cool-down and complete recoveries
while reducing repetitions or distance. If the original purpose cannot fit,
the output explicitly labels an easy alternative and the lost purpose. The
engineering cutoffs are documented as E-1 in FOUNDATIONS; they do not promise
an equivalent physiological effect. Races, time trials, pinned, past and
recorded sessions are protected. If no variant fits, no proposal is saved.
`shorten --apply <id>` also accepts a previously reviewed proposal ID.

`why` starts with the actual session's purpose, goal race, phase, dose and nearby
demanding sessions, followed by calibration and rule provenance. It includes
execution status, time constraints and an approved shortening's tradeoff.
It identifies manual edits without inventing their intention. Shortening
metadata follows its workout when moved; time budgets remain attached to dates.

`review --prepare` combines the report and a saved future-plan diff in one call.
The default report covers seven dates **including** the reference date. For the
last completed Monday–Sunday week, pass that Sunday's date. Adaptation still
uses a 21-day window; when connected, review fetches at least those 21 days.
Unknown sessions stay unknown, completed shorter runs count as completed, and
RPE/notes stay available as context. Incomplete data or a hold-course decision
can legitimately produce no changes. A missing test result requests data rather
than producing a calibration-only timestamp change. Return/recovery protocols
still require individual review: their blocked preparation is reported, not
silently replaced with a volume patch.

Review data includes `period`, `execution`, `preparation.status` and `prepared`
(ID, changed dates and protected dates). Review without `--prepare` retains its
report-only behavior. Neither review mode applies a proposal. The same lifecycle
and expiration checks below cover both weekly and single-session proposals.

MCP: `trainctl_shorten({minutes: 40})`, `trainctl_why({})`,
`trainctl_review({prepare: true})`, then `trainctl_adapt({apply: "<id>"})`.
The agent should show the diff and tradeoffs before applying. New training
directories receive these recipes in their `AGENTS.md`; existing files are
preserved and can be updated manually.

## Evidence before recommendations

Missing activity records now mean **unknown**, not **missed**. A confirmed
`trainctl log --status skipped` entry marks a missed session. Cycling and
activities whose data is withheld never count as completed runs. The latest
journal correction takes precedence over synchronization, consistently in
`pull`, `review` and `adapt`.

`adapt` reports data completeness and the last synchronization date. Incomplete
execution data does not trigger a volume change or a layoff diagnosis. New race
results can still trigger recalibration. Refreshing a shorter date range keeps
older synchronized activities outside that range.

## Review a concrete change

```sh
trainctl adapt --date 2026-09-05
trainctl adapt --date 2026-09-05 --prepare
# Review the displayed sessions and plan/proposals/<id>.json, then:
trainctl adapt --apply <id>
```

`--prepare` saves a proposal without changing the active plan or athlete
profile. It includes the proposed future plan, the changed sessions, protected
dates, and the reasoning. `--apply` applies that exact saved proposal; it does
not calculate a new one. Changes to the plan, profile, journal or synchronization
snapshot invalidate the proposal. An edited proposal is also rejected.
Proposals also expire at the next local calendar day. Selecting a historical
analysis date never authorizes rewriting past sessions. Older proposals without
a creation-day marker must be prepared again.

Zone-only recalibration preserves workout structure and volume. A volume
correction is anchored in the first upcoming loading week, retaining phase dates
and relative deload/taper shape. The accepted baseline is recorded in `loadState`;
subsequent recalibration cannot restore the original profile's mileage. A
deliberate full `plan` regeneration still uses `trainctl.yaml`.

Past days, logged days, race days, pinned days and manually edited days remain
unchanged. Original generated-day checksums let the tool detect arbitrary YAML
edits, including manual moves and notes. Existing phase dates are preserved.
Protected sessions can keep a week above or below the proposed volume; inspect
the actual session changes and lint warnings before applying.

Applicable patches cover volume changes and recalibration. Post-race recovery
and return after a layoff remain proposals for an individual coaching decision;
`--prepare` does not manufacture a protocol for them. Changing the race goal
requires a deliberate full-plan comparison/regeneration. Older plans without
calibration metadata and generated-day checksums remain readable, but must be
deliberately regenerated before this workflow can prepare changes for them.

## Negotiate the time you actually have

```sh
trainctl reschedule --date 2026-09-07 --time 2026-09-10=35 --pin 2026-09-12 --preparation 10
# Same constraints, after reviewing the preview:
trainctl reschedule --date 2026-09-07 --time 2026-09-10=35 --pin 2026-09-12 --preparation 10 --apply
```

Budgets include estimated running time, recoveries between repetitions,
preparation and strength on the same day. They are scheduling estimates, not
promises about actual duration. The solver moves or drops whole sessions; it
does not compress workouts to fit. When different choices are possible, it
shows the alternative and its compromises. `--strategy long` protects the long
run; `--strategy quality` gives more weight to quality sessions.

Applied budgets and pins are stored in `plan/plan.yaml`. Remove a budget entry
or set a day's `pinned: false` there to release it. Pinned workouts that conflict
with a blocked day or time budget cause an error before the plan is written.
Strength conflicts are reported by the plan lint; strength is retained when
time or pin constraints prevent freely rebuilding its schedule.
A blocked day removes both running and strength, with a visible trade-off.
Manual `shift` also checks race dates, pins and budgets. Past or recorded days
cannot be shifted by either command.

Hill distance includes the return downhill; estimates include the final recovery
exported to the watch. Unknown race duration cannot satisfy a time budget. Daily
execution comparisons include race distance on both sides; training compliance
excludes races on both sides.

## Record the measured segment

```sh
# Whole session: 9 km in 54 minutes; measured 5 km test: 24 minutes.
trainctl log --date 2026-09-12 --km 9 --time 54:00 --test-time 24:00
trainctl adapt --date 2026-09-12
```

The result suggestion uses the test distance and `--test-time`. Without this
field it requests the measured time instead of reusing the whole-session time.
Review the measurement before adding it to `athlete.results`. The MCP argument
is `testTime`; it is valid only for completed test/race days.

## Resolve constraints explicitly

Multiple tune-ups in one week, or a tune-up during the main race taper, currently
require resolving the calendar before generation. They are reported as conflicts
rather than discarded. If availability prevents the requested taper frequency
or mileage, `check` reports the difference. Small budgets can replace an optional
quality session with easy running instead of forcing additional mileage.

## Trace the calibration

`trainctl why --date 2026-09-08` lists the results considered for calibration,
their age and VDOT, and why each was used or excluded. The selection policy
remains the best VDOT from the preceding 540 days. The policy is an explicit
heuristic, not a confidence score.

```yaml
athlete:
  results:
    - date: "2026-03-30"
      distanceKm: 10
      timeSec: 2400
      excluded: true
      exclusionReason: "Course was shorter than advertised"
```

Excluded results stay in the history but do not calibrate zones or predictions.
Adding, correcting, excluding or removing a result is detected against the
saved calibration history, including results entered after their actual race
date. `why` labels research interpretations, coaching-corpus rules and
engineering heuristics; unclassified references are explicitly marked.

## A workout page for your phone

```sh
trainctl export --what mobile --date 2026-09-08
```

Open `export/2026-09-08-mobile.html` on your phone. The standalone page contains
the session steps, time estimate, purpose, strength work and expandable
reasoning. It supports light/dark mode and works offline. It is a snapshot:
export it again after changing the plan. The interactive export menu includes
this format and supports rest/race days too.

## MCP results

All tools declare an output schema and return `structuredContent` containing
`code`, `output` and `data`, alongside compatible text output. The main read
operations expose workout/week facts, calibration and evidence. Adaptation
exposes execution completeness, actions and prepared changes; rescheduling
exposes both arrangements and time estimates. Tool annotations distinguish
read operations from operations that can write files or contact the sync hub.

MCP parameters mirror the CLI: `trainctl_adapt` accepts `prepare` and an `apply`
ID; `trainctl_reschedule` accepts `time`, `pin`, `preparation` and `strategy`;
`trainctl_export` accepts `what: "mobile"`. Preparation and application are
separate calls, with the runner reviewing the proposal between them.
