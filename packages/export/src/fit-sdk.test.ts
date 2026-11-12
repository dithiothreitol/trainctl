import { Decoder, Stream } from '@garmin/fitsdk'
import { describe, expect, it } from 'vitest'
import { buildSportSession, runningSteps, sessionTotals, type PlannedWorkout, type SessionStep, type TrainingSession } from 'trainctl-core'
import { encodeSessionFit, encodeWorkoutFit } from './fit.ts'

const session = (sport: TrainingSession['sport'], steps: SessionStep[], poolLengthM?: number): TrainingSession => ({
  id: 'sdk-check', date: '2026-11-03', sport, purpose: 'intervals', preparationSec: 600,
  steps, ...sessionTotals(steps), ruleRefs: [], ...(poolLengthM ? { poolLengthM } : {}),
})
function decode(bytes: Uint8Array) {
  const decoder = new Decoder(Stream.fromByteArray(bytes))
  expect(decoder.isFIT()).toBe(true)
  expect(decoder.checkIntegrity()).toBe(true)
  const result = decoder.read()
  expect(result.errors).toEqual([])
  expect(result.messages.fileIdMesgs?.[0]?.type).toBe('workout')
  expect(result.messages.workoutMesgs?.[0]?.numValidSteps).toBe(result.messages.workoutStepMesgs?.length)
  result.messages.workoutStepMesgs?.forEach((step, i) => expect(step.messageIndex).toBe(i))
  return result.messages
}

