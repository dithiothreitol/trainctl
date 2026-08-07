/**
 * Plik `.env` w katalogu treningowym.
 *
 * ADR-009 mówi, gdzie NIE może być klucza: w `trainctl.yaml`, bo katalog
 * treningowy jest repozytorium gita, a sekret w wersjonowanym pliku prędzej
 * czy później trafi na zdalne repo. `.env` jest konwencją, którą wszyscy
 * znają, i jest tak samo bezpieczny — pod jednym warunkiem: musi być
 * ignorowany. Dlatego go wczytujemy, ale sprawdzamy ten warunek i mówimy
 * głośno, gdy nie jest spełniony.
 *
 * Parsowanie robi `process.loadEnvFile` z Node (≥20.12, my wymagamy ≥22.18):
 * obsługuje cudzysłowy i komentarze, a co ważniejsze **nie nadpisuje**
 * zmiennych już obecnych w środowisku — jawny `export` dalej wygrywa nad
 * plikiem, zgodnie z tym, czego ludzie oczekują po dotenv.
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export const ENV_FILE = '.env'
const GITIGNORE = '.gitignore'

export interface EnvFileOutcome {
  /** `.env` istniał i został wczytany. */
  loaded: boolean
  /**
   * Plik leży w repozytorium gita, a żaden `.gitignore` po drodze go nie
   * ignoruje. Heurystyka — wolimy fałszywy alarm niż ciche przemilczenie
   * klucza API idącego do commita.
   */
  unprotected: boolean
}

/** Prosty glob z `*` (tyle wystarczy dla wzorców w .gitignore dotyczących `.env`). */
function globMatches(pattern: string, name: string): boolean {
  const rx = new RegExp(
    '^' + pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$',
  )
  return rx.test(name)
}

/** Czy którykolwiek `.gitignore` od `cwd` do korzenia repo ignoruje `.env`. */
function isIgnored(cwd: string): boolean {
  let dir = cwd
  for (;;) {
    const path = join(dir, GITIGNORE)
    if (existsSync(path)) {
      let lines: string[]
      try {
        lines = readFileSync(path, 'utf-8').split('\n')
      } catch {
        lines = []
      }
      for (const raw of lines) {
        const line = raw.trim()
        if (!line || line.startsWith('#') || line.startsWith('!')) continue
        // `/x`, `x/` i `x` znaczą dla nas to samo: interesuje nas sam wzorzec
        const pattern = line.replace(/^\/+/, '').replace(/\/+$/, '')
        if (globMatches(pattern, ENV_FILE)) return true
      }
    }
    if (existsSync(join(dir, '.git'))) return false // korzeń repo — dalej nie szukamy
    const parent = dirname(dir)
    if (parent === dir) return false
    dir = parent
  }
}

/** Czy `cwd` leży wewnątrz repozytorium gita. */
function insideGitRepo(cwd: string): boolean {
  let dir = cwd
  for (;;) {
    if (existsSync(join(dir, '.git'))) return true
    const parent = dirname(dir)
    if (parent === dir) return false
    dir = parent
  }
}

/**
 * Wczytuje `.env` z katalogu, jeśli istnieje. Brak pliku to normalna sytuacja,
 * nie błąd — większość użytkowników trzyma klucz w zmiennej środowiskowej.
 */
export function loadEnvFile(cwd: string): EnvFileOutcome {
  const path = join(cwd, ENV_FILE)
  if (!existsSync(path)) return { loaded: false, unprotected: false }
  try {
    process.loadEnvFile(path)
  } catch {
    // uszkodzony plik nie może zablokować całego CLI — komendy bez sekretów
    // mają działać dalej, a te z sekretami i tak zgłoszą brak klucza
    return { loaded: false, unprotected: false }
  }
  return { loaded: true, unprotected: insideGitRepo(cwd) && !isIgnored(cwd) }
}
