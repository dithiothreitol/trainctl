import { addDays, diffDays, mondayOf } from '../util/dates.ts'
import { buildSportSession } from './workouts.ts'
import { sportMessages as msg } from './messages.ts'
import type { EnduranceSport, SessionExecution, SessionPurpose, SportProfile, SportsConfig, SportsPlan, TrainingIntent, TrainingSession } from './types.ts'

export interface SportModule {
  sport: EnduranceSport
  calibrated(profile: SportProfile, asOf: string): boolean
  weekly(profile: SportProfile, config: SportsConfig, from: string, week: string, asOf: string): { phase: NonNullable<TrainingSession['phase']>; earliest: string; doses: { minutes: number; purpose: SessionPurpose }[] }
  session: typeof buildSportSession
}
export function trainingIntent(s: TrainingSession): TrainingIntent {
  const primary = ({ easy: 'aerobic', long: 'durability', intervals: 'quality', technique: 'technique', race: 'competition', strength: 'strength' } as const)[s.purpose]
  const calibratedWork = s.steps.some(step=>step.role==='work'&&step.target.kind!=='open') || s.legacyWorkout?.segments.some(segment=>segment.pace && !['warmup','cooldown','easy'].includes(segment.type))
  return { primary, intensity: s.purpose === 'race' ? 'high' : s.purpose === 'intervals' ? calibratedWork ? 'high' : 'unknown' : s.purpose === 'strength' ? 'unknown' : 'low', specificTo: s.sport }
}
function calibrated(sport: EnduranceSport, p: SportProfile, asOf: string): boolean {
  if (sport === 'bike' && p.resources && !p.resources.includes('powerMeter')) return false
  if (sport === 'run') return !!p.results?.some(r => !r.excluded && r.terrain !== 'trail' && diffDays(r.date, asOf) >= 0 && diffDays(r.date, asOf) <= 540)
  return !!(sport === 'bike' ? p.ftpWatts : p.cssSecPer100m) && !!p.calibration && diffDays(p.calibration.date, asOf) >= 0 && diffDays(p.calibration.date, asOf) <= 180
}
function moduleFor(sport: EnduranceSport): SportModule {
  return {
    sport, calibrated: (p, asOf) => calibrated(sport, p, asOf), session: buildSportSession,
    weekly(p, c, from, week, asOf) {
      const index = Math.max(0, Math.floor(diffDays(mondayOf(from), week) / 7))
      const daysToRace = diffDays(week, c.goal.date), race = c.goal.kind !== 'base'
      const taper = race && daysToRace >= 0 && daysToRace < (p.taperDays ?? 14)
      const tuneUp = c.tuneUpGoals?.some(g=>g.priority === 'B' && diffDays(week,g.date)>=0 && diffDays(week,g.date)<7)
      const recovery = race && daysToRace < 0
      const deload = !taper && !recovery && index % 4 === 3
      const phase = recovery ? 'recovery' : taper ? 'taper' : deload ? 'deload' : index < 2 ? 'base' : 'build'
      // MS-4: explicit, bounded engineering progression. No cross-sport load sum.
      const loadingIndex = index - Math.floor(index / 4)
      const peak = Math.min(p.peakWeeklyMinutes ?? p.weeklyMinutes, p.weeklyMinutes * (1 + (p.progressionPercent ?? 0) / 100) ** loadingIndex)
      const minutes = peak * (recovery ? 0.5 : taper ? 0.5 : tuneUp ? 0.75 : deload ? 0.8 : 1)
      const quality = !recovery && p.experience !== 'new' && calibrated(sport, p, asOf) ? Math.min(p.qualitySessions ?? (p.experience && p.sessionsPerWeek >= 3 ? 1 : 0), Math.floor(p.sessionsPerWeek / 3)) : 0
      const purposes: SessionPurpose[] = Array.from({ length: p.sessionsPerWeek }, (_, i) => recovery ? 'easy' : i < quality ? 'intervals' : sport === 'swim' && i === quality ? 'technique' : i === p.sessionsPerWeek - 1 && p.sessionsPerWeek > 1 ? 'long' : 'easy')
      const weights = purposes.map(x => x === 'long' ? (sport === 'bike' ? 1.5 : 1.25) : 1)
      const sum = weights.reduce((a, b) => a + b, 0)
      const earliest = race ? addDays(c.goal.date, (p.recoveryDays ?? (sport === 'run' ? 2 : 1)) + 1) : from
      return { phase, earliest: recovery ? earliest : from, doses: purposes.map((purpose, i) => ({ minutes: Math.max(5, Math.floor(minutes * weights[i]! / sum)), purpose })) }
    },
  }
}
const modules = { run: moduleFor('run'), bike: moduleFor('bike'), swim: moduleFor('swim') }
export const sportModule = (sport: EnduranceSport): SportModule => modules[sport]

