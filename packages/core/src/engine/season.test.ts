import { describe, expect, it } from 'vitest'
import type { Microcycle, PlannedWorkout, RaceGoal, Weekday } from '../domain/types.ts'
import { seasonLine, seasonProfile, seasonShapeIssues } from './season.ts'

const WD: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10)

function week(start: string, workouts: Partial<Record<Weekday, PlannedWorkout>>, phase: Microcycle['skeleton']['phase'] = 'build'): Microcycle {
  const days = WD.map((weekday, i) => ({ date: addDays(start, i), weekday, ...(workouts[weekday] ? { workout: workouts[weekday] } : {}) }))
  const totalKm = days.reduce((s, d) => s + (d.workout?.distanceKm ?? 0), 0)
  return {
    weekStart: start, days, totalKm, easyShare: 1,
    skeleton: { weekStart: start, index: 0, phase, intensityModel: 'pyramidal', targetKm: totalKm, deload: false, keepIntensity: false, keepFrequency: false, qualitySessions: 1, flags: [], ruleRefs: [] },
  }
}
const easy = (km: number): PlannedWorkout => ({ kind: 'easy', distanceKm: km, ruleRefs: [], segments: [{ type: 'easy', distanceKm: km, description: '' }] })
const long = (km: number): PlannedWorkout => ({ ...easy(km), kind: 'long' })
const marathon: RaceGoal = { kind: 'race', name: 'M', date: '2027-04-25', distanceKm: 42.195, priority: 'A' }
const half: RaceGoal = { ...marathon, distanceKm: 21.0975 }

describe('longBelowGoal', () => {
  it('maraton: 25 km spełnia P-8 („najdłuższy <25 km" jest karany)', () => {
    const weeks = [week('2027-01-04', { tue: easy(10), sat: long(25) })]
    expect(seasonShapeIssues({ goal: marathon, weeks }).some((i) => i.code === 'longBelowGoal')).toBe(false)
    const short = [week('2027-01-04', { tue: easy(10), sat: long(24.9) })]
    expect(seasonShapeIssues({ goal: marathon, weeks: short }).some((i) => i.code === 'longBelowGoal')).toBe(true)
  })
  it('półmaraton: 21 km nie spełnia J-2 (wymaga >21 km)', () => {
    const weeks = [week('2027-01-04', { tue: easy(10), sat: long(21) })]
    expect(seasonShapeIssues({ goal: half, weeks }).some((i) => i.code === 'longBelowGoal')).toBe(true)
  })
})

describe('akcenty w profilu sezonu', () => {
  const steady: PlannedWorkout = {
    kind: 'quality_continuous', distanceKm: 10, ruleRefs: [],
    segments: [
      { type: 'warmup', distanceKm: 3, description: '' },
      { type: 'steady', distanceKm: 6, description: '' },
      { type: 'cooldown', distanceKm: 1, description: '' },
    ],
  }
  const hills: PlannedWorkout = {
    kind: 'easy_hills', distanceKm: 13, ruleRefs: [],
    segments: [
      { type: 'easy', distanceKm: 6, description: '' },
      { type: 'hills', reps: 15, repM: 200, distanceKm: 6, description: '' },
      { type: 'cooldown', distanceKm: 1, description: '' },
    ],
  }
  it('odcinek steady liczy się jako praca poza Z1, podbiegi w połowie', () => {
    const [row] = seasonProfile([week('2027-01-04', { tue: steady, thu: hills, sat: long(18) })])
    expect(row!.accents.map((a) => a.hardKm)).toEqual([6, 3])
  })
  it('dawka bez słów w żadnym języku', () => {
    const line = seasonLine(seasonProfile([week('2027-01-04', { tue: steady, thu: hills, sat: long(18) })])[0]!)
    expect(line.replace(/quality_continuous|easy_hills|build/g, '').replace(/\bkm\b/g, '')).not.toMatch(/[a-ząćęłńóśźż]{3,}/i)
  })
})
