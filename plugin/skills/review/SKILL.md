---
name: review
description: "Weekly review of a trainctl training plan: what happened, what it means, what is ahead. Use at the start of a week or when asked \"how did I do?\"."
---

# Weekly review

1. Call `trainctl_review` (one call instead of pull + adapt + week). Pass `date` only when the user names a different week.
2. Relay it in plain language: the days behind against the plan, the signals worth acting on, the key session ahead.
   Quote RPE and notes from the journal verbatim; never turn feelings into numbers.
3. Propose at most two things to do. Unknown sessions are unknown, not skipped — ask before treating them as missed.
4. If the user wants concrete changes: `trainctl_review` with `prepare=true`, show the saved diff and warnings,
   and call `trainctl_adapt` with `apply=<id>` only after an explicit yes. Do not regenerate or sync in between.
5. A missed week needs context first (illness and a crunch at work call for different answers).
