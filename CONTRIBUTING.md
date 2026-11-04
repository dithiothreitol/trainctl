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

Node ≥ 22.18 and pnpm 10 (the version is pinned in `packageManager`). Day to
day there is no build: the CLI and the MCP server run TypeScript directly
through Node's native type stripping, so what you edit is what runs. Publishing
is different — Node refuses to strip types under `node_modules`, so `pnpm build`
emits `dist/` and that is what the registry gets. `packaging.test.ts` guards the
manifests against pointing at `.ts` again. CI installs tarballs on Linux and
Windows, runs the multisport CLI scenarios from `node_modules`, and calls the
installed MCP process over stdio. Run the same check locally after building:

```
pnpm build
pnpm verify:distribution --online
```

Without `--online`, installation uses only the pnpm cache and fails if a dependency
is missing. The online option allows dependency downloads from npm; neither mode
publishes packages or connects to a training account. The check creates isolated
temporary directories and removes them on completion.

The installed CLI simulation has a 30-second deadline for each command and a
10-minute deadline for the full sequence. Dependency installation and individual
packaging steps retain their three-minute deadline. Timeout errors identify the
command before attempting to parse its JSON output.

The root development dependency `@garmin/fitsdk` is pinned for independent FIT
validation. `packages/export/src/fit-sdk.test.ts` checks decoded workout fields,
CRC handling and UTF-8 names with Garmin's decoder. The multisport simulation
also decodes every exported FIT file, both from source and from installed tarballs.

The pinned root development dependency `ical.js` independently parses ICS in
`ics-parser.test.ts`, calendar lifecycle tests, and both CLI simulations. These
parsers are test tools and do not become runtime dependencies of published packages.
To retain synthetic exports for a calendar or watch acceptance test, run:

```
pnpm simulate:multisport --artifacts
```

The command prints a new directory under ignored `artifacts/`. It contains ICS
versions before/after replacement, withdrawal and reactivation, FIT/HTML files,
source plans, a SHA-256 manifest and Polish instructions. Manual results start
as `pending`; parser success does not imply success on a particular device/client.

The test runner extends `TestRunner` from `vitest` through its public Runner API.
Before each attempt it awaits an empty `onTaskUpdate` round trip, allowing the
worker to receive reporting acknowledgements before another synchronous file
or CLI operation. A single `setImmediate` yield proved insufficient on Windows
with Node 22. Timeouts, assertions, snapshots and unhandled-error checks keep
their standard behavior; an empty update cannot mark any test as passed.

The suite includes seven cases that backtest the engine against a corpus
of real coaching plans; that corpus contains personal data and is not in the
repository, so without it the suite reports one skipped test in its place —
visible rather than silent.

## The packages

| package | what lives there |
|---|---|
| `trainctl-core` | the engine: zones, macro/microcycles, solver, adaptation, plan lint, both message catalogues for domain text |
| `trainctl` | the CLI: command handlers as pure `(cwd, args) → {output, code}` functions |
| `trainctl-mcp` | the MCP server — tools over those same handlers |
| `trainctl-export` | `.fit`, `.ics`, printable HTML, race-day pack |
| `trainctl-sync-intervalsicu` | the intervals.icu adapter |
| `trainctl-sync-files` | exported activity files (FIT, TCX, GPX) as a pull-only source |

The dependency arrow points one way: `core` knows nothing about the CLI, and the
MCP server imports only from `trainctl`. A command handler that formats its own
output with colours is a bug — handlers return semantic blocks
(`packages/cli/src/ui/blocks.ts`) and the CLI renderer adds the colour.

## The agent plugin

`plugin/` packages the MCP server for Claude Code and Codex (see
[docs/integrations/agents.md](docs/integrations/agents.md)). Its skills are
generated: after changing the `AGENTS.md` text in the CLI catalogues or
`packages/cli/src/plugin-skills.ts`, run `node tools/plugin/render-skills.ts`.
Versions are pinned in several places (packages, plugin manifests, MCP configs,
the check hook, CI examples); `node tools/release/bump-version.mjs <x.y.z>` moves
them together, and the tests fail when one is left behind.

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
