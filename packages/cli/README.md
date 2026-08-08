# trainctl

A running coach that lives in your terminal: a plan-generating engine with a
**CLI + MCP** interface. Your plan is code in a git repo, and your agent
(Claude Code, Codex, any MCP client) gets the coach as a tool.

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
| `check` | lint your plan: engine invariants + file integrity, with rule IDs |

## Requirements

**Node ≥ 22.18.** The package ships compiled JavaScript together with the
TypeScript sources and source maps it was built from.

For sync: an [intervals.icu](https://intervals.icu) account and an API key
(Settings → Developer Settings), given through `TRAINCTL_INTERVALS_API_KEY`, a
`.env` file or `.trainctl-secret` — never through `trainctl.yaml`, which belongs
in your repository.

> Your watch must connect to intervals.icu **directly**, not through Strava:
> since December 2024 intervals.icu does not pass Strava-sourced activities
> through its API. `trainctl` says so explicitly instead of reporting "0 runs".

## Where it refuses

No injury-risk score (ACWR and the 10% rule do not hold up in the literature),
no readiness from HRV, and no silent edits to your own plan — `adapt` returns
proposals, and applying them is a diff you approve.

English and Polish, both first-class.

Full documentation, the science behind each rule and the architecture:
**https://github.com/dithiothreitol/trainctl**

MIT
