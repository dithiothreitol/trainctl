/**
 * Macierz profili syntetycznych do testów kształtu sezonu (docs/PLAN-v0.7.md, B0).
 * Bez danych osobowych: wynik 10 km 43:00, dni z korpusowego wzorca tygodnia.
 * Używa jej `plan-shape.test.ts`; te same profile mają posłużyć wydrukom do przeglądu
 * trenerskiego (F1). Plik `.fixture.ts` nie trafia do paczki npm (package.json
 * `files`, tsconfig.build).
 */
import { addDays, seasonLine, seasonProfile, seasonShapeIssues, type SeasonRow, type ShapeIssue, type Weekday } from 'trainctl-core'
import type { TrainctlConfig } from './config.ts'
import { computePlan, type StoredPlan } from './planfile.ts'

export const MATRIX_TODAY = '2026-10-22'

const DAYS: Record<number, Weekday[]> = {
  3: ['tue', 'thu', 'sat'],
  4: ['tue', 'thu', 'sat', 'sun'],
  5: ['tue', 'wed', 'thu', 'sat', 'sun'],
  6: ['tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
}
const GOALS = {
  '10k': { kind: 'race', distanceKm: 10, name: '10K' },
  hm: { kind: 'race', distanceKm: 21.0975, name: 'HM' },
  m: { kind: 'race', distanceKm: 42.195, name: 'M' },
  base: { kind: 'base', distanceKm: 0, name: 'Base' },
} as const
export type MatrixGoal = keyof typeof GOALS

export interface MatrixProfile {
  id: string
  baseKm: number
  days: number
  goal: MatrixGoal
  weeks: number
  budget?: number
  strength?: boolean
  peakKm?: number
}

/** Data celu: niedziela tygodnia, który jest `weeks`-tym tygodniem planu. */
export function matrixConfig(p: MatrixProfile): TrainctlConfig {
  const goal = GOALS[p.goal]
  // 2026-10-22 to czwartek; poniedziałek tygodnia to 2026-10-19
  const date = addDays('2026-10-19', 7 * (p.weeks - 1) + 6)
  return {
    language: 'en',
    athlete: {
      recentWeeklyKm: p.baseKm,
      ...(p.peakKm ? { peakWeeklyKm: p.peakKm } : {}),
      daysAvailable: DAYS[p.days]!,
      results: [{ date: '2026-09-27', distanceKm: 10, timeSec: 2580 }],
    },
    goal: { kind: goal.kind, name: goal.name, date, distanceKm: goal.distanceKm, priority: 'A' },
    ...(p.strength ? { strength: { enabled: true } } : {}),
    ...(p.budget ? { time: { weeklyMinutes: p.budget } } : {}),
  } as TrainctlConfig
}

/** Pełna macierz z planu: baza × dni × cel × horyzont × budżet. */
export function fullMatrix(): MatrixProfile[] {
  const out: MatrixProfile[] = []
  for (const baseKm of [12, 25, 45, 70]) for (const days of [3, 4, 5, 6]) for (const goal of Object.keys(GOALS) as MatrixGoal[])
    for (const weeks of [8, 16, 24]) for (const budget of [undefined, 240, 360]) {
      out.push({ id: `${baseKm}km-${days}d-${goal}-${weeks}w${budget ? `-${budget}min` : ''}`, baseKm, days, goal, weeks, ...(budget ? { budget } : {}) })
    }
  return out
}

/** Profile z przeglądu 2026-11-11 (PLAN-v0.7 §1), na horyzoncie 23 tygodni do startu. */
export const REVIEW_PROFILES: MatrixProfile[] = [
  { id: 'P1', baseKm: 45, days: 5, goal: 'hm', weeks: 23, strength: true },
  { id: 'P2', baseKm: 12, days: 5, goal: 'hm', weeks: 23, strength: true, peakKm: 50 },
  { id: 'P2b', baseKm: 12, days: 5, goal: 'hm', weeks: 23, strength: true },
  { id: 'P3', baseKm: 45, days: 5, goal: 'hm', weeks: 23, strength: true, budget: 240 },
]

export function matrixPlan(p: MatrixProfile): StoredPlan {
  return computePlan(matrixConfig(p), MATRIX_TODAY)
}

export function shapeReport(p: MatrixProfile, plan = matrixPlan(p)): { lines: string[]; issues: ShapeIssue[]; rows: SeasonRow[] } {
  const rows = seasonProfile(plan.weeks)
  return { lines: rows.map(seasonLine), issues: seasonShapeIssues(plan, rows), rows }
}
