/**
 * `trainctl diff --plan` — porównanie scenariuszowe (plan spekulatywny):
 * dwa pełne plany (np. z dwóch gałęzi gita) zestawione zanim zapadnie decyzja.
 * Scenariusz z testu: „co jeśli przełożę maraton o trzy tygodnie?"
 */
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { setLocale } from '@trainctl/core'
import { cmdDiff, cmdPlan } from './commands.ts'
import { PLAN_YAML } from './planfile.ts'

setLocale('pl')

const TODAY = '2026-08-05'

const config = (raceDate: string) => `athlete:
  recentWeeklyKm: 55
  peakWeeklyKm: 75
  daysAvailable: [tue, wed, thu, sat, sun]
  longRunDay: sat
  results:
    - { date: "2026-03-30", distanceKm: 21.0975, timeSec: 5400 }
goal:
  name: "Maraton testowy"
  date: "${raceDate}"
  distanceKm: 42.195
  priority: A
`

let dir: string
let scenarioDir: string

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'trainctl-diffplan-'))
  writeFileSync(join(dir, 'trainctl.yaml'), config('2026-11-29'), 'utf-8')
  cmdPlan(dir, { date: TODAY })
  // scenariusz: ten sam profil, start trzy tygodnie później — jak na gałęzi gita
  scenarioDir = join(dir, 'scenariusz')
  mkdirSync(scenarioDir)
  writeFileSync(join(scenarioDir, 'trainctl.yaml'), config('2026-12-20'), 'utf-8')
  cmdPlan(scenarioDir, { date: TODAY })
})
afterAll(() => {
  rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
})

describe('trainctl diff --plan (plan spekulatywny)', () => {
  it('kopia planu: identyczne, kod 0', () => {
    copyFileSync(join(dir, PLAN_YAML), join(dir, 'kopia.yaml'))
    const r = cmdDiff(dir, { plan: 'kopia.yaml' })
    expect(r.code).toBe(0)
    expect(r.output).toContain('identyczne')
  })

  it('scenariusz z przesuniętym startem: cel + nowe tygodnie, nic o regeneracji', () => {
    const r = cmdDiff(dir, { plan: join(scenarioDir, PLAN_YAML) })
    expect(r.code).toBe(0)
    expect(r.output).toContain('cel: Maraton testowy, 2026-11-29 → Maraton testowy, 2026-12-20')
    // trzy dodatkowe tygodnie planu widoczne jako nowe
    expect(r.output).toContain('+ tydzień 2026-12-14')
    // układ tygodni wspólnych też się zmienia (taper przesunięty) — jest co czytać
    expect(r.output).toMatch(/~ /)
    // to nie jest tryb „regeneracja z trainctl.yaml”
    expect(r.output).not.toContain('trainctl plan')
  })

  it('ścieżka względna liczona od katalogu treningowego', () => {
    const r = cmdDiff(dir, { plan: join('scenariusz', PLAN_YAML) })
    expect(r.code).toBe(0)
    expect(r.output).toContain('cel: ')
  })

  it('brak pliku: czytelny błąd z podpowiedzią git show', () => {
    const r = cmdDiff(dir, { plan: 'nie-ma.yaml' })
    expect(r.code).toBe(1)
    expect(r.output).toContain('git show')
  })
})
