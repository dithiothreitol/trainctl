# Reviewed adaptation and time budgets

The CLI and MCP use the same operations. The examples below use a training
directory containing `trainctl.yaml` and a generated plan.

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
