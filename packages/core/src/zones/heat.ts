/**
 * Korekta tempa startowego na temperaturę (FOUNDATIONS §10.13, H-*).
 *
 * Podstawa: El Helou 2012 (PLoS ONE, 10.1371/journal.pone.0037407), n = 1 791 972
 * finiszerów maratonu — model kwadratowy straty PRĘDKOŚCI względem temperatury
 * optymalnej, z parametrami osobno dla percentyli czasu finiszu. To jedyny znany
 * nam zbiór, który indeksuje efekt POZIOMEM biegacza, a nie tylko średnią.
 *
 * Trzy pułapki, które ten moduł rozbraja jawnie:
 *  1. Tabela podaje stratę PRĘDKOŚCI. Kara czasowa to `s/(100−s)`, nie `s`.
 *     Przy 21,4% straty prędkości kara czasu wynosi 27,3% — sześć punktów różnicy.
 *  2. Dane obejmują 1,7–25,2 °C. Powyżej 25 °C model MILCZY (odmawiamy liczby).
 *  3. Wolniejsi mają JEDNOCZEŚNIE wyższą temperaturę optymalną i stromszą
 *     parabolę — nie da się tego oddać przesunięciem jednej krzywej.
 *
 * Czego tu NIE ma, świadomie (N-25…N-28): członu wilgotności poniżej 30 °C
 * (w danych obserwacyjnych to artefakt korelacji z temperaturą), nasłonecznienia,
 * wiatru, korekty za aklimatyzację w s/km oraz krzywej dla półmaratonu.
 */

import { messages } from '../i18n/index.ts'

/** Zakres, w którym model ma pokrycie w danych (El Helou: 1,7–25,2 °C). */
export const HEAT_MODEL_MIN_C = 2
export const HEAT_MODEL_MAX_C = 25

/**
 * Parametry paraboli straty prędkości: `strata% = k · (T − tOpt)²`, wyłącznie
 * dla T > tOpt. Wartości `k` wyliczone z tabeli S3 El Helou 2012 (mężczyźni;
 * u kobiet gradient między percentylami zanika i jest sprzeczny między badaniami
 * — nie różnicujemy po płci, N-29).
 */
interface HeatCurve {
  /** Górna granica czasu finiszu [s], do której stosujemy tę krzywą. */
  maxFinishSec: number
  tOptC: number
  k: number
  /** Klucz etykiety w katalogu — nazwa krzywej jest tłumaczona przy odczycie. */
  label: 'curveElite' | 'curveFastAmateur' | 'curveMedian' | 'curveBackHalf'
}

const CURVES: HeatCurve[] = [
  // P1 (1. percentyl) ≈ maraton 2:41
  { maxFinishSec: 3 * 3600, tOptC: 3.8, k: 0.0145, label: 'curveElite' },
  // Q1 (25. percentyl) ≈ 3:32
  { maxFinishSec: 3.75 * 3600, tOptC: 6.0, k: 0.034, label: 'curveFastAmateur' },
  // mediana ≈ 3:57
  { maxFinishSec: 4.25 * 3600, tOptC: 6.2, k: 0.04, label: 'curveMedian' },
  // Q3 (75. percentyl) ≈ 4:28 i wolniej
  { maxFinishSec: Number.POSITIVE_INFINITY, tOptC: 7.4, k: 0.048, label: 'curveBackHalf' },
]

/**
 * Ekwiwalent maratoński czasu na danym dystansie — krzywe są zdefiniowane
 * na czasach maratonu, a użytkownik może biec dychę. Skalowanie wykładnikiem
 * Riegla 1,06 (W-5), wyłącznie po to, by wybrać właściwą krzywą.
 */
export function marathonEquivalentSec(distanceKm: number, totalSec: number): number {
  if (Math.abs(distanceKm - 42.195) < 0.5) return totalSec
  return totalSec * Math.pow(42.195 / distanceKm, 1.06)
}

export interface HeatAdjustment {
  tempC: number
  /** Strata prędkości [%] wg modelu. */
  speedLossPct: number
  /** Kara czasowa [%] — to jest liczba, którą widzi biegacz. */
  timePenaltyPct: number
  /** Skorygowany czas [s] i tempo [s/km]. */
  adjustedSec: number
  adjustedPaceSecPerKm: number
  /** O ile wolniejsze tempo niż w warunkach optymalnych [s/km]. */
  paceDeltaSecPerKm: number
  curveLabel: string
  tOptC: number
}

export type HeatOutcome =
  | { ok: true; adjustment: HeatAdjustment }
  | { ok: false; reason: string }

function curveFor(marathonSec: number): HeatCurve {
  return CURVES.find((c) => marathonSec <= c.maxFinishSec) ?? CURVES[CURVES.length - 1]!
}

/**
 * Korekta celu na temperaturę. Zwraca odmowę zamiast liczby, gdy warunki
 * wychodzą poza zakres danych — ekstrapolacja modelu kwadratowego rośnie
 * kwadratowo także w błędzie.
 */
export function adjustForHeat(
  distanceKm: number,
  targetSec: number,
  tempC: number,
): HeatOutcome {
  const m = messages()
  if (!Number.isFinite(tempC)) return { ok: false, reason: m.heat.invalidTemp }
  if (tempC < HEAT_MODEL_MIN_C) {
    return { ok: false, reason: m.heat.tooCold(tempC, HEAT_MODEL_MIN_C) }
  }
  if (tempC > HEAT_MODEL_MAX_C) {
    return { ok: false, reason: m.heat.tooHot(tempC, HEAT_MODEL_MAX_C) }
  }
  const curve = curveFor(marathonEquivalentSec(distanceKm, targetSec))
  const delta = tempC - curve.tOptC
  const speedLossPct = delta <= 0 ? 0 : curve.k * delta * delta
  // strata prędkości → kara czasu: t' = t / (1 − s)
  const timePenaltyPct = (speedLossPct / (100 - speedLossPct)) * 100
  const adjustedSec = targetSec * (1 + timePenaltyPct / 100)
  return {
    ok: true,
    adjustment: {
      tempC,
      speedLossPct: Math.round(speedLossPct * 100) / 100,
      timePenaltyPct: Math.round(timePenaltyPct * 100) / 100,
      adjustedSec: Math.round(adjustedSec),
      adjustedPaceSecPerKm: Math.round(adjustedSec / distanceKm),
      paceDeltaSecPerKm: Math.round((adjustedSec - targetSec) / distanceKm),
      curveLabel: m.heat[curve.label],
      tOptC: curve.tOptC,
    },
  }
}

/**
 * Siatka temperatur do tabeli w pakiecie startowym: od optimum WYBRANEJ krzywej
 * w górę, co 2 °C. Gęsty krok jest celowy — krzywa jest kwadratowa, więc
 * interpolacja liniowa między odległymi wierszami to dokładnie ten błąd,
 * którego zakazuje N-26.
 */
export function heatLadder(distanceKm: number, targetSec: number): HeatAdjustment[] {
  const probe = adjustForHeat(distanceKm, targetSec, HEAT_MODEL_MAX_C)
  if (!probe.ok) return []
  const start = Math.ceil(probe.adjustment.tOptC)
  const out: HeatAdjustment[] = []
  for (let t = start; t <= HEAT_MODEL_MAX_C; t += 2) {
    const r = adjustForHeat(distanceKm, targetSec, t)
    if (r.ok) out.push(r.adjustment)
  }
  return out
}
