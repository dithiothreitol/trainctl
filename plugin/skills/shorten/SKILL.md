---
name: shorten
description: "Fit a planned trainctl session into limited time (\"only 40 minutes today\"). Use when the user has less time than the session needs."
---

# Only N minutes today

1. Call `trainctl_shorten` with `minutes` (and `date` if not today). The budget includes preparation and strength.
2. Show the exact before and after, the estimated minutes, and any lost purpose — an easy run replacing quality work
   must be said out loud, never substituted silently.
3. Apply with `trainctl_shorten` `apply=<id>` only after the user agrees. A new calendar day or changed inputs expire the proposal.
4. If several days are tight, `trainctl_reschedule` with `time` budgets re-solves the whole week instead.
