/**
 * Port integracji z serwisami rejestrującymi aktywność (ADR-002).
 * `core` nie wie o intervals.icu — adaptery implementują ten interfejs.
 */
import type { PlannedDay } from '../domain/types.ts'

/**
 * PLAN-v0.7 D1: okrążenie aktywności — z zegarka (komunikat `lap` w FIT, `<Lap>` w TCX)
 * albo interwał wyznaczony przez hub (intervals.icu `icu_intervals`). GPX okrążeń nie ma.
 */
export interface ActivityLap {
  distanceKm: number
  movingTimeSec: number
  avgHr?: number
  /** Jak okrążenie się zamknęło: ręcznie, automatycznie po dystansie albo po czasie, inaczej. */
  trigger?: 'manual' | 'distance' | 'time' | 'other'
  /** Rola odcinka, gdy źródło ją podaje: praca, przerwa, rozgrzewka, schłodzenie. */
  intensity?: 'work' | 'rest' | 'warmup' | 'cooldown'
}

/** Wykonana aktywność pobrana z serwisu (znormalizowana). */
export interface SyncedActivity {
  externalId: string
  date: string
  startTime?: string
  parentActivityId?: string
  partIndex?: number
  plannedSessionId?: string
  importSource?: string
  classification?: 'reported' | 'inferred' | 'unknown'
  sourceSubtype?: string
  utcOffsetMinutes?: number
  avgPowerWatts?: number
  avgCadence?: number
  poolLengthM?: number
  type: string
  name?: string
  distanceKm?: number
  movingTimeSec?: number
  elapsedTimeSec?: number
  elevationGainM?: number
  avgHr?: number
  /** Najwyższe tętno aktywności — C8: szacunek HRmax w `init --from-intervals` (Z-5). */
  maxHr?: number
  /** D1: okrążenia w kolejności — do porównania akcentu z planem w `review` (D2). */
  laps?: ActivityLap[]
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
  startTime?: string
  name: string
  /** Opis w formacie docelowego serwisu (np. składnia „steps" intervals.icu). */
  description: string
  /** Siła to osobny tor (ADR-023): w kalendarzu osobny wpis, nigdy trening biegowy. */
  sport: 'run' | 'bike' | 'swim' | 'strength'
  durationSec?: number
  distanceKm?: number
  /** Start (A/B/C) zamiast treningu — serwis może go pokazać jako zawody. */
  race?: { priority: 'A' | 'B' | 'C' }
}

export interface PushResult {
  pushed: number
  externalIds: string[]
  /**
   * Wpisy dodatkowe (starty, siła), których serwis nie przyjął w docelowej
   * postaci — treningi biegowe i tak zostały wypchnięte.
   */
  warnings?: string[]
}

/** Zaplanowany trening już obecny w serwisie (do sprzątania po renegocjacji). */
export interface RemotePlannedWorkout {
  id: string
  date: string
  externalId?: string
}

/**
 * Źródło wykonania (pull): hub online albo lokalny katalog plików aktywności.
 * `review`, `pull` i `adapt` potrzebują wyłącznie tego — dlatego adapter
 * plikowy (pull-only) nie musi udawać, że umie wysyłać treningi (ADR-037).
 */
export interface ActivitySource {
  readonly name: string
  /**
   * `laps`: okrążenia biegów (D1). Hub liczy je osobnym zapytaniem na aktywność,
   * więc tylko na życzenie (`pull`), nie przy wnioskowaniu profilu z 16 tygodni.
   */
  listActivities(oldest: string, newest: string, opts?: { laps?: boolean }): Promise<SyncedActivity[]>
  listWellness(oldest: string, newest: string): Promise<SyncedWellness[]>
}

/** Pełny hub: źródło wykonania + ujście zaplanowanych treningów (push). */
export interface SyncProvider extends ActivitySource {
  /** Sprawdzenie poświadczeń — zwraca identyfikator konta. */
  verify(): Promise<{ athleteId: string; name?: string }>
  pushWorkouts(workouts: PushableWorkout[]): Promise<PushResult>
  /** Treningi wcześniej wypchnięte przez nas (po prefiksie `external_id`). */
  listPlannedWorkouts(oldest: string, newest: string): Promise<RemotePlannedWorkout[]>
  /** Usunięcie zdezaktualizowanego wpisu — inaczej zostaje na zegarku. */
  deleteWorkout(id: string): Promise<void>
}

/** Konwersja dnia planu na format serwisu — zależna od adaptera. */
export type WorkoutFormatter = (day: PlannedDay, goalName: string) => PushableWorkout | undefined
