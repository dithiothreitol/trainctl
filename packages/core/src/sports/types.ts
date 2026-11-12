import type { AthleteProfile, PlannedWorkout, RaceResult, Weekday } from '../domain/types.ts'

export const ENDURANCE_SPORTS = ['run', 'bike', 'swim'] as const
export type EnduranceSport = typeof ENDURANCE_SPORTS[number]
export type Sport = EnduranceSport | 'strength'
export type SessionPurpose = 'easy' | 'long' | 'intervals' | 'technique' | 'race' | 'strength'
export interface SportProfile {
  /** Minuty treningu tygodniowo; przygotowanie jest osobnym kosztem kalendarza. */
  weeklyMinutes: number
  sessionsPerWeek: number
  daysAvailable?: Weekday[]
  maxSessionMinutes?: number
  preparationMinutes?: number
  easyPaceSecPerKm?: number
  results?: RaceResult[]
  running?: Pick<AthleteProfile, 'recentWeeklyKm' | 'peakWeeklyKm' | 'longRunDay' | 'tuneUpRaces'>
  ftpWatts?: number
  cssSecPer100m?: number
  poolLengthM?: number
  calibration?: { date: string; source: string }
  experience?: 'new' | 'regular' | 'trained'
  resources?: ('bike' | 'trainer' | 'powerMeter' | 'pool')[]
  peakWeeklyMinutes?: number
  /** Optional declared growth ceiling; zero growth when omitted. MS-4. */
  progressionPercent?: number
  qualitySessions?: number
  taperDays?: number
  recoveryDays?: number
}
export interface SportsWindow { day: Weekday; start: string; minutes: number; sports: EnduranceSport[] }
export interface SportGoal {
  kind: 'base' | 'race' | 'multisport'
  name: string
  date: string
  sport?: EnduranceSport
  distanceM?: number
  estimatedMinutes?: number
  legs?: { id: string; sport: EnduranceSport; distanceM: number; estimatedMinutes?: number }[]
  /** Ordered transitions between legs (e.g. T1, T2), in seconds. */
  transitionsSec?: number[]
}
export interface SportsConfig {
  schemaVersion: 2
  language?: string
  /** C9: jednostka widoku, jak w profilu planu biegowego; dane zostają w km. */
  units?: 'metric' | 'imperial'
  /** C10: zapis notacji, jak w profilu planu biegowego. */
  notation?: 'neutral' | 'club'
  athlete: { sports: Partial<Record<EnduranceSport, SportProfile>> }
  goal: SportGoal
  tuneUpGoals?: (SportGoal & { priority: 'B' | 'C' })[]
  time?: { weeklyMinutes?: number; weekdayMinutes?: number; weekendMinutes?: number }
  availability?: SportsWindow[]
  /** Replaces weekly windows on this date. An empty array closes the date. */
  availabilityExceptions?: Record<string, Omit<SportsWindow, 'day'>[]>
  maxSessionsPerDay?: number
  priorities?: EnduranceSport[]
  /** Opcjonalna zakładka; wielkości są jawnym wyborem zawodnika. */
  brick?: { day: Weekday; bikeMinutes: number; runMinutes: number; transitionMinutes: number }
  sync?: { files?: string }
  desk?: { workStart: string; workEnd: string; lunchMinutes?: number; prefer?: 'morning' | 'lunch' | 'evening' }
}
export type StepTarget =
  | { kind: 'pace'; seconds: number; perM: 100 | 1000 }
  | { kind: 'power'; watts: number; ftpPercent?: number }
  | { kind: 'open' }
