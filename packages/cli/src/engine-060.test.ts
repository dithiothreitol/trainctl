/**
 * Etap E (docs/PLAN-v0.4.md): budżet czasu w generatorze (E-2), dziennik
 * i warianty siły (F-12, F-14, F-18), wyniki z trailu w kalibracji (Z-10).
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { estimateWorkoutMinutes, setLocale, validatePlan } from 'trainctl-core'
import { cmdCheck, cmdLog, cmdPlan, cmdReview, cmdToday, cmdWhy } from './commands.ts'
import { loadPlan, writePlan, PLAN_YAML, type StoredPlan } from './planfile.ts'
import { readLog, readStrengthLog } from './logfile.ts'

setLocale('en')

const BASE = `athlete:
  recentWeeklyKm: 55
  peakWeeklyKm: 70
  daysAvailable: [tue, wed, thu, sat, sun]
  results:
    - { date: "2026-03-29", distanceKm: 10, timeSec: 2580 }
goal:
  name: "Half marathon"
  date: "2026-11-29"
  distanceKm: 21.0975
  priority: A
`

let dir: string
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'trainctl-060-')) })
afterEach(() => rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }))

const plan = (yaml: string): StoredPlan => {
  writeFileSync(join(dir, 'trainctl.yaml'), yaml, 'utf-8')
  const r = cmdPlan(dir, { date: '2026-08-08', fresh: true })
  expect(r.code, r.output).toBe(0)
  return loadPlan(dir)
}
const minutes = (p: StoredPlan) => p.weeks.map((w) => w.days.reduce((s, d) => s + (d.workout ? estimateWorkoutMinutes(d.workout, 15) : 0) + (d.strength?.durationMin ?? 0), 0))

describe('E-2 · budżet czasu z profilu', () => {
  it('tygodnie mieszczą się w minutach tygodnia; objętość wypłaszcza się z ostrzeżeniem', () => {
    const free = plan(BASE)
    const capped = plan(`${BASE}time:\n  weeklyMinutes: 240\n`)
    const loading = (p: StoredPlan) => p.weeks.filter((w) => !w.skeleton.raceDate)
    expect(Math.max(...minutes(capped).filter((_, i) => !capped.weeks[i]!.skeleton.raceDate))).toBeLessThanOrEqual(240)
    expect(Math.max(...loading(capped).map((w) => w.totalKm))).toBeLessThan(Math.max(...loading(free).map((w) => w.totalKm)))
    expect(validatePlan(capped).filter((i) => i.severity === 'error')).toEqual([])
    for (const w of capped.weeks) expect(w.easyShare).toBeGreaterThanOrEqual(0.75)
  })
  it('dni ponad limit dnia są skracane jawnie (timeAdjustment z profilu), why mówi o kompromisie', () => {
    const p = plan(`${BASE}time:\n  weekdayMinutes: 45\n`)
    const adjusted = p.weeks.flatMap((w) => w.days).filter((d) => d.timeAdjustment)
    expect(adjusted.length).toBeGreaterThan(0)
    for (const d of adjusted) {
      expect(d.timeAdjustment).toMatchObject({ origin: 'profile', budgetMinutes: 45 })
      expect(['sat', 'sun']).not.toContain(d.weekday)
      expect(estimateWorkoutMinutes(d.workout!, 15) + (d.strength?.durationMin ?? 0)).toBeLessThanOrEqual(45)
    }
    expect(cmdWhy(dir, { date: adjusted[0]!.date }).output).toMatch(/45 min/)
  })
  it('świeży plan z budżetem dnia nie łamie własnego lintu (P-3) nawet w --strict', () => {
    plan(`${BASE}time:\n  weekendMinutes: 90\n  weekdayMinutes: 60\n`)
    expect(validatePlan(loadPlan(dir)).filter((i) => i.code === 'targetKmMismatch')).toEqual([])
    expect(cmdCheck(dir).output).not.toContain('P-3')
  })
  it('hojny budżet niczego nie obcina — bez fałszywego ostrzeżenia o czasie', () => {
    const p = plan(`${BASE}time:\n  weeklyMinutes: 2000\n  weekendMinutes: 600\n`)
    expect(p.feasibilityWarnings.join(' ')).not.toContain('time budget caps')
  })
  it('cel tygodnia zostaje zamiarem makrocyklu; budżet zapisuje swoją objętość obok (timeCappedKm)', () => {
    const free = plan(BASE)
    const capped = plan(`${BASE}time:\n  weeklyMinutes: 240\n  weekdayMinutes: 50\n`)
    const pairs = capped.weeks.map((w, i) => [w, free.weeks[i]!] as const).filter(([w]) => w.skeleton.timeCappedKm !== undefined)
    expect(pairs.length).toBeGreaterThan(0)
    for (const [w, f] of pairs) {
      expect(w.skeleton.targetKm).toBe(f.skeleton.targetKm)
      expect(w.totalKm).toBeCloseTo(w.skeleton.timeCappedKm!, 0)
    }
  })
  it('plan z budżetem wygenerowany drugi raz bez zmian na wejściu jest „aktualny"', () => {
    plan(`${BASE}time:\n  weeklyMinutes: 240\n  weekdayMinutes: 50\n`)
    expect(cmdPlan(dir, { date: '2026-08-08' }).data).toMatchObject({ regeneration: { upToDate: true } })
  })
  it('regeneracja po zatwierdzonej bazie nadal trzyma budżet dnia (E-2)', () => {
    plan(`${BASE}time:\n  weekdayMinutes: 50\n`)
    const stored = loadPlan(dir)
    stored.loadState = { baselineWeeklyKm: 45, effectiveFrom: '2026-08-08', profileWeeklyKm: 55 }
    writePlan(dir, stored)
    expect(cmdPlan(dir, { date: '2026-08-08' }).code).toBe(0)
    const after = loadPlan(dir)
    for (const d of after.weeks.flatMap((w) => w.days)) {
      if (!d.workout || ['sat', 'sun'].includes(d.weekday) || ['race', 'test'].includes(d.workout.kind)) continue
      expect(estimateWorkoutMinutes(d.workout, 15) + (d.strength?.durationMin ?? 0), d.date).toBeLessThanOrEqual(50)
    }
  })
  it('zła wartość budżetu: czytelny błąd profilu', () => {
    writeFileSync(join(dir, 'trainctl.yaml'), `${BASE}time:\n  weeklyMinutes: 5\n`, 'utf-8')
    const r = cmdPlan(dir, { date: '2026-08-08' })
    expect(r.code).toBe(1)
    expect(r.output).toContain('time.weeklyMinutes: whole minutes between 15 and 2000')
  })
})

describe('siła: warianty i dziennik', () => {
  const withStrength = `${BASE}strength:\n  enabled: true\n`
  it('wejście w blok przez dwa tygodnie, potem ciężko; szczyt raz w tygodniu (F-18, F-4, F-12)', () => {
    const p = plan(withStrength)
    const kinds = (phase: string) => p.weeks.filter((w) => w.skeleton.phase === phase).flatMap((w) => w.days.filter((d) => d.strength).map((d) => d.strength!.kind))
    const firstTwo = p.weeks.slice(0, 2).flatMap((w) => w.days.filter((d) => d.strength).map((d) => d.strength!.kind))
    expect(new Set(firstTwo)).toEqual(new Set(['intro']))
    expect(kinds('build')).toContain('heavy')
    for (const w of p.weeks.filter((x) => x.skeleton.phase === 'peak')) {
      expect(w.days.filter((d) => d.strength).length).toBeLessThanOrEqual(1)
      for (const d of w.days.filter((x) => x.strength)) expect(d.strength!.kind).toBe('maintenance')
    }
  })
  it('log --strength: osobny wpis, nie nadpisuje biegu z tej samej daty; review liczy sesje', async () => {
    const p = plan(withStrength)
    const day = p.weeks[1]!.days.find((d) => d.strength)!
    expect(cmdLog(dir, { date: day.date, km: '6' }).code).toBe(0)
    const r = cmdLog(dir, { date: day.date, strength: 'done', minutes: '30' })
    expect(r.code).toBe(0)
    expect(r.output).toContain(`Logged strength ${day.date}: done.`)
    expect(readLog(dir).at(-1)).toMatchObject({ date: day.date, km: 6 })
    expect(readStrengthLog(dir)).toEqual([expect.objectContaining({ date: day.date, status: 'done', minutes: 30 })])
    expect(cmdToday(dir, { date: day.date }).output).toContain('Strength logged: done')
    const review = await cmdReview(dir, { date: p.weeks[1]!.days[6]!.date })
    expect(review.output).toMatch(/Strength: 1 of \d+ planned/)
  })
  it('siła nie przyjmuje kilometrów ani tempa; zły status to błąd', () => {
    plan(withStrength)
    expect(cmdLog(dir, { date: '2026-08-11', strength: 'done', km: '5' }).output).toContain('only --minutes and --note')
    expect(cmdLog(dir, { date: '2026-08-11', strength: 'maybe' }).code).toBe(1)
    expect(cmdLog(dir, { date: '2026-08-11', strength: 'done', minutes: '0' }).code).toBe(1)
  })
})

describe('plan.yaml, którego nie da się użyć', () => {
  it('znaczniki konfliktu w pliku: bez --fresh odmowa z instrukcją (nic nie ginie po cichu), z --fresh nadpisanie z ostrzeżeniem', () => {
    plan(BASE)
    const broken = '<<<<<<< HEAD\nweeks: [\n=======\n>>>>>>> other\n'
    writeFileSync(join(dir, PLAN_YAML), broken, 'utf-8')
    const refused = cmdPlan(dir, { date: '2026-08-08' })
    expect(refused.code).toBe(1)
    expect(refused.output).toContain('not valid YAML')
    expect(refused.output).toContain('--fresh')
    expect(readFileSync(join(dir, PLAN_YAML), 'utf-8')).toBe(broken)
    const fresh = cmdPlan(dir, { date: '2026-08-08', fresh: true })
    expect(fresh.code).toBe(0)
    expect(fresh.output).toContain('could not be used and was replaced')
  })
  it('nowszy schemat: bez --fresh odmowa, z --fresh świadome nadpisanie', () => {
    plan(BASE)
    const raw = readFileSync(join(dir, PLAN_YAML), 'utf-8').replace('schemaVersion: 1', 'schemaVersion: 9')
    writeFileSync(join(dir, PLAN_YAML), raw, 'utf-8')
    const refused = cmdPlan(dir, { date: '2026-08-08' })
    expect(refused.code).toBe(1)
    expect(refused.output).toContain('a newer plan schema')
    expect(cmdPlan(dir, { date: '2026-08-08', fresh: true }).code).toBe(0)
  })
})

describe('Z-10 · wynik z trailu nie kalibruje stref szosowych', () => {
  const results = (lines: string) => BASE.replace('    - { date: "2026-03-29", distanceKm: 10, timeSec: 2580 }\n', lines)
  it('przy wyniku szosowym trail jest odłożony, z powodem w kalibracji', () => {
    const p = plan(results('    - { date: "2026-03-29", distanceKm: 10, timeSec: 2580 }\n    - { date: "2026-05-10", distanceKm: 21.1, timeSec: 7800, terrain: trail }\n'))
    const road = plan(BASE)
    expect(p.vdot).toBe(road.vdot)
    expect(p.calibration!.candidates.find((c) => c.result.terrain === 'trail')!.reason).toBe('terrain')
  })
  it('sam trail: strefy z niego, z ostrzeżeniem w planie', () => {
    const p = plan(results('    - { date: "2026-05-10", distanceKm: 21.1, timeSec: 7800, terrain: trail }\n'))
    expect(p.feasibilityWarnings.join(' ')).toContain('trail result')
    expect(readFileSync(join(dir, 'plan/PLAN.md'), 'utf-8')).toContain('Z-10')
  })
})
