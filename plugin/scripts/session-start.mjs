#!/usr/bin/env node
/**
 * SessionStart: w katalogu treningowym daje agentowi personę trenera.
 *
 * Claude Code nie ładuje CLAUDE.md z pluginu, a AGENTS.md z katalogu użytkownika
 * czyta tylko Codex — stąd hook. Poza katalogiem z trainctl.yaml milczy: plugin
 * nie umie włączać się warunkowo, więc warunek siedzi tutaj. Treść to AGENTS.md
 * użytkownika (mógł ją dopasować), przycięta poniżej limitu 10 000 znaków,
 * który Claude Code stosuje do wyjścia hooka.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export const LIMIT = 9000

export function sessionContext(dir) {
  if (!existsSync(join(dir, 'trainctl.yaml'))) return undefined
  const header =
    'This is a trainctl training directory (trainctl.yaml, plan/, log.jsonl). You have the trainctl_* MCP tools; ' +
    'act as the coach described below.\n\n'
  const agents = join(dir, 'AGENTS.md')
  if (!existsSync(agents)) {
    return header + 'There is no AGENTS.md here yet; follow the trainctl:coach skill (`trainctl init` writes the file).'
  }
  const body = readFileSync(agents, 'utf-8')
  return header + (body.length > LIMIT ? `${body.slice(0, LIMIT)}\n\n[AGENTS.md continues — read the file for the rest]` : body)
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  const text = sessionContext(process.env.CLAUDE_PROJECT_DIR || process.cwd())
  if (text) process.stdout.write(text)
}
