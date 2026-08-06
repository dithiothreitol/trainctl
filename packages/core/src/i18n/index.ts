/**
 * Punkt wejścia i18n. Katalog wybiera się raz — na starcie CLI albo serwera MCP
 * — i wędruje dalej jawnie tam, gdzie funkcja i tak dostaje kontekst, albo przez
 * `messages()` tam, gdzie przeciąganie parametru przez pięć warstw dałoby tylko
 * hałas. To proces jednojęzyczny: jeden użytkownik, jedna sesja, jeden język.
 */
import { coreEn, type CoreMessages } from './core-en.ts'
import { corePl } from './core-pl.ts'
import { DEFAULT_LOCALE, type Locale } from './locale.ts'

export * from './locale.ts'
export type { CoreMessages } from './core-en.ts'

const CATALOGS: Record<Locale, CoreMessages> = { en: coreEn, pl: corePl }

let current: Locale = DEFAULT_LOCALE

/** Ustawia język procesu. Zwraca poprzedni — wygodne w testach (`try/finally`). */
export function setLocale(locale: Locale): Locale {
  const previous = current
  current = locale
  return previous
}

export const getLocale = (): Locale => current

/** Katalog domenowy: bez argumentu bieżący, z argumentem wskazany. */
export const messages = (locale: Locale = current): CoreMessages => CATALOGS[locale]

/** Uruchamia funkcję w danym języku i przywraca poprzedni (także przy wyjątku). */
export function withLocale<T>(locale: Locale, fn: () => T): T {
  const previous = setLocale(locale)
  try {
    return fn()
  } finally {
    setLocale(previous)
  }
}
