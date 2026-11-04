import ICAL from 'ical.js'
import { describe, expect, it } from 'vitest'
import { setLocale, type SportsPlan, type TrainingSession } from 'trainctl-core'
import { sessionsToIcs } from './sessions.ts'
import { toIcs } from './ics.ts'

setLocale('pl')
const session = (date = '2026-11-03', id = 'run1'): TrainingSession => ({ id, date, sport: 'run', purpose: 'easy', steps: [{ role: 'work', durationSec: 1800, target: { kind: 'open' } }], durationSec: 1800, preparationSec: 600, ruleRefs: [] })
const plan = (...sessions: TrainingSession[]): SportsPlan => ({ schemaVersion: 2, id: 'plan1', cycleId: 'cycle1', engineVersion: 'test', generatedAt: '2026-11-02', goal: { kind: 'base', date: '2027-03-01', name: 'Baza' }, sessions, archive: [], groups: [], replacements: [], changes: [], generatedSessions: {}, warnings: [] })
const parse = (raw: string) => new ICAL.Component(ICAL.parse(raw)).getAllSubcomponents('vevent').map(component => new ICAL.Event(component))

describe('iCalendar odczytywany przez ICAL.js', () => {
  it.each([['2026-12-31','2027-01-01'], ['2028-02-29','2028-03-01'], ['2026-11-03','2026-11-04']])('zachowuje całodniowy termin %s i wyłączny koniec %s', (date, end) => {
    const event = parse(sessionsToIcs(plan(session(date)), () => 'Bieg'))[0]!
    expect(event.startDate.isDate).toBe(true)
    expect(event.startDate.toString()).toBe(date)
    expect(event.endDate.toString()).toBe(end)
    expect(event.duration.toSeconds()).toBe(86400)
  })

  it('zachowuje lokalny czas, przygotowanie i przejście przez północ', () => {
    const event = parse(sessionsToIcs(plan({ ...session('2026-12-31'), start: '23:40' }), () => 'Bieg'))[0]!
    expect(event.startDate.isDate).toBe(false)
    expect(event.startDate.zone.tzid).toBe('floating')
    expect(event.startDate.toString()).toBe('2026-12-31T23:40:00')
    expect(event.endDate.toString()).toBe('2027-01-01T00:20:00')
    expect(event.duration.toSeconds()).toBe(2400)
  })

  it('anulowanie zachowuje UID, typ daty, godzinę i czas oryginału', () => {
    const original = { ...session(), start: '18:15' }, active = plan(original), cancelled = plan()
    cancelled.archive = [original]
    const before = parse(sessionsToIcs(active, () => 'Bieg', { run1: { sequence: 2, updatedAt: '2026-11-02T10:00:00.000Z' } }))[0]!
    const after = parse(sessionsToIcs(cancelled, () => 'Bieg', { run1: { sequence: 3, updatedAt: '2026-11-02T11:00:00.000Z' } }))[0]!
    expect(after.uid).toBe(before.uid)
    expect(after.startDate.toString()).toBe(before.startDate.toString())
    expect(after.endDate.toString()).toBe(before.endDate.toString())
    expect(after.component.getFirstPropertyValue('status')).toBe('CANCELLED')
    expect(after.sequence).toBeGreaterThan(before.sequence)
  })

  it('odczytuje wersję i znaczniki aktualizacji jako UTC', () => {
    const event = parse(sessionsToIcs(plan(session()), () => 'Bieg', { run1: { sequence: 14, updatedAt: '2026-11-02T10:20:30.123Z' } }))[0]!
    expect(event.sequence).toBe(14)
    for (const property of ['dtstamp', 'last-modified']) {
      const value = event.component.getFirstPropertyValue(property) as InstanceType<typeof ICAL.Time>
      expect(value.zone.tzid).toBe('UTC')
      expect(value.toString()).toBe('2026-11-02T10:20:30Z')
    }
  })

  it.each(['\n', '\r\n', '\r'])('normalizuje nowe linie %j bez tworzenia dodatkowych pól', newline => {
    const text = `Zażółć; basen, rower\\bieg${newline}STATUS:CANCELLED${newline}Koniec`
    const current = plan(session()); current.goal.name = text
    const raw = sessionsToIcs(current, () => text), events = parse(raw)
    expect(events).toHaveLength(1)
    const normalized = text.replace(/\r\n|\r|\n/g, '\n')
    expect(events[0]!.summary).toBe(`Bieganie: ${normalized}`)
    expect(events[0]!.description).toBe(`run1\n${normalized}`)
    expect(events[0]!.component.hasProperty('status')).toBe(false)
    expect(raw.replaceAll('\r\n', '')).not.toContain('\r')
  })

  it('składa długie linie UTF-8 bez utraty tekstu i limitu 75 bajtów', () => {
    const text = 'Pływanie 🚴🏊; Zażółć gęślą jaźń, '.repeat(30), current = plan(session())
    current.id = 'p'.repeat(181); current.goal.name = text
    const raw = sessionsToIcs(current, () => text), event = parse(raw)[0]!
    expect(raw.split('\r\n').every(line => new TextEncoder().encode(line).length <= 75)).toBe(true)
    expect(event.uid).toBe(`trainctl-${current.id}-run1@trainctl`)
    expect(event.summary).toBe(`Bieganie: ${text}`)
    expect(event.description).toBe(`run1\n${text}`)
  })

  it('zachowuje dwie sesje tego samego dnia jako różne zdarzenia', () => {
    const events = parse(sessionsToIcs(plan({ ...session(undefined, 'morning'), start: '07:00' }, { ...session(undefined, 'evening'), sport: 'swim', start: '18:00' }), s => s.sport))
    expect(new Set(events.map(event => event.uid)).size).toBe(2)
    expect(events.map(event => event.startDate.hour)).toEqual([7, 18])
  })

  it('stosuje tę samą normalizację tekstu w eksporcie starego planu', () => {
    const raw = toIcs([{ day: { date: '2026-11-03' } as Parameters<typeof toIcs>[0][number]['day'], summary: 'Bieg\rRano', description: 'A;B,C\\D\rKoniec' }], { planName: 'Stary plan\rBaza' })
    const event = parse(raw)[0]!
    expect(event.summary).toBe('Bieg\nRano')
    expect(event.description).toBe('A;B,C\\D\nKoniec')
    expect(raw.replaceAll('\r\n', '')).not.toContain('\r')
  })
})
