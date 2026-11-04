# trainctl for Codex

Plan running, cycling, swimming and multisport in a local training directory.
The plugin provides 21 training tools, a workspace selector and six skills: `coach`, `review`, `debrief`,
`shorten`, `replace` and `what-if`. Replacements work in all six directions;
the agent shows a proposal before applying it and can restore the original.

## Install a release bundle

Download `trainctl-codex-<version>.zip` from [GitHub Releases](https://github.com/dithiothreitol/trainctl/releases),
extract it to a permanent directory and follow `INSTALL.txt`. Node 22.18 or
newer must be on PATH. The bundle includes its dependencies; no npm download
is needed at startup.

## Build and install the current code

Requires Node **22.18.0 or newer** on PATH. From the repository:

```sh
pnpm install --frozen-lockfile
pnpm plugin:build
```

The command prints a new marketplace directory under `artifacts/trainctl-codex-*`.
It contains the plugin, its bundled CLI/MCP runtime and third-party licenses.
No npm packages are downloaded at startup; the bundle uses the current working
tree, including changes not yet published to npm. `plugin/runtime/build.json`
records the source digest and base commit. Building locally does not publish
a release.

```sh
codex plugin marketplace add /absolute/path/to/the/generated/marketplace
codex plugin add trainctl@trainctl-local
```

The second command is available in Codex CLI 0.153.4. Alternatively, select
`trainctl-local` in the Plugins Directory and install `trainctl`. Start a new
session after installing or refreshing the plugin.

Open Codex **in your training directory**. The agent first calls
`trainctl_workspace` with that absolute path. Codex starts local servers in the
plugin cache; training tools are blocked until a directory is selected. The
selection is fixed for the server session to keep credentials from different
directories separate. An explicit `TRAINCTL_DIR` can bind the directory at startup. The plugin contains no API keys or personal training data.
Core planning works offline; Intervals.icu synchronization needs its separate API key.

For a new, separate training directory, the bundled CLI can create a template:

```sh
node /path/to/plugin/scripts/trainctl.mjs -C /path/to/training init --sports run,bike,swim --template
node /path/to/plugin/scripts/trainctl.mjs -C /path/to/training plan
```

Edit the generated example profile before using it for your own training. Do not
also run `init --agent codex`: that configures a second MCP server using the npm release.

## Example requests

- “Show this week's sessions and totals for each sport.”
- “Propose replacing Tuesday's run with a bike session in 50 minutes, including preparation.”
- “Apply that proposal.” / “Propose restoring the original session.”
- “I swam for 25 minutes instead of the planned run. Record that without changing the historical plan.”
- “Export the workouts as FIT and show any unsupported features.”

## Verify the bundle

```sh
pnpm verify:plugin /path/to/generated/marketplace/plugin /path/to/new/evidence-directory
```

This copies the plugin to a temporary directory outside the repository, starts its
real CLI and MCP process, exercises every tool, reads resources and prompts, tests
all replacement directions and migration, and saves full transcripts. It does not
publish workouts to a real account. `push` is checked for a clean missing-credentials
error; provider success and partial-failure paths have separate automated tests.

## Package layout and development

`plugin.json` + `mcp.json` are the portable layout; `.codex-plugin/plugin.json` +
`codex.mcp.json` support compatible Codex clients. Both launch the same local runtime.
The generated Codex package excludes Claude hooks.

Skills are generated: edit `packages/cli/src/plugin-skills.ts` or the persona in
the CLI language catalogues, then run `node tools/plugin/render-skills.ts`.

The repository also retains a **Claude Code** manifest, hooks and `.mcp.json` for
the published npm version. That is a separate distribution path and does not
automatically include unpublished changes.

Official format references (checked 2026-11-04):
[Package your plugin](https://developers.openai.com/plugins/build/plugins),
[local MCP packaging](https://developers.openai.com/plugins/deploy/desktop-only).
