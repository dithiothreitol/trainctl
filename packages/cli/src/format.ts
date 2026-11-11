/** Drobne formaty wyjścia wspólne dla komend (bez kolorów, ADR-013). */
import { formatNumber, getLocale } from 'trainctl-core'
import { ui } from './i18n/index.ts'

/**
 * Dystans w formacie języka: „21,1 km" po polsku, „21.1 km" po angielsku.
 * Ręcznie edytowany log.jsonl normalizuje readAll — tu trafiają już liczby.
 */
export const kmLabel = (km: number): string => `${formatNumber(getLocale(), km)} km`

/** Dystans jednostki do pokazania: dystans startu dla startu (jego `distanceKm` to 0 km objętości). */
export const shownKm = (workout: { raceDistanceKm?: number | undefined; distanceKm: number }): number =>
  workout.raceDistanceKm ?? workout.distanceKm

/** Status wpisu dziennika słowem z katalogu; nieznany status (ręczna edycja log.jsonl) bez zmian. */
export function logStatusText(status: unknown, strength = false): string {
  const words: Record<string, string> = strength ? ui().log.strengthStatusWord : ui().log.statusWord
  if (typeof status !== 'string' || !status) return '?'
  return Object.hasOwn(words, status) ? words[status]! : status
}
