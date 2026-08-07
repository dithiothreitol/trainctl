/** E2E komend CLI na realnych plikach w katalogu tymczasowym. */
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { cmdDiff, cmdInit, cmdLog, cmdPlan, cmdShift, cmdToday, cmdWhy } from './commands.ts'
import { loadPlan } from './planfile.ts'
import { setLocale } from '@trainctl/core'

// Ten plik weryfikuje ZACHOWANIE komend, a asercje czyta się najłatwiej
// po polsku. Kompletność i jakość tłumaczeń pilnują testy i18n.
setLocale('pl')


const TODAY = '2026-08-05'

const CONFIG = `athlete:
  sex: male
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
  targetTimeSec: 12300
`

let dir: string

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'trainctl-e2e-'))
})
afterAll(() => {
  rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
})

describe('trainctl init', () => {
  it('tworzy szablon i nie nadpisuje istniejącego', () => {
    const r = cmdInit(dir)
    expect(r.code).toBe(0)
    expect(existsSync(join(dir, 'trainctl.yaml'))).toBe(true)
    const again = cmdInit(dir)
    expect(again.code).toBe(1)
    expect(again.output).toContain('już istnieje')
  })
})

describe('trainctl plan', () => {
  it('generuje plan.yaml + PLAN.md z predykcją i oceną celu', () => {
    writeFileSync(join(dir, 'trainctl.yaml'), CONFIG, 'utf-8')
    const r = cmdPlan(dir, { date: TODAY })
    expect(r.code).toBe(0)
    expect(r.output).toContain('Predykcja')
    expect(r.output).toContain('mieści się w przedziale predykcji')
    expect(existsSync(join(dir, 'plan/plan.yaml'))).toBe(true)
    const md = readFileSync(join(dir, 'plan/PLAN.md'), 'utf-8')
    expect(md).toContain('# Plan: Maraton testowy')
    expect(md).toContain('Tydzień 1')
    expect(md).toContain('| PN |')
    expect(md).toContain('truchtu')
  })

  it('plan.yaml wczytuje się z powrotem (17 tygodni, race week na końcu)', () => {
    const plan = loadPlan(dir)
    expect(plan.weeks).toHaveLength(17)
    expect(plan.weeks.at(-1)!.skeleton.raceDate).toBe('2026-11-29')
    expect(plan.vdotSource).toBe('result')
  })
})

describe('trainctl today / why', () => {
  it('dzień treningowy: opis jednostki + kind', () => {
    const r = cmdToday(dir, { date: '2026-08-04' }) // wtorek — akcent
    expect(r.code).toBe(0)
    expect(r.output).toContain('interwały')
    expect(r.output).toContain('rozgrzewkowe')
  })

  it('dzień wolny komunikowany wprost', () => {
    const r = cmdToday(dir, { date: '2026-08-03' }) // poniedziałek
    expect(r.output).toContain('Dzień wolny')
  })

  it('data poza planem — czytelny komunikat', () => {
    const r = cmdToday(dir, { date: '2027-05-01' })
    expect(r.output).toContain('poza zakresem planu')
  })

  it('why tłumaczy cel jednostki i cytuje reguły', () => {
    const r = cmdWhy(dir, { date: '2026-08-04' })
    expect(r.code).toBe(0)
    expect(r.output).toContain('I-7')
    expect(r.output).toContain('FOUNDATIONS')
  })

  it('why dla dnia wolnego wyjaśnia odpoczynek', () => {
    const r = cmdWhy(dir, { date: '2026-08-03' })
    expect(r.output).toContain('regeneracji')
  })
})

describe('trainctl log', () => {
  it('loguje wykonanie i today je pokazuje', () => {
    const r = cmdLog(dir, { date: '2026-08-04', status: 'done', time: '58:30', note: 'dobre czucie' })
    expect(r.code).toBe(0)
    const today = cmdToday(dir, { date: '2026-08-04' })
    expect(today.output).toContain('Zalogowano: done')
    expect(today.output).toContain('dobre czucie')
  })

  it('odrzuca datę poza planem i zły status', () => {
    expect(cmdLog(dir, { date: '2030-01-01' }).code).toBe(1)
    expect(cmdLog(dir, { date: '2026-08-04', status: 'meh' }).code).toBe(1)
  })
})

describe('trainctl shift', () => {
  it('zamienia treningi w obrębie tygodnia', () => {
    const before = loadPlan(dir)
    const tueKind = before.weeks[0]!.days[1]!.workout?.kind
    const r = cmdShift(dir, { from: '2026-08-04', to: '2026-08-05' })
    expect(r.code).toBe(0)
    const after = loadPlan(dir)
    expect(after.weeks[0]!.days[2]!.workout?.kind).toBe(tueKind)
    expect(after.changes).toHaveLength(1)
  })

  it('ostrzega przy złamaniu I-7 (akcenty dzień po dniu)', () => {
    // wtorkowy akcent stoi teraz w środę; przesunięcie niedzielnego na czwartek daje gap 1
    const r = cmdShift(dir, { from: '2026-08-09', to: '2026-08-06' })
    expect(r.code).toBe(0)
    expect(r.output).toContain('I-7')
  })

  it('odmawia zmiany między tygodniami', () => {
    const r = cmdShift(dir, { from: '2026-08-05', to: '2026-08-11' })
    expect(r.code).toBe(1)
    expect(r.output).toContain('jednego tygodnia')
  })

  it('chroni dzień startu i dzień przed startem', () => {
    expect(cmdShift(dir, { from: '2026-11-29', to: '2026-11-24' }).code).toBe(1)
    const sharpenerToDayBefore = cmdShift(dir, { from: '2026-11-26', to: '2026-11-28' })
    expect(sharpenerToDayBefore.code).toBe(1)
    expect(sharpenerToDayBefore.output).toContain('przed startem')
  })
})

describe('trainctl diff', () => {
  it('po ręcznych przesunięciach uprzedza o różnicach', () => {
    const r = cmdDiff(dir)
    expect(r.code).toBe(0)
    expect(r.output).toContain('ręczne przesunięcia')
  })

  it('zmiana profilu → widoczne różnice objętości', () => {
    writeFileSync(join(dir, 'trainctl.yaml'), CONFIG.replace('recentWeeklyKm: 55', 'recentWeeklyKm: 65'), 'utf-8')
    const r = cmdDiff(dir)
    expect(r.output).toContain('objętość')
    expect(r.output).toContain('trainctl plan')
  })
})
