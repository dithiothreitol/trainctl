/**
 * Generuje plugin/skills/<nazwa>/SKILL.md z `packages/cli/src/plugin-skills.ts`.
 *
 *   node tools/plugin/render-skills.ts          # zapisuje pliki
 *   node tools/plugin/render-skills.ts --check  # kod 1, gdy pliki odjechały od źródła
 *
 * Uruchamiane po każdej zmianie AGENTS.md (persona) albo opisów skilli;
 * `plugin.test.ts` pilnuje, żeby nikt o tym nie zapomniał.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pluginSkills, renderSkill } from '../../packages/cli/src/plugin-skills.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')
const check = process.argv.includes('--check')
let stale = 0
for (const skill of pluginSkills()) {
  const path = join(ROOT, 'plugin', 'skills', skill.name, 'SKILL.md')
  const content = renderSkill(skill)
  const current = existsSync(path) ? readFileSync(path, 'utf-8').replace(/\r\n/g, '\n') : undefined
  if (current === content) continue
  stale++
  if (check) {
    console.error(`stale: ${path}`)
    continue
  }
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content, 'utf-8')
  console.log(`wrote ${path}`)
}
if (check && stale) {
  console.error('run: node tools/plugin/render-skills.ts')
  process.exitCode = 1
}
