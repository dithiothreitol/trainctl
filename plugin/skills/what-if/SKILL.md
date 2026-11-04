---
name: what-if
description: "Explore a training scenario without touching the real plan (\"what if the race moves three weeks?\"). Use for any hypothetical change to the goal, dates or profile."
---

If trainctl_workspace is available, inspect its current selection first. Before using training tools, bind it to the user's training directory with an absolute directory path. Use the current project only when it is the intended training directory; ask if unclear. Never initialize a plan inside the plugin cache. A different directory requires a new server session.

# What-if scenario

1. Never change the real plan for a question. Create a scenario: a git branch or a copied directory.
2. Change `trainctl.yaml` there (race date, distance, tune-up races, volume), regenerate there with `trainctl_plan`
   (point the MCP server or the CLI `-C` at the scenario directory).
3. Back in the real directory, `trainctl_diff` with `plan=<path to the scenario's plan/plan.yaml>` and show the
   goal, prediction and week-by-week differences.
4. The real plan stays untouched until the user decides; then the change goes through `trainctl.yaml` →
   `trainctl_diff` → `trainctl_plan` (which keeps past, logged, pinned and approved days).
