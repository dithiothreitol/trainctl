import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { addDays, analyzeExecution, estimateWorkoutMinutes, setLocale } from 'trainctl-core'
import { cmdAdapt, cmdExport, cmdLog, cmdPlan, cmdReschedule, cmdReview, cmdShift, cmdWhy, buildExecution } from './commands.ts'
import { loadPlan, PLAN_YAML, writePlan } from './planfile.ts'
import { compare, readSnapshot, writeSnapshot } from './sync.ts'
import { inspectCalibration } from './calibration.ts'

const CONFIG = `athlete:
  recentWeeklyKm: 55
  daysAvailable: [tue, wed, thu, sat, sun]
  results:
    - { date: "2026-03-30", distanceKm: 10, timeSec: 2700 }
goal:
  name: "Autumn race"
  date: "2026-11-29"
  distanceKm: 21.0975
  priority: A
`
let dir: string
beforeEach(() => {
  setLocale('en')
  dir = mkdtempSync(join(tmpdir(), 'trainctl-improvements-'))
  writeFileSync(join(dir, 'trainctl.yaml'), CONFIG)
  expect(cmdPlan(dir, { date: '2026-08-03' }).code).toBe(0)
})
afterEach(() => rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }))

function newResult() {
  writeFileSync(join(dir, 'trainctl.yaml'), CONFIG.replace('goal:', '    - { date: "2026-08-20", distanceKm: 10, timeSec: 2500 }\ngoal:'))
}

describe('execution evidence', () => {
  it('does not interpret a stale observation window as a confirmed layoff', () => {
    const proposal = analyzeExecution({ today: '2026-08-24', currentWeeklyKm: 55, execution: [
      { date: '2026-08-05', plannedKm: 10, actualKm: 10, status: 'done' },
      { date: '2026-08-06', plannedKm: 10, status: 'missed' },
    ] })
    expect(proposal.dataStatus).toBe('incomplete')
    expect(proposal.actions).toEqual([])
  })
  it('never counts a bike ride or withheld data as running', () => {
    const plan = loadPlan(dir)
    const date = '2026-08-04'
    const rows = compare(plan, [
      { externalId: 'bike', type: 'Ride', date, distanceKm: 10 },
      { externalId: 'hidden', type: 'Run', date, dataWithheld: true },
    ], date, date)
    expect(rows[0]).toMatchObject({ status: 'unknown' })
    expect(rows[0]?.actualKm).toBeUndefined()
  })

  it('uses the latest journal correction consistently in review and adaptation', async () => {
    const date = '2026-08-04'
    writeSnapshot(dir, { pulledAt: date, activities: [{ externalId: 'run', date, type: 'Run', distanceKm: 12 }], wellness: [] })
    cmdLog(dir, { date, status: 'done', km: '8' })
    cmdLog(dir, { date, status: 'skipped' })
    const adaptation = cmdAdapt(dir, { date: '2026-08-05' })
    expect((adaptation.data?.execution as any[]).find((e) => e.date === date)).toMatchObject({ status: 'missed', actualKm: 0, source: 'journal' })
    const review = await cmdReview(dir, { date: '2026-08-05' })
    expect((review.data?.rows as any[]).find((e) => e.date === date)).toMatchObject({ status: 'missed', actualKm: 0 })
  })

  it('does not infer a long layoff from one confirmed missed session', () => {
    const p = analyzeExecution({ today: '2026-08-04', currentWeeklyKm: 55, execution: [{ date: '2026-08-04', plannedKm: 8, status: 'missed' }] })
    expect(p.actions.some((a) => a.type === 'conservative-restart')).toBe(false)
  })

  it('refreshing a shorter interval preserves older history and replaces that interval', () => {
    writeSnapshot(dir, { pulledAt: '2026-08-10', from: '2026-08-01', to: '2026-08-10', activities: [
      { externalId: 'old', date: '2026-08-02', type: 'Run', distanceKm: 5 },
      { externalId: 'corrected', date: '2026-08-09', type: 'Run', distanceKm: 9 },
    ], wellness: [] })
    writeSnapshot(dir, { pulledAt: '2026-08-11', from: '2026-08-08', to: '2026-08-11', activities: [
      { externalId: 'corrected', date: '2026-08-09', type: 'Run', distanceKm: 7 },
    ], wellness: [] })
    expect(readSnapshot(dir)?.activities.map((a) => [a.externalId, a.distanceKm])).toEqual([['old', 5], ['corrected', 7]])
  })
})

