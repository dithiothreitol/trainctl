/**
 * Critical speed z dwóch prób/wyników (model liniowy dystans–czas):
 *   d = CS·t + D'   →   CS = (d2−d1)/(t2−t1),  D' = d1 − CS·t1
 *
 * Zakres stosowalności (FOUNDATIONS Z-7, W-6): próby 2–20 min (1200 m + 3600 m
 * lub 3 min + 12 min); predykcja sensowna dla 1500–5000 m. Poza zakresem
 * zwracamy ostrzeżenia zamiast odmowy — decyzja należy do warstwy wyżej.
 */
import { messages } from '../i18n/index.ts'

export interface CriticalSpeedModel {
  /** m/s */
  cs: number
  /** m — zasób pracy beztlenowej (D-prime) */
  dPrime: number
  warnings: string[]
}

export interface TimeTrial {
  distanceM: number
  timeSec: number
}

export function criticalSpeed(a: TimeTrial, b: TimeTrial): CriticalSpeedModel {
  const [t1, t2] = a.timeSec < b.timeSec ? [a, b] : [b, a]
  if (t2.timeSec === t1.timeSec) {
    throw new Error(messages().zones.sameDuration)
  }
  const cs = (t2.distanceM - t1.distanceM) / (t2.timeSec - t1.timeSec)
  const dPrime = t1.distanceM - cs * t1.timeSec
  const warnings: string[] = []
  if (t1.timeSec < 120) warnings.push(messages().zones.trialTooShort)
  if (t2.timeSec > 1200) warnings.push(messages().zones.trialTooLong)
  if (dPrime < 0) warnings.push(messages().zones.negativeDPrime)
  return { cs, dPrime, warnings }
}

/** Tempo (s/km) na dystansie wg modelu CS; W-6: wiarygodne 1500–5000 m. */
export function csPredictTimeSec(model: CriticalSpeedModel, distanceM: number): number {
  return (distanceM - model.dPrime) / model.cs
}

export function csToSecPerKm(cs: number): number {
  return 1000 / cs
}
