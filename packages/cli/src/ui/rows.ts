/**
 * PLAN-v0.7 C2: wspólny model wiersza jednostki. Plan biegowy (tydzień z dniami)
 * i plan v2 (sesje) dają te same wiersze: dzień, typ, km, czas, rozpiska ze struktury
 * (notacja C1) i status. Tabela ma wiersz sumy; status w terminalu jest symbolem,
 * w wyjściu tekstowym i MCP słowem. Handlery budują wiersze, kolory dokłada renderer.
 */
import {
  accentLine, addDays, estimateWorkoutMinutes, formatNumber, getLocale, HR_CEILING_KINDS, messages, mondayOf, plannedWeekKm, sessionLine,
  type Microcycle, type StructureRow, type TrainingSession, type Weekday,
} from 'trainctl-core'
import { ui } from '../i18n/index.ts'
import { logStatusText, shownKm } from '../format.ts'
import type { LogEntry, StrengthLogEntry } from '../logfile.ts'
import { b, type Block, type RowMark } from './blocks.ts'
import type { ColorName } from './theme.ts'

/** Kolor semantyczny jednostki treningowej — spójny w całym CLI. */
export const KIND_COLOR: Record<string, ColorName> = {
  easy: 'easy',
  long: 'long',
  easy_hills: 'accent',
  quality_intervals: 'quality',
  quality_continuous: 'quality',
  sharpener: 'quality',
  test: 'race',
  race: 'race',
}

export interface SessionRow {
  date: string
  weekday: Weekday
  sport: 'run' | 'bike' | 'swim' | 'strength' | 'rest'
  /** Typ jednostki słowem w języku wyjścia. */
  kind: string
  km?: number
  /** Czas od wyjścia do powrotu, z przygotowaniem (jak szacunek `today`). */
  minutes?: number
  /** Rozpiska ze struktury (C1); pusta dla siły i dnia wolnego. */
  line: string
  status?: RowMark['kind']
  statusWord?: string
  accent?: ColorName
}

/** C8: pułap tętna w rozpisce — „tętno ≤149", w ASCII „tętno <=149". */
export const hrCeilingText = (bpm: number, ascii = false): string => `${messages().notation.hr} ${ascii ? '<=' : '≤'}${bpm}`

/** Status wpisu jako znacznik wiersza; wartość spoza listy (ręczna edycja dziennika) to „nieznany". */
export const markKind = (status: unknown): RowMark['kind'] =>
  status === 'done' || status === 'skipped' || status === 'modified' ? status : 'unknown'

/**
 * Notacja w ASCII tylko na jawne życzenie (`TRAINCTL_ASCII=1`, `TERM=dumb`), tak jak
 * ozdobniki motywu. Heurystyka starej konsoli Windows z `detectCapabilities` tu nie
 * działa: reszta treści (nagłówki z „·” i „–”) też jest w Unicode, a test nie może
 * zależeć od tego, w jakim terminalu biegnie.
 */
export const asciiOutput = (env: NodeJS.ProcessEnv = process.env): boolean =>
  env['TRAINCTL_ASCII'] !== undefined || env['TERM'] === 'dumb'

/**
 * Typ jednostki w wierszu: akcent ciągły podpisany w katalogu swoją częścią główną
 * (po polsku „narastające", „zmienny", jak w makiecie tygodnia C2; po angielsku
 * zostaje krótkie „tempo") — kolumna typu nie zabiera miejsca rozpisce.
 */
function kindText(workout: NonNullable<Microcycle['days'][number]['workout']>): string {
  if (workout.kind === 'quality_continuous') {
    const main = workout.segments.find((s) => s.type === 'progression' || s.type === 'alternating')
    if (main) return ui().rows.continuous[main.type as 'progression' | 'alternating']
  }
  return (messages().kind as Record<string, string>)[workout.kind] ?? workout.kind
}

