import { describe, expect, it } from 'vitest'
import { reschedule } from './reschedule.ts'
import { estimateWorkoutMinutes } from '../engine/duration.ts'
import { addDays } from '../util/dates.ts'
import type { Microcycle, PlannedWorkout, Weekday } from '../domain/types.ts'

const workout = (kind: PlannedWorkout['kind'], km: number): PlannedWorkout => ({
  kind, distanceKm: km, ruleRefs: [], segments: [{ type: 'easy', distanceKm: km, pace: { loSecPerKm: 300, hiSecPerKm: 360 }, description: 'run' }],
})
function week(): Microcycle {
  const days: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
  return {
    weekStart: '2026-08-24', totalKm: 20, easyShare: 1,
    skeleton: { weekStart: '2026-08-24', index: 0, phase: 'base', intensityModel: 'pyramidal', targetKm: 20, deload: false, keepIntensity: false, keepFrequency: false, qualitySessions: 0, flags: [], ruleRefs: [] },
    days: days.map((weekday, i) => ({ date: addDays('2026-08-24', i), weekday,
      ...(i === 1 ? { workout: workout('easy', 5) } : i === 3 ? { workout: workout('quality_intervals', 5) } : i === 5 ? { workout: workout('long', 10) } : {}),
    })),
  }
}
describe('time constraints', () => {
  it('drops the session that cannot fit instead of discarding smaller sessions first', () => {
    const input = week()
    const result = reschedule({ week: input, blockedDates: [], timeBudgets: Object.fromEntries(input.days.map((d) => [d.date, 35])), preparationMinutes: 5 })
    expect(result.dropped.map((d) => d.kind)).toEqual(['long'])
    expect(result.days.filter((d) => d.workout)).toHaveLength(2)
    for (const day of result.days) if (day.workout) expect(estimateWorkoutMinutes(day.workout, 5)).toBeLessThanOrEqual(35)
  })
  it('offers distinct priorities when only one session fits', () => {
    const input = { week: week(), blockedDates: [], availableDays: ['sat'] as Weekday[] }
    expect(reschedule({ ...input, strategy: 'long' }).days.find((d) => d.workout)?.workout?.kind).toBe('long')
    expect(reschedule({ ...input, strategy: 'quality' }).days.find((d) => d.workout)?.workout?.kind).toBe('quality_intervals')
  })
  it('includes recovery intervals, preparation and strength in the time budget', () => {
    const intervals: PlannedWorkout = { kind: 'quality_intervals', distanceKm: 3, ruleRefs: [], segments: [{ type: 'intervals', reps: 3, repM: 1000, recoverySec: 120, pace: { loSecPerKm: 300, hiSecPerKm: 300 }, description: '3 x 1 km' }] }
    expect(estimateWorkoutMinutes(intervals, 10)).toBe(31)
    const input = week()
    input.days[1]!.strength = { kind: 'heavy', durationMin: 30, description: 'strength', ruleRefs: [] }
    expect(() => reschedule({ week: input, blockedDates: [], pinnedDates: ['2026-08-25'], timeBudgets: { '2026-08-25': 60 } })).toThrow()
  })
})
