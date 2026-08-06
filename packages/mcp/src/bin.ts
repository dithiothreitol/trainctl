#!/usr/bin/env node
/**
 * Serwer MCP „trainctl" po stdio.
 * Katalog treningowy: env TRAINCTL_DIR albo bieżący katalog procesu.
 * Uwaga: stdout jest kanałem protokołu — logi wyłącznie na stderr.
 */
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { resolveLocale, setLocale } from '@trainctl/core'
import { readConfigLanguage, ui } from '@trainctl/cli'
import { createTrainctlServer } from './server.ts'

const dir = process.env.TRAINCTL_DIR ?? process.cwd()

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
