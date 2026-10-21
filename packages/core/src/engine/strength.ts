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
 * Moduł jest OPT-IN (sekcja `strength` w trainctl.yaml) i nie zmienia ani jednego
 * kilometra planu biegowego — dokłada równoległą ścieżkę do istniejących dni.
 */
import type { MacroPhase, Microcycle, PlannedDay, StrengthSession, Weekday } from '../domain/types.ts'
import { messages } from '../i18n/index.ts'
import { addDays, diffDays } from '../util/dates.ts'

/** F-1/F-12: 2 sesje/tydz. w ładowaniu. */
const SESSIONS_PER_WEEK = 2
/** F-12: 0–1×/tydz. w okresie startowym; F-14: jedna sesja utrzymuje przyrost. */
const SESSIONS_PEAK = 1
/** F-18 (inż.): dwa pierwsze tygodnie bloku to wejście w ruch, zanim przyjdzie ≥80% 1RM. */
const INTRO_WEEKS = 2
/** Tydzień odciążeniowy: 1 sesja — spójnie z duchem P-2 (wartość inż.). */
const SESSIONS_DELOAD = 1
/** Odstęp między sesjami siły: deficyt siły utrzymuje się do 48 h (S-5/de Carvalho). */
const MIN_GAP_DAYS = 2

const WEEKDAY_ORDER: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

/** Jednostki biegowe, których nie wolno osłabić siłą dzień wcześniej (S-5). */
const QUALITY_KINDS = new Set(['quality_intervals', 'quality_continuous', 'test', 'race'])

/**
 * Nowy obiekt na każdy dzień — nigdy współdzielona instancja. Plan jest
 * serializowany do YAML-a, który użytkownik czyta i edytuje (plan-as-code):
 * współdzielona referencja zamieniłaby 22 z 23 sesji w aliasy `*a2`, a edycja
 * jednego dnia zmieniłaby wszystkie.
 */
export function strengthSession(variant: StrengthSession['kind'] = 'heavy'): StrengthSession {
  if (variant === 'intro') {
    return { kind: 'intro', durationMin: 35, ruleRefs: ['F-1', 'F-3', 'F-18'], description: messages().strength.sessionIntro() }
  }
  if (variant === 'maintenance') {
    return { kind: 'maintenance', durationMin: 25, ruleRefs: ['F-12', 'F-14', 'F-4'], description: messages().strength.sessionMaintenance() }
  }
  return {
    kind: 'heavy',
    durationMin: 35,
    ruleRefs: ['F-1', 'F-2', 'F-3', 'F-4'],
    description: messages().strength.session(),
  }
}

/** Wariant sesji dla tygodnia: wejście w blok, ładowanie albo podtrzymanie w szczycie. */
export function strengthVariant(phase: MacroPhase, blockWeek: number): StrengthSession['kind'] {
  if (phase === 'peak') return 'maintenance'
  return blockWeek < INTRO_WEEKS ? 'intro' : 'heavy'
}

export interface StrengthWeekInput {
  week: Microcycle
  phase: MacroPhase
  deload: boolean
  /** Preferowane dni z konfiguracji — puste = wybór automatyczny. */
  daysPreference?: Weekday[]
  /**
   * Data ostatniej sesji siłowej z POPRZEDNIEGO tygodnia. Bez tego odstęp
   * ≥48 h obowiązywałby tylko wewnątrz tygodnia i łamałby się na styku
   * niedziela→poniedziałek.
   */
  lastSessionDate?: string
  /** Który to tydzień bloku siły (0 = pierwszy) — wybiera wariant sesji. */
  blockWeek?: number
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
    notes.push(messages().strength.taperNote)
    return { byDate: new Map(), notes }
  }
  // R-9 (inż.): po starcie siła wraca dopiero w drugim tygodniu bloku, jedną sesją wejścia
  const firstTransitionWeek = phase === 'transition' && week.skeleton.qualitySessions === 0
  if (firstTransitionWeek) {
    notes.push(messages().strength.transitionNote)
    return { byDate: new Map(), notes }
  }

  const target = phase === 'peak' || phase === 'transition' ? SESSIONS_PEAK : deload ? SESSIONS_DELOAD : SESSIONS_PER_WEEK
  const variant = phase === 'transition' ? 'intro' : strengthVariant(phase, input.blockWeek ?? INTRO_WEEKS)
  if (phase === 'peak') notes.push(messages().strength.peakNote)
  const kindOf = (d: PlannedDay) => d.workout?.kind

  const blocked = new Set<string>()
  for (const day of week.days) {
    const kind = kindOf(day)
    if (!kind) continue
    if (QUALITY_KINDS.has(kind)) {
      blocked.add(day.date)
      blocked.add(addDays(day.date, -1)) // S-5: ciężka siła nie <24 h przed jakością
    } else if (kind === 'long' || kind === 'easy_hills') {
      // Długiego nie dokładamy sobie tego samego dnia; podbiegi to praca
      // ekscentryczna tych samych mięśni co przysiad — łączenie ich w jednym
      // dniu byłoby podwójnym obciążeniem, przed którym CLI i tak ostrzega.
      // Dzień PRZED nimi wolno: to nie są sesje jakościowe w rozumieniu S-5.
      blocked.add(day.date)
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
  // odstęp liczymy także wstecz, do ostatniej sesji z poprzedniego tygodnia
  const placed: string[] = input.lastSessionDate ? [input.lastSessionDate] : []
  for (const day of candidates) {
    if (byDate.size >= target) break
    if (blocked.has(day.date)) continue
    const tooClose = placed.some((d) => Math.abs(diffDays(d, day.date)) < MIN_GAP_DAYS)
    if (tooClose) continue
    byDate.set(day.date, strengthSession(variant))
    placed.push(day.date)
  }

  if (byDate.size < target) {
    // Uczciwie o przyczynie: zawężenie dni przez użytkownika to co innego niż
    // ciasny tydzień biegowy. Zmyślanie powodu byłoby dokładnie tym, czego
    // ten moduł ma nie robić (ADR-022).
    const narrowed = (input.daysPreference?.length ?? 7) < 7
    notes.push(
      narrowed
        ? messages().strength.shortfallByDays(byDate.size, target, input.daysPreference!.join(', '))
        : messages().strength.shortfallByAccents(byDate.size, target),
    )
  }
  return { byDate, notes }
}
