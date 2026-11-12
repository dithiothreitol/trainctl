/** Adapter: the established running engine remains authoritative after migration. */
import { attachRunningCoaching, estimateWorkoutMinutes, predictTimeSec, runningSteps, type AthleteProfile, type PlannedWorkout, type SportsConfig, type SportsPlan, type TrainingSession, type Weekday } from 'trainctl-core'
import { computePlan, dayFingerprint, workoutText, type StoredPlan } from './planfile.ts'
import type { TrainctlConfig } from './config.ts'
import { rebuildPlan } from './regenerate.ts'
import { shownKm } from './format.ts'

export function runningDurationMinutes(plan: StoredPlan, workout: PlannedWorkout, date: string): number {
  const explicit = estimateWorkoutMinutes(workout, 0)
  if (Number.isFinite(explicit)) return explicit
  const seconds = date === plan.goal.date ? plan.goal.targetTimeSec ?? plan.prediction?.hiSec : undefined
  // Legacy races may lack an estimate. Use only the existing running calibration,
  // retaining the original workout unchanged and labelling the estimate's source.
  return Math.ceil((seconds ?? predictTimeSec(shownKm(workout), plan.vdot)) / 60)
}

export function runningSessions(plan: StoredPlan, cycleId: string): TrainingSession[] {
  return plan.weeks.flatMap(w => w.days.flatMap(d => (['run', 'strength'] as const).flatMap(sport => {
    const workout = d.workout, strength = d.strength
    if (sport === 'run' ? !workout : !strength) return []
    const seconds = sport === 'run' ? Math.max(60, Math.round(runningDurationMinutes(plan, workout!, d.date) * 60)) : strength!.durationMin * 60
    const approved = !!(d.timeAdjustment && d.timeAdjustment.origin !== 'profile') || !!(plan.generatedDays && plan.generatedDays[d.date] !== dayFingerprint(d))
    return [attachRunningCoaching({ id: `${cycleId}-${d.date}-${sport}`, date: d.date, sport,
      purpose: sport === 'strength' ? 'strength' : workout!.kind === 'race' ? 'race' : workout!.kind === 'long' ? 'long' : workout!.kind.includes('quality') || workout!.kind === 'test' ? 'intervals' : 'easy',
      durationSec: seconds, preparationSec: sport === 'run' ? (plan.preparationMinutes ?? 15) * 60 : 0,
      // E1: kroki ze struktury biegu (tempo jako zakres), z planowanym RPE segmentu na krokach pracy (C5, MS-6)
      steps: sport === 'run' ? runningSteps(workout!, seconds) : [{ role: 'work', durationSec: seconds, target: { kind: 'open' } }],
      ruleRefs: sport === 'run' ? workout!.ruleRefs : strength!.ruleRefs,
      ...(sport === 'run' && !Number.isFinite(estimateWorkoutMinutes(workout!,0)) ? {durationSource:'running-prediction'} : {}),
      ...(approved ? { approved: true } : {}), ...(d.pinned ? { pinned: true } : {}),
      ...(sport === 'run' ? { legacyWorkout: workout!, distanceM: shownKm(workout!) * 1000, description: workoutText(d), externalId: `trainctl-${d.date}` } : { description: strength!.description, externalId: `trainctl-${d.date}-strength` }),
    } as TrainingSession, {phase:w.skeleton.deload?'deload':w.skeleton.phase==='transition'?'recovery':w.skeleton.phase==='peak'?'build':w.skeleton.phase,weekIndex:w.skeleton.index,goal:{kind:plan.goal.kind==='base'?'base':'race',name:plan.goal.name,date:plan.goal.date,sport:'run',distanceM:plan.goal.distanceKm*1000}})]
  })))
}

/**
 * Ścieżki pól profilu planu biegowego w komunikatach silnika i komend → ścieżki profilu v2
 * (E3, E4): „wpisz wynik do athlete.results" w katalogu v2 wskazuje athlete.sports.run.results.
 */
export function sportsProfilePaths(text: string): string {
  return text
    .replace(/\bathlete\.(results|daysAvailable)\b/g, 'athlete.sports.run.$1')
    .replace(/\bathlete\.(recentWeeklyKm|peakWeeklyKm|longRunDay|tuneUpRaces|returning|hrMax|sex)\b/g, 'athlete.sports.run.running.$1')
}

