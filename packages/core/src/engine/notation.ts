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
import { distanceIn, distanceUnit, getUnits, paceIn, type Units } from '../i18n/units.ts'
import type { SessionStep, StepTarget, TrainingSession } from '../sports/types.ts'
import { splitsSeries } from './duration.ts'

/**
 * C10: zapis notacji — `neutral` (skróty RG, SCH, p.; domyślnie) albo `club`: kody znane
 * z polskich planów klubowych (OWB1, BNP, WT…). Wybór jak jednostka: raz na starcie CLI
 * albo serwera MCP (`notation` w trainctl.yaml). Kody tylko po polsku; dane bez zmian.
 */
export const NOTATION_STYLES = ['neutral', 'club'] as const
export type NotationStyle = (typeof NOTATION_STYLES)[number]

export const isNotationStyle = (value: unknown): value is NotationStyle =>
  typeof value === 'string' && (NOTATION_STYLES as readonly string[]).includes(value)

let currentStyle: NotationStyle = 'neutral'

/** Ustawia zapis notacji procesu. Zwraca poprzedni — wygodne w testach (`try/finally`). */
export function setNotation(style: NotationStyle): NotationStyle {
  const previous = currentStyle
  currentStyle = style
  return previous
}

export const getNotation = (): NotationStyle => currentStyle

/** Uruchamia funkcję w danym zapisie notacji i przywraca poprzedni (także przy wyjątku). */
export function withNotation<T>(style: NotationStyle, fn: () => T): T {
  const previous = setNotation(style)
  try {
    return fn()
  } finally {
    setNotation(previous)
  }
}

/**
 * C10, E-4 (inż.): kody klubowe przypisane do segmentów silnika. Szkoły różnią się
 * definicjami (FOUNDATIONS §10.16): bieg spokojny i długi to OWB1 (pierwszy zakres),
 * praca w równym tempie BC2, narastanie BNP, bieg zmienny BZ, podbiegi SB (siła
 * biegowa), przebieżki RT. Odcinki według długości: do 300 m rytmy (RT), od 2 km
 * odcinki w trzecim zakresie (BC3), pomiędzy wytrzymałość tempowa (WT).
 */
const CLUB = { easy: 'OWB1', steady: 'BC2', progression: 'BNP', alternating: 'BZ', hills: 'SB', strides: 'RT' } as const
const CLUB_RHYTHM_MAX_M = 300
const CLUB_LONG_REP_M = 2000
const clubRepCode = (repM: number): string => (repM <= CLUB_RHYTHM_MAX_M ? 'RT' : repM >= CLUB_LONG_REP_M ? 'BC3' : 'WT')

export interface NotationOptions {
  /** Język skrótów; bez niego bieżący katalog. */
  locale?: Locale
  /** C10: zapis notacji; bez niego bieżący (`getNotation`). Kody klubowe tylko po polsku. */
  style?: NotationStyle
  /** Bez Unicode: `x` zamiast `×`, `-` zamiast `–`, `->` zamiast `→`, ` | ` między częściami. */
  ascii?: boolean
  /** C9: jednostka widoku; bez niej bieżąca (`getUnits`). Dane zostają w km. */
  units?: Units
}

interface Glyphs { times: string; dash: string; arrow: string; sep: string }
const UNICODE: Glyphs = { times: '×', dash: '–', arrow: '→', sep: ' · ' }
const ASCII: Glyphs = { times: 'x', dash: '-', arrow: '->', sep: ' | ' }

