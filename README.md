# trainctl

[![CI](https://github.com/dithiothreitol/trainctl/actions/workflows/ci.yml/badge.svg)](https://github.com/dithiothreitol/trainctl/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%E2%89%A5%2022.18-brightgreen.svg)](package.json)

**A running coach that lives in your terminal.** A plan-generating engine with a
CLI and an MCP server: your training plan is a YAML file in a git repository,
every session cites the research behind it, and your agent (Claude Code, Codex,
any MCP client) gets the coach as a tool.

```console
$ trainctl today
2026-08-04 · Tuesday
week 1/17 · base · 117 days to race
────────────────────────────
╭─ intervals · 8 km ───────────────────────────────────────────────────────────
│ 3 km warm-up + 4 × 1 km @ 4:32/km, 2 min walk recovery. 1 km cool-down jog
│ to finish.
╰──────────────────────────────────────────────────────────────────────────────
→ why this session: trainctl why --date 2026-08-04
```

No account, no database, no backend. Everything is files in the current
directory — `trainctl.yaml`, `plan/`, `log.jsonl` — so the history of your
training is your git history.

*Polska wersja: [README.pl.md](README.pl.md).*

---

**Contents** · [Install](#install) · [Quick start](#quick-start) ·
[The daily loop](#the-daily-loop) · [Commands](#commands) ·
[Configuration](#configuration) · [Plan as code](#plan-as-code) ·
[Agent (MCP)](#agent-mcp) · [Watch sync and export](#watch-sync-and-export) ·
[Language](#language) · [How it decides](#how-it-decides) ·
[Where it refuses](#where-it-refuses) · [FAQ](#faq) ·
[Development](#development)

---

## Install

```bash
npx trainctl init          # no install at all
# or
npm install -g trainctl    # then just: trainctl
```

**Node ≥ 22.18** is the only requirement. The package ships compiled JavaScript
next to its TypeScript sources and source maps, so a stack trace still points at
readable code — Node refuses to strip types under `node_modules`, which is why
0.1.0 was replaced by 0.1.1.

## Quick start

**1 · Make a training directory and a profile.**

```bash
mkdir my-training && cd my-training && git init
trainctl init              # interactive wizard
trainctl init --template   # or: write trainctl.yaml and edit it yourself
```

`init` also drops an `AGENTS.md` into the directory (coach instructions for your
agent) and adds `.env`, `.env.*` and `.trainctl-secret` to `.gitignore` — the
places an API key is allowed to live.

**2 · Fill in the profile.** The minimum is your recent volume, the days you can
train, and **one race result** — zones come from races, never from a watch's
threshold estimate:

```yaml
athlete:
  recentWeeklyKm: 45          # average of the last ~4 weeks
  peakWeeklyKm: 65            # highest volume you have held (optional)
  daysAvailable: [tue, wed, thu, sat, sun]
  longRunDay: sat
  results:
    - { date: "2026-03-29", distanceKm: 10, timeSec: 2580, name: "Spring 10K" }
goal:
  name: "Half marathon"
  date: "2026-11-29"
  distanceKm: 21.0975
  priority: A
```

**3 · Generate the plan.**

```console
$ trainctl plan
Half marathon · 21.0975 km
2026-11-29 · 17 weeks of plan
──────────────────────────────────
Volume peak                    52 km/week
Recommended for this distance  42 km/week
VDOT                           47.7 (from a race result)

╭─ Predicted finish ───────────────────────────────────────────────────────────
│ 1:32:24 – 1:38:07 (method: vdot)
│ Always a range, never a single number (W-1).
╰──────────────────────────────────────────────────────────────────────────────

Structure
• base: weeks 1–6
• build: weeks 7–12
• peak: weeks 13–15
• taper: weeks 16–16
• race week: weeks 17–17

✓ Saved plan/plan.yaml + plan/PLAN.md
→ trainctl today · trainctl week · trainctl why
```

`plan/plan.yaml` is the source of truth — machine-readable, hand-editable.
`plan/PLAN.md` is the same plan rendered for humans, so GitHub shows a readable
table on the repo page.

**4 · Commit it.**

```bash
git add -A && git commit -m "training plan: half marathon, 29 Nov"
```

From here the plan behaves like any other code: branches, diffs, review, CI.

## The daily loop

```console
$ trainctl week
Week 1/17 · from 2026-08-03
base (pyramidal) · target 49 km · planned 41 km
───────────────────────────────────
DAY  DATE   KM     WORKOUT
Mon  08-03  —      rest
Tue  08-04  8 km   3 km warm-up + 4 × 1 km @ 4:32/km, 2 min walk recovery. 1
                   km cool-down jog to finish.
Wed  08-05  —      rest
Thu  08-06  9 km   5 km easy + hills: 15 × 200 m (relaxed). 1 km cool-down jog
                   to finish.
Fri  08-07  —      rest
Sat  08-08  17 km  17 km very easy.
Sun  08-09  7 km   3 km warm-up + 3 km progression run (5:01 → 4:32/km). 1 km
                   cool-down jog to finish.
```

**Ask why, before you trust it.** Every session carries its purpose and the rule
IDs behind it:

```console
$ trainctl why --date 2026-08-04
Why this session · 2026-08-04
phase: base (pyramidal)
─────────────────────────────────────
╭─ intervals ──────────────────────────────────────────────────────────────────
│ Interval session — the stimulus follows the phase: around threshold
│ (pyramidal) or VO₂max (polarized).
╰──────────────────────────────────────────────────────────────────────────────

Rules
• I-1 — base/build: a pyramidal distribution — plenty of easy running, accents
  around threshold (Casado 2022; Knopp 2024)
• I-7 — ≥48 h between quality sessions — the hard day / easy day principle
  (Casado 2022)
• I-8 — two accents a week at ≥4 sessions, one at 3 (Casado 2022)
• P-1 — load undulates rather than climbing in a line — undulating progression
  gave +22% VO₂max vs +11% linear (RCT Costa 2019)

→ sources and parameters: docs/science/FOUNDATIONS.md §10
```

**Record what actually happened.**

```bash
trainctl log --km 8 --time 41:20 --note "felt good"
trainctl log --date 2026-08-06 --status skipped --note "work"
```

**Renegotiate the week when life gets in the way.** `shift` swaps two sessions;
`reschedule` re-solves the whole week around days you cannot train, and says out
loud what it sacrificed:

```console
$ trainctl reschedule --block 2026-08-06 2026-08-08
Week renegotiation · from 2026-08-03
blocked: 2026-08-06, 2026-08-08
────────────────────────────────────────────
DAY  DATE   BEFORE     AFTER
Mon  08-03  —          —
Tue  08-04  intervals  intervals
Wed  08-05  —          long run
Thu  08-06  hills      —
Fri  08-07  —          —
Sat  08-08  long run   —
Sun  08-09  tempo      tempo

What changes
• long: 2026-08-08 → 2026-08-05
• dropped: easy_hills from 2026-08-06 — ran out of days — an easy session costs
  least (volume, not stimulus)
• trade-off: long run outside its preferred day (Wednesday)
⚠ We do not make up the dropped kilometres on the following days — piling volume
  on after a missed session works against the progression (P-1/P-3).

→ this is a preview; apply with: trainctl reschedule --apply (same --block)
```

Nothing is written until you pass `--apply` — and then it is a diff you can read
before committing.

**Once a week, take stock.** `trainctl review` is the Monday ritual in one call:
what you did, what it means, what is ahead (it pulls from intervals.icu first if
a key is configured). `trainctl adapt` compares execution with the plan and
*proposes* corrections; it never rewrites the plan behind your back.

## Commands

| command | what it does | key flags |
|---|---|---|
| `init` | profile wizard | `--template`, `--from-intervals` |
| `plan` | generate the plan from `trainctl.yaml` | `--date` |
| `today` | the session for today | `--date` |
| `week` | the week, with journal status | `--date`, `-i` (arrow-key browsing) |
| `why` | purpose + research rules behind a session | `--date` |
| `log` | record a completed session | `--status`, `--km`, `--time`, `--note` |
| `shift` | swap two sessions inside a week | `--from`, `--to` (or pick from a list) |
| `reschedule` | re-solve the week around busy days | `--block <dates…>`, `--apply` |
| `adapt` | analyse execution, propose corrections | `--date` |
| `review` | pull + adapt + week in one call | `--days` |
| `desk` | training windows around office hours | `--heavy` |
| `push` | send planned sessions to intervals.icu | `--days`, `--from`, `--to` |
| `pull` | fetch activities and wellness, compare | `--days` |
| `export` | `.fit`, `.ics`, printout, race pack | `--what`, `--date` |
| `diff` | what a regeneration would change | `--plan <file>` |
| `check` | lint the plan; fails the exit code | `--strict` |

`--lang en|pl` works on every command. `trainctl help <command>` prints the full
flag list.

## Configuration

`trainctl.yaml` is the whole configuration — one file, in your repository.
`trainctl init --template` writes it with comments; every key it supports:

```yaml
# language: pl              # interface and plan language: en | pl (default: en)
athlete:
  sex: unspecified          # male | female | unspecified
  recentWeeklyKm: 45        # average of the last ~4 weeks
  peakWeeklyKm: 65          # highest volume you have held (optional)
  daysAvailable: [tue, wed, thu, sat, sun]
  longRunDay: sat
  results:                  # zone calibration — from races, not from a watch
    - { date: "2026-03-29", distanceKm: 10, timeSec: 2580, name: "Spring 10K" }
  tuneUpRaces:              # races on the way: B = mini-taper, C = run through
    - { date: "2026-09-19", distanceKm: 10, name: "Autumn 10K", priority: B }
goal:
  name: "Half marathon"
  date: "2026-11-29"
  distanceKm: 21.0975
  priority: A
  targetTimeSec: 5700       # optional — plan will judge how realistic it is
desk:                       # for trainctl desk (optional)
  workStart: "09:00"
  workEnd: "17:00"
  lunchMinutes: 45
  prefer: evening           # morning | lunch | evening
strength:                   # optional strength track, 2×/week
  enabled: true
  days: [mon, fri]          # optional preference
```

A few consequences worth knowing:

- **`results` drives everything.** Without a race result there is no VDOT and no
  zones; with a `targetTimeSec` but no result, `plan` will use the goal to
  derive zones and say clearly that it needs recalibration.
- **`tuneUpRaces` are treated as races, not as workouts**: mini-taper before a
  B race, an easy day before it, the long run the day after, and no extra accent
  in that week.
- **`strength` is a separate track**, not a running session: it adds no
  kilometres, disappears during the taper, and never lands the day before a hard
  session. The justification is running economy — *not* injury prevention; see
  [Where it refuses](#where-it-refuses).

The intervals.icu API key never goes in this file. Use
`TRAINCTL_INTERVALS_API_KEY`, a `.env` file or `.trainctl-secret`; an explicit
environment variable wins over a file.

## Plan as code

The plan is a YAML file in a git repository — and that changes what a plan can
do, not just where it is stored.

**What-if branches.** A scenario lives on a branch or in a copied directory:
change the race date *there*, regenerate *there*, then compare before you decide.

```bash
git switch -c what-if-december
sed -i 's/2026-11-29/2026-12-20/' trainctl.yaml && trainctl plan
git switch main
git show what-if-december:plan/plan.yaml > /tmp/scenario.yaml
trainctl diff --plan /tmp/scenario.yaml
```

```console
Differences: current plan → /tmp/scenario.yaml
──────────────────────────────────────────────────────────────────────────────
• goal: Half marathon, 21.1 km, 2026-11-29 → Half marathon, 21.1 km, 2026-12-20
• ~ 2026-11-01: quality_continuous — same volume, different segments
• ~ week 2026-11-23: total of the days 16 → 52 km
• ~ 2026-11-24: easy → quality_intervals
• ~ 2026-11-29: race → long
• + week 2026-11-30: new (52 km)
• + week 2026-12-14: new (26 km)
```

Three extra weeks of build, a taper that lands three weeks later, and the race
day that is no longer a race — all before anything is decided.

**CI on your own training.** `trainctl check` lints the plan against the
engine's invariants — 48 h between accents, taper shape, strength adjacency,
≥75% easy volume — plus the file's internal consistency, each finding with its
rule ID:

```console
$ trainctl check
✓ No issues: 17 weeks and 66 sessions hold every invariant.

$ trainctl check --strict     # in CI: warnings fail too, exit code 1
Plan lint
invariants and file integrity, checked against plan/plan.yaml
─────────────────

Rule deviations
⚠ 2026-08-04 → 2026-08-05: intervals and tempo less than 48 h apart [I-7]

0 errors, 1 warning
strict mode: warnings count as failures
```

Errors always fail the exit code; warnings only under `--strict`. A ready
workflow: [docs/examples/ci-check.md](docs/examples/ci-check.md).

**A human coach as reviewer.** Week changes are diffs, so a coach can review
them the way engineers review code — comment on a line, approve, merge. Example:
[docs/examples/coach-review.md](docs/examples/coach-review.md).

**Reproducibility.** The same `trainctl.yaml` and the same engine version
produce the same plan — in five years too. Nothing drifts under you and no
backend can shut down; pin the version in your training repo and every session
stays explainable: a rule ID in the plan, a commit in the history.

## Agent (MCP)

The same engine as tools for an agent, so the interface becomes conversation:
*"what am I running today?"*, *"release on Thursday — move the intervals"*,
*"how did last week go?"*

```bash
claude mcp add trainctl --env TRAINCTL_DIR="/path/to/my-training" \
  -- npx -y trainctl-mcp
```

Any MCP client works — the generic form:

```json
{
  "mcpServers": {
    "trainctl": {
      "command": "npx",
      "args": ["-y", "trainctl-mcp"],
      "env": { "TRAINCTL_DIR": "/path/to/my-training" }
    }
  }
}
```

Sixteen tools over the same handlers the CLI uses, so the agent and your
terminal can never disagree: `trainctl_plan`, `trainctl_today`, `trainctl_week`,
`trainctl_log`, `trainctl_shift`, `trainctl_why`, `trainctl_diff`,
`trainctl_check`, `trainctl_init`, `trainctl_push`, `trainctl_pull`,
`trainctl_adapt`, `trainctl_desk`, `trainctl_reschedule`, `trainctl_export`,
`trainctl_review`.

The `AGENTS.md` written by `trainctl init` turns the agent into a coach rather
than a command runner: ask before regenerating a plan, ask for context when a
week was missed, correlate what it can see (calendar, tracker, on-call) with the
training week — and never invent numbers.

## Watch sync and export

**Sync** goes through [intervals.icu](https://intervals.icu) as the hub, which
forwards to Garmin, Coros and Wahoo:

```bash
export TRAINCTL_INTERVALS_API_KEY=...   # Settings → Developer Settings
trainctl push --days 14                 # plan → intervals.icu calendar → watch
trainctl pull --days 28                 # execution + wellness → compared with the plan
```

`push` only ever touches entries it created itself (they carry a `trainctl-`
external id), so your own calendar entries stay yours.

> **Connect your watch to intervals.icu directly** (Settings → Connections), not
> through Strava. Since December 2024 intervals.icu does not pass Strava-sourced
> activities through its API, so `pull` receives records with no distance and no
> type. `trainctl` says so explicitly instead of reporting "0 runs" — but it
> cannot work around it. Details:
> [docs/integrations/intervalsicu.md](docs/integrations/intervalsicu.md) §1.8.1.

**Export** covers the offline paths:

```bash
trainctl export --what plan       # .fit workouts → GARMIN/Workouts over a cable
trainctl export --what workout --date 2026-08-04
trainctl export --what calendar   # .ics → Google Calendar, Outlook, phone
trainctl export --what print      # A4 sheet with a tick box per session
trainctl export --what race       # race pack: splits, paper pace band, heat table
```

The FIT encoder is written here rather than pulled in as a dependency; the files
are checked byte by byte in tests and were confirmed by uploading them to an
independent parser.

## Language

English by default, Polish as a full second language:

```bash
trainctl today --lang pl            # once
export TRAINCTL_LANG=pl             # for the session
trainctl init --lang pl             # writes `language: pl` into trainctl.yaml
```

Flag beats variable, variable beats the file. Polish is not a translation:
session descriptions carry the corpus coach's voice, with proper declension and
decimal commas, while English reads like a natively written plan. Everything a
human or an agent sees is bilingual — command output, `--help`, `plan/PLAN.md`,
the config template, `AGENTS.md`, rule explanations, MCP tool descriptions, FIT
workout steps, the printout and the race pack.

## How it decides

Two sources, deliberately kept apart.

**Published research.** Every engine rule carries an ID from
[docs/science/FOUNDATIONS.md](docs/science/FOUNDATIONS.md) (~60 sources), and
`trainctl why` quotes them at you. Values with no source behind them are marked
in the code as engineering choices rather than dressed up as science — and where
the evidence is thin, `why` says so: strength work is justified by running
economy, **not** injury prevention, because the only meta-analysis on runners
came out non-significant.

**A corpus of 50 real coaching plans** (2020–2025, one coach, ~1300 days). It
sets the house style — session shapes, warm-up and cool-down lengths, which days
carry accents. It has also *refuted* assumptions more than once: the coach never
scheduled a time trial in 1231 days, which changed how calibration works; and
measuring long runs removed a solver penalty that was pushing plans away from
what the coach actually does. The corpus contains personal data and is **not**
distributed.

## Where it refuses

Three things the engine will not compute, each for a documented reason:

- **Injury risk.** The load metrics used for it — ACWR, the 10% rule, "+30% is
  dangerous" — do not hold up in the literature (FOUNDATIONS N-1…N-3). A number
  here would be invented, so there is none.
- **Readiness from HRV.** The performance advantage comes out at SMD 0.20 with
  the interval crossing zero (FOUNDATIONS §8). Zones come from race results
  instead.
- **Its own plan, silently.** `adapt` returns proposals; applying them means
  editing `trainctl.yaml` and regenerating, so the change is a diff you approved.

It also refuses rather than guesses: below 4 active weeks of history it will not
infer a profile, above 25 °C it will not predict a heat penalty, and with no race
result it will not calibrate zones from watch readings.

## FAQ

**Is this a training plan generator or a coach?** A generator with a coach's
manners: it explains, warns and negotiates, but it never applies a change to
your plan without you.

**Can I edit `plan/plan.yaml` by hand?** Yes — that is the point of plan-as-code.
Run `trainctl check` afterwards; it verifies the invariants the generator
guarantees and tells you what a hand edit broke.

**Do I need intervals.icu?** No. Everything except `push`/`pull`/`review` works
offline; export covers watch, calendar and paper.

**Does it support cycling, swimming, triathlon?** No. The engine is built for
running; the domain model was designed with other sports in mind, but nothing
else is implemented.

**Is my training data sent anywhere?** No. One outbound host, intervals.icu, and
only when you ask for it. No telemetry. See [SECURITY.md](SECURITY.md).

**Is this medical advice?** No. It is a training plan, and it says where the
evidence is thin instead of pretending it is not.

## Development

```bash
pnpm install
pnpm check       # typecheck + tests — what CI runs
```

552 tests. Seven of them backtest the engine against the coaching corpus, which
is not distributed; without it that suite reports itself as one skipped test
rather than quietly disappearing.

Five packages: `trainctl` (CLI), `trainctl-core` (engine), `trainctl-mcp`,
`trainctl-export`, `trainctl-sync-intervalsicu`. Development runs straight from
TypeScript (Node's type stripping); `pnpm build` emits the `dist/` that gets
published.

Architecture, phases and the ADR table: [SPEC.md](SPEC.md). How to contribute and
what a change to an engine rule needs to carry:
[CONTRIBUTING.md](CONTRIBUTING.md). Reporting a vulnerability:
[SECURITY.md](SECURITY.md).

## Licence

MIT — see [LICENSE](LICENSE).
