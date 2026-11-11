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
import { cmdPlan, cmdWhy } from './commands.ts'
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

  it('plan: szczyt ograniczony przez dni ma ostrzeżenie z liczbami (S-10, E-3)', () => {
    const { output, plan } = planFor(70, 'tue, thu, sat')
    expect(output).toContain(lang === 'pl' ? `przy 3 dniach biegowych tydzień mieści ${plan.peakKmPlanned} km` : `3 running days hold ${plan.peakKmPlanned} km/week`)
  })
})
