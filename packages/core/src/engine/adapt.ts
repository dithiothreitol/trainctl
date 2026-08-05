/**
 * Adaptacja planu na danych wykonania (FOUNDATIONS §10.3, §10.6).
 *
 * Zasada nadrzędna: silnik **proponuje**, nie przepisuje planu po cichu.
 * Wynikiem jest diagnoza + lista działań z uzasadnieniem — użytkownik (albo
 * agent) decyduje, co zastosować. To bezpośrednia konsekwencja filaru
 * plan-as-code: zmiana planu ma być widocznym diffem.
 *
 * Czego NIE robimy (anty-wzorce §10.12):
 *  - nie liczymy ACWR i nie mówimy językiem ryzyka urazu (P-4),
 *  - nie „nadrabiamy" opuszczonych kilometrów (dokładanie objętości po przerwie
 *    to odwrotność tego, co wynika z P-1/P-3),
 *  - nie udzielamy porad medycznych (R-7).
 */
import type { RaceResult, WorkoutKind } from '../domain/types.ts'
import { diffDays } from '../util/dates.ts'

export interface ExecutionRecord {
  date: string
  plannedKm: number
  actualKm?: number
  kind?: WorkoutKind
  /** Dzień z planu bez wykonania i bez logu = pominięty. */
  status: 'done' | 'missed' | 'unplanned' | 'rest'
}

export interface AdaptationAction {
  type:
    | 'recalibrate-zones'
    | 'reduce-volume'
    | 'hold-course'
    | 'post-race-recovery'
    | 'conservative-restart'
    | 'raise-baseline'
  detail: string
  suggestedWeeklyKm?: number
  ruleRefs: string[]
}

export interface AdaptationProposal {
  windowDays: number
  complianceKm: number
  missedSessions: number
  diagnosis: string[]
  actions: AdaptationAction[]
  warnings: string[]
}

export interface AdaptationInput {
  today: string
  /** Ostatnie dni wykonania — zwykle 21–28. */
  execution: ExecutionRecord[]
  /** Bieżąca objętość docelowa z planu [km/tydz.]. */
  currentWeeklyKm: number
  /** Wyniki startów nowsze niż kalibracja planu. */
  newResults?: RaceResult[]
  /** Dystans ostatniego startu — dla protokołu powrotu (R-1/R-3). */
  lastRace?: { date: string; distanceKm: number }
}

const WINDOW_DAYS = 21
/** Przerwa, po której wracamy konserwatywnie zamiast kontynuować progresję. */
const LAYOFF_DAYS = 10

