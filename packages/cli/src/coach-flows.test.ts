import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { basename, join, resolve, sep } from 'node:path'
import { tmpdir } from 'node:os'
import { reschedule, setLocale, validatePlan } from 'trainctl-core'
import { cmdAdapt, cmdLog, cmdReview, cmdShorten, cmdWhy } from './commands.ts'
import { computePlan, findDay, loadPlan, PLAN_YAML, shiftWorkout, writePlan } from './planfile.ts'
import { prepareProposal, type PlanProposal } from './proposals.ts'
import { writeSnapshot } from './sync.ts'
import type { TrainctlConfig } from './config.ts'

let dir: string
const today = '2026-09-06'
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(today + 'T12:00:00Z'))
  vi.stubEnv('TRAINCTL_INTERVALS_API_KEY', '')
  setLocale('en')
  dir = mkdtempSync(join(tmpdir(), 'trainctl-coach-flows-'))
  const config: TrainctlConfig = { athlete: { recentWeeklyKm: 55, daysAvailable: ['tue', 'wed', 'thu', 'sat', 'sun'], longRunDay: 'sun',
    results: [{ date: '2026-03-29', distanceKm: 10, timeSec: 2580 }] }, goal: { name: 'Autumn HM', date: '2026-11-29', distanceKm: 21.0975, priority: 'A' } }
  writeFileSync(join(dir, 'trainctl.yaml'), JSON.stringify(config))
  writePlan(dir, computePlan(config, '2026-08-10'))
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  const target = resolve(dir)
  if (!target.startsWith(resolve(tmpdir()) + sep) || !basename(target).startsWith('trainctl-coach-flows-')) throw new Error('Unexpected directory')
  rmSync(target, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
})
const bytes = () => readFileSync(join(dir, PLAN_YAML), 'utf8')
const prepared = (r: { data?: Record<string, unknown> }) => r.data!.prepared as { id: string; changes: PlanProposal['changes'] }
function logHistory(fraction = 0.5) {
  const plan = loadPlan(dir)
  for (const day of plan.weeks.flatMap(w => w.days).filter(d => d.workout && d.date >= '2026-08-17' && d.date <= today))
    expect(cmdLog(dir, { date: day.date, status: 'modified', km: String(day.workout!.distanceKm * fraction) }).code).toBe(0)
}

