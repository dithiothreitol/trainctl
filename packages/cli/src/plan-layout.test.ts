/**
 * PLAN-v0.7 C3 i C4: PLAN.md, wydruk i strona mobilna w układzie wiersza z C2
 * (siatka sezonu na górze, tygodnie jako tabele wierszy, rozpiska w notacji C1)
 * oraz `plan` w katalogu v2 z nagłówkiem i siatką sezonu.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parse, stringify } from 'yaml'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { setLocale, workoutLine, type SportsConfig } from 'trainctl-core'
import { cmdExport, cmdInit, cmdPlan, cmdWeek } from './commands.ts'
import { loadPlan } from './planfile.ts'
import { loadSportsPlan, sportsTemplate } from './sports-store.ts'

const RUNNING = `athlete:
  recentWeeklyKm: 45
  daysAvailable: [tue, wed, thu, sat, sun]
  results:
    - { date: "2026-09-27", distanceKm: 10, timeSec: 2580 }
goal:
  name: "Half"
  date: "2027-03-28"
  distanceKm: 21.0975
  priority: A
strength:
  enabled: true
`

let dir: string
const today = process.env['TRAINCTL_TODAY']
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'trainctl-layout-'))
  setLocale('pl')
})
afterEach(() => {
  rmSync(dir, { recursive: true, force: true, maxRetries: 3 })
  if (today === undefined) delete process.env['TRAINCTL_TODAY']
  else process.env['TRAINCTL_TODAY'] = today
})

function running(): void {
  process.env['TRAINCTL_TODAY'] = '2026-10-22'
  writeFileSync(join(dir, 'trainctl.yaml'), RUNNING, 'utf-8')
  expect(cmdPlan(dir).code).toBe(0)
}

function sports(): void {
  process.env['TRAINCTL_TODAY'] = '2026-11-02'
  const config = parse(sportsTemplate('run,bike,swim', '2026-11-02')) as SportsConfig
  config.athlete.sports.bike!.calibration = { date: '2026-11-01', source: 'test' }
  config.athlete.sports.bike!.ftpWatts = 220
  config.athlete.sports.swim!.cssSecPer100m = 120
  expect(cmdInit(dir, stringify(config)).code).toBe(0)
}

describe('C3: PLAN.md planu biegowego', () => {
  it('siatka sezonu na górze, tygodnie jako wiersze z rozpiską C1, legenda raz', () => {
    running()
    const md = readFileSync(join(dir, 'plan', 'PLAN.md'), 'utf-8')
    const plan = loadPlan(dir)
    const season = md.slice(md.indexOf('## Sezon'), md.indexOf('## Tydzień 1'))
    expect(season.split('\n').filter((line) => /^\| \d+( ↓)? \|/.test(line))).toHaveLength(25)
    expect(season).toMatch(/^\| 4 ↓ \| 9\.11 \| baza \| 32 \| 4×1 km @4:32 · 3 km 5:01→4:32 \| 11 \|$/m)
    expect(md.match(/> RG rozgrzewka · SCH schłodzenie/g)).toHaveLength(1)
    // każda jednostka biegowa jest w PLAN.md swoją notacją
    for (const day of plan.weeks.flatMap((w) => w.days).filter((d) => d.workout)) expect(md).toContain(`| ${workoutLine(day.workout!)} |`)
    // opis słowny został w plan.yaml i w why
    expect(md).not.toContain('tempo rozgrzewkowe')
  })

  it('siła opisana raz w sekcji, w tabelach tygodni tylko wariant', () => {
    running()
    const md = readFileSync(join(dir, 'plan', 'PLAN.md'), 'utf-8')
    const descriptions = new Set(loadPlan(dir).weeks.flatMap((w) => w.days).flatMap((d) => (d.strength ? [d.strength.description] : [])))
    expect(descriptions.size).toBeGreaterThan(0)
    for (const description of descriptions) expect(md.split(description).length - 1, description).toBe(1)
    expect(md).toMatch(/^\| (?:[A-ZŚŻ]{2})? \| siła \|  \| 0:\d\d \| (wejście|ciężka|podtrzymująca) \|$/m)
    expect(md.indexOf('## Siła')).toBeLessThan(md.indexOf('## Tydzień 1'))
  })

  it('wiersze tygodnia w PLAN.md są tymi samymi wierszami co `week` (bez statusu)', () => {
    running()
    const md = readFileSync(join(dir, 'plan', 'PLAN.md'), 'utf-8')
    const rows = cmdWeek(dir, { date: '2026-11-17' }).data!['rows'] as { line: string; kind: string }[]
    for (const row of rows.filter((r) => r.line)) expect(md).toContain(`| ${row.kind} |`)
    const week = md.slice(md.indexOf('## Tydzień 5 '), md.indexOf('## Tydzień 6 '))
    for (const row of rows.filter((r) => r.line)) expect(week).toContain(` | ${row.line} |`)
    expect(week).toMatch(/^\| {2}\| \*\*suma\*\* \| \*\*\d+\*\* \| \*\*\d+:\d\d\*\* \| {2}\|$/m)
  })

  it('po angielsku: nagłówki, legenda i warianty siły z katalogu', () => {
    setLocale('en')
    running()
    const md = readFileSync(join(dir, 'plan', 'PLAN.md'), 'utf-8')
    expect(md).toContain('## Season\n\n| wk | from | phase | km | accents | long |')
    expect(md).toContain('> WU warm-up · CD cool-down')
    expect(md).toContain('## Strength')
    expect(md).not.toMatch(/[ąćęłńóśźż]/)
  })
})

describe('C3: wydruk i strona mobilna z tej samej funkcji wiersza', () => {
  it('wydruk: wiersz siły osobno, dzień podpisany raz, rozpiska jak w `week`', () => {
    running()
    expect(cmdExport(dir, { what: 'print' }).code).toBe(0)
    const html = readFileSync(join(dir, 'export', 'half-rozpiska.html'), 'utf-8')
    const rows = cmdWeek(dir, { date: '2026-10-27' }).data!['rows'] as { line: string; sport: string }[]
    for (const row of rows.filter((r) => r.sport === 'run')) expect(html).toContain(`<td class="what">${row.line.replace(/'/g, '&#39;')}</td>`)
    expect(html).toMatch(/<td class="day"><\/td>\s*<td class="date"><\/td>\s*<td class="kind">siła<\/td>/)
    expect(html).toContain('<td class="date">27.10</td>')
  })

  it('strona mobilna: rozpiska C1 w nagłówku i kroki ze struktury dnia', () => {
    running()
    expect(cmdExport(dir, { what: 'mobile', date: '2026-10-27' }).code).toBe(0)
    const html = readFileSync(join(dir, 'export', '2026-10-27-mobile.html'), 'utf-8')
    expect(html).toContain('<p class="line">RG 3 km · 4×1 km @4:32 p. 2&#39; marsz · SCH 1 km</p>')
    expect(html).toContain('<li>główna: 4×1 km · 4:25–4:38 · przerwa 2&#39; marsz</li>')
    expect(html).toContain('<li>schłodzenie: 1 km · trucht</li>')
  })
})

describe('C3: PLAN.md planu v2', () => {
  it('siatka sezonu, tygodnie z kolumną sportu, szczegóły sesji zachowane; nagłówki z katalogu', () => {
    sports()
    expect(cmdPlan(dir).code).toBe(0)
    const md = readFileSync(join(dir, 'plan', 'PLAN.md'), 'utf-8')
    const plan = loadSportsPlan(dir)
    expect(md).toContain('## Sezon\n\n| tydz | od | faza | sesje | czas |')
    expect(md).toContain('| dz | sport | typ | czas | rozpiska |')
    expect(md.indexOf('## Sezon')).toBeLessThan(md.indexOf('## Tydzień 2.11–8.11'))
    for (const s of plan.sessions.slice(0, 6)) {
      expect(md).toContain(`ID: ${s.id}`)
      if (s.coaching) expect(md).toContain(s.coaching.objective)
    }
    // dawne nagłówki po angielsku w polskim pliku (C6) zniknęły
    expect(md).not.toContain('| ID | Date |')
    expect(md).not.toContain('## History')
  })
})

describe('C4: `plan` w katalogu v2', () => {
  it('nowy plan: cel, horyzont, czas tygodniowy na sport i siatka sezonu; potem „aktualny"', () => {
    sports()
    const first = cmdPlan(dir)
    expect(first.code, first.output).toBe(0)
    expect(first.output).toMatch(/^Base\nbudowanie bazy do 2026-12-27 · 8 tygodni planu$/m)
    expect(first.output).toContain('Czas tygodniowo: bieg 1:30 · rower 1:30 · pływanie 1:30')
    expect(first.output).toContain('tydz | od | faza | sesje | czas')
    expect(first.output).toMatch(/^4 ↓ \| 23\.11 \| odciążenie \| 6 \| 4:35$/m)
    expect(first.output).toContain('Zapisano plan/plan.yaml + plan/PLAN.md')
    expect(first.output).not.toMatch(/Zapisano:$/m)
    expect(first.data).toMatchObject({ changed: true, season: expect.arrayContaining([expect.objectContaining({ week: 1, sessions: 6 })]) })

    const second = cmdPlan(dir)
    expect(second.output).toContain('Plan jest aktualny.')
    expect(second.output).toContain('tydz | od | faza | sesje | czas')
    expect(second.data).toMatchObject({ changed: false })
  })

  it('zatwierdzona baza (adapt) zastępuje czas z profilu w nagłówku, jak w generatorze', () => {
    sports()
    expect(cmdPlan(dir).code).toBe(0)
    const path = join(dir, 'plan', 'plan.yaml')
    const plan = parse(readFileSync(path, 'utf-8')) as ReturnType<typeof loadSportsPlan>
    plan.baselines = { bike: { weeklyMinutes: 150, profileWeeklyMinutes: 90 } }
    writeFileSync(path, stringify(plan), 'utf-8')
    expect(cmdPlan(dir).output).toContain('rower 2:30')
  })

  it('zmieniony profil: siatka z nowego planu i czas tygodniowy z nowego profilu', () => {
    sports()
    expect(cmdPlan(dir).code).toBe(0)
    const config = parse(readFileSync(join(dir, 'trainctl.yaml'), 'utf-8')) as SportsConfig
    config.athlete.sports.bike!.weeklyMinutes = 120
    writeFileSync(join(dir, 'trainctl.yaml'), stringify(config), 'utf-8')
    const changed = cmdPlan(dir)
    expect(changed.code, changed.output).toBe(0)
    expect(changed.output).toContain('rower 2:00')
    expect(changed.output).toContain('Zapisano plan/plan.yaml + plan/PLAN.md')
    expect(changed.data).toMatchObject({ changed: true })
  })
})
