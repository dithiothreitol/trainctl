import type { PlannedWorkout } from '../domain/types.ts'

/** Engineering estimate, including recoveries and an explicit preparation budget. */
export function estimateWorkoutMinutes(workout: PlannedWorkout, preparationMinutes = 15): number {
  let seconds = 0
  let measuredKm = 0
  for (const segment of workout.segments) {
    const km = segment.distanceKm ?? ((segment.reps ?? 0) * (segment.repM ?? 0)) / 1000
    measuredKm += km
    seconds += km * (segment.pace?.hiSecPerKm ?? 360)
    seconds += Math.max(0, (segment.reps ?? 1) - 1) * (segment.recoverySec ?? 0)
  }
  seconds += Math.max(0, workout.distanceKm - measuredKm) * 360
  return Math.ceil(seconds / 60) + preparationMinutes
}
