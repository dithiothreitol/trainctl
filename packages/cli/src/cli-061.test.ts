/**
 * Pakiet A (docs/PLAN-v0.7.md, etap 1): etykiety i formaty wyjścia bez zmian
 * w silniku — nagłówki tabeli wykonania, „do startu" bez powtórzenia, liczby
 * dziesiętne w formacie języka, status dziennika słowem z katalogu, adresy
 * nie cięte przy zawijaniu, wiek wyniku liczony od dziś.
 */
import { appendFileSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { setLocale } from 'trainctl-core'
import { cmdDesk, cmdLog, cmdPlan, cmdReview, cmdRules, cmdStatus, cmdToday, cmdWeek, cmdWhy } from './commands.ts'
import { ruleEvidence } from './rules-explain.ts'
import { logChoices } from './interactive.ts'
import { calibrationLabel } from './calibration.ts'
import { shownKm } from './format.ts'
import { loadPlan, writePlan } from './planfile.ts'
import { appendLog, readLog, readStrengthLog } from './logfile.ts'
import { helpItem } from './ui/help.ts'
import { improveEn } from './i18n/improve-en.ts'
import { improvePl } from './i18n/improve-pl.ts'
import { shortenDetail } from './proposals.ts'
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
    cmdLog(dir, { date: '2026-10-27', status: 'skipped', km: '0' })
    expect(cmdToday(dir).output).not.toContain('0 km')
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
    const out = renderAnsi([{ t: 'table', head: ['a', 'b'], rows: [['x', 'https://github.com/dithiothreitol/trainctl/blob/v0.6.0/docs/science/FOUNDATIONS.md']] }], theme)
    for (const line of out.split('\n')) expect(visibleLength(line)).toBeLessThanOrEqual(40)
  })

  it('kv z adresem dłuższym niż kolumna wartości przechodzi w układ piętrowy, adres w całości', () => {
    const url = 'https://github.com/dithiothreitol/trainctl/blob/v0.6.0/docs/science/FOUNDATIONS.md'
    const out = renderAnsi([{ t: 'kv', pairs: [['Source', url]] }], new Theme({ color: false, unicode: true, width: 60 }))
    expect(out.split('\n').some((line) => line.trim() === url)).toBe(true)
  })

  it('kod CLI nie wstawia surowych kilometrów (format języka przez kmLabel albo n())', () => {
    const files = readdirSync(import.meta.dirname, { recursive: true, encoding: 'utf-8' })
      .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
    for (const f of files) {
      const src = readFileSync(join(import.meta.dirname, f), 'utf-8')
      // każda wartość przed „ km" przechodzi przez n(), kmLabel() albo formatNumber();
      // wyjątki: sam kmLabel i historia zmian w plan.yaml (dane, nie widok)
      const raw = src.split('\n').filter((line) => /\$\{(?!n\(|kmLabel\(|formatNumber\()[^}]*\} km/.test(line))
        .filter((line) => !line.includes('String(km)} km') && !line.includes('${from} → ${to} km'))
      expect(raw, f).toEqual([])
      expect(src, f).not.toContain('String(w.totalKm)')
    }
  })

  it('podtytuł tygodnia: bez planowanej sumy jedna liczba', () => {
    setLocale('en')
    expect(cmdWeek(dir).output).toMatch(/\(pyramidal\) · \d+ km/)
  })
})

