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

describe('C1: przerwa w połowie serii przy skracaniu', () => {
  it('skrócona seria trzyma przerwę w połowie (afterRep = połowa nowej liczby odcinków)', () => {
    const workout = {
      kind: 'quality_intervals' as const, distanceKm: 12, ruleRefs: [],
      segments: [
        { type: 'warmup' as const, distanceKm: 3, pace: { loSecPerKm: 300, hiSecPerKm: 360 }, description: '' },
        { type: 'intervals' as const, reps: 8, repM: 1000, distanceKm: 8, pace: { loSecPerKm: 240, hiSecPerKm: 250 }, recoverySec: 180, recoveryMode: 'jog' as const, setBreak: { afterRep: 4, sec: 240, mode: 'walk' as const }, description: '' },
        { type: 'cooldown' as const, distanceKm: 1, description: '' },
      ],
    }
    const result = shortenWorkout(workout, 75)
    expect(result.status).toBe('shortened')
    const main = result.workout!.segments.find((s) => s.type === 'intervals')!
    expect(main.reps).toBeLessThan(8)
    expect(main.setBreak).toEqual({ afterRep: Math.ceil(main.reps! / 2), sec: 240, mode: 'walk' })
  })
})

describe('B2: bieg z przebieżkami przy skracaniu', () => {
  it('skrócony bieg spokojny z przebieżkami nadal je ma (J-6, E-1)', () => {
    const strides = easy(8)
    strides.ruleRefs = ['I-5', 'J-6']
    strides.segments[0] = { ...strides.segments[0]!, strides: { count: 6, meters: 80 }, description: '8 km easy, finishing with 6 strides of about 80 m.' }
    const result = shortenWorkout(strides, 45)
    expect(result.status).toBe('shortened')
    const segment = result.workout!.segments[0]!
    expect(segment.distanceKm).toBeLessThan(8)
    expect(segment.strides).toEqual({ count: 6, meters: 80 })
    expect(segment.description).toContain('6 strides of about 80 m')
  })
})

describe('rejestr §14: przerwa w połowie serii i przebieżki w szacunku czasu', () => {
  const vo2 = (setBreak?: { afterRep: number; sec: number; mode: 'walk' | 'jog' }): PlannedWorkout => ({
    kind: 'quality_intervals', distanceKm: 10, ruleRefs: [],
    segments: [
      { type: 'warmup', distanceKm: 3, pace: { loSecPerKm: 300, hiSecPerKm: 360 }, description: '' },
      { type: 'intervals', reps: 6, repM: 1000, distanceKm: 6, pace: { loSecPerKm: 240, hiSecPerKm: 250 }, recoverySec: 180, recoveryMode: 'jog', ...(setBreak ? { setBreak } : {}), description: '' },
      { type: 'cooldown', distanceKm: 1, description: '' },
    ],
  })

  it('4\u2032 marszu po połowie serii wydłuża szacunek o 4 minuty; przerwa poza serią nic nie dodaje', () => {
    const base = estimateWorkoutMinutes(vo2(), 15)
    expect(estimateWorkoutMinutes(vo2({ afterRep: 3, sec: 240, mode: 'walk' }), 15)).toBe(base + 4)
    expect(estimateWorkoutMinutes(vo2({ afterRep: 6, sec: 240, mode: 'walk' }), 15)).toBe(base)
    expect(estimateWorkoutMinutes(vo2({ afterRep: 0, sec: 240, mode: 'walk' }), 15)).toBe(base)
  })

  it('przebieżki: 0,2 s na metr i minuta powrotu na przebieżkę', () => {
    const plain = easy(8)
    const strides = easy(8)
    strides.segments[0] = { ...strides.segments[0]!, strides: { count: 6, meters: 80 } }
    // 6 × (80 m × 0,2 s + 60 s) = 456 s; szacunek w pełnych minutach w górę
    expect(estimateWorkoutMinutes(strides, 15) - estimateWorkoutMinutes(plain, 15)).toBe(Math.ceil((8 * 360 + 456) / 60) - Math.ceil((8 * 360) / 60))
  })

  it('opis po skróceniu (E-1) zachowuje przerwę w połowie serii', () => {
    const result = shortenWorkout(vo2({ afterRep: 3, sec: 240, mode: 'walk' }), 75)
    expect(result.status).toBe('shortened')
    const main = result.workout!.segments.find((s) => s.type === 'intervals')!
    expect(main.description).toContain(`after repetition ${main.setBreak!.afterRep} an extra 240 s walking`)
  })
})
