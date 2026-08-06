/**
 * Katalog tekstów interfejsu. Język jest wspólny z rdzeniem — ustawia go raz
 * `bin.ts` (albo serwer MCP), a `setLocale` z `@trainctl/core` przełącza oba
 * katalogi naraz: nie da się mieć opisów treningów po polsku, a nagłówków
 * po angielsku.
 */
import { getLocale, type Locale } from '@trainctl/core'
import { cliEn, type CliMessages } from './cli-en.ts'
import { cliPl } from './cli-pl.ts'

const CATALOGS: Record<Locale, CliMessages> = { en: cliEn, pl: cliPl }

export const ui = (locale: Locale = getLocale()): CliMessages => CATALOGS[locale]

export type { CliMessages } from './cli-en.ts'
