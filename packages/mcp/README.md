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

Tools over the same handlers the CLI uses, so the agent and your
terminal can never disagree: `trainctl_plan`, `trainctl_today`, `trainctl_week`,
`trainctl_log`, `trainctl_shift`, `trainctl_why`, `trainctl_diff`,
`trainctl_check`, `trainctl_init`, `trainctl_push`, `trainctl_pull`,
`trainctl_adapt`, `trainctl_replace`, `trainctl_migrate`, `trainctl_desk`, `trainctl_reschedule`, `trainctl_export`,
`trainctl_review`, `trainctl_shorten`, `trainctl_status`, `trainctl_rule`.
Resources: `trainctl://plan`, `trainctl://config`, `trainctl://agents`,
`trainctl://rules/{id}`. Prompts: `weekly-review`, `debrief`.

In Claude Code the easiest route is the plugin, which wraps this server with the
coach skills and hooks: `/plugin marketplace add dithiothreitol/trainctl`, then
`/plugin install trainctl@trainctl`.

For “only 40 minutes today”, use `trainctl_shorten({minutes: 40})`; it saves a
proposal and explains any lost purpose. `trainctl_why` explains the actual
session in context. For “review my week and show changes to approve”, use
`trainctl_review({prepare: true})`. Show the returned diff and warnings, then
call `trainctl_adapt({apply: "<id>"})` after approval. Changed inputs or a new
local calendar day invalidate the proposal.

In schema 2, select workouts by `session` ID. `trainctl_replace({session, toSport})`
previews a substitution with per-sport weekly volume changes; apply its proposal ID.
Use `trainctl_replace({session, restore: true})` to preview restoring the saved
original. For an already completed alternative, `trainctl_log({session,
actualSport: "bike", minutes: 40})` records the actual sport without rewriting
the historical plan. Swimming logs also accept `sets: "1=6,2=4"` for completed
repetitions of numbered planned steps. Review keeps RPE and notes as reported.

`trainctl init` leaves an `AGENTS.md` in the training directory that turns the
agent into a coach rather than a command runner: ask before regenerating a plan,
ask for context when a week was missed, never invent numbers. Tool descriptions
follow the directory's language, so the agent speaks the same way `plan/PLAN.md`
reads.

Requires Node ≥ 22.18. Ships compiled JavaScript with type declarations.

MIT · https://github.com/dithiothreitol/trainctl
