/**
 * Profil sezonu i linty kształtu (docs/PLAN-v0.7.md, B0).
 *
 * `validatePlan` pilnuje reguł pojedynczego tygodnia; tutaj patrzymy na sezon:
 * czy długie jest najdłuższe, czy odciążenie jest lżejsze, czy dawka rośnie.
 * Wynik służy testom macierzy profili i (od etapu 2) komendzie `check`.
 * Progi oznaczone „inż." są wyborem inżynierskim (E-3), nie wynikiem badań.
 */
import type { MacroPhase, Microcycle, PlannedWorkout, RaceGoal } from '../domain/types.ts'
import { goalClass } from './macrocycle.ts'
import { fmtPace, hardKmOf, paceMid } from './microcycle.ts'

export interface SeasonAccent {
  kind: PlannedWorkout['kind']
  /** Kilometry poza Z1 (część główna akcentu, odcinki podbiegów, pomiar). */
  hardKm: number
  /** Dawka części głównej bez słów (język neutralny): `4×1000@4:32`, `4 km 5:01→4:32`, `15×200`. */
  dose: string
}

export interface SeasonRow {
  index: number
  weekStart: string
  phase: MacroPhase
  deload: boolean
  km: number
  runs: number
  longKm: number
  accents: SeasonAccent[]
  strength: number
  flags: ('test' | 'tuneUp' | 'race')[]
}

const QUALITY = new Set(['quality_intervals', 'quality_continuous', 'easy_hills', 'sharpener', 'test'])
const round1 = (n: number) => Math.round(n * 10) / 10

function accentOf(w: PlannedWorkout): SeasonAccent {
  const parts: string[] = []
  for (const s of w.segments) {
    if (s.type === 'intervals') {
      parts.push(`${s.reps ?? 1}×${s.repM ?? 0}${s.pace ? '@' + fmtPace(paceMid(s.pace)) : ''}`)
    } else if (s.type === 'progression') {
      parts.push(`${s.distanceKm} km${s.pace ? ` ${fmtPace(s.pace.hiSecPerKm)}→${fmtPace(s.pace.loSecPerKm)}` : ''}`)
    } else if (s.type === 'alternating') {
      parts.push(`${s.distanceKm} km${s.pace ? ` ${fmtPace(s.pace.loSecPerKm)}/${fmtPace(s.pace.hiSecPerKm)}` : ''}`)
    } else if (s.type === 'steady') {
      parts.push(`${s.distanceKm} km${s.pace ? '@' + fmtPace(s.pace.loSecPerKm) : ''}`)
    } else if (s.type === 'hills') {
      parts.push(`${s.reps ?? 1}×${s.repM ?? 0}`)
    } else if (s.type === 'race') {
      parts.push(`${s.distanceKm} km`)
    }
  }
  return { kind: w.kind, hardKm: round1(hardKmOf(w)), dose: parts.join(' + ') }
}

/** Jeden wiersz na tydzień: to, co trener ogląda, przeglądając sezon. */
export function seasonProfile(weeks: Microcycle[]): SeasonRow[] {
  return weeks.map((week, index) => {
    const runs = week.days.flatMap((d) => (d.workout && d.workout.kind !== 'race' ? [d.workout] : []))
    const sk = week.skeleton
    return {
      index,
      weekStart: week.weekStart,
      phase: sk.phase,
      deload: sk.deload,
      km: round1(week.totalKm),
      runs: runs.length,
      longKm: Math.max(0, ...runs.filter((w) => w.kind === 'long').map((w) => w.distanceKm)),
      accents: runs.filter((w) => QUALITY.has(w.kind)).map(accentOf),
      strength: week.days.filter((d) => d.strength).length,
      flags: [
        ...(sk.testPlanned ? (['test'] as const) : []),
        ...(sk.tuneUp ? (['tuneUp'] as const) : []),
        ...(sk.raceDate ? (['race'] as const) : []),
      ],
    }
  })
}

