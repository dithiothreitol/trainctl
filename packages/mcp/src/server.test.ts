/** Scenariusze agentowe: klient MCP ↔ serwer w pamięci, realne pliki w tmp. */
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { addDays, mondayOf, type SyncProvider, type SyncedActivity } from 'trainctl-core'
import { localToday } from 'trainctl'
import { createTrainctlServer } from './server.ts'
import { setLocale } from 'trainctl-core'

// Scenariusze agentowe czytamy po polsku — tak brzmią też opisy w planie
// użytkownika, gdy ma language: pl. Wybór języka testuje i18n.test.ts.
setLocale('pl')


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
  dir = mkdtempSync(join(tmpdir(), 'trainctl-mcp-'))
  writeFileSync(join(dir, 'trainctl.yaml'), CONFIG, 'utf-8')
  const server = createTrainctlServer(dir)
  client = new Client({ name: 'test-agent', version: '0.0.0' })
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])
})

afterAll(async () => {
  await client.close()
  rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
})

describe('serwer MCP trainctl', () => {
  it('wystawia komplet 16 narzędzi', async () => {
    const { tools } = await client.listTools()
    const names = tools.map((t) => t.name).sort()
    expect(names).toEqual([
      'trainctl_adapt', 'trainctl_check', 'trainctl_desk', 'trainctl_diff', 'trainctl_export', 'trainctl_init', 'trainctl_log',
      'trainctl_plan', 'trainctl_pull', 'trainctl_push', 'trainctl_reschedule', 'trainctl_review', 'trainctl_shift',
      'trainctl_today', 'trainctl_week', 'trainctl_why',
    ])
  })

  it('trainctl_review: agent dostaje cały poniedziałkowy rytuał w jednym wywołaniu', async () => {
    await call('trainctl_plan', { date: '2026-08-05' }) // review czyta plan — nie zależymy od kolejności testów
    const r = await call('trainctl_review', { date: '2026-08-17' })
    expect(r.isError).toBe(false)
    expect(r.text).toContain('Za nami')
    expect(r.text).toContain('Przed nami')
    expect(r.text).toContain('Do zrobienia')
    expect(r.text).not.toContain('[') // MCP nigdy nie dostaje ANSI (ADR-013)
  })


  it('agent generuje plan i dostaje predykcję', async () => {
    const r = await call('trainctl_plan', { date: '2026-08-05' })
    expect(r.isError).toBe(false)
    expect(r.text).toContain('Predykcja')
    expect(existsSync(join(dir, 'plan/PLAN.md'))).toBe(true)
  })

  it('agent pyta o dziś i o „why"', async () => {
    const today = await call('trainctl_today', { date: '2026-08-04' })
    expect(today.text).toContain('interwały')
    const why = await call('trainctl_why', { date: '2026-08-04' })
    expect(why.text).toContain('I-7')
    expect(why.text).toContain('FOUNDATIONS')
  })

  it('scenariusz renegocjacji: week → shift → week', async () => {
    const before = await call('trainctl_week', { date: '2026-08-04' })
    expect(before.text).toContain('Tydzień 1/17')
    expect(before.text).toMatch(/08-04.*3 kilometry/)

    const shift = await call('trainctl_shift', { from: '2026-08-04', to: '2026-08-05' })
    expect(shift.isError).toBe(false)
    expect(shift.text).toContain('Zamieniono')

    const after = await call('trainctl_week', { date: '2026-08-04' })
    expect(after.text).toMatch(/08-05.*3 kilometry/)
  })

  it('shift odmawia ruszenia dnia startu (isError)', async () => {
    const r = await call('trainctl_shift', { from: '2026-11-29', to: '2026-11-24' })
    expect(r.isError).toBe(true)
    expect(r.text).toContain('startu')
  })

  it('walidacja schematu: zła data odrzucona przed handlerem', async () => {
    const r = await call('trainctl_today', { date: 'jutro' })
    expect(r.isError).toBe(true)
    expect(r.text).toContain('RRRR-MM-DD')
  })

  it('agent loguje wykonanie i widzi status w week', async () => {
    const log = await call('trainctl_log', {
      date: '2026-08-05', status: 'done', time: '52:00', note: 'po pracy, ciężko',
    })
    expect(log.isError).toBe(false)
    const week = await call('trainctl_week', { date: '2026-08-05' })
    expect(week.text).toContain('[done]')
  })

  it('agent prosi o adaptację i dostaje propozycje, nie zmieniony plan', async () => {
    const r = await call('trainctl_adapt', { date: '2026-08-20' })
    expect(r.isError).toBe(false)
    expect(r.text).toContain('Propozycje:')
    expect(r.text).toMatch(/Analiza wykonania · \d+ dni/)
  })

  it('„w czwartek mam release" — agent przestawia cały tydzień z uzasadnieniem', async () => {
    const preview = await call('trainctl_reschedule', { block: ['2026-08-20'], date: '2026-08-20' })
    expect(preview.isError).toBe(false)
    expect(preview.text).toContain('Co się zmienia')
    expect(preview.text).toContain('to podgląd')

    const weekBefore = await call('trainctl_week', { date: '2026-08-20' })
    expect(weekBefore.text).toMatch(/08-20/)

    const applied = await call('trainctl_reschedule', {
      block: ['2026-08-20'], date: '2026-08-20', apply: true,
    })
    expect(applied.text).toContain('Zastosowano')

    const weekAfter = await call('trainctl_week', { date: '2026-08-20' })
    const line = weekAfter.text.split('\n').find((l) => l.includes('08-20'))!
    expect(line).toContain('wolne')
  })

  it('sync bez klucza API: czytelna instrukcja, nie crash serwera', async () => {
    const r = await call('trainctl_push', { days: '7' })
    expect(r.isError).toBe(true)
    expect(r.text).toContain('Developer Settings')
  })

  it('diff uprzedza o ręcznych zmianach planu', async () => {
    const r = await call('trainctl_diff')
    expect(r.isError).toBe(false)
    expect(r.text).toContain('ręczne przesunięcia')
  })
})