describe('three coach workflows', () => {
  it('prepares 40 minutes, then applies exactly the reviewed single-day change', () => {
    const before = bytes()
    const original = loadPlan(dir)
    const result = cmdShorten(dir, { minutes: '40' })
    expect(result.code, result.output).toBe(0)
    expect(result.data!.adjustment).toMatchObject({ status: 'easy-alternative', afterMinutes: 40 })
    expect(bytes()).toBe(before)
    expect(prepared(result).changes.map(c => c.date)).toEqual([today])
    const applied = cmdAdapt(dir, { apply: prepared(result).id })
    expect(applied.code, applied.output).toBe(0)
    const plan = loadPlan(dir)
    expect(findDay(plan, today)!.day.workout!.kind).toBe('easy')
    expect(plan.timeBudgets![today]).toBe(40)
    expect(plan.weeks.flatMap(w => w.days).filter(d => d.date !== today)).toEqual(original.weeks.flatMap(w => w.days).filter(d => d.date !== today))
    expect(validatePlan(plan).filter(i => i.severity === 'error')).toEqual([])
    expect(cmdShorten(dir, { apply: prepared(result).id }).code).toBe(1)
  })
  it.each(['stale', 'expired'] as const)('rejects a %s session proposal without writing', mode => {
    const result = cmdShorten(dir, { minutes: 40 })
    const before = bytes()
    if (mode === 'stale') cmdLog(dir, { date: today, status: 'done' })
    else vi.setSystemTime(new Date('2026-09-07T12:00:00Z'))
    expect(cmdAdapt(dir, { apply: prepared(result).id }).code).toBe(1)
    expect(bytes()).toBe(before)
  })
  it('protects journaled, synced, pinned and historical days', () => {
    const original = loadPlan(dir)
    findDay(original, today)!.day.pinned = true
    writePlan(dir, original)
    expect(cmdShorten(dir, { minutes: 40 }).code).toBe(1)
    expect(cmdShorten(dir, { minutes: 40, date: '2026-08-30' }).code).toBe(1)
    cmdLog(dir, { date: '2026-09-08', status: 'done' })
    expect(cmdShorten(dir, { minutes: 40, date: '2026-09-08' }).code).toBe(1)
    writeSnapshot(dir, { pulledAt: today, activities: [{ externalId: 'test', date: '2026-09-09', type: 'Run', distanceKm: 5 }], wellness: [] })
    expect(cmdShorten(dir, { minutes: 40, date: '2026-09-09' }).code).toBe(1)
  })
  it('does not change rest days, races or sessions with insufficient time', () => {
    const before = bytes()
    expect(cmdShorten(dir, { date: '2026-09-07', minutes: 40 }).data!.adjustment).toBeNull()
    expect(cmdShorten(dir, { date: '2026-11-29', minutes: 40 }).data!.adjustment).toMatchObject({ status: 'unavailable' })
    expect(cmdShorten(dir, { minutes: 5 }).data!.prepared).toBeNull()
    expect(bytes()).toBe(before)
    expect(existsSync(join(dir, 'plan/proposals'))).toBe(false)
  })
  it('retains strength and an existing tighter time budget', () => {
    const plan = loadPlan(dir)
    const day = findDay(plan, today)!.day
    day.strength = { kind: 'heavy', durationMin: 20, description: 'Strength', ruleRefs: [] }
    plan.timeBudgets = { [today]: 40 }
    writePlan(dir, plan)
    const result = cmdShorten(dir, { minutes: 80 })
    expect(result.data!.adjustment).toMatchObject({ budgetMinutes: 40, strengthMinutes: 20, status: 'unavailable' })
  })
  it('keeps an approved exception during a later volume proposal', () => {
    const date = '2026-09-08'
    const shortened = cmdShorten(dir, { date, minutes: 40 })
    expect(cmdAdapt(dir, { apply: prepared(shortened).id }).code).toBe(0)
    const original = findDay(loadPlan(dir), date)!.day
    const saved = prepareProposal(dir, today, { dataStatus: 'complete', unknownSessions: 0, windowDays: 21, complianceKm: 0.5, missedSessions: 0, diagnosis: [], warnings: [],
      actions: [{ type: 'reduce-volume', detail: 'Reduced volume', suggestedWeeklyKm: 20, ruleRefs: [] }] })
    expect(findDay(saved.plan, date)!.day).toEqual(original)
    expect(saved.protectedDates).toContain(date)
  })
  it('explains actual context, dose, neighbors and the approved lost purpose', () => {
    const before = cmdWhy(dir, { date: today })
    expect(before.output).toContain('Autumn HM')
    expect(before.data!.explanation).toMatchObject({ prescription: expect.any(Array), placement: { previous: expect.any(Object), next: expect.any(Object) } })
    const result = cmdShorten(dir, { minutes: 40 })
    cmdAdapt(dir, { apply: prepared(result).id })
    const why = cmdWhy(dir, { date: today })
    expect(why.output).toContain('gives up the original')
    expect(why.data!.evidence).toContainEqual(expect.objectContaining({ id: 'E-1', origin: 'engineering' }))
    expect(why.data!.explanation).toMatchObject({ budgetMinutes: 40 })
  })
  it('keeps the shortening rationale with the workout after a swap or reschedule', () => {
    const result = cmdShorten(dir, { date: '2026-09-08', minutes: 40 })
    cmdAdapt(dir, { apply: prepared(result).id })
    const plan = loadPlan(dir)
    const original = findDay(plan, '2026-09-08')!.day.timeAdjustment!
    const changed = reschedule({ week: findDay(plan, '2026-09-08')!.week, blockedDates: ['2026-09-08'] })
    expect(changed.days.find(d => d.timeAdjustment)?.timeAdjustment).toEqual(original)
    expect(changed.days.find(d => d.date === '2026-09-08')!.timeAdjustment).toBeUndefined()
    shiftWorkout(plan, '2026-09-08', '2026-09-07')
    expect(findDay(plan, '2026-09-07')!.day.timeAdjustment).toEqual(original)
    expect(findDay(plan, '2026-09-08')!.day.timeAdjustment).toBeUndefined()
  })
  it('acknowledges manual edits and explains rest and strength-only days', () => {
    const plan = loadPlan(dir)
    findDay(plan, today)!.day.workout!.segments[0]!.description = 'Custom instructions'
    const rest = findDay(plan, '2026-09-07')!.day
    writePlan(dir, plan)
    expect(cmdWhy(dir, { date: today }).output).toContain('cannot reconstruct')
    expect(cmdWhy(dir, { date: rest.date }).data!.explanation).toMatchObject({ prescription: [], estimatedMinutes: 0 })
    rest.strength = { kind: 'heavy', durationMin: 30, description: 'Strength', ruleRefs: ['F-1'] }
    writePlan(dir, plan)
    expect(cmdWhy(dir, { date: rest.date }).data!.explanation).toMatchObject({ estimatedMinutes: 30 })
  })
  it('reviews exactly seven days and prepares a concrete reduction without editing history', async () => {
    logHistory()
    const before = bytes()
    const result = await cmdReview(dir, { date: today, prepare: true })
    expect(result.code, result.output).toBe(0)
    expect(result.data!.period).toEqual({ from: '2026-08-31', to: today, days: 7 })
    expect(result.data!.preparation).toEqual({ status: 'prepared' })
    expect(prepared(result).changes.length).toBeGreaterThan(0)
    expect(prepared(result).changes.every(c => c.date > today)).toBe(true)
    expect(bytes()).toBe(before)
    expect(cmdAdapt(dir, { apply: prepared(result).id }).code).toBe(0)
  })
  it('does not turn missing records into missed sessions or invent a change', async () => {
    const result = await cmdReview(dir, { prepare: true })
    expect(result.data!.prepared).toBeNull()
    expect(result.data!.adaptation).toMatchObject({ dataStatus: 'empty', missedSessions: 0 })
    expect(result.output).toContain('Unconfirmed sessions:')
  })
  it('reports no change for a fully completed week and retains ordinary review semantics', async () => {
    logHistory(1)
    const plain = await cmdReview(dir)
    expect(plain.data!.preparation).toEqual({ status: 'not-requested' })
    expect(existsSync(join(dir, 'plan/proposals'))).toBe(false)
    const result = await cmdReview(dir, { prepare: true })
    expect(result.data!.preparation).toMatchObject({ status: 'no-change' })
  })
  it('rejects invalid options before reading or fetching data', async () => {
    expect(cmdShorten(dir).code).toBe(1)
    expect(cmdShorten(dir, { minutes: 40, apply: 'abc' }).code).toBe(1)
    expect(cmdShorten(dir, { minutes: 'NaN' }).code).toBe(1)
    expect(cmdShorten(dir, { date: '2026-02-30', minutes: 40 }).code).toBe(1)
    expect((await cmdReview(dir, { days: '-7' })).code).toBe(1)
    expect((await cmdReview(dir, { days: '2.5' })).code).toBe(1)
  })
})
