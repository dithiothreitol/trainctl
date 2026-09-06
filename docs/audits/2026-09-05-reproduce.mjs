// Audit probes for trainctl 0.2.0, not regression tests expecting correct behavior.
// Run from any directory: node docs/audits/2026-09-05-reproduce.mjs
// All athlete data are synthetic. Writes only to newly created OS temp directories.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { computePlan, writePlan, shiftWorkout } from '../../packages/cli/src/planfile.ts'
import { prepareProposal, applyProposal } from '../../packages/cli/src/proposals.ts'
import { cmdAdapt, cmdLog, cmdReschedule } from '../../packages/cli/src/commands.ts'
import { buildExecution } from '../../packages/cli/src/execution.ts'
import { analyzeExecution, estimateWorkoutMinutes, validatePlan, reschedule, setLocale } from '../../packages/core/src/index.ts'
import { toFitSteps } from '../../packages/export/src/fit.ts'
import { toWorkoutSyntax } from '../../packages/sync-intervalsicu/src/workout-syntax.ts'

setLocale('en')
const config = {
  athlete: { recentWeeklyKm: 45, daysAvailable: ['tue', 'wed', 'thu', 'sat', 'sun'], longRunDay: 'sun',
    results: [{ date: '2026-03-29', distanceKm: 10, timeSec: 2580 }] },
  goal: { name: 'Synthetic HM', date: '2026-11-29', distanceKm: 21.0975, priority: 'A' },
}
const findings = []
const record = (id, evidence) => findings.push({ id, evidence })
const createWorkspace = (c = config) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'trainctl-audit-'))
  fs.writeFileSync(path.join(dir, 'trainctl.yaml'), JSON.stringify(c))
  writePlan(dir, computePlan(c, '2026-08-03'))
  return dir
}
const plan = computePlan(config, '2026-08-03')
const longDay = plan.weeks[0].days.find(d => d.workout?.kind === 'long').weekday
assert.equal(longDay, 'sat')
record('A07', { requestedLongDay: 'sun', actualLongDay: longDay })

const low = computePlan({ ...config, athlete: { ...config.athlete, recentWeeklyKm: 10 } }, '2026-08-03')
const lowWeek = low.weeks[0]
const warnings = validatePlan(low).filter(i => i.date >= '2026-08-03' && i.date <= '2026-08-09')
assert.equal(lowWeek.skeleton.targetKm, 11)
assert.equal(lowWeek.totalKm, 19)
assert.equal(warnings.length, 0)
record('A01', { baseline: 10, target: 11, actual: 19, easyShare: lowWeek.easyShare, warnings })

const raceConfig = { ...config, athlete: { ...config.athlete,
  tuneUpRaces: [{ date: '2026-08-08', distanceKm: 21.0975, priority: 'B' }] } }
const racePlan = computePlan(raceConfig, '2026-08-03')
const rw = racePlan.weeks[0]
const logs = rw.days.filter(d => d.workout).map(d => ({ date: d.date, status: 'done',
  km: d.workout.kind === 'race' ? 21.0975 : d.workout.distanceKm }))
const analysis = analyzeExecution({ today: '2026-08-09',
  execution: buildExecution(racePlan, [], logs, '2026-08-09'), currentWeeklyKm: rw.skeleton.targetKm,
  lastRace: { date: '2026-08-08', distanceKm: 21.0975 } })
assert.equal(analysis.complianceKm, 1.66)
assert(analysis.actions.some(a => a.type === 'raise-baseline'))
record('A03', { plannedKm: rw.totalKm, compliance: analysis.complianceKm,
  actions: analysis.actions.map(a => a.type),
  estimatedRaceMinutes: estimateWorkoutMinutes(rw.days.find(d => d.workout?.kind === 'race').workout) })

function fitTotals(steps) {
  let km = 0, seconds = 0
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i]
    if (s.durationType === 1) km += s.durationValue / 100000
    else if (s.durationType === 0) seconds += s.durationValue / 1000
    else {
      const sub = fitTotals(steps.slice(s.durationValue, i))
      km += sub.km * (s.targetValue - 1)
      seconds += sub.seconds * (s.targetValue - 1)
    }
  }
  return { km, seconds }
}
const hill = plan.weeks.flatMap(w => w.days).find(d => d.workout?.kind === 'easy_hills').workout
const hillFit = fitTotals(toFitSteps(hill))
assert.equal(hill.distanceKm, 9)
assert.equal(hillFit.km, 12)
const odd = { kind: 'quality_continuous', distanceKm: 5, ruleRefs: [], segments: [
  { type: 'alternating', distanceKm: 5, pace: { loSecPerKm: 240, hiSecPerKm: 300 }, description: '5 km alternating' },
] }
assert.equal(fitTotals(toFitSteps(odd)).km, 4)
record('A04', { hillPlanKm: 9, hillFit, hillEstimateMin: estimateWorkoutMinutes(hill, 0),
  hillSyntax: toWorkoutSyntax(hill.segments), oddPlanKm: 5, oddFitKm: 4, oddSyntax: toWorkoutSyntax(odd.segments) })

