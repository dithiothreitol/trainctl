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

/** Przyczyna przerwy w dzienniku (B11): choroba — R-5, kontuzja — bez propozycji objętości (R-6, R-7). */
export type BreakReason = 'illness' | 'injury' | 'travel' | 'other'
export const BREAK_REASONS: readonly BreakReason[] = ['illness', 'injury', 'travel', 'other']

/** Zatwierdzony powrót po przerwie w trakcie planu (B11): od `since`, z objętości sprzed przerwy. */
export interface ReturnBlock {
  since: string
  previousWeeklyKm: number
  illness: boolean
}

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
  /**
   * Powrót po przerwie ≥ 2 tygodni (R-11): `since` — pierwszy dzień biegania po
   * przerwie, `previousWeeklyKm` — objętość tygodniowa sprzed niej.
   */
  returning?: { since: string; previousWeeklyKm: number }
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
  /** Pierwszy blok po przerwie (R-11): wyłącznie spokojnie — bez akcentów i podbiegów. */
  easyOnly?: boolean
  /**
   * Tor długiego wybiegania (B4): najkrótsze długie tego tygodnia, rosnące do celu
   * dystansu w ostatnim bloku ładowania. Brak = długie z udziału w tygodniu
   * (10 km, plan bez startu). Sufit udziału i 35 km nakłada generator mikrocyklu.
   */
  longKm?: number
  /**
   * Pozycja dawki akcentu w sezonie (B5, J-8): 0 na początku, 1 w ostatnim tygodniu
   * ładowania; taper 1 (T-1), blok po starcie 0 (R-8). Brak = pełna dawka z objętości.
   */
  accentProgress?: number
  raceDate?: string
  /** Start kontrolny B/C w tym tygodniu (nie kończy planu — T-9…T-12). */
  tuneUp?: TuneUpRace
  /** Sprawdzian all-out w tym tygodniu: fallback kalibracji przy pustym kalendarzu startów (W-13). */
  testPlanned?: boolean
  /** Najwcześniejszy dzień biegu w tygodniu — po starcie (R-1: 48 h ciszy po maratonie). */
  earliestRun?: string
  /**
   * Objętość po budżecie czasu z profilu (E-2). `targetKm` zostaje zamiarem
   * makrocyklu — od niego liczy się skalowanie bazy (adapt, regeneracja), a lint
   * porównuje sumy dni z tym, co budżet faktycznie zostawił. Od B7 budżet tygodnia
   * ogranicza już sam makrocykl (sufit szczytu), a zamiar bez budżetu jest w `uncappedKm`.
   */
  timeCappedKm?: number
  /**
   * Objętość tygodnia przed budżetem czasu, zapisana przy pierwszym przycięciu.
   * Ostrzeżenie „budżet tnie objętość" mówi z niej, ile plan miałby bez budżetu —
   * także przy rekalibracji, która dostaje tygodnie już przycięte.
   */
  uncappedKm?: number
  /**
   * Objętość, którą dni tygodnia mieszczą pod sufitami jednostek (S-10, E-3), gdy
   * jest mniejsza od `targetKm`. Zapisuje ją generator mikrocyklu; lint porównuje
   * z nią sumy dni tak jak z `timeCappedKm`, a `targetKm` zostaje zamiarem makrocyklu.
   */
  layoutKm?: number
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
  /** Rodzaj przerwy (PLAN-v0.7 C1): marsz albo trucht — dla notacji, opis ma go w tekście. */
  recoveryMode?: 'walk' | 'jog'
  /** Dłuższa przerwa w połowie serii (C1): po którym odcinku, ile sekund i jak. */
  setBreak?: { afterRep: number; sec: number; mode: 'walk' | 'jog' }
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

/**
 * Decyzja generatora o układzie tygodnia (PLAN-v0.7 B1, B2): kod bez języka, zdanie
 * składa CLI w `why`. Jawność zamiast cichej zmiany jednostki.
 */
export type WeekNote =
  /** Dzień podbiegów był w układzie i wypadł: za duży udział w tygodniu albo potrzebny dzień na resztę kilometrów. */
  | { code: 'hillsDropped'; date: string }
  /** Akcent zastąpiony biegiem spokojnym z przebieżkami: z ramą przekroczyłby udział jednej jednostki (J-6, E-3). */
  | { code: 'accentAsStrides'; date: string }
  /** Reszta kilometrów nie mieści się w dostępnych dniach pod sufitem biegu spokojnego (S-10). */
  | { code: 'volumeShort'; targetKm: number; plannedKm: number }

export interface Microcycle {
  weekStart: string
  skeleton: WeekSkeleton
  days: PlannedDay[]
  totalKm: number
  /** Udział objętości Z1 (I-5: ≥0,75). */
  easyShare: number
  /** Uwagi modułu siły (np. „zmieściła się 1 z 2 sesji") — jawność zamiast cichego przycięcia. */
  strengthNotes?: string[]
  /** Uwagi generatora o układzie tygodnia — `why` je tłumaczy. */
  notes?: WeekNote[]
}
