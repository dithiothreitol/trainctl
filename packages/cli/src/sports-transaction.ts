/** Recoverable multi-file writes. A durable before/after journal is the commit record. */
import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { ui } from './i18n/index.ts'

const JOURNAL = 'plan/.transaction.json'
const LOCK = 'plan/.transaction.lock'
interface Entry { path: string; before: string | null; after: string }
interface Journal { version: 1; id: string; entries: Entry[]; digest: string }
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
/** Komunikaty z katalogu (C6): `ui().transaction`. */
const t = () => ui().transaction
const read = (path: string): string | null => existsSync(path) ? readFileSync(path, 'utf8') : null
function safePath(cwd: string, path: string): string {
  const base = realpathSync(cwd), full = resolve(base, path), rel = relative(base, full)
  if (!rel || rel.startsWith('..') || isAbsolute(rel) || path === JOURNAL || path === LOCK) throw new Error(t().invalidPath)
  let ancestor = full
  while (!existsSync(ancestor)) ancestor = dirname(ancestor)
  const actual = relative(base, realpathSync(ancestor))
  if (actual.startsWith('..') || isAbsolute(actual)) throw new Error(t().outsidePath)
  return full
}
function durable(path: string, content: string): void {
  const fd = openSync(path, 'wx')
  try { writeFileSync(fd, content, 'utf8'); fsyncSync(fd) } finally { closeSync(fd) }
}
function atomic(path: string, content: string, id: string): void {
  mkdirSync(dirname(path), { recursive: true })
  const temp = `${path}.txn-${id}`
  // Only this journal's staging file may be left by an interrupted write.
  rmSync(temp, { force: true })
  durable(temp, content)
  renameSync(temp, path)
}
function locked<T>(cwd: string, run: () => T): T {
  mkdirSync(join(cwd, 'plan'), { recursive: true })
  const path = join(cwd, LOCK)
  if (existsSync(path)) {
    const owner = JSON.parse(readFileSync(path, 'utf8')) as { pid: number }
    let alive = true
    try { process.kill(owner.pid, 0) } catch (e) { if ((e as NodeJS.ErrnoException).code === 'ESRCH') alive = false }
    if (alive) throw new Error(t().locked)
    rmSync(path)
  }
  durable(path, JSON.stringify({ pid: process.pid }))
  try { return run() } finally { rmSync(path, { force: true }) }
}
function recoverLocked(cwd: string, mode: 'resume' | 'rollback'): boolean {
  const path = join(cwd, JOURNAL), raw = read(path)
  if (!raw) return false
  const journal = JSON.parse(raw) as Journal
  const { digest, ...body } = journal
  if (journal.version !== 1 || !/^[a-f0-9-]{36}$/.test(journal.id) || digest !== hash(body)) throw new Error(t().invalidJournal)
  // Validate EVERY entry before changing any: manual edits must never be lost.
  for (const entry of journal.entries) {
    const current = read(safePath(cwd, entry.path))
    if (current !== entry.before && current !== entry.after) throw new Error(t().recoveryStopped(entry.path))
  }
  for (const entry of journal.entries) {
    const full = safePath(cwd, entry.path), value = mode === 'resume' ? entry.after : entry.before
    if (value === null) rmSync(full, { force: true })
    else atomic(full, value, journal.id)
    rmSync(`${full}.txn-${journal.id}`, { force: true })
  }
  rmSync(path)
  return true
}
/** Explicit resume/rollback; default reads restore the last fully committed state. */
export function recoverSportsTransaction(cwd: string, mode: 'resume' | 'rollback' = 'rollback'): boolean {
  if (!existsSync(join(cwd, JOURNAL))) return false
  return locked(cwd, () => recoverLocked(cwd, mode))
}
export function writeTransaction(cwd: string, files: Record<string, string>, verify?: () => void): void {
  locked(cwd, () => {
    recoverLocked(cwd, 'rollback')
    verify?.()
    const entries = Object.entries(files).map(([path, after]) => ({ path, before: read(safePath(cwd, path)), after }))
    const body = { version: 1 as const, id: randomUUID(), entries }
    const journal: Journal = { ...body, digest: hash(body) }
    const path = join(cwd, JOURNAL)
    atomic(path, JSON.stringify(journal), journal.id)
    try {
      for (const entry of entries) atomic(safePath(cwd, entry.path), entry.after, journal.id)
      // Deleting the durable journal commits the entire set.
      rmSync(path)
    } catch (error) {
      recoverLocked(cwd, 'rollback')
      throw error
    }
  })
}
