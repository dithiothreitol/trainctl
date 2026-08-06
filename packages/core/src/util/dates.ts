/** Daty ISO 'YYYY-MM-DD' liczone w UTC — plan żyje w kalendarzu, nie w strefach. */
import { messages } from '../i18n/index.ts'

export function parseIso(iso: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) throw new Error(messages().dates.invalidIso(iso))
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
}

export function toIso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function addDays(iso: string, days: number): string {
  const d = parseIso(iso)
  d.setUTCDate(d.getUTCDate() + days)
  return toIso(d)
}

export function diffDays(fromIso: string, toIsoDate: string): number {
  return Math.round(
    (parseIso(toIsoDate).getTime() - parseIso(fromIso).getTime()) / 86_400_000,
  )
}

/** Poniedziałek tygodnia zawierającego datę. */
export function mondayOf(iso: string): string {
  const d = parseIso(iso)
  const dow = d.getUTCDay() // 0 = niedziela
  const shift = dow === 0 ? -6 : 1 - dow
  return addDays(iso, shift)
}
