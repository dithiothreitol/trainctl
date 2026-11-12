/**
 * PLAN-v0.7 C1: notacja jednostki generowana ze struktury — jeden wiersz w stylu
 * planów klubowych (`RG 3 km · 4×1 km @4:32 p. 2' marsz · SCH 1 km`), wspólny dla
 * jednostki planu biegowego (`PlannedWorkout`, segmenty) i sesji planu v2 (kroki).
 *
 * Czysta funkcja bez ANSI: kolorów i szerokości kolumn pilnują widoki. Opis słowny
 * (`segments[].description`) zostaje w `plan.yaml` i w `why`; widoki drukują wiersz.
 * Stare plany bez pól z C1 (`recoveryMode`, `setBreak`, `strides`) działają: notacja
 * pomija to, czego segment nie zapisuje.
 */
import type { PlannedSegment, PlannedWorkout } from '../domain/types.ts'
import { getLocale, messages } from '../i18n/index.ts'
import { formatNumber, type Locale } from '../i18n/locale.ts'
import type { SessionStep, StepTarget, TrainingSession } from '../sports/types.ts'

export interface NotationOptions {
  /** Język skrótów; bez niego bieżący katalog. */
  locale?: Locale
  /** Bez Unicode: `x` zamiast `×`, `-` zamiast `–`, `->` zamiast `→`, ` | ` między częściami. */
  ascii?: boolean
}

interface Glyphs { times: string; dash: string; arrow: string; sep: string }
const UNICODE: Glyphs = { times: '×', dash: '–', arrow: '→', sep: ' · ' }
const ASCII: Glyphs = { times: 'x', dash: '-', arrow: '->', sep: ' | ' }

/** Tempo `m:ss` z zaokrągleniem całych sekund (bez `4:60`). */
function pace(secPerKm: number): string {
  const total = Math.round(secPerKm)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

/** Czas: `2'` minuty, `30"` sekundy, `1'30"` (spec C1). */
function duration(sec: number): string {
  const total = Math.round(sec)
  const min = Math.floor(total / 60)
  const rest = total % 60
  if (min === 0) return `${rest}"`
  return rest === 0 ? `${min}'` : `${min}'${String(rest).padStart(2, '0')}"`
}

export function workoutLine(workout: PlannedWorkout, opts: NotationOptions = {}): string {
  const locale = opts.locale ?? getLocale()
  const t = messages(locale).notation
  const g = opts.ascii ? ASCII : UNICODE
  const km = (value: number) => `${formatNumber(locale, value)} km`
  const rep = (meters: number) => (meters >= 1000 && meters % 100 === 0 ? km(meters / 1000) : `${meters} m`)
  const range = (r: { loSecPerKm: number; hiSecPerKm: number }) =>
    r.loSecPerKm === r.hiSecPerKm ? `@${pace(r.loSecPerKm)}` : `@${pace(r.loSecPerKm)}${g.dash}${pace(r.hiSecPerKm)}`
  const mid = (r: { loSecPerKm: number; hiSecPerKm: number }) => `@${pace((r.loSecPerKm + r.hiSecPerKm) / 2)}`

  const segment = (s: PlannedSegment): string => {
    const dist = km(s.distanceKm ?? 0)
    switch (s.type) {
      case 'warmup':
        return `${t.warmup} ${dist}`
      case 'cooldown':
        return `${t.cooldown} ${dist}`
      case 'easy': {
        const base = s.pace ? `${dist} ${range(s.pace)}` : dist
        return s.strides ? `${base} + ${s.strides.count}${g.times}${s.strides.meters} m ${t.strides}` : base
      }
      case 'steady':
        return s.pace ? `${dist} ${mid(s.pace)}` : dist
      case 'intervals': {
        const work = `${s.reps ?? 1}${g.times}${rep(s.repM ?? 0)}${s.pace ? ` ${mid(s.pace)}` : ''}`
        const recovery = s.recoverySec ? ` ${t.recovery} ${duration(s.recoverySec)}${s.recoveryMode ? ` ${t[s.recoveryMode]}` : ''}` : ''
        const setBreak = s.setBreak ? `, ${t.afterRep(s.setBreak.afterRep)} ${duration(s.setBreak.sec)} ${t[s.setBreak.mode]}` : ''
        return `${work}${recovery}${setBreak}`
      }
      case 'hills':
        return `${t.hills} ${s.reps ?? 0}${g.times}${s.repM ?? 0} m`
      case 'progression':
        // od wolniejszego końca (hi) do szybszego (lo)
        return s.pace ? `${dist} ${pace(s.pace.hiSecPerKm)}${g.arrow}${pace(s.pace.loSecPerKm)}` : dist
      case 'alternating':
        // na zmianę 1 km szybko (lo) i 1 km spokojnie (hi)
        return s.pace ? `${dist}: ${km(1)} @${pace(s.pace.loSecPerKm)} / ${km(1)} @${pace(s.pace.hiSecPerKm)}` : dist
      case 'race':
        return workout.kind === 'race'
          ? `${t.race} ${km(workout.raceDistanceKm ?? s.distanceKm ?? 0)}`
          : `${dist} ${t.timeTrial}`
    }
  }
  return workout.segments.map(segment).join(g.sep)
}

/** Krok sesji v2: dystans albo czas na powtórzenie, cel, przerwa po każdym powtórzeniu. */
function stepLine(step: SessionStep, locale: Locale, g: Glyphs): string {
  const t = messages(locale).notation
  const amount = step.distanceM !== undefined && step.distanceM > 0
    ? (step.distanceM >= 1000 && step.distanceM % 100 === 0 ? `${formatNumber(locale, step.distanceM / 1000)} km` : `${step.distanceM} m`)
    : duration(step.durationSec)
  const target = (x: StepTarget): string =>
    x.kind === 'pace' ? ` @${pace(x.seconds)}${x.perM === 100 ? '/100 m' : ''}`
      : x.kind === 'power' ? ` @${x.watts} W`
        : ''
  const reps = step.repeat !== undefined && step.repeat > 1 ? `${step.repeat}${g.times}` : ''
  const rest = step.restSec ? ` ${t.recovery} ${duration(step.restSec)}` : ''
  const sendoff = step.sendoffSec ? ` ${t.sendoff} ${duration(step.sendoffSec)}` : ''
  switch (step.role) {
    case 'warmup':
      return `${t.warmup} ${amount}${target(step.target)}`
    case 'cooldown':
      return `${t.cooldown} ${amount}`
    case 'rest':
      return `${t.recovery} ${amount}`
    case 'drill':
      return `${t.drill} ${reps}${amount}${rest}${sendoff}`
    case 'work':
      return `${reps}${amount}${target(step.target)}${rest}${sendoff}`
  }
}

/**
 * Wiersz jednostki: planu biegowego albo sesji planu v2. Bieg v2 z migracji ma
 * pełną treść w `legacyWorkout` — notacja czyta segmenty, nie uproszczone kroki.
 * Siła nie ma kroków do zapisania: wiersz to sama nazwa.
 */
export function sessionLine(item: PlannedWorkout | TrainingSession, opts: NotationOptions = {}): string {
  if ('segments' in item) return workoutLine(item, opts)
  if (item.legacyWorkout) return workoutLine(item.legacyWorkout, opts)
  const locale = opts.locale ?? getLocale()
  if (item.sport === 'strength') return messages(locale).notation.strength
  const g = opts.ascii ? ASCII : UNICODE
  return item.steps.map((step) => stepLine(step, locale, g)).join(g.sep)
}