describe('poprawki po drugiej rundzie przeglądu etapu 1', () => {
  it('review po starcie mówi „po starcie", nie „temu"', async () => {
    process.env['TRAINCTL_TODAY'] = '2027-04-02'
    setLocale('pl')
    expect((await cmdReview(dir, {})).output).toContain('Od startu: 5 dni')
    setLocale('en')
    const out = (await cmdReview(dir, {})).output
    expect(out).toContain('Since the race: 5 days')
    expect(out).not.toContain('To race day')
  })

  it('siła w dzienniku po polsku w rodzaju żeńskim', () => {
    setLocale('pl')
    process.env['TRAINCTL_TODAY'] = '2026-10-28'
    const saved = cmdLog(dir, { date: '2026-10-28', strength: 'done' }).output
    expect(saved).toContain('wykonana')
    expect(cmdToday(dir).output).toContain('Siła zalogowana: wykonana')
  })

  it('why: wynik użyty do stref, dziś starszy niż 540 dni, mówi to wprost', () => {
    writeFileSync(join(dir, 'trainctl.yaml'), CONFIG.replace('"2026-09-27"', '"2025-06-09"'), 'utf-8')
    cmdPlan(dir, { fresh: true })
    setLocale('en')
    process.env['TRAINCTL_TODAY'] = '2026-12-21'
    const out = cmdWhy(dir, { date: '2026-12-22' }).output
    expect(out).toContain('now older than 540 days')
    expect(out).not.toMatch(/Used for zones · \d+ days/)
  })

  it('nieznany status w log.jsonl pokazany bez zmian, nie „undefined"', () => {
    setLocale('en')
    process.env['TRAINCTL_TODAY'] = '2026-10-27'
    appendFileSync(join(dir, 'log.jsonl'), JSON.stringify({ date: '2026-10-27', status: 'partial', loggedAt: '2026-10-27T10:00:00Z' }) + '\n')
    for (const out of [cmdWeek(dir).output, cmdToday(dir).output, cmdStatus(dir).output]) {
      expect(out).toContain('partial')
      expect(out).not.toContain('undefined')
    }
  })
})

describe('poprawki po trzeciej rundzie przeglądu etapu 1', () => {
  it('why w dniu startu: dystans segmentu w formacie języka', () => {
    setLocale('pl')
    const out = cmdWhy(dir, { date: '2027-03-28' }).output
    expect(out).toContain('21,1 km')
    expect(out).not.toContain('21.0975')
  })

  it('PLAN.md: objętość tygodnia w formacie języka', () => {
    setLocale('pl')
    cmdPlan(dir, { fresh: true })
    const md = readFileSync(join(dir, 'plan', 'PLAN.md'), 'utf-8')
    expect(md).not.toMatch(/\d\.\d+ km/)
  })

  it('today nie pada na km spoza liczb w ręcznie edytowanym log.jsonl', () => {
    process.env['TRAINCTL_TODAY'] = '2026-10-27'
    appendFileSync(join(dir, 'log.jsonl'), JSON.stringify({ date: '2026-10-27', status: 'done', km: null, loggedAt: '2026-10-27T10:00:00Z' }) + '\n')
    const today = cmdToday(dir)
    expect(today.code).toBe(0)
    expect(today.output).not.toContain('null')
  })

  it('status równy kluczowi Object.prototype nie zwraca funkcji', () => {
    setLocale('en')
    process.env['TRAINCTL_TODAY'] = '2026-10-27'
    appendFileSync(join(dir, 'log.jsonl'), JSON.stringify({ date: '2026-10-27', status: 'constructor', loggedAt: '2026-10-27T10:00:00Z' }) + '\n')
    const out = cmdWeek(dir).output
    expect(out).toContain('[constructor]')
    expect(out).not.toContain('native code')
  })

  it('macierz profili nie trafia do paczki npm', () => {
    const pkg = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'package.json'), 'utf-8')) as { files: string[] }
    const build = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'tsconfig.build.json'), 'utf-8')) as { exclude: string[] }
    expect(pkg.files).toContain('!src/**/*.fixture.ts')
    expect(build.exclude).toContain('src/**/*.fixture.ts')
  })
})

