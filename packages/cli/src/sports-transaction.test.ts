import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { recoverSportsTransaction, writeTransaction } from './sports-transaction.ts'

let dir: string
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'trainctl-transaction-')) })
afterEach(() => rmSync(dir, { recursive: true, force: true, maxRetries: 3 }))
// osobny proces Node z importem TypeScript: pod obciążeniem pełnego `pnpm check` trwa dłużej
// niż domyślne 5 s (rejestr §14, etap 3) — limit to wybór inżynierski
const CHILD_PROCESS_TIMEOUT = 30_000
function crash(): void {
  writeFileSync(join(dir, 'first.txt'), 'before')
  // A real separate process exits BETWEEN target renames. No JS finally runs.
  const program = `import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
const rename = fs.renameSync;
fs.renameSync = (from, to) => { rename(from, to); if (to.endsWith('first.txt')) process.exit(47) };
syncBuiltinESMExports();
const { writeTransaction } = await import(${JSON.stringify(new URL('./sports-transaction.ts', import.meta.url).href)});
writeTransaction(${JSON.stringify(dir)}, {'first.txt':'after','second.txt':'new'});`
  const child = join(dir, 'crash.mjs'); writeFileSync(child, program)
  const result = spawnSync(process.execPath, [child], { encoding: 'utf8' })
  expect(result.status, result.stderr).toBe(47)
  expect(readFileSync(join(dir, 'first.txt'), 'utf8')).toBe('after')
  expect(existsSync(join(dir, 'second.txt'))).toBe(false)
}
it.each(['resume', 'rollback'] as const)('recovers a killed process with %s and permits another transaction', mode => {
  crash()
  expect(recoverSportsTransaction(dir, mode)).toBe(true)
  expect(readFileSync(join(dir, 'first.txt'), 'utf8')).toBe(mode === 'resume' ? 'after' : 'before')
  expect(existsSync(join(dir, 'second.txt'))).toBe(mode === 'resume')
  expect(existsSync(join(dir, 'plan/.transaction.json'))).toBe(false)
  writeTransaction(dir, { 'first.txt': 'next' })
  expect(readFileSync(join(dir, 'first.txt'), 'utf8')).toBe('next')
}, CHILD_PROCESS_TIMEOUT)
it('refuses recovery after a manual edit, preserving all evidence', () => {
  crash(); writeFileSync(join(dir, 'first.txt'), 'manual')
  expect(() => recoverSportsTransaction(dir)).toThrow(/edited|zmieniono/)
  expect(readFileSync(join(dir, 'first.txt'), 'utf8')).toBe('manual')
  expect(existsSync(join(dir, 'plan/.transaction.json'))).toBe(true)
}, CHILD_PROCESS_TIMEOUT)
it('rejects paths outside the workspace before any mutation', () => {
  expect(() => writeTransaction(dir, { 'good.txt': 'yes', '../escape.txt': 'no' })).toThrow(/path/)
  expect(existsSync(join(dir, 'good.txt'))).toBe(false)
})