describe('calibration and reviewed adaptations', () => {
  it('prepares volume corrections using observed sessions, without overwriting past weeks', () => {
    const before = loadPlan(dir)
    for (const day of before.weeks.flatMap((w) => w.days).filter((d) => d.date <= '2026-08-24' && d.workout)) {
      cmdLog(dir, { date: day.date, status: 'done', km: String(day.workout!.distanceKm * 0.5) })
    }
    const result = cmdAdapt(dir, { date: '2026-08-24', prepare: true })
    expect(result.code, result.output).toBe(0)
    expect((result.data?.proposal as any).actions.some((a: any) => a.type === 'reduce-volume')).toBe(true)
    const prepared = result.data?.prepared as { id: string; changes: { date: string }[] }
    expect(prepared.changes.length).toBeGreaterThan(0)
    expect(cmdAdapt(dir, { apply: prepared.id }).code).toBe(0)
    expect(loadPlan(dir).weeks[0]).toEqual(before.weeks[0])
  })

  it('detects a new result even if its race predates plan generation', () => {
    writeFileSync(join(dir, 'trainctl.yaml'), CONFIG.replace('goal:', '    - { date: "2026-07-20", distanceKm: 5, timeSec: 1200 }\ngoal:'))
    const r = cmdAdapt(dir, { date: '2026-08-21' })
    expect((r.data?.proposal as any).actions.map((a: any) => a.type)).toContain('recalibrate-zones')
  })

  it('reports selected and excluded results, including exclusion reasons', () => {
    const calibration = inspectCalibration([
      { date: '2026-08-01', distanceKm: 10, timeSec: 2100, excluded: true, exclusionReason: 'short course' },
      { date: '2026-07-01', distanceKm: 10, timeSec: 2700 },
    ], '2026-08-21')
    expect(calibration.selected?.timeSec).toBe(2700)
    expect(calibration.candidates[0]?.reason).toBe('excluded')
    expect(cmdWhy(dir, { date: '2026-08-04' }).data?.calibration).toBeDefined()
  })

  it('prepares without changing files, then applies the reviewed plan while preserving manual days', () => {
    newResult()
    expect(cmdShift(dir, { from: '2026-08-25', to: '2026-08-26' }).code).toBe(0)
    const before = loadPlan(dir)
    const yaml = readFileSync(join(dir, PLAN_YAML), 'utf-8')
    const config = readFileSync(join(dir, 'trainctl.yaml'), 'utf-8')
    const r = cmdAdapt(dir, { date: '2026-08-21', prepare: true })
    expect(r.code, r.output).toBe(0)
    const prepared = r.data?.prepared as { id: string; changes: { date: string }[] }
    expect(prepared.changes.length).toBeGreaterThan(0)
    expect(prepared.changes.every((c) => c.date > '2026-08-21' && !['2026-08-25', '2026-08-26'].includes(c.date))).toBe(true)
    expect(readFileSync(join(dir, PLAN_YAML), 'utf-8')).toBe(yaml)
    expect(cmdAdapt(dir, { apply: prepared.id }).code).toBe(0)
    const after = loadPlan(dir)
    for (const day of before.weeks.flatMap((w) => w.days).filter((d) => d.date <= '2026-08-21' || ['2026-08-25', '2026-08-26'].includes(d.date))) {
      expect(after.weeks.flatMap((w) => w.days).find((d) => d.date === day.date)).toEqual(day)
    }
    expect(after.vdot).toBeGreaterThan(before.vdot)
    expect(readFileSync(join(dir, 'trainctl.yaml'), 'utf-8')).toBe(config)
    expect(cmdAdapt(dir, { apply: prepared.id }).code).toBe(1)
  })

  it.each(['plan', 'journal', 'config', 'sync'])('refuses a proposal after %s changes', (changed) => {
    newResult()
    const r = cmdAdapt(dir, { date: '2026-08-21', prepare: true })
    expect(r.code, r.output).toBe(0)
    const id = (r.data?.prepared as { id: string }).id
    if (changed === 'plan') cmdShift(dir, { from: '2026-08-25', to: '2026-08-26' })
    if (changed === 'journal') cmdLog(dir, { date: '2026-08-20', status: 'done', km: '10' })
    if (changed === 'config') writeFileSync(join(dir, 'trainctl.yaml'), CONFIG)
    if (changed === 'sync') writeSnapshot(dir, { pulledAt: '2026-08-21', activities: [], wellness: [] })
    const before = readFileSync(join(dir, PLAN_YAML), 'utf-8')
    expect(cmdAdapt(dir, { apply: id }).code).toBe(1)
    expect(readFileSync(join(dir, PLAN_YAML), 'utf-8')).toBe(before)
  })

  it('rejects an edited proposal and path traversal', () => {
    newResult()
    const r = cmdAdapt(dir, { date: '2026-08-21', prepare: true })
    expect(r.code, r.output).toBe(0)
    const id = (r.data?.prepared as { id: string }).id
    const path = join(dir, 'plan/proposals', id + '.json')
    const proposal = JSON.parse(readFileSync(path, 'utf-8'))
    proposal.plan.vdot = 99
    writeFileSync(path, JSON.stringify(proposal))
    expect(cmdAdapt(dir, { apply: id }).code).toBe(1)
    expect(cmdAdapt(dir, { apply: '../../trainctl.yaml' }).code).toBe(1)
  })
})

