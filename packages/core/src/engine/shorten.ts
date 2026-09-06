import type { PlannedSegment, PlannedWorkout } from '../domain/types.ts'
import { messages } from '../i18n/index.ts'
import { estimateWorkoutMinutes } from './duration.ts'
import { fmtPace } from './microcycle.ts'

export interface ShortenedWorkout {
  status: 'unchanged' | 'shortened' | 'easy-alternative' | 'unavailable'
  reason: 'fits' | 'reduced-dose' | 'lost-purpose' | 'protected-measurement' | 'too-little-time' | 'unsupported'
  budgetMinutes: number
  preparationMinutes: number
  strengthMinutes: number
  beforeMinutes: number | null
  afterMinutes: number | null
  workout?: PlannedWorkout
}

const round = (n: number) => Math.round(n * 1000) / 1000
const kmOf = (s: PlannedSegment) => s.type === 'hills'
  ? 2 * (s.reps ?? 0) * (s.repM ?? 0) / 1000
  : s.distanceKm ?? (s.reps ?? 0) * (s.repM ?? 0) / 1000

function describe(s: PlannedSegment, kind: PlannedWorkout['kind']): string {
  const m = messages()
  const km = s.distanceKm ?? 0
  if (s.type === 'easy') return kind === 'long' ? m.workout.veryEasy(km) : m.workout.easy(km)
  if (s.type === 'hills') return m.workout.hills(s.reps!, s.repM!)
  if (s.type === 'intervals') return m.shorten.repeats(s.reps!, s.repM!, s.pace ? `${fmtPace(s.pace.loSecPerKm)}–${fmtPace(s.pace.hiSecPerKm)}` : '—', s.recoverySec ?? 0)
  if (s.type === 'progression' && s.pace) return m.workout.progression(km, fmtPace(s.pace.hiSecPerKm), fmtPace(s.pace.loSecPerKm))
  if (s.type === 'alternating' && s.pace) return m.workout.alternating(km, fmtPace(s.pace.loSecPerKm), fmtPace(s.pace.hiSecPerKm))
  return s.description
}

/** E-1: engineering cutoffs, not an equivalence or physiological safety claim.
 * Keep warm-up/cool-down, pace targets and full recoveries. Reduce complete reps
 * or distance. Retain >=50% of quality work, >=60% of a long run; otherwise label
 * an easy alternative explicitly. A replacement must contain >=15 minutes of
 * running at the faster edge of its pace range. Never resize a measurement.
 */
export function shortenWorkout(workout: PlannedWorkout, budgetMinutes: number,
  opts: { preparationMinutes?: number; strengthMinutes?: number } = {}): ShortenedWorkout {
  const preparationMinutes = opts.preparationMinutes ?? 15
  const strengthMinutes = opts.strengthMinutes ?? 0
  if (![budgetMinutes, preparationMinutes, strengthMinutes].every(n => Number.isInteger(n) && n >= 0 && n <= 1440)
    || preparationMinutes > 120) throw new Error(messages().shorten.badBudget)
  const total = (w: PlannedWorkout) => estimateWorkoutMinutes(w, preparationMinutes) + strengthMinutes
  const before = total(workout)
  const result = (status: ShortenedWorkout['status'], reason: ShortenedWorkout['reason'], next?: PlannedWorkout): ShortenedWorkout => ({
    status, reason, budgetMinutes, preparationMinutes, strengthMinutes,
    beforeMinutes: Number.isFinite(before) ? before : null,
    afterMinutes: next ? total(next) : null,
    ...(next ? { workout: next } : {}),
  })
  if (!Number.isFinite(workout.distanceKm) || workout.distanceKm < 0 || workout.segments.some(s =>
    (s.pace && (!Number.isFinite(s.pace.loSecPerKm) || !Number.isFinite(s.pace.hiSecPerKm) || s.pace.loSecPerKm <= 0 || s.pace.hiSecPerKm < s.pace.loSecPerKm))
    || (s.recoverySec !== undefined && (!Number.isFinite(s.recoverySec) || s.recoverySec < 0)))) return result('unavailable', 'unsupported')
  if (before <= budgetMinutes) return result('unchanged', 'fits', structuredClone(workout))
  if (workout.kind === 'race' || workout.kind === 'test' || workout.segments.some(s => s.type === 'race'))
    return result('unavailable', 'protected-measurement')
  // Only resize structures whose complete prescription is represented by fields.
  const supported = new Set(['easy', 'warmup', 'cooldown', 'intervals', 'hills', 'progression', 'alternating'])
  if (!workout.segments.length || workout.segments.some(s => !supported.has(s.type) || !Number.isFinite(kmOf(s)) || kmOf(s) <= 0
    || ((s.type === 'hills' || s.type === 'intervals') && (!Number.isInteger(s.reps) || !s.repM || s.repM <= 0))))
    return result('unavailable', 'unsupported')
  const next = structuredClone(workout)
  const floors = next.segments.map(s => {
    if (s.type === 'intervals' || s.type === 'hills') return Math.max(2, Math.ceil(s.reps! / 2))
    if (s.type === 'easy') return workout.kind === 'long' ? kmOf(s) * 0.6 : workout.kind === 'easy' ? 0 : kmOf(s)
    if (s.type === 'progression' || s.type === 'alternating') return kmOf(s) * 0.5
    return kmOf(s)
  })
  for (let i = 0; i < next.segments.length; i++) {
    const s = next.segments[i]!
    if (s.type === 'warmup' || s.type === 'cooldown') continue
    const repeated = s.type === 'intervals' || s.type === 'hills'
    while (total(next) > budgetMinutes) {
      if (repeated) {
        if (s.reps! <= floors[i]!) break
        s.reps!--
        s.distanceKm = round(s.reps! * s.repM! / 1000 * (s.type === 'hills' ? 2 : 1))
      } else {
        const distance = round(kmOf(s) - 0.1)
        if (distance < floors[i]! - 0.0001 || distance <= 0) break
        s.distanceKm = distance
      }
      s.description = describe(s, next.kind)
      next.distanceKm = round(next.segments.reduce((sum, part) => sum + kmOf(part), 0))
    }
  }
  // Avoid offering a token easy run just because the overhead fits.
  const minimumRunning = (w: PlannedWorkout) => w.segments.reduce((sum, s) => sum + kmOf(s) * (s.pace?.loSecPerKm ?? 360), 0) / 60
  if (total(next) <= budgetMinutes && (workout.kind !== 'easy' || minimumRunning(next) >= 15)) {
    next.ruleRefs = [...new Set([...next.ruleRefs, 'E-1'])]
    return result('shortened', 'reduced-dose', next)
  }
  const easyPace = workout.segments.find(s => s.type === 'easy' || s.type === 'warmup')?.pace
  if (!easyPace || easyPace.loSecPerKm <= 0 || easyPace.hiSecPerKm < easyPace.loSecPerKm) return result('unavailable', 'unsupported')
  const available = budgetMinutes - preparationMinutes - strengthMinutes
  const distanceKm = Math.floor(Math.min(workout.distanceKm, available * 60 / easyPace.hiSecPerKm) * 10) / 10
  if (distanceKm <= 0 || distanceKm * easyPace.loSecPerKm / 60 < 15) return result('unavailable', 'too-little-time')
  const easy: PlannedWorkout = { kind: 'easy', distanceKm, ruleRefs: ['I-5', 'E-1'], segments: [
    { type: 'easy', distanceKm, pace: { ...easyPace }, description: messages().workout.easy(distanceKm) },
  ] }
  return result('easy-alternative', 'lost-purpose', easy)
}
