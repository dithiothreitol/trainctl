/**
 * PLAN-v0.7 C2: trzy poziomy szczegółowości (sezon, tydzień, dzień) w jednym modelu
 * wiersza dla planu biegowego i planu v2. Migawki przy 60, 80, 100 i 120 kolumnach
 * bez koloru (NO_COLOR), w ASCII, po polsku i po angielsku; budżety wierszy przy
 * 80 kolumnach z DoD; żaden wiersz nie jest szerszy niż terminal.
 *
 * Profile z PLAN-v0.7 §1: P1 (plan biegowy, 45 km/tydz., siła) i P4 (v2: bieg, rower,
 * pływanie po 2×45 min, cel bazowy) — na nich DoD mierzy budżety. Trzeci plan
 * („rich", trzy sporty po trzy sesje z akcentami) sprawdza dni z dwiema sesjami
 * i szerokość wierszy przy długiej rozpisce pływania.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parse, stringify } from 'yaml'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { addDays, setLocale, type SportsConfig } from 'trainctl-core'
import { cmdInit, cmdLog, cmdPlan, cmdSeason, cmdToday, cmdWeek, type CmdResult } from './commands.ts'
import { loadPlan } from './planfile.ts'
import { loadSportsPlan, sportsTemplate } from './sports-store.ts'
import { renderAnsi, renderPlain, type Block } from './ui/blocks.ts'
import { Theme, stripAnsi, visibleLength } from './ui/theme.ts'

type Lang = 'pl' | 'en'
const LANGS: Lang[] = ['pl', 'en']
const WIDTHS = [60, 80, 100, 120]

const running = (lang: Lang) => `language: ${lang}
athlete:
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

/**
 * Plan v2: P4 z szablonu (po 2×45 min) albo „rich" — trzy sporty po trzy sesje
 * z akcentami, więc są też dni z dwiema sesjami.
 */
function sports(lang: Lang, rich: boolean): string {
  const config = parse(sportsTemplate('run,bike,swim', '2026-11-02')) as SportsConfig
  config.language = lang
  if (rich) {
    config.goal.date = '2027-01-31'
    for (const p of Object.values(config.athlete.sports)) {
      p.weeklyMinutes = 180
      p.sessionsPerWeek = 3
      p.experience = 'regular'
      p.calibration = { date: '2026-11-01', source: 'test' }
    }
  }
  // P4 jak w sports.test.ts: rower skalibrowany, pływanie z CSS bez kalibracji
  config.athlete.sports.bike!.calibration = { date: '2026-11-01', source: 'test' }
  config.athlete.sports.bike!.ftpWatts = 220
  config.athlete.sports.swim!.cssSecPer100m = 120
  return stringify(config)
}

type Plan = 'run' | 'p4' | 'rich'
const dirs = new Map<string, string>()
const env = { today: process.env['TRAINCTL_TODAY'], ascii: process.env['TRAINCTL_ASCII'] }

beforeAll(() => {
  for (const lang of LANGS) {
    setLocale(lang)
    const run = mkdtempSync(join(tmpdir(), `trainctl-views-run-${lang}-`))
    process.env['TRAINCTL_TODAY'] = '2026-10-22'
    writeFileSync(join(run, 'trainctl.yaml'), running(lang), 'utf-8')
    expect(cmdPlan(run).code).toBe(0)
    process.env['TRAINCTL_TODAY'] = '2026-10-29'
    cmdLog(run, { date: '2026-10-27', status: 'done' })
    dirs.set(`run-${lang}`, run)

    for (const plan of ['p4', 'rich'] as const) {
      const multi = mkdtempSync(join(tmpdir(), `trainctl-views-${plan}-${lang}-`))
      process.env['TRAINCTL_TODAY'] = '2026-11-02'
      expect(cmdInit(multi, sports(lang, plan === 'rich')).code).toBe(0)
      expect(cmdPlan(multi).code).toBe(0)
      const first = [...loadSportsPlan(multi).sessions].sort((a, z) => a.date.localeCompare(z.date))[0]!
      process.env['TRAINCTL_TODAY'] = '2026-11-04'
      cmdLog(multi, { session: first.id, status: 'done' })
      dirs.set(`${plan}-${lang}`, multi)
    }
  }
}, 60_000) // sześć planów; przy pełnej, równoległej bramce domyślne 10 s nie wystarcza

afterEach(() => {
  delete process.env['TRAINCTL_ASCII']
})

afterAll(() => {
  for (const dir of dirs.values()) rmSync(dir, { recursive: true, force: true, maxRetries: 3 })
  if (env.today === undefined) delete process.env['TRAINCTL_TODAY']
  else process.env['TRAINCTL_TODAY'] = env.today
  if (env.ascii !== undefined) process.env['TRAINCTL_ASCII'] = env.ascii
})

