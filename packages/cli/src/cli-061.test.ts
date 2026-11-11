/**
 * Pakiet A (docs/PLAN-v0.7.md, etap 1): etykiety i formaty wyjścia bez zmian
 * w silniku — nagłówki tabeli wykonania, „do startu" bez powtórzenia, liczby
 * dziesiętne w formacie języka, status dziennika słowem z katalogu, adresy
 * nie cięte przy zawijaniu, wiek wyniku liczony od dziś.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { setLocale } from 'trainctl-core'
import { cmdLog, cmdPlan, cmdReview, cmdRules, cmdStatus, cmdToday, cmdWeek, cmdWhy } from './commands.ts'
import { ruleEvidence } from './rules-explain.ts'
import { renderAnsi, wrap } from './ui/blocks.ts'
import { Theme, visibleLength } from './ui/theme.ts'

const CONFIG = `athlete:
  recentWeeklyKm: 45
  daysAvailable: [tue, wed, thu, sat, sun]
  results:
    - { date: "2026-09-27", distanceKm: 10, timeSec: 2580 }
goal:
  name: "Half"
  date: "2027-03-28"
  distanceKm: 21.0975
  priority: A
`

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'trainctl-061-'))
  writeFileSync(join(dir, 'trainctl.yaml'), CONFIG, 'utf-8')
  process.env['TRAINCTL_TODAY'] = '2026-10-22'
  cmdPlan(dir)
})
afterEach(() => {
  delete process.env['TRAINCTL_TODAY']
  setLocale('en')
  rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
})

describe.each(['pl', 'en'] as const)('pakiet A · %s', (lang) => {
  beforeEach(() => setLocale(lang))

  it('A1: tabela wykonania w review ma kolumny planu, wykonania i statusu', async () => {
    process.env['TRAINCTL_TODAY'] = '2026-10-29'
    cmdLog(dir, { date: '2026-10-27', status: 'done', km: '8' })
    const out = (await cmdReview(dir, {})).output
    expect(out).toContain(lang === 'pl' ? 'Plan | Wykonanie | Status' : 'Plan | Actual | Status')
    expect(out).not.toMatch(/Przed zmianą|Before the change/)
  })

  it('A2: „do startu" nie powtarza etykiety', async () => {
    process.env['TRAINCTL_TODAY'] = '2026-10-29'
    const out = (await cmdReview(dir, {})).output
    expect(out).not.toMatch(/do startu: do startu|To race day: \d+ days to race/i)
    expect(out).toMatch(lang === 'pl' ? /Do startu: 150 dni/ : /To race day: 150 days/)
  })

  it('A3: liczby dziesiętne w formacie języka', () => {
    const plan = cmdPlan(dir).output
    const why = cmdWhy(dir, { date: '2026-10-27' }).output
    if (lang === 'pl') {
      for (const out of [plan, why]) expect(out.replace(/https?:\/\/\S+/g, '')).not.toMatch(/\d\.\d/)
      expect(plan).toContain('21,1 km')
      expect(plan).toContain('47,7')
    } else {
      expect(plan).toContain('21.1 km')
      expect(plan).not.toContain('21.0975')
    }
  })

  it('A4: faza jednotygodniowa bez zakresu', () => {
    const out = cmdPlan(dir).output
    expect(out).not.toMatch(/(\d+)–\1\b/)
    expect(out).toMatch(lang === 'pl' ? /taper: tyg\. 22\b/ : /taper: week 22\b/)
  })

  it('A5: status dziennika słowem z katalogu, surowy enum w danych', () => {
    process.env['TRAINCTL_TODAY'] = '2026-10-27'
    cmdLog(dir, { date: '2026-10-27', status: 'done' })
    const word = lang === 'pl' ? 'wykonany' : 'done'
    expect(cmdWeek(dir).output).toContain(`[${word}]`)
    expect(cmdStatus(dir).output).toContain(`(${word})`)
    const today = cmdToday(dir)
    expect(today.output).toContain(word)
    expect(today.data).toMatchObject({ log: { status: 'done' } })
    if (lang === 'pl') expect(cmdWeek(dir).output).not.toContain('[done]')
  })

  it('A7: wiek wyniku w why liczony od dziś, data kalibracji osobno', () => {
    process.env['TRAINCTL_TODAY'] = '2026-10-29'
    const out = cmdWhy(dir, { date: '2026-10-27' }).output
    expect(out).toMatch(lang === 'pl' ? /sprzed 32 dni/ : /32 days/)
    expect(out).toContain('2026-10-22')
  })

  it('A8: tydzień z celem równym sumie pokazuje jedną liczbę', () => {
    process.env['TRAINCTL_TODAY'] = '2026-10-27'
    const out = cmdWeek(dir).output
    expect(out).not.toMatch(/zaplanowano|planned/)
    expect(out).toContain('52 km')
  })
})

describe('A6: zawijanie nie tnie adresów ani ścieżek', () => {
  const url = 'https://github.com/dithiothreitol/trainctl/blob/v0.6.0/docs/science/FOUNDATIONS.md'
  it.each([40, 60, 80])('szerokość %i', (width) => {
    const lines = wrap(`źródła i parametry: ${url} §10`, width)
    expect(lines.some((line) => line.trim() === url)).toBe(true)
  })
  it('ścieżka Windows zostaje w całości', () => {
    const path = 'C:\\Users\\someone\\AppData\\Local\\Temp\\very\\long\\training\\directory'
    expect(wrap(path, 40)).toEqual([path])
  })
  it('zwykłe długie słowo nadal dzielone', () => {
    expect(wrap('x'.repeat(50), 20).every((line) => line.length <= 20)).toBe(true)
  })
})

describe('B9: stałe silnika bez źródła mają regułę E-3', () => {
  it.each(['pl', 'en'] as const)('rules E-3 · %s', (lang) => {
    setLocale(lang)
    expect(cmdRules({ id: 'E-3' }).output).toContain('18 km')
    expect(cmdRules({}).output).toContain('E-3')
    expect(ruleEvidence('E-3')).toBe('engineering')
  })
})

describe('poprawki po przeglądzie etapu 1', () => {
  it('today pokazuje zalogowane km w formacie języka, także 0 km', () => {
    setLocale('pl')
    process.env['TRAINCTL_TODAY'] = '2026-10-27'
    cmdLog(dir, { date: '2026-10-27', status: 'modified', km: '8.5' })
    expect(cmdToday(dir).output).toContain('8,5 km')
    cmdLog(dir, { date: '2026-10-27', status: 'modified', km: '0' })
    expect(cmdToday(dir).output).toContain(', 0 km')
  })

  it('why: wynik z przyszłości w dniu kalibracji, dziś już przeszły, nie jest „z przyszłości"', () => {
    writeFileSync(join(dir, 'trainctl.yaml'), CONFIG.replace('    - { date: "2026-09-27", distanceKm: 10, timeSec: 2580 }',
      '    - { date: "2026-09-27", distanceKm: 10, timeSec: 2580 }\n    - { date: "2026-10-25", distanceKm: 5, timeSec: 1200 }'), 'utf-8')
    cmdPlan(dir, { fresh: true })
    setLocale('en')
    process.env['TRAINCTL_TODAY'] = '2026-10-29'
    const out = cmdWhy(dir, { date: '2026-10-27' }).output
    expect(out).toContain('Newer than the calibration')
    expect(out).not.toContain('Future result')
    expect(out).not.toMatch(/-\d+ days/)
  })

  it('komórka tabeli z długą ścieżką trzyma szerokość kolumny', () => {
    const theme = new Theme({ color: false, unicode: true, width: 40 })
    const out = renderAnsi([{ t: 'table', head: ['a', 'b'], rows: [['x', 'C:\Users\someone\AppData\Local\Temp\very\long\dir']] }], theme)
    for (const line of out.split('\n')) expect(visibleLength(line)).toBeLessThanOrEqual(40)
  })

  it('kv z adresem dłuższym niż kolumna wartości przechodzi w układ piętrowy, adres w całości', () => {
    const url = 'https://github.com/dithiothreitol/trainctl/blob/v0.6.0/docs/science/FOUNDATIONS.md'
    const out = renderAnsi([{ t: 'kv', pairs: [['Source', url]] }], new Theme({ color: false, unicode: true, width: 60 }))
    expect(out.split('\n').some((line) => line.trim() === url)).toBe(true)
  })

  it('handlery nie wstawiają surowych kilometrów (format języka przez formatNumber)', () => {
    const src = readFileSync(join(import.meta.dirname, 'commands.ts'), 'utf-8')
    expect(src).not.toMatch(/\$\{[\w.]*(?:km|Km)\} km`/)
    expect(src).not.toContain('String(w.totalKm)')
  })

  it('podtytuł tygodnia: bez planowanej sumy jedna liczba', () => {
    setLocale('en')
    expect(cmdWeek(dir).output).toMatch(/\(pyramidal\) · \d+ km/)
  })
})
