/** Drobne formaty wyjścia wspólne dla komend (bez kolorów, ADR-013). */
import { formatNumber, getLocale } from 'trainctl-core'
import { ui } from './i18n/index.ts'

/**
 * Dystans skrótem „km" w formacie języka: „21,1 km" po polsku, „21.1 km" po
 * angielsku — do tabel i wierszy. Forma słowna („8 kilometrów") to osobny
 * `messages().units.km` z core. Domyślnie jedno miejsce po przecinku (dystans
 * startu, sumy tygodnia); wartość wpisana przez biegacza (`decimals` 4, jak
 * podpowiedź kreatora) wraca tak, jak ją zapisano: „21,0975 km".
 * Ręcznie edytowany log.jsonl normalizuje readAll — tu trafiają już liczby.
 */
export const kmLabel = (km: number, decimals = 1): string => `${formatNumber(getLocale(), km, decimals)} km`

/**
 * Liczba wpisana przez człowieka: „8", „8.5", „8,5", „.5" albo „5." (przecinek jak
 * w polskim wyjściu). Tylko zwykły zapis dziesiętny — bez „0x10" i „1e3", które
 * Number() też przyjmuje; wszystko inne to NaN. Jedna reguła dla wszystkich liczb
 * dziennika: `log` (km, RPE, minuty siły), kreator i odczyt log.jsonl. `comma` false:
 * metry i minuty w ścieżce v2, gdzie „1,500" to raczej separator tysięcy niż 1,5.
 */
export function parseDecimal(text: string, comma = true): number {
  const value = text.trim()
  const pattern = comma ? /^(?:\d+(?:[.,]\d*)?|[.,]\d+)$/ : /^(?:\d+(?:\.\d*)?|\.\d+)$/
  return pattern.test(value) ? Number(value.replace(',', '.')) : NaN
}

/**
 * Dystans jednostki do pokazania jako tekst: start z jednym miejscem po przecinku
 * („21,1 km", „42,2 km"), sesja treningowa do dwóch („10,25 km" po skróceniu).
 */
export const workoutKm = (workout: { raceDistanceKm?: number | undefined; distanceKm: number }): string =>
  workout.raceDistanceKm !== undefined ? kmLabel(workout.raceDistanceKm) : kmLabel(workout.distanceKm, 2)

/** Dystans jednostki do pokazania: dystans startu dla startu (jego `distanceKm` to 0 km objętości). */
export const shownKm = (workout: { raceDistanceKm?: number | undefined; distanceKm: number }): number =>
  workout.raceDistanceKm ?? workout.distanceKm

/** Status wpisu dziennika słowem z katalogu; nieznany status (ręczna edycja log.jsonl) bez zmian. */
export function logStatusText(status: unknown, strength = false): string {
  const words: Record<string, string> = strength ? ui().log.strengthStatusWord : ui().log.statusWord
  if (typeof status !== 'string' || !status) return '?'
  return Object.hasOwn(words, status) ? words[status]! : status
}
