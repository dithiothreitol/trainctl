/**
 * PLAN-v0.7 E3: `init` zakłada profil v2 domyślnie. Szablon, kreator i migracja niosą
 * wszystkie pola profilu biegowego (płeć, HRmax, powrót, siła, czas docelowy), a plan
 * z takiego profilu idzie silnikiem biegowym i ścieżką komend planu biegowego (E4).
 */
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parse } from 'yaml'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { setLocale, type SportsConfig } from 'trainctl-core'
import { cmdInit, cmdMigrate, cmdPlan, cmdWhy } from './commands.ts'
import { runningView } from './running-view.ts'
import { isSportsWorkspace, loadSportsPlan, sportsYamlFromRunning } from './sports-store.ts'
import { cmdStatus } from './status.ts'
import { toYaml } from './ui/wizard.ts'

let dir: string
const saved = process.env['TRAINCTL_TODAY']
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'trainctl-init-v2-'))
  process.env['TRAINCTL_TODAY'] = '2026-08-03'
  setLocale('pl')
})
afterEach(() => {
  rmSync(dir, { recursive: true, force: true, maxRetries: 3 })
  if (saved === undefined) delete process.env['TRAINCTL_TODAY']
  else process.env['TRAINCTL_TODAY'] = saved
})

const config = (): SportsConfig => parse(readFileSync(join(dir, 'trainctl.yaml'), 'utf8')) as SportsConfig

describe('E3: init zakłada profil v2', () => {
  it('szablon: profil v2 z silnikiem biegowym; plan v2 i komendy planu biegowego', () => {
    expect(cmdInit(dir).code).toBe(0)
    expect(config().schemaVersion).toBe(2)
    expect(config().athlete.sports.run?.running?.recentWeeklyKm).toBe(45)
    expect(isSportsWorkspace(dir)).toBe(true)
    const plan = cmdPlan(dir)
    expect(plan.code, plan.output).toBe(0)
    expect(loadSportsPlan(dir).legacy?.generatorPlan).toBeDefined()
    // predykcja i VDOT jak w planie biegowym, `why` i `status` ścieżką planu biegowego
    expect(plan.output).toContain('VDOT')
    const first = loadSportsPlan(dir).sessions.find((s) => s.sport === 'run')!
    expect(cmdWhy(dir, { date: first.date }).data).toHaveProperty('explanation')
    expect(cmdStatus(dir).data).toHaveProperty('schemaVersion', 2)
  })

  it('kreator: odpowiedzi w profilu v2 — płeć, HRmax, powrót, czas docelowy, dzień pracy i mile', () => {
    const yaml = sportsYamlFromRunning(toYaml({
      goalName: 'Półmaraton', goalDate: '2026-11-29', goalDistanceKm: 21.0975, targetTimeSec: 6300,
      recentWeeklyKm: 40, peakWeeklyKm: 55, returning: { since: '2026-07-01', previousWeeklyKm: 45 },
      daysAvailable: ['tue', 'thu', 'sat', 'sun'], longRunDay: 'sun',
      resultDate: '2026-05-10', resultDistanceKm: 10, resultTimeSec: 2700,
      desk: { workStart: '08:00', workEnd: '16:00' }, units: 'imperial', hrMax: { bpm: 188, measured: true }, sex: 'female',
    }))
    expect(cmdInit(dir, yaml).code).toBe(0)
    const c = config()
    expect(c.schemaVersion).toBe(2)
    expect(c.units).toBe('imperial')
    expect(c.goal).toMatchObject({ kind: 'race', sport: 'run', distanceM: 21097.5, targetTimeSec: 6300 })
    expect(c.athlete.sports.run).toMatchObject({ daysAvailable: ['tue', 'thu', 'sat', 'sun'], results: [{ date: '2026-05-10', distanceKm: 10, timeSec: 2700 }] })
    expect(c.athlete.sports.run!.running).toMatchObject({ recentWeeklyKm: 40, peakWeeklyKm: 55, longRunDay: 'sun', sex: 'female', hrMax: { bpm: 188, measured: true }, returning: { since: '2026-07-01', previousWeeklyKm: 45 } })
    expect(c.desk).toMatchObject({ workStart: '08:00', workEnd: '16:00' })
    expect(cmdPlan(dir).code).toBe(0)
    // profil planu biegowego w widoku: te same pola co w profilu z kreatora planu biegowego
    const view = runningView(dir)!.config
    expect(view.athlete).toMatchObject({ sex: 'female', hrMax: { bpm: 188, measured: true }, returning: { since: '2026-07-01', previousWeeklyKm: 45 } })
    expect(view.goal.targetTimeSec).toBe(6300)
    expect(view.desk).toMatchObject({ workStart: '08:00' })
  })

  it('migracja przenosi płeć, HRmax, siłę i czas docelowy do profilu v2', () => {
    expect(cmdInit(dir, `athlete:
  sex: male
  hrMax: { bpm: 190, measured: false }
  recentWeeklyKm: 35
  daysAvailable: [tue, thu, sat, sun]
  results:
    - { date: "2026-06-01", distanceKm: 10, timeSec: 2900 }
goal:
  name: Maraton
  date: "2026-12-06"
  distanceKm: 42.195
  targetTimeSec: 13800
strength:
  enabled: true
  days: [mon, fri]
`).code).toBe(0)
    expect(cmdPlan(dir).code).toBe(0)
    const id = (cmdMigrate(dir).data!['proposal'] as { id: string }).id
    expect(cmdMigrate(dir, { apply: id }).code).toBe(0)
    const c = config()
    expect(c.athlete.sports.run!.running).toMatchObject({ sex: 'male', hrMax: { bpm: 190, measured: false }, strength: { enabled: true, days: ['mon', 'fri'] } })
    expect(c.goal.targetTimeSec).toBe(13800)
    // regeneracja z profilu v2 zostawia siłę w planie
    expect(cmdPlan(dir).code).toBe(0)
    expect(loadSportsPlan(dir).sessions.some((s) => s.sport === 'strength')).toBe(true)
  })
})