const blocks = (r: CmdResult): Block[] => (r as CmdResult & { blocks?: Block[] }).blocks ?? []
const render = (r: CmdResult, width: number, unicode = true): string =>
  renderAnsi(blocks(r), new Theme({ color: false, unicode, width }))
const lines = (text: string): number => text.split('\n').length

/** Widok w danym języku i dniu; ASCII włącza też notację bez Unicode (TRAINCTL_ASCII). */
function view(plan: Plan, lang: Lang, name: 'week' | 'today' | 'season', opts: { ascii?: boolean; date?: string; full?: boolean; today?: string } = {}): CmdResult {
  setLocale(lang)
  if (opts.ascii) process.env['TRAINCTL_ASCII'] = '1'
  else delete process.env['TRAINCTL_ASCII']
  const today = opts.today ?? (plan === 'run' ? '2026-10-29' : '2026-11-04')
  process.env['TRAINCTL_TODAY'] = today
  const dir = dirs.get(`${plan}-${lang}`)!
  const date = opts.date ?? today
  return name === 'week' ? cmdWeek(dir, { date, full: opts.full }) : name === 'today' ? cmdToday(dir, { date, full: opts.full }) : cmdSeason(dir, { date })
}

const trimmed = (text: string): string => text.split('\n').map((line) => line.trimEnd()).join('\n')

describe('C2: migawki widoków', () => {
  for (const plan of ['run', 'p4'] as const) {
    for (const lang of LANGS) {
      for (const name of ['week', 'today', 'season'] as const) {
        it(`${plan} · ${lang} · ${name}: 60–120 kolumn, NO_COLOR i ASCII`, () => {
          const r = view(plan, lang, name)
          expect(r.code, r.output).toBe(0)
          for (const width of WIDTHS) {
            const text = render(r, width)
            for (const line of text.split('\n')) expect(visibleLength(line), `${width}: ${line}`).toBeLessThanOrEqual(width)
            expect(text).toMatchSnapshot(`${width}`)
          }
          const ascii = render(view(plan, lang, name, { ascii: true }), 80, false)
          expect(ascii).not.toMatch(/[×→▸✓✗─]/)
          expect(ascii).toMatchSnapshot('ascii-80')
          // MCP i potok: ten sam tekst bez ANSI i bez symboli statusu
          expect(r.output).not.toContain('\x1b[')
          expect(r.output).not.toMatch(/[▸✓✗]/)
          expect(r.output).toMatchSnapshot('plain')
        })
      }
    }
  }

  it('plan v2 z akcentami: żaden wiersz szerszy niż terminal, także przy dwóch sesjach dziennie', () => {
    for (const lang of LANGS) {
      const views = [view('rich', lang, 'week'), view('rich', lang, 'season')]
      for (let date = '2026-11-02'; date < '2026-11-09'; date = addDays(date, 1)) views.push(view('rich', lang, 'today', { date }))
      for (const r of views) {
        for (const width of WIDTHS) {
          for (const line of render(r, width).split('\n')) expect(visibleLength(line), `${lang} ${width}: ${line}`).toBeLessThanOrEqual(width)
        }
      }
    }
  })

  it('kolor nie zmienia układu: po zdjęciu ANSI ten sam tekst co bez koloru', () => {
    for (const plan of ['run', 'p4'] as const) {
      for (const name of ['week', 'today', 'season'] as const) {
        const r = view(plan, 'pl', name)
        const colored = renderAnsi(blocks(r), new Theme({ color: true, unicode: true, width: 80 }))
        expect(colored).toContain('\x1b[')
        expect(trimmed(stripAnsi(colored))).toBe(trimmed(render(r, 80)))
      }
    }
  })
})

