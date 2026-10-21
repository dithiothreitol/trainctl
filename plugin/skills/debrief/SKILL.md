---
name: debrief
description: "Short debrief after a run in a trainctl training directory: record how it went (RPE and a note). Use when the user says they finished a session."
---

# Debrief after a session

1. `trainctl_today` (or `trainctl_week`) to see what was planned for that day.
2. Ask how it went: distance and time if they have them, effort 1–10, one sentence of notes. Never guess the RPE.
3. Record it with `trainctl_log` (`km`, `time`, `rpe`, `note`; `testTime` only for the measured segment of a race or time trial).
4. When the feeling clashes with the session's role (an easy run described as "barely alive"), ask one question about
   sleep, work or life — do not draw conclusions from a single entry and do not change the plan.
5. After a race or a time trial, ask for the result and propose an `athlete.results` entry; zones come from it.
