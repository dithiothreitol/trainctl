#!/usr/bin/env node
/**
 * Podnosi wersję wszędzie, gdzie musi być ta sama (packaging.test.ts i
 * plugin.test.ts to sprawdzają): korzeń i paczki, manifesty pluginu, marketplace,
 * przypięte wersje w konfiguracjach MCP pluginu, w hooku i w przykładach CI,
 * a na koniec przegenerowuje skille (persona linkuje FOUNDATIONS z tagu wersji).
 *
 *   node tools/release/bump-version.mjs 0.4.0
 */
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')
const next = process.argv[2]
if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.]+)?$/.test(next ?? '')) {
  console.error('usage: node tools/release/bump-version.mjs <x.y.z>')
  process.exit(2)
}
const current = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8')).version
const touched = []

function edit(path, transform) {
  const full = join(ROOT, path)
  const before = readFileSync(full, 'utf-8')
  const after = transform(before)
  if (after !== before) {
    writeFileSync(full, after, 'utf-8')
    touched.push(path)
  }
}
const jsonVersion = (text) => text.replace(/("version":\s*")[^"]+(")/, `$1${next}$2`)
const pinned = (text) => text.replaceAll(`@${current}`, `@${next}`)

edit('package.json', jsonVersion)
for (const pkg of readdirSync(join(ROOT, 'packages'))) edit(`packages/${pkg}/package.json`, jsonVersion)
edit('plugin/.claude-plugin/plugin.json', jsonVersion)
edit('plugin/.codex-plugin/plugin.json', jsonVersion)
edit('.claude-plugin/marketplace.json', jsonVersion)
edit('plugin/.mcp.json', pinned)
edit('plugin/codex.mcp.json', pinned)
edit('plugin/scripts/check-plan.mjs', (t) => t.replace(/(TRAINCTL_VERSION = ')[^']+(')/, `$1${next}$2`))
for (const file of readdirSync(join(ROOT, 'docs/examples'))) if (file.endsWith('.md')) edit(`docs/examples/${file}`, pinned)

execFileSync(process.execPath, [join(ROOT, 'tools/plugin/render-skills.ts')], { stdio: 'inherit' })
console.log(`${current} → ${next}: ${touched.length} files\n${touched.map((f) => `  ${f}`).join('\n')}`)
console.log('next: pnpm check, CHANGELOG, then the release sequence in docs/PUBLISHING.md')