describe('trainctl_init fromIntervals — profil z historii przez agenta', () => {
  // handler MCP używa prawdziwego „dziś" — historia musi być względna do daty uruchomienia testu
  const TODAY_MONDAY = mondayOf(localToday())
  let icuDir: string
  let icuClient: Client

  const history: SyncedActivity[] = Array.from({ length: 16 }, (_, i) => {
    const monday = addDays(TODAY_MONDAY, -7 * (i + 1))
    return [
      { externalId: `w${i}a`, date: addDays(monday, 1), type: 'Run', distanceKm: 8, movingTimeSec: 2640 },
      { externalId: `w${i}b`, date: addDays(monday, 3), type: 'Run', distanceKm: 10, movingTimeSec: 3300 },
      { externalId: `w${i}c`, date: addDays(monday, 5), type: 'Run', distanceKm: 18, movingTimeSec: 5940 },
    ]
  }).flat()

  const provider: SyncProvider = {
    name: 'intervals.icu (test)',
    verify: async () => ({ athleteId: 'i0' }),
    listActivities: async (oldest, newest) =>
      history.filter((a) => a.date >= oldest && a.date <= newest),
    listWellness: async () => [],
    pushWorkouts: async () => ({ pushed: 0, externalIds: [] }),
    listPlannedWorkouts: async () => [],
    deleteWorkout: async () => {},
  }

  beforeAll(async () => {
    icuDir = mkdtempSync(join(tmpdir(), 'trainctl-mcp-icu-'))
    const server = createTrainctlServer(icuDir, () => provider)
    icuClient = new Client({ name: 'test-agent', version: '0.0.0' })
    const [ct, st] = InMemoryTransport.createLinkedPair()
    await Promise.all([server.connect(st), icuClient.connect(ct)])
  })

  afterAll(async () => {
    await icuClient.close()
    rmSync(icuDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
  })

  it('tworzy trainctl.yaml z proweniencją; agent dostaje instrukcję potwierdzania', async () => {
    const res = await icuClient.callTool({ name: 'trainctl_init', arguments: { fromIntervals: true } })
    expect(res.isError).not.toBe(true)
    const yaml = readFileSync(join(icuDir, 'trainctl.yaml'), 'utf-8')
    expect(yaml).toContain('recentWeeklyKm: 36')
    expect(yaml).toContain('intervals.icu')
    expect(yaml).toContain('UZUPEŁNIJ')
  })
})
