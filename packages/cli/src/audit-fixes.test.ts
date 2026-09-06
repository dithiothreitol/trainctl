import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { join, resolve, basename, sep } from 'node:path'
import { tmpdir } from 'node:os'
import { analyzeExecution, estimateWorkoutMinutes, setLocale, validatePlan } from 'trainctl-core'
import { toFitSteps } from '../../export/src/fit.ts'
import { toWorkoutSyntax } from '../../sync-intervalsicu/src/workout-syntax.ts'
import { computePlan, loadPlan, writePlan, PLAN_YAML } from './planfile.ts'
import { prepareProposal, applyProposal } from './proposals.ts'
import { cmdAdapt, cmdLog, cmdReschedule, cmdShift } from './commands.ts'
import { buildExecution } from './execution.ts'
import type { TrainctlConfig } from './config.ts'

let dir: string
let config: TrainctlConfig
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-06T12:00:00Z'))
  setLocale('en')
  dir = mkdtempSync(join(tmpdir(), 'trainctl-audit-fix-'))
  config = { athlete: { recentWeeklyKm: 55, daysAvailable: ['tue', 'wed', 'thu', 'sat', 'sun'], longRunDay: 'sun',
    results: [{ date: '2026-03-29', distanceKm: 10, timeSec: 2580 }] },
  goal: { name: 'Test HM', date: '2026-11-29', distanceKm: 21.0975, priority: 'A' } }
})
afterEach(() => {
  vi.useRealTimers()
  const target = resolve(dir)
  if (!target.startsWith(resolve(tmpdir()) + sep) || !basename(target).startsWith('trainctl-audit-fix-')) throw new Error('Unexpected test directory')
  rmSync(target, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
})
function initialize() {
  writeFileSync(join(dir, 'trainctl.yaml'), JSON.stringify(config))
  const plan = computePlan(config, '2026-08-03')
  writePlan(dir, plan)
  return plan
}
const reduction = { dataStatus: 'complete' as const, unknownSessions: 0, windowDays: 21, complianceKm: 0.5,
  missedSessions: 0, diagnosis: [], warnings: [], actions: [{ type: 'reduce-volume' as const, detail: 'reduce', suggestedWeeklyKm: 20, ruleRefs: [] }] }

describe('audited training workflows', () => {
  it.each([5, 10, 15, 20, 45, 55, 70])('respects the actual first-week budget at a %s km baseline', km => {
    config.athlete.recentWeeklyKm = km
    const plan = initialize()
    const week = plan.weeks[0]!
    expect(week.totalKm).toBeCloseTo(week.skeleton.targetKm, 1)
    expect(week.easyShare).toBeGreaterThanOrEqual(0.75)
    expect(validatePlan(plan).filter(i => i.date === week.weekStart && ['targetKmMismatch', 'easyShareLow'].includes(i.code))).toEqual([])
  })
  it('preserves approved volume and structure when recalibrating after a reduction', () => {
    initialize()
    const reduced = prepareProposal(dir, '2026-09-06', reduction)
    const week = reduced.plan.weeks.find(w => w.weekStart === '2026-09-07')!
    expect(week.skeleton.targetKm).toBe(20)
    expect(week.totalKm).toBeCloseTo(20, 1)
    applyProposal(dir, reduced.id)
    config.athlete.results.push({ date: '2026-09-05', distanceKm: 10, timeSec: 2400 })
    writeFileSync(join(dir, 'trainctl.yaml'), JSON.stringify(config))
    const recal = prepareProposal(dir, '2026-09-06', { ...reduction, actions: [{ type: 'recalibrate-zones', detail: 'zones', ruleRefs: [] }] })
    const future = recal.plan.weeks.find(w => w.weekStart === week.weekStart)!
    expect(future.totalKm).toBe(week.totalKm)
    expect(future.days.map(d => [d.date, d.workout?.kind, d.workout?.distanceKm])).toEqual(week.days.map(d => [d.date, d.workout?.kind, d.workout?.distanceKm]))
    expect(recal.plan.loadState?.baselineWeeklyKm).toBe(20)
    expect(recal.plan.vdot).toBeGreaterThan(reduced.plan.vdot)
    applyProposal(dir, recal.id)
    expect(readFileSync(join(dir, 'trainctl.yaml'), 'utf8')).toBe(JSON.stringify(config))
  })
  it('invalidates an unchanged proposal when the local calendar advances', () => {
    initialize()
    const proposal = prepareProposal(dir, '2026-09-06', reduction)
    const before = readFileSync(join(dir, PLAN_YAML), 'utf8')
    vi.setSystemTime(new Date('2026-09-08T12:00:00Z'))
    expect(() => applyProposal(dir, proposal.id)).toThrow(/expired/)
    expect(readFileSync(join(dir, PLAN_YAML), 'utf8')).toBe(before)
  })
  it('does not move past sessions by selecting a historical week', () => {
    initialize()
    const before = readFileSync(join(dir, PLAN_YAML), 'utf8')
    expect(cmdReschedule(dir, { date: '2026-08-03', block: ['2026-08-04'], apply: true }).code).toBe(1)
    expect(cmdShift(dir, { from: '2026-08-04', to: '2026-08-05' }).code).toBe(1)
    expect(readFileSync(join(dir, PLAN_YAML), 'utf8')).toBe(before)
  })
  it('compares training with training and retains race distance separately', () => {
    config.athlete.tuneUpRaces = [{ date: '2026-08-08', distanceKm: 21.0975, priority: 'B' }]
    const plan = initialize()
    const week = plan.weeks[0]!
    const logs = week.days.filter(d => d.workout).map(d => ({ date: d.date, status: 'done' as const,
      loggedAt: '', km: d.workout!.raceDistanceKm ?? d.workout!.distanceKm }))
    const proposal = analyzeExecution({ today: '2026-08-09', currentWeeklyKm: week.totalKm,
      execution: buildExecution(plan, [], logs, '2026-08-09'), lastRace: { date: '2026-08-08', distanceKm: 21.0975 } })
    expect(proposal.complianceKm).toBe(1)
    expect(proposal.actions.some(a => a.type === 'raise-baseline')).toBe(false)
    const race = week.days.find(d => d.workout?.kind === 'race')!.workout!
    expect(race.raceDistanceKm).toBe(21.0975)
    expect(estimateWorkoutMinutes(race)).toBe(Infinity)
  })
  it.each([
    [{ date: '2026-11-21', distanceKm: 10, priority: 'B' as const }],
    [{ date: '2026-09-12', distanceKm: 5, priority: 'B' as const }, { date: '2026-09-13', distanceKm: 10, priority: 'C' as const }],
  ])('rejects a conflicting race calendar before writing it', (...races) => {
    config.athlete.tuneUpRaces = races
    expect(() => initialize()).toThrow(/calendar conflict/)
  })
  it('respects the preferred long-run day and blocks strength with the whole day', () => {
    config.strength = { enabled: true, days: ['fri'] }
    const plan = initialize()
    expect(plan.weeks[0]!.days.find(d => d.workout?.kind === 'long')!.weekday).toBe('sun')
    const result = cmdReschedule(dir, { date: '2026-09-07', block: ['2026-09-11'], apply: true })
    expect(result.code, result.output).toBe(0)
    expect(loadPlan(dir).weeks.flatMap(w => w.days).find(d => d.date === '2026-09-11')?.strength).toBeUndefined()
  })
  it('protects tune-up dates and pinned sessions from a manual swap', () => {
    config.athlete.tuneUpRaces = [{ date: '2026-09-12', distanceKm: 10, priority: 'B' }]
    const plan = initialize()
    expect(cmdShift(dir, { from: '2026-09-12', to: '2026-09-13' }).code).toBe(1)
    plan.weeks.flatMap(w => w.days).find(d => d.date === '2026-09-08')!.pinned = true
    writePlan(dir, plan)
    expect(cmdShift(dir, { from: '2026-09-08', to: '2026-09-09' }).code).toBe(1)
  })
  it.each(['-5', 'abc', 'Infinity', ' '])('rejects invalid distance %s', km => {
    initialize()
    expect(cmdLog(dir, { date: '2026-09-08', km }).code).toBe(1)
  })
  it('requires the actual test time rather than reusing the whole session time', () => {
    const plan = initialize()
    const day = plan.weeks.flatMap(w => w.days).find(d => d.workout?.kind === 'test')!
    expect(cmdLog(dir, { date: day.date, time: '54:00', km: String(day.workout!.distanceKm) }).code).toBe(0)
    let result = cmdAdapt(dir, { date: day.date })
    expect(result.output).not.toContain('timeSec: 3240')
    expect(result.output).toContain('<time in seconds>')
    expect(cmdLog(dir, { date: day.date, time: '54:00', testTime: '24:00', km: String(day.workout!.distanceKm) }).code).toBe(0)
    result = cmdAdapt(dir, { date: day.date })
    expect(result.output).toContain('timeSec: 1440')
  })
})

function fitDistance(steps: ReturnType<typeof toFitSteps>): number {
  return steps.reduce((km, s, i) => km + (s.durationType === 1 ? s.durationValue / 100000
    : s.durationType === 6 ? fitDistance(steps.slice(s.durationValue, i)) * (s.targetValue - 1) : 0), 0)
}
it('keeps generated hills and odd alternating distances identical on the watch', () => {
  const hill = initialize().weeks.flatMap(w => w.days).find(d => d.workout?.kind === 'easy_hills')!.workout!
  expect(fitDistance(toFitSteps(hill))).toBeCloseTo(hill.distanceKm, 4)
  const workout = { kind: 'quality_continuous' as const, distanceKm: 5, ruleRefs: [], segments: [
    { type: 'alternating' as const, distanceKm: 5, pace: { loSecPerKm: 240, hiSecPerKm: 300 }, description: 'alternating' },
  ] }
  expect(fitDistance(toFitSteps(workout))).toBe(5)
  expect(toWorkoutSyntax(workout.segments)).toContain('2x\n- 1km 4:00/km Pace\n- 1km 5:00/km Pace\n\n- 1km 4:00/km Pace')
})
