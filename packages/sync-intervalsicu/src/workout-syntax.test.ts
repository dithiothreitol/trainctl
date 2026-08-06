import { describe, expect, it } from 'vitest'
import { setLocale } from '@tren/core'

setLocale('pl')
import {
  generateMicrocycle,
  paceZones,
  type AthleteProfile,
  type PlannedDay,
  type WeekSkeleton,
} from '@tren/core'
import { distance, duration, paceTarget, toPushableWorkout, toWorkoutSyntax } from './workout-syntax.ts'

describe('prymitywy składni', () => {
  it('tempo: środek zakresu jako M:SS/km Pace', () => {
    expect(paceTarget({ loSecPerKm: 255, hiSecPerKm: 255 })).toBe('4:15/km Pace')
    expect(paceTarget({ loSecPerKm: 250, hiSecPerKm: 260 })).toBe('4:15/km Pace')
    expect(paceTarget({ loSecPerKm: 300, hiSecPerKm: 300 })).toBe('5:00/km Pace')
  })

  it('czas: m to MINUTY (pułapka składni)', () => {
    expect(duration(180)).toBe('3m')
    expect(duration(90)).toBe('1m30s')
    expect(duration(45)).toBe('45s')
    expect(duration(3720)).toBe('1h2m')
  })

  it('dystans: km i mtr poniżej kilometra', () => {
    expect(distance(2)).toBe('2km')
    expect(distance(0.4)).toBe('400mtr')
    expect(distance(1.5)).toBe('1.5km')
  })
})

describe('toWorkoutSyntax', () => {
  it('interwały: blok Nx z przerwą, otoczony pustymi liniami', () => {
    const text = toWorkoutSyntax([
      { type: 'warmup', distanceKm: 3, pace: { loSecPerKm: 320, hiSecPerKm: 320 }, description: '' },
      {
        type: 'intervals',
        reps: 5,
        repM: 1000,
        pace: { loSecPerKm: 255, hiSecPerKm: 255 },
        recoverySec: 180,
        description: '',
      },
      { type: 'cooldown', distanceKm: 1, description: '' },
    ])
    expect(text).toBe(
      [
        '- 3km 5:20/km Pace Warmup',
        '',
        '5x',
        '- 1km 4:15/km Pace',
        '- 3m 6:30/km Pace',
        '',
        '- 1km 6:30/km Pace Cooldown',
      ].join('\n'),
    )
  })

  it('podbiegi: powtórzenia BEZ celu tempa (pod górę tempo płaskie nieosiągalne)', () => {
    const text = toWorkoutSyntax([
      { type: 'hills', reps: 15, repM: 200, description: '' },
    ])
    expect(text).toContain('15x')
    expect(text).toContain('- 200mtr')
    expect(text).not.toContain('Pace')
  })

  it('bieg zmienny: pary szybko/wolno', () => {
    const text = toWorkoutSyntax([
      {
        type: 'alternating',
        distanceKm: 10,
        pace: { loSecPerKm: 250, hiSecPerKm: 310 },
        description: '',
      },
    ])
    expect(text).toContain('5x')
    expect(text).toContain('- 1km 4:10/km Pace')
    expect(text).toContain('- 1km 5:10/km Pace')
  })

  it('tempo narastające: trzy tercje od wolniejszej do szybszej', () => {
    const text = toWorkoutSyntax([
      {
        type: 'progression',
        distanceKm: 9,
        pace: { loSecPerKm: 260, hiSecPerKm: 290 },
        description: '',
      },
    ])
    const lines = text.split('\n')
    expect(lines).toHaveLength(3)
    expect(lines[0]).toBe('- 3km 4:50/km Pace')
    expect(lines[2]).toBe('- 3km 4:20/km Pace')
  })

  it('brak pustych linii na początku/końcu i duplikatów', () => {
    const text = toWorkoutSyntax([
      { type: 'intervals', reps: 3, repM: 400, pace: { loSecPerKm: 240, hiSecPerKm: 240 }, recoverySec: 60, description: '' },
      { type: 'intervals', reps: 3, repM: 400, pace: { loSecPerKm: 240, hiSecPerKm: 240 }, recoverySec: 60, description: '' },
    ])
    expect(text.startsWith('3x')).toBe(true)
    expect(text.endsWith('')).toBe(true)
    expect(text).not.toContain('\n\n\n')
  })
})