describe('time-aware plans and mobile export', () => {
  it('protects synchronized completed sessions from rescheduling', () => {
    writeSnapshot(dir, { pulledAt: '2026-08-25', activities: [{ externalId: 'completed', date: '2026-08-25', type: 'Run', distanceKm: 8 }], wellness: [] })
    const before = readFileSync(join(dir, PLAN_YAML), 'utf-8')
    const r = cmdReschedule(dir, { date: '2026-08-24', block: ['2026-08-25'], apply: true })
    expect(r.code).toBe(1)
    expect(readFileSync(join(dir, PLAN_YAML), 'utf-8')).toBe(before)
  })
  it('honors every time budget and persists a pinned training day', () => {
    const before = readFileSync(join(dir, PLAN_YAML), 'utf-8')
    const opts = { date: '2026-08-24', time: ['2026-08-27=35'], pin: ['2026-08-29'], preparation: '10' }
    const preview = cmdReschedule(dir, opts)
    expect(preview.code, preview.output).toBe(0)
    expect(readFileSync(join(dir, PLAN_YAML), 'utf-8')).toBe(before)
    const applied = cmdReschedule(dir, { ...opts, apply: true })
    expect(applied.code, applied.output).toBe(0)
    const plan = loadPlan(dir)
    const thursday = plan.weeks.flatMap((w) => w.days).find((d) => d.date === '2026-08-27')!
    expect(thursday.workout ? estimateWorkoutMinutes(thursday.workout, 10) : 0).toBeLessThanOrEqual(35)
    expect(plan.weeks.flatMap((w) => w.days).find((d) => d.date === '2026-08-29')?.pinned).toBe(true)
    expect(cmdReschedule(dir, { date: '2026-08-24', block: ['2026-08-29'], apply: true }).code).toBe(1)
  })

  it.each(['2026-08-27=-1', '2026-08-27=NaN', '2026-08-27=35.5', '2026-09-31=50'])('rejects malformed budget %s without writing', (time) => {
    const before = readFileSync(join(dir, PLAN_YAML), 'utf-8')
    expect(cmdReschedule(dir, { date: '2026-08-24', time: [time], apply: true }).code).toBe(1)
    expect(readFileSync(join(dir, PLAN_YAML), 'utf-8')).toBe(before)
  })

  it.each(['en', 'pl'] as const)('exports a standalone mobile page in %s and escapes user content', (locale) => {
    setLocale(locale)
    cmdPlan(dir, { date: '2026-08-03' })
    const plan = loadPlan(dir)
    plan.goal.name = '<script>alert(1)</script>'
    writePlan(dir, plan)
    const r = cmdExport(dir, { what: 'mobile', date: '2026-08-04' })
    expect(r.code, r.output).toBe(0)
    const html = readFileSync(join(dir, 'export/2026-08-04-mobile.html'), 'utf-8')
    expect(html).toContain('name="viewport"')
    expect(html).toContain('lang="' + locale + '"')
    expect(html).toContain('&lt;script&gt;')
    expect(html).not.toMatch(/<script|<iframe|https?:\/\//)
    expect(html).toContain(locale === 'pl' ? 'Twój trening' : 'Your session')
  })
})
