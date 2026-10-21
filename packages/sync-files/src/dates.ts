/**
 * Data lokalna aktywności (`YYYY-MM-DD`) — po niej CLI łączy wykonanie z dniem planu.
 *
 * FIT niesie przesunięcie strefy (komunikat `activity`: local_timestamp − timestamp).
 * TCX i GPX niosą zwykle sam czas UTC (`…Z`) — wtedy jedynym źródłem strefy
 * jest strefa maszyny, na której działa CLI. Bieg o 23:30 w Lizbonie czytany
 * w Warszawie trafi na następny dzień; to udokumentowane ograniczenie (README).
 */

const pad = (n: number): string => String(n).padStart(2, '0')

/** Data w strefie maszyny dla chwili `ms` (ms od epoki uniksowej). */
export function localDateFromMs(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Data „ścienna" UTC przesunięta o `offsetSec` — dla FIT ze znaną strefą. */
export function dateWithOffset(ms: number, offsetSec: number): string {
  return new Date(ms + offsetSec * 1000).toISOString().slice(0, 10)
}

const ISO = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:[.,](\d+))?)?\s*(Z|[+-]\d{2}(?::?\d{2})?)?$/i

/**
 * ISO 8601 → ms od epoki. Ułamki sekund przycinamy do milisekund (część
 * eksporterów pisze mikrosekundy). Zwraca `undefined` dla nieczytelnego zapisu.
 */
export function parseIsoMs(iso: string): number | undefined {
  const m = ISO.exec(iso.trim())
  if (!m) return undefined
  const [, date, hh, mm, ss = '00', frac = '', zone = ''] = m
  const ms = frac ? `.${frac.slice(0, 3).padEnd(3, '0')}` : ''
  const z = zone.toUpperCase() === 'Z' || zone === '' ? zone.toUpperCase() : normaliseOffset(zone)
  const value = Date.parse(`${date}T${hh}:${mm}:${ss}${ms}${z}`)
  return Number.isFinite(value) ? value : undefined
}

function normaliseOffset(zone: string): string {
  const digits = zone.slice(1).replace(':', '')
  const hours = digits.slice(0, 2)
  const minutes = digits.slice(2, 4) || '00'
  return `${zone[0]}${hours}:${minutes}`
}

/**
 * Data lokalna z zapisu ISO.
 * - `Z` (albo `+00:00`, którym wiele bibliotek zapisuje UTC) → strefa maszyny.
 * - Jawne przesunięcie ≠ 0 albo brak strefy → data tak, jak ją zapisano
 *   (to już czas ścienny miejsca aktywności).
 */
export function localDateFromIso(iso: string): string | undefined {
  const m = ISO.exec(iso.trim())
  const ms = parseIsoMs(iso)
  if (!m || ms === undefined) return undefined
  const zone = (m[6] ?? '').toUpperCase()
  const isUtc = zone === 'Z' || /^[+-]00(?::?00)?$/.test(zone)
  return isUtc ? localDateFromMs(ms) : m[1]
}
