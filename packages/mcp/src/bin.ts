#!/usr/bin/env node
/**
 * Serwer MCP „trainctl" po stdio.
 * Katalog treningowy: env TRAINCTL_DIR albo bieżący katalog procesu.
 * Uwaga: stdout jest kanałem protokołu — logi wyłącznie na stderr.
 */
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { resolveLocale, setLocale } from 'trainctl-core'
import { loadEnvFile, readConfigLanguage, ui, ENV_FILE } from 'trainctl'
import { createTrainctlServer } from './server.ts'

const dir = process.env.TRAINCTL_DIR ?? process.cwd()

// `.env` z katalogu treningowego — klient MCP zwykle uruchamia serwer bez
// powłoki użytkownika, więc bez tego klucz API byłby nieosiągalny dla agenta.
const envFile = loadEnvFile(dir)

// Agent dziedziczy język katalogu treningowego: opisy jednostek, które zwracamy
// przez MCP, mają brzmieć tak samo jak te w plan/PLAN.md.
const locale = resolveLocale({
  env: process.env['TRAINCTL_LANG'],
  config: readConfigLanguage(dir),
})
setLocale(locale)

const server = createTrainctlServer(dir)
await server.connect(new StdioServerTransport())
console.error(`[trainctl-mcp] ${ui().mcp.dirLine(dir, locale)}`)
if (envFile.unprotected) {
  console.error(`[trainctl-mcp] ${ui().envFile.unprotected(ENV_FILE, '.gitignore')}`)
}
