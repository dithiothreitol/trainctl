/** Testy komend sync z wstrzykniętym providerem — bez sieci i bez klucza. */
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { PushableWorkout, SyncProvider, SyncedActivity } from 'trainctl-core'
import { cmdPlan, cmdPull, cmdPush } from './commands.ts'
import { loadPlan } from './planfile.ts'
import { compare, readApiKey, workoutsToPush, SECRET_FILE } from './sync.ts'
import { setLocale } from 'trainctl-core'

// Ten plik weryfikuje ZACHOWANIE komend, a asercje czyta się najłatwiej
// po polsku. Kompletność i jakość tłumaczeń pilnują testy i18n.
setLocale('pl')


const CONFIG = `athlete:
  recentWeeklyKm: 55
  daysAvailable: [tue, wed, thu, sat, sun]
  results:
    - { date: "2026-03-30", distanceKm: 21.0975, timeSec: 5400 }
goal:
  name: "Maraton testowy"
  date: "2026-11-29"
  distanceKm: 42.195
  priority: A
`

let dir: string
let pushed: PushableWorkout[] = []
const activities: SyncedActivity[] = [
  { externalId: 'a1', date: '2026-08-04', type: 'Run', distanceKm: 12.3 },
  { externalId: 'a2', date: '2026-08-08', type: 'Run', distanceKm: 8.0 },
  { externalId: 'a3', date: '2026-08-03', type: 'Run', distanceKm: 6.0 }, // dzień wolny
]

let remotePlanned: { id: string; date: string; externalId?: string }[] = []
const deleted: string[] = []

const fakeProvider: SyncProvider = {
  name: 'intervals.icu (test)',
  listPlannedWorkouts: async () => remotePlanned,
  deleteWorkout: async (id) => {
    deleted.push(id)
    remotePlanned = remotePlanned.filter((r) => r.id !== id)
  },
  verify: async () => ({ athleteId: 'i0' }),
  listActivities: async (oldest, newest) =>
    activities.filter((a) => a.date >= oldest && a.date <= newest),
  listWellness: async () => [{ date: '2026-08-04', restingHr: 45, hrv: 90 }],
  pushWorkouts: async (w) => {
    pushed = w
    return { pushed: w.length, externalIds: w.map((x) => x.externalId) }
  },
}
const factory = () => fakeProvider

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'trainctl-sync-'))
  writeFileSync(join(dir, 'trainctl.yaml'), CONFIG, 'utf-8')
  cmdPlan(dir, { date: '2026-08-05' })
})
afterAll(() => rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }))

describe('klucz API', () => {
  it('czyta z pliku .trainctl-secret', () => {
    writeFileSync(join(dir, SECRET_FILE), 'sekretny-klucz\n', 'utf-8')
    expect(readApiKey(dir)).toBe('sekretny-klucz')
  })

  it('bez klucza — instrukcja, nie stack trace', () => {
    const empty = mkdtempSync(join(tmpdir(), 'trainctl-nokey-'))
    expect(() => readApiKey(empty)).toThrow(/Developer Settings/)
    rmSync(empty, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
  })
})

describe('trainctl push', () => {
  it('wypycha treningi z zakresu, pomija dni wolne i starty', async () => {
    const r = await cmdPush(dir, { from: '2026-08-03', to: '2026-08-09' }, factory)
    expect(r.code).toBe(0)
    expect(r.output).toContain('Wypchnięto')
    expect(pushed.length).toBeGreaterThanOrEqual(4)
    for (const w of pushed) {
      expect(w.date >= '2026-08-03' && w.date <= '2026-08-09').toBe(true)
      expect(w.description.length).toBeGreaterThan(0)
    }
    // poniedziałek jest dniem wolnym w house style — nie ma go w pushu
    expect(pushed.some((w) => w.date === '2026-08-03')).toBe(false)
  })

  it('tydzień startowy: start nie jest wypychany jako trening', () => {
    const plan = loadPlan(dir)
    const raceWeek = plan.weeks.at(-1)!
    const ws = workoutsToPush(plan, raceWeek.weekStart, plan.goal.date)
    expect(ws.some((w) => w.date === plan.goal.date)).toBe(false)
  })

  it('usuwa nieaktualne wpisy po przesunięciu treningu (duch na zegarku)', async () => {
    remotePlanned = [
      { id: 'e1', date: '2026-08-04', externalId: 'trainctl-2026-08-04' },
      { id: 'e-stale', date: '2026-08-03', externalId: 'trainctl-2026-08-03' }, // dzień wolny w planie
      { id: 'e-obcy', date: '2026-08-05', externalId: 'moj-wlasny-trening' },
    ]
    deleted.length = 0
    const r = await cmdPush(dir, { from: '2026-08-03', to: '2026-08-09' }, factory)
    expect(r.code).toBe(0)
    expect(deleted).toContain('e-stale')
    expect(r.output).toContain('Usunięto')
    // wpisów spoza trainctl nie ruszamy
    expect(deleted).not.toContain('e-obcy')
  })

  it('błąd sprzątania nie wywraca pushu', async () => {
    const breaking = () => ({
      ...fakeProvider,
      listPlannedWorkouts: async () => {
        throw new Error('brak uprawnień')
      },
    })
    const r = await cmdPush(dir, { from: '2026-08-03', to: '2026-08-09' }, breaking)
    expect(r.code).toBe(0)
    expect(r.output).toContain('Wypchnięto')
  })

  it('pusty zakres — komunikat zamiast wywołania API', async () => {
    const r = await cmdPush(dir, { from: '2027-01-01', to: '2027-01-07' }, factory)
    expect(r.output).toContain('Brak treningów')
  })
})

describe('trainctl pull', () => {
  it('zapisuje migawkę i raportuje rozjazdy', async () => {
    const r = await cmdPull(dir, { days: '5' }, factory)
    expect(r.code).toBe(0)
    expect(r.output).toContain('Aktywności')
    expect(existsSync(join(dir, 'sync.json'))).toBe(true)
    const snap = JSON.parse(readFileSync(join(dir, 'sync.json'), 'utf-8'))
    expect(snap.activities.length).toBeGreaterThan(0)
    expect(snap.wellness[0].hrv).toBe(90)
  })
})

describe('porównanie plan ↔ wykonanie', () => {
  const plan = () => loadPlan(dir)

  it('klasyfikuje status dnia', () => {
    const rows = compare(plan(), activities, '2026-08-03', '2026-08-09')
    const byDate = new Map(rows.map((r) => [r.date, r]))
    expect(byDate.get('2026-08-03')!.status).toBe('unplanned') // wolne, a biegał
    const tue = byDate.get('2026-08-04')!
    expect(['matched', 'shorter', 'longer']).toContain(tue.status)
    expect(byDate.get('2026-08-06')?.status).toBe('missed')
  })

  it('dni bez planu i bez wykonania są pomijane', () => {
    const rows = compare(plan(), [], '2026-08-03', '2026-08-09')
    expect(rows.some((r) => r.date === '2026-08-03')).toBe(false)
  })
})
