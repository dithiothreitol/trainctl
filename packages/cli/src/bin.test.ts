/**
 * Smoke-test PRAWDZIWYCH binarek uruchomionych przez Node.
 *
 * Powód istnienia: vitest transpiluje TS (esbuild) i toleruje składnię, której
 * natywny type-stripping Node NIE obsługuje (np. „parameter properties"
 * `constructor(readonly x: T)`). Bez tego testu taki kod przechodzi całą
 * zieloną suitę i wywala się dopiero u użytkownika przy pierwszym uruchomieniu.
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const HERE = dirname(fileURLToPath(import.meta.url))
const CLI_BIN = join(HERE, 'bin.ts')
const MCP_BIN = join(HERE, '../../mcp/src/bin.ts')

const CONFIG = `athlete:
  recentWeeklyKm: 50
  daysAvailable: [tue, wed, thu, sat, sun]
  results:
    - { date: "2026-03-30", distanceKm: 10, timeSec: 2500 }
goal:
  name: "Bieg testowy"
  date: "2026-11-29"
  distanceKm: 21.0975
  priority: A
`

let dir: string
/** Domyślnie po polsku — asercje w tym pliku czytają się wtedy najłatwiej. */
const run = (args: string[], env: NodeJS.ProcessEnv = {}) =>
  execFileSync(process.execPath, [CLI_BIN, ...args], {
    cwd: dir,
    encoding: 'utf-8',
    env: { ...process.env, TRAINCTL_LANG: 'pl', ...env },
  })

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'trainctl-bin-'))
  writeFileSync(join(dir, 'trainctl.yaml'), CONFIG, 'utf-8')
})
afterAll(() => rmSync(dir, { recursive: true, force: true }))

describe('binarka CLI pod natywnym Node', () => {
  it('--help działa (parsowanie całego drzewa komend)', () => {
    const out = run(['--help'])
    for (const cmd of ['plan', 'today', 'week', 'log', 'shift', 'why', 'diff', 'push', 'pull', 'review']) {
      expect(out).toContain(cmd)
    }
  })

  it('review poza TTY: czysty tekst bez ANSI, działa bez klucza', () => {
    run(['plan', '--date', '2026-08-05']) // review potrzebuje planu, niezależnie od kolejności testów
    const out = run(['review', '--date', '2026-08-17'])
    expect(out).toContain('Przed nami')
    expect(out).not.toMatch(/\u001b\[/)
  }, 20_000)

  it('pełna ścieżka plan → today (ładuje core, sync, yaml)', () => {
    expect(run(['plan', '--date', '2026-08-05'])).toContain('Zapisano')
    expect(run(['today', '--date', '2026-08-04'])).toMatch(/tydzień \d+\/\d+/)
  }, 20_000) // dwa starty realnej binarki — domyślne 5 s bywa ciasne na obciążonej maszynie

  it('wybór języka działa na prawdziwej binarce: --lang, TRAINCTL_LANG, domyślny angielski', () => {
    // domyślnie angielski (czyścimy TRAINCTL_LANG, żeby nie dziedziczyć ustawienia z `run`)
    const en = run(['today', '--date', '2026-08-04'], { TRAINCTL_LANG: '' })
    expect(en).toMatch(/week \d+\/\d+/)
    expect(en).not.toMatch(/[ąćęłńóśźż]/)

    // zmienna środowiskowa
    expect(run(['today', '--date', '2026-08-04'])).toMatch(/tydzień \d+\/\d+/)

    // flaga bije zmienną — i to w obie strony
    expect(run(['today', '--date', '2026-08-04', '--lang', 'en'])).toMatch(/week \d+\/\d+/)
    expect(
      run(['today', '--date', '2026-08-04', '--lang', 'pl'], { TRAINCTL_LANG: 'en' }),
    ).toMatch(/tydzień \d+\/\d+/)

    // nieznany język nie wywraca komendy — wraca do angielskiego
    expect(run(['today', '--date', '2026-08-04', '--lang', 'klingon'], { TRAINCTL_LANG: '' }))
      .toMatch(/week \d+\/\d+/)
  }, 40_000)

  it('polskie znaki przechodzą przez potok bez okaleczenia', () => {
    const out = run(['today', '--date', '2026-08-04'])
    expect(out).toMatch(/[ąćęłńóśźż]/)
    // typowe objawy złego kodowania wyjścia na Windows
    expect(out).not.toMatch(/Ã|Ĺ|â€|\?\?\?/)
  })

  it('init --from-intervals bez klucza — instrukcja, nie stack trace', () => {
    const empty = mkdtempSync(join(tmpdir(), 'trainctl-bin-icu-'))
    let output = ''
    try {
      output = execFileSync(process.execPath, [CLI_BIN, 'init', '--from-intervals'], {
        cwd: empty,
        encoding: 'utf-8',
        env: { ...process.env, TRAINCTL_INTERVALS_API_KEY: '' },
      })
    } catch (e) {
      output = String((e as { stdout?: string }).stdout ?? '')
    }
    expect(output).toContain('Developer Settings')
    expect(output).not.toContain('ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX')
    rmSync(empty, { recursive: true, force: true })
  })

  it('push bez klucza API ładuje adapter sync i zwraca instrukcję', () => {
    // interesuje nas, że moduły sync-intervalsicu dają się ZAŁADOWAĆ natywnie
    let output = ''
    try {
      output = run(['push', '--days', '3'])
    } catch (e) {
      output = String((e as { stdout?: string }).stdout ?? '')
    }
    expect(output).toContain('Developer Settings')
    expect(output).not.toContain('ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX')
  })
})

describe('binarka MCP pod natywnym Node', () => {
  it('startuje, odpowiada na initialize i listuje narzędzia', () => {
    const req = [
      JSON.stringify({
        jsonrpc: '2.0', id: 1, method: 'initialize',
        params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 't', version: '0' } },
      }),
      JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
      JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }),
    ].join('\n') + '\n'
    const out = execFileSync(process.execPath, [MCP_BIN], {
      input: req,
      encoding: 'utf-8',
      env: { ...process.env, TRAINCTL_DIR: dir },
      timeout: 30_000,
    })
    expect(out).toContain('"serverInfo"')
    expect(out).toContain('trainctl_push')
    expect(out).toContain('trainctl_today')
  })
})
