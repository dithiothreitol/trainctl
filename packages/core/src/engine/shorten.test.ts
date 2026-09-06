import { describe, expect, it } from 'vitest'
import { shortenWorkout } from './shorten.ts'
import { estimateWorkoutMinutes } from './duration.ts'
import { setLocale } from '../i18n/index.ts'
import type { PlannedWorkout } from '../domain/types.ts'

setLocale('en')
const easy = (km = 10): PlannedWorkout => ({ kind: 'easy', distanceKm: km, ruleRefs: ['I-5'], segments: [
  { type: 'easy', distanceKm: km, pace: { loSecPerKm: 300, hiSecPerKm: 360 }, description: `${km} km easy` },
] })
const intervals = (): PlannedWorkout => ({ kind: 'quality_intervals', distanceKm: 11, ruleRefs: ['I-7'], segments: [
  { type: 'warmup', distanceKm: 2, pace: { loSecPerKm: 300, hiSecPerKm: 360 }, description: '2 km warm-up' },
  { type: 'intervals', reps: 8, repM: 1000, distanceKm: 8, pace: { loSecPerKm: 240, hiSecPerKm: 270 }, recoverySec: 120, description: '8 × 1 km' },
  { type: 'cooldown', distanceKm: 1, description: '1 km cool-down' },
] })

describe('time-constrained sessions', () => {
  it('fits a 40-minute door-to-door budget without mutating the original', () => {
    const original = easy()
    const result = shortenWorkout(original, 40)
    expect(result.status).toBe('shortened')
    expect(result.workout!.distanceKm).toBe(4.1)
    expect(result.afterMinutes).toBe(40)
    expect(original.distanceKm).toBe(10)
    expect(result.workout!.segments[0]!.description).toContain('4.1')
  })
  it('keeps complete repetitions, pace targets, recoveries and bookends', () => {
    const original = intervals()
    const result = shortenWorkout(original, 60)
    expect(result.status).toBe('shortened')
    const next = result.workout!
    expect(next.segments[1]).toMatchObject({ reps: 4, distanceKm: 4, recoverySec: 120, pace: original.segments[1]!.pace })
    expect(next.segments[0]).toEqual(original.segments[0])
    expect(next.segments[2]).toEqual(original.segments[2])
    expect(next.segments[1]!.description).toContain('4 × 1000 m')
    expect(result.afterMinutes).toBeLessThanOrEqual(60)
  })
  it('labels the lost quality purpose when only an easy alternative fits', () => {
    const result = shortenWorkout(intervals(), 40)
    expect(result).toMatchObject({ status: 'easy-alternative', reason: 'lost-purpose', workout: { kind: 'easy' } })
    expect(result.afterMinutes).toBeLessThanOrEqual(40)
  })
  it('does not present a much shorter easy run as a long run', () => {
    const original = { ...easy(20), kind: 'long' as const }
    expect(shortenWorkout(original, 90).status).toBe('shortened')
    expect(shortenWorkout(original, 40)).toMatchObject({ status: 'easy-alternative', workout: { kind: 'easy' } })
  })
  it('counts strength and preparation, refusing a token run', () => {
    expect(shortenWorkout(easy(), 40, { strengthMinutes: 20 })).toMatchObject({ status: 'unavailable', reason: 'too-little-time' })
    const result = shortenWorkout(easy(), 70, { preparationMinutes: 10, strengthMinutes: 30 })
    expect(result.afterMinutes).toBeLessThanOrEqual(70)
    expect(result.workout!.distanceKm).toBe(5)
  })
  it.each(['race', 'test'] as const)('does not change a %s', kind => {
    const workout = { ...intervals(), kind }
    expect(shortenWorkout(workout, 40)).toMatchObject({ status: 'unavailable', reason: 'protected-measurement' })
  })
  it('leaves an already-fitting workout byte-equivalent', () => {
    const original = easy(3)
    expect(shortenWorkout(original, 40)).toMatchObject({ status: 'unchanged', workout: original })
  })
  it('includes downhill distance while reducing hills by whole reps', () => {
    const workout: PlannedWorkout = { kind: 'easy_hills', distanceKm: 9, ruleRefs: ['I-5'], segments: [
      easy(4).segments[0]!, { type: 'hills', reps: 10, repM: 200, distanceKm: 4, description: 'hills' },
      { type: 'cooldown', distanceKm: 1, description: 'cool-down' },
    ] }
    const result = shortenWorkout(workout, 60)
    expect(result.status).toBe('shortened')
    const hills = result.workout!.segments[1]!
    expect(hills.distanceKm).toBeCloseTo(hills.reps! * 0.4)
    expect(result.workout!.distanceKm).toBeCloseTo(result.workout!.segments.reduce((sum, s) => sum + s.distanceKm!, 0))
    expect(result.afterMinutes).toBeLessThanOrEqual(60)
    expect(result.workout!.segments[0]).toEqual(workout.segments[0])
  })
  it.each(['progression', 'alternating'] as const)('keeps %s targets and updates its distance and description', type => {
    const workout = intervals()
    workout.kind = 'quality_continuous'
    workout.segments[1] = { type, distanceKm: 8, pace: { loSecPerKm: 240, hiSecPerKm: 300 }, description: '8 km' }
    const result = shortenWorkout(workout, 55)
    expect(result.status).toBe('shortened')
    expect(result.workout!.segments[1]!.distanceKm).toBeLessThan(8)
    expect(result.workout!.segments[1]!.pace).toEqual(workout.segments[1]!.pace)
    expect(result.workout!.segments[1]!.description).not.toBe('8 km')
  })
  it.each([NaN, Infinity, -1, 40.5, 1441])('rejects invalid budget %s', budget => {
    expect(() => shortenWorkout(easy(), budget)).toThrow()
  })
  it('all returned variants fit their budgets with nonnegative consistent segments', () => {
    for (const original of [easy(), intervals(), { ...easy(20), kind: 'long' as const }]) {
      for (let minutes = 0; minutes <= 150; minutes++) {
        const result = shortenWorkout(original, minutes)
        if (!result.workout) continue
        expect(estimateWorkoutMinutes(result.workout)).toBeLessThanOrEqual(minutes)
        expect(result.workout.distanceKm).toBeCloseTo(result.workout.segments.reduce((sum, s) => sum + s.distanceKm!, 0), 3)
        expect(result.workout.segments.every(s => s.distanceKm! > 0)).toBe(true)
      }
    }
  })
  it('does not offer variants for unsupported or malformed manual prescriptions', () => {
    const manual = intervals()
    manual.segments[1]!.pace!.hiSecPerKm = NaN
    expect(shortenWorkout(manual, 40)).toMatchObject({ status: 'unavailable', reason: 'unsupported' })
    manual.segments[1] = { type: 'steady', distanceKm: 8, description: 'Custom steady session' }
    expect(shortenWorkout(manual, 40)).toMatchObject({ status: 'unavailable', reason: 'unsupported' })
  })
})