/** Subjective 1–10 effort, not a measured physiological zone. */
export interface EffortGuide { min: number; max: number; cue: string }
export interface SessionCoaching {
  version: 1
  recipeId: string
  title: string
  objective: string
  rationale: string
  successCriteria: string[]
  adjustments: string[]
  /** Minimum main-set work retained when shortening a quality session. */
  minimumWorkSec?: number
}
export interface SessionContext {
  phase?: TrainingSession['phase']
  weekIndex?: number
  slot?: number
  goal?: SportGoal
  brick?: 'bike' | 'run'
}
export interface SessionStep {
  role: 'warmup' | 'work' | 'rest' | 'cooldown' | 'drill'
  /** Czas kroku jest estymacją, gdy miarą zakończenia jest dystans. */
  durationSec: number
  distanceM?: number
  repeat?: number
  restSec?: number
  sendoffSec?: number
  target: StepTarget
  name?: string
  instruction?: string
  effort?: EffortGuide
  /** Recovery after EACH repeat, including the last; counted in restSec. */
  recovery?: { target: StepTarget; effort?: EffortGuide; instruction: string }
  stroke?: 'freestyle' | 'backstroke' | 'breaststroke' | 'butterfly' | 'drill'
}
export interface TrainingSession {
  id: string
  date: string
  sport: Sport
  purpose: SessionPurpose
  steps: SessionStep[]
  durationSec: number
  preparationSec: number
  durationSource?: 'running-prediction'
  distanceM?: number
  start?: string
  poolLengthM?: number
  pinned?: boolean
  approved?: boolean
  groupId?: string
  replacesSessionId?: string
  restoresSessionId?: string
  externalId?: string
  description?: string
  calibration?: SportProfile['calibration']
  ruleRefs: string[]
  /** Oryginalna treść biegu zachowana podczas migracji, również dla eksportu. */
  legacyWorkout?: PlannedWorkout
  racePriority?: 'A' | 'B' | 'C'
  phase?: 'base' | 'build' | 'deload' | 'taper' | 'recovery' | 'race'
  intent?: TrainingIntent
  coaching?: SessionCoaching
}
export interface TrainingIntent {
  primary: 'aerobic' | 'durability' | 'quality' | 'technique' | 'competition' | 'strength'
  intensity: 'low' | 'moderate' | 'high' | 'unknown'
  specificTo: Sport
}
export interface SessionGroup { id: string; kind: 'brick' | 'race'; sessionIds: string[]; transitionSec: number; transitionsSec?: number[] }
export interface SessionReplacement {
  sourceId: string
  targetId: string
  reason?: string
  tradeoffs: string[]
  at: string
  operation?: 'replace' | 'restore'
  restoresSessionId?: string
  proposalId?: string
  impact?: {
    week: string
    sports: { sport: Sport; beforeMinutes: number; afterMinutes: number; deltaMinutes: number; beforeDistanceM: number; afterDistanceM: number }[]
    beforeOccupiedMinutes: number
    afterOccupiedMinutes: number
  }
  assessment?: {
    direction: string
    original: TrainingIntent
    alternative: TrainingIntent
    preserved: string[]
    lost: string[]
    limits: string[]
    beforeMinutes: number
    afterMinutes: number
  }
}
export interface SportsPlan {
  schemaVersion: 2
  id: string
  cycleId: string
  engineVersion: string
  generatedAt: string
  goal: SportGoal
  sessions: TrainingSession[]
  groups: SessionGroup[]
  archive: TrainingSession[]
  /** Generated sessions withdrawn by configuration changes; may return with the same ID. */
  retiredSessionIds?: string[]
  replacements: SessionReplacement[]
  changes: { at: string; action: string; sessionIds: string[] }[]
  generatedSessions: Record<string, string>
  timeBudgets?: Record<string, number>
  blockedDates?: string[]
  baselines?: Partial<Record<EnduranceSport, { weeklyMinutes: number; profileWeeklyMinutes: number }>>
  warnings: string[]
  /** Oryginalny dokument pozostaje audytowalny; nie jest drugim aktywnym planem. */
  legacy?: { plan: unknown; config: unknown; cycleId?: string; generatorPlan?: unknown }
}
export interface SessionLog {
  schemaVersion: 2
  sessionId: string
  date: string
  sport: Sport
  /** The linked plan remains unchanged when another sport was performed. */
  plannedSport?: Sport
  status: 'done' | 'skipped' | 'modified'
  durationSec?: number
  distanceM?: number
  rpe?: number
  note?: string
  testTimeSec?: number
  loggedAt: string
  activityIds?: string[]
  /** One-based step number and actual completed repetitions; not inferred from distance. */
  completedRepeats?: { step: number; repeats: number }[]
}
export interface SessionExecution {
  sessionId: string
  sport: Sport
  plannedSport?: Sport
  spontaneous?: boolean
  rpe?: number
  note?: string
  completedRepeats?: SessionLog['completedRepeats']
  date: string
  status: 'done' | 'missed' | 'unknown'
  source: 'journal' | 'sync' | 'none'
  durationSec?: number
  distanceM?: number
  replacement: boolean
  candidates?: string[]
  activityIds?: string[]
  matching?: 'explicit' | 'session-id' | 'unique-day-sport'
}