export interface ReplacementContext { asOf?: string; execution?: SessionExecution[]; variant?: 'endurance' | 'quality' }
/** Direction-specific dose and intent policy. MS-2/MS-5 are not equivalence factors. */
export function replacementAssessment(plan: SportsPlan, c: SportsConfig, source: TrainingSession, target: EnduranceSport, requested: number | undefined, context: ReplacementContext = {}) {
  const p = c.athlete.sports[target]!, asOf = context.asOf ?? source.date, t = msg()
  if (p.resources && (target === 'swim' ? !p.resources.includes('pool') : target === 'bike' ? !p.resources.some(r => r === 'bike' || r === 'trainer') : false)) throw new Error(t.noFit)
  const history = (context.execution ?? []).filter(e => e.sport === target && e.status === 'done' && e.date < asOf && diffDays(e.date, asOf) <= 28 && (e.durationSec ?? 0) > 0)
  const accustomed = p.experience === 'regular' || p.experience === 'trained' || history.length >= 3
  const limits: string[] = [], lost: string[] = [t.specificity], preserved = [t.aerobicIntent]
  const sourceMinutes = (source.durationSec + source.preparationSec) / 60
  const normalDose = p.weeklyMinutes / p.sessionsPerWeek
  const historyDose = history.length ? Math.max(...history.map(e => e.durationSec! / 60)) : normalDose
  const unfamiliarCap = target === 'run' ? 20 : target === 'swim' ? 20 : 40
  const maximum = Math.min(p.maxSessionMinutes ?? Infinity, normalDose, accustomed ? historyDose : unfamiliarCap)
  const minutes = Math.min((requested ?? sourceMinutes) - (p.preparationMinutes ?? 10), maximum)
  if (!accustomed) limits.push(t.unfamiliarSport)
  if (minutes < (requested ?? sourceMinutes) - (p.preparationMinutes ?? 10)) limits.push(t.doseLimited)
  const nearRace = [...(c.goal.kind === 'base' ? [] : [c.goal]), ...(c.tuneUpGoals ?? [])].some(g=>diffDays(source.date,g.date)>=0 && diffDays(source.date,g.date)<=7)
  const adjacentHard = plan.sessions.some(s => s.id !== source.id && ['intervals', 'race'].includes(s.purpose) && Math.abs(diffDays(s.date, source.date)) <= 1)
  const quality = source.purpose === 'intervals' && accustomed && sportModule(target).calibrated(p, asOf) && !nearRace && !adjacentHard && context.variant !== 'endurance' && minutes >= 20
  if (context.variant === 'quality' && !quality) throw new Error(t.qualityUnavailable)
  const purpose: SessionPurpose = quality ? 'intervals' : source.purpose === 'long' && accustomed && !nearRace ? 'long' : 'easy'
  if (source.purpose === 'intervals' && quality) preserved.push(t.qualityIntent)
  else if (['intervals', 'technique'].includes(source.purpose)) lost.push(t.differentPurpose)
  if (nearRace) limits.push(t.raceProximity)
  if (adjacentHard) limits.push(t.hardNeighbour)
  const direction = `${source.sport}-${target}` as keyof typeof t.transfer
  lost.push(t.transfer[direction])
  return { minutes, purpose, assessment: { direction, original: trainingIntent(source), alternative: { primary: purpose === 'intervals' ? 'quality' : purpose === 'long' ? 'durability' : 'aerobic', intensity: purpose === 'intervals' ? 'high' : 'low', specificTo: target } as TrainingIntent, preserved, lost, limits, beforeMinutes: sourceMinutes, afterMinutes: minutes + (p.preparationMinutes ?? 10) } }
}
