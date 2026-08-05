#!/usr/bin/env node
/**
 * Serwer MCP „tren" po stdio.
 * Katalog treningowy: env TREN_DIR albo bieżący katalog procesu.
 * Uwaga: stdout jest kanałem protokołu — logi wyłącznie na stderr.
 */
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createTrenServer } from './server.ts'

const dir = process.env.TREN_DIR ?? process.cwd()
const server = createTrenServer(dir)
await server.connect(new StdioServerTransport())
console.error(`[tren-mcp] katalog treningowy: ${dir}`)
