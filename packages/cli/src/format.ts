/** Drobne formaty wyjścia wspólne dla komend (bez kolorów, ADR-013). */
import { formatNumber, getLocale } from 'trainctl-core'
import { ui } from './i18n/index.ts'

/** Dystans w formacie języka: „21,1 km" po polsku, „21.1 km" po angielsku. */
export const kmLabel = (km: number): string => `${formatNumber(getLocale(), km)} km`

/** Status wpisu dziennika słowem z katalogu; nieznany status (ręczna edycja log.jsonl) bez zmian. */
export function logStatusText(status: string, strength = false): string {
  const words: Record<string, string> = strength ? ui().log.strengthStatusWord : ui().log.statusWord
  return Object.hasOwn(words, status) ? words[status]! : status
}