describe('C2: budżety wierszy przy 80 kolumnach (DoD)', () => {
  it('week biegowy: do 14 wierszy w każdym tygodniu bez startu', () => {
    for (const lang of LANGS) {
      const weeks = loadPlan(dirs.get(`run-${lang}`)!).weeks
      for (const week of weeks.filter((w) => !w.skeleton.raceDate && !w.skeleton.keepIntensity)) {
        const text = render(view('run', lang, 'week', { date: week.weekStart }), 80)
        expect(lines(text), `${lang} ${week.weekStart}\n${text}`).toBeLessThanOrEqual(14)
      }
    }
  })

  it('week v2 (P4): do liczby sesji + 9', () => {
    for (const lang of LANGS) {
      const plan = loadSportsPlan(dirs.get(`p4-${lang}`)!)
      for (let monday = '2026-11-02'; monday < '2026-12-28'; monday = addDays(monday, 7)) {
        const sessions = plan.sessions.filter((s) => s.date >= monday && s.date <= addDays(monday, 6)).length
        const text = render(view('p4', lang, 'week', { date: monday }), 80)
        expect(lines(text), `${lang} ${monday}\n${text}`).toBeLessThanOrEqual(sessions + 9)
      }
    }
  })

  it('today: do 18 wierszy w każdym dniu planu biegowego (P1) i planu v2 (P4)', () => {
    // P1: tydzień ładowania z siłą, tydzień sprawdzianu, szczyt z drabinką i tydzień startu
    const runWeeks = ['2026-10-26', '2026-11-16', '2027-02-15', '2027-03-22']
    for (const lang of LANGS) {
      for (const day of loadPlan(dirs.get(`run-${lang}`)!).weeks.filter((w) => runWeeks.includes(w.weekStart)).flatMap((w) => w.days)) {
        const text = render(view('run', lang, 'today', { date: day.date }), 80)
        expect(lines(text), `${lang} ${day.date}\n${text}`).toBeLessThanOrEqual(18)
      }
      // P4: tydzień bazowy i tydzień lżejszy (sesje powtarzają się co tydzień)
      for (let date = '2026-11-02'; date < '2026-11-30'; date = addDays(date, date < '2026-11-08' ? 1 : 7)) {
        const text = render(view('p4', lang, 'today', { date }), 80)
        expect(lines(text), `${lang} ${date}\n${text}`).toBeLessThanOrEqual(18)
      }
    }
  })

  it('season: do liczby tygodni + 10 (P1 i P4)', () => {
    for (const lang of LANGS) {
      for (const plan of ['run', 'p4'] as const) {
        const r = view(plan, lang, 'season')
        expect(lines(render(r, 80)), render(r, 80)).toBeLessThanOrEqual((r.data!['weeks'] as unknown[]).length + 10)
      }
    }
  })
})

describe('C2: pełne karty i dane', () => {
  it('--full w v2: karty z celem i wskazówkami, skala RPE raz na widok', () => {
    const r = view('rich', 'pl', 'week', { full: true })
    const text = renderPlain(blocks(r))
    expect(text.match(/1–2 bardzo lekko/g)).toHaveLength(1)
    expect(text).toContain('Cel')
    expect(view('rich', 'pl', 'week').output).not.toContain('1–2 bardzo lekko')
  })

  it('--full w planie biegowym: opis słowny jednostek pod tabelą', () => {
    expect(view('run', 'pl', 'week', { full: true }).output).toContain('rozgrzewkowe')
    expect(view('run', 'pl', 'today', { date: '2026-10-27', full: true }).output).toContain('rozgrzewkowe')
    expect(view('run', 'pl', 'today', { date: '2026-10-27' }).output).not.toContain('rozgrzewkowe')
  })

  it('dzień v2 z dwiema sesjami: dzień podpisany raz w tygodniu, każda sesja ze strukturą w dniu', () => {
    const plan = loadSportsPlan(dirs.get('rich-pl')!)
    const counts = new Map<string, number>()
    for (const s of plan.sessions) counts.set(s.date, (counts.get(s.date) ?? 0) + 1)
    const date = [...counts].find(([d, n]) => n > 1 && d >= '2026-11-02')?.[0] ?? ''
    expect(date).not.toBe('')
    const day = view('rich', 'pl', 'today', { date })
    expect(day.output.split('\n')[0]).toMatch(/· 2 sesje · około \d+ min razem z przygotowaniem$/)
    expect(day.output.match(/^etap \| dawka/gm)).toHaveLength(2)
    const week = view('rich', 'pl', 'week', { date })
    const rows = week.data!['rows'] as { date: string }[]
    expect(rows.filter((r) => r.date === date)).toHaveLength(2)
    // w tabeli tygodnia dzień podpisany raz: druga sesja dnia ma pusty dzień
    const text = render(week, 120)
    const shortDay = text.split('\n').filter((line) => /^(?:[▸✓✗~?] | {2})(?:PN|WT|ŚR|CZ|PT|SB|ND)\s/.test(line)).length
    expect(shortDay).toBe(new Set(rows.map((r) => r.date)).size)
    // „dziś" w dniu z dwiema sesjami: jeden znacznik, przy pierwszej sesji dnia
    const marked = render(view('rich', 'pl', 'week', { date, today: date }), 120)
    expect(marked.match(/▸/g)).toHaveLength(1)
    expect(view('rich', 'pl', 'week', { date, today: date }).output.match(/\| dziś$/gm)).toHaveLength(1)
  })

  it('dane: wiersze tygodnia, struktura dnia i tygodnie sezonu w obu planach', () => {
    for (const plan of ['run', 'p4'] as const) {
      expect(view(plan, 'en', 'week').data).toMatchObject({ rows: expect.arrayContaining([expect.objectContaining({ line: expect.any(String) })]) })
      expect(view(plan, 'en', 'today').data).toMatchObject({ structure: expect.any(Array) })
      expect(view(plan, 'en', 'season').data).toMatchObject({ weeks: expect.arrayContaining([expect.objectContaining({ week: 1 })]) })
    }
  })
})
