# Contributing

Bug reports, engine corrections and translations are all welcome. This file is
the short version of how the repository works; the long version — architecture,
phases, decisions — is in [SPEC.md](SPEC.md).

## Getting set up

```
pnpm install
pnpm check        # typecheck + tests, what CI runs
pnpm test         # vitest only
pnpm trainctl --help   # run the CLI from source
```

Node ≥ 22.18 and pnpm 10 (the version is pinned in `packageManager`). There is
no build step: the CLI and the MCP server run TypeScript through Node's native
type stripping, so what you edit is what ships.

The full suite is 544 tests. Seven of them backtest the engine against a corpus
of real coaching plans; that corpus contains personal data and is not in the
repository, so without it the suite reports one skipped test in its place —
visible rather than silent.

## The packages

| package | what lives there |
|---|---|
| `trainctl-core` | the engine: zones, macro/microcycles, solver, adaptation, plan lint, both message catalogues for domain text |
| `trainctl` | the CLI: command handlers as pure `(cwd, args) → {output, code}` functions |
| `trainctl-mcp` | the MCP server — 16 tools over those same handlers |
| `trainctl-export` | `.fit`, `.ics`, printable HTML, race-day pack |
| `trainctl-sync-intervalsicu` | the intervals.icu adapter |

The dependency arrow points one way: `core` knows nothing about the CLI, and the
MCP server imports only from `trainctl`. A command handler that formats its own
output with colours is a bug — handlers return semantic blocks
(`packages/cli/src/ui/blocks.ts`) and the CLI renderer adds the colour.

## What a change needs

**Engine rules need a source.** Every rule carries an ID from
[docs/science/FOUNDATIONS.md](docs/science/FOUNDATIONS.md) §10, and `trainctl why`
quotes it back at the runner. If a value has no evidence behind it, mark it in
the code as an engineering choice instead of dressing it up as science — the
repository already does this in several places, and it is the reason the tool
can be trusted about the places where the evidence is thin.

**Both languages, always.** User-facing text lives in the catalogues
(`packages/core/src/i18n/` for domain text, `packages/cli/src/i18n/` for the
interface), never inline in a handler. Two tests enforce it: one compares the
key sets and argument counts of the English and Polish catalogues, another runs
every command in English and fails if a Polish phrase leaks into the output,
`PLAN.md`, an export file or an MCP tool description. Polish is not a
translation — it carries the corpus coach's voice, with declension and decimal
commas.

**Tests come with the change.** A fix carries a test that fails without it. The
repository's own history is the argument: the plan lint added in 0.1.0 promptly
found a real bug in `reschedule --apply`.

**Never commit** corpus files, personal training data, API keys, or real output
from `trainctl init --from-intervals`.

## Commits and pull requests

Conventional Commits (`feat(check): …`, `fix(diff): …`, `docs(spec): …`). The
existing history is written in Polish; English is equally welcome — pick one and
be consistent within a commit. Keep the subject line about what changed for the
user, and use the body for why.

Open the pull request against `main`. CI runs typecheck and tests on Linux and
Windows, on Node 22.18 and 24.

## Where decisions live

SPEC.md holds a numbered ADR table — read it before proposing something
structural. Several likely questions are already answered there: why there is no
database, why there is no build step, why `adapt` proposes rather than applies.