describe('poprawki po czwartej rundzie przeglądu etapu 1', () => {
  it('wybór dnia w interaktywnym log: status i dystans w języku', () => {
    setLocale('pl')
    const choices = logChoices(loadPlan(dir), '2027-03-29', new Map([['2027-03-28', 'done']]))
    const race = choices.find((c) => c.value === '2027-03-28')!
    expect(race.hint).toContain('21,1 km')
    expect(race.hint).toContain('wykonany')
    expect(race.hint).not.toContain('done')
  })

  it('review dzień przed startem: „1 day"', async () => {
    setLocale('en')
    process.env['TRAINCTL_TODAY'] = '2027-03-27'
    expect((await cmdReview(dir, {})).output).toContain('To race day: 1 day\n')
  })

  it('review nie pada na km zapisane tekstem w log.jsonl', async () => {
    process.env['TRAINCTL_TODAY'] = '2026-10-29'
    appendFileSync(join(dir, 'log.jsonl'), JSON.stringify({ date: '2026-10-27', status: 'done', km: '8', loggedAt: '2026-10-27T10:00:00Z' }) + '\n')
    const out = await cmdReview(dir, {})
    expect(out.code).toBe(0)
    expect(out.output).toContain('8 km')
  })

  it('historia skrócenia w plan.yaml nie zależy od języka CLI', () => {
    setLocale('pl')
    expect(shortenDetail('2026-10-27', 10.25, 8, 40, 'shortened')).toBe('2026-10-27: 10.25 → 8 km; 40 min; shortened')
  })

  it('why: wynik z trailu, dziś starszy niż 540 dni, jest przeterminowany', () => {
    writeFileSync(join(dir, 'trainctl.yaml'), CONFIG.replace('    - { date: "2026-09-27", distanceKm: 10, timeSec: 2580 }',
      '    - { date: "2026-09-27", distanceKm: 10, timeSec: 2580 }\n    - { date: "2025-05-10", distanceKm: 21.1, timeSec: 7200, terrain: trail }'), 'utf-8')
    cmdPlan(dir, { fresh: true })
    setLocale('en')
    process.env['TRAINCTL_TODAY'] = '2026-11-30'
    const out = cmdWhy(dir, { date: '2026-12-01' }).output
    expect(out).toMatch(/2025-05-10 · 21\.1 km · VDOT [\d.]+ · Older than 540 days/)
  })
})

describe('poprawki po piątej rundzie przeglądu etapu 1', () => {
  it('desk w dniu startu pokazuje dystans startu, nie 0 km', () => {
    writeFileSync(join(dir, 'trainctl.yaml'), CONFIG + 'desk:\n  workStart: "09:00"\n  workEnd: "17:30"\n  lunchMinutes: 45\n  prefer: evening\n', 'utf-8')
    setLocale('pl')
    process.env['TRAINCTL_TODAY'] = '2027-03-28'
    const out = cmdDesk(dir, { date: '2027-03-28' }).output
    expect(out).toContain('21,1 km')
    expect(out).not.toMatch(/· 0 km/)
  })

  it('why: trail po kalibracji przy wyniku szosowym nie jest „nowszy, uwzględniony"', () => {
    writeFileSync(join(dir, 'trainctl.yaml'), CONFIG.replace('    - { date: "2026-09-27", distanceKm: 10, timeSec: 2580 }',
      '    - { date: "2026-09-27", distanceKm: 10, timeSec: 2580 }\n    - { date: "2026-10-25", distanceKm: 21.1, timeSec: 7200, terrain: trail }'), 'utf-8')
    cmdPlan(dir, { fresh: true })
    setLocale('en')
    process.env['TRAINCTL_TODAY'] = '2026-10-29'
    const out = cmdWhy(dir, { date: '2026-10-27' }).output
    expect(out).toMatch(/2026-10-25 · 21\.1 km · VDOT [\d.]+ · Trail result/)
    expect(out).not.toContain('Newer than the calibration')
  })

  it('ostrzeżenie o celu tygodnia formatuje kilometry', () => {
    expect(improvePl.targetMismatch('2026-10-26', 52.3, 50.8)).toContain('52,3 km')
    expect(improveEn.targetMismatch('2026-10-26', 52.3, 50.8)).toContain('50.8 km')
  })

  it('log.jsonl: liczby tekstem zamienione, wartości spoza liczb pominięte przy odczycie', () => {
    appendFileSync(join(dir, 'log.jsonl'), [
      JSON.stringify({ date: '2026-10-27', status: 'done', km: '8', rpe: '6', loggedAt: 'x' }),
      JSON.stringify({ date: '2026-10-28', status: 'done', km: null, timeSec: 'abc', loggedAt: 'x' }),
    ].join('\n') + '\n')
    const [a, b] = readLog(dir)
    expect(a).toMatchObject({ km: 8, rpe: 6 })
    expect(b).not.toHaveProperty('km')
    expect(b).not.toHaveProperty('timeSec')
  })

  it('pomoc w dwóch kolumnach trzyma szerokość także z adresem w opisie', () => {
    const theme = new Theme({ color: false, unicode: true, width: 60 })
    const out = helpItem('rules', 10, 'see https://github.com/dithiothreitol/trainctl/blob/v0.6.0/docs/science/FOUNDATIONS.md', theme)
    for (const line of out.split('\n')) expect(visibleLength(line)).toBeLessThanOrEqual(60)
  })
})

