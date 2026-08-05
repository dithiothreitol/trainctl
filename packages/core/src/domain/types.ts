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
}

export type RacePriority = 'A' | 'B' | 'C'

export interface RaceGoal {
  date: string
  distanceKm: number
  name: string
  priority: RacePriority
  targetTimeSec?: number
  terrain?: 'road' | 'trail' | 'ultra'
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
}

/** Rozkład intensywności planu (FOUNDATIONS I-1/I-2). */
export type IntensityModel = 'pyramidal' | 'polarized'

export type MacroPhase = 'base' | 'build' | 'peak' | 'taper' | 'race'

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
  /** Liczba sesji jakościowych w tygodniu (I-8). */
  qualitySessions: number
  raceDate?: string
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
  | 'race'

export interface PlannedWorkout {
  kind: WorkoutKind
  segments: PlannedSegment[]
  distanceKm: number
  ruleRefs: string[]
}

export interface PlannedDay {
  date: string
  weekday: Weekday
  /** Brak = dzień wolny (odpoczynek jest jawną częścią metodyki). */
  workout?: PlannedWorkout
}

export interface Microcycle {
  weekStart: string
  skeleton: WeekSkeleton
  days: PlannedDay[]
  totalKm: number
  /** Udział objętości Z1 (I-5: ≥0,75). */
  easyShare: number
}
