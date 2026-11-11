/**
 * Profil sezonu i linty kształtu (docs/PLAN-v0.7.md, B0).
 *
 * `validatePlan` pilnuje reguł pojedynczego tygodnia; tutaj patrzymy na sezon:
 * czy długie jest najdłuższe, czy odciążenie jest lżejsze, czy dawka rośnie.
 * Wynik służy testom macierzy profili i (od etapu 2) komendzie `check`.
 * Progi oznaczone „inż." są wyborem inżynierskim (E-3), nie wynikiem badań.
 */
import type { MacroPhase, Microcycle, PlannedWorkout, RaceGoal } from '../domain/types.ts'
import { goalClass } from '../domain/goal-class.ts'
import { median } from '../util/stats.ts'
import { fmtPace, hardKmOf, paceMid, SESSION_SHARE_MAX } from './microcycle.ts'

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

/**
 * Próg najdłuższego biegu dla dystansu: HM — dłuższy niż 21 km (J-2, P-7),
 * maraton — co najmniej 25 km (P-8 karze „najdłuższy <25 km").
 */
export function longRunThreshold(goal: Pick<RaceGoal, 'kind' | 'distanceKm'>): { km: number; inclusive: boolean; ruleRefs: string[] } | undefined {
  // klasa dystansu z tej samej funkcji co taper i szczyt objętości
  const kind = goalClass(goal)
  if (kind === 'marathon') return { km: 25, inclusive: true, ruleRefs: ['P-8', 'J-1'] }
  if (kind === 'half') return { km: 21, inclusive: false, ruleRefs: ['J-2', 'P-7'] }
  return undefined
}

const LOADING_PHASES = new Set<MacroPhase>(['base', 'build', 'peak'])

/**
 * Początek bieżącego cyklu w planie bez `cycleStart`: pierwszy tydzień po ostatnim
 * bloku przejściowym. Plan z jednym cyklem — undefined (cały plan). Regeneracja
 * z historią zawsze zapisuje `cycleStart`, więc to tylko zabezpieczenie dla planów
 * złożonych inaczej (testy, starsze pliki).
 */
function currentCycleStart(weeks: Microcycle[]): string | undefined {
  let start: string | undefined
  for (let i = 1; i < weeks.length; i++) {
    // nowy cykl zaczyna pierwszy tydzień po bloku przejściowym — także taper albo start
    if (weeks[i - 1]!.skeleton.phase === 'transition' && weeks[i]!.skeleton.phase !== 'transition') start = weeks[i]!.weekStart
  }
  return start
}
const isLoading = (w: Microcycle) => LOADING_PHASES.has(w.skeleton.phase) && !w.skeleton.deload

/** `rows` — profil już policzony przez wołającego (unika drugiego przebiegu). */
export function seasonShapeIssues(plan: { goal: Pick<RaceGoal, 'kind' | 'distanceKm'>; weeks: Microcycle[]; cycleStart?: string | undefined }, rows = seasonProfile(plan.weeks)): ShapeIssue[] {
  const issues: ShapeIssue[] = []
  // Plan z historią trzyma tygodnie poprzednich cykli. Oceniamy bieżący cykl (od
  // `cycleStart`, a bez niego od pierwszego tygodnia po ostatnim bloku przejściowym,
  // także taperu albo startu): inaczej długie 30 km z poprzedniego maratonu „spełniałoby" próg
  // nowego półmaratonu, a bloki i odciążenia porównywałyby się między cyklami.
  const from = plan.cycleStart ?? currentCycleStart(plan.weeks)
  const weeks = from ? plan.weeks.filter((w) => w.weekStart >= from) : plan.weeks
  rows = from ? rows.filter((r) => r.weekStart >= from) : rows

  for (const week of weeks) {
    const runs = week.days.flatMap((d) => (d.workout ? [{ date: d.date, w: d.workout }] : []))
    // najdłuższe z długich (po `shift` tydzień bywa ma dwa), porównane z resztą biegów
    const long = runs.filter((r) => r.w.kind === 'long').sort((a, z) => z.w.distanceKm - a.w.distanceKm)[0]
    // J-1/S-2: długie jest najdłuższym biegiem tygodnia — także wobec akcentów i podbiegów
    const others = runs.filter((r) => r.w !== long?.w && !['race', 'test', 'sharpener'].includes(r.w.kind))
    const longest = Math.max(0, ...others.map((r) => r.w.distanceKm))
    if (long && longest > long.w.distanceKm) issues.push({ code: 'longNotLongest', date: week.weekStart, ruleRefs: ['S-2', 'J-1'], values: [long.w.distanceKm, longest] })
    // Jedna jednostka nie dźwiga tygodnia obok długiego (inż.). Tydzień bez długiego (taper,
    // pierwszy po starcie) nie ma czego chronić — jego rolę pełni najdłuższy bieg spokojny;
    // przy dwóch biegach jeden ma połowę tygodnia z definicji.
    if (week.totalKm > 0 && week.skeleton.phase !== 'race' && long && runs.length >= 3) {
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
  // ostatniego bloku budowania przed nim (mediana — jedna skrócona jednostka nie zbija
  // sufitu). Blok to tygodnie ładowania między odciążeniami; liczy się ostatni z akcentami
  // innymi niż podbiegi. Oceniany jest jeden cykl (wyżej), więc blok przejściowy jest jeden.
  // Plan bez budowania (krótki horyzont) albo z samymi podbiegami w budowaniu: sufit
  // z ostatniego bloku ładowania przed startem (baza, szczyt), żeby R-8 nie znikało.
  let buildBlock: number[] = [], buildCeiling: number[] = []
  let loadBlock: number[] = [], loadCeiling: number[] = []
  for (const r of rows) {
    if (LOADING_PHASES.has(r.phase)) {
      if (r.phase !== 'build' && buildBlock.length) { buildCeiling = buildBlock; buildBlock = [] }
      if (r.deload) {
        if (buildBlock.length) buildCeiling = buildBlock
        if (loadBlock.length) loadCeiling = loadBlock
        buildBlock = []; loadBlock = []
        continue
      }
      if (r.flags.length) continue
      const hard = r.accents.filter((a) => a.kind !== 'easy_hills').map((a) => a.hardKm)
      loadBlock.push(...hard)
      if (r.phase === 'build') buildBlock.push(...hard)
      continue
    }
    if (buildBlock.length) { buildCeiling = buildBlock; buildBlock = [] }
    if (loadBlock.length) { loadCeiling = loadBlock; loadBlock = [] }
    const ceilingHard = buildCeiling.length ? buildCeiling : loadCeiling
    if (r.phase !== 'transition' || !ceilingHard.length) continue
    const ceiling = round1(median(ceilingHard))
    for (const a of r.accents) if (a.kind !== 'easy_hills' && a.hardKm > ceiling) issues.push({ code: 'postRaceAccentHeavy', date: r.weekStart, ruleRefs: ['R-8'], values: [a.hardKm, ceiling] })
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
    // cykl bez tygodni ładowania (start za tydzień): długiego nie ma czym zbudować — bez lintu
    const loading = rows.filter((r) => LOADING_PHASES.has(r.phase))
    const longest = Math.max(0, ...loading.map((r) => r.longKm))
    const meets = threshold.inclusive ? longest >= threshold.km : longest > threshold.km
    if (loading.length && !meets) issues.push({ code: 'longBelowGoal', date: '', ruleRefs: threshold.ruleRefs, values: [longest, threshold.km] })
  }
  return issues
}