describe('poprawki po szóstej rundzie przeglądu etapu 1', () => {
  const withResults = (results: string, goalExtra = '') => {
    writeFileSync(join(dir, 'trainctl.yaml'), CONFIG.replace('    - { date: "2026-09-27", distanceKm: 10, timeSec: 2580 }', results)
      .replace('  priority: A\n', `  priority: A\n${goalExtra}`), 'utf-8')
    cmdPlan(dir, { fresh: true })
    setLocale('en')
    process.env['TRAINCTL_TODAY'] = '2026-10-29'
    return cmdWhy(dir, { date: '2026-10-27' }).output
  }

  it('cel trailowy: wynik z trailu użyty do stref nie jest opisany jako odrzucony', () => {
    const out = withResults('    - { date: "2026-09-27", distanceKm: 10, timeSec: 2700 }\n    - { date: "2026-09-20", distanceKm: 21.1, timeSec: 5400, terrain: trail }', '  terrain: trail\n')
    expect(out).toMatch(/2026-09-20 · 21\.1 km · VDOT [\d.]+ · Used for zones/)
  })

  it('wynik szosowy przeterminowany: trail, który ustawił strefy, zostaje „użyty"', () => {
    const out = withResults('    - { date: "2025-01-10", distanceKm: 10, timeSec: 2580 }\n    - { date: "2026-09-20", distanceKm: 21.1, timeSec: 6000, terrain: trail }')
    expect(out).toMatch(/2026-09-20 · 21\.1 km · VDOT [\d.]+ · Used for zones/)
    expect(out).not.toContain('Trail result')
  })

  it('log.jsonl: czas „58:30" wpisany ręcznie zostaje odczytany', () => {
    appendFileSync(join(dir, 'log.jsonl'), JSON.stringify({ date: '2026-10-27', status: 'done', timeSec: '58:30', loggedAt: 'x' }) + '\n')
    expect(readLog(dir)[0]).toMatchObject({ timeSec: 3510 })
  })
})

describe('poprawki po siódmej rundzie przeglądu etapu 1', () => {
  it('log.jsonl: dystans z przecinkiem odczytany jako liczba', () => {
    appendFileSync(join(dir, 'log.jsonl'), JSON.stringify({ date: '2026-10-27', status: 'done', km: '8,5', loggedAt: 'x' }) + '\n')
    expect(readLog(dir)[0]).toMatchObject({ km: 8.5 })
  })

  it('opuszczona sesja nie zapisuje 0 km', () => {
    process.env['TRAINCTL_TODAY'] = '2026-10-27'
    cmdLog(dir, { date: '2026-10-27', status: 'skipped', km: '0' })
    const raw = readFileSync(join(dir, 'log.jsonl'), 'utf-8')
    expect(raw).not.toContain('"km"')
  })

  it('calibrationLabel: wynik, który dziś ustawiłby strefy, i przeterminowany z następcą', () => {
    const result = { date: '2026-01-01', distanceKm: 10, timeSec: 2580 }
    const c = (reason: 'selected' | 'lower-vdot' | 'stale') => ({ result, ageDays: 0, vdot: 47, reason })
    expect(calibrationLabel(c('lower-vdot'), c('selected'), true)).toBe('nowBest')
    expect(calibrationLabel(c('selected'), c('stale'), true)).toBe('selectedStaleReplaced')
    expect(calibrationLabel(c('selected'), c('stale'), false)).toBe('selectedStale')
  })
})