/** Dni tygodnia planu biegowego: bieg, siła i dzień wolny jako osobne wiersze. */
export function runningWeekRows(week: Microcycle, opts: {
  preparationMinutes: number
  runs: Map<string, LogEntry>
  strength: Map<string, StrengthLogEntry>
  ascii?: boolean
  /** C8: pułap tętna biegu spokojnego i długiego (Z-2), dopisany do rozpiski po tempie. */
  hrCeiling?: number | undefined
}): SessionRow[] {
  const t = ui().rows
  return week.days.flatMap((day): SessionRow[] => {
    const out: SessionRow[] = []
    const run = opts.runs.get(day.date)
    if (day.workout) {
      const minutes = estimateWorkoutMinutes(day.workout, opts.preparationMinutes)
      out.push({
        date: day.date, weekday: day.weekday, sport: 'run',
        kind: kindText(day.workout),
        km: shownKm(day.workout),
        ...(Number.isFinite(minutes) ? { minutes } : {}),
        line: sessionLine(day.workout, { ascii: opts.ascii ?? false }) +
          (opts.hrCeiling !== undefined && HR_CEILING_KINDS.has(day.workout.kind) ? `, ${hrCeilingText(opts.hrCeiling, opts.ascii ?? false)}` : ''),
        ...(run ? { status: markKind(run.status), statusWord: logStatusText(run.status) } : {}),
        accent: KIND_COLOR[day.workout.kind] ?? 'accent',
      })
    }
    if (day.strength) {
      const entry = opts.strength.get(day.date)
      // rozpiska siły to jej wariant (wejście, ciężka, podtrzymująca); pełny opis w today i PLAN.md
      out.push({
        date: day.date, weekday: day.weekday, sport: 'strength', kind: t.strength,
        minutes: day.strength.durationMin, line: (t.strengthKind as Record<string, string>)[day.strength.kind] ?? '',
        ...(entry ? { status: markKind(entry.status), statusWord: logStatusText(entry.status, true) } : {}),
        accent: 'accent',
      })
    }
    if (!out.length) out.push({ date: day.date, weekday: day.weekday, sport: 'rest', kind: t.rest, line: '', accent: 'muted' })
    return out
  })
}

