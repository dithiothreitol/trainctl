#!/usr/bin/env node
/**
 * SessionStart: w katalogu treningowym daje agentowi personę trenera.
 * PLAN-v0.7 F3: dopisuje też wiek danych wykonania (`sync.json`, data ostatniego
 * pobrania jak w `trainctl status`). Hook niczego nie pobiera: odświeża użytkownik
 * albo agent narzędziem (`trainctl pull`, `trainctl_review`).
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

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** Dzisiejsza data lokalna; `TRAINCTL_TODAY` jak w CLI (symulacja daty). */
export function localToday(env = process.env, now = new Date()) {
  const simulated = env.TRAINCTL_TODAY
  if (simulated && ISO_DATE.test(simulated)) return simulated
  const pad = (n) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** F3: jedno zdanie o świeżości danych wykonania — z `pulledAt` w sync.json. */
export function syncFreshness(dir, today) {
  const path = join(dir, 'sync.json')
  if (!existsSync(path)) {
    return 'Execution data: no sync.json yet, so log.jsonl is the only record; `trainctl pull` fetches activities from intervals.icu or exported files.'
  }
  let pulledAt
  try {
    pulledAt = JSON.parse(readFileSync(path, 'utf-8'))?.pulledAt
  } catch {
    return 'Execution data: sync.json is unreadable; run `trainctl status`, then `trainctl pull`.'
  }
  if (typeof pulledAt !== 'string' || !ISO_DATE.test(pulledAt)) {
    return 'Execution data: sync.json has no pull date; run `trainctl status`.'
  }
  const days = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${pulledAt}T00:00:00Z`)) / 86400000)
  const age = days <= 0 ? 'today' : days === 1 ? '1 day ago' : `${days} days ago`
  return `Execution data: sync.json last pulled ${pulledAt} (${age}). Nothing is fetched in the background; ` +
    'refresh with `trainctl pull` or the trainctl_review tool before judging the week.'
}

export function sessionContext(dir, today = localToday()) {
  if (!existsSync(join(dir, 'trainctl.yaml'))) return undefined
  const header =
    'This is a trainctl training directory (trainctl.yaml, plan/, log.jsonl). You have the trainctl_* MCP tools; ' +
    'act as the coach described below.\n' + syncFreshness(dir, today) + '\n\n'
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
