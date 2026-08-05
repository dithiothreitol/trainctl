/**
 * Port integracji z serwisami rejestrującymi aktywność (ADR-002).
 * `core` nie wie o intervals.icu — adaptery implementują ten interfejs.
 */
import type { PlannedDay } from '../domain/types.ts'

/** Wykonana aktywność pobrana z serwisu (znormalizowana). */
export interface SyncedActivity {
  externalId: string
  date: string
  type: string
  name?: string
  distanceKm?: number
  movingTimeSec?: number
  elapsedTimeSec?: number
  elevationGainM?: number
  avgHr?: number
  avgPaceSecPerKm?: number
  /** Odczuwana ciężkość sesji (RPE) — jeśli użytkownik ją wprowadził. */
  rpe?: number
}

/** Dzienny wpis wellness (HRV, tętno spoczynkowe, sen, masa). */
export interface SyncedWellness {
  date: string
  restingHr?: number
  hrv?: number
  sleepSec?: number
  weightKg?: number
  /** Metryki obciążenia liczone przez serwis — deskryptory, nie guardraile (P-4). */
  ctl?: number
  atl?: number
}

/** Zaplanowany trening do wypchnięcia do kalendarza serwisu/zegarka. */
export interface PushableWorkout {
  externalId: string
  date: string
  name: string
  /** Opis w formacie docelowego serwisu (np. składnia „steps" intervals.icu). */
  description: string
  sport: 'run'
  distanceKm?: number
}

export interface PushResult {
  pushed: number
  externalIds: string[]
}

export interface SyncProvider {
  readonly name: string
  /** Sprawdzenie poświadczeń — zwraca identyfikator konta. */
  verify(): Promise<{ athleteId: string; name?: string }>
  listActivities(oldest: string, newest: string): Promise<SyncedActivity[]>
  listWellness(oldest: string, newest: string): Promise<SyncedWellness[]>
  pushWorkouts(workouts: PushableWorkout[]): Promise<PushResult>
}

/** Konwersja dnia planu na format serwisu — zależna od adaptera. */
export type WorkoutFormatter = (day: PlannedDay, goalName: string) => PushableWorkout | undefined
