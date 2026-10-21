/**
 * `--commit`: domknięcie historii gita po udanym zapisie (ADR-040).
 *
 * AGENTS.md każe commitować po każdej zmianie planu — flaga robi dokładnie to,
 * bez stawania się klientem gita. Zasady: commit obejmuje WYŁĄCZNIE pliki, które
 * komenda zmieniła (pathspec przy `git commit`, więc cudze zmiany w indeksie
 * zostają nietknięte); nigdy sekretów ani migawki synchronizacji; brak gita to
 * informacja, nie błąd — zapis już się udał.
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'

/** Pliki, których `--commit` nie doda nigdy, nawet gdyby trafiły na listę. */
const NEVER = new Set(['.env', '.trainctl-secret', 'sync.json'])

export type CommitOutcome =
  | { status: 'committed'; sha: string; files: string[] }
  | { status: 'no-git' }
  | { status: 'nothing' }
  | { status: 'failed'; detail: string }

export function insideGitRepo(cwd: string): boolean {
  let dir = cwd
  for (;;) {
    if (existsSync(join(dir, '.git'))) return true
    const parent = dirname(dir)
    if (parent === dir) return false
    dir = parent
  }
}

const git = (cwd: string, args: string[]) =>
  spawnSync('git', args, { cwd, encoding: 'utf-8', windowsHide: true })

export function commitFiles(cwd: string, files: string[], message: string): CommitOutcome {
  if (!insideGitRepo(cwd)) return { status: 'no-git' }
  const present = files.filter((f) => !NEVER.has(f.replace(/^\.\//, '')) && existsSync(join(cwd, f)))
  if (present.length === 0) return { status: 'nothing' }
  const add = git(cwd, ['add', '--', ...present])
  if (add.error) return { status: 'failed', detail: add.error.message }
  if (add.status !== 0) return { status: 'failed', detail: (add.stderr || add.stdout).trim() }
  const staged = git(cwd, ['diff', '--cached', '--quiet', '--', ...present])
  if (staged.status === 0) return { status: 'nothing' }
  const commit = git(cwd, ['commit', '-m', message, '--', ...present])
  if (commit.status !== 0) return { status: 'failed', detail: (commit.stderr || commit.stdout).trim() }
  const sha = git(cwd, ['rev-parse', '--short', 'HEAD']).stdout.trim()
  return { status: 'committed', sha, files: present }
}

/** Niezacommitowane zmiany w plikach katalogu treningowego (dla `status`). */
export function uncommitted(cwd: string, paths: string[]): string[] | undefined {
  if (!insideGitRepo(cwd)) return undefined
  const r = git(cwd, ['status', '--porcelain', '--', ...paths])
  if (r.status !== 0) return undefined
  // `R  stary -> nowy` (rename w indeksie) pokazujemy jako nową ścieżkę
  return r.stdout.split('\n').map((l) => l.slice(3).trim().split(' -> ').at(-1)!).filter(Boolean)
}
