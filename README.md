# trainctl

A running coach that lives in your terminal: a plan-generating engine with a
**CLI + MCP** interface. Your plan is code in a git repo, and your agent
(Claude Code, Codex, any MCP client) gets the coach as a tool.

*Polska wersja tego dokumentu: [README.pl.md](README.pl.md).*

## What it does

```
mkdir my-training && cd my-training && git init   # plan-as-code: a git repo
npx trainctl init          # profile wizard (--template writes the file only)
npx trainctl plan          # → plan/plan.yaml + plan/PLAN.md + a finish prediction
npx trainctl today         # what to run today
npx trainctl why           # why this session: its purpose and the rules behind it
npx trainctl reschedule --block 2026-08-06 --apply   # "release on Thursday"
npx trainctl review        # the Monday ritual: what happened, what is ahead
```

Everything lives in files in the current directory — `trainctl.yaml`, `plan/`,
`log.jsonl`. No account, no database, no backend. Your plan's history is your
git history.

| command | what it does |
|---|---|
| `init` | profile wizard; `--from-intervals` proposes one from 16 weeks of history |
| `plan` | generate the plan; judges whether your time goal is realistic |
| `today` / `week` | the session for today / the week, with journal status |
| `why` | physiological purpose + the research rules behind the session |
| `log` | record what you actually did |
| `shift` / `reschedule` | move one session / re-solve the whole week around busy days |
| `adapt` | compare execution with the plan, propose corrections |
| `review` | one call instead of pull + adapt + week |
| `push` / `pull` | sync with intervals.icu (→ Garmin/Coros/Wahoo) |
| `export` | `.fit` for the watch, `.ics` calendar, A4 printout, race-day pack |
| `desk` | training windows around office hours; the pace-over-feel rule |
| `diff` | what a regeneration would change — before it changes it |

## Requirements

- **Node ≥ 22.18.** There is no build step: the CLI runs TypeScript through
  Node's native type stripping.
- For sync: an [intervals.icu](https://intervals.icu) account and an API key
  (Settings → Developer Settings).

> **Your watch must connect to intervals.icu directly** (Settings →
> Connections), not through Strava. Since December 2024 intervals.icu does not
> pass Strava-sourced activities through its API, so `pull` receives records
> with no distance and no type. `trainctl` says so explicitly instead of
> reporting "0 runs" — but it cannot work around it. Details:
> [docs/integrations/intervalsicu.md](docs/integrations/intervalsicu.md) §1.8.1.

The API key never goes into `trainctl.yaml` — that file is in your repo. Use
the `TRAINCTL_INTERVALS_API_KEY` environment variable, a `.env` file, or
`.trainctl-secret`. `trainctl init` adds all of those to `.gitignore`, and if a
secret ever sits unprotected in a git repo the CLI says so on every run.

## How it decides

Two sources, kept separate on purpose.

**Published research.** Every engine rule carries an ID from
[docs/science/FOUNDATIONS.md](docs/science/FOUNDATIONS.md) (~60 sources), and
`trainctl why` quotes them at you. Values with no source behind them are marked
in the code as engineering choices rather than dressed up as science — and
where the evidence is thin, `why` says so: strength work is justified by
running economy, **not** injury prevention, because the only meta-analysis on
runners came out non-significant.

**A corpus of 50 real coaching plans** (2020–2025, one coach, ~1300 days). It
sets the house style — session shapes, warm-up and cool-down lengths, which
days carry accents. It has also *refuted* assumptions more than once: the coach
never once scheduled a time trial in 1231 days, which changed how calibration
works; and measuring long runs removed a solver penalty that was pushing plans
away from what the coach actually does.

The corpus itself contains personal data and is **not** distributed.

## Agent (MCP)

```
claude mcp add trainctl --env TRAINCTL_DIR="/path/to/my-training" ^
  -- npx -y trainctl-mcp
```

Fifteen tools (`trainctl_plan`, `trainctl_today`, `trainctl_week`,
`trainctl_shift`, `trainctl_why`, `trainctl_review`, …). `trainctl init` leaves
an `AGENTS.md` in your training directory that turns the agent into a coach
rather than a command runner: ask before regenerating a plan, ask for context
when a week was missed, never invent numbers.

## Language

English by default, Polish available:

```
trainctl today --lang pl
export TRAINCTL_LANG=pl
trainctl init --lang pl      # writes `language: pl` into trainctl.yaml
```

Polish is not a translation of the English — session descriptions carry the
corpus coach's voice, with proper declension and decimal commas. English reads
like a natively written plan.

## Where the engine refuses

Three things it will not compute, each for a documented reason:

- **Injury risk.** The load metrics used for it — ACWR, the 10% rule, "+30% is
  dangerous" — do not hold up in the literature (FOUNDATIONS N-1…N-3). A number
  here would be invented, so there is none.
- **Readiness from HRV.** The performance advantage comes out at SMD 0.20 with
  the interval crossing zero (FOUNDATIONS §8). Zones come from race results
  instead.
- **Its own plan, silently.** `adapt` returns proposals; applying them means
  editing `trainctl.yaml` and regenerating, so the change is a diff you
  approved.

It also refuses rather than guesses: below 4 active weeks of history it will
not infer a profile, above 25 °C it will not predict a heat penalty, and with
no race result it will not calibrate zones from watch readings.

## Development

```
pnpm install
pnpm test        # 496 tests
pnpm typecheck
```

Architecture, phases and decisions: [SPEC.md](SPEC.md). Engine rules reference
IDs from FOUNDATIONS §10 (`P-2`, `T-5`, `W-7`, …).

## Licence

MIT — see [LICENSE](LICENSE).
