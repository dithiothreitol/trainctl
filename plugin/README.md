# trainctl plugin

A running coach as your agent's tool, packaged for Claude Code and Codex: the
[trainctl](https://github.com/dithiothreitol/trainctl) MCP server, the coach
persona and task skills, and (Claude Code) hooks that load the coach
instructions and lint the plan after edits.

```text
/plugin marketplace add dithiothreitol/trainctl     # Claude Code
/plugin install trainctl@trainctl

codex plugin marketplace add dithiothreitol/trainctl   # Codex, then /plugins
```

Requires Node ≥ 22.18. The training directory itself is created with
`npx trainctl init`. Layout, limits and development notes:
[docs/integrations/agents.md](../docs/integrations/agents.md).

`skills/` is generated — edit `packages/cli/src/plugin-skills.ts` (or the
AGENTS.md text in the CLI catalogues) and run `node tools/plugin/render-skills.ts`.

MIT
