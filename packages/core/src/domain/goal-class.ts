/**
 * Klasa dystansu celu — jedno miejsce granic dla taperu (T-5), szczytu (P-7/P-8),
 * bloku po starcie (R-1, R-8), predykcji (W-2, W-7) i lintów sezonu.
 * Granice: ultra >42,5 km, maraton ≥42 km, HM ≥20,9 km. Warstwa domeny, żeby
 * strefy (zones/) i silnik (engine/) korzystały z niej bez zależności od planera.
 */
import type { RaceGoal } from './types.ts'

export type GoalClass = 'base' | 'ultra' | 'marathon' | 'half' | 'short'

/** Klasa samego dystansu startu (bez celu bazowego). */
export function distanceClass(km: number): Exclude<GoalClass, 'base'> {
  if (km > 42.5) return 'ultra'
  if (km >= 42.0) return 'marathon'
  if (km >= 20.9) return 'half'
  return 'short'
}

export function goalClass(goal: Pick<RaceGoal, 'kind' | 'distanceKm'>): GoalClass {
  return goal.kind === 'base' ? 'base' : distanceClass(goal.distanceKm)
}
