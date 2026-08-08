/**
 * Kontrakt dystrybucji — to, czego nie widać w żadnym teście funkcjonalnym.
 *
 * Powód istnienia: 0.1.0 poszło na npm z `exports`/`bin` wskazującymi na pliki
 * `.ts`, bo w repozytorium działa to bez zarzutu (natywny type-stripping Node).
 * Po instalacji nie działa NIC: Node odmawia zdejmowania typów dla plików pod
 * `node_modules` (ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING) i CLI wywalało
 * się przy starcie. Cała zielona suita tego nie widziała, bo uruchamia kod
 * z drzewa źródeł.
 *
 * Stąd asercje na manifestach: do rejestru idą wyłącznie wejścia zbudowane.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const PACKAGES = ['core', 'export', 'sync-intervalsicu', 'cli', 'mcp']

interface Manifest {
  name: string
  version: string
  description: string
  files?: string[]
  publishConfig?: {
    access?: string
    types?: string
    exports?: Record<string, { types?: string; default?: string }>
    bin?: Record<string, string>
  }
}

const manifest = (pkg: string): Manifest =>
  JSON.parse(readFileSync(join(ROOT, 'packages', pkg, 'package.json'), 'utf-8')) as Manifest

const rootVersion = (
  JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8')) as { version: string }
).version

describe('manifesty paczek: do rejestru idzie build, nie źródło', () => {
  for (const pkg of PACKAGES) {
    it(`${pkg}: exports i bin wskazują na dist/*.js`, () => {
      const m = manifest(pkg)
      const entry = m.publishConfig?.exports?.['.']
      expect(entry?.default, `${m.name}: publishConfig.exports`).toMatch(/^\.\/dist\/.+\.js$/)
      expect(entry?.types, `${m.name}: typy`).toMatch(/^\.\/dist\/.+\.d\.ts$/)
      for (const [cmd, path] of Object.entries(m.publishConfig?.bin ?? {})) {
        expect(path, `${m.name}: bin ${cmd}`).toMatch(/^\.\/dist\/.+\.js$/)
      }
      expect(m.files, `${m.name}: files`).toContain('dist')
      expect(m.publishConfig?.access).toBe('public')
    })
  }

  it('wszystkie paczki mają tę samą wersję co korzeń', () => {
    for (const pkg of PACKAGES) {
      expect(manifest(pkg).version, `${pkg} vs korzeń`).toBe(rootVersion)
    }
  })

  it('opisy są po angielsku — to one stoją na stronie paczki w npm', () => {
    for (const pkg of PACKAGES) {
      const { name, description } = manifest(pkg)
      expect(description, `${name}: pusty opis`).toBeTruthy()
      expect(description, `${name}: polskie znaki w opisie`).not.toMatch(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/)
      expect(description, `${name}: polskie słowo w opisie`).not.toMatch(
        /\b(silnik|trener|treningow\w*|plan\w*ow\w*|eksport|zegarek|kalendarz|wydruk|narzędzia|adapter intervals)\b/i,
      )
    }
  })
})
