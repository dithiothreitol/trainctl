#!/usr/bin/env node
// Katalog roboczy klienta (lub TRAINCTL_DIR) wskazuje dane treningowe.
// Nigdy nie pobieramy starszej paczki npm jako zastępstwa brakującego buildu.
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
// Także bez hosta pluginów wymuszamy jawne powiązanie katalogu.
process.env.PLUGIN_ROOT = fileURLToPath(new URL('..', import.meta.url))
const entry = new URL('../runtime/dist/mcp.mjs', import.meta.url)
if (!existsSync(entry)) {
  console.error('trainctl: plugin runtime missing. Build with pnpm plugin:build and install the generated local marketplace.')
  process.exitCode = 1
} else {
  await import(entry.href)
}
