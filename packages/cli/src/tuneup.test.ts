/**
 * Starty kontrolne i sprawdziany od strony CLI: konfiguracja, plan, pętla
 * kalibracji (wykonany pomiar → propozycja wpisania wyniku → nowe strefy).
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cmdAdapt, cmdExport, cmdLog, cmdPlan, cmdToday, cmdWhy } from './commands.ts'
import { loadConfig } from './config.ts'
import { loadPlan } from './planfile.ts'
import { setLocale } from '@trainctl/core'

// Ten plik weryfikuje ZACHOWANIE komend, a asercje czyta się najłatwiej
// po polsku. Kompletność i jakość tłumaczeń pilnują testy i18n.
setLocale('pl')


const WITH_RACES = `athlete:
  recentWeeklyKm: 55
  daysAvailable: [tue, wed, thu, sat, sun]
  results:
    - { date: "2026-07-25", distanceKm: 10, timeSec: 2400 }
  tuneUpRaces:
    - { date: "2026-09-05", distanceKm: 10, name: "Bieg Falenicki", priority: B }
    - { date: "2026-10-03", distanceKm: 21.0975, name: "Półmaraton jesienny", priority: C }
goal:
  name: "Maraton testowy"
  date: "2026-11-29"
  distanceKm: 42.195
  priority: A
`

const NO_RACES = `athlete:
  recentWeeklyKm: 55
  daysAvailable: [tue, wed, thu, sat, sun]
  results:
    - { date: "2026-07-25", distanceKm: 10, timeSec: 2400 }
goal:
  name: "Maraton testowy"
  date: "2026-11-29"
  distanceKm: 42.195
  priority: A
`

let dir: string
const setup = (yaml: string) => {
  writeFileSync(join(dir, 'trainctl.yaml'), yaml, 'utf-8')
  cmdPlan(dir, { date: '2026-08-05' })
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'trainctl-tu-'))
})
afterEach(() => rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }))

describe('konfiguracja startów kontrolnych', () => {
  it('wczytuje tuneUpRaces i domyśla priority B', () => {
    writeFileSync(
      dir + '/trainctl.yaml',
      NO_RACES.replace(
        'goal:',
        '  tuneUpRaces:\n    - { date: "2026-09-05", distanceKm: 10 }\ngoal:',
      ),
      'utf-8',
    )
    const config = loadConfig(dir)
    expect(config.athlete.tuneUpRaces).toHaveLength(1)
    expect(config.athlete.tuneUpRaces![0]!.priority).toBe('B')
  })

  it('odrzuca priority A w tuneUpRaces (cel A jest w sekcji goal)', () => {
    writeFileSync(
      dir + '/trainctl.yaml',
      NO_RACES.replace(
        'goal:',
        '  tuneUpRaces:\n    - { date: "2026-09-05", distanceKm: 10, priority: A }\ngoal:',
      ),
      'utf-8',
    )
    expect(() => loadConfig(dir)).toThrow(/priority/)
  })
})

describe('plan ze startami kontrolnymi', () => {
  beforeEach(() => setup(WITH_RACES))

  it('start stoi w planie w swoim dniu, dzień przed jest wolny', () => {
    const plan = loadPlan(dir)
    const days = new Map(plan.weeks.flatMap((w) => w.days).map((d) => [d.date, d]))
    expect(days.get('2026-09-05')!.workout?.kind).toBe('race')
    expect(days.get('2026-09-04')!.workout).toBeUndefined()
  })

  it('trainctl today mówi o starcie, trainctl why cytuje reguły startowe', () => {
    expect(cmdToday(dir, { date: '2026-09-05' }).output).toContain('START')
    const why = cmdWhy(dir, { date: '2026-09-05' }).output
    expect(why).toMatch(/T-1[012]/)
  })

  it('start nie jest eksportowany jako trening na zegarek', () => {
    const r = cmdExport(dir, { what: 'workout', date: '2026-09-05' })
    expect(r.code).toBe(1)
    expect(r.output).toContain('startu')
  })

  it('mając starty, plan nie dokłada sztucznych sprawdzianów (W-13)', () => {
    const plan = loadPlan(dir)
    const tests = plan.weeks.flatMap((w) => w.days).filter((d) => d.workout?.kind === 'test')
    expect(tests).toHaveLength(0)
  })
})

describe('pętla kalibracji: pomiar → wynik → strefy', () => {
  beforeEach(() => setup(WITH_RACES))

  it('wykonany start bez wyniku w results → propozycja wpisania go', () => {
    cmdLog(dir, { date: '2026-09-05', status: 'done', time: '39:20' })
    const r = cmdAdapt(dir, { date: '2026-09-08' })
    expect(r.code).toBe(0)
    expect(r.output).toContain('recalibrate-zones')
    expect(r.output).toContain('2026-09-05')
    expect(r.output).toContain('2360') // 39:20 w sekundach — gotowe do wklejenia
  })

  it('po dopisaniu wyniku propozycja znika, a strefy się zmieniają', () => {
    cmdLog(dir, { date: '2026-09-05', status: 'done', time: '39:20' })
    const before = loadPlan(dir).vdot
    writeFileSync(
      join(dir, 'trainctl.yaml'),
      WITH_RACES.replace(
        '  tuneUpRaces:',
        '    - { date: "2026-09-05", distanceKm: 10, timeSec: 2360 }\n  tuneUpRaces:',
      ),
      'utf-8',
    )
    const r = cmdAdapt(dir, { date: '2026-09-08' })
    expect(r.output).not.toContain('nie ma wyniku w athlete.results')
    cmdPlan(dir, { date: '2026-09-08' })
    expect(loadPlan(dir).vdot).not.toBe(before)
  })

  it('start zaplanowany, ale niewykonany — nie zawraca głowy kalibracją', () => {
    const r = cmdAdapt(dir, { date: '2026-09-08' })
    expect(r.output).not.toContain('nie ma wyniku w athlete.results')
  })
})

describe('sprawdzian jako fallback w planie CLI', () => {
  beforeEach(() => setup(NO_RACES))

  it('bez startów plan zawiera sprawdziany z opisem po polsku', () => {
    const plan = loadPlan(dir)
    const tests = plan.weeks.flatMap((w) => w.days).filter((d) => d.workout?.kind === 'test')
    expect(tests.length).toBeGreaterThanOrEqual(1)
    expect(tests[0]!.workout!.segments[1]!.description).toContain('na czas')
  })

  it('sprawdzian eksportuje się na zegarek (w odróżnieniu od startu)', () => {
    const plan = loadPlan(dir)
    const test = plan.weeks.flatMap((w) => w.days).find((d) => d.workout?.kind === 'test')!
    const r = cmdExport(dir, { what: 'workout', date: test.date })
    expect(r.code).toBe(0)
    expect(r.output).toContain('sprawdzian')
    const file = readFileSync(join(dir, 'export', `${test.date}-sprawdzian.fit`))
    expect(file.subarray(8, 12).toString()).toBe('.FIT')
    expect(file.length).toBeGreaterThan(100)
  })

  it('why tłumaczy, skąd sprawdzian się wziął', () => {
    const plan = loadPlan(dir)
    const test = plan.weeks.flatMap((w) => w.days).find((d) => d.workout?.kind === 'test')!
    const why = cmdWhy(dir, { date: test.date }).output
    expect(why).toContain('W-11')
    expect(why).toContain('W-13')
  })
})