/** Jeden wiersz tekstu na tydzień — format migawki testów i przeglądu trenerskiego. */
export function seasonLine(r: SeasonRow): string {
  const accents = r.accents.map((a) => `${a.kind}:${a.dose}`).join(' | ')
  return [
    String(r.index + 1).padStart(2),
    r.weekStart,
    (r.phase + (r.deload ? '↓' : '')).padEnd(11),
    String(r.km).padStart(5),
    `${r.runs}b`,
    `L${r.longKm}`,
    `S${r.strength}`,
    ...(r.flags.length ? [`[${r.flags.join(',')}]`] : []),
    accents,
  ].join(' ').trimEnd()
}

/** Wszystkie kody lintów kształtu — test macierzy liczy je stąd, nie z ręcznej kopii. */
export const SHAPE_CODES = ['longNotLongest', 'deloadNotLighter', 'sessionShareHigh', 'postRaceAccentHeavy', 'staleProgression', 'longBelowGoal'] as const
export type ShapeCode = (typeof SHAPE_CODES)[number]

export interface ShapeIssue {
  code: ShapeCode
  /** Tydzień (poniedziałek) albo dzień, którego dotyczy; pusty dla całego planu. */
  date: string
  ruleRefs: string[]
  values: number[]
}

/** Udział jednej jednostki w tygodniu, powyżej którego tydzień „wisi" na niej (inż., E-3). */
export const SESSION_SHARE_MAX = 0.35
/**
 * Próg najdłuższego biegu dla dystansu: HM — dłuższy niż 21 km (J-2, P-7),
 * maraton — co najmniej 25 km (P-8 karze „najdłuższy <25 km").
 */
export function longRunThreshold(goal: Pick<RaceGoal, 'kind' | 'distanceKm'>): { km: number; inclusive: boolean; ruleRefs: string[] } | undefined {
  if (goal.kind === 'base') return undefined
  // klasa dystansu z tej samej funkcji co taper i szczyt objętości
  const kind = goalClass(goal)
  if (kind === 'marathon') return { km: 25, inclusive: true, ruleRefs: ['P-8', 'J-1'] }
  if (kind === 'half') return { km: 21, inclusive: false, ruleRefs: ['J-2', 'P-7'] }
  return undefined
}

const LOADING_PHASES = new Set<MacroPhase>(['base', 'build', 'peak'])
const isLoading = (w: Microcycle) => LOADING_PHASES.has(w.skeleton.phase) && !w.skeleton.deload

