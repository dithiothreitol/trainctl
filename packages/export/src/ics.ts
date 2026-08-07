/**
 * Eksport planu do iCalendar (.ics) — import do Google Calendar, Outlooka,
 * kalendarza telefonu. Zdarzenia całodniowe, bo trening ma dzień, nie godzinę
 * (o porze decyduje tryb biurkowy).
 */
import type { PlannedDay } from 'trainctl-core'

export interface IcsOptions {
  planName: string
  /** Stabilny prefiks UID — powtórny import aktualizuje, zamiast dublować. */
  uidPrefix?: string
  /** Znacznik czasu generacji w formacie ICS (dla testów deterministycznych). */
  stamp?: string
}

/** Łamanie linii wg RFC 5545: maks. 75 oktetów, kontynuacja od spacji. */
export function foldLine(line: string): string {
  const bytes = new TextEncoder().encode(line)
  if (bytes.length <= 75) return line
  const parts: string[] = []
  let current = ''
  let size = 0
  for (const char of line) {
    const charSize = new TextEncoder().encode(char).length
    if (size + charSize > (parts.length === 0 ? 75 : 74)) {
      parts.push(current)
      current = ''
      size = 0
    }
    current += char
    size += charSize
  }
  if (current) parts.push(current)
  return parts.join('\r\n ')
}

export function escapeIcs(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

const compact = (iso: string) => iso.replace(/-/g, '')

function nextDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return compact(d.toISOString().slice(0, 10))
}

export interface IcsEntry {
  day: PlannedDay
  summary: string
  description: string
}

export function toIcs(entries: IcsEntry[], opts: IcsOptions): string {
  const stamp = opts.stamp ?? '20260101T000000Z'
  const prefix = opts.uidPrefix ?? 'trainctl'
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//trainctl//plan treningowy//PL',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcs(opts.planName)}`,
  ]
  for (const entry of entries) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${prefix}-${entry.day.date}@trainctl`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${compact(entry.day.date)}`,
      `DTEND;VALUE=DATE:${nextDay(entry.day.date)}`,
      foldLine(`SUMMARY:${escapeIcs(entry.summary)}`),
      foldLine(`DESCRIPTION:${escapeIcs(entry.description)}`),
      'TRANSP:TRANSPARENT',
      'END:VEVENT',
    )
  }
  lines.push('END:VCALENDAR')
  return lines.join('\r\n') + '\r\n'
}
