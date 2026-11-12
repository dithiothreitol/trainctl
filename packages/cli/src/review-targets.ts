/**
 * PLAN-v0.7 D2, D3: wiersze „Wobec celu" w `review` — odcinki akcentu z okrążeń
 * i średnie tempo biegu spokojnego wobec zakresu. Fakty, bez oceny i bez zmian
 * w planie (ADR-011, ADR-027). Tempo w jednostce widoku (C9).
 */
import { accentLine, distanceUnit, messages, paceClock, plannedReps, type ExecutionRecord, type PaceRange, type PlannedWorkout } from 'trainctl-core'
import { ui } from './i18n/index.ts'

const rangeText = (range: PaceRange, ascii: boolean): string =>
  `${paceClock(range.loSecPerKm)}${ascii ? '-' : '–'}${paceClock(range.hiSecPerKm)}/${distanceUnit()}`

/** Cel odcinków, gdy wszystkie powtórzenia mają ten sam zakres (inaczej zakresu nie podajemy). */
function commonTarget(workout: PlannedWorkout): PaceRange | undefined {
  const ranges = plannedReps(workout).map((r) => r.pace)
  const first = ranges[0]
  return first && ranges.every((r) => r?.loSecPerKm === first.loSecPerKm && r.hiSecPerKm === first.hiSecPerKm) ? first : undefined
}

/** Zdania „Wobec celu" dla dni okna przeglądu, w kolejności dat. */
export function targetLines(execution: ExecutionRecord[], workouts: Map<string, PlannedWorkout>, ascii: boolean): string[] {
  const t = ui().review
  return execution.flatMap((e): string[] => {
    const workout = workouts.get(e.date)
    if (!workout) return []
    if (e.intervals) {
      const plan = accentLine(workout, { ascii })
      const iv = e.intervals
      if (iv.reason === 'no-laps') return [t.repsNoLaps(e.date, plan)]
      if (iv.reason === 'no-match') return [t.repsNoMatch(e.date, plan)]
      const target = commonTarget(workout)
      const paces = `${iv.matched.map((r) => paceClock(r.paceSecPerKm)).join(', ')}/${distanceUnit()}`
      const inRange = target ? t.repsInRange(iv.inRange, rangeText(target, ascii)) : undefined
      return [t.reps(e.date, plan, iv.matched.length, iv.planned, inRange, paces, iv.extra)]
    }
    if (e.easyPace) {
      const kind = (messages().kind as Record<string, string>)[workout.kind] ?? workout.kind
      const pace = `${paceClock(e.easyPace.paceSecPerKm)}/${distanceUnit()}`
      return [t.easyPace(e.date, kind, pace, rangeText(e.easyPace.range, ascii), e.easyPace.vsRange)]
    }
    return []
  })
}