/** `rows` — profil już policzony przez wołającego (unika drugiego przebiegu). */
export function seasonShapeIssues(plan: { goal: Pick<RaceGoal, 'kind' | 'distanceKm'>; weeks: Microcycle[] }, rows = seasonProfile(plan.weeks)): ShapeIssue[] {
  const issues: ShapeIssue[] = []
  const weeks = plan.weeks

  for (const week of weeks) {
    const runs = week.days.flatMap((d) => (d.workout ? [{ date: d.date, w: d.workout }] : []))
    const long = runs.find((r) => r.w.kind === 'long')
    const easy = runs.filter((r) => r.w.kind === 'easy')
    const longest = Math.max(0, ...easy.map((r) => r.w.distanceKm))
    // S-2/J-1: długie jest najdłuższym biegiem tygodnia
    if (long && longest > long.w.distanceKm) issues.push({ code: 'longNotLongest', date: week.weekStart, ruleRefs: ['S-2', 'J-1'], values: [long.w.distanceKm, longest] })
    // jedna jednostka nie dźwiga tygodnia (inż.)
    if (week.totalKm > 0 && week.skeleton.phase !== 'race') {
      for (const r of runs) {
        if (['long', 'race', 'test'].includes(r.w.kind)) continue
        if (r.w.distanceKm > SESSION_SHARE_MAX * week.totalKm) issues.push({ code: 'sessionShareHigh', date: r.date, ruleRefs: ['E-3'], values: [r.w.distanceKm, round1(week.totalKm)] })
      }
    }
  }

  // P-2: odciążenie lżejsze od sąsiednich tygodni ładowania
  weeks.forEach((week, i) => {
    if (!week.skeleton.deload) return
    const prev = weeks.slice(0, i).reverse().find(isLoading)
    const next = weeks.slice(i + 1).find(isLoading)
    const neighbours = [prev, next].filter((w): w is Microcycle => !!w).map((w) => w.totalKm)
    if (neighbours.length && week.totalKm >= Math.min(...neighbours)) {
      issues.push({ code: 'deloadNotLighter', date: week.weekStart, ruleRefs: ['P-2'], values: [round1(week.totalKm), round1(Math.min(...neighbours))] })
    }
  })

  // R-8: akcent w bloku przejściowym (po starcie celu) nie większy niż typowy akcent
  // ostatniego bloku budowania (mediana — jedna skrócona jednostka nie zbija sufitu).
  // Blok to tygodnie ładowania między odciążeniami; liczy się ostatni, który ma
  // akcenty inne niż podbiegi.
  const accentKm = (block: SeasonRow[]) => block.flatMap((r) => r.accents.filter((a) => a.kind !== 'easy_hills').map((a) => a.hardKm))
  let buildHard: number[] = []
  let buildBlock: SeasonRow[] = []
  for (const r of rows) {
    if (r.phase !== 'build') continue
    if (r.deload) { if (accentKm(buildBlock).length) buildHard = accentKm(buildBlock); buildBlock = []; continue }
    if (!r.flags.length) buildBlock.push(r)
  }
  if (accentKm(buildBlock).length) buildHard = accentKm(buildBlock)
  if (buildHard.length) {
    const sorted = [...buildHard].sort((a, z) => a - z)
    const ceiling = sorted[Math.floor((sorted.length - 1) / 2)]!
    for (const r of rows.filter((x) => x.phase === 'transition')) {
      for (const a of r.accents) if (a.kind !== 'easy_hills' && a.hardKm > ceiling) issues.push({ code: 'postRaceAccentHeavy', date: r.weekStart, ruleRefs: ['R-8'], values: [a.hardKm, ceiling] })
    }
  }

  // P-1: kolejne bloki ładowania w budowaniu/szczycie nie powtarzają tej samej dawki
  const blocks: SeasonRow[][] = []
  let current: SeasonRow[] = []
  for (const r of rows) {
    if (r.phase !== 'build' && r.phase !== 'peak') { if (current.length) blocks.push(current); current = []; continue }
    if (r.deload) { if (current.length) blocks.push(current); current = []; continue }
    if (!r.flags.length) current.push(r)
  }
  if (current.length) blocks.push(current)
  const signature = (r: SeasonRow) => JSON.stringify([r.longKm, r.accents.map((a) => [a.kind, a.dose])])
  for (let i = 1; i < blocks.length; i++) {
    const a = blocks[i - 1]!.at(-1)!, z = blocks[i]!.at(-1)!
    if (signature(a) === signature(z)) issues.push({ code: 'staleProgression', date: z.weekStart, ruleRefs: ['P-1'], values: [a.index + 1, z.index + 1] })
  }

  // J-2/P-7/P-8: najdłuższy bieg planu przed taperem a próg dla dystansu
  const threshold = longRunThreshold(plan.goal)
  if (threshold !== undefined) {
    const longest = Math.max(0, ...rows.filter((r) => LOADING_PHASES.has(r.phase)).map((r) => r.longKm))
    const meets = threshold.inclusive ? longest >= threshold.km : longest > threshold.km
    if (!meets) issues.push({ code: 'longBelowGoal', date: '', ruleRefs: threshold.ruleRefs, values: [longest, threshold.km] })
  }
  return issues
}