describe('poprawki po ósmej rundzie przeglądu etapu 1', () => {
  it('why: dane MCP mają stan wyników na dziś zgodny z tekstem', () => {
    writeFileSync(join(dir, 'trainctl.yaml'), CONFIG.replace('"2026-09-27"', '"2025-06-09"'), 'utf-8')
    cmdPlan(dir, { fresh: true })
    process.env['TRAINCTL_TODAY'] = '2026-12-21'
    const why = cmdWhy(dir, { date: '2026-12-22' })
    expect(why.data).toMatchObject({ calibrationToday: [{ date: '2025-06-09', label: 'selectedStale' }] })
  })

  it('why: świeży wynik dopisany do trainctl.yaml bez regeneracji — „plan przejdzie na nowszy"', () => {
    writeFileSync(join(dir, 'trainctl.yaml'), CONFIG.replace('"2026-09-27"', '"2025-06-09"'), 'utf-8')
    cmdPlan(dir, { fresh: true })
    writeFileSync(join(dir, 'trainctl.yaml'), CONFIG.replace('    - { date: "2026-09-27", distanceKm: 10, timeSec: 2580 }',
      '    - { date: "2025-06-09", distanceKm: 10, timeSec: 2580 }\n    - { date: "2026-12-01", distanceKm: 10, timeSec: 2600 }'), 'utf-8')
    setLocale('en')
    process.env['TRAINCTL_TODAY'] = '2026-12-21'
    expect(cmdWhy(dir, { date: '2026-12-22' }).output).toContain('trainctl plan will switch to a newer result')
  })

  it('wpis dziennika bez statusu nie pokazuje „undefined"', () => {
    setLocale('en')
    process.env['TRAINCTL_TODAY'] = '2026-10-27'
    appendFileSync(join(dir, 'log.jsonl'), JSON.stringify({ date: '2026-10-27', km: 8, loggedAt: 'x' }) + '\n')
    for (const out of [cmdWeek(dir).output, cmdToday(dir).output, cmdStatus(dir).output]) expect(out).not.toContain('undefined')
  })

  it('shownKm: start pokazuje dystans startu', () => {
    expect(shownKm({ distanceKm: 0, raceDistanceKm: 21.0975 })).toBe(21.0975)
    expect(shownKm({ distanceKm: 8 })).toBe(8)
  })
})

