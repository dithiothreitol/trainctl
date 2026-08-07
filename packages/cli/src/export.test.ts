/** E2E eksportu: realne pliki na dysku, sprawdzana treść. */
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { cmdExport, cmdPlan } from './commands.ts'
import { setLocale } from 'trainctl-core'

// Ten plik weryfikuje ZACHOWANIE komend, a asercje czyta się najłatwiej
// po polsku. Kompletność i jakość tłumaczeń pilnują testy i18n.
setLocale('pl')


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
  dir = mkdtempSync(join(tmpdir(), 'trainctl-exp-'))
  writeFileSync(join(dir, 'trainctl.yaml'), CONFIG, 'utf-8')
  cmdPlan(dir, { date: '2026-08-05' })
})
afterAll(() => rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }))

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
    // przy ponad ośmiu plikach lista jest skracana z dopiskiem „…oraz N kolejnych"
    expect(r.output).toMatch(/kolejn/)
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

describe('pakiet startowy (--what race)', () => {
  it('generuje splity i opaskę z predykcji (bez celu czasowego)', () => {
    const r = cmdExport(dir, { what: 'race' })
    expect(r.code).toBe(0)
    const file = readdirSync(exportDir()).find((f) => f.includes('pakiet-startowy'))!
    const html = readFileSync(join(exportDir(), file), 'utf-8')
    expect(html).toContain('śmiało')
    expect(html).toContain('ostrożnie')
    expect(html).toContain('Opaska — ostrożnie') // bez celu opaska bierze wariant bezpieczny
    expect(html).toContain('W-1')
  })

  it('z celem czasowym opaska bierze cel', () => {
    const withTarget = mkdtempSync(join(tmpdir(), 'trainctl-exp-tgt-'))
    writeFileSync(
      join(withTarget, 'trainctl.yaml'),
      CONFIG.replace('priority: A', 'priority: A\n  targetTimeSec: 12600'),
      'utf-8',
    )
    cmdPlan(withTarget, { date: '2026-08-05' })
    const r = cmdExport(withTarget, { what: 'race' })
    expect(r.code).toBe(0)
    const file = readdirSync(join(withTarget, 'export')).find((f) => f.includes('pakiet'))!
    const html = readFileSync(join(withTarget, 'export', file), 'utf-8')
    expect(html).toContain('Opaska — cel')
    expect(html).toContain('3:30:00')
    rmSync(withTarget, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
  })

  it('bez celu i bez predykcji — czytelna odmowa', () => {
    const bare = mkdtempSync(join(tmpdir(), 'trainctl-exp-bare-'))
    writeFileSync(
      join(bare, 'trainctl.yaml'),
      CONFIG.replace(/results:[\s\S]*?goal:/, 'results: []\ngoal:').replace(
        'priority: A',
        'priority: A\n  targetTimeSec: 12600',
      ),
      'utf-8',
    )
    cmdPlan(bare, { date: '2026-08-05' })
    // wygenerowany z celem — teraz usuwamy cel z planu, symulując brak obu źródeł
    const planYaml = join(bare, 'plan', 'plan.yaml')
    writeFileSync(planYaml, readFileSync(planYaml, 'utf-8').replace(/targetTimeSec: \d+\n/, ''), 'utf-8')
    const r = cmdExport(bare, { what: 'race' })
    expect(r.code).toBe(1)
    expect(r.output).toContain('nie mam z czego')
    rmSync(bare, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
  })
})

describe('walidacja', () => {
  it('nieznany rodzaj eksportu', () => {
    const r = cmdExport(dir, { what: 'pdf' })
    expect(r.code).toBe(1)
    expect(r.output).toContain('plan|workout|print|calendar|race')
  })

  it('brak planu — komunikat, nie wyjątek', () => {
    const empty = mkdtempSync(join(tmpdir(), 'trainctl-exp-none-'))
    const r = cmdExport(empty, { what: 'print' })
    expect(r.code).toBe(1)
    expect(existsSync(join(empty, 'export'))).toBe(false)
    rmSync(empty, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
  })
})