/** Sesje planu v2: sport, cel sesji, dystans, czas treningu i rozpiska z kroków. */
export function sessionRows(sessions: TrainingSession[], opts: {
  status?: Map<string, { kind: RowMark['kind']; word: string }>
  ascii?: boolean
} = {}): SessionRow[] {
  const t = ui().rows
  return [...sessions].sort((a, z) => a.date.localeCompare(z.date) || (a.start ?? '').localeCompare(z.start ?? '')).map((s) => {
    const status = opts.status?.get(s.id)
    const weekday = (['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const)[new Date(`${s.date}T12:00:00Z`).getUTCDay()]!
    return {
      date: s.date, weekday, sport: s.sport,
      // siła ma sport „siła" w kolumnie sportu; typ byłby powtórzeniem
      kind: s.sport === 'strength' ? '' : t.purpose[s.purpose],
      ...(s.distanceM ? { km: s.distanceM / 1000 } : {}),
      minutes: (s.durationSec + s.preparationSec) / 60,
      // siła v2 nie ma kroków: kolumna sportu już mówi „siła"
      line: s.sport === 'strength' ? '' : sessionLine(s, { ascii: opts.ascii ?? false }),
      ...(status ? { status: status.kind, statusWord: status.word } : {}),
      accent: s.sport === 'strength' ? 'accent' : s.sport,
    }
  })
}

/** Czas `h:mm` w kolumnie czasu (wiersz jednostki, wydruk). */
export const hoursMinutes = (minutes: number | undefined): string => {
  if (minutes === undefined) return ''
  const total = Math.round(minutes)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

/**
 * Tabela wierszy z sumą. Dzień podpisany raz (kilka sesji dnia to kilka wierszy);
 * dzisiejszy wiersz bez statusu ma znacznik „dziś”. `sport` dokłada kolumnę sportu (v2).
 */
export function rowsTable(rows: SessionRow[], opts: { today?: string; sport?: boolean; dates?: boolean } = {}): Block {
  const t = ui().rows
  const locale = getLocale()
  const km = (value: number | undefined) => (value ? formatNumber(locale, value) : '')
  // tydzień v2 bez dystansów (sesje na czas): pusta kolumna km tylko zabierałaby miejsce rozpisce
  const distance = rows.some((r) => r.km)
  const day = (r: SessionRow) => `${messages().weekdayShort[r.weekday]}${opts.dates ? ` ${t.shortDate(r.date)}` : ''}`
  const cells = rows.map((r, i) => [
    i > 0 && rows[i - 1]!.date === r.date ? '' : day(r),
    ...(opts.sport ? [r.sport === 'rest' ? '' : t.sport[r.sport]] : []),
    r.kind,
    ...(distance ? [km(r.km)] : []),
    hoursMinutes(r.minutes),
    r.line,
  ])
  const marks = rows.map((r, i): RowMark | undefined =>
    r.status && r.statusWord ? { kind: r.status, word: r.statusWord }
      : r.date === opts.today && (i === 0 || rows[i - 1]!.date !== r.date) ? { kind: 'today', word: t.today }
        : undefined)
  const totalKm = rows.reduce((sum, r) => sum + (r.km ?? 0), 0)
  const totalMinutes = rows.reduce((sum, r) => sum + (r.minutes ?? 0), 0)
  return b.table(
    [t.columns.day, ...(opts.sport ? [t.columns.sport] : []), t.columns.kind, ...(distance ? [t.columns.km] : []), t.columns.time, t.columns.line],
    cells,
    rows.map((r) => r.accent),
    { foot: ['', ...(opts.sport ? [''] : []), t.total, ...(distance ? [km(totalKm)] : []), hoursMinutes(totalMinutes), ''], marks },
  )
}

/**
 * Struktura jednostki w `today` (C2): etap, dawka, cel, przerwa. Kolumna celu
 * i przerwy znika, gdy żaden etap jej nie ma (bieg spokojny bez przerw).
 */
export function structureTable(parts: StructureRow[], accent?: ColorName): Block {
  const t = ui().rows.structure
  const keep = [true, true, parts.some((p) => p.target), parts.some((p) => p.recovery)]
  const pick = <T>(cells: T[]) => cells.filter((_, i) => keep[i])
  return b.table(
    pick([t.part, t.dose, t.target, t.recovery]),
    parts.map((p) => pick([p.part, p.dose, p.target, p.recovery])),
    accent ? parts.map(() => accent) : undefined,
  )
}

/** Tydzień siatki sezonu (C2) — te same dane w tabeli i w `structuredContent`. */
export interface SeasonRow {
  week: number
  weekStart: string
  phase: string
  deload: boolean
  plannedKm?: number
  sessions?: number
  minutes?: number
  accents: string[]
  longKm?: number
  race: boolean
}

/** Jednostki jakościowe planu biegowego, których część główna trafia do kolumny akcentów. */
const ACCENT_KINDS = new Set(['quality_intervals', 'quality_continuous', 'easy_hills', 'sharpener', 'test'])

/** Siatka sezonu planu biegowego: faza, plan km, akcenty (C1 bez ramy), długie albo start. */
export function runningSeasonRows(weeks: Microcycle[], opts: { ascii?: boolean } = {}): SeasonRow[] {
  return weeks.map((week, i) => {
    const workouts = week.days.flatMap((d) => (d.workout ? [d.workout] : []))
    const long = workouts.find((w) => w.kind === 'long')
    return {
      week: i + 1, weekStart: week.weekStart, phase: week.skeleton.phase, deload: week.skeleton.deload === true,
      plannedKm: plannedWeekKm(week.skeleton),
      accents: workouts.filter((w) => ACCENT_KINDS.has(w.kind)).map((w) => accentLine(w, { ascii: opts.ascii ?? false })),
      ...(long ? { longKm: shownKm(long) } : {}),
      race: workouts.some((w) => w.kind === 'race'),
    }
  })
}

/** Siatka sezonu planu v2: liczba sesji, czas z przygotowaniem, akcenty z nazwą sportu. */
export function sessionsSeasonRows(sessions: TrainingSession[], opts: { ascii?: boolean } = {}): SeasonRow[] {
  const t = ui().rows
  const weeks = [...new Set(sessions.map((s) => mondayOf(s.date)))].sort()
  return weeks.map((weekStart, i) => {
    const list = sessions.filter((s) => mondayOf(s.date) === weekStart).sort((a, z) => a.date.localeCompare(z.date))
    // faza tygodnia: najczęstsza faza jego sesji (sesje bez fazy jej nie zmieniają)
    const phases = list.flatMap((s) => (s.phase ? [s.phase] : []))
    const phase = phases.sort((a, z) => phases.filter((p) => p === z).length - phases.filter((p) => p === a).length)[0] ?? ''
    return {
      week: i + 1, weekStart, phase, deload: phase === 'deload',
      sessions: list.length,
      minutes: list.reduce((sum, s) => sum + (s.durationSec + s.preparationSec) / 60, 0),
      accents: list.filter((s) => s.purpose === 'intervals' || s.purpose === 'race')
        .map((s) => `${t.sport[s.sport]} ${accentLine(s, { ascii: opts.ascii ?? false })}`),
      race: list.some((s) => s.purpose === 'race'),
    }
  })
}

/**
 * Tabela siatki sezonu (makieta C2): bieżący tydzień ze znacznikiem „dziś", odciążenie
 * strzałką przy numerze tygodnia. Bez wiersza sumy: przy 80 kolumnach każda kolumna
 * oddana akcentom to wiersz mniej (budżet: liczba tygodni + 10).
 * Plan biegowy ma kolumny km i długie, plan v2 liczbę sesji i czas.
 */
export function seasonTable(rows: SeasonRow[], opts: { today?: string; ascii?: boolean; sessions?: boolean } = {}): Block {
  const t = ui().rows, s = t.season
  const locale = getLocale()
  const sep = opts.ascii ? ' | ' : ' · '
  const deload = opts.ascii ? 'v' : '↓'
  const phaseText = (row: SeasonRow) => (s.phase as Record<string, string>)[row.phase] ?? row.phase
  // znacznik odciążenia przy numerze tygodnia, nie w kolumnie fazy: akcenty mają więcej miejsca
  const cells = rows.map((row) => [
    `${row.week}${row.deload ? ` ${deload}` : ''}`, t.shortDate(row.weekStart), phaseText(row),
    ...(opts.sessions
      ? [String(row.sessions ?? 0), hoursMinutes(row.minutes), row.accents.join(sep)]
      : [formatNumber(locale, row.plannedKm ?? 0), row.accents.join(sep), row.race ? messages().notation.race : row.longKm ? formatNumber(locale, row.longKm) : '']),
  ])
  const marks = rows.map((row): RowMark | undefined =>
    opts.today && opts.today >= row.weekStart && opts.today <= addDays(row.weekStart, 6) ? { kind: 'today', word: t.today } : undefined)
  const accent = rows.map((row): ColorName => (row.race ? 'race' : row.deload ? 'muted' : 'accent'))
  const c = s.columns
  if (!opts.sessions) return b.table([c.week, c.from, c.phase, c.km, c.accents, c.long], cells, accent, { marks })
  // plan v2 bez akcentów (np. baza): pusta kolumna akcentów zostaje pominięta
  const accents = rows.some((row) => row.accents.length > 0)
  return b.table(
    [c.week, c.from, c.phase, c.sessions, c.time, ...(accents ? [c.accents] : [])],
    accents ? cells : cells.map((row) => row.slice(0, -1)),
    accent, { marks },
  )
}

/**
 * Tabela wierszy jako Markdown (`PLAN.md`, C3): ten sam blok co w terminalu, więc
 * te same kolumny, podpis dnia raz i wiersz sumy. Bez znaczników — dokument planu
 * nie zna dziennika ani dzisiejszej daty.
 */
export function tableMarkdown(block: Block): string[] {
  if (block.t !== 'table') return []
  const cell = (value: string) => value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')
  const line = (cells: string[]) => `| ${cells.map(cell).join(' | ')} |`
  return [
    line(block.head),
    `|${block.head.map(() => '---').join('|')}|`,
    ...block.rows.map(line),
    ...(block.foot ? [line(block.foot.map((value) => (value ? `**${value}**` : '')))] : []),
  ]
}

/** Nagłówek dnia: „WT 27.10 · interwały · 8 km · około 66 min" (części puste pominięte). */
export function dayHeading(date: string, weekday: Weekday, parts: (string | undefined)[]): string {
  return [`${messages().weekdayShort[weekday]} ${ui().rows.shortDate(date)}`, ...parts.filter(Boolean)].join(' · ')
}
