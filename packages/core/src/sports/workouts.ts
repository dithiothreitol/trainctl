import { diffDays } from '../util/dates.ts'
import { paceZones, vdotFromRace } from '../zones/daniels.ts'
import { sportMessages as msg } from './messages.ts'
import type { EnduranceSport, SessionPurpose, SessionStep, SportProfile, TrainingSession } from './types.ts'
const finite = (v: number, lo: number, hi: number): boolean => Number.isFinite(v) && v >= lo && v <= hi

export const stepSeconds = (s: SessionStep): number => (s.repeat ?? 1) * (s.sendoffSec ?? s.durationSec + (s.restSec ?? 0))
export const sessionTotals = (steps: SessionStep[]): { durationSec: number; distanceM?: number } => {
  const distanceM = steps.reduce((n, s) => n + (s.distanceM ?? 0) * (s.repeat ?? 1), 0)
  return { durationSec: steps.reduce((n, s) => n + stepSeconds(s), 0), ...(distanceM ? { distanceM } : {}) }
}
/** MS-1: proporcje szablonów są jawnymi wyborami inżynierskimi, bez ekwiwalentu między sportami. */
export function buildSportSession(sport: EnduranceSport, profile: SportProfile, minutes: number, id: string, date: string, purpose: SessionPurpose = 'easy', asOf = date): TrainingSession {
  if (!finite(minutes, 5, 1440)) throw new Error(msg().noFit)
  if (sport === 'run' && !profile.easyPaceSecPerKm) {
    const result = profile.results?.filter(r => !r.excluded && r.terrain !== 'trail' && r.date <= asOf && diffDays(r.date, asOf) <= 540).sort((a,b) => b.date.localeCompare(a.date))[0]
    if (result) {
      const zone = paceZones(vdotFromRace(result.distanceKm, result.timeSec)).easy
      profile = { ...profile, easyPaceSecPerKm: Math.round((zone.loSecPerKm + zone.hiSecPerKm) / 2), calibration: {date:result.date,source:`VDOT ${result.distanceKm}km/${result.timeSec}s`} }
    }
  }
  if (profile.calibration && (diffDays(profile.calibration.date, asOf) < 0 || diffDays(profile.calibration.date, asOf) > 180) && sport !== 'run') {
    profile = { ...profile }; delete profile.ftpWatts; delete profile.cssSecPer100m
  }
  if (sport === 'bike' && profile.resources && !profile.resources.includes('powerMeter')) { profile = {...profile}; delete profile.ftpWatts }
  const seconds = Math.floor(Math.min(minutes, profile.maxSessionMinutes ?? minutes) * 60)
  const pace = sport === 'run' ? profile.easyPaceSecPerKm : sport === 'swim' && profile.cssSecPer100m ? profile.cssSecPer100m + (purpose === 'intervals' || purpose === 'race' ? 0 : 12) : undefined
  const target: SessionStep['target'] = sport === 'bike' && profile.ftpWatts
    ? { kind: 'power', watts: Math.round(profile.ftpWatts * 0.65), ftpPercent: 65 }
    : pace ? { kind: 'pace', seconds: pace, perM: sport === 'swim' ? 100 : 1000 } : { kind: 'open' }
  let steps: SessionStep[]
  if (sport === 'swim' && pace && purpose !== 'race') {
    const pool = profile.poolLengthM ?? 25
    const repM = pool * (purpose === 'technique' ? 2 : purpose === 'long' ? 8 : 4)
    const repSec = Math.ceil(pace * repM / 100)
    const restSec = 20 // MS-1: jawny domyślny odpoczynek, nie próg fizjologiczny.
    const repeat = Math.floor(seconds / (repSec + restSec))
    if (repeat < 1) throw new Error(msg().noFit)
    steps = [{ role: purpose === 'technique' ? 'drill' : 'work', distanceM: repM, durationSec: repSec, repeat, restSec, target: purpose === 'technique' ? {kind:'open'} : target, stroke: purpose === 'technique' ? 'drill' : 'freestyle' }]
  } else if (purpose === 'intervals' && seconds >= 1200 && target.kind !== 'open') {
    const warmup = 300, cooldown = 300, recovery = 60, reps = 4
    const work = Math.floor((seconds - warmup - cooldown) / reps) - recovery
    const runningResult = sport === 'run' ? profile.results?.filter(r => !r.excluded && r.terrain !== 'trail' && r.date <= asOf && diffDays(r.date, asOf) <= 540).sort((a,b) => b.date.localeCompare(a.date))[0] : undefined
    const threshold = runningResult ? paceZones(vdotFromRace(runningResult.distanceKm, runningResult.timeSec)).lt2SecPerKm : undefined
    const intense: SessionStep['target'] = target.kind === 'power'
      ? { kind: 'power', watts: Math.round(profile.ftpWatts! * 0.9), ftpPercent: 90 }
      : target.kind === 'pace' && threshold ? { ...target, seconds: threshold } : {kind:'open'}
    steps = [{ role: 'warmup', durationSec: warmup, target }, { role: 'work', durationSec: work, repeat: reps, restSec: recovery, target: intense }, { role: 'cooldown', durationSec: cooldown, target }]
  } else {
    steps = [{ role: purpose === 'technique' ? 'drill' : 'work', durationSec: seconds, target }]
  }
  return { id, date, sport, purpose, steps, ...sessionTotals(steps), preparationSec: (profile.preparationMinutes ?? 10) * 60,
    ...(sport === 'swim' ? { poolLengthM: profile.poolLengthM ?? 25 } : {}), ...(profile.calibration ? { calibration: profile.calibration } : {}), ruleRefs: ['MS-1'] }
}
