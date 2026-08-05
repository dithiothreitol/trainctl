/**
 * VDOT wg Danielsa-Gilberta: kalibracja wydolności i stref tempa z WYNIKU STARTU,
 * nie z zegarka (FOUNDATIONS Z-6: zegarki zawyżają tempo progowe o 1–2 km/h).
 *
 * Równania oryginalne (Daniels & Gilbert 1979, powszechnie reprodukowane):
 *   VO2(v)  = -4.60 + 0.182258·v + 0.000104·v²         [v w m/min]
 *   F(t)    = 0.8 + 0.1894393·e^(-0.012778·t) + 0.2989558·e^(-0.1932605·t)  [t w min]
 *   VDOT    = VO2(v_startu) / F(t_startu)
 *
 * Ograniczenia stosowalności: W-3 (VDOT wiarygodny ≤HM i dla szybszych biegaczy;
 * MAE 10,43% przy maratonie ~5 h) — egzekwowane w zones/predict.ts.
 */
import type { PaceRange } from '../domain/types.ts'

export function vo2AtVelocity(mPerMin: number): number {
  return -4.6 + 0.182258 * mPerMin + 0.000104 * mPerMin * mPerMin
}

export function fractionAtDuration(minutes: number): number {
  return (
    0.8 +
    0.1894393 * Math.exp(-0.012778 * minutes) +
    0.2989558 * Math.exp(-0.1932605 * minutes)
  )
}

/** Odwrócenie VO2(v) — dodatni pierwiastek równania kwadratowego. */
export function velocityAtVo2(vo2: number): number {
  const a = 0.000104
  const b = 0.182258
  const c = -4.6 - vo2
  return (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a)
}

export function vdotFromRace(distanceKm: number, timeSec: number): number {
  const minutes = timeSec / 60
  const velocity = (distanceKm * 1000) / minutes
  return vo2AtVelocity(velocity) / fractionAtDuration(minutes)
}

/** Czas na dystansie przy danym VDOT — bisekcja po t: VO2(v(t)) = F(t)·VDOT. */
export function predictTimeSec(distanceKm: number, vdot: number): number {
  const meters = distanceKm * 1000
  let loMin = (distanceKm * 120) / 60 // 2:00/km — szybciej człowiek nie pobiegnie
  let hiMin = (distanceKm * 900) / 60 // 15:00/km
  for (let i = 0; i < 60; i++) {
    const mid = (loMin + hiMin) / 2
    const need = vo2AtVelocity(meters / mid) - fractionAtDuration(mid) * vdot
    if (need > 0) loMin = mid // za szybko dla tego VDOT -> wydłuż czas
    else hiMin = mid
  }
  return ((loMin + hiMin) / 2) * 60
}

function paceAtVo2Fraction(vdot: number, fraction: number): number {
  return 60000 / velocityAtVo2(vdot * fraction) // s/km
}

function range(vdot: number, loFrac: number, hiFrac: number): PaceRange {
  // wyższy %VO2max => szybsze tempo => mniejsze s/km
  return {
    loSecPerKm: Math.round(paceAtVo2Fraction(vdot, hiFrac)),
    hiSecPerKm: Math.round(paceAtVo2Fraction(vdot, loFrac)),
  }
}

/**
 * Strefy Danielsa jako %VO2max — zakresy z "Daniels' Running Formula";
 * R jako % przybliżone (książka definiuje R przez tempo startowe na milę,
 * nie %VO2max) — APROKSYMACJA INŻYNIERSKA do kalibracji backtestem na korpusie.
 */
export const DANIELS_FRACTIONS = {
  easy: [0.59, 0.74],
  marathon: [0.75, 0.84],
  threshold: [0.83, 0.88],
  interval: [0.95, 1.0],
  repetition: [1.05, 1.1], // aproksymacja
} as const

export interface PaceZones {
  easy: PaceRange
  marathon: PaceRange
  threshold: PaceRange
  interval: PaceRange
  repetition: PaceRange
  /**
   * Model 3-strefowy (Z-1): LT2 ≈ środek strefy T; LT1 ≈ granica easy/marathon.
   * Mapowanie Daniels→LT to aproksymacja inżynierska — hooki na pomiar
   * (Z-2: kotwice zależne od płci przy danych HR/vPeak) w dalszych fazach.
   */
  lt1SecPerKm: number
  lt2SecPerKm: number
}

export function paceZones(vdot: number): PaceZones {
  const f = DANIELS_FRACTIONS
  const threshold = range(vdot, f.threshold[0], f.threshold[1])
  const easy = range(vdot, f.easy[0], f.easy[1])
  const marathon = range(vdot, f.marathon[0], f.marathon[1])
  return {
    easy,
    marathon,
    threshold,
    interval: range(vdot, f.interval[0], f.interval[1]),
    repetition: range(vdot, f.repetition[0], f.repetition[1]),
    lt1SecPerKm: Math.round((easy.loSecPerKm + marathon.hiSecPerKm) / 2),
    lt2SecPerKm: Math.round((threshold.loSecPerKm + threshold.hiSecPerKm) / 2),
  }
}
