import { diffDays, vdotFromRace, type RaceResult } from 'trainctl-core'

export const resultKey = (r: RaceResult): string =>
  JSON.stringify([r.date, r.distanceKm, r.timeSec, r.excluded === true, r.exclusionReason ?? '', r.terrain ?? 'road'])

export interface Calibration {
  evaluatedAt: string
  policy: 'best-vdot-540-days'
  results: RaceResult[]
  selected?: RaceResult
  candidates: { result: RaceResult; ageDays: number; vdot: number; reason: 'selected' | 'lower-vdot' | 'excluded' | 'future' | 'stale' }[]
}

export function inspectCalibration(results: RaceResult[], today: string): Calibration {
  const candidates: Calibration['candidates'] = results.map((result) => {
    const ageDays = diffDays(result.date, today)
    return {
      result: { ...result }, ageDays, vdot: vdotFromRace(result.distanceKm, result.timeSec),
      reason: result.excluded ? 'excluded' : ageDays < 0 ? 'future' : ageDays > 540 ? 'stale' : 'lower-vdot',
    }
  })
  const selected = candidates.filter((c) => c.reason === 'lower-vdot').sort((a, b) => b.vdot - a.vdot || a.ageDays - b.ageDays)[0]
  if (selected) selected.reason = 'selected'
  return { evaluatedAt: today, policy: 'best-vdot-540-days', results: structuredClone(results), candidates, ...(selected ? { selected: selected.result } : {}) }
}
