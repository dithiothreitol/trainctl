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
  /** Skąd aktywność trafiła do huba (np. 'STRAVA', 'GARMIN'). */
  source?: string
  /**
   * Hub wie o aktywności, ale NIE udostępnia jej danych przez API.
   * Dotyczy Stravy od XII 2024 (warunki Stravy zakazują re-eksportu).
   * Taka aktywność nie ma dystansu ani typu — nie da się jej porównać z planem.
   */
  dataWithheld?: boolean
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

/** Zaplanowany trening już obecny w serwisie (do sprzątania po renegocjacji). */
export interface RemotePlannedWorkout {
  id: string
  date: string
  externalId?: string
}

export interface SyncProvider {
  readonly name: string
  /** Sprawdzenie poświadczeń — zwraca identyfikator konta. */
  verify(): Promise<{ athleteId: string; name?: string }>
  listActivities(oldest: string, newest: string): Promise<SyncedActivity[]>
  listWellness(oldest: string, newest: string): Promise<SyncedWellness[]>
  pushWorkouts(workouts: PushableWorkout[]): Promise<PushResult>
  /** Treningi wcześniej wypchnięte przez nas (po prefiksie `external_id`). */
  listPlannedWorkouts(oldest: string, newest: string): Promise<RemotePlannedWorkout[]>
  /** Usunięcie zdezaktualizowanego wpisu — inaczej zostaje na zegarku. */
  deleteWorkout(id: string): Promise<void>
}

/** Konwersja dnia planu na format serwisu — zależna od adaptera. */
export type WorkoutFormatter = (day: PlannedDay, goalName: string) => PushableWorkout | undefined
