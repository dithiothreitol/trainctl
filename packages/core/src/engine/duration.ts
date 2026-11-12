import type { PlannedSegment, PlannedWorkout } from '../domain/types.ts'

/**
 * E-3 (inż.): przebieżka po biegu spokojnym (J-6) — ~3:20/km, czyli 0,2 s na metr,
 * i minuta powrotu marszem albo truchtem. Plan nie zapisuje przerwy przebieżek; ta sama
 * minuta idzie na zegarek (FIT, składnia intervals.icu), żeby szacunek i trening się zgadzały.
 */
export const STRIDE_SEC_PER_M = 0.2
export const STRIDE_RECOVERY_SEC = 60

/**
 * Przerwa w połowie serii (C1, `setBreak`), gdy dzieli serię: po odcinku `afterRep`,
 * dodatkowo do zwykłej przerwy po nim. Poza serią (0 albo ostatni odcinek) jej nie ma.
 */
export const splitsSeries = (s: PlannedSegment): s is PlannedSegment & { setBreak: NonNullable<PlannedSegment['setBreak']> } =>
  s.type === 'intervals' && s.setBreak !== undefined && s.setBreak.afterRep > 0 && s.setBreak.afterRep < (s.reps ?? 1)

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
    if (splitsSeries(segment)) seconds += segment.setBreak.sec
    if (segment.type === 'easy' && segment.strides) {
      seconds += segment.strides.count * (segment.strides.meters * STRIDE_SEC_PER_M + STRIDE_RECOVERY_SEC)
    }
  }
  seconds += Math.max(0, workout.distanceKm - measuredKm) * 360
  return Math.ceil(seconds / 60) + preparationMinutes
}
