/** Drobne formaty wyjścia wspólne dla komend (bez kolorów, ADR-013). */
import { formatNumber, getLocale } from 'trainctl-core'
import { ui } from './i18n/index.ts'

/**
 * Dystans w formacie języka: „21,1 km" po polsku, „21.1 km" po angielsku.
 * Domyślnie jedno miejsce po przecinku (dystans startu, sumy tygodnia); wartość
 * wpisana przez biegacza (`decimals` 3) wraca tak, jak ją zapisano: „8,25 km".
 * Ręcznie edytowany log.jsonl normalizuje readAll — tu trafiają już liczby.
 */
export const kmLabel = (km: number, decimals = 1): string => `${formatNumber(getLocale(), km, decimals)} km`

/**
 * Liczba wpisana przez człowieka: „8", „8.5" albo „8,5" (przecinek jak w polskim
 * wyjściu). Tylko zwykły zapis dziesiętny — bez „0x10" i „1e3", które Number()
 * też przyjmuje; wszystko inne to NaN. Jedna reguła dla `log --km`, kreatora
 * i odczytu log.jsonl.
 */
export function parseDecimal(text: string): number {
  const value = text.trim()
  return /^\d+(?:[.,]\d+)?$/.test(value) ? Number(value.replace(',', '.')) : NaN
}

/** Dystans jednostki do pokazania: dystans startu dla startu (jego `distanceKm` to 0 km objętości). */
export const shownKm = (workout: { raceDistanceKm?: number | undefined; distanceKm: number }): number =>
  workout.raceDistanceKm ?? workout.distanceKm

/** Status wpisu dziennika słowem z katalogu; nieznany status (ręczna edycja log.jsonl) bez zmian. */
export function logStatusText(status: unknown, strength = false): string {
  const words: Record<string, string> = strength ? ui().log.strengthStatusWord : ui().log.statusWord
  if (typeof status !== 'string' || !status) return '?'
  return Object.hasOwn(words, status) ? words[status]! : status
}
