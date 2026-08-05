/** Scenariusze agentowe: klient MCP ↔ serwer w pamięci, realne pliki w tmp. */
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { createTrenServer } from './server.ts'

const CONFIG = `athlete:
  recentWeeklyKm: 55
  peakWeeklyKm: 75
  daysAvailable: [tue, wed, thu, sat, sun]
  longRunDay: sat
  results:
    - { date: "2026-03-30", distanceKm: 21.0975, timeSec: 5400, name: "HM" }
goal:
  name: "Maraton testowy"
  date: "2026-11-29"
  distanceKm: 42.195
  priority: A
`

let dir: string
let client: Client

async function call(name: string, args: Record<string, unknown> = {}) {
  const res = await client.callTool({ name, arguments: args })
  const content = res.content as { type: string; text: string }[]
  return { text: content.map((c) => c.text).join('\n'), isError: res.isError === true }
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'tren-mcp-'))
  writeFileSync(join(dir, 'tren.yaml'), CONFIG, 'utf-8')
  const server = createTrenServer(dir)
  client = new Client({ name: 'test-agent', version: '0.0.0' })
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])
})

afterAll(async () => {
  await client.close()
  rmSync(dir, { recursive: true, force: true })
})

describe('serwer MCP tren', () => {
  it('wystawia komplet 14 narzędzi', async () => {
    const { tools } = await client.listTools()
    const names = tools.map((t) => t.name).sort()
    expect(names).toEqual([
      'tren_adapt', 'tren_desk', 'tren_diff', 'tren_export', 'tren_init', 'tren_log', 'tren_plan',
      'tren_pull', 'tren_push', 'tren_reschedule', 'tren_shift', 'tren_today', 'tren_week', 'tren_why',
    ])
  })


  it('agent generuje plan i dostaje predykcję', async () => {
    const r = await call('tren_plan', { date: '2026-08-05' })
    expect(r.isError).toBe(false)
    expect(r.text).toContain('Predykcja')
    expect(existsSync(join(dir, 'plan/PLAN.md'))).toBe(true)
  })

  it('agent pyta o dziś i o „why"', async () => {
    const today = await call('tren_today', { date: '2026-08-04' })
    expect(today.text).toContain('interwały')
    const why = await call('tren_why', { date: '2026-08-04' })
    expect(why.text).toContain('I-7')
    expect(why.text).toContain('FOUNDATIONS')
  })

  it('scenariusz renegocjacji: week → shift → week', async () => {
    const before = await call('tren_week', { date: '2026-08-04' })
    expect(before.text).toContain('Tydzień 1/17')
    expect(before.text).toMatch(/08-04.*3 kilometry/)

    const shift = await call('tren_shift', { from: '2026-08-04', to: '2026-08-05' })
    expect(shift.isError).toBe(false)
    expect(shift.text).toContain('Zamieniono')

    const after = await call('tren_week', { date: '2026-08-04' })
    expect(after.text).toMatch(/08-05.*3 kilometry/)
  })

  it('shift odmawia ruszenia dnia startu (isError)', async () => {
    const r = await call('tren_shift', { from: '2026-11-29', to: '2026-11-24' })
    expect(r.isError).toBe(true)
    expect(r.text).toContain('startu')
  })

  it('walidacja schematu: zła data odrzucona przed handlerem', async () => {
    const r = await call('tren_today', { date: 'jutro' })
    expect(r.isError).toBe(true)
    expect(r.text).toContain('YYYY-MM-DD')
  })

  it('agent loguje wykonanie i widzi status w week', async () => {
    const log = await call('tren_log', {
      date: '2026-08-05', status: 'done', time: '52:00', note: 'po pracy, ciężko',
    })
    expect(log.isError).toBe(false)
    const week = await call('tren_week', { date: '2026-08-05' })
    expect(week.text).toContain('[done]')
  })

  it('agent prosi o adaptację i dostaje propozycje, nie zmieniony plan', async () => {
    const r = await call('tren_adapt', { date: '2026-08-20' })
    expect(r.isError).toBe(false)
    expect(r.text).toContain('Propozycje:')
    expect(r.text).toMatch(/Analiza wykonania · \d+ dni/)
  })

  it('„w czwartek mam release" — agent przestawia cały tydzień z uzasadnieniem', async () => {
    const preview = await call('tren_reschedule', { block: ['2026-08-20'], date: '2026-08-20' })
    expect(preview.isError).toBe(false)
    expect(preview.text).toContain('Co się zmienia')
    expect(preview.text).toContain('to podgląd')

    const weekBefore = await call('tren_week', { date: '2026-08-20' })
    expect(weekBefore.text).toMatch(/08-20/)

    const applied = await call('tren_reschedule', {
      block: ['2026-08-20'], date: '2026-08-20', apply: true,
    })
    expect(applied.text).toContain('Zastosowano')

    const weekAfter = await call('tren_week', { date: '2026-08-20' })
    const line = weekAfter.text.split('\n').find((l) => l.includes('08-20'))!
    expect(line).toContain('wolne')
  })

  it('sync bez klucza API: czytelna instrukcja, nie crash serwera', async () => {
    const r = await call('tren_push', { days: '7' })
    expect(r.isError).toBe(true)
    expect(r.text).toContain('Developer Settings')
  })

  it('diff uprzedza o ręcznych zmianach planu', async () => {
    const r = await call('tren_diff')
    expect(r.isError).toBe(false)
    expect(r.text).toContain('ręczne przesunięcia')
  })
})
