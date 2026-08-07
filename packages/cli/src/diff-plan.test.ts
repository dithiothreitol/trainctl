/**
 * `trainctl diff --plan` — porównanie scenariuszowe (plan spekulatywny):
 * dwa pełne plany (np. z dwóch gałęzi gita) zestawione zanim zapadnie decyzja.
 * Scenariusz z testu: „co jeśli przełożę maraton o trzy tygodnie?"
 */
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { stringify } from 'yaml'
import { setLocale, weekTotals } from 'trainctl-core'
import { cmdDiff, cmdPlan } from './commands.ts'
import { loadPlan, PLAN_YAML } from './planfile.ts'

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
    expect(r.output).toContain(
      'cel: Maraton testowy, 42,2 km, 2026-11-29 → Maraton testowy, 42,2 km, 2026-12-20',
    )
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

  it('plik bez planu (pusty, zły git show): czytelny błąd zamiast wyjątku', () => {
    writeFileSync(join(dir, 'pusty.yaml'), '', 'utf-8')
    const r = cmdDiff(dir, { plan: 'pusty.yaml' })
    expect(r.code).toBe(1)
    expect(r.output).toContain('to nie jest plik planu')
    expect(r.output).not.toMatch(/Cannot read|undefined/)
  })
})

/**
 * Scenariusz zmienia zwykle objętość, a nie rodzaje jednostek — porównanie po
 * samych rodzajach mówiłoby „identyczne" o planach różnych w każdym dniu.
 */
describe('trainctl diff --plan widzi zmiany poza rodzajem jednostki', () => {
  it('skrócone jednostki i dołożona siła to nie jest „identyczny” plan', () => {
    const plan = loadPlan(dir)
    for (const week of plan.weeks) {
      for (const day of week.days) {
        if (day.workout) {
          day.workout.distanceKm = Math.round(day.workout.distanceKm * 5) / 10
          for (const seg of day.workout.segments) {
            if (seg.distanceKm) seg.distanceKm = Math.round(seg.distanceKm * 5) / 10
          }
        }
        day.strength = { kind: 'heavy', description: 'siła', durationMin: 40, ruleRefs: [] }
      }
      Object.assign(week, weekTotals(week.days))
    }
    writeFileSync(join(dir, 'polowa.yaml'), stringify(plan), 'utf-8')
    const r = cmdDiff(dir, { plan: 'polowa.yaml' })
    expect(r.code).toBe(0)
    expect(r.output).not.toContain('identyczne')
    expect(r.output).toMatch(/~ \d{4}-\d{2}-\d{2}: \w+ [\d,]+ → [\d,]+ km/)
    expect(r.output).toContain('suma dni')
    expect(r.output).toContain('dochodzi siła (40 min)')
  })

  it('przebudowa akcentu przy tej samej objętości: inny układ członów', () => {
    const plan = loadPlan(dir)
    const day = plan.weeks
      .flatMap((w) => w.days)
      .find((d) => d.workout?.kind === 'quality_intervals')
    expect(day).toBeDefined()
    const work = day!.workout!.segments.find((s) => s.type === 'intervals')
    expect(work).toBeDefined()
    // ta sama objętość członu, inny podział na powtórzenia (6×800 → 4×1200)
    work!.reps = (work!.reps ?? 6) - 2
    work!.repM = Math.round(((work!.reps + 2) * (work!.repM ?? 800)) / work!.reps)
    writeFileSync(join(dir, 'inne-odcinki.yaml'), stringify(plan), 'utf-8')
    const r = cmdDiff(dir, { plan: 'inne-odcinki.yaml' })
    expect(r.output).toContain('inny układ członów')
  })

  it('sam dystans startu (maraton → połówka) też jest zmianą celu', () => {
    const plan = loadPlan(dir)
    plan.goal = { ...plan.goal, distanceKm: 21.0975 }
    writeFileSync(join(dir, 'polmaraton.yaml'), stringify(plan), 'utf-8')
    const r = cmdDiff(dir, { plan: 'polmaraton.yaml' })
    expect(r.output).toContain(
      'cel: Maraton testowy, 42,2 km, 2026-11-29 → Maraton testowy, 21,1 km, 2026-11-29',
    )
  })
})