describe('FIT interoperability with the official Garmin SDK', () => {
  it('retains coaching notes, subjective effort and measured recovery targets',()=>{
    const bike=buildSportSession('bike',{weeklyMinutes:180,sessionsPerWeek:3,ftpWatts:250,calibration:{date:'2026-11-01',source:'test'}},60,'b','2026-11-02','intervals')
    const messages=decode(encodeSessionFit(bike,'Bike coaching'))
    const steps=messages.workoutStepMesgs!
    expect(steps[0]!.wktStepName).toContain('RPE')
    expect(steps[0]!.notes).toContain('RPE')
    expect(steps.find(s=>s.intensity==='rest')).toMatchObject({targetType:'power',customTargetPowerLow:1125,customTargetPowerHigh:1125,durationTime:180})
    expect(steps.find(s=>s.intensity==='rest')!.notes).toBeTruthy()
    const swim=buildSportSession('swim',{weeklyMinutes:120,sessionsPerWeek:3},30,'s','2026-11-02','technique')
    const uncalibrated=decode(encodeSessionFit(swim,'Pool coaching')).workoutStepMesgs!
    expect(uncalibrated.some(s=>String(s.notes).includes('RPE'))).toBe(true)
    expect(uncalibrated.find(s=>s.targetStrokeType==='drill')!.notes).toBeTruthy()
    expect(uncalibrated.every(s=>!String(s.notes).includes('�'))).toBe(true)
  })
  it('decodes running distance, speed, recovery and loop boundaries in physical units', () => {
    const workout = session('run', [
      { role: 'warmup', durationSec: 300, target: { kind: 'open' } },
      { role: 'work', durationSec: 300, distanceM: 1000, repeat: 4, restSec: 90, target: { kind: 'pace', seconds: 300, perM: 1000 } },
      { role: 'cooldown', durationSec: 180, target: { kind: 'open' } },
    ])
    const messages = decode(encodeSessionFit(workout, 'Running'))
    expect(messages.workoutMesgs![0]!.sport).toBe('running')
    expect(messages.workoutStepMesgs).toMatchObject([
      { durationTime: 300, intensity: 'warmup' },
      { durationDistance: 1000, targetType: 'speed', customTargetSpeedLow: 3.333, customTargetSpeedHigh: 3.333 },
      { durationTime: 90, intensity: 'rest', targetType: 'open' },
      { durationType: 'repeatUntilStepsCmplt', durationStep: 1, repeatSteps: 4 },
      { durationTime: 180, intensity: 'cooldown' },
    ])
  })

  it('decodes a trainer workout without distance and preserves absolute power', () => {
    const workout = session('bike', [{ role: 'work', durationSec: 240, repeat: 5, restSec: 60, target: { kind: 'power', watts: 220 } }])
    const messages = decode(encodeSessionFit(workout, 'Trainer'))
    expect(messages.workoutMesgs![0]!.sport).toBe('cycling')
    expect(messages.workoutStepMesgs).toMatchObject([
      { durationTime: 240, targetType: 'power', targetPowerZone: 0, customTargetPowerLow: 1220, customTargetPowerHigh: 1220 },
      { durationTime: 60, intensity: 'rest' },
      { durationStep: 0, repeatSteps: 5 },
    ])
    expect(messages.workoutStepMesgs![0]!.durationDistance).toBeUndefined()
  })

  it.each([25, 50])('decodes pool length %i m, metres, stroke and complete repeats', poolLength => {
    const workout = session('swim', [{ role: 'work', durationSec: 120, distanceM: 100, repeat: 4, restSec: 20, stroke: 'freestyle', target: { kind: 'pace', seconds: 120, perM: 100 } }], poolLength)
    const messages = decode(encodeSessionFit(workout, 'Pool'))
    expect(messages.workoutMesgs![0]).toMatchObject({ sport: 'swimming', poolLength, poolLengthUnit: 'metric' })
    expect(messages.workoutStepMesgs).toMatchObject([
      { durationDistance: 100, targetType: 'swimStroke', targetStrokeType: 'freestyle' },
      { durationTime: 20, intensity: 'rest' },
      { durationStep: 0, repeatSteps: 4 },
    ])
    // Stroke is the executable target; CSS remains in the readable step name.
    expect(messages.workoutStepMesgs![0]!.wktStepName).toContain('120s/100m')
    expect(messages.workoutStepMesgs![0]!.customTargetSpeedLow).toBeUndefined()
  })

  it.each(['freestyle', 'backstroke', 'breaststroke', 'butterfly', 'drill'] as const)('decodes swimming stroke %s', stroke => {
    const messages = decode(encodeSessionFit(session('swim', [{ role: 'work', durationSec: 120, distanceM: 100, stroke, target: { kind: 'open' } }], 25), 'Stroke'))
    expect(messages.workoutStepMesgs![0]!.targetStrokeType).toBe(stroke)
  })

  it.each(['run', 'bike', 'swim'] as const)('keeps an uncalibrated %s workout time-based and open', sport => {
    const messages = decode(encodeSessionFit(session(sport, [{ role: 'work', durationSec: 600, target: { kind: 'open' } }]), 'Open'))
    expect(messages.workoutStepMesgs![0]).toMatchObject({ durationTime: 600, targetType: 'open' })
    expect(messages.workoutStepMesgs![0]!.durationDistance).toBeUndefined()
  })

  it('preserves the legacy running prescription after migration (E1: z kroków, bez legacyWorkout)', () => {
    const legacy: PlannedWorkout = { kind: 'quality_intervals', distanceKm: 5, ruleRefs: [], segments: [
      { type: 'warmup', distanceKm: 1, description: '' },
      { type: 'intervals', reps: 3, repM: 1000, recoverySec: 120, pace: { loSecPerKm: 295, hiSecPerKm: 305 }, description: '' },
      { type: 'cooldown', distanceKm: 1, description: '' },
    ] }
    // kroki jak po migracji; `legacyWorkout` zostaje w danych, ale eksport go nie czyta
    const migrated = { ...session('run', runningSteps(legacy, 1800)), legacyWorkout: legacy }
    const before = decode(encodeWorkoutFit(legacy, 'Legacy')).workoutStepMesgs!
    const after = decode(encodeSessionFit(migrated, 'Legacy')).workoutStepMesgs!
    const dose = (s: (typeof before)[number]) => ({ durationType: s.durationType, durationDistance: s.durationDistance, durationTime: s.durationTime, durationStep: s.durationStep, repeatSteps: s.repeatSteps, intensity: s.intensity })
    expect(after.map(dose)).toEqual(before.map(dose))
    // ten sam zakres tempa odcinka na zegarku
    expect(after[1]).toMatchObject({ customTargetSpeedLow: before[1]!.customTargetSpeedLow, customTargetSpeedHigh: before[1]!.customTargetSpeedHigh })
    expect(after[3]).toMatchObject({ durationStep: 1, repeatSteps: 3 })
  })

  it.each([2, 3])('writes a %i km alternating run with one pair as plain steps, without a one-pass loop', km => {
    const workout: PlannedWorkout = { kind: 'quality_continuous', distanceKm: km, ruleRefs: [], segments: [
      { type: 'alternating', distanceKm: km, pace: { loSecPerKm: 250, hiSecPerKm: 310 }, description: '' },
    ] }
    const steps = decode(encodeWorkoutFit(workout, 'Alternating')).workoutStepMesgs!
    expect(steps.some(s => s.durationType === 'repeatUntilStepsCmplt')).toBe(false)
    expect(steps.map(s => s.durationDistance)).toEqual(km === 2 ? [1000, 1000] : [1000, 1000, 1000])
  })

  it.each([
    ['a'.repeat(29) + 'ąą', 'a'.repeat(29) + 'ą'],
    ['a'.repeat(28) + '🚴', 'a'.repeat(28)],
    ['泳'.repeat(12), '泳'.repeat(10)],
    ['a'.repeat(64), 'a'.repeat(31)],
  ])('truncates workout names at UTF-8 boundaries and reserves the terminator (%s)', (name, expected) => {
    const bytes = encodeSessionFit(session('run', [{ role: 'work', durationSec: 600, target: { kind: 'open' } }]), name)
    const stream = Stream.fromByteArray(bytes), decoder = new Decoder(stream)
    expect(decoder.checkIntegrity()).toBe(true)
    let nameTerminator: number | undefined
    const { messages, errors } = decoder.read({ mesgListener: number => { if (number === 26) nameTerminator = bytes[stream.position - 1] } })
    expect(errors).toEqual([])
    expect(messages.workoutMesgs![0]!.wktName).toBe(expected)
    expect(nameTerminator).toBe(0)
  })

  it.each(['corrupted', 'truncated'])('rejects a %s file using the SDK integrity check', problem => {
    let bytes = encodeSessionFit(session('bike', [{ role: 'work', durationSec: 600, target: { kind: 'open' } }]), 'Integrity')
    if (problem === 'corrupted') bytes[100] = bytes[100]! ^ 1
    else bytes = bytes.slice(0, -1)
    expect(new Decoder(Stream.fromByteArray(bytes)).checkIntegrity()).toBe(false)
  })
})
