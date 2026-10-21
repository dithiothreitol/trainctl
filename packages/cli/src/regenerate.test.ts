/**
 * Chroniona regeneracja planu (ADR-033): `trainctl plan` na istniejącym planie
 * nie kasuje przeszłości ani zatwierdzonych decyzji.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { estimateWorkoutMinutes, setLocale, validatePlan } from 'trainctl-core'
import { cmdDiff, cmdLog, cmdPlan, cmdToday } from './commands.ts'
import { computePlan, cycleWeeksOf, loadPlan, writePlan, PLAN_YAML, type StoredPlan } from './planfile.ts'
import { applyProposal, prepareProposal } from './proposals.ts'
import type { TrainctlConfig } from './config.ts'

let dir: string
let config: TrainctlConfig
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-06T12:00:00Z'))
  setLocale('en')
  dir = mkdtempSync(join(tmpdir(), 'trainctl-regen-'))
  config = {
    athlete: { recentWeeklyKm: 55, daysAvailable: ['tue', 'wed', 'thu', 'sat', 'sun'], longRunDay: 'sun',
      results: [{ date: '2026-03-29', distanceKm: 10, timeSec: 2580 }] },
    goal: { name: 'Test HM', date: '2026-11-29', distanceKm: 21.0975, priority: 'A' },
  }
})
afterEach(() => {
  vi.useRealTimers()
  rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
})

const saveConfig = () => writeFileSync(join(dir, 'trainctl.yaml'), JSON.stringify(config))
function initialize(): StoredPlan {
  saveConfig()
  const plan = computePlan(config, '2026-08-03')
  writePlan(dir, plan)
  return plan
}
const dayOf = (plan: StoredPlan, date: string) => plan.weeks.flatMap((w) => w.days).find((d) => d.date === date)!
const futureWorkouts = (plan: StoredPlan) => plan.weeks.flatMap((w) => w.days).filter((d) => d.workout && d.date > '2026-09-06' && d.workout.kind !== 'race')
const reduction = { dataStatus: 'complete' as const, unknownSessions: 0, windowDays: 21, complianceKm: 0.5,
  missedSessions: 0, diagnosis: [], warnings: [], actions: [{ type: 'reduce-volume' as const, detail: 'reduce', suggestedWeeklyKm: 20, ruleRefs: [] }] }

describe('trainctl plan na istniejącym planie', () => {
  it('bez zmian na wejściu: „plan aktualny" i nic nie zapisuje', () => {
    initialize()
    const before = readFileSync(join(dir, PLAN_YAML), 'utf-8')
    const r = cmdPlan(dir)
    expect(r.code).toBe(0)
    expect(r.output).toContain('Plan is current')
    expect(r.data).toMatchObject({ regeneration: { upToDate: true, mode: 'same-cycle' } })
    expect(readFileSync(join(dir, PLAN_YAML), 'utf-8')).toBe(before)
  })

  it('nowy wynik po zatwierdzonej redukcji: baza zostaje, tempa się aktualizują', () => {
    initialize()
    const reduced = prepareProposal(dir, '2026-09-06', reduction)
    applyProposal(dir, reduced.id)
    const reducedWeek = reduced.plan.weeks.find((w) => w.weekStart === '2026-09-07')!
    config.athlete.results.push({ date: '2026-09-05', distanceKm: 10, timeSec: 2400 })
    saveConfig()
    const r = cmdPlan(dir)
    expect(r.code).toBe(0)
    expect(r.output).toContain('Kept the approved baseline of 20 km/week')
    const plan = loadPlan(dir)
    const week = plan.weeks.find((w) => w.weekStart === '2026-09-07')!
    expect(week.totalKm).toBeCloseTo(reducedWeek.totalKm, 1)
    expect(week.days.map((d) => [d.date, d.workout?.kind, d.workout?.distanceKm])).toEqual(reducedWeek.days.map((d) => [d.date, d.workout?.kind, d.workout?.distanceKm]))
    expect(plan.vdot).toBeGreaterThan(reduced.plan.vdot)
    expect(plan.loadState).toMatchObject({ baselineWeeklyKm: 20, profileWeeklyKm: 55 })
    // przeszłość nietknięta bajt w bajt
    for (const date of ['2026-08-04', '2026-09-01', '2026-09-05']) expect(dayOf(plan, date)).toEqual(dayOf(reduced.plan, date))
  })

  it('redukcja, którą budżet jeszcze tnie: „bez budżetu" to poziom redukcji, nie pierwotny szczyt', () => {
    config.time = { weeklyMinutes: 240 }
    initialize()
    const reduced = prepareProposal(dir, '2026-09-06', { ...reduction, actions: [{ ...reduction.actions[0]!, suggestedWeeklyKm: 45 }] })
    const warning = reduced.plan.feasibilityWarnings.find((w) => w.includes('time budget caps'))
    expect(warning).toBeDefined()
    const withoutBudget = Number(warning!.match(/would reach ([\d.]+) km\/week/)![1])
    expect(withoutBudget).toBeGreaterThan(40)
    expect(withoutBudget).toBeLessThanOrEqual(45.5)
  })
  it('redukcja przy samych limitach dni: świeży plan bez ostrzeżenia, przycięte tygodnie pamiętają poziom redukcji', () => {
    config.time = { weekdayMinutes: 60 }
    const fresh = initialize()
    expect(fresh.feasibilityWarnings.join('\n')).not.toContain('time budget caps')
    const reduced = prepareProposal(dir, '2026-09-06', { ...reduction, actions: [{ ...reduction.actions[0]!, suggestedWeeklyKm: 30 }] })
    const future = reduced.plan.weeks.filter((w) => w.weekStart > '2026-09-06' && w.skeleton.uncappedKm !== undefined)
    expect(future.length).toBeGreaterThan(0)
    for (const week of future) expect(week.skeleton.uncappedKm!).toBeLessThanOrEqual(31)
    const warning = reduced.plan.feasibilityWarnings.find((w) => w.includes('time budget caps'))
    expect(warning).toBeDefined()
    expect(Number(warning!.match(/would reach ([\d.]+) km\/week/)![1])).toBeLessThanOrEqual(30.5)
  })
  it('redukcja mieszcząca się w budżecie tygodnia: bez ostrzeżenia o budżecie', () => {
    config.time = { weeklyMinutes: 240 }
    initialize()
    const reduced = prepareProposal(dir, '2026-09-06', { ...reduction, actions: [{ ...reduction.actions[0]!, suggestedWeeklyKm: 30 }] })
    expect(reduced.plan.feasibilityWarnings.join('\n')).not.toContain('time budget caps')
  })
  it('rekalibracja przy budżecie tygodnia: przycięte tygodnie znów w budżecie, ostrzeżenie zostaje', () => {
    config.time = { weeklyMinutes: 240 }
    const fresh = initialize()
    expect(fresh.feasibilityWarnings.join('\n')).toContain('time budget caps')
    config.athlete.results = [{ date: '2026-03-29', distanceKm: 10, timeSec: 2580, excluded: true }, { date: '2026-08-30', distanceKm: 10, timeSec: 2820 }]
    saveConfig()
    const recalibrated = prepareProposal(dir, '2026-09-06', { ...reduction, actions: [{ type: 'recalibrate-zones' as const, detail: 'recalibrate', ruleRefs: [] }] })
    const warnings = recalibrated.plan.feasibilityWarnings.join('\n')
    expect(warnings).toContain('time budget caps')
    expect(warnings).not.toContain('stay over the weekly time budget')
  })
  it('szybsza rekalibracja przy budżecie tygodnia: przycięcie sprzed niej nadal widać w ostrzeżeniu', () => {
    config.time = { weeklyMinutes: 240 }
    initialize()
    config.athlete.results = [{ date: '2026-03-29', distanceKm: 10, timeSec: 2580, excluded: true }, { date: '2026-08-30', distanceKm: 10, timeSec: 2450 }]
    saveConfig()
    const recalibrated = prepareProposal(dir, '2026-09-06', { ...reduction, actions: [{ type: 'recalibrate-zones' as const, detail: 'recalibrate', ruleRefs: [] }] })
    expect(recalibrated.plan.feasibilityWarnings.join('\n')).toContain('time budget caps')
  })
  it('rekalibracja w środku tygodnia: bieżący tydzień zgadza się z własną objętością (P-3)', () => {
    vi.setSystemTime(new Date('2026-09-10T12:00:00Z'))
    config.time = { weeklyMinutes: 240 }
    initialize()
    config.athlete.results = [{ date: '2026-03-29', distanceKm: 10, timeSec: 2580, excluded: true }, { date: '2026-09-05', distanceKm: 10, timeSec: 3300 }]
    saveConfig()
    const recalibrated = prepareProposal(dir, '2026-09-10', { ...reduction, actions: [{ type: 'recalibrate-zones' as const, detail: 'recalibrate', ruleRefs: [] }] })
    expect(validatePlan(recalibrated.plan).filter((i) => i.code === 'targetKmMismatch')).toEqual([])
  })
  it('rekalibracja w środku tygodnia przy limitach dni: przyszłe dni bieżącego tygodnia mieszczą się w limicie', () => {
    vi.setSystemTime(new Date('2026-09-10T12:00:00Z'))
    config.time = { weekdayMinutes: 50, weekendMinutes: 90 }
    initialize()
    config.athlete.results = [{ date: '2026-03-29', distanceKm: 10, timeSec: 2580, excluded: true }, { date: '2026-09-05', distanceKm: 10, timeSec: 3300 }]
    saveConfig()
    const recalibrated = prepareProposal(dir, '2026-09-10', { ...reduction, actions: [{ type: 'recalibrate-zones' as const, detail: 'recalibrate', ruleRefs: [] }] })
    const tooLong = recalibrated.plan.feasibilityWarnings.join('\n')
    const ahead = recalibrated.plan.weeks.flatMap((w) => w.days).filter((d) => d.date > '2026-09-10' && d.date <= '2026-09-13' && d.workout)
    expect(ahead.length).toBeGreaterThan(0)
    for (const day of ahead) {
      const cap = ['sat', 'sun'].includes(day.weekday) ? 90 : 50
      if (estimateWorkoutMinutes(day.workout!, 15) + (day.strength?.durationMin ?? 0) > cap) expect(tooLong).toContain(day.date)
    }
    // dni, których propozycja nie zmieni (do dziś włącznie), nie trafiają do ostrzeżeń
    expect(tooLong).not.toMatch(/2026-09-0[7-9]|2026-09-10/)
  })
  it('rekalibracja po zatwierdzonej bazie: „bez budżetu" to baza, nie pierwotny szczyt', () => {
    config.time = { weeklyMinutes: 240 }
    initialize()
    applyProposal(dir, prepareProposal(dir, '2026-09-06', { ...reduction, actions: [{ ...reduction.actions[0]!, suggestedWeeklyKm: 45 }] }).id)
    config.athlete.results = [{ date: '2026-03-29', distanceKm: 10, timeSec: 2580, excluded: true }, { date: '2026-08-30', distanceKm: 10, timeSec: 2700 }]
    saveConfig()
    const recalibrated = prepareProposal(dir, '2026-09-06', { ...reduction, actions: [{ type: 'recalibrate-zones' as const, detail: 'recalibrate', ruleRefs: [] }] })
    const warning = recalibrated.plan.feasibilityWarnings.find((w) => w.includes('time budget caps'))
    expect(warning).toBeDefined()
    expect(Number(warning!.match(/would reach ([\d.]+) km\/week/)![1])).toBeLessThanOrEqual(45.5)
  })
  it('redukcja w środku tygodnia, którą budżet tnie: tydzień decyzji zgadza się z własną objętością (P-3)', () => {
    vi.setSystemTime(new Date('2026-09-10T12:00:00Z'))
    config.time = { weeklyMinutes: 240 }
    initialize()
    const reduced = prepareProposal(dir, '2026-09-10', { ...reduction, actions: [{ ...reduction.actions[0]!, suggestedWeeklyKm: 45 }] })
    expect(validatePlan(reduced.plan).filter((i) => i.code === 'targetKmMismatch' && i.date === '2026-09-07')).toEqual([])
  })
  it('regeneracja po redukcji w środku tygodnia: tydzień decyzji nadal zgadza się z własną objętością (P-3)', () => {
    vi.setSystemTime(new Date('2026-09-10T12:00:00Z'))
    config.time = { weeklyMinutes: 240 }
    initialize()
    applyProposal(dir, prepareProposal(dir, '2026-09-10', { ...reduction, actions: [{ ...reduction.actions[0]!, suggestedWeeklyKm: 45 }] }).id)
    config.athlete.results.push({ date: '2026-08-30', distanceKm: 5, timeSec: 1250 })
    saveConfig()
    expect(cmdPlan(dir).code).toBe(0)
    expect(validatePlan(loadPlan(dir)).filter((i) => i.code === 'targetKmMismatch' && i.date === '2026-09-07')).toEqual([])
  })
  it('rekalibracja w sobotę przy ciasnych limitach dni: ostrzeżenie nie wymienia minionych dni', () => {
    vi.setSystemTime(new Date('2026-09-12T12:00:00Z'))
    config.time = { weekdayMinutes: 30, weekendMinutes: 45 }
    initialize()
    config.athlete.results = [{ date: '2026-03-29', distanceKm: 10, timeSec: 2580, excluded: true }, { date: '2026-09-06', distanceKm: 10, timeSec: 3300 }]
    saveConfig()
    const recalibrated = prepareProposal(dir, '2026-09-12', { ...reduction, actions: [{ type: 'recalibrate-zones' as const, detail: 'recalibrate', ruleRefs: [] }] })
    expect(recalibrated.plan.feasibilityWarnings.join(' ')).not.toMatch(/2026-09-(0[7-9]|1[0-2])/)
  })
  it('ręczna zmiana w tygodniu przyciętym budżetem: regeneracja jej nie wchłania, lint nadal ją pokazuje (P-3)', () => {
    config.time = { weeklyMinutes: 240 }
    initialize()
    const plan = loadPlan(dir)
    const week = plan.weeks.find((w) => w.weekStart > '2026-09-07' && w.skeleton.timeCappedKm !== undefined && w.days.some((d) => d.workout?.kind === 'long'))!
    const long = week.days.find((d) => d.workout?.kind === 'long')!
    long.workout!.distanceKm += 5
    const segment = long.workout!.segments.find((x) => x.distanceKm !== undefined)!
    segment.distanceKm = segment.distanceKm! + 5
    writePlan(dir, plan)
    config.athlete.results.push({ date: '2026-08-30', distanceKm: 5, timeSec: 1250 })
    saveConfig()
    const r = cmdPlan(dir)
    expect(r.code, r.output).toBe(0)
    expect(validatePlan(loadPlan(dir)).some((i) => i.code === 'targetKmMismatch' && i.date === week.weekStart)).toBe(true)
  })
  it('rekalibracja w ostatnim tygodniu planu: bez ostrzeżenia o „0 km/tydz."', () => {
    vi.setSystemTime(new Date('2026-12-09T12:00:00Z'))
    config.time = { weekdayMinutes: 30, weekendMinutes: 45 }
    initialize()
    config.athlete.results = [{ date: '2026-03-29', distanceKm: 10, timeSec: 2580, excluded: true }, { date: '2026-12-06', distanceKm: 10, timeSec: 3300 }]
    saveConfig()
    const recalibrated = prepareProposal(dir, '2026-12-09', { ...reduction, actions: [{ type: 'recalibrate-zones' as const, detail: 'recalibrate', ruleRefs: [] }] })
    expect(recalibrated.plan.feasibilityWarnings.join('\n')).not.toContain('at 0 km/week')
  })
  it('wyraźnie wolniejsza rekalibracja przy budżecie tygodnia: bieżący tydzień ponad budżetem jest zgłoszony', () => {
    vi.setSystemTime(new Date('2026-09-08T12:00:00Z'))
    config.time = { weeklyMinutes: 240 }
    initialize()
    config.athlete.results = [{ date: '2026-03-29', distanceKm: 10, timeSec: 2580, excluded: true }, { date: '2026-09-06', distanceKm: 10, timeSec: 3600 }]
    saveConfig()
    const recalibrated = prepareProposal(dir, '2026-09-08', { ...reduction, actions: [{ type: 'recalibrate-zones' as const, detail: 'recalibrate', ruleRefs: [] }] })
    expect(recalibrated.plan.feasibilityWarnings.join('\n')).toMatch(/stay over the weekly time budget: [^\n]*2026-09-07/)
  })
  it('baza zatwierdzona przy budżecie bez siły: tygodnie sprzed decyzji nie dostają fałszywego „ponad budżet"', () => {
    config.time = { weeklyMinutes: 240 }
    initialize()
    applyProposal(dir, prepareProposal(dir, '2026-09-06', { ...reduction, actions: [{ ...reduction.actions[0]!, suggestedWeeklyKm: 45 }] }).id)
    config.athlete.results.push({ date: '2026-08-30', distanceKm: 5, timeSec: 1250 })
    saveConfig()
    expect(cmdPlan(dir).code).toBe(0)
    expect(loadPlan(dir).feasibilityWarnings.join('\n')).not.toMatch(/stay over the weekly time budget: 2026-08-/)
  })
  it('baza zatwierdzona przy budżecie dni: regeneracja nadal mówi, że budżet tnie objętość', () => {
    config.time = { weekdayMinutes: 50, weekendMinutes: 90 }
    initialize()
    applyProposal(dir, prepareProposal(dir, '2026-09-06', { ...reduction, actions: [{ ...reduction.actions[0]!, suggestedWeeklyKm: 45 }] }).id)
    config.athlete.results.push({ date: '2026-08-30', distanceKm: 5, timeSec: 1250 })
    saveConfig()
    expect(cmdPlan(dir).code).toBe(0)
    expect(loadPlan(dir).feasibilityWarnings.join('\n')).toContain('time budget caps')
  })
  it('zmiana athlete.recentWeeklyKm po redukcji: wygrywa profil, baza znika', () => {
    initialize()
    applyProposal(dir, prepareProposal(dir, '2026-09-06', reduction).id)
    config.athlete.recentWeeklyKm = 40
    saveConfig()
    const r = cmdPlan(dir)
    expect(r.output).toContain('the profile wins')
    expect(r.data).toMatchObject({ regeneration: { loadState: 'cleared' } })
    expect(loadPlan(dir).loadState).toBeUndefined()
  })

  it('dni przeszłe, zalogowane, przypięte i z budżetem czasu zostają; reszta przyszłości się zmienia', () => {
    const original = initialize()
    const [logged, pinned, budgeted] = futureWorkouts(original).slice(0, 3)
    expect(cmdLog(dir, { date: logged!.date, km: '5' }).code).toBe(0)
    const edited = loadPlan(dir)
    dayOf(edited, pinned!.date).pinned = true
    edited.timeBudgets = { [budgeted!.date]: 20 }
    writePlan(dir, edited)
    config.athlete.recentWeeklyKm = 65
    saveConfig()
    const r = cmdPlan(dir)
    expect(r.code).toBe(0)
    const plan = loadPlan(dir)
    expect(dayOf(plan, '2026-09-01')).toEqual(dayOf(original, '2026-09-01'))
    expect(dayOf(plan, logged!.date)).toEqual(dayOf(original, logged!.date))
    expect(dayOf(plan, pinned!.date)).toMatchObject({ pinned: true, workout: dayOf(original, pinned!.date).workout })
    expect(dayOf(plan, budgeted!.date).workout).toEqual(dayOf(original, budgeted!.date).workout)
    expect(plan.timeBudgets).toEqual({ [budgeted!.date]: 20 })
    const regen = r.data!['regeneration'] as { changedDates: string[]; protectedDays: { date: string; reason: string }[] }
    expect(regen.changedDates.length).toBeGreaterThan(0)
    expect(regen.changedDates.every((d) => d > '2026-09-06')).toBe(true)
    expect(regen.protectedDays).toEqual(expect.arrayContaining([
      { date: logged!.date, reason: 'recorded' }, { date: pinned!.date, reason: 'pinned' },
    ]))
    expect(validatePlan(plan).filter((i) => i.severity === 'error')).toEqual([])
  })

  it('diff pokazuje dokładnie te zmiany, które wykona plan', () => {
    initialize()
    config.athlete.recentWeeklyKm = 65
    saveConfig()
    const diff = cmdDiff(dir)
    const plan = cmdPlan(dir)
    expect((diff.data!['regeneration'] as { changedDates: string[] }).changedDates)
      .toEqual((plan.data!['regeneration'] as { changedDates: string[] }).changedDates)
    expect(diff.output).toContain('past, logged, pinned and approved days stay')
  })

  it('--fresh zaczyna od zera i mówi, co porzuca', () => {
    initialize()
    applyProposal(dir, prepareProposal(dir, '2026-09-06', reduction).id)
    const r = cmdPlan(dir, { fresh: true })
    expect(r.code).toBe(0)
    expect(r.output).toContain('Regenerated from scratch (--fresh), discarding: the approved baseline (20 km/week)')
    expect(loadPlan(dir).loadState).toBeUndefined()
    expect(r.data).toMatchObject({ regeneration: null })
  })

  it('inny dystans celu: nowy cykl od bieżącego tygodnia, wcześniejsze tygodnie zostają jako historia', () => {
    const original = initialize()
    config.goal = { name: 'Autumn 10K', date: '2026-11-15', distanceKm: 10, priority: 'A' }
    saveConfig()
    const r = cmdPlan(dir)
    expect(r.code).toBe(0)
    expect(r.output).toContain('New training cycle from 2026-08-31')
    const plan = loadPlan(dir)
    expect(plan.cycleStart).toBe('2026-08-31')
    expect(plan.weeks.filter((w) => w.weekStart < '2026-08-31')).toEqual(original.weeks.filter((w) => w.weekStart < '2026-08-31'))
    const cycle = cycleWeeksOf(plan)
    expect(cycle[0]!.weekStart).toBe('2026-08-31')
    expect(cmdToday(dir, { date: '2026-09-08' }).output).toContain(`week 2/${cycle.length}`)
    expect(validatePlan(plan).filter((i) => i.severity === 'error')).toEqual([])
  })
})
