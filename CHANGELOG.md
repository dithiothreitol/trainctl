# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning: [SemVer](https://semver.org/). Below 1.0.0 the engine's output may
change between minor versions — a regenerated plan can differ.

## [Unreleased]

## [0.2.0] ? 2026-09-05

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
