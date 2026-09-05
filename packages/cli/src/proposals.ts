import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { estimateWorkoutMinutes, validatePlan, weekTotals, withLocale, type AdaptationProposal, type PlannedDay } from 'trainctl-core'
import { CONFIG_FILE, loadConfig } from './config.ts'
import { readLog, LOG_FILE } from './logfile.ts'
import { computePlan, dayFingerprint, loadPlan, PLAN_YAML, writePlan, workoutText, type StoredPlan } from './planfile.ts'
import { ui } from './i18n/index.ts'

export interface PlanProposal {
  schemaVersion: 1
  id: string
  baseHash: string
  createdFor: string
  analysis: AdaptationProposal
  vdotBefore: number
  changes: { date: string; before: string; after: string; beforeKm: number; afterKm: number }[]
  protectedDates: string[]
  plan: StoredPlan
}

const hash = (text: string): string => createHash('sha256').update(text).digest('hex')
export function workspaceHash(cwd: string): string {
  return hash(JSON.stringify([PLAN_YAML, CONFIG_FILE, LOG_FILE, 'sync.json'].map((name) => {
    const path = join(cwd, name)
    return [name, existsSync(path) ? readFileSync(path, 'utf-8') : null]
  })))
}
const proposalId = (proposal: Omit<PlanProposal, 'id'>): string => hash(JSON.stringify(proposal)).slice(0, 24)

/** Prepare a complete, content-addressed future plan. No changes to athlete files. */
export function prepareProposal(cwd: string, today: string, analysis: AdaptationProposal): PlanProposal {
  const baseHash = workspaceHash(cwd)
  const plan = loadPlan(cwd)
  if (!plan.calibration || !plan.generatedDays) throw new Error(ui().improve.oldPlan)
  if (analysis.actions.some((a) => a.type === 'post-race-recovery' || a.type === 'conservative-restart')) throw new Error(ui().improve.manualRecovery)
  const volume = analysis.actions.find((a) => a.suggestedWeeklyKm !== undefined)
  const recalibrate = analysis.actions.some((a) => a.type === 'recalibrate-zones')
  if (!volume && !recalibrate) throw new Error(ui().improve.noPatch)
  const config = loadConfig(cwd)
  if (JSON.stringify(config.goal) !== JSON.stringify(plan.goal)) throw new Error(ui().improve.changedGoal)
  const nextConfig = structuredClone(config)
  if (volume?.suggestedWeeklyKm !== undefined) nextConfig.athlete.recentWeeklyKm = volume.suggestedWeeklyKm
  const candidate = withLocale(plan.locale === 'pl' ? 'pl' : 'en', () => computePlan(nextConfig, plan.generatedAt, today))
  const candidateDays = new Map(candidate.weeks.flatMap((w) => w.days).map((day) => [day.date, day]))
  const recorded = new Set(readLog(cwd).map((entry) => entry.date))
  const next = structuredClone(plan)
  const protectedDates: string[] = []
  const changes: PlanProposal['changes'] = []
  const describeDay = (day: PlannedDay): string => [workoutText(day), ...(day.strength ? [ui().today.strengthTitle(day.strength.durationMin) + ': ' + day.strength.description] : [])].join(' + ')
  for (const week of next.weeks) {
    for (let i = 0; i < week.days.length; i++) {
      const before = week.days[i]!
      const after = candidateDays.get(before.date)
      const untouched = plan.generatedDays[before.date] === dayFingerprint(before)
      const budget = plan.timeBudgets?.[before.date]
      const tooLong = after && budget !== undefined && (after.workout ? estimateWorkoutMinutes(after.workout, plan.preparationMinutes ?? 15) : 0) + (after.strength?.durationMin ?? 0) > budget
      if (before.date <= today || before.pinned || recorded.has(before.date) || !untouched || before.workout?.kind === 'race' || tooLong) {
        protectedDates.push(before.date)
        continue
      }
      if (!after || dayFingerprint(before) === dayFingerprint(after)) continue
      changes.push({ date: before.date, before: describeDay(before), after: describeDay(after), beforeKm: before.workout?.distanceKm ?? 0, afterKm: after.workout?.distanceKm ?? 0 })
      week.days[i] = structuredClone(after)
      next.generatedDays![before.date] = dayFingerprint(after)
    }
    // Preserve the history and phase boundaries; refresh totals of changed weeks.
    if (changes.some((c) => week.days.some((d) => d.date === c.date))) {
      Object.assign(week, weekTotals(week.days))
      const skeleton = candidate.weeks.find((w) => w.weekStart === week.weekStart)?.skeleton
      if (skeleton) week.skeleton = structuredClone(skeleton)
    }
  }
  next.calibration = candidate.calibration!
  next.vdot = candidate.vdot
  next.vdotSource = candidate.vdotSource
  if (candidate.prediction) next.prediction = candidate.prediction
  else delete next.prediction
  next.peakKmPlanned = Math.max(...next.weeks.map((w) => w.totalKm))
  next.feasibilityWarnings = candidate.feasibilityWarnings
  next.changes.push({ at: today, action: 'adapt', detail: analysis.actions.map((a) => a.type).join(', ') })
  // Lint remains visible in the preview; broken file invariants never reach disk.
  const errors = validatePlan(next).filter((issue) => issue.severity === 'error')
  if (errors.length) throw new Error(ui().improve.invalidProposal)
  if (!changes.length && JSON.stringify(next.calibration) === JSON.stringify(plan.calibration)) throw new Error(ui().improve.noPatch)
  const body: Omit<PlanProposal, 'id'> = { schemaVersion: 1, baseHash, createdFor: today, analysis, vdotBefore: plan.vdot, changes, protectedDates, plan: next }
  const proposal: PlanProposal = { ...body, id: proposalId(body) }
  const dir = join(cwd, 'plan', 'proposals')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, `${proposal.id}.json`), JSON.stringify(proposal, null, 2) + '\n', 'utf-8')
  return proposal
}

/** Apply exactly the reviewed bytes; do not recompute using new data. */
export function applyProposal(cwd: string, id: string): PlanProposal {
  if (!/^[a-f0-9]{24}$/.test(id)) throw new Error(ui().improve.invalidProposal)
  const path = join(cwd, 'plan', 'proposals', `${id}.json`)
  if (!existsSync(path)) throw new Error(ui().improve.invalidProposal)
  const proposal = JSON.parse(readFileSync(path, 'utf-8')) as PlanProposal
  const { id: storedId, ...body } = proposal
  if (storedId !== id || proposalId(body) !== id || proposal.schemaVersion !== 1) throw new Error(ui().improve.invalidProposal)
  if (proposal.baseHash !== workspaceHash(cwd)) throw new Error(ui().improve.staleProposal)
  if (validatePlan(proposal.plan).some((issue) => issue.severity === 'error')) throw new Error(ui().improve.invalidProposal)
  withLocale(proposal.plan.locale === 'pl' ? 'pl' : 'en', () => writePlan(cwd, proposal.plan))
  return proposal
}
