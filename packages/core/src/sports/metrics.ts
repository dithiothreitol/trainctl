import { ENDURANCE_SPORTS, type TrainingSession } from './types.ts'
import { stepSeconds } from './workouts.ts'

/** Prescribed roles, not measured physiological zones. Missing targets stay unknown. */
export function intensityMinutes(session: TrainingSession) {
  const seconds = { easy: 0, quality: 0, race: 0, recovery: 0, technique: 0, unknown: 0 }
  if (session.purpose === 'race') seconds.race = session.durationSec
  else if (session.legacyWorkout) {
    for (const segment of session.legacyWorkout.segments) {
      const km = segment.type === 'hills' ? 2 * (segment.reps ?? 1) * (segment.repM ?? 200) / 1000 : segment.distanceKm ?? (segment.reps ?? 0) * (segment.repM ?? 0) / 1000
      const work = km * (segment.pace?.hiSecPerKm ?? 360)
      // Hills include the return descent; mixed segments lack a time split.
      const kind = ['warmup','easy','cooldown'].includes(segment.type) ? 'easy' : segment.type === 'intervals' && segment.pace ? 'quality' : 'unknown'
      seconds[kind] += work
      seconds.recovery += (segment.reps ?? 1) * (segment.recoverySec ?? 0)
    }
    seconds.unknown += Math.max(0, session.durationSec - Object.values(seconds).reduce((a,b)=>a+b,0))
  } else for (const step of session.steps) {
    const work = step.durationSec * (step.repeat ?? 1)
    seconds.recovery += stepSeconds(step) - work
    const kind = step.role === 'rest' ? 'recovery' : step.role === 'warmup' || step.role === 'cooldown' ? 'easy'
      : step.role === 'drill' || session.purpose === 'technique' ? 'technique'
      : session.purpose === 'intervals' ? (step.target.kind === 'open' ? 'unknown' : 'quality')
      : ['easy','long'].includes(session.purpose) ? 'easy' : 'unknown'
    seconds[kind] += work
  }
  const total = Object.values(seconds).reduce((a,b)=>a+b,0)
  // Imported segment estimates may differ from the saved, rounded session duration.
  const scale = total > session.durationSec ? session.durationSec / total : 1
  return Object.fromEntries(Object.entries(seconds).map(([kind,value])=>[kind,value * scale / 60])) as Record<keyof typeof seconds,number>
}

export function sportsTotals(sessions: TrainingSession[]) {
  return Object.fromEntries([...ENDURANCE_SPORTS, 'strength' as const].map(sport => {
    const list = sessions.filter(s => s.sport === sport)
    const intensity = { easy: 0, quality: 0, race: 0, recovery: 0, technique: 0, unknown: 0 }
    for (const session of list) {
      const minutes = intensityMinutes(session)
      for (const key of Object.keys(intensity) as (keyof typeof intensity)[]) intensity[key] += minutes[key]
    }
    const minutes = list.reduce((n,s)=>n+s.durationSec/60,0)
    const intensityPercent = Object.fromEntries(Object.entries(intensity).map(([key,value])=>[key,minutes ? value/minutes*100 : 0])) as typeof intensity
    return [sport, { sessions: list.length, minutes, distanceM: list.reduce((n,s)=>n+(s.distanceM??0),0), intensityMinutes: intensity, intensityPercent, intensityMethod: 'prescribed-step-role-v1' as const }]
  }))
}
