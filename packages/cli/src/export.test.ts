/** E2E eksportu: realne pliki na dysku, sprawdzana treść. */
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { cmdExport, cmdPlan } from './commands.ts'

const CONFIG = `athlete:
  recentWeeklyKm: 55
  daysAvailable: [tue, wed, thu, sat, sun]
  results:
    - { date: "2026-03-30", distanceKm: 21.0975, timeSec: 5400 }
goal:
  name: "Maraton testowy"
  date: "2026-11-29"
  distanceKm: 42.195
  priority: A
`

let dir: string
const exportDir = () => join(dir, 'export')

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'tren-exp-'))
  writeFileSync(join(dir, 'tren.yaml'), CONFIG, 'utf-8')
  cmdPlan(dir, { date: '2026-08-05' })
})
afterAll(() => rmSync(dir, { recursive: true, force: true }))

describe('eksport jednego treningu (.fit)', () => {
  it('zapisuje plik z poprawnym nagłówkiem FIT', () => {
    const r = cmdExport(dir, { what: 'workout', date: '2026-08-04' })
    expect(r.code).toBe(0)
    const file = readdirSync(exportDir()).find((f) => f.startsWith('2026-08-04'))!
    expect(file).toMatch(/\.fit$/)
    const bytes = readFileSync(join(exportDir(), file))
    expect(bytes[0]).toBe(14) // rozmiar nagłówka
    expect(bytes.subarray(8, 12).toString()).toBe('.FIT')
    expect(bytes.length).toBeGreaterThan(100)
  })

  it('dzień wolny i brak daty dają czytelny błąd', () => {
    const rest = cmdExport(dir, { what: 'workout', date: '2026-08-03' })
    expect(rest.code).toBe(1)
    expect(rest.output).toContain('dzień wolny')
    expect(cmdExport(dir, { what: 'workout' }).code).toBe(1)
  })

  it('dzień startu nie jest eksportowany jako trening', () => {
    const r = cmdExport(dir, { what: 'workout', date: '2026-11-29' })
    expect(r.code).toBe(1)
    expect(r.output).toContain('startu')
  })
})

describe('eksport całego planu', () => {
  it('tworzy plik na każdy trening, pomija dni wolne i start', () => {
    const r = cmdExport(dir, { what: 'plan' })
    expect(r.code).toBe(0)
    const files = readdirSync(exportDir()).filter((f) => f.endsWith('.fit'))
    expect(files.length).toBeGreaterThan(50)
    expect(files.some((f) => f.startsWith('2026-11-29'))).toBe(false) // dzień startu
    expect(r.output).toContain('kolejnych')
  })
})

describe('eksport do kalendarza (.ics)', () => {
  it('poprawna struktura iCalendar ze zdarzeniami całodniowymi', () => {
    const r = cmdExport(dir, { what: 'calendar' })
    expect(r.code).toBe(0)
    const file = readdirSync(exportDir()).find((f) => f.endsWith('.ics'))!
    const ics = readFileSync(join(exportDir(), file), 'utf-8')
    expect(ics.startsWith('BEGIN:VCALENDAR')).toBe(true)
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true)
    expect(ics).toContain('DTSTART;VALUE=DATE:20260804')
    expect(ics).toContain('SUMMARY:Interwały')
    expect(ics.split('BEGIN:VEVENT').length - 1).toBeGreaterThan(50)
    // linie łamane wg RFC 5545 — żadna nie przekracza 75 oktetów
    for (const line of ics.split('\r\n')) {
      expect(Buffer.byteLength(line)).toBeLessThanOrEqual(75)
    }
  })

  it('UID jest stabilny — ponowny import aktualizuje zamiast dublować', () => {
    const file = readdirSync(exportDir()).find((f) => f.endsWith('.ics'))!
    const first = readFileSync(join(exportDir(), file), 'utf-8')
    cmdExport(dir, { what: 'calendar' })
    expect(readFileSync(join(exportDir(), file), 'utf-8')).toBe(first)
  })
})

describe('rozpiska do wydruku', () => {
  it('generuje HTML z tabelami tygodni i stylem druku', () => {
    const r = cmdExport(dir, { what: 'print' })
    expect(r.code).toBe(0)
    const file = readdirSync(exportDir()).find((f) => f.endsWith('.html'))!
    const html = readFileSync(join(exportDir(), file), 'utf-8')
    expect(html).toContain('@page { size: A4 portrait')
    expect(html).toContain('page-break-inside: avoid')
    expect(html).toContain('Tydzień 1')
    expect(html).toContain('Maraton testowy')
    expect(html).toContain('truchtu')
    expect(html).not.toContain('<script')
  })

  it('znaki specjalne są escapowane', () => {
    const file = readdirSync(exportDir()).find((f) => f.endsWith('.html'))!
    const html = readFileSync(join(exportDir(), file), 'utf-8')
    expect(html).not.toMatch(/<td class="what">[^<]*<[^/]/)
  })
})

describe('walidacja', () => {
  it('nieznany rodzaj eksportu', () => {
    const r = cmdExport(dir, { what: 'pdf' })
    expect(r.code).toBe(1)
    expect(r.output).toContain('plan|workout|print|calendar')
  })

  it('brak planu — komunikat, nie wyjątek', () => {
    const empty = mkdtempSync(join(tmpdir(), 'tren-exp-none-'))
    const r = cmdExport(empty, { what: 'print' })
    expect(r.code).toBe(1)
    expect(existsSync(join(empty, 'export'))).toBe(false)
    rmSync(empty, { recursive: true, force: true })
  })
})
