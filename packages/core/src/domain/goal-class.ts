/**
 * Klasa dystansu celu — jedno miejsce granic dla taperu (T-5), szczytu (P-7/P-8),
 * bloku po starcie (R-1, R-8), predykcji (W-2, W-7) i lintów sezonu.
 * Granice: ultra >42,5 km, maraton ≥42 km, HM ≥20,9 km. Warstwa domeny, żeby
 * strefy (zones/) i silnik (engine/) korzystały z niej bez zależności od planera.
 */
import type { RaceGoal } from './types.ts'

export type GoalClass = 'base' | 'ultra' | 'marathon' | 'half' | 'short'

export function goalClass(goal: Pick<RaceGoal, 'kind' | 'distanceKm'>): GoalClass {
  if (goal.kind === 'base') return 'base'
  if (goal.distanceKm > 42.5) return 'ultra'
  if (goal.distanceKm >= 42.0) return 'marathon'
  if (goal.distanceKm >= 20.9) return 'half'
  return 'short'
}
