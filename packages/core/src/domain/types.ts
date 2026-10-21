/**
 * Model domeny — jednostki bazowe: sekundy (czas, tempo s/km), kilometry (dystans).
 * Daty jako ISO 'YYYY-MM-DD' (bez stref czasowych — plan żyje w kalendarzu atlety).
 */

export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'

export type Sex = 'male' | 'female' | 'unspecified'

/** Zakres tempa [szybsze, wolniejsze] w s/km. */
export interface PaceRange {
  loSecPerKm: number
  hiSecPerKm: number
}

export interface RaceResult {
  date: string
  distanceKm: number
  timeSec: number
  name?: string
  terrain?: 'road' | 'trail'
  /** Explicitly excluded from calibration; kept in the athlete's history. */
  excluded?: boolean
  exclusionReason?: string
}

export type RacePriority = 'A' | 'B' | 'C'

export interface RaceGoal {
  /**
   * 'base' = plan bez zawodów do daty `date` (P-11): bez taperu, bez tygodnia
   * startowego i bez predykcji; `distanceKm` wynosi wtedy 0.
   */
  kind?: 'race' | 'base'
  date: string
  distanceKm: number
  name: string
  priority: RacePriority
  targetTimeSec?: number
  terrain?: 'road' | 'trail' | 'ultra'
}

/**
 * Start B/C w drodze do celu A — bieg kontrolny, nie impreza docelowa.
 * Tak kalibruje formę trener z korpusu: 45 startów w 1231 dniach, mediana
 * odstępu 28 dni, zero sztucznych sprawdzianów (W-12/W-13).
 */
export interface TuneUpRace {
  date: string
  distanceKm: number
  name?: string
  /** 'B' = ważny bieg kontrolny (mini-taper T-9), 'C' = wbiegany bez odpuszczania. */
  priority: 'B' | 'C'
}

export interface AthleteProfile {
  sex?: Sex
  /** Średnia objętość z ostatnich ~4 tygodni — punkt startowy progresji. */
  recentWeeklyKm: number
  /** Historycznie utrzymywalne maksimum tygodniowe (sufit progresji). */
  peakWeeklyKm?: number
  daysAvailable: Weekday[]
  longRunDay?: Weekday
  results: RaceResult[]
  /** Starty kontrolne w sezonie — wpinane w makrocykl (T-9…T-12). */
  tuneUpRaces?: TuneUpRace[]
}

/** Rozkład intensywności planu (FOUNDATIONS I-1/I-2). */
export type IntensityModel = 'pyramidal' | 'polarized'

/** 'transition' = blok po starcie (R-8…R-10): powrót do biegania, zanim przyjdzie następny cel. */
export type MacroPhase = 'base' | 'build' | 'peak' | 'taper' | 'race' | 'transition'

/**
 * Szkielet tygodnia z planera makrocyklu — wejście dla generatora mikrocykli.
 * `ruleRefs` wskazuje reguły z docs/science/FOUNDATIONS.md sekcja 10.
 */
export interface WeekSkeleton {
  /** Poniedziałek tygodnia, ISO. */
  weekStart: string
  index: number
  phase: MacroPhase
  intensityModel: IntensityModel
  targetKm: number
  deload: boolean
  /** Taper: utrzymać intensywność (T-1) i częstotliwość sesji (T-2). */
  keepIntensity: boolean
  keepFrequency: boolean
  /** Desired running frequency, retained from the last loading week in taper. */
  sessionCount?: number
  /** Liczba sesji jakościowych w tygodniu (I-8). */
  qualitySessions: number
  raceDate?: string
  /** Start kontrolny B/C w tym tygodniu (nie kończy planu — T-9…T-12). */
  tuneUp?: TuneUpRace
  /** Sprawdzian all-out w tym tygodniu: fallback kalibracji przy pustym kalendarzu startów (W-13). */
  testPlanned?: boolean
  /** Najwcześniejszy dzień biegu w tygodniu — po starcie (R-1: 48 h ciszy po maratonie). */
  earliestRun?: string
  flags: string[]
  ruleRefs: string[]
}

export interface MacrocyclePlan {
  goal: RaceGoal
  weeks: WeekSkeleton[]
  /** Osiągalny szczyt objętości vs rekomendowany dla dystansu (P-7/P-8). */
  peakKmPlanned: number
  peakKmRecommended: number
  feasibilityWarnings: string[]
}

// ---------------------------------------------------------------- mikrocykl

export type PlannedSegmentType =
  | 'warmup'
  | 'easy'
  | 'steady'
  | 'intervals'
  | 'hills'
  | 'progression'
  | 'alternating'
  | 'cooldown'
  | 'race'

export interface PlannedSegment {
  type: PlannedSegmentType
  distanceKm?: number
  reps?: number
  repM?: number
  pace?: PaceRange
  /** Przerwa między powtórzeniami [s] — potrzebna do eksportu na zegarek. */
  recoverySec?: number
  /** Polska fraza w stylu korpusu — render dla człowieka/zegarka. */
  description: string
}

export type WorkoutKind =
  | 'easy'
  | 'long'
  | 'easy_hills'
  | 'quality_intervals'
  | 'quality_continuous'
  | 'sharpener'
  /** Sprawdzian all-out — kalibracja stref, gdy w kalendarzu nie ma startów (W-11/W-13). */
  | 'test'
  | 'race'

export interface PlannedWorkout {
  /** Race distance is separate from the training-volume budget. */
  raceDistanceKm?: number
  estimatedRaceTimeSec?: number
  kind: WorkoutKind
  segments: PlannedSegment[]
  distanceKm: number
  ruleRefs: string[]
}

/**
 * Sesja siłowa obok planu biegowego (F-1…F-4). Osobny tor, nie WorkoutKind:
 * siła nie wnosi kilometrów, nie podlega solverowi biegowemu i nie jedzie
 * na zegarek jako trening biegowy.
 */
export interface StrengthSession {
  /** intro = wejście w blok (F-18, inż.), heavy = ładowanie (F-4), maintenance = szczyt (F-12/F-14). */
  kind: 'heavy' | 'intro' | 'maintenance'
  description: string
  durationMin: number
  ruleRefs: string[]
}

export interface PlannedDay {
  /** Explicitly approved time adjustment; original goal remains visible in why. */
  timeAdjustment?: { originalKind: WorkoutKind; originalDistanceKm: number; budgetMinutes: number; status: 'shortened' | 'easy-alternative'; /** 'profile' = wynik budżetu czasu z trainctl.yaml (E-2), nie zatwierdzony wyjątek. */ origin?: 'profile' }
  date: string
  weekday: Weekday
  /** User decision: preserve this day during automatic proposals. */
  pinned?: boolean
  /** Brak = dzień wolny (odpoczynek jest jawną częścią metodyki). */
  workout?: PlannedWorkout
  /** Równoległa sesja siłowa — tylko gdy moduł siły jest włączony. */
  strength?: StrengthSession
}

export interface Microcycle {
  weekStart: string
  skeleton: WeekSkeleton
  days: PlannedDay[]
  totalKm: number
  /** Udział objętości Z1 (I-5: ≥0,75). */
  easyShare: number
  /** Uwagi modułu siły (np. „zmieściła się 1 z 2 sesji") — jawność zamiast cichego przycięcia. */
  strengthNotes?: string[]
}