/**
 * Profil sprzed migracji, który uzupełnia profil v2 — tylko w planie zmigrowanym przed E3,
 * gdy profil v2 nie miał jeszcze płci, HRmax, powrotu, siły ani czasu docelowego. Od E3
 * profil v2 ma wszystkie pola, więc pole usunięte z profilu v2 nie wraca z `legacy`.
 */
export const legacyProfile = (plan: SportsPlan): TrainctlConfig | undefined =>
  plan.legacy && !plan.legacy.profileInV2 ? plan.legacy.config as TrainctlConfig : undefined

/** Dni bez `daysAvailable` w profilu v2 — jak dotąd w pierwszym planie z profilu v2 (E-3, inż.). */
const DEFAULT_RUNNING_DAYS: Weekday[] = ['mon', 'wed', 'fri', 'sun']

/**
 * Profil planu biegowego z profilu v2 — jeden dla pierwszego planu, regeneracji i widoku
 * (E3, E4). Pola profilu v2 wygrywają; profil sprzed migracji (`legacy.config`) uzupełnia
 * to, czego profil v2 nie ma.
 */
export function runningConfig(config: SportsConfig, legacy?: TrainctlConfig): TrainctlConfig {
  const profile = config.athlete.sports.run!
  const { strength, ...athlete } = profile.running ?? {}
  const base = legacy ? structuredClone(legacy) : undefined
  const running = { ...base } as TrainctlConfig
  running.athlete = { ...base?.athlete, ...athlete,
    results: profile.results ?? base?.athlete.results ?? [],
    daysAvailable: profile.daysAvailable ?? base?.athlete.daysAvailable ?? DEFAULT_RUNNING_DAYS,
  } as AthleteProfile
  const g = config.goal
  if (g.kind === 'race' && g.sport === 'run') {
    const targetTimeSec = g.targetTimeSec ?? base?.goal.targetTimeSec
    running.goal = { ...(base?.goal ?? { priority: 'A' as const }), kind: 'race', date: g.date, name: g.name, distanceKm: g.distanceM! / 1000, ...(targetTimeSec ? { targetTimeSec } : {}) }
  } else running.goal = { kind: 'base', date: g.date, name: g.name, distanceKm: 0, priority: 'A' }
  if (strength) running.strength = strength
  if (config.desk) running.desk = config.desk
  if (config.sync) running.sync = config.sync
  if (config.language) running.language = config.language
  // Running has its own training allocation; shared occupied-time constraints are
  // checked after composition with cycling/swimming (never spent twice). Sam bieg ma
  // budżet czasu planu biegowego (`time`, E-2) albo żaden — jak plan biegowy (E3, B0).
  if (Object.keys(config.athlete.sports).length > 1) running.time = { weeklyMinutes: profile.weeklyMinutes + (profile.preparationMinutes ?? 15) * profile.sessionsPerWeek }
  else if (config.time) running.time = config.time
  return running
}

export function regenerateRunning(existing: SportsPlan, config: SportsConfig, today: string, fixed: Set<string>, cycleId = existing.cycleId): { sessions: TrainingSession[]; generatorPlan: StoredPlan } | undefined {
  if (!existing.legacy || !config.athlete.sports.run) return undefined
  const running = runningConfig(config, legacyProfile(existing))
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

/** Profil v2 z blokiem `running` dostaje pełny silnik biegowy (E3). */
export function initialRunning(config: SportsConfig, from: string, cycleId: string): { sessions: TrainingSession[]; legacy: NonNullable<SportsPlan['legacy']> } | undefined {
  const p = config.athlete.sports.run
  // E3: blok `running` to silnik biegowy, jak profil planu biegowego — strefy z wyniku albo
  // z czasu docelowego; bez obu plan biegowy odmawia z tym samym komunikatem
  if (!p?.running) return undefined
  const running = runningConfig(config)
  const plan=computePlan(running,from,from)
  return {sessions:runningSessions(plan,cycleId),legacy:{plan,config:running,cycleId,generatorPlan:plan,profileInV2:true}}
}
