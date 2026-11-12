/**
 * PLAN-v0.7 E1: kroki v2 z segmentów biegu planu biegowego. Karty i eksporty (FIT,
 * intervals.icu) czytają kroki, więc nie potrzebują `legacyWorkout`; silnik biegowy
 * (regeneracja, skracanie, adaptacja) dalej pracuje na segmentach.
 *
 * Cel tempa to zakres (`seconds` szybsza granica, `slowSeconds` wolniejsza), jak w planie.
 * Czas kroku liczony jak `estimateWorkoutMinutes` (wolniejsza granica, bez tempa 6:00/km),
 * a różnica do czasu sesji (zaokrąglenie do minuty, start) trafia do najdłuższego kroku.
 */
import type { PaceRange, PlannedSegment, PlannedWorkout } from '../domain/types.ts'
import { messages } from '../i18n/index.ts'
import { splitsSeries, STRIDE_RECOVERY_SEC, STRIDE_SEC_PER_M } from '../engine/duration.ts'
import type { EffortGuide, SessionStep, StepTarget } from './types.ts'

/** Tempo bez celu w szacunku czasu — to samo 6:00/km co `estimateWorkoutMinutes`. */
const DEFAULT_SEC_PER_KM = 360
/** Zbieg po podbiegu i trucht przerwy: wolniej niż spokojnie (E-3, inż., jak eksport FIT). */
const RECOVERY_SEC_PER_KM = 420

const paceTarget = (pace: PaceRange | undefined): StepTarget =>
  !pace ? { kind: 'open' }
    : pace.loSecPerKm === pace.hiSecPerKm ? { kind: 'pace', seconds: pace.loSecPerKm, perM: 1000 }
      : { kind: 'pace', seconds: pace.loSecPerKm, slowSeconds: pace.hiSecPerKm, perM: 1000 }
const single = (secPerKm: number): StepTarget => ({ kind: 'pace', seconds: secPerKm, perM: 1000 })
const kmOf = (s: PlannedSegment): number => s.distanceKm ?? ((s.reps ?? 0) * (s.repM ?? 0)) / 1000

