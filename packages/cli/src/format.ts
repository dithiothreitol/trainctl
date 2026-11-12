/** Drobne formaty wyjścia wspólne dla komend (bez kolorów, ADR-013). */
import { distanceIn, distanceUnit, formatNumber, getLocale } from 'trainctl-core'
import { ui } from './i18n/index.ts'

/** Różnica kilometrów, której widok nie pokazuje (zaokrąglenie do 0,1 km; inż.). */
export const KM_SHOWN_TOLERANCE = 0.05

/**
 * Dystans skrótem „km" w formacie języka: „21,1 km" po polsku, „21.1 km" po
 * angielsku — do tabel i wierszy. Forma słowna („8 kilometrów") to osobny
 * `messages().units.km` z core. Domyślnie do dwóch miejsc po przecinku, ta sama
 * dokładność w każdym widoku: sesja po skróceniu „10,25 km", start „21,1 km"
 * i „42,2 km". Poprawka 1e-9 zaokrągla połówki w górę także tam, gdzie zapis binarny
 * jest odrobinę mniejszy (1,005 × 100 = 100,4999… dałoby „1 km" zamiast „1,01 km").
 * Wpis biegacza (`decimals` 4, jak podpowiedź kreatora)
 * wraca tak, jak go zapisano: „21,0975 km".
 * Ręcznie edytowany log.jsonl normalizuje readAll — tu trafiają już liczby.
 * C9: przy `units: imperial` ta sama wartość w milach („13,11 mi"); dane zostają w km.
 */
export const kmLabel = (km: number, decimals = 2): string => {
  const scale = 10 ** decimals
  return `${formatNumber(getLocale(), Math.round((distanceIn(km) + 1e-9) * scale) / scale, decimals)} ${distanceUnit()}`
}

/** C9: objętość tygodnia w jednostce widoku („52 km/tydz.", „32,3 mi/week"). */
export const perWeekLabel = (km: number): string => ui().common.perWeek(formatNumber(getLocale(), distanceIn(km)), distanceUnit())

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

/** Dystans jednostki jako tekst: dystans startu dla startu, inaczej dystans sesji. */
export const workoutKm = (workout: { raceDistanceKm?: number | undefined; distanceKm: number }): string =>
  kmLabel(shownKm(workout))

/** Dystans jednostki do pokazania: dystans startu dla startu (jego `distanceKm` to 0 km objętości). */
export const shownKm = (workout: { raceDistanceKm?: number | undefined; distanceKm: number }): number =>
  workout.raceDistanceKm ?? workout.distanceKm

/** Status wpisu dziennika słowem z katalogu; nieznany status (ręczna edycja log.jsonl) bez zmian. */
export function logStatusText(status: unknown, strength = false): string {
  const words: Record<string, string> = strength ? ui().log.strengthStatusWord : ui().log.statusWord
  if (typeof status !== 'string' || !status) return '?'
  return Object.hasOwn(words, status) ? words[status]! : status
}
