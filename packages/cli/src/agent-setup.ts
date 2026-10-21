/**
 * `trainctl init --agent claude|codex|all` — pliki integracji agenta w katalogu
 * treningowym (ADR-036). Wyłącznie na jawną flagę: konfiguracja agenta w repo
 * użytkownika to decyzja użytkownika, nie efekt uboczny `init`.
 *
 * Claude Code: `.claude/settings.json` rejestruje marketplace z tego repozytorium
 * i włącza plugin (serwer MCP, skille, hooki). Bez pliku `.mcp.json` obok —
 * plugin i projektowy `.mcp.json` uruchomiłyby dwa serwery trainctl naraz.
 *
 * Codex: `.codex/config.toml` z serwerem MCP. AGENTS.md Codex czyta sam; plugin
 * z marketplace (`codex plugin marketplace add`) to alternatywa — nie oba naraz,
 * z tego samego powodu.
 *
 * Istniejących plików nie nadpisujemy: drukujemy, co do nich dopisać.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { packageVersion } from './version.ts'

export const AGENTS = ['claude', 'codex', 'all'] as const
export type AgentChoice = (typeof AGENTS)[number]

export const MARKETPLACE_REPO = 'dithiothreitol/trainctl'
export const PLUGIN_ID = 'trainctl@trainctl'
export const CLAUDE_SETTINGS = '.claude/settings.json'
export const CODEX_CONFIG = '.codex/config.toml'

export function claudeSettings(): string {
  return JSON.stringify({
    extraKnownMarketplaces: { trainctl: { source: { source: 'github', repo: MARKETPLACE_REPO } } },
    enabledPlugins: { [PLUGIN_ID]: true },
  }, null, 2) + '\n'
}

export function codexConfig(): string {
  return [
    '# trainctl — coach tools for Codex in this training directory.',
    '# Codex reads AGENTS.md on its own; this adds the trainctl MCP server.',
    '# Project config loads only after you trust this directory in Codex.',
    '# Use either this server or the trainctl plugin (codex plugin marketplace add',
    `# ${MARKETPLACE_REPO}), not both — they would start two servers.`,
    '[mcp_servers.trainctl]',
    'command = "npx"',
    `args = ["-y", "trainctl-mcp@${packageVersion()}"]`,
    '# If the tools see the wrong directory, point them here explicitly:',
    '# env = { TRAINCTL_DIR = "/absolute/path/to/this/directory" }',
    '',
  ].join('\n')
}

export interface AgentSetup {
  created: string[]
  /** Pliki, które już istniały — z treścią do ręcznego dopisania. */
  existing: { file: string; content: string }[]
}

export function writeAgentSetup(cwd: string, agent: AgentChoice): AgentSetup {
  const wanted: { file: string; content: string }[] = []
  if (agent === 'claude' || agent === 'all') wanted.push({ file: CLAUDE_SETTINGS, content: claudeSettings() })
  if (agent === 'codex' || agent === 'all') wanted.push({ file: CODEX_CONFIG, content: codexConfig() })
  const setup: AgentSetup = { created: [], existing: [] }
  for (const { file, content } of wanted) {
    const path = join(cwd, file)
    if (existsSync(path)) {
      setup.existing.push({ file, content })
      continue
    }
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, content, 'utf-8')
    setup.created.push(file)
  }
  return setup
}
