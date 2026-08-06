/**
 * Tryb biurkowy (FOUNDATIONS §10.10, §10.7 S-7/S-8).
 *
 * Czego ten moduł NIE robi — i to jest świadome:
 *  - nie zmienia struktury planu z powodu godzin siedzenia (B-1: siedzenie nie
 *    występuje w żadnym z dwóch przeglądów czynników ryzyka urazów biegowych),
 *  - nie powtarza folkloru o „skróconych zgięciaczach" (B-2),
 *  - nie obiecuje, że przerwy poprawią wynik biegowy (B-6: dane pochodzą
 *    z populacji nietrenującej).
 *
 * Co robi: układa dzień wokół pracy — okna treningowe, przerwy z chodzeniem
 * (jedyna forma z dowodami, B-3/B-4) i jedną regułę, która realnie zmienia
 * jakość sesji: po dniu ciężkiej pracy umysłowej prowadzimy trening po tempie,
 * bo odczucie wysiłku kłamie (B-10/S-8 — Marcora 2009: −15% wytrzymałości przy
 * zerowej różnicy w tętnie, laktacie i VO₂).
 */
import type { PlannedWorkout } from '../domain/types.ts'
import { messages } from '../i18n/index.ts'

export interface DeskProfile {
  /** "HH:MM" */
  workStart: string
  workEnd: string
  /** Przerwa obiadowa w minutach (okno treningowe w środku dnia). */
  lunchMinutes?: number
  /** Co ile minut wstawać (B-3: ≤30). */
  breakEveryMin?: number
  /** Długość przerwy (B-4: 2–3 min chodu). */
  breakMinutes?: number
  /** Preferowane okno treningowe, gdy jest wybór. */
  prefer?: 'morning' | 'lunch' | 'evening'
}

export interface DeskBreak {
  at: string
  minutes: number
  what: string
}

export interface TrainingWindow {
  from: string
  to: string
  /** Identyfikator okna — stabilny, niezależny od języka (logika porównuje jego). */
  key: 'morning' | 'lunch' | 'evening'
  /** Nazwa dla użytkownika, w bieżącym języku. */
  label: string
  fits: boolean
  note?: string
}

export interface DeskDay {
  breaks: DeskBreak[]
  windows: TrainingWindow[]
  recommended?: TrainingWindow
  guidance: string[]
  ruleRefs: string[]
}

const toMin = (hhmm: string): number => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm)
  if (!m) throw new Error(messages().desk.badTime(hhmm))
  return Number(m[1]) * 60 + Number(m[2])
}
const toHhmm = (min: number): string =>
  `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

/** Szacunek czasu trwania jednostki: dystans × tempo spokojne + narzut. */
function estimateMinutes(workout: PlannedWorkout): number {
  const km = workout.distanceKm || 0
  const paceSec =
    workout.segments.find((s) => s.pace)?.pace?.hiSecPerKm ?? 330
  return Math.round((km * paceSec) / 60) + 15 // przebranie/rozruch
}

const QUALITY: ReadonlySet<string> = new Set([
  'quality_intervals',
  'quality_continuous',
  'sharpener',
])

export function planDeskDay(
  profile: DeskProfile,
  workout?: PlannedWorkout,
  opts: { heavyCognitiveDay?: boolean } = {},
): DeskDay {
  const start = toMin(profile.workStart)
  const end = toMin(profile.workEnd)
  const m = messages()
  if (end <= start) throw new Error(m.desk.endBeforeStart)
  const everyMin = Math.min(profile.breakEveryMin ?? 30, 30) // B-3: interwał ≤30 min
  const breakMin = profile.breakMinutes ?? 3
  const lunch = profile.lunchMinutes ?? 45

  // Przerwy: chodzenie co ≤30 min (B-3/B-4). Chód, nie „ćwiczenia przy biurku" —
  // metaanaliza wykazała efekt tylko dla chodzenia.
  const breaks: DeskBreak[] = []
  for (let t = start + everyMin; t < end; t += everyMin) {
    breaks.push({ at: toHhmm(t), minutes: breakMin, what: m.desk.walkBreak(breakMin) })
  }
  // Jedna przerwa dłuższa: „exercise snack" — schody (B-5).
  const midday = breaks.find((b) => toMin(b.at) >= start + 3 * everyMin)
  if (midday) {
    midday.minutes = Math.max(3, breakMin)
    midday.what = m.desk.stairSnack
  }

  const needMin = workout ? estimateMinutes(workout) : 0
  const lunchStart = start + Math.round((end - start) / 2)
  const windows: TrainingWindow[] = [
    {
      from: toHhmm(start - 90),
      to: profile.workStart,
      key: 'morning',
      label: m.desk.windowMorning,
      fits: 90 >= needMin,
    },
    {
      from: toHhmm(lunchStart),
      to: toHhmm(lunchStart + lunch),
      key: 'lunch',
      label: m.desk.windowLunch,
      fits: lunch >= needMin,
    },
    {
      from: profile.workEnd,
      to: toHhmm(end + 150),
      key: 'evening',
      label: m.desk.windowEvening,
      fits: 150 >= needMin,
    },
  ]

  const guidance: string[] = []
  const ruleRefs = ['B-3', 'B-4', 'B-5', 'B-8']

  const isQuality = workout ? QUALITY.has(workout.kind) : false
  let recommended: TrainingWindow | undefined
  if (workout) {
    const fitting = windows.filter((w) => w.fits)
    const byPreference = profile.prefer
      ? fitting.filter((w) => w.key === profile.prefer)
      : []
    recommended = byPreference[0] ?? fitting[0]

    if (isQuality && opts.heavyCognitiveDay) {
      const evening = windows.find((w) => w.key === 'evening')
      if (recommended?.key === 'evening' || !recommended) {
        recommended = windows.find((w) => w.fits && w.key === 'morning') ?? evening ?? recommended
      }
      guidance.push(m.desk.heavyDayPaceNotFeel, m.desk.moveAccentEarlier)
      ruleRefs.push('B-10', 'S-8', 'S-7')
    }
    if (!isQuality && opts.heavyCognitiveDay) {
      guidance.push(m.desk.easyIsSafe)
      ruleRefs.push('B-10')
    }
    if (!windows.some((w) => w.fits)) {
      guidance.push(m.desk.nothingFits(needMin))
    }
  } else {
    guidance.push(m.desk.restDayBreaks)
  }

  guidance.push(m.desk.lowAdherenceByDesign, m.desk.sittingIsNotInjuryRisk)
  ruleRefs.push('B-1')

  return {
    breaks,
    windows,
    ...(recommended ? { recommended } : {}),
    guidance,
    ruleRefs: [...new Set(ruleRefs)],
  }
}