function segmentSteps(s: PlannedSegment, workout: PlannedWorkout, effort: EffortGuide | undefined): SessionStep[] {
  const f = messages().fitStep
  const t = messages().notation
  const timeAt = (km: number, pace: PaceRange | undefined) => Math.round(km * (pace?.hiSecPerKm ?? DEFAULT_SEC_PER_KM))
  switch (s.type) {
    case 'warmup':
      return [{ role: 'warmup', name: f.warmup, distanceM: kmOf(s) * 1000, durationSec: timeAt(kmOf(s), s.pace), target: paceTarget(s.pace) }]
    case 'cooldown':
      return [{ role: 'cooldown', name: f.cooldown, distanceM: kmOf(s) * 1000, durationSec: timeAt(kmOf(s), s.pace), target: paceTarget(s.pace) }]
    case 'easy':
    case 'steady': {
      const main: SessionStep = {
        role: 'work', name: s.type === 'easy' ? f.easy : f.steady, distanceM: kmOf(s) * 1000,
        durationSec: timeAt(kmOf(s), s.pace), target: paceTarget(s.pace), ...(effort ? { effort } : {}),
      }
      if (s.type !== 'easy' || !s.strides) return [main]
      // przebieżki (J-6): odcinek bez celu tempa i minuta powrotu, jak w FIT planu biegowego
      return [main, {
        role: 'work', name: f.stride, repeat: s.strides.count, distanceM: s.strides.meters,
        durationSec: Math.round(s.strides.meters * STRIDE_SEC_PER_M), target: { kind: 'open' },
        restSec: STRIDE_RECOVERY_SEC, recovery: { target: { kind: 'open' }, instruction: f.recovery },
      }]
    }
    case 'intervals': {
      const repKm = (s.repM ?? 0) / 1000
      const block = (reps: number): SessionStep => ({
        role: 'work', name: f.rep, repeat: reps, ...(s.repM ? { distanceM: s.repM } : {}),
        durationSec: s.repM ? timeAt(repKm, s.pace) : 180, target: paceTarget(s.pace), ...(effort ? { effort } : {}),
        ...(s.recoverySec ? { restSec: s.recoverySec, recovery: { target: { kind: 'open' }, instruction: s.recoveryMode ? t[s.recoveryMode] : f.recovery } } : {}),
      })
      // przerwa w połowie serii (C1): dwie serie i krok przerwy między nimi, jak na zegarku
      if (splitsSeries(s)) {
        return [block(s.setBreak.afterRep), { role: 'rest', name: f[s.setBreak.mode], durationSec: s.setBreak.sec, target: { kind: 'open' } },
          block((s.reps ?? 1) - s.setBreak.afterRep)]
      }
      return [block(s.reps ?? 1)]
    }
    case 'hills': {
      // podbiegi bez celu tempa (ADR-010); przerwą jest zbieg na tym samym dystansie
      const repKm = (s.repM ?? 200) / 1000
      return [{
        role: 'work', name: f.hillRep, repeat: s.reps ?? 1, distanceM: repKm * 1000, durationSec: timeAt(repKm, undefined),
        target: { kind: 'open' }, ...(effort ? { effort } : {}),
        restSec: Math.round(repKm * RECOVERY_SEC_PER_KM), recovery: { target: { kind: 'open' }, instruction: f.hillDown, distanceM: repKm * 1000 },
      }]
    }
    case 'progression': {
      // trzy tercje od wolniejszego do szybszego końca, jak w FIT planu biegowego
      const total = kmOf(s)
      if (!s.pace || total < 3) return [{ role: 'work', name: f.progression, distanceM: total * 1000, durationSec: timeAt(total, s.pace), target: paceTarget(s.pace), ...(effort ? { effort } : {}) }]
      const third = Math.round((total / 3) * 10) / 10
      const from = s.pace.hiSecPerKm
      const to = s.pace.loSecPerKm
      return [0, 1, 2].map((i): SessionStep => {
        const km = i === 2 ? Math.round((total - 2 * third) * 1000) / 1000 : third
        const pace = Math.round(from + ((to - from) * i) / 2)
        return { role: 'work', name: f.progressionPart(i + 1, 3), distanceM: km * 1000, durationSec: Math.round(km * pace), target: single(pace), ...(effort ? { effort } : {}) }
      })
    }
    case 'alternating': {
      // naprzemiennie 1 km szybko i 1 km spokojnie; reszta dystansu na końcu
      const total = kmOf(s)
      const pairs = Math.floor(total / 2)
      if (!s.pace || pairs < 1) return [{ role: 'work', name: f.alternating, distanceM: total * 1000, durationSec: timeAt(total, s.pace), target: paceTarget(s.pace), ...(effort ? { effort } : {}) }]
      const fast = s.pace.loSecPerKm
      const slow = s.pace.hiSecPerKm
      const rest = Math.round((total - 2 * pairs) * 1000) / 1000
      return [
        { role: 'work', name: f.faster, repeat: pairs, distanceM: 1000, durationSec: fast, target: single(fast), ...(effort ? { effort } : {}),
          restSec: slow, recovery: { target: single(slow), instruction: f.slower, distanceM: 1000 } },
        ...(rest > 0 ? [{ role: 'work' as const, name: f.faster, distanceM: Math.min(1, rest) * 1000, durationSec: Math.round(Math.min(1, rest) * fast), target: single(fast) }] : []),
        ...(rest > 1 ? [{ role: 'work' as const, name: f.slower, distanceM: (rest - 1) * 1000, durationSec: Math.round((rest - 1) * slow), target: single(slow) }] : []),
      ]
    }
    case 'race':
      // start i sprawdzian bez celu tempa (ADR-020): zegarek mierzy, nie prowadzi
      return [{ role: 'work', name: workout.kind === 'race' ? t.race : f.timed, distanceM: (workout.raceDistanceKm ?? kmOf(s)) * 1000, durationSec: timeAt(workout.raceDistanceKm ?? kmOf(s), undefined), target: { kind: 'open' }, ...(effort ? { effort } : {}) }]
  }
}

const stepTotal = (s: SessionStep): number => (s.repeat ?? 1) * (s.durationSec + (s.restSec ?? 0))

/**
 * Kroki jednostki planu biegowego, których łączny czas równa się czasowi sesji (`totalSec`).
 * Wysiłek (RPE, MS-6) trafia do kroków pracy; rozgrzewka i schłodzenie go nie niosą.
 */
export function runningSteps(workout: PlannedWorkout, totalSec: number, effort?: EffortGuide): SessionStep[] {
  const steps = workout.segments.flatMap((s) => segmentSteps(s, workout, effort))
  if (!steps.length) return [{ role: 'work', durationSec: totalSec, target: { kind: 'open' }, ...(effort ? { effort } : {}) }]
  // różnica do czasu sesji (zaokrąglenie do minuty albo czas startu z prognozy) idzie do
  // najdłuższego kroku bez powtórzeń; kroki z powtórzeniami trzymają dawkę odcinka
  const diff = totalSec - steps.reduce((n, s) => n + stepTotal(s), 0)
  // przerwa (np. 4' marszu w połowie serii) jest przepisana co do sekundy — wyrównanie jej nie rusza
  const movable = steps.filter((s) => s.role !== 'rest')
  const single = movable.filter((s) => (s.repeat ?? 1) === 1)
  const target = (single.length ? single : movable.length ? movable : steps).reduce((a, b) => (stepTotal(b) > stepTotal(a) ? b : a))
  const per = (target.repeat ?? 1)
  target.durationSec = Math.max(1, target.durationSec + Math.round(diff / per))
  return steps
}
