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
 * Ten sam wybrany wynik — jedna definicja dla regeneracji i podpowiedzi `why`:
 * data, dystans, czas, teren i wykluczenie (resultKey), bez nazwy. Zmiana terenu
 * nie zmienia stref, ale zmienia ostrzeżenie Z-10 w planie, więc plan trzeba zapisać.
 */
export const sameSelection = (a: RaceResult | undefined, b: RaceResult | undefined): boolean =>
  a === undefined || b === undefined ? a === b : resultKey(a) === resultKey(b)

/**
 * Co zrobiłby dziś `trainctl plan` z kalibracją stref. Regeneracja kalibruje z datą
 * dnia regeneracji, więc liczymy dokładnie to samo: `inspectCalibration` na wynikach
 * z dzisiejszego trainctl.yaml. `changed` — strefy przyszłych dni powstałyby z innego
 * wyniku albo bez wyniku. Opisy zapisanych wyników w `why` zostają decyzjami z dnia
 * kalibracji; ta jedna odpowiedź mówi, co się od tego czasu zmieniło.
 */
export function recalibrationToday(stored: Calibration, results: RaceResult[], today: string, goal: GoalForZones):
  { selected: RaceResult | null; source: ZoneSource; changed: boolean } {
  const selected = inspectCalibration(results, today, isRoadGoal(goal)).selected ?? null
  return { selected, source: zoneSource(selected ?? undefined, goal), changed: !sameSelection(selected ?? undefined, stored.selected) }
}

type GoalForZones = { kind?: string | undefined; terrain?: string | undefined; targetTimeSec?: number | undefined }
export type ZoneSource = 'result' | 'goal-target' | 'none'

/**
 * Skąd plan weźmie strefy: z wybranego wyniku, z czasu docelowego (cel ze startem
 * i `targetTimeSec`) albo znikąd — wtedy `trainctl plan` zatrzymuje się błędem.
 * Jedna reguła dla computePlan i podpowiedzi `why`.
 */
export function zoneSource(selected: RaceResult | undefined, goal: GoalForZones): ZoneSource {
  if (selected) return 'result'
  return goal.targetTimeSec && goal.kind !== 'base' ? 'goal-target' : 'none'
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
