/**
 * PLAN-v0.7 D2, D3: wykonanie wobec celu jednostki — fakty do `review`.
 *
 * D2: odcinki akcentu z okrążeń (port sync, D1) dopasowane do powtórzeń planu
 * po kolejności i długości. Okrążenia automatyczne (co kilometr) nie pasują do
 * struktury i dają `no-match` — bez zgadywania, które okrążenie było odcinkiem.
 * D3: średnie tempo biegu spokojnego i długiego wobec zakresu strefy spokojnej.
 *
 * Granica (ADR-011, ADR-027): to opis, nie ocena. Wynik nie zmienia objętości,
 * stref ani planu. Tętna nie oceniamy (Z-3, Z-6): kotwicą jest tempo.
 */
import type { PaceRange, PlannedWorkout } from '../domain/types.ts'
import type { ActivityLap } from '../ports/sync.ts'

/** Powtórzenie planu: długość odcinka i cel tempa (jeśli segment go ma). */
export interface RepTarget {
  repM: number
  pace?: PaceRange
}

export type PaceVerdict = 'within' | 'faster' | 'slower'

/** Okrążenie dopasowane do powtórzenia planu. */
export interface MatchedRep {
  repM: number
  distanceKm: number
  movingTimeSec: number
  paceSecPerKm: number
  /** Wobec celu tempa odcinka; bez celu (np. stary plan) brak. */
  vsTarget?: PaceVerdict
}

export interface IntervalsExecution {
  /** Liczba powtórzeń w planie. */
  planned: number
  /** Dopasowane okrążenia w kolejności planu. */
  matched: MatchedRep[]
  /** Dopasowane odcinki w zakresie celu (z tolerancją pomiaru). */
  inRange: number
  /** Okrążenia długości odcinka planu ponad dopasowane (np. szósty odcinek przy pięciu). */
  extra: number
  /** Brak dopasowania: `no-laps` — dane bez okrążeń, `no-match` — okrążenia nie pasują do struktury planu. */
  reason?: 'no-laps' | 'no-match'
}

export interface EasyPaceExecution {
  paceSecPerKm: number
  range: PaceRange
  vsRange: PaceVerdict
}

/**
 * E-3 (inż.): okrążenie pasuje do odcinka, gdy długość różni się o najwyżej 10%
 * albo 30 m. GPS i ręczne naciśnięcie przycisku dają kilka procent; 10% oddziela
 * jeszcze odcinek 1000 m od 800 m i 1200 m.
 */
const REP_DISTANCE_SHARE = 0.1
const REP_DISTANCE_MIN_M = 30
/**
 * E-3 (inż.): okrążenia automatyczne bez znanego sposobu zamknięcia (hub) — co najmniej
 * trzy pełne okrążenia, z których 75% ma długość w granicach 2% od mediany (ostatnie,
 * zwykle niepełne, pomijamy).
 */
const AUTOLAP_MIN_LAPS = 3
const AUTOLAP_SHARE = 0.75
const AUTOLAP_SPREAD = 0.02
/**
 * E-3 (inż.): tolerancja tempa na granicach zakresu. Błąd dystansu ~1% to ±2–3 s/km
 * przy tempach 4–5 min/km, więc różnica do 3 s/km nie wychodzi poza zakres.
 */
export const PACE_TOLERANCE_SEC = 3

/** Powtórzenia jednostki w kolejności: każdy segment `intervals` z liczbą i długością odcinka. */
export function plannedReps(workout: PlannedWorkout): RepTarget[] {
  return workout.segments.flatMap((s) =>
    s.type === 'intervals' && s.reps && s.reps > 0 && s.repM && s.repM > 0
      ? Array.from({ length: s.reps }, (): RepTarget => (s.pace ? { repM: s.repM!, pace: s.pace } : { repM: s.repM! }))
      : [],
  )
}

/** Tempo wobec zakresu z tolerancją pomiaru (`lo` to szybsza granica). */
export function paceVerdict(paceSecPerKm: number, range: PaceRange): PaceVerdict {
  if (paceSecPerKm < range.loSecPerKm - PACE_TOLERANCE_SEC) return 'faster'
  if (paceSecPerKm > range.hiSecPerKm + PACE_TOLERANCE_SEC) return 'slower'
  return 'within'
}

const lapPace = (lap: ActivityLap): number => lap.movingTimeSec / lap.distanceKm

const fits = (lap: ActivityLap, rep: RepTarget): boolean =>
  Math.abs(lap.distanceKm * 1000 - rep.repM) <= Math.max(REP_DISTANCE_SHARE * rep.repM, REP_DISTANCE_MIN_M)

/**
 * Okrążenia automatyczne. Gdy plik mówi, jak okrążenia się zamknęły (FIT, TCX), rozstrzyga
 * to: wszystkie po dystansie to autolap, ręczne nie (kilometr szybko, kilometr truchtu).
 * Bez tej informacji — prawie wszystkie pełne okrążenia tej samej długości.
 */
