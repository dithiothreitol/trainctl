import { diffDays, vdotFromRace, type RaceResult } from 'trainctl-core'

export const resultKey = (r: RaceResult): string =>
  JSON.stringify([r.date, r.distanceKm, r.timeSec, r.excluded === true, r.exclusionReason ?? '', r.terrain ?? 'road'])

export interface Calibration {
  evaluatedAt: string
  policy: 'best-vdot-540-days'
  results: RaceResult[]
  selected?: RaceResult
  candidates: { result: RaceResult; ageDays: number; vdot: number; reason: 'selected' | 'lower-vdot' | 'excluded' | 'future' | 'stale' | 'terrain' }[]
}

/** Z-10: cel szosowy (bez `terrain` albo `road`) — tylko wtedy trail ustępuje szosie. */
export const isRoadGoal = (goal: { terrain?: string | undefined }): boolean => goal.terrain !== 'trail' && goal.terrain !== 'ultra'

/**
 * Opis wyniku w `why`: decyzja (użyty do stref) pochodzi z dnia kalibracji, a stan
 * wyniku — z dziś, policzony tą samą funkcją co przy generowaniu planu. Dzięki temu
 * etykieta nie przeczy wiekowi, a reguły okna 540 dni i Z-10 żyją w jednym miejscu.
 */
export function calibrationLabel(stored: Calibration['candidates'][number], today: Calibration['candidates'][number] | undefined):
  Calibration['candidates'][number]['reason'] | 'selectedStale' | 'newer' {
  const now = today?.reason ?? stored.reason
  if (stored.reason === 'selected') return now === 'stale' ? 'selectedStale' : 'selected'
  if (now === 'stale' || now === 'terrain' || now === 'excluded') return now
  if (stored.reason === 'future' && (now === 'selected' || now === 'lower-vdot')) return 'newer'
  return stored.reason
}

export function inspectCalibration(results: RaceResult[], today: string, roadGoal = true): Calibration {
  const candidates: Calibration['candidates'] = results.map((result) => {
    const ageDays = diffDays(result.date, today)
    return {
      result: { ...result }, ageDays, vdot: vdotFromRace(result.distanceKm, result.timeSec),
      reason: result.excluded ? 'excluded' : ageDays < 0 ? 'future' : ageDays > 540 ? 'stale' : 'lower-vdot',
    }
  })
  // Z-10: trail odpada, gdy jest wynik szosowy (ta sama reguła co w computePlan)
  if (roadGoal && candidates.some((c) => c.reason === 'lower-vdot' && c.result.terrain !== 'trail')) {
    for (const c of candidates) if (c.reason === 'lower-vdot' && c.result.terrain === 'trail') c.reason = 'terrain'
  }
  const selected = candidates.filter((c) => c.reason === 'lower-vdot').sort((a, b) => b.vdot - a.vdot || a.ageDays - b.ageDays)[0]
  if (selected) selected.reason = 'selected'
  return { evaluatedAt: today, policy: 'best-vdot-540-days', results: structuredClone(results), candidates, ...(selected ? { selected: selected.result } : {}) }
}