describe('poprawki po dziewiątej rundzie przeglądu etapu 1', () => {
  const stalePlan = () => {
    writeFileSync(join(dir, 'trainctl.yaml'), CONFIG.replace('    - { date: "2026-09-27", distanceKm: 10, timeSec: 2580 }',
      '    - { date: "2025-06-09", distanceKm: 10, timeSec: 2500 }\n    - { date: "2026-01-10", distanceKm: 10, timeSec: 2700 }'), 'utf-8')
    cmdPlan(dir, { fresh: true })
    setLocale('en')
    process.env['TRAINCTL_TODAY'] = '2026-12-21'
  }

  it('why nie obiecuje następcy, którego trainctl.yaml już nie ma', () => {
    stalePlan()
    writeFileSync(join(dir, 'trainctl.yaml'), CONFIG.replace(/  results:\n.*\n/, '  results: []\n'), 'utf-8')
    const why = cmdWhy(dir, { date: '2026-12-22' })
    expect(why.output).not.toContain('will switch to a newer result')
    // wyniki usunięte z profilu: plan po regeneracji ich nie zobaczy
    expect(why.data).toMatchObject({ calibrationToday: expect.arrayContaining([expect.objectContaining({ date: '2025-06-09', label: 'removed' }), expect.objectContaining({ date: '2026-01-10', label: 'removed' })]) })
  })

  it('why dopasowuje stan wyniku po kluczu, nie po pozycji', () => {
    stalePlan()
    const plan = loadPlan(dir)
    plan.calibration!.results.reverse()
    writePlan(dir, plan)
    const why = cmdWhy(dir, { date: '2026-12-22' })
    expect(why.data).toMatchObject({ calibrationToday: expect.arrayContaining([
      expect.objectContaining({ date: '2025-06-09', label: 'selectedStaleReplaced' }),
      expect.objectContaining({ date: '2026-01-10', label: 'nowBest' }),
    ]) })
  })

  it('dopisanie do log.jsonl bez końcowej nowej linii nie skleja wpisów', () => {
    writeFileSync(join(dir, 'log.jsonl'), JSON.stringify({ date: '2026-10-26', status: 'done', loggedAt: 'x' }), 'utf-8')
    appendLog(dir, { date: '2026-10-27', status: 'done', loggedAt: 'y' })
    expect(readLog(dir).map((e) => e.date)).toEqual(['2026-10-26', '2026-10-27'])
  })

  it('log.jsonl: wartości, których CLI nie przyjmuje, pominięte przy odczycie', () => {
    appendFileSync(join(dir, 'log.jsonl'), [
      JSON.stringify({ date: '2026-10-27', status: 'done', rpe: 15, km: -5, loggedAt: 'x' }),
      JSON.stringify({ date: '2026-10-28', status: 'done', rpe: 7.5, km: '0x10', timeSec: '1e3', loggedAt: 'x' }),
    ].join('\n') + '\n')
    for (const e of readLog(dir)) {
      expect(e).not.toHaveProperty('rpe')
      expect(e).not.toHaveProperty('km')
      expect(e).not.toHaveProperty('timeSec')
    }
  })

  it('E-3 wymienia wszystkie oznaczone stałe', () => {
    setLocale('en')
    const out = cmdRules({ id: 'E-3' }).output
    for (const value of ['+40%', '+15%', '5–8 km', '3 km', '35%']) expect(out).toContain(value)
  })

  it('PLAN.md pokazuje liczby z historii zmian w formacie języka', () => {
    setLocale('pl')
    const plan = loadPlan(dir)
    plan.changes.push({ at: '2026-10-27', action: 'shorten', detail: '2026-10-27: 8.5 → 6 km; 40 min; shortened' })
    writePlan(dir, plan)
    const md = readFileSync(join(dir, 'plan', 'PLAN.md'), 'utf-8')
    expect(md).toContain('2026-10-27: 8,5 → 6 km')
    expect(loadPlan(dir).changes.at(-1)!.detail).toContain('8.5 → 6 km')
  })
})

describe('poprawki po dziesiątej rundzie przeglądu etapu 1', () => {
  it('why: jedno źródło etykiet — wynik usunięty z profilu nie „ustawiłby stref"', () => {
    writeFileSync(join(dir, 'trainctl.yaml'), CONFIG.replace('    - { date: "2026-09-27", distanceKm: 10, timeSec: 2580 }',
      '    - { date: "2025-06-09", distanceKm: 10, timeSec: 2500 }\n    - { date: "2026-01-10", distanceKm: 10, timeSec: 2700 }'), 'utf-8')
    cmdPlan(dir, { fresh: true })
    writeFileSync(join(dir, 'trainctl.yaml'), CONFIG.replace('    - { date: "2026-09-27", distanceKm: 10, timeSec: 2580 }',
      '    - { date: "2025-06-09", distanceKm: 10, timeSec: 2500 }'), 'utf-8')
    setLocale('en')
    process.env['TRAINCTL_TODAY'] = '2026-12-21'
    const why = cmdWhy(dir, { date: '2026-12-22' })
    expect(why.data).toMatchObject({ calibrationToday: expect.arrayContaining([
      expect.objectContaining({ date: '2025-06-09', label: 'selectedStale' }),
      expect.objectContaining({ date: '2026-01-10', label: 'removed' }),
    ]) })
    expect(why.output).not.toContain('Would set the zones today')
  })

  it('log.jsonl: minuty siły w granicach `log --strength` (całkowite 1–300)', () => {
    appendFileSync(join(dir, 'log.jsonl'), [
      JSON.stringify({ date: '2026-10-27', activity: 'strength', status: 'done', minutes: '0,5', loggedAt: 'x' }),
      JSON.stringify({ date: '2026-10-28', activity: 'strength', status: 'done', minutes: 5000, loggedAt: 'x' }),
      JSON.stringify({ date: '2026-10-29', activity: 'strength', status: 'done', minutes: '45', loggedAt: 'x' }),
    ].join('\n') + '\n')
    expect(readStrengthLog(dir).map((e) => e.minutes)).toEqual([undefined, undefined, 45])
  })
})
