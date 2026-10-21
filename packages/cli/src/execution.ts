import type { ExecutionRecord, SyncedActivity } from 'trainctl-core'
import type { StoredPlan } from './planfile.ts'
import type { LogEntry } from './logfile.ts'

export const isRunningActivity = (activity: SyncedActivity): boolean =>
  /^(run|running|trailrun|trailrunning|virtualrun|treadmill|treadmillrunning)$/i.test(activity.type.replace(/[ _-]/g, '')) &&
  !activity.dataWithheld

/** Kilometry biegów z synchronizacji dzień po dniu — jedna reguła, co z zegarka liczy się jako bieg. */
export function runningKmByDate(activities: SyncedActivity[]): Map<string, number> {
  const runs = new Map<string, number>()
  for (const a of activities) {
    if (!isRunningActivity(a) || a.distanceKm === undefined || !Number.isFinite(a.distanceKm) || a.distanceKm <= 0) continue
    runs.set(a.date, (runs.get(a.date) ?? 0) + a.distanceKm)
  }
  return runs
}

/** Jedna interpretacja wykonania dla pull, review i adaptacji. Wygrywa ostatni wpis dziennika. */
export function buildExecution(plan: StoredPlan, activities: SyncedActivity[], logs: LogEntry[], today: string): ExecutionRecord[] {
  const runs = runningKmByDate(activities)
  const journal = new Map(logs.map((entry) => [entry.date, entry]))
  const planned = new Map(plan.weeks.flatMap((week) => week.days).map((day) => [day.date, day]))
  const dates = [...new Set([...planned.keys(), ...runs.keys(), ...journal.keys()])].sort()
  return dates.filter((date) => date <= today).map((date): ExecutionRecord => {
    const day = planned.get(date)
    const log = journal.get(date)
    const plannedKm = day?.workout?.kind === 'race'
      ? day.workout.raceDistanceKm ?? (plan.goal.date === date ? plan.goal.distanceKm : plan.weeks.find(w => w.skeleton.tuneUp?.date === date)?.skeleton.tuneUp?.distanceKm ?? 0)
      : day?.workout?.distanceKm ?? 0
    const skipped = log?.status === 'skipped'
    const actualKm = skipped ? 0 : log?.km ?? runs.get(date) ?? (log?.status === 'done' ? plannedKm : undefined)
    const done = !skipped && (log?.status === 'done' || (actualKm ?? 0) > 0)
    return {
      date, plannedKm,
      ...(day?.workout ? { kind: day.workout.kind } : {}),
      ...(actualKm !== undefined ? { actualKm } : {}),
      source: log ? 'journal' : runs.has(date) ? 'sync' : 'none',
      status: skipped ? 'missed' : done ? (day?.workout ? 'done' : 'unplanned') : day?.workout ? 'unknown' : 'rest',
    }
  })
}
