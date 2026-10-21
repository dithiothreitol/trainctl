/**
 * Etap D (docs/PLAN-v0.4.md): wykonanie z plików aktywności bez konta (ADR-037)
 * i kontekst z zegarka w przeglądzie — cytowany, nie interpretowany (ADR-027).
 * Wyłącznie syntetyczne dane: żadnych prawdziwych śladów GPS w repozytorium.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { setLocale } from 'trainctl-core'
import { cmdInit, cmdLog, cmdPlan, cmdPull, cmdReview } from './commands.ts'
import type { SyncSnapshot } from './sync.ts'

setLocale('en')

const CONFIG = `athlete:
  recentWeeklyKm: 45
  daysAvailable: [tue, wed, thu, sat, sun]
  results:
    - { date: "2026-03-29", distanceKm: 10, timeSec: 2580 }
goal:
  name: "Half marathon"
  date: "2026-11-29"
  distanceKm: 21.0975
  priority: A
`

/** Prosty ślad biegu na północ: `km` kilometrów w `minutes` minut, start o 07:00 czasu lokalnego. */
function gpxRun(date: string, km: number, minutes: number): string {
  const points = Math.round((minutes * 60) / 10)
  const start = new Date(`${date}T07:00:00`)
  const step = km / 111.195 / points // stopnie szerokości na odcinek
  const pts = Array.from({ length: points + 1 }, (_, i) =>
    `<trkpt lat="${(52 + step * i).toFixed(7)}" lon="21.0000000"><time>${new Date(start.getTime() + i * 10_000).toISOString()}</time></trkpt>`)
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="test"><trk><name>Morning run</name><type>running</type><trkseg>${pts.join('')}</trkseg></trk></gpx>`
}

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'trainctl-files-'))
  writeFileSync(join(dir, 'trainctl.yaml'), CONFIG, 'utf-8')
  expect(cmdPlan(dir, { date: '2026-08-08' }).code).toBe(0)
  mkdirSync(join(dir, 'activities'))
  writeFileSync(join(dir, 'activities', 'run.gpx'), gpxRun('2026-08-11', 8, 41), 'utf-8')
  writeFileSync(join(dir, 'activities', 'broken.fit'), 'not a fit file', 'utf-8')
})
afterEach(() => rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }))

const snapshot = () => JSON.parse(readFileSync(join(dir, 'sync.json'), 'utf-8')) as SyncSnapshot

describe('pull --from: wykonanie z eksportu plików', () => {
  it('czyta GPX, zapisuje migawkę, porównuje z planem i nazywa pominięte pliki', async () => {
    const r = await cmdPull(dir, { from: 'activities', date: '2026-08-16', days: '7' })
    expect(r.code).toBe(0)
    expect(r.output).toContain('Pulled from activity files (activities)')
    expect(r.output).toContain('1 file was skipped')
    expect(r.output).toContain('broken.fit')
    const [run] = snapshot().activities
    expect(run).toMatchObject({ date: '2026-08-11', type: 'Run', source: 'file' })
    expect(run!.distanceKm).toBeCloseTo(8, 0)
    expect(r.data).toMatchObject({ source: 'files' })
  })

  it('brak katalogu: czytelny błąd zamiast wyjątku systemowego', async () => {
    const r = await cmdPull(dir, { from: 'nope' })
    expect(r.code).toBe(1)
    expect(r.output).toContain('No activity export at nope')
  })

  it('review bez klucza czyta sync.files z profilu', async () => {
    writeFileSync(join(dir, 'trainctl.yaml'), `${CONFIG}sync:\n  files: ./activities\n`, 'utf-8')
    const r = await cmdReview(dir, { date: '2026-08-16' })
    expect(r.code).toBe(0)
    expect(r.output).toContain('Refreshed from activity files (activities)')
    expect(r.output).not.toContain('No API key')
    const execution = r.data!['execution'] as { date: string; status: string }[]
    expect(execution.find((e) => e.date === '2026-08-11')).toMatchObject({ status: 'done' })
  })

  it('init dopisuje activities/ do .gitignore — ślady GPS nie trafiają do repozytorium', () => {
    const other = mkdtempSync(join(tmpdir(), 'trainctl-files-init-'))
    try {
      cmdInit(other)
      expect(readFileSync(join(other, '.gitignore'), 'utf-8')).toContain('activities/')
    } finally {
      rmSync(other, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
    }
  })
})

describe('przegląd: kontekst z zegarka cytowany, nie interpretowany', () => {
  const writeSnapshot = (s: Partial<SyncSnapshot>) =>
    writeFileSync(join(dir, 'sync.json'), JSON.stringify({ pulledAt: '2026-08-16', activities: [], wellness: [], ...s }), 'utf-8')

  it('tętno spoczynkowe, sen i masa z dni przeglądu; bez HRV i CTL/ATL', async () => {
    writeSnapshot({ wellness: [
      { date: '2026-08-12', restingHr: 46, sleepSec: 25_800, hrv: 88, ctl: 51, atl: 60 },
      { date: '2026-08-14', weightKg: 71.2 },
      { date: '2026-08-01', restingHr: 40 },
    ] })
    const r = await cmdReview(dir, { date: '2026-08-16' })
    expect(r.output).toContain('From your watch (quoted, not interpreted)')
    expect(r.output).toContain('2026-08-12 · resting HR 46 · sleep 7:10')
    expect(r.output).toContain('2026-08-14 · 71.2 kg')
    expect(r.output).not.toContain('2026-08-01 · resting HR')
    expect(r.output).not.toMatch(/HRV|CTL|ATL/)
  })

  it('RPE z huba tylko tam, gdzie dziennik go nie ma — ze źródłem', async () => {
    writeSnapshot({ activities: [
      { externalId: 'a1', date: '2026-08-11', type: 'Run', distanceKm: 8, rpe: 6, source: 'GARMIN_CONNECT' },
      { externalId: 'a2', date: '2026-08-13', type: 'Run', distanceKm: 10, rpe: 3 },
    ] })
    cmdLog(dir, { date: '2026-08-13', km: '10', rpe: '5', note: 'heavy legs' })
    const r = await cmdReview(dir, { date: '2026-08-16' })
    expect(r.output).toContain('2026-08-11 · RPE 6 · from GARMIN_CONNECT')
    expect(r.output).toContain('RPE 5')
    expect(r.output).not.toContain('RPE 3')
  })
})
