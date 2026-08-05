/**
 * Predykcja wyniku — implementacja reguł W-1…W-10 z FOUNDATIONS §10.9.
 * Naczelna zasada W-1: ZAWSZE przedział, nigdy pojedyncza liczba.
 */
import type { RaceResult } from '../domain/types.ts'
import { diffDays } from '../util/dates.ts'
import { predictTimeSec, vdotFromRace } from './daniels.ts'

export interface RacePrediction {
  distanceKm: number
  loSec: number
  midSec: number
  hiSec: number
  method: 'vdot' | 'hm-multiplier' | 'riegel-ultra'
  basedOn: RaceResult
  warnings: string[]
  ruleRefs: string[]
}

/** T2 = T1 · (D2/D1)^1.06 — Riegel 1981 (W-5: zakres źródła 3,5–230 min). */
export function riegelTimeSec(
  sourceTimeSec: number,
  sourceKm: number,
  targetKm: number,
  exponent = 1.06,
): number {
  return sourceTimeSec * Math.pow(targetKm / sourceKm, exponent)
}

const HM_KM = 21.0975
const MARATHON_KM = 42.195
/** W-2: maraton amatora = czas HM × 2,28 (R²=0,85, MAE 5,67%). */
const HM_TO_MARATHON = 2.28
const HM_TO_MARATHON_MAE = 0.0567

const isHm = (km: number) => km >= 20.9 && km <= 21.3
const isMarathon = (km: number) => km >= 42.0 && km <= 42.5

function pickSource(results: RaceResult[], targetKm: number, today?: string): RaceResult {
  const valid = results.filter((r) => r.distanceKm > 0 && r.timeSec > 0)
  if (valid.length === 0) throw new Error('Brak wyników do kalibracji (W-1)')
  const scored = valid.map((r) => {
    const distScore = Math.abs(Math.log(r.distanceKm / targetKm))
    const ageDays = today ? Math.max(0, diffDays(r.date, today)) : 0
    const stale = ageDays > 540 ? 1 : 0 // przeterminowane wyniki na koniec
    return { r, key: [stale, distScore, ageDays] as const }
  })
  scored.sort((a, b) => a.key[0] - b.key[0] || a.key[1] - b.key[1] || a.key[2] - b.key[2])
  return scored[0]!.r
}

export function predictRace(
  results: RaceResult[],
  targetKm: number,
  opts: { today?: string; durabilityFactor?: number } = {},
): RacePrediction {
  const warnings: string[] = []
  const ruleRefs: string[] = ['W-1']

  // Ultra: brak predykcji punktowej (W-7) — ekstrapolacja Riegla z szerokim pasmem
  if (targetKm > 42.5) {
    const source = pickSource(results, targetKm, opts.today)
    const base = riegelTimeSec(source.timeSec, source.distanceKm, targetKm)
    ruleRefs.push('W-5', 'W-7', 'W-8')
    warnings.push(
      'ultra: brak modelu predykcji o zweryfikowanej trafności — przedział szacunkowy',
      'durability: rozrzut indywidualny spadku CS 1–31% po 120 min (Hunter 2025)',
    )
    if (opts.durabilityFactor !== undefined) {
      const mid = base * (1 + opts.durabilityFactor)
      return {
        distanceKm: targetKm, method: 'riegel-ultra', basedOn: source,
        loSec: Math.round(mid * 0.95), midSec: Math.round(mid), hiSec: Math.round(mid * 1.05),
        warnings, ruleRefs,
      }
    }
    return {
      distanceKm: targetKm, method: 'riegel-ultra', basedOn: source,
      loSec: Math.round(base * 1.0), midSec: Math.round(base * 1.15), hiSec: Math.round(base * 1.31),
      warnings, ruleRefs,
    }
  }

  // Maraton: predyktor podstawowy = czas HM (W-2); VDOT tylko dla szybkich (W-3)
  if (isMarathon(targetKm)) {
    const hm = results.filter((r) => isHm(r.distanceKm) && r.timeSec > 0)
    if (hm.length > 0) {
      const source = pickSource(hm, targetKm, opts.today)
      const mid = source.timeSec * HM_TO_MARATHON
      ruleRefs.push('W-2')
      return {
        distanceKm: targetKm, method: 'hm-multiplier', basedOn: source,
        loSec: Math.round(mid * (1 - HM_TO_MARATHON_MAE)),
        midSec: Math.round(mid),
        hiSec: Math.round(mid * (1 + HM_TO_MARATHON_MAE)),
        warnings, ruleRefs,
      }
    }
    const source = pickSource(results, targetKm, opts.today)
    const mid = predictTimeSec(targetKm, vdotFromRace(source.distanceKm, source.timeSec))
    ruleRefs.push('W-3', 'W-4')
    warnings.push('brak wyniku z półmaratonu — predykcja VDOT jest optymistyczna na maratonie (W-4)')
    const mae = mid > 4 * 3600 ? 0.1043 : 0.0596 // W-3: MAE wg kohorty tempa
    if (mid > 4 * 3600) warnings.push('maraton >4 h: MAE VDOT 10,43% — traktuj jako zgrubny szacunek (W-3)')
    return {
      distanceKm: targetKm, method: 'vdot', basedOn: source,
      loSec: Math.round(mid * (1 - mae)), midSec: Math.round(mid), hiSec: Math.round(mid * (1 + mae)),
      warnings, ruleRefs,
    }
  }

  // Dystanse ≤ HM: VDOT (W-3: tu model jest wiarygodny)
  const source = pickSource(results, targetKm, opts.today)
  if (source.timeSec < 3.5 * 60 || source.timeSec > 230 * 60) {
    warnings.push('wynik źródłowy poza zakresem stosowalności ekstrapolacji 3,5–230 min (W-5)')
  }
  const mid = predictTimeSec(targetKm, vdotFromRace(source.distanceKm, source.timeSec))
  const band = 0.03 // wartość inżynierska pasma dla ≤HM; do kalibracji backtestem
  ruleRefs.push('W-3')
  return {
    distanceKm: targetKm, method: 'vdot', basedOn: source,
    loSec: Math.round(mid * (1 - band)), midSec: Math.round(mid), hiSec: Math.round(mid * (1 + band)),
    warnings, ruleRefs,
  }
}