describe('toPushableWorkout', () => {
  const zones = paceZones(51)
  const athlete: AthleteProfile = {
    recentWeeklyKm: 55,
    daysAvailable: ['tue', 'wed', 'thu', 'sat', 'sun'],
    results: [],
  }
  const skeleton: WeekSkeleton = {
    weekStart: '2026-08-03',
    index: 2,
    phase: 'build',
    intensityModel: 'pyramidal',
    targetKm: 60,
    deload: false,
    keepIntensity: false,
    keepFrequency: false,
    qualitySessions: 2,
    flags: [],
    ruleRefs: [],
  }
  const week = generateMicrocycle({ skeleton, athlete, zones })

  it('każdy dzień treningowy z realnego mikrocyklu konwertuje się poprawnie', () => {
    const workouts = week.days
      .map((d) => toPushableWorkout(d, 'Maraton testowy'))
      .filter((w): w is NonNullable<typeof w> => w !== undefined)
    expect(workouts.length).toBeGreaterThanOrEqual(4)
    for (const w of workouts) {
      expect(w.externalId).toMatch(/^tren-\d{4}-\d{2}-\d{2}$/)
      expect(w.sport).toBe('run')
      expect(w.description).not.toContain('undefined')
      expect(w.description).not.toContain('NaN')
      // każdy krok zaczyna się od "- " albo jest nagłówkiem powtórzeń "Nx"
      for (const line of w.description.split('\n').filter(Boolean)) {
        expect(line).toMatch(/^(- |\d+x$)/)
      }
    }
  })

  it('dzień wolny i start nie są wypychane', () => {
    const rest: PlannedDay = { date: '2026-08-03', weekday: 'mon' }
    expect(toPushableWorkout(rest, 'X')).toBeUndefined()
    const race: PlannedDay = {
      date: '2026-08-09',
      weekday: 'sun',
      workout: { kind: 'race', distanceKm: 0, ruleRefs: [], segments: [{ type: 'race', description: 'START' }] },
    }
    expect(toPushableWorkout(race, 'X')).toBeUndefined()
  })

  it('external_id jest deterministyczny (upsert nie duplikuje)', () => {
    const day = week.days.find((d) => d.workout)!
    expect(toPushableWorkout(day, 'A')!.externalId).toBe(toPushableWorkout(day, 'B')!.externalId)
  })

  it('sprawdzian trafia na zegarek: rozgrzewka z celem, część na czas BEZ celu (ADR-020)', () => {
    const test: PlannedDay = {
      date: '2026-09-12',
      weekday: 'sat',
      workout: {
        kind: 'test',
        distanceKm: 9,
        ruleRefs: ['W-11'],
        segments: [
          { type: 'warmup', distanceKm: 3, pace: { loSecPerKm: 320, hiSecPerKm: 320 }, description: '' },
          { type: 'race', distanceKm: 5, description: '5 kilometrów na czas' },
          { type: 'cooldown', distanceKm: 1, description: '' },
        ],
      },
    }
    const pushed = toPushableWorkout(test, 'Maraton testowy')!
    expect(pushed.name).toContain('Sprawdzian')
    const lines = pushed.description.split('\n')
    expect(lines[0]).toContain('Warmup')
    expect(lines[1]).toBe('- 5km') // bez „Pace" — zegarek mierzy, nie pilnuje tempa
    expect(lines[2]).toContain('Cooldown')
  })
})
