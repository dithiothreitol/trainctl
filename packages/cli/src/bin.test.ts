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
const run = (args: string[]) =>
  execFileSync(process.execPath, [CLI_BIN, ...args], { cwd: dir, encoding: 'utf-8' })

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'tren-bin-'))
  writeFileSync(join(dir, 'tren.yaml'), CONFIG, 'utf-8')
})
afterAll(() => rmSync(dir, { recursive: true, force: true }))

describe('binarka CLI pod natywnym Node', () => {
  it('--help działa (parsowanie całego drzewa komend)', () => {
    const out = run(['--help'])
    for (const cmd of ['plan', 'today', 'week', 'log', 'shift', 'why', 'diff', 'push', 'pull']) {
      expect(out).toContain(cmd)
    }
  })

  it('pełna ścieżka plan → today (ładuje core, sync, yaml)', () => {
    expect(run(['plan', '--date', '2026-08-05'])).toContain('Zapisano')
    expect(run(['today', '--date', '2026-08-04'])).toMatch(/tydzień \d+\/\d+/)
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
      env: { ...process.env, TREN_DIR: dir },
      timeout: 30_000,
    })
    expect(out).toContain('"serverInfo"')
    expect(out).toContain('tren_push')
    expect(out).toContain('tren_today')
  })
})
