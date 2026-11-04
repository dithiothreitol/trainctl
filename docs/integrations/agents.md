# trainctl in Claude Code and Codex

The coach reaches an agent in three layers. The **MCP server** (`trainctl-mcp`)
gives it the tools, resources and prompts. **`AGENTS.md`** in the training
directory tells it how to behave like a coach. The **plugin** bundles both for
one-step installation, adds task skills and, in Claude Code, two hooks.

Facts about both agents below were checked against their documentation on
2026-10-21; plugin systems change quickly, so the date matters.

## Claude Code

```text
/plugin marketplace add dithiothreitol/trainctl
/plugin install trainctl@trainctl
```

The repository is its own marketplace (`.claude-plugin/marketplace.json` points
at `plugin/`). Once installed, in every session where the plugin is enabled:

| part | what it does |
|---|---|
| MCP server | `npx -y trainctl-mcp@<version>` with `TRAINCTL_DIR` set to the project directory |
| skill `coach` | the coach persona — the same text `trainctl init` writes as `AGENTS.md` |
| skills `/trainctl:review`, `/trainctl:debrief`, `/trainctl:shorten`, `/trainctl:what-if` | one ritual each: which tool, what to show, what not to do |
| hook `SessionStart` | in a directory with `trainctl.yaml`, puts its `AGENTS.md` into context (Claude Code does not read `AGENTS.md` by itself); elsewhere it stays silent |
| hook `PostToolUse` on `Edit\|Write` | after an edit of `plan/plan.yaml`, runs `trainctl check`: errors reach the agent as a blocking message, warnings as added context |

**Enabling it for a training repository.** `trainctl init --agent claude` writes
`.claude/settings.json` with `extraKnownMarketplaces` and `enabledPlugins`.
Whoever clones the repository and trusts the folder is offered the plugin;
it still has to be installed once per machine.

**Limits.**

- A plugin cannot enable itself only in some directories. The hooks check for
  `trainctl.yaml` and stay silent elsewhere; the MCP tools are available in every
  session where the plugin is enabled, and answer "run trainctl init" outside a
  training directory.
- The `PostToolUse` hook sees edits made through Claude's Edit and Write tools,
  not files rewritten by a shell command or another program.
- The hook runs `npx -y trainctl@<version>`; the first run downloads the package.
  Offline, the hook stays silent rather than blocking the edit.
- Anthropic's official marketplace does not take submissions; this repository is
  the marketplace.

Without the plugin, the server alone:

```bash
claude mcp add trainctl --env TRAINCTL_DIR="/path/to/my-training" -- npx -y trainctl-mcp
```

Do not combine that with the plugin — two servers would expose the same tools twice.

## Codex

Codex reads `AGENTS.md` natively, so the persona needs nothing extra. For the
tools, pick **one** of:

- **`trainctl init --agent codex`** writes `.codex/config.toml` with an
  `[mcp_servers.trainctl]` entry. Codex loads project configuration only after
  you trust the project. If the tools report the wrong directory, set
  `env = { TRAINCTL_DIR = "/absolute/path" }` in that entry.
- **The current local plugin**: run `pnpm plugin:build` in this repository,
  register the generated marketplace with `codex plugin marketplace add <path>`,
  then `codex plugin add trainctl@trainctl-local` (tested with CLI 0.153.4), or
  install it from the Plugins Directory. It bundles the current CLI/MCP and its
  dependencies, so startup needs no npm download. Ready bundles are attached to GitHub Releases.
  Start a new session in your training directory, or set `TRAINCTL_DIR`.
  See [build, installation and examples](../../plugin/README.md).
  The generated Codex package has no lifecycle hooks. The local source tree needs
  a build before installation; the Git marketplace alone does not supply the runtime.

## Working on the plugin

```bash
node tools/plugin/render-skills.ts            # after changing AGENTS.md or a skill
claude --plugin-dir ./plugin                   # try it without installing
TRAINCTL_PLUGIN_CLI=packages/cli/src/bin.ts   # make the check hook use your working tree
node tools/release/bump-version.mjs 0.5.0      # versions of packages, plugin, hooks and examples together
```

`plugin.test.ts` fails when the skills drift from their source, when a skill
mentions a tool the server does not register, or when any pinned version differs
from the packages.
