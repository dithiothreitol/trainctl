---
name: replace
description: "Replace a planned trainctl workout with running, cycling or swimming, preserving explicit intent and tradeoffs."
---

If trainctl_workspace is available, inspect its current selection first. Before using training tools, bind it to the user's training directory with an absolute directory path. Use the current project only when it is the intended training directory; ask if unclear. Never initialize a plan inside the plugin cache. A different directory requires a new server session.

# Replace a session

1. Read trainctl_week and choose the source session ID. A date can have several sessions.
2. Call trainctl_replace with session, toSport and optionally minutes (including preparation), reason or variant=endurance|quality.
3. Show the original and alternative, preserved intent, lost sport-specific practice, dose limits, per-sport weekly volume deltas and calendar consequences. There is no kilometre or physiological equivalence factor.
4. Apply the exact returned proposal ID when the user has authorized the concrete change. Changed profile, plan, logs, sync data or calendar day require a fresh proposal.
5. Log and export the new session ID. Regeneration must retain the replacement; never recreate its archived original.
6. To undo a planned substitution, call trainctl_replace with session and restore=true, then review and apply the returned ID. This restores the archived prescription and checks the current calendar; do not approximate it with a reverse substitution.
7. If another sport was already performed, use trainctl_log with the original session ID, actualSport and actual duration (or explicitly bound activity). Keep the historical plan unchanged. Review reports the actual sport and the uncovered original sport-specific objective.