const lostConfig = { ...config, athlete: { ...config.athlete, tuneUpRaces: [
  { date: '2026-11-21', distanceKm: 10, priority: 'B' },
  { date: '2026-09-12', distanceKm: 5, priority: 'B' },
  { date: '2026-09-13', distanceKm: 10, priority: 'C' },
] } }
const lost = computePlan(lostConfig, '2026-08-03')
const races = lost.weeks.flatMap(w => w.days).filter(d => d.workout?.kind === 'race').map(d => d.date)
assert.deepEqual(races, ['2026-09-12', '2026-11-29'])
assert.deepEqual(lost.feasibilityWarnings, [])
record('A06', { requested: lostConfig.athlete.tuneUpRaces.map(r => r.date), scheduled: races, warnings: [] })

const strengthWeek = computePlan({ ...config, strength: { enabled: true, days: ['fri'] } }, '2026-08-03').weeks[0]
const blocked = reschedule({ week: strengthWeek, blockedDates: ['2026-08-07'], availableDays: config.athlete.daysAvailable })
assert(blocked.days.find(d => d.date === '2026-08-07').strength)
record('A08', { blockedDate: '2026-08-07', remainingStrengthMin: 35 })
const shifted = structuredClone(racePlan)
shiftWorkout(shifted, '2026-08-08', '2026-08-09')
assert(shifted.weeks[0].days.find(d => d.date === '2026-08-09').workout.kind === 'race')
record('A09', { tuneUpMovedFrom: '2026-08-08', tuneUpMovedTo: '2026-08-09' })

const c55 = { ...config, athlete: { ...config.athlete, recentWeeklyKm: 55 } }
const dir = createWorkspace(c55)
const reduction = { dataStatus: 'complete', unknownSessions: 0, windowDays: 21, complianceKm: 0.5,
  missedSessions: 0, diagnosis: [], warnings: [],
  actions: [{ type: 'reduce-volume', detail: 'Synthetic reduction', suggestedWeeklyKm: 20, ruleRefs: [] }] }
const reduced = prepareProposal(dir, '2026-09-05', reduction)
const next = reduced.plan.weeks.find(w => w.weekStart === '2026-09-07')
assert.equal(next.skeleton.targetKm, 28)
assert.equal(next.totalKm, 25)
applyProposal(dir, reduced.id)
c55.athlete.results = [...c55.athlete.results, { date: '2026-09-05', distanceKm: 10, timeSec: 2500 }]
fs.writeFileSync(path.join(dir, 'trainctl.yaml'), JSON.stringify(c55))
const recal = prepareProposal(dir, '2026-09-05', { ...reduction,
  actions: [{ type: 'recalibrate-zones', detail: 'New result', ruleRefs: [] }] })
const restored = recal.plan.weeks.find(w => w.weekStart === '2026-09-07')
assert.equal(restored.totalKm, 63)
record('A02', { suggestedBaseline: 20, nextTarget: 28, nextActual: 25,
  recalibrationOnlyActual: 63, unchangedConfigBaseline: 55 })

for (const km of ['-5', 'abc', 'Infinity']) assert.equal(cmdLog(dir, { date: '2026-08-04', km }).code, 0)
record('A10', { acceptedDistances: ['-5', 'abc', 'Infinity'] })

const oldDir = createWorkspace()
const old = prepareProposal(oldDir, '2026-08-10', reduction)
const applied = applyProposal(oldDir, old.id)
const pastChanged = applied.changes.filter(c => c.date < '2026-09-05').length
assert(pastChanged > 0)
record('A05', { createdFor: old.createdFor, auditDate: '2026-09-05', earlierThanAuditChangedDays: pastChanged,
  note: 'Apply has no current-date validation; this probe uses the real system clock.' })

const testDir = createWorkspace()
const testDay = plan.weeks.flatMap(w => w.days).find(d => d.workout?.kind === 'test')
cmdLog(testDir, { date: testDay.date, km: String(testDay.workout.distanceKm), time: '54:00' })
const testAdapt = cmdAdapt(testDir, { date: testDay.date })
const calibrationAction = testAdapt.data.proposal.actions.find(a => a.type === 'recalibrate-zones')
assert(calibrationAction.detail.includes('timeSec: 3240'))
record('A11', { wholeSessionKm: testDay.workout.distanceKm, wholeTimeSec: 3240,
  testKm: testDay.workout.segments.find(s => s.type === 'race').distanceKm, suggestedAction: calibrationAction.detail })

const historyDir = createWorkspace()
const historical = cmdReschedule(historyDir, { date: '2026-08-03', block: ['2026-08-04'], apply: true })
assert.equal(historical.code, 0)
assert(historical.data.result.moved.length > 0)
record('A05b', { selectedWeek: '2026-08-03', changesInActualPast: historical.data.result.moved })

const high = computePlan({ ...config, athlete: { ...config.athlete, recentWeeklyKm: 70,
  daysAvailable: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] } }, '2026-08-03')
record('A12', high.weeks.slice(-4).map(w => ({ date: w.weekStart, phase: w.skeleton.phase,
  keepFrequency: w.skeleton.keepFrequency, sessions: w.days.filter(d => d.workout).length })))
console.log(JSON.stringify({ version: '0.2.0', probes: findings.length, findings }, null, 2))