export function analyzeExecution(input: AdaptationInput): AdaptationProposal {
  const from = new Date(Date.parse(input.today) - WINDOW_DAYS * 86_400_000)
    .toISOString()
    .slice(0, 10)
  const window = input.execution
    .filter((e) => e.date >= from && e.date <= input.today)
    .sort((a, b) => a.date.localeCompare(b.date))

  const plannedKm = window.reduce((s, e) => s + e.plannedKm, 0)
  const actualKm = window.reduce((s, e) => s + (e.actualKm ?? 0), 0)
  const compliance = plannedKm > 0 ? actualKm / plannedKm : 1
  const missedSessions = window.filter((e) => e.status === 'missed').length
  const missedQuality = window.filter(
    (e) => e.status === 'missed' && (e.kind === 'quality_intervals' || e.kind === 'quality_continuous'),
  ).length

  const diagnosis: string[] = []
  const actions: AdaptationAction[] = []
  const warnings: string[] = []

  // 1) Najdłuższa przerwa bez biegania w oknie
  const runDays = window.filter((e) => (e.actualKm ?? 0) > 0).map((e) => e.date)
  const lastRun = runDays.at(-1)
  const layoff = lastRun ? diffDays(lastRun, input.today) : WINDOW_DAYS
  if (layoff >= LAYOFF_DAYS) {
    diagnosis.push(`${layoff} dni bez biegania — plan sprzed przerwy jest nieaktualny.`)
    actions.push({
      type: 'conservative-restart',
      detail:
        `Restart: objętość ×0,5–0,6 (≈${Math.round(input.currentWeeklyKm * 0.55)} km/tydz.), ` +
        'bez sesji Z3 przez 5–7 dni, potem normalna progresja. ' +
        'Nie nadrabiamy opuszczonych kilometrów.',
      suggestedWeeklyKm: Math.round(input.currentWeeklyKm * 0.55),
      ruleRefs: ['R-5', 'P-3'],
    })
    warnings.push(
      'Protokół restartu po przerwie to ekstrapolacja bez bezpośredniego źródła (R-5) — ' +
        'traktuj jako punkt wyjścia, nie normę.',
    )
  }

  // 2) Świeży start — protokół powrotu (R-1/R-2/R-3)
  if (input.lastRace) {
    const sinceRace = diffDays(input.lastRace.date, input.today)
    if (sinceRace >= 0 && sinceRace <= 6) {
      const ultra = input.lastRace.distanceKm > 42.5
      diagnosis.push(
        `${sinceRace} dni po starcie na ${input.lastRace.distanceKm} km — okres powrotu.`,
      )
      actions.push({
        type: 'post-race-recovery',
        detail: ultra
          ? 'Ultra: dłuższa cisza niż po maratonie, powrót wg samopoczucia — brak danych, ' +
            'żeby podać konkretny protokół.'
          : sinceRace < 2
            ? 'Pierwsze 48 h bez biegania. Potem 40 min w tempie okolic LT1 co drugi dzień ' +
              '(48/96/144 h) — powrót w 48 h nie pogarsza regeneracji, poprawia skoczność w 96 h.'
            : 'Lekkie bieganie ~40 min w tempie spokojnym co drugi dzień; bez akcentów ' +
              'do końca pierwszego tygodnia.',
        ruleRefs: ultra ? ['R-3'] : ['R-1', 'R-2'],
      })
      if (ultra) {
        warnings.push('Brak źródeł dla powrotu po ultra — reguły maratońskiej NIE ekstrapolujemy (R-3).')
      }
    }
  }

  // 3) Nowy wynik startu → rekalibracja stref
  if (input.newResults?.length) {
    const latest = [...input.newResults].sort((a, b) => a.date.localeCompare(b.date)).at(-1)!
    diagnosis.push(`Nowy wynik: ${latest.distanceKm} km (${latest.date}) — strefy do przeliczenia.`)
    actions.push({
      type: 'recalibrate-zones',
      detail:
        'Dopisz wynik do athlete.results i wygeneruj plan ponownie — strefy kalibrujemy ' +
        'z wyników startów, nie z odczytów zegarka.',
      ruleRefs: ['Z-9', 'Z-6'],
    })
  }

  // 4) Zgodność objętości
  if (plannedKm > 0 && layoff < LAYOFF_DAYS) {
    if (compliance < 0.7) {
      const realistic = Math.max(10, Math.round((actualKm / WINDOW_DAYS) * 7))
      diagnosis.push(
        `Wykonano ${Math.round(compliance * 100)}% zaplanowanej objętości ` +
          `(${Math.round(actualKm)} z ${Math.round(plannedKm)} km).`,
      )
      actions.push({
        type: 'reduce-volume',
        detail:
          `Plan jest napisany na objętość, której nie realizujesz. Urealnij bazę do ` +
          `≈${realistic} km/tydz. (średnia z ostatnich 3 tyg.) i progresuj od niej. ` +
          'Plan wykonywany w 100% bije ambitniejszy plan wykonywany w 60%.',
        suggestedWeeklyKm: realistic,
        ruleRefs: ['P-1', 'P-3'],
      })
    } else if (compliance > 1.2 && missedSessions === 0) {
      const raised = Math.round(input.currentWeeklyKm * 1.1)
      diagnosis.push(`Regularnie przekraczasz plan (${Math.round(compliance * 100)}% objętości).`)
      actions.push({
        type: 'raise-baseline',
        detail:
          `Podnieś bazę w tren.yaml do ≈${raised} km/tydz. — ale kolejny cykl i tak ` +
          'ograniczy wzrost do ~10%/tydz.; skoki objętości nie kupują formy szybciej.',
        suggestedWeeklyKm: raised,
        ruleRefs: ['P-3'],
      })
    } else {
      diagnosis.push(
        `Wykonanie zgodne z planem (${Math.round(compliance * 100)}% objętości, ` +
          `${missedSessions} pominiętych sesji).`,
      )
      actions.push({
        type: 'hold-course',
        detail: 'Bez zmian — kontynuuj bieżący mezocykl.',
        ruleRefs: [],
      })
    }
  }

  // 5) Akcenty: sygnał jakościowy niezależny od kilometrów
  if (missedQuality >= 2) {
    diagnosis.push(
      `Pominięte akcenty: ${missedQuality}. To one, nie kilometry, budują górny zakres formy.`,
    )
    warnings.push(
      'Jeśli akcenty regularnie wypadają przez pracę — przesuwaj je (tren shift), ' +
        'zamiast je tracić. Dwie sesje jakościowe w tygodniu to cel (I-8).',
    )
  }

  return {
    windowDays: WINDOW_DAYS,
    complianceKm: Math.round(compliance * 100) / 100,
    missedSessions,
    diagnosis,
    actions,
    warnings,
  }
}
