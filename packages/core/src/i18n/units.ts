/**
 * PLAN-v0.7 C9: jednostka widoku — kilometry albo mile. Przeliczenie wyłącznie
 * w warstwie widoku (dystans, tempo, notacja, wiersz jednostki, PLAN.md, wydruk).
 * `plan.yaml`, `log.jsonl`, `--json`, `structuredContent` i synchronizacja zostają
 * w kilometrach. Jednostka nie zależy od języka. Wybór jak język: raz na starcie
 * CLI albo serwera MCP (`units` w trainctl.yaml, flaga `--units`).
 */
export const UNITS = ['metric', 'imperial'] as const
export type Units = (typeof UNITS)[number]

export const isUnits = (value: unknown): value is Units => typeof value === 'string' && (UNITS as readonly string[]).includes(value)

/** Mila międzynarodowa: 1,609344 km (definicja jednostki). */
export const KM_PER_MILE = 1.609344

let current: Units = 'metric'

/** Ustawia jednostkę procesu. Zwraca poprzednią — wygodne w testach (`try/finally`). */
export function setUnits(units: Units): Units {
  const previous = current
  current = units
  return previous
}

export const getUnits = (): Units => current

/** Uruchamia funkcję w danej jednostce i przywraca poprzednią (także przy wyjątku). */
export function withUnits<T>(units: Units, fn: () => T): T {
  const previous = setUnits(units)
  try {
    return fn()
  } finally {
    setUnits(previous)
  }
}

/** Kilometry → dystans w jednostce widoku. */
export const distanceIn = (km: number, units: Units = current): number => (units === 'imperial' ? km / KM_PER_MILE : km)

/** Tempo w s/km → s na jednostkę widoku (min/km albo min/mi). */
export const paceIn = (secPerKm: number, units: Units = current): number => (units === 'imperial' ? secPerKm * KM_PER_MILE : secPerKm)

/** Dystans wpisany w jednostce widoku (log, kreator) → kilometry do zapisu. */
export const kmFrom = (value: number, units: Units = current): number => (units === 'imperial' ? value * KM_PER_MILE : value)

/** Skrót jednostki dystansu: `km` albo `mi` — symbol, ten sam w każdym języku. */
export const distanceUnit = (units: Units = current): string => (units === 'imperial' ? 'mi' : 'km')
