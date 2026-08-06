#!/usr/bin/env node
/**
 * Serwer MCP „tren" po stdio.
 * Katalog treningowy: env TREN_DIR albo bieżący katalog procesu.
 * Uwaga: stdout jest kanałem protokołu — logi wyłącznie na stderr.
 */
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { resolveLocale, setLocale } from '@tren/core'
import { readConfigLanguage, ui } from '@tren/cli'
import { createTrenServer } from './server.ts'

const dir = process.env.TREN_DIR ?? process.cwd()

// Agent dziedziczy język katalogu treningowego: opisy jednostek, które zwracamy
// przez MCP, mają brzmieć tak samo jak te w plan/PLAN.md.
const locale = resolveLocale({
  env: process.env['TREN_LANG'],
  config: readConfigLanguage(dir),
})
setLocale(locale)

const server = createTrenServer(dir)
await server.connect(new StdioServerTransport())
console.error(`[tren-mcp] ${ui().mcp.dirLine(dir, locale)}`)
