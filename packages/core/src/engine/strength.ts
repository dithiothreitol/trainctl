/**
 * Siła dla biegacza (faza 10) — FOUNDATIONS §10.8 (F-*) i §10.7 (S-4/S-5).
 *
 * Rama uczciwości, zanim cokolwiek policzy się w kodzie:
 *  - uzasadnieniem jest EKONOMIA BIEGU i wynik w próbach laboratoryjnych
 *    1,5–10 km (F-8, F-17) — NIE prewencja urazów (F-9/F-10) i NIE VO₂max;
 *  - u biegaczy 34–45 lat efekt na ekonomię jest statystycznie NIEISTOTNY
 *    (F-15) — moduł komunikuje niepewność, nie obiecuje sekund;
 *  - dowody nie sięgają maratonu ani realnych zawodów (F-17, N-22).
 *
 * Moduł jest OPT-IN (sekcja `strength` w tren.yaml) i nie zmienia ani jednego
 * kilometra planu biegowego — dokłada równoległą ścieżkę do istniejących dni.
 */
import type { MacroPhase, Microcycle, PlannedDay, StrengthSession, Weekday } from '../domain/types.ts'
import { addDays, diffDays } from '../util/dates.ts'

/** F-1/F-12: 2 sesje/tydz. w ładowaniu. */
const SESSIONS_PER_WEEK = 2
/** Tydzień odciążeniowy: 1 sesja — spójnie z duchem P-2 (wartość inż.). */
const SESSIONS_DELOAD = 1
/** Odstęp między sesjami siły: deficyt siły utrzymuje się do 48 h (S-5/de Carvalho). */
const MIN_GAP_DAYS = 2

const WEEKDAY_ORDER: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

/** Jednostki biegowe, których nie wolno osłabić siłą dzień wcześniej (S-5). */
const QUALITY_KINDS = new Set(['quality_intervals', 'quality_continuous', 'test', 'race'])

export const STRENGTH_SESSION: StrengthSession = {
  kind: 'heavy',
  durationMin: 35,
  ruleRefs: ['F-1', 'F-2', 'F-3', 'F-4'],
  description:
    'Siła ciężka ~35 min: przysiad lub martwy ciąg + wykroki + wspięcia na palce, ' +
    '3 serie × 4–6 powtórzeń CIĘŻKO (≥80% 1RM, ostatnie powtórzenie trudne, ale bez upadku ruchu), ' +
    'przerwy 2–3 min. Wielostawowo, wolny ciężar. Nie do wyczerpania (S-7).',
}

export interface StrengthWeekInput {
  week: Microcycle
  phase: MacroPhase
  deload: boolean
  /** Preferowane dni z konfiguracji — puste = wybór automatyczny. */
  daysPreference?: Weekday[]
}

export interface StrengthAssignment {
  /** Data → sesja; dni bez wpisu zostają bez siły. */
  byDate: Map<string, StrengthSession>
  notes: string[]
}

/**
 * Rozstawienie siły po tygodniu. Twarde ograniczenia:
 *  - taper i tydzień startowy: zero siły (F-13 — detraining nie kasuje efektu,
 *    a świeżość na start jest ważniejsza),
 *  - nigdy dzień przed akcentem/sprawdzianem/startem ani w te dni (S-5),
 *  - nigdy w dniu długiego wybiegania, ale **dzień przed długim wolno**: bieg
 *    submaksymalny 24 h po sile nie wykazuje pogorszenia (VO₂/HR/La bez zmian,
 *    de Carvalho e Silva 2022) — S-5 dotyczy sesji jakościowych. Bez tego
 *    wyjątku piątek przed sobotnim długim, czyli najnaturalniejszy dzień
 *    siłowni w tygodniu biegacza, byłby zawsze zablokowany,
 *  - ≥48 h między sesjami siły.
 * Preferencja: dni całkiem wolne od biegania (zero konfliktu S-4), potem dni
 * z biegiem spokojnym (bieg submaksymalny obok siły jest OK — S-5).
 */
export function planStrengthWeek(input: StrengthWeekInput): StrengthAssignment {
  const { week, phase, deload } = input
  const notes: string[] = []

  if (phase === 'taper' || phase === 'race') {
    notes.push('Taper: siła odstawiona — 4 tyg. bez siłowni nie kasuje adaptacji (F-13).')
    return { byDate: new Map(), notes }
  }

  const target = deload ? SESSIONS_DELOAD : SESSIONS_PER_WEEK
  const kindOf = (d: PlannedDay) => d.workout?.kind

  const blocked = new Set<string>()
  for (const day of week.days) {
    const kind = kindOf(day)
    if (!kind) continue
    if (QUALITY_KINDS.has(kind)) {
      blocked.add(day.date)
      blocked.add(addDays(day.date, -1)) // S-5: ciężka siła nie <24 h przed jakością
    } else if (kind === 'long') {
      blocked.add(day.date) // samego długiego nie obciążamy siłą tego samego dnia
    }
  }

  const preferred = input.daysPreference?.length
    ? week.days.filter((d) => input.daysPreference!.includes(d.weekday))
    : week.days
  // dni wolne od biegania przodem, potem spokojne; stabilnie wg kolejności tygodnia
  const candidates = [...preferred].sort((a, b) => {
    const restA = a.workout ? 1 : 0
    const restB = b.workout ? 1 : 0
    if (restA !== restB) return restA - restB
    return WEEKDAY_ORDER.indexOf(a.weekday) - WEEKDAY_ORDER.indexOf(b.weekday)
  })

  const byDate = new Map<string, StrengthSession>()
  for (const day of candidates) {
    if (byDate.size >= target) break
    if (blocked.has(day.date)) continue
    const tooClose = [...byDate.keys()].some((d) => Math.abs(diffDays(d, day.date)) < MIN_GAP_DAYS)
    if (tooClose) continue
    byDate.set(day.date, STRENGTH_SESSION)
  }

  if (byDate.size < target) {
    notes.push(
      `W tym tygodniu zmieściła się ${byDate.size} z ${target} sesji siły — akcenty i długie ` +
        'mają pierwszeństwo (S-5); nie upychamy siły kosztem jakości biegania.',
    )
  }
  return { byDate, notes }
}
