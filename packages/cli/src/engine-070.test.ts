/**
 * Etap 2 (docs/PLAN-v0.7.md, pakiet B): to, co zmiana silnika pokazuje
 * w komendach — uwagi generatora w `why`, ostrzeżenie o pojemności dni w `plan`.
 * Kształt sezonu na macierzy sprawdza plan-shape.test.ts.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { setLocale } from 'trainctl-core'
import { cmdAdapt, cmdLog, cmdPlan, cmdRules, cmdWhy } from './commands.ts'
import { readLog } from './logfile.ts'
import { loadPlan } from './planfile.ts'
import { inferredConfigYaml } from './config.ts'
import { parse } from 'yaml'

const config = (weeklyKm: number, days: string) => `athlete:
  recentWeeklyKm: ${weeklyKm}
  daysAvailable: [${days}]
  results:
    - { date: "2026-09-27", distanceKm: 10, timeSec: 2580 }
goal:
  name: "Half"
  date: "2027-03-28"
  distanceKm: 21.0975
  priority: A
`

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'trainctl-070-'))
  process.env['TRAINCTL_TODAY'] = '2026-10-22'
})
afterEach(() => {
  delete process.env['TRAINCTL_TODAY']
  setLocale('en')
  rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
})

function planFor(weeklyKm: number, days: string) {
  writeFileSync(join(dir, 'trainctl.yaml'), config(weeklyKm, days), 'utf-8')
  const r = cmdPlan(dir)
  expect(r.code).toBe(0)
  return { output: r.output, plan: loadPlan(dir) }
}
const noteDay = (plan: ReturnType<typeof loadPlan>, code: string) => plan.weeks.flatMap((w) => (w.notes ?? []).filter((n) => n.code === code).map((n) => ('date' in n ? n.date : w.weekStart)))[0]

describe.each(['pl', 'en'] as const)('B1, B2 w komendach · %s', (lang) => {
  beforeEach(() => setLocale(lang))

  it('why: akcent zamieniony na przebieżki przy małej objętości mówi dlaczego (J-6)', () => {
    const { plan } = planFor(12, 'tue, wed, thu, sat, sun')
    const date = noteDay(plan, 'accentAsStrides')!
    expect(date).toBeDefined()
    const out = cmdWhy(dir, { date }).output
    expect(out).toContain(lang === 'pl' ? 'Akcent zamieniony na bieg spokojny z przebieżkami' : 'This accent is an easy run with strides')
    expect(out).toContain('J-6')
  })

  it('why: dzień podbiegów zamieniony na bieg spokojny — tylko przy tym dniu', () => {
    const { plan } = planFor(45, 'tue, thu, sat')
    const date = noteDay(plan, 'hillsDropped')!
    expect(date).toBeDefined()
    const text = lang === 'pl' ? 'Dzień podbiegów jest w tym tygodniu biegiem spokojnym' : 'The hills day is an easy run this week'
    expect(cmdWhy(dir, { date }).output).toContain(text)
    const week = plan.weeks.find((w) => w.days.some((d) => d.date === date))!
    const other = week.days.find((d) => d.date !== date && d.workout)!
    expect(cmdWhy(dir, { date: other.date }).output).not.toContain(text)
  })

  it('plan: werdykt wykonalności — trzy liczby i wyjścia jednym blokiem (B4, B8)', () => {
    const { output, plan } = planFor(12, 'tue, wed, thu, sat, sun')
    const longest = Math.max(...plan.weeks.flatMap((w) => w.days).filter((d) => d.workout?.kind === 'long').map((d) => d.workout!.distanceKm))
    const fmt = (km: number) => (lang === 'pl' ? String(km).replace('.', ',') : String(km))
    expect(output).toContain(lang === 'pl'
      ? `szczyt ${plan.peakKmPlanned} km/tydz. wobec 42 km/tydz. (P-7/P-8), najdłuższe wybieganie ${fmt(longest)} km wobec ponad 21 km`
      : `it peaks at ${plan.peakKmPlanned} km/week against 42 km/week (P-7/P-8), and its longest run is ${fmt(longest)} km against more than 21 km`)
    expect(output).toContain('athlete.peakWeeklyKm')
    expect(output).toContain('goal.kind: base')
    // jedno ostrzeżenie zamiast dwóch: bez osobnego zdania o szczycie
    expect(plan.feasibilityWarnings.filter((w) => /P-7\/P-8/.test(w))).toHaveLength(1)
    // P1: progi spełnione — bez werdyktu
    expect(planFor(45, 'tue, wed, thu, sat, sun').output).not.toMatch(/nie dochodzi do progów|stays below the thresholds/)
  })

  it('plan: werdykt podaje datę startu, od której plan zdąży urosnąć, gdy sufit z historii na to pozwala', () => {
    writeFileSync(join(dir, 'trainctl.yaml'), config(12, 'tue, wed, thu, sat, sun').replace('recentWeeklyKm: 12', 'recentWeeklyKm: 12\n  peakWeeklyKm: 50').replace('2027-03-28', '2026-12-27'), 'utf-8')
    const r = cmdPlan(dir)
    expect(r.code).toBe(0)
    expect(r.output).toMatch(lang === 'pl' ? /start nie wcześniej niż 2027-\d\d-\d\d/ : /a race on or after 2027-\d\d-\d\d/)
  })

  it('plan po przerwie (R-11): pierwszy blok spokojny, start od połowy objętości sprzed przerwy', () => {
    writeFileSync(join(dir, 'trainctl.yaml'), config(12, 'tue, wed, thu, sat, sun').replace('recentWeeklyKm: 12', 'recentWeeklyKm: 12\n  returning: { since: "2026-10-19", previousWeeklyKm: 45 }'), 'utf-8')
    const r = cmdPlan(dir)
    expect(r.code).toBe(0)
    expect(r.output).toContain(lang === 'pl' ? 'powrót po przerwie: pierwszy blok wyłącznie spokojnie' : 'return after a break: the first block is easy running only')
    const first = loadPlan(dir).weeks.slice(0, 4)
    expect(first[0]!.skeleton.targetKm).toBeGreaterThanOrEqual(Math.round(0.5 * 45 * 0.94))
    for (const w of first) expect(w.days.some((d) => d.workout && ['quality_intervals', 'quality_continuous', 'easy_hills', 'test'].includes(d.workout.kind))).toBe(false)
  })

  it('trainctl.yaml: athlete.returning z błędną datą albo objętością zatrzymuje plan', () => {
    writeFileSync(join(dir, 'trainctl.yaml'), config(12, 'tue, sat').replace('recentWeeklyKm: 12', 'recentWeeklyKm: 12\n  returning: { since: "wczoraj", previousWeeklyKm: 0 }'), 'utf-8')
    const r = cmdPlan(dir)
    expect(r.code).toBe(1)
    expect(r.output).toContain('athlete.returning.since')
    expect(r.output).toContain('athlete.returning.previousWeeklyKm')
  })

  it('B6: akcent dzień po długim cytuje S-9b, długie dzień po sprawdzianie — T-11', () => {
    const { plan } = planFor(45, 'tue, wed, thu, sat, sun')
    const days = plan.weeks.flatMap((w) => w.days)
    const before = (date: string) => days[days.findIndex((d) => d.date === date) - 1]
    const accent = days.find((d) => d.workout && ['quality_intervals', 'quality_continuous'].includes(d.workout.kind) && before(d.date)?.workout?.kind === 'long')!
    const long = days.find((d) => d.workout?.kind === 'long' && ['test', 'race'].includes(before(d.date)?.workout?.kind ?? ''))!
    const afterLong = cmdWhy(dir, { date: accent.date })
    expect(afterLong.output).toContain(lang === 'pl' ? 'Akcent wypada dzień po długim' : 'This accent comes the day after the long run')
    expect((afterLong.data as { evidence: { id: string }[] }).evidence.map((e) => e.id)).toContain('S-9b')
    const afterTest = cmdWhy(dir, { date: long.date })
    expect(afterTest.output).toContain(lang === 'pl' ? 'Długie wypada dzień po starcie albo sprawdzianie' : 'This long run comes the day after a race or time trial')
    expect((afterTest.data as { evidence: { id: string }[] }).evidence.map((e) => e.id)).toContain('T-11')
  })

  it('rules: reguły z pomiarów etapu 1 i silnika etapu 2 mają objaśnienie i pochodzenie', () => {
    for (const id of ['S-9b', 'S-10', 'S-11', 'S-12', 'P-12', 'J-4', 'J-6', 'J-8', 'J-9', 'J-10', 'J-1', 'J-2', 'J-5', 'N-19']) {
      const r = cmdRules({ id })
      expect(r.code, id).toBe(0)
      expect(r.output, id).not.toMatch(/unknown rule|nieznana reguła/i)
    }
  })

  it('plan: szczyt ograniczony przez dni ma ostrzeżenie z liczbami (S-10, E-3)', () => {
    const { output, plan } = planFor(70, 'tue, thu, sat')
    expect(output).toContain(lang === 'pl' ? `przy 3 dniach biegowych tydzień mieści ${plan.peakKmPlanned} km` : `3 running days hold ${plan.peakKmPlanned} km/week`)
  })
})

describe('B8: profil z historii proponuje powrót po przerwie', () => {
  it('trainctl.yaml z historii ma athlete.returning z komentarzem R-11', () => {
    const yaml = inferredConfigYaml({
      recentWeeklyKm: 42, returning: { since: '2026-08-05', previousWeeklyKm: 42 }, daysAvailable: ['tue', 'thu', 'sat'],
      weeklyKm: [], raceCandidates: [], caveats: [], window: { oldest: '2026-04-13', newest: '2026-08-02' }, recentBasis: 'mediana',
    })
    expect((parse(yaml) as { athlete: { returning: unknown } }).athlete.returning).toEqual({ since: '2026-08-05', previousWeeklyKm: 42 })
    expect(yaml).toContain('R-11')
  })
})

describe('B11: przerwa w trakcie planu', () => {
  beforeEach(() => setLocale('en'))
  const setup = () => {
    writeFileSync(join(dir, 'trainctl.yaml'), config(45, 'tue, wed, thu, sat, sun'), 'utf-8')
    expect(cmdPlan(dir).code).toBe(0)
  }
  /** Sesje przed przerwą wykonane (pełne dane w oknie adapt), przerwa do dziś włącznie. */
  const breakUntilToday = (reason: string) => {
    setup()
    process.env['TRAINCTL_TODAY'] = '2026-11-12'
    for (const d of loadPlan(dir).weeks.flatMap((w) => w.days).filter((x) => x.workout && x.date >= '2026-10-23' && x.date <= '2026-10-28')) {
      expect(cmdLog(dir, { date: d.date, status: 'done' }).code).toBe(0)
    }
    expect(cmdLog(dir, { date: '2026-10-29', to: '2026-11-12', status: 'skipped', reason }).code).toBe(0)
  }

  it('log --to --reason: każdy dzień przerwy dostaje wpis skipped z przyczyną', () => {
    setup()
    const r = cmdLog(dir, { date: '2026-10-26', to: '2026-10-30', status: 'skipped', reason: 'illness' })
    expect(r.code, r.output).toBe(0)
    expect(r.output).toContain('2026-10-26 to 2026-10-30: 5 days skipped, reason: illness')
    const entries = readLog(dir).filter((e) => e.date >= '2026-10-26' && e.date <= '2026-10-30')
    expect(entries).toHaveLength(5)
    for (const e of entries) expect(e).toMatchObject({ status: 'skipped', reason: 'illness' })
  })

  it('log: przyczyna i zakres tylko przy opuszczeniu; zła przyczyna, odwrócony i za długi zakres', () => {
    setup()
    expect(cmdLog(dir, { date: '2026-10-26', reason: 'illness' }).output).toContain('skipped sessions only')
    expect(cmdLog(dir, { date: '2026-10-26', status: 'skipped', reason: 'flu' }).output).toContain('Unknown reason "flu"')
    expect(cmdLog(dir, { date: '2026-10-30', to: '2026-10-26', status: 'skipped' }).output).toContain('ends before it starts')
    expect(cmdLog(dir, { date: '2026-10-26', to: '2027-01-26', status: 'skipped' }).output).toContain('more than 60 days')
    expect(readLog(dir)).toHaveLength(0)
  })

  it('adapt po chorobie: blok powrotu do przyjęcia, plan po --apply odtwarza go regeneracja', () => {
    breakUntilToday('illness')
    const prepared = cmdAdapt(dir, { prepare: true })
    expect(prepared.code, prepared.output).toBe(0)
    const id = (prepared.data as { prepared: { id: string } }).prepared.id
    expect(cmdAdapt(dir, { apply: id }).code).toBe(0)
    const plan = loadPlan(dir)
    expect(plan.returnState).toMatchObject({ since: '2026-11-13', illness: true })
    // tydzień powrotu: wyłącznie spokojnie (R-5), dni przed powrotem bez zmian
    const week = plan.weeks.find((w) => w.weekStart === '2026-11-09')!
    expect(week.skeleton.easyOnly).toBe(true)
    expect(week.days.filter((d) => d.date >= '2026-11-13').some((d) => d.workout && d.workout.kind !== 'easy' && d.workout.kind !== 'long')).toBe(false)
    // regeneracja z tym samym profilem: plan aktualny, decyzja zostaje
    const again = cmdPlan(dir)
    expect(again.code).toBe(0)
    expect(again.data).toMatchObject({ regeneration: { upToDate: true } })
    expect(loadPlan(dir).returnState).toEqual(plan.returnState)
  })

  it('adapt po kontuzji: bez propozycji objętości (R-6, R-7)', () => {
    breakUntilToday('injury')
    const r = cmdAdapt(dir, {})
    expect(r.output).toContain('R-6, R-7')
    expect((r.data as { proposal: { actions: { type: string }[] } }).proposal.actions.some((a) => a.type === 'conservative-restart')).toBe(false)
  })
})
