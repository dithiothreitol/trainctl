import { diffDays, estimateWorkoutMinutes, fmtPace, messages, type ExecutionRecord, type Microcycle, type PlannedDay } from 'trainctl-core'
import { dayFingerprint, type StoredPlan } from './planfile.ts'
import { ui } from './i18n/index.ts'
import { kindPurpose } from './rules-explain.ts'

/** Facts from the stored plan, with no invented rationale for arbitrary edits. */
export function explainSession(plan: StoredPlan, week: Microcycle, day: PlannedDay, execution?: ExecutionRecord) {
  const t = ui().coach
  const demanding = new Set(['long', 'quality_intervals', 'quality_continuous', 'sharpener', 'test', 'race'])
  const neighbors = plan.weeks.flatMap(w => w.days).filter(d => d.workout && demanding.has(d.workout.kind)).sort((a, b) => a.date.localeCompare(b.date))
  const previous = neighbors.filter(d => d.date < day.date).at(-1)
  const next = neighbors.find(d => d.date > day.date)
  const neighbor = (d: PlannedDay | undefined) => d?.workout ? { date: d.date, kind: d.workout.kind, gapDays: Math.abs(diffDays(day.date, d.date)) } : null
  const placement = { previous: neighbor(previous), next: neighbor(next) }
  const kindLabel = (kind: string) => (messages().kind as Record<string, string>)[kind] ?? kind
  const toGoal = diffDays(day.date, plan.goal.date)
  const context = [plan.goal.kind === 'base' ? t.goalBase(plan.goal.name, plan.goal.date)
    : toGoal >= 0 ? t.goal(plan.goal.name, plan.goal.distanceKm, plan.goal.date, toGoal)
      : t.goalBehind(plan.goal.name, plan.goal.distanceKm, plan.goal.date, -toGoal),
    t.weekContext(messages().phase[week.skeleton.phase], week.totalKm, week.skeleton.targetKm, Math.round(week.easyShare * 100))]
  if (week.skeleton.deload) context.push(t.deload)
  if (week.skeleton.keepIntensity || week.skeleton.keepFrequency) context.push(t.taper)
  if (placement.previous) context.push(t.previous(placement.previous.date, kindLabel(placement.previous.kind), placement.previous.gapDays))
  if (placement.next) context.push(t.next(placement.next.date, kindLabel(placement.next.kind), placement.next.gapDays))
  if (!previous && !next) context.push(t.noNeighbors)
  if (day.workout && demanding.has(day.workout.kind) && [placement.previous, placement.next].some(n => n && n.gapDays < 2)) context.push(t.tightSpacing)
  if (day.timeAdjustment) {
    const a = day.timeAdjustment
    context.push(t.adjusted(kindLabel(a.originalKind), a.originalDistanceKm, a.budgetMinutes), t[a.status === 'easy-alternative' ? 'lost-purpose' : 'reduced-dose'])
  } else if (plan.generatedDays && plan.generatedDays[day.date] !== dayFingerprint(day)) context.push(t.changedManually)
  const status = execution?.status ?? 'planned'
  context.push(t.execution(t.status[status]))
  const preparationMinutes = plan.preparationMinutes ?? 15
  const strengthMinutes = day.strength?.durationMin ?? 0
  const estimate = (day.workout ? estimateWorkoutMinutes(day.workout, preparationMinutes) : 0) + strengthMinutes
  const budget = plan.timeBudgets?.[day.date]
  if (budget !== undefined) context.push(t.budget(budget, day.workout ? preparationMinutes : 0, strengthMinutes))
  const prescription = (day.workout?.segments ?? []).map(s => ({
    type: s.type, description: s.description,
    distanceKm: s.distanceKm ?? (s.reps ?? 0) * (s.repM ?? 0) / 1000,
    pace: s.pace ?? null, reps: s.reps ?? null, repM: s.repM ?? null, recoverySec: s.recoverySec ?? null,
  }))
  const dose = prescription.map(s => t.segment(s.description, s.distanceKm, s.pace ? `${fmtPace(s.pace.loSecPerKm)}–${fmtPace(s.pace.hiSecPerKm)}` : ''))
  return { purpose: day.workout ? kindPurpose(day.workout.kind) : day.strength ? ui().why.strengthPurpose : t.restPurpose,
    context, placement, prescription, dose, execution: status,
    estimatedMinutes: Number.isFinite(estimate) ? estimate : null, budgetMinutes: budget ?? null }
}
