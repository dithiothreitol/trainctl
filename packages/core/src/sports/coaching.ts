import type { PlannedSegment, PlannedWorkout } from '../domain/types.ts'
import { messages } from '../i18n/index.ts'
import { sportMessages } from './messages.ts'
import type { EffortGuide, SessionContext, Sport, StepTarget, TrainingSession } from './types.ts'

/**
 * PLAN-v0.7 C5: planowany zakres RPE według typu segmentu biegowego — MS-6, wybór
 * inżynierski (bez walidacji trenerskiej), ta sama skala co przepisy roweru i pływania.
 * Opis zamiaru dla biegacza: nie kalibruje stref (Z-4) i nie ocenia wykonania (ADR-027).
 */
const RUN_SEGMENT_RPE: Record<PlannedSegment['type'], [number, number]> = {
  warmup: [2, 3],
  cooldown: [1, 2],
  easy: [3, 4],
  steady: [5, 6],
  hills: [5, 6],
  progression: [5, 7],
  alternating: [6, 7],
  intervals: [7, 8],
  race: [8, 9],
}
/** MS-6 (inż.): sprawdzian na czas to wysiłek maksymalny, wyżej niż start z zapasem na trasę. */
const TIME_TRIAL_RPE: [number, number] = [9, 10]

/** Najmocniejszy segment jednostki biegowej wyznacza jej planowany zakres RPE. */
/** Zakres RPE jednego segmentu biegu (MS-6, inż.): krok pracy niesie zakres swojego segmentu (E1). */
export function segmentEffort(segment: PlannedSegment, workout: PlannedWorkout): EffortGuide {
  const [min, max] = segment.type === 'race' && workout.kind === 'test' ? TIME_TRIAL_RPE : RUN_SEGMENT_RPE[segment.type]
  return effortGuide(min, max)
}

export function runningEffort(workout: PlannedWorkout): EffortGuide {
  const ranges = workout.segments.map((s) => (s.type === 'race' && workout.kind === 'test' ? TIME_TRIAL_RPE : RUN_SEGMENT_RPE[s.type]))
  const [min, max] = ranges.reduce((hardest, r) => (r[1] > hardest[1] ? r : hardest), [1, 2] as [number, number])
  return effortGuide(min, max)
}

/** Teksty coachingu z katalogu (C6): `messages().coaching`, bez par pl/en w kodzie. */
const coach = () => messages().coaching

export function effortGuide(min: number, max: number, swim = false): EffortGuide {
  const c = coach().cue
  const cue = max <= 3 ? c.veryEasy
    : max <= 4 ? (swim ? c.easySwim : c.easy)
    : max <= 6 ? (swim ? c.moderateSwim : c.moderate)
    : (swim ? c.hardSwim : c.hard)
  return { min, max, cue }
}
export function targetText(target: StepTarget): string {
  if (target.kind === 'power') return `${target.watts} W${target.ftpPercent !== undefined ? ` (${target.ftpPercent}% FTP)` : ''}`
  if (target.kind === 'pace') {
    const clock = (value: number) => { const seconds = Math.round(value); return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` }
    // E1: zakres tempa biegu z planu biegowego (szybsza–wolniejsza granica)
    const range = target.slowSeconds !== undefined && Math.round(target.slowSeconds) !== Math.round(target.seconds) ? `${clock(target.seconds)}–${clock(target.slowSeconds)}` : clock(target.seconds)
    return `${range}/${target.perM === 1000 ? 'km' : '100 m'}`
  }
  return coach().byFeel
}
export const effortText = (e: EffortGuide): string => `RPE ${e.min}–${e.max}/10 · ${e.cue}`
export function sessionStepLines(s: TrainingSession, detail = true): string[] {
  // E1: karta czyta kroki także biegu z planu biegowego (kroki z segmentów, `runningSteps`)
  const t = sportMessages()
  return s.steps.map((x, i) => {
    const dose = x.distanceM ? `${x.distanceM} m` : `${Number((x.durationSec / 60).toFixed(2))} min`
    const recovery = x.restSec ? `; ${t.role.rest} ${x.restSec}s${x.recovery ? ` @ ${targetText(x.recovery.target)}${detail && x.recovery.effort ? ` · ${effortText(x.recovery.effort)}` : ''}${detail ? ` · ${x.recovery.instruction}` : ''}` : ''}` : ''
    return `${i + 1}. ${x.name ?? t.role[x.role]}: ${x.repeat ? `${x.repeat} × ` : ''}${dose} @ ${targetText(x.target)}${x.effort ? ` · ${detail ? effortText(x.effort) : `RPE ${x.effort.min}–${x.effort.max}/10`}` : ''}${recovery}${x.sendoffSec ? ` / ${x.sendoffSec}s` : ''}${x.stroke ? ` (${x.stroke})` : ''}${detail && x.instruction ? ` — ${x.instruction}` : ''}`
  })
}
export function coachingLines(s: TrainingSession, detail = true): string[] {
  if (!s.coaching) return []
  const c = s.coaching, l = coach().label
  return [`${l.objective}: ${c.objective}`, ...(detail ? [
    `${l.why}: ${c.rationale}`,
    ...c.successCriteria.map(x => `${l.success}: ${x}`),
    ...c.adjustments.map(x => `${l.adjustment}: ${x}`),
  ] : [])]
}
export function contextRationale(context: SessionContext, sport: Sport): string {
  const phase = context.phase ?? 'base', t = sportMessages(), l = coach().label, x = coach().context
  const goal = context.goal
  const distance = goal?.sport === sport ? goal.distanceM : goal?.legs?.filter(g => g.sport === sport).reduce((n,g) => n + g.distanceM,0)
  return [
    context.phase ? `${l.phase}: ${t.phases[phase]}.` : x.standalone,
    context.weekIndex !== undefined ? `${l.cycleWeek}: ${context.weekIndex + 1}.` : '',
    goal ? `${l.planGoal}: ${goal.name}${distance ? ` (${distance} m)` : ''}.` : '',
    phase === 'deload' || phase === 'recovery' ? x.reduced : phase === 'taper' ? x.taper : x.dose,
    context.brick ? x.brick : '',
  ].filter(Boolean).join(' ')
}
export function attachRunningCoaching(s: TrainingSession, context: SessionContext = {}): TrainingSession {
  if (!s.legacyWorkout) return s
  const kind = s.legacyWorkout.kind, r = coach().running
  const objective = kind === 'test' ? r.test
    : s.purpose === 'race' ? r.race
    : s.purpose === 'long' ? r.long
    : s.legacyWorkout.segments.some(x => x.type === 'hills') ? r.hills
    : s.legacyWorkout.segments.some(x=>x.type==='progression') ? r.progression
    : s.purpose === 'intervals' ? r.intervals
    : r.easy
  return { ...s, ...(context.phase?{phase:context.phase}:{}), coaching: { version:1, recipeId:`run-legacy-${kind}`, title:sportMessages().purpose[s.purpose], objective,
    rationale: contextRationale(context, 'run'), successCriteria:[r.success], adjustments:[r.adjustment] } }
}
