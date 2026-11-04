/** Adapter: the established running engine remains authoritative after migration. */
import { estimateWorkoutMinutes, predictTimeSec, type PlannedWorkout, type SportsConfig, type SportsPlan, type TrainingSession } from 'trainctl-core'
import { computePlan, dayFingerprint, workoutText, type StoredPlan } from './planfile.ts'
import type { TrainctlConfig } from './config.ts'
import { rebuildPlan } from './regenerate.ts'

export function runningDurationMinutes(plan: StoredPlan, workout: PlannedWorkout, date: string): number {
  const explicit = estimateWorkoutMinutes(workout, 0)
  if (Number.isFinite(explicit)) return explicit
  const seconds = date === plan.goal.date ? plan.goal.targetTimeSec ?? plan.prediction?.hiSec : undefined
  // Legacy races may lack an estimate. Use only the existing running calibration,
  // retaining the original workout unchanged and labelling the estimate's source.
  return Math.ceil((seconds ?? predictTimeSec(workout.raceDistanceKm ?? workout.distanceKm, plan.vdot)) / 60)
}

export function runningSessions(plan: StoredPlan, cycleId: string): TrainingSession[] {
  return plan.weeks.flatMap(w => w.days.flatMap(d => (['run', 'strength'] as const).flatMap(sport => {
    const workout = d.workout, strength = d.strength
    if (sport === 'run' ? !workout : !strength) return []
    const seconds = sport === 'run' ? Math.max(60, Math.round(runningDurationMinutes(plan, workout!, d.date) * 60)) : strength!.durationMin * 60
    const approved = !!(d.timeAdjustment && d.timeAdjustment.origin !== 'profile') || !!(plan.generatedDays && plan.generatedDays[d.date] !== dayFingerprint(d))
    return [{ id: `${cycleId}-${d.date}-${sport}`, date: d.date, sport,
      purpose: sport === 'strength' ? 'strength' : workout!.kind === 'race' ? 'race' : workout!.kind === 'long' ? 'long' : workout!.kind.includes('quality') || workout!.kind === 'test' ? 'intervals' : 'easy',
      durationSec: seconds, preparationSec: sport === 'run' ? (plan.preparationMinutes ?? 15) * 60 : 0,
      steps: [{ role: 'work', durationSec: seconds, target: { kind: 'open' } }],
      ruleRefs: sport === 'run' ? workout!.ruleRefs : strength!.ruleRefs,
      ...(sport === 'run' && !Number.isFinite(estimateWorkoutMinutes(workout!,0)) ? {durationSource:'running-prediction'} : {}),
      ...(approved ? { approved: true } : {}), ...(d.pinned ? { pinned: true } : {}),
      ...(sport === 'run' ? { legacyWorkout: workout!, distanceM: (workout!.raceDistanceKm ?? workout!.distanceKm) * 1000, description: workoutText(d), externalId: `trainctl-${d.date}` } : { description: strength!.description, externalId: `trainctl-${d.date}-strength` }),
    } as TrainingSession]
  })))
}

export function regenerateRunning(existing: SportsPlan, config: SportsConfig, today: string, fixed: Set<string>, cycleId = existing.cycleId): { sessions: TrainingSession[]; generatorPlan: StoredPlan } | undefined {
  if (!existing.legacy || !config.athlete.sports.run) return undefined
  const profile = config.athlete.sports.run
  const original = existing.legacy.config as TrainctlConfig
  const running: TrainctlConfig = structuredClone(original)
  running.athlete = { ...running.athlete, ...profile.running,
    results: profile.results ?? original.athlete.results,
    daysAvailable: profile.daysAvailable ?? original.athlete.daysAvailable,
  }
  if (config.goal.kind === 'race' && config.goal.sport === 'run') running.goal = { ...running.goal, kind: 'race', date: config.goal.date, name: config.goal.name, distanceKm: config.goal.distanceM! / 1000 }
  else running.goal = { kind: 'base', date: config.goal.date, name: config.goal.name, distanceKm: 0, priority: 'A' }
  // Running has its own training allocation; shared occupied-time constraints are
  // checked after composition with cycling/swimming (never spent twice).
  if (Object.keys(config.athlete.sports).length > 1) running.time = { weeklyMinutes: profile.weeklyMinutes + (profile.preparationMinutes ?? 15) * profile.sessionsPerWeek }
  else if (config.time) running.time = config.time
  const old = (existing.legacy.generatorPlan ?? existing.legacy.plan) as StoredPlan
  const retired = new Set(existing.retiredSessionIds ?? [])
  const recorded = new Set([...existing.sessions, ...existing.archive].filter(s => fixed.has(s.id) || existing.archive.some(a => a.id === s.id && !retired.has(a.id))).map(s => {
    // IDs retain their original date when a session is moved.
    const match = /-(\d{4}-\d{2}-\d{2})-(run|strength)$/.exec(s.id)
    return match?.[1] ?? s.date
  }))
  const rebuilt = rebuildPlan(old, running, { today, recorded }).plan
  return { sessions: runningSessions(rebuilt, cycleId), generatorPlan: rebuilt }
}

/** New v2 profiles can opt into the full running engine with an actual running baseline/result. */
export function initialRunning(config: SportsConfig, from: string, cycleId: string): { sessions: TrainingSession[]; legacy: NonNullable<SportsPlan['legacy']> } | undefined {
  const p = config.athlete.sports.run
  if (!p?.running || !p.results?.length) return undefined
  const goal: TrainctlConfig['goal'] = config.goal.kind === 'race' && config.goal.sport === 'run'
    ? {kind:'race',date:config.goal.date,name:config.goal.name,distanceKm:config.goal.distanceM!/1000,priority:'A'}
    : {kind:'base',date:config.goal.date,name:config.goal.name,distanceKm:0,priority:'A'}
  const running: TrainctlConfig = { athlete:{...p.running,results:p.results,daysAvailable:p.daysAvailable ?? ['mon','wed','fri','sun']},goal,
    time:{weeklyMinutes:p.weeklyMinutes+(p.preparationMinutes??15)*p.sessionsPerWeek},...(config.language?{language:config.language}:{}) }
  const plan=computePlan(running,from,from)
  return {sessions:runningSessions(plan,cycleId),legacy:{plan,config:running,cycleId,generatorPlan:plan}}
}
