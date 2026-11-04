#!/usr/bin/env node
// Ta sama wersja CLI co serwer MCP dołączony do pluginu.
import { existsSync } from 'node:fs'
const entry = new URL('../runtime/dist/cli.mjs', import.meta.url)
if (!existsSync(entry)) {
  console.error('trainctl: plugin runtime missing. Build with pnpm plugin:build first.')
  process.exitCode = 1
} else {
  await import(entry.href)
}