function autoLaps(laps: ActivityLap[]): boolean {
  const full = laps.slice(0, -1)
  if (full.length < AUTOLAP_MIN_LAPS) return false
  if (full.every((l) => l.trigger !== undefined)) return full.every((l) => l.trigger === 'distance')
  const sorted = full.map((l) => l.distanceKm).sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)]!
  if (!(median > 0)) return false
  const same = full.filter((l) => Math.abs(l.distanceKm - median) <= AUTOLAP_SPREAD * median).length
  return same >= AUTOLAP_SHARE * full.length
}

/**
 * Najdłuższe dopasowanie okrążeń do powtórzeń z zachowaniem kolejności (jak LCS):
 * odcinek opuszczony w środku serii nie przesuwa reszty. Przy remisie okrążenie
 * trafia do wcześniejszego powtórzenia planu. Wynik: pary powtórzenie–kandydat.
 */
function align(candidates: ActivityLap[], reps: RepTarget[]): { rep: number; candidate: number }[] {
  const n = candidates.length
  const m = reps.length
  const best: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      const take = fits(candidates[i]!, reps[j]!) ? 1 + best[i + 1]![j + 1]! : 0
      best[i]![j] = Math.max(take, best[i + 1]![j]!, best[i]![j + 1]!)
    }
  }
  const pairs: { rep: number; candidate: number }[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (fits(candidates[i]!, reps[j]!) && best[i]![j] === 1 + best[i + 1]![j + 1]!) {
      pairs.push({ rep: j, candidate: i })
      i++
      j++
    } else if (best[i + 1]![j] === best[i]![j]) i++
    else j++
  }
  return pairs
}

/**
 * D2: okrążenia biegu wobec powtórzeń planu.
 *
 * - Okrążenia z rolą (zegarek z treningiem strukturalnym, interwały huba): odcinki
 *   to okrążenia „praca"; rozgrzewka, przerwy i schłodzenie odpadają.
 * - Okrążenia bez roli (ręczny przycisk): odcinek musi być szybszy niż strefa
 *   spokojna, a dwa dopasowane odcinki nie mogą sąsiadować — między nimi jest przerwa.
 *   Okrążenia automatyczne (wszystkie tej samej długości) nie pasują do struktury.
 */
export function matchReps(reps: RepTarget[], laps: ActivityLap[] | undefined, easy: PaceRange): IntervalsExecution {
  const none = (reason: 'no-laps' | 'no-match'): IntervalsExecution => ({ planned: reps.length, matched: [], inRange: 0, extra: 0, reason })
  const usable = (laps ?? []).filter((l) => l.distanceKm >= 0 && l.movingTimeSec > 0)
  if (!usable.length) return none('no-laps')
  const roles = usable.some((l) => l.intensity !== undefined && l.intensity !== 'work')
  if (!roles && autoLaps(usable)) return none('no-match')
  const indexed = usable
    .map((lap, index) => ({ lap, index }))
    .filter(({ lap }) => lap.distanceKm > 0 && (roles ? lap.intensity === 'work' : lapPace(lap) < easy.loSecPerKm))
  const pairs = align(indexed.map((c) => c.lap), reps)
  if (!pairs.length) return none('no-match')
  if (!roles && pairs.some((p, k) => k > 0 && indexed[p.candidate]!.index - indexed[pairs[k - 1]!.candidate]!.index === 1)) {
    return none('no-match')
  }
  const used = new Set(pairs.map((p) => p.candidate))
  const extra = indexed.filter((c, k) => !used.has(k) && reps.some((r) => fits(c.lap, r))).length
  const matched = pairs.map(({ rep, candidate }): MatchedRep => {
    const lap = indexed[candidate]!.lap
    const target = reps[rep]!
    const pace = Math.round(lapPace(lap))
    return {
      repM: target.repM,
      distanceKm: lap.distanceKm,
      movingTimeSec: lap.movingTimeSec,
      paceSecPerKm: pace,
      ...(target.pace ? { vsTarget: paceVerdict(pace, target.pace) } : {}),
    }
  })
  return { planned: reps.length, matched, inRange: matched.filter((r) => r.vsTarget === 'within').length, extra }
}

/**
 * D3: zakres tempa biegu spokojnego i długiego — strefa spokojna, poszerzona o zakres
 * zapisany w dniu (bieg długi ma go wolniejszego niż strefa, `buildLong`).
 */
export function easyBand(workout: PlannedWorkout, easyZone: PaceRange): PaceRange {
  const planned = workout.segments.find((s) => s.type === 'easy' && s.pace)?.pace
  if (!planned) return easyZone
  return {
    loSecPerKm: Math.min(easyZone.loSecPerKm, planned.loSecPerKm),
    hiSecPerKm: Math.max(easyZone.hiSecPerKm, planned.hiSecPerKm),
  }
}

/** D3: średnie tempo wobec zakresu biegu spokojnego. */
export function easyPace(paceSecPerKm: number, range: PaceRange): EasyPaceExecution {
  const pace = Math.round(paceSecPerKm)
  return { paceSecPerKm: pace, range, vsRange: paceVerdict(pace, range) }
}
