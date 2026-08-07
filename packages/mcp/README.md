# trainctl-mcp

The [trainctl](https://www.npmjs.com/package/trainctl) running coach as MCP
tools, so an agent (Claude Code, Codex, any MCP client) can plan, explain and
renegotiate your training week.

```
claude mcp add trainctl --env TRAINCTL_DIR="/path/to/my-training" \
  -- npx -y trainctl-mcp
```

`TRAINCTL_DIR` points at your training directory (the git repo holding
`trainctl.yaml`, `plan/`, `log.jsonl`); without it the server uses the current
working directory.

Sixteen tools over the same handlers the CLI uses, so the agent and your
terminal can never disagree: `trainctl_plan`, `trainctl_today`, `trainctl_week`,
`trainctl_log`, `trainctl_shift`, `trainctl_why`, `trainctl_diff`,
`trainctl_check`, `trainctl_init`, `trainctl_push`, `trainctl_pull`,
`trainctl_adapt`, `trainctl_desk`, `trainctl_reschedule`, `trainctl_export`,
`trainctl_review`.

`trainctl init` leaves an `AGENTS.md` in the training directory that turns the
agent into a coach rather than a command runner: ask before regenerating a plan,
ask for context when a week was missed, never invent numbers. Tool descriptions
follow the directory's language, so the agent speaks the same way `plan/PLAN.md`
reads.

Requires Node ≥ 22.18 (TypeScript source, native type stripping).

MIT · https://github.com/dithiothreitol/trainctl
