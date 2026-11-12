import { easyBand, easyPace, matchReps, paceZones, plannedReps, type ExecutionRecord, type PaceRange, type PlannedWorkout, type SyncedActivity } from 'trainctl-core'
import type { StoredPlan } from './planfile.ts'
import type { LogEntry } from './logfile.ts'
import { localDateOf } from './clock.ts'

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

/**
 * D2, D3: fakty o wykonaniu jednostki z biegów zsynchronizowanych tego dnia — odcinki
 * akcentu z okrążeń i średnie tempo biegu spokojnego. Bez biegu z zegarka nic nie dopisujemy:
 * sam wpis dziennika nie mówi, jak bieg wyglądał.
 */
function executionFacts(workout: PlannedWorkout, runs: SyncedActivity[], easyZone: PaceRange): Pick<ExecutionRecord, 'intervals' | 'easyPace'> {
  if (!runs.length) return {}
  const reps = plannedReps(workout)
  if (reps.length) return { intervals: matchReps(reps, runs.flatMap((r) => r.laps ?? []), easyZone) }
  if (workout.kind !== 'easy' && workout.kind !== 'long') return {}
  const timed = runs.filter((r) => (r.distanceKm ?? 0) > 0 && (r.movingTimeSec ?? 0) > 0)
  const km = timed.reduce((s, r) => s + r.distanceKm!, 0)
  if (!(km > 0)) return {}
  const sec = timed.reduce((s, r) => s + r.movingTimeSec!, 0)
  return { easyPace: easyPace(sec / km, easyBand(workout, easyZone)) }
}

/** Jedna interpretacja wykonania dla pull, review i adaptacji. Wygrywa ostatni wpis dziennika. */
export function buildExecution(plan: StoredPlan, activities: SyncedActivity[], logs: LogEntry[], today: string): ExecutionRecord[] {
  const runs = runningKmByDate(activities)
  // biegi dnia w kolejności startu — okrążenia dwóch biegów tego samego dnia idą po kolei
  const runsOn = new Map<string, SyncedActivity[]>()
  for (const a of activities) if (isRunningActivity(a)) runsOn.set(a.date, [...(runsOn.get(a.date) ?? []), a])
  for (const list of runsOn.values()) list.sort((a, z) => (a.startTime ?? '').localeCompare(z.startTime ?? ''))
  const easyZone = paceZones(plan.vdot).easy
  const journal = new Map(logs.map((entry) => [entry.date, entry]))
  // dni z wpisem innym niż „skipped” — późniejsze „skipped” jest tam korektą biegacza
  const reported = new Set(logs.filter((entry) => entry.status !== 'skipped').map((entry) => entry.date))
  const planned = new Map(plan.weeks.flatMap((week) => week.days).map((day) => [day.date, day]))
  const dates = [...new Set([...planned.keys(), ...runs.keys(), ...journal.keys()])].sort()
  return dates.filter((date) => date <= today).map((date): ExecutionRecord => {
    const day = planned.get(date)
    const log = journal.get(date)
    const plannedKm = day?.workout?.kind === 'race'
      ? day.workout.raceDistanceKm ?? (plan.goal.date === date ? plan.goal.distanceKm : plan.weeks.find(w => w.skeleton.tuneUp?.date === date)?.skeleton.tuneUp?.distanceKm ?? 0)
      : day?.workout?.distanceKm ?? 0
    // Wpis przerwy (z przyczyną, B11) albo „skipped” zapisane z góry nie chowa biegu
    // z synchronizacji: jeśli biegacz tego dnia pobiegł, bieg się odbył. „Skipped” bez przyczyny
    // zapisane w dniu sesji albo po nim, a także korekta wcześniejszego „done”, zostaje decyzją.
    // data zapisu w strefie biegacza, jak data sesji — nie w UTC
    const preLogged = log?.loggedAt !== undefined && localDateOf(log.loggedAt) < date
    const absence = (log?.reason !== undefined || preLogged) && !reported.has(date)
    const skipped = log?.status === 'skipped' && !(absence && (runs.get(date) ?? 0) > 0)
    const actualKm = skipped ? 0 : log?.km ?? runs.get(date) ?? (log?.status === 'done' ? plannedKm : undefined)
    const done = !skipped && (log?.status === 'done' || (actualKm ?? 0) > 0)
    return {
      date, plannedKm,
      ...(day?.workout ? { kind: day.workout.kind } : {}),
      ...(done && day?.workout ? executionFacts(day.workout, runsOn.get(date) ?? [], easyZone) : {}),
      ...(actualKm !== undefined ? { actualKm } : {}),
      source: log ? 'journal' : runs.has(date) ? 'sync' : 'none',
      // dzień odpoczynku z wpisem „skipped” (przerwa jako zakres dni, B11) to nadal odpoczynek
      status: skipped ? (day?.workout ? 'missed' : 'rest') : done ? (day?.workout ? 'done' : 'unplanned') : day?.workout ? 'unknown' : 'rest',
    }
  })
}
