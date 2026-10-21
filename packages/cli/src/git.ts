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

/**
 * Niezacommitowane zmiany w plikach katalogu treningowego (dla `status`) —
 * ścieżki względem `cwd`, gotowe do `git add`, także gdy katalog treningowy jest
 * podkatalogiem repozytorium (porcelain podaje je od korzenia repo). Pliki
 * ignorowane się tu nie pojawiają, usunięte — tak.
 */
export function uncommitted(cwd: string, paths: string[]): string[] | undefined {
  if (!insideGitRepo(cwd)) return undefined
  const prefix = git(cwd, ['rev-parse', '--show-prefix'])
  const r = git(cwd, ['status', '--porcelain', '-z', '--', ...paths])
  if (r.status !== 0 || prefix.status !== 0) return undefined
  const root = prefix.stdout.trim()
  const entries = r.stdout.split('\0')
  const out: string[] = []
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]!
    if (entry.length < 4) continue
    // `R  nowy\0stary` (rename albo kopia w indeksie): liczy się nowa ścieżka
    if (entry[0] === 'R' || entry[0] === 'C') i++
    const path = entry.slice(3)
    out.push(path.startsWith(root) ? path.slice(root.length) : path)
  }
  return out
}
