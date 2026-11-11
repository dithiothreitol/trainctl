import { formatNumber, type Locale } from 'trainctl-core'

/** Liczby w katalogach tekstów: jeden format na język (przecinek po polsku), jedna definicja. */
export const numberIn = (locale: Locale) => (value: number): string => formatNumber(locale, value)
