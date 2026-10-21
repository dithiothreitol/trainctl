/**
 * Regresje 0.3.1 — usterki zauważone przy uruchomieniu wszystkich komend na
 * świeżym katalogu (docs/PLAN-v0.4.md, etap A). Każdy test pada bez poprawki.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parse, stringify } from 'yaml'
import { setLocale } from 'trainctl-core'
import { cmdCheck, cmdInit, cmdLog, cmdPlan, cmdReview, cmdToday, cmdWeek, cmdWhy } from './commands.ts'
import { kindPurpose } from './rules-explain.ts'
import { loadPlan, PLAN_YAML, type StoredPlan } from './planfile.ts'

setLocale('en')

const CONFIG = `athlete:
  recentWeeklyKm: 45
  peakWeeklyKm: 65
  daysAvailable: [tue, wed, thu, sat, sun]
  longRunDay: sat
  results:
    - { date: "2026-03-29", distanceKm: 10, timeSec: 2580 }
goal:
  name: "Half marathon"
  date: "2026-11-29"
  distanceKm: 21.0975
  priority: A
`

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'trainctl-031-'))
})
afterEach(() => rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }))

const withPlan = (): StoredPlan => {
  writeFileSync(join(dir, 'trainctl.yaml'), CONFIG, 'utf-8')
  expect(cmdPlan(dir, { date: '2026-08-08' }).code).toBe(0)
  return loadPlan(dir)
}
const editPlan = (edit: (doc: Record<string, unknown>) => void) => {
  const path = join(dir, PLAN_YAML)
  const doc = parse(readFileSync(path, 'utf-8')) as Record<string, unknown>
  edit(doc)
  writeFileSync(path, stringify(doc), 'utf-8')
}

describe('A1 · review: „przed nami" nie miesza objętości tygodnia z liczbą pozostałych sesji', () => {
  it('w niedzielę pokazuje pozostałe km obok celu tygodnia', () => {
    const plan = withPlan()
    const week = plan.weeks.find((w) => w.weekStart === '2026-08-10')!
    const sunday = '2026-08-16'
    const remaining = week.days.filter((d) => d.workout && d.date >= sunday).reduce((s, d) => s + d.workout!.distanceKm, 0)
    expect(remaining).toBeLessThan(week.totalKm)
    const r = cmdReview(dir, { date: sunday })
    return r.then((res) => {
      expect(res.output).toContain(`${remaining} of ${week.totalKm} km left across 1 session`)
    })
  })
})

describe('A2 · pusty katalog odsyła do init, nie do plan', () => {
  it('bez trainctl.yaml: komunikat o init', () => {
    const r = cmdToday(dir, { date: '2026-08-11' })
    expect(r.code).toBe(1)
    expect(r.output).toContain('trainctl init')
  })
  it('z trainctl.yaml, bez planu: komunikat o plan', () => {
    writeFileSync(join(dir, 'trainctl.yaml'), CONFIG, 'utf-8')
    const r = cmdWeek(dir, { date: '2026-08-11' })
    expect(r.code).toBe(1)
    expect(r.output).toContain('trainctl plan')
  })
})

describe('A3 · why bez „0 minut" i bez dublowania celu', () => {
  it('dzień wolny nie dostaje szacunku czasu', () => {
    withPlan()
    const out = cmdWhy(dir, { date: '2026-08-10' }).output
    expect(out).not.toMatch(/About \d+ minutes/)
    expect(out).toContain('Rest day')
  })
  it('cel jednostki pojawia się raz, a reguły jedną listą z pochodzeniem', () => {
    const plan = withPlan()
    const day = plan.weeks[1]!.days.find((d) => d.workout?.kind === 'quality_intervals')!
    const out = cmdWhy(dir, { date: day.date }).output
    const purpose = kindPurpose('quality_intervals')
    expect(out.split(purpose).length - 1).toBe(1)
    expect(out).not.toContain('Origin of the decision')
    expect(out).toMatch(/I-7 — .+ · Interpretation of published research/)
  })
})

describe('A4 · log odbija plan obok zapisu', () => {
  it('wpis w dzień wolny mówi, że to bieg poza planem', () => {
    withPlan()
    const r = cmdLog(dir, { date: '2026-08-10', km: '5' })
    expect(r.code).toBe(0)
    expect(r.output).toContain('unplanned run')
    expect(r.data).toMatchObject({ entry: { date: '2026-08-10', km: 5 }, planned: null })
  })
  it('wpis treningu pokazuje rodzaj, km i szacunek czasu z planu', () => {
    const plan = withPlan()
    const day = plan.weeks[1]!.days.find((d) => d.workout?.kind === 'quality_intervals')!
    const r = cmdLog(dir, { date: day.date, km: '8', time: '41:20', rpe: '4', note: 'ok' })
    expect(r.output).toMatch(/Planned: intervals · \d+ km · ~\d+ min/)
    expect(r.output).toContain('Recorded: done · 8 km · 41:20 · RPE 4 · “ok”')
    expect(r.data).toMatchObject({ planned: { kind: 'quality_intervals' } })
  })
})

describe('A5 · ścieżki w komunikatach są takie same na każdym systemie', () => {
  it('plan drukuje plan/plan.yaml, nie plan\\plan.yaml', () => {
    writeFileSync(join(dir, 'trainctl.yaml'), CONFIG, 'utf-8')
    const out = cmdPlan(dir, { date: '2026-08-08' }).output
    expect(out).toContain('plan/plan.yaml + plan/PLAN.md')
    expect(out).not.toContain('plan\\')
  })
})

describe('A6 · plan z innej wersji silnika', () => {
  it('inny minor: informacja w today, week i why — bez blokowania', () => {
    withPlan()
    editPlan((doc) => { doc['engineVersion'] = '0.1.1' })
    for (const r of [cmdToday(dir, { date: '2026-08-11' }), cmdWeek(dir, { date: '2026-08-11' }), cmdWhy(dir, { date: '2026-08-11' })]) {
      expect(r.code).toBe(0)
      expect(r.output).toContain('generated by engine 0.1.1')
    }
  })
  it('plan bez wersji silnika: plan sprzed 0.2.0', () => {
    withPlan()
    editPlan((doc) => { delete doc['engineVersion'] })
    expect(cmdToday(dir, { date: '2026-08-11' }).output).toContain('predates engine 0.2.0')
  })
  it('ten sam minor: cisza', () => {
    withPlan()
    expect(cmdToday(dir, { date: '2026-08-11' }).output).not.toContain('engine')
  })
  it('nowszy schemat pliku: czytelny błąd zamiast cichego złego odczytu', () => {
    withPlan()
    editPlan((doc) => { doc['schemaVersion'] = 2 })
    const r = cmdToday(dir, { date: '2026-08-11' })
    expect(r.code).toBe(1)
    expect(r.output).toContain('plan schema 2')
  })
  it('check informuje, ale nie liczy tego jako ostrzeżenia w --strict', () => {
    withPlan()
    editPlan((doc) => { doc['engineVersion'] = '0.1.1' })
    const r = cmdCheck(dir, { strict: true })
    expect(r.output).toContain('generated by engine 0.1.1')
    expect(r.code).toBe(0)
  })
})

describe('A9 · źródła reguł jako link, który działa po instalacji z npm', () => {
  it('why i AGENTS.md wskazują FOUNDATIONS na GitHubie, przypięte do wersji', () => {
    withPlan()
    expect(cmdWhy(dir, { date: '2026-08-11' }).output).toMatch(/https:\/\/github\.com\/dithiothreitol\/trainctl\/blob\/v\d+\.\d+\.\d+\/docs\/science\/FOUNDATIONS\.md/)
    const other = mkdtempSync(join(tmpdir(), 'trainctl-031-init-'))
    try {
      cmdInit(other)
      expect(readFileSync(join(other, 'AGENTS.md'), 'utf-8')).toMatch(/\]\(https:\/\/github\.com\/dithiothreitol\/trainctl\/blob\/v/)
    } finally {
      rmSync(other, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
    }
  })
})
