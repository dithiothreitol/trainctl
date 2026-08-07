# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning: [SemVer](https://semver.org/). Below 1.0.0 the engine's output may
change between minor versions — a regenerated plan can differ.

## [Unreleased]

Nothing yet.

## [0.1.0] — not released

Feature-complete for a first release; packaging and metadata prepared.

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
  on a git branch or in a copied directory and the diff shows goal, prediction
  and week-by-week changes before anything is decided.
- `AGENTS.md` teaches the agent to correlate sources it can see (calendar,
  issue tracker, on-call) with the training week — propose `reschedule` before
  a conflict, `desk --heavy` after a cognitively heavy day — always naming the
  signal and never applying without a yes.
- Export: `.fit` workouts (own encoder, verified against an independent parser),
  `.ics` calendar, A4 printout, race-day pack with splits and a paper pace band.
- intervals.icu sync: push planned sessions to the watch, pull execution and
  wellness, compare with the plan.
- English and Polish, with declension and locale-correct number formats.

### Known limits

- Activities that reach intervals.icu **through Strava** carry no data through
  its API. `trainctl` reports this explicitly rather than showing "0 runs", but
  cannot work around it — connect the watch to intervals.icu directly.
- Long runs are always generated easy. Measured against the corpus this matches
  71% of the coach's long runs; the remaining 29% are a shorter, separate
  pattern that the engine does not produce yet.
- The backtest calibrates VDOT to an engineering value rather than to the
  athlete's own race results.
