import type { PlannedWorkout } from '../domain/types.ts'

/** Engineering estimate, including recoveries and an explicit preparation budget. */
export function estimateWorkoutMinutes(workout: PlannedWorkout, preparationMinutes = 15): number {
  // Infinity represents an unknown race duration: never claim it fits a budget.
  if (workout.kind === 'race') return workout.estimatedRaceTimeSec
    ? Math.ceil(workout.estimatedRaceTimeSec / 60) + preparationMinutes : Infinity
  let seconds = 0
  let measuredKm = 0
  for (const segment of workout.segments) {
    const km = segment.type === 'hills' ? 2 * (segment.reps ?? 1) * (segment.repM ?? 200) / 1000 : segment.distanceKm ?? ((segment.reps ?? 0) * (segment.repM ?? 0)) / 1000
    measuredKm += km
    seconds += km * (segment.pace?.hiSecPerKm ?? 360)
    seconds += Math.max(0, segment.reps ?? 1) * (segment.recoverySec ?? 0)
  }
  seconds += Math.max(0, workout.distanceKm - measuredKm) * 360
  return Math.ceil(seconds / 60) + preparationMinutes
}
