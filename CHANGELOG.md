# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning: [SemVer](https://semver.org/). Below 1.0.0 the engine's output may
change between minor versions — a regenerated plan can differ.

## [Unreleased]

Nothing yet.

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
