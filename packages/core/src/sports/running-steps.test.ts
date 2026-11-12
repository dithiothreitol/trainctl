import { describe, expect, it } from 'vitest'
import type { PlannedWorkout } from '../domain/types.ts'
import { setLocale } from '../i18n/index.ts'
import { runningSteps } from './running-steps.ts'
import type { SessionStep } from './types.ts'

setLocale('pl')

describe('E1: kroki v2 ze struktury biegu', () => {
  const easyPace = { loSecPerKm: 305, hiSecPerKm: 365 }
  const target = { loSecPerKm: 265, hiSecPerKm: 279 }
  const w = (kind: PlannedWorkout['kind'], segments: PlannedWorkout['segments'], extra: Partial<PlannedWorkout> = {}): PlannedWorkout =>
    ({ kind, segments, ruleRefs: [], distanceKm: segments.reduce((n, s) => n + (s.distanceKm ?? 0), 0), ...extra })
  const total = (steps: SessionStep[]) => steps.reduce((n, s) => n + (s.repeat ?? 1) * (s.durationSec + (s.restSec ?? 0)), 0)

  it('interwały: rozgrzewka, seria z zakresem tempa i przerwą, schłodzenie; czas równy czasowi sesji', () => {
    const steps = runningSteps(w('quality_intervals', [
      { type: 'warmup', distanceKm: 3, pace: easyPace, description: '' },
      { type: 'intervals', reps: 4, repM: 1000, distanceKm: 4, pace: target, recoverySec: 120, recoveryMode: 'walk', description: '' },
      { type: 'cooldown', distanceKm: 1, description: '' },
    ]), 3600)
    expect(steps.map((s) => [s.role, s.repeat ?? 1, s.distanceM, s.restSec ?? 0])).toEqual([['warmup', 1, 3000, 0], ['work', 4, 1000, 120], ['cooldown', 1, 1000, 0]])
    expect(steps[1]!.target).toEqual({ kind: 'pace', seconds: 265, slowSeconds: 279, perM: 1000 })
    expect(steps[1]!.recovery).toEqual({ target: { kind: 'open' }, instruction: 'marsz' })
    expect(total(steps)).toBe(3600)
  })

  it('przerwa w połowie serii dzieli serię; przebieżki, podbiegi ze zbiegiem, narastanie i zmienny', () => {
    const split = runningSteps(w('quality_intervals', [{ type: 'intervals', reps: 6, repM: 1000, distanceKm: 6, pace: target, recoverySec: 180, recoveryMode: 'jog', setBreak: { afterRep: 3, sec: 240, mode: 'walk' }, description: '' }]), 3000)
    expect(split.map((s) => [s.role, s.repeat ?? 1])).toEqual([['work', 3], ['rest', 1], ['work', 3]])
    expect(split[1]!.durationSec).toBe(240)
    const strides = runningSteps(w('easy', [{ type: 'easy', distanceKm: 8, pace: easyPace, strides: { count: 6, meters: 80 }, description: '' }]), 3600)
    expect(strides[1]).toMatchObject({ repeat: 6, distanceM: 80, restSec: 60, target: { kind: 'open' } })
    const hills = runningSteps(w('easy_hills', [{ type: 'hills', reps: 8, repM: 150, distanceKm: 2.4, description: '' }]), 1500)
    expect(hills[0]!.recovery).toMatchObject({ distanceM: 150 })
    const progression = runningSteps(w('quality_continuous', [{ type: 'progression', distanceKm: 6, pace: { loSecPerKm: 272, hiSecPerKm: 301 }, description: '' }]), 1800)
    expect(progression.map((s) => (s.target.kind === 'pace' ? s.target.seconds : 0))).toEqual([301, 287, 272])
    const alternating = runningSteps(w('quality_continuous', [{ type: 'alternating', distanceKm: 4, pace: { loSecPerKm: 265, hiSecPerKm: 305 }, description: '' }]), 1200)
    expect(alternating[0]).toMatchObject({ repeat: 2, distanceM: 1000, target: { seconds: 265 }, recovery: { distanceM: 1000, target: { seconds: 305 } } })
  })

  it('start: jeden krok bez celu tempa na dystansie startu; czas sesji z prognozy', () => {
    const steps = runningSteps(w('race', [{ type: 'race', distanceKm: 21.0975, description: '' }], { distanceKm: 0, raceDistanceKm: 21.0975 }), 6000)
    expect(steps).toHaveLength(1)
    expect(steps[0]).toMatchObject({ distanceM: 21097.5, target: { kind: 'open' }, durationSec: 6000 })
  })
})
