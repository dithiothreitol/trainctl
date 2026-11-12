/**
 * Skille pluginu Claude Code / Codex (`plugin/skills/*\/SKILL.md`) — generowane,
 * nie pisane ręcznie (ADR-036). Persona trenera to dosłownie ten sam tekst,
 * który `trainctl init` zapisuje jako AGENTS.md; skille zadaniowe są cienkie:
 * które narzędzie, co pokazać, czego nie robić. Dryf między personą w AGENTS.md
 * a skillami oznaczałby dwóch różnych trenerów — `plugin.test.ts` porównuje
 * pliki w repo z tym, co generuje ten moduł.
 *
 * Język skilli: angielski. Wyjście narzędzi i tak idzie w języku katalogu
 * treningowego, więc polski biegacz dostaje polskie treści z MCP.
 */
import { withLocale } from 'trainctl-core'
import { ui } from './i18n/index.ts'
import { foundationsUrl } from './rules-explain.ts'

export interface Skill {
  name: string
  description: string
  body: string
}

export function pluginSkills(): Skill[] {
  const persona = withLocale('en', () => ui().agentsMd(foundationsUrl()))
  return [
    {
      name: 'coach',
      description:
        'Endurance coach for a trainctl training directory (trainctl.yaml, plan/, log.jsonl). Use when the user talks ' +
        'about running, cycling, swimming, multisport, races, the week ahead, how a session went, or asks what to train today.',
      body: persona,
    },
    {
      name: 'review',
      description: 'Weekly review of a trainctl training plan: what happened, what it means, what is ahead. Use at the start of a week or when asked "how did I do?".',
      body: `# Weekly review

1. In schema 2, keep running, cycling and swimming totals separate; inspect activity matching and replacement history.
   Call \`trainctl_review\` (one call instead of pull + adapt + week). Pass \`date\` only when the user names a different week.
2. Relay it in plain language: the days behind against the plan, the signals worth acting on, the key session ahead.
   Quote RPE and notes from the journal verbatim; never turn feelings into numbers.
   The "against the targets" facts come from laps and pace: "no laps matching the plan" means auto laps, not a failed
   session; heart rate is not judged; a calibration hint means proposing a fresh race result or a time trial.
3. Propose at most two things to do. Unknown sessions are unknown, not skipped — ask before treating them as missed.
4. If the user wants concrete changes: \`trainctl_review\` with \`prepare=true\`, show the saved diff and warnings,
   and call \`trainctl_adapt\` with \`apply=<id>\` only after an explicit yes. Do not regenerate or sync in between.
5. A missed week needs context first (illness and a crunch at work call for different answers).
`,
    },
    {
      name: 'debrief',
      description: 'Short debrief after a training session in a trainctl training directory: record how it went (RPE and a note). Use when the user says they finished a session.',
      body: `# Debrief after a session

1. \`trainctl_today\` (or \`trainctl_week\`) to see what was planned for that day.
2. Ask how it went: distance and time if they have them, effort 1–10, one sentence of notes. Never guess the RPE.
3. In schema 2, select the session ID from the plan; use metres for swimming and comma-separated namespaced activity IDs when several records complete one session. Never log the archived original after a substitution.
   Record it with \`trainctl_log\` (\`km\`, \`time\`, \`rpe\`, \`note\`; \`testTime\` only for the measured segment of a race or time trial).
4. When the feeling clashes with the session's role (an easy run described as "barely alive"), ask one question about
   sleep, work or life — do not draw conclusions from a single entry and do not change the plan.
5. After a race or a time trial, ask for the result and propose an \`athlete.sports.run.results\` entry (\`athlete.results\` in a running-plan profile); zones come from it.
`,
    },
    {
      name: 'shorten',
      description: 'Fit a planned trainctl session into limited time ("only 40 minutes today"). Use when the user has less time than the session needs.',
      body: `# Only N minutes today

1. Select the session ID in schema 2 (a date may contain several sports). Call \`trainctl_shorten\` with \`minutes\` (and \`date\` if not today). The budget includes preparation and strength.
2. Show the exact before and after, the estimated minutes, and any lost purpose — an easy run replacing quality work
   must be said out loud, never substituted silently.
3. Apply with \`trainctl_shorten\` \`apply=<id>\` only after the user agrees. A new calendar day or changed inputs expire the proposal.
4. If several days are tight, \`trainctl_reschedule\` with \`time\` budgets re-solves the whole week instead.
`,
    },
    {
      name: 'replace',
      description: 'Replace a planned trainctl workout with running, cycling or swimming, preserving explicit intent and tradeoffs.',
      body: `# Replace a session

1. Read trainctl_week and choose the source session ID. A date can have several sessions.
2. Call trainctl_replace with session, toSport and optionally minutes (including preparation), reason or variant=endurance|quality.
3. Show the original and alternative, preserved intent, lost sport-specific practice, dose limits, per-sport weekly volume deltas and calendar consequences. There is no kilometre or physiological equivalence factor.
4. Apply the exact returned proposal ID when the user has authorized the concrete change. Changed profile, plan, logs, sync data or calendar day require a fresh proposal.
5. Log and export the new session ID. Regeneration must retain the replacement; never recreate its archived original.
6. To undo a planned substitution, call trainctl_replace with session and restore=true, then review and apply the returned ID. This restores the archived prescription and checks the current calendar; do not approximate it with a reverse substitution.
7. If another sport was already performed, use trainctl_log with the original session ID, actualSport and actual duration (or explicitly bound activity). Keep the historical plan unchanged. Review reports the actual sport and the uncovered original sport-specific objective.
`,
    },
    {
      name: 'what-if',
      description: 'Explore a training scenario without touching the real plan ("what if the race moves three weeks?"). Use for any hypothetical change to the goal, dates or profile.',
      body: `# What-if scenario

1. Never change the real plan for a question. Create a scenario: a git branch or a copied directory.
2. Change \`trainctl.yaml\` there (race date, distance, tune-up races, volume), regenerate there with \`trainctl_plan\`
   (point the MCP server or the CLI \`-C\` at the scenario directory).
3. Back in the real directory, \`trainctl_diff\` with \`plan=<path to the scenario's plan/plan.yaml>\` and show the
   goal, prediction and week-by-week differences.
4. The real plan stays untouched until the user decides; then the change goes through \`trainctl.yaml\` →
   \`trainctl_diff\` → \`trainctl_plan\` (which keeps past, logged, pinned and approved days).
`,
    },
  ]
}

export const renderSkill = (skill: Skill): string =>
  `---\nname: ${skill.name}\ndescription: ${JSON.stringify(skill.description)}\n---\n\nIf trainctl_workspace is available, inspect its current selection first. Before using training tools, bind it to the user's training directory with an absolute directory path. Use the current project only when it is the intended training directory; ask if unclear. Never initialize a plan inside the plugin cache. A different directory requires a new server session.\n\n${skill.body.trim()}\n`