/** Tempo `m:ss` z zaokrągleniem całych sekund (bez `4:60`). */
function pace(secPerKm: number): string {
  const total = Math.round(secPerKm)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

/**
 * Formaty notacji w jednostce widoku (C9): dystans ciągły w km albo w milach,
 * tempo na km albo na milę. Odcinek to dystans bieżni: metry, a przy kilometrach
 * pełne kilometry; przy milach zawsze metry (`4×1000 m`), bez „km" w wyjściu.
 */
interface Format { locale: Locale; g: Glyphs; club: boolean; km: (km: number) => string; rep: (meters: number) => string; pace: (secPerKm: number) => string }
function format(opts: NotationOptions): Format {
  const locale = opts.locale ?? getLocale()
  const units = opts.units ?? getUnits()
  const km = (value: number) => `${formatNumber(locale, distanceIn(value, units))} ${distanceUnit(units)}`
  return {
    locale,
    g: opts.ascii ? ASCII : UNICODE,
    // C10: po angielsku `club` daje notację neutralną — kody są polskie
    club: (opts.style ?? currentStyle) === 'club' && locale === 'pl',
    km,
    rep: (meters: number) => (units === 'metric' && meters >= 1000 && meters % 100 === 0 ? km(meters / 1000) : `${meters} m`),
    pace: (secPerKm: number) => pace(paceIn(secPerKm, units)),
  }
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
  return segmentsLine(workout, workout.segments, opts, false)
}

/**
 * Część główna jednostki do siatki sezonu (C2): bez rozgrzewki, schłodzenia,
 * biegu spokojnego przed akcentem, przerw i przebieżek — `4×1 km @4:32`. Zapis
 * zwarty jak w makiecie sezonu: same „podbiegi", „zmienny 4 km", a kolejne serie
 * w tym samym tempie mają tempo raz, na końcu (`3×1 km + 3×400 m @4:04`).
 * Sesja v2: same serie (krok z powtórzeniami), bez pracy ciągłej przed i po nich.
 */
export function accentLine(item: PlannedWorkout | TrainingSession, opts: NotationOptions = {}): string {
  if ('segments' in item || item.legacyWorkout) {
    const workout = 'segments' in item ? item : item.legacyWorkout!
    const frame = (s: PlannedSegment) => s.type === 'warmup' || s.type === 'cooldown' || (s.type === 'easy' && workout.kind !== 'easy' && workout.kind !== 'long')
    return segmentsLine(workout, workout.segments.filter((s) => !frame(s)), opts, true)
  }
  const f = format(opts)
  if (item.sport === 'strength') return messages(f.locale).notation.strength
  // sesja v2: serie (krok z powtórzeniami); bez serii cała praca
  const work = item.steps.filter((step) => step.role === 'work' || step.role === 'drill')
  const sets = work.filter((step) => (step.repeat ?? 1) > 1)
  return (sets.length ? sets : work).map((step) => stepLine({ ...step, restSec: 0, sendoffSec: 0 }, f)).join(' + ')
}

function segmentsLine(workout: PlannedWorkout, segments: PlannedSegment[], opts: NotationOptions, main: boolean): string {
  const { locale, g, club, km, rep, pace: speed } = format(opts)
  const t = messages(locale).notation
  // C10: kod klubowy przed zapisem segmentu; w notacji neutralnej nic
  const code = (value: string, text: string) => (club ? `${value} ${text}` : text)
  const range = (r: { loSecPerKm: number; hiSecPerKm: number }) =>
    r.loSecPerKm === r.hiSecPerKm ? `@${speed(r.loSecPerKm)}` : `@${speed(r.loSecPerKm)}${g.dash}${speed(r.hiSecPerKm)}`
  const mid = (r: { loSecPerKm: number; hiSecPerKm: number }) => `@${speed((r.loSecPerKm + r.hiSecPerKm) / 2)}`

  const segment = (s: PlannedSegment, next: PlannedSegment | undefined): string => {
    const dist = km(s.distanceKm ?? 0)
    switch (s.type) {
      case 'warmup':
        return `${t.warmup} ${dist}`
      case 'cooldown':
        return `${t.cooldown} ${dist}`
      case 'easy': {
        const base = code(CLUB.easy, s.pace ? `${dist} ${range(s.pace)}` : dist)
        if (!s.strides || main) return base
        const strides = `${s.strides.count}${g.times}${s.strides.meters} m`
        return `${base} + ${club ? `${CLUB.strides} ${strides}` : `${strides} ${t.strides}`}`
      }
      case 'steady':
        return code(CLUB.steady, s.pace ? `${dist} ${mid(s.pace)}` : dist)
      case 'intervals': {
        // siatka sezonu: następna seria w tym samym tempie podaje tempo za obie
        const shared = main && next?.type === 'intervals' && s.pace && next.pace && mid(s.pace) === mid(next.pace)
        const work = code(clubRepCode(s.repM ?? 0), `${s.reps ?? 1}${g.times}${rep(s.repM ?? 0)}${s.pace && !shared ? ` ${mid(s.pace)}` : ''}`)
        if (main) return work
        const recovery = s.recoverySec ? ` ${t.recovery} ${duration(s.recoverySec)}${s.recoveryMode ? ` ${t[s.recoveryMode]}` : ''}` : ''
        // przerwa w połowie serii tylko wtedy, gdy dzieli serię — jak na zegarku i w szacunku czasu
        const setBreak = splitsSeries(s) ? `, ${t.afterRep(s.setBreak.afterRep)} ${duration(s.setBreak.sec)} ${t[s.setBreak.mode]}` : ''
        return `${work}${recovery}${setBreak}`
      }
      case 'hills': {
        const name = club ? CLUB.hills : t.hills
        return main ? name : `${name} ${s.reps ?? 0}${g.times}${s.repM ?? 0} m`
      }
      case 'progression':
        // od wolniejszego końca (hi) do szybszego (lo)
        return code(CLUB.progression, s.pace ? `${dist} ${speed(s.pace.hiSecPerKm)}${g.arrow}${speed(s.pace.loSecPerKm)}` : dist)
      case 'alternating':
        // na zmianę 1 km szybko (lo) i 1 km spokojnie (hi); odcinek zmiany to dystans bieżni
        if (main) return `${club ? CLUB.alternating : t.part.alternating} ${dist}`
        return code(CLUB.alternating, s.pace ? `${dist}: ${rep(1000)} @${speed(s.pace.loSecPerKm)} / ${rep(1000)} @${speed(s.pace.hiSecPerKm)}` : dist)
      case 'race':
        return workout.kind === 'race'
          ? `${t.race} ${km(workout.raceDistanceKm ?? s.distanceKm ?? 0)}`
          : `${dist} ${t.timeTrial}`
    }
  }
  // w siatce sezonu części jednej jednostki łączy „+", a „·" oddziela jednostki tygodnia
  return segments.map((s, i) => segment(s, segments[i + 1])).join(main ? ' + ' : g.sep)
}

/** Dawka kroku v2 na jedno powtórzenie: dystans, a bez niego czas. */
function stepAmount(step: SessionStep, f: Format): string {
  return step.distanceM !== undefined && step.distanceM > 0 ? f.rep(step.distanceM) : duration(step.durationSec)
}

/** Cel tempa kroku v2: na km w jednostce widoku, pływanie zawsze na 100 m. */
const stepPace = (x: Extract<StepTarget, { kind: 'pace' }>, f: Format): string =>
  x.perM === 100 ? `${pace(x.seconds)}/100 m` : f.pace(x.seconds)

/** Krok sesji v2: dystans albo czas na powtórzenie, cel, przerwa po każdym powtórzeniu. */
function stepLine(step: SessionStep, f: Format): string {
  const { locale, g } = f
  const t = messages(locale).notation
  const amount = stepAmount(step, f)
  const target = (x: StepTarget): string =>
    x.kind === 'pace' ? ` @${stepPace(x, f)}`
      : x.kind === 'power' ? ` @${x.watts} W`
        : ''
  const reps = step.repeat !== undefined && step.repeat > 1 ? `${step.repeat}${g.times}` : ''
  const rest = step.restSec ? ` ${t.recovery} ${duration(step.restSec)}` : ''
  const sendoff = step.sendoffSec ? ` ${t.sendoff} ${duration(step.sendoffSec)}` : ''
  switch (step.role) {
    // rama bez celu, jak w planie biegowym (`RG 3 km`); cel rozgrzewki pokazuje struktura dnia
    case 'warmup':
      return `${t.warmup} ${amount}`
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
  const f = format(opts)
  if (item.sport === 'strength') return messages(f.locale).notation.strength
  return item.steps.map((step) => stepLine(step, f)).join(f.g.sep)
}

/**
 * Legenda notacji pod widokiem (C1, C10): skróty ramy i przerwy, a w zapisie klubowym
 * (tylko po polsku) także kody jednostek. Jednostka tempa w jednostce widoku.
 */
export function notationLegend(unit: string, opts: { locale?: Locale; style?: NotationStyle } = {}): string {
  const locale = opts.locale ?? getLocale()
  const t = messages(locale).notation
  return (opts.style ?? currentStyle) === 'club' && locale === 'pl' ? t.clubLegend(unit) : t.legend(unit)
}

/** Wiersz struktury jednostki w widoku dnia (C2): część, dawka, cel, przerwa. */
export interface StructureRow { part: string; dose: string; target: string; recovery: string }

const row = (part: string, dose: string, target = '', recovery = ''): StructureRow => ({ part, dose, target, recovery })

/**
 * Struktura jednostki planu biegowego: wiersz na część, cel jako zakres tempa
 * (w wierszu z C1 akcent ma środek zakresu, tu cały zakres do pilnowania na zegarku).
 */
export function workoutStructure(workout: PlannedWorkout, opts: NotationOptions = {}): StructureRow[] {
  const { locale, g, km, rep, pace: speed } = format(opts)
  const t = messages(locale).notation
  const band = (r: { loSecPerKm: number; hiSecPerKm: number } | undefined) =>
    !r ? '' : r.loSecPerKm === r.hiSecPerKm ? speed(r.loSecPerKm) : `${speed(r.loSecPerKm)}${g.dash}${speed(r.hiSecPerKm)}`
  return workout.segments.flatMap((s): StructureRow[] => {
    const dist = km(s.distanceKm ?? 0)
    switch (s.type) {
      case 'warmup':
        return [row(t.part.warmup, dist, band(s.pace))]
      case 'cooldown':
        // schłodzenie bez tempa to trucht (opis: „km truchtu")
        return [row(t.part.cooldown, dist, s.pace ? band(s.pace) : t.jog)]
      case 'easy':
        return [
          row(t.part.easy, dist, band(s.pace)),
          ...(s.strides ? [row(t.part.strides, `${s.strides.count}${g.times}${s.strides.meters} m`)] : []),
        ]
      case 'steady':
        return [row(t.part.steady, dist, band(s.pace))]
      case 'intervals': {
        const recovery = s.recoverySec ? `${duration(s.recoverySec)}${s.recoveryMode ? ` ${t[s.recoveryMode]}` : ''}` : ''
        const setBreak = splitsSeries(s) ? `${recovery ? ', ' : ''}${t.afterRep(s.setBreak.afterRep)} ${duration(s.setBreak.sec)} ${t[s.setBreak.mode]}` : ''
        return [row(t.part.intervals, `${s.reps ?? 1}${g.times}${rep(s.repM ?? 0)}`, band(s.pace), recovery + setBreak)]
      }
      case 'hills':
        // podbiegi bez tempa, spokojnie pod górę (opis segmentu); przerwą jest zbieg
        return [row(t.part.hills, `${s.reps ?? 0}${g.times}${s.repM ?? 0} m`, t.part.easy, t.jogDown)]
      case 'progression':
        return [row(t.part.progression, dist, s.pace ? `${speed(s.pace.hiSecPerKm)}${g.arrow}${speed(s.pace.loSecPerKm)}` : '')]
      case 'alternating':
        return [row(t.part.alternating, dist, s.pace ? `${rep(1000)} ${speed(s.pace.loSecPerKm)} / ${rep(1000)} ${speed(s.pace.hiSecPerKm)}` : '')]
      case 'race':
        return workout.kind === 'race'
          ? [row(t.part.race, km(workout.raceDistanceKm ?? s.distanceKm ?? 0), band(s.pace))]
          : [row(t.part.timeTrial, dist)]
    }
  })
}

/**
 * Struktura jednostki planu biegowego albo sesji v2. Cel kroku v2: tempo albo moc;
 * przy celu „według odczucia" zaplanowany zakres RPE (opis zamiaru, nie strefa).
 * Siła nie ma kroków: pusta lista, widok pokazuje opis sesji.
 */
export function sessionStructure(item: PlannedWorkout | TrainingSession, opts: NotationOptions = {}): StructureRow[] {
  if ('segments' in item) return workoutStructure(item, opts)
  if (item.legacyWorkout) return workoutStructure(item.legacyWorkout, opts)
  if (item.sport === 'strength') return []
  const f = format(opts), { locale, g } = f
  const t = messages(locale).notation
  return item.steps.map((step) => {
    const target = step.target.kind === 'pace' ? stepPace(step.target, f)
      : step.target.kind === 'power' ? `${step.target.watts} W`
        : step.effort ? `RPE ${step.effort.min}${g.dash}${step.effort.max}` : ''
    const recovery = [step.restSec ? duration(step.restSec) : '', step.sendoffSec ? `${t.sendoff} ${duration(step.sendoffSec)}` : ''].filter(Boolean).join(', ')
    const reps = step.repeat !== undefined && step.repeat > 1 ? `${step.repeat}${g.times}` : ''
    return row(t.part[step.role], reps + stepAmount(step, f), target, recovery)
  })
}
