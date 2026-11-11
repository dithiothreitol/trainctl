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
import { cmdPlan, cmdRules, cmdWhy } from './commands.ts'
import { loadPlan } from './planfile.ts'

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

  it('plan: długie poniżej progu dystansu ma ostrzeżenie z liczbami (B4, J-2)', () => {
    const { output, plan } = planFor(12, 'tue, wed, thu, sat, sun')
    const longest = Math.max(...plan.weeks.flatMap((w) => w.days).filter((d) => d.workout?.kind === 'long').map((d) => d.workout!.distanceKm))
    expect(output).toContain(lang === 'pl' ? `Najdłuższe wybieganie planu ma ${longest} km, a dystans wymaga ponad 21 km` : `The longest run in this plan is ${longest} km; the distance needs more than 21 km`)
    // P1: próg spełniony — bez ostrzeżenia
    expect(planFor(45, 'tue, wed, thu, sat, sun').output).not.toMatch(/Najdłuższe wybieganie planu|The longest run in this plan/)
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
