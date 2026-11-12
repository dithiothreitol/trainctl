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
import { distanceClass, goalClass, setLocale, vdotFromRace } from 'trainctl-core'
import { cmdAdapt, cmdDesk, cmdLog, cmdPlan, cmdReschedule, cmdReview, cmdRules, cmdShift, cmdStatus, cmdToday, cmdWeek, cmdWhy } from './commands.ts'
import { ruleEvidence } from './rules-explain.ts'
import { logChoices, parseKmText, parseRpeText, plannedKmDefault } from './interactive.ts'
import { recalibrationToday, roundVdot, zoneCalibration, zoneSource } from './calibration.ts'
import { kmLabel, logStatusText, parseDecimal, shownKm, workoutKm } from './format.ts'
import { loadPlan, writePlan } from './planfile.ts'
import { appendLog, latestByDate, lineSeparator, LOG_LIMITS, readLog, readStrengthLog } from './logfile.ts'
import { helpItem } from './ui/help.ts'
import { improveEn } from './i18n/improve-en.ts'
import { improvePl } from './i18n/improve-pl.ts'
import { coachEn } from './i18n/coach-en.ts'
import { coachPl } from './i18n/coach-pl.ts'
import { shortenDetail } from './proposals.ts'
import { renderAnsi, wrap, wrapText, type Block } from './ui/blocks.ts'
import { parseDistanceInput } from './ui/wizard.ts'
import { renderChoices } from './ui/select.ts'
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
      // krótka data „19.10" w siatce sezonu (C2) to zapis daty, nie liczba dziesiętna
      for (const out of [plan, why]) expect(out.replace(/https?:\/\/\S+/g, '').replace(/\b\d{1,2}\.(0[1-9]|1[0-2])\b/g, '')).not.toMatch(/\d\.\d/)
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
    // C2: szkic faz zastąpiła siatka sezonu — tydzień taperu to jeden wiersz
    expect(out).toMatch(lang === 'pl' ? /^22 \| 15\.03 \| taper \|/m : /^22 \| Mar 15 \| taper \|/m)
  })

  it('A5: status dziennika słowem z katalogu, surowy enum w danych', () => {
    process.env['TRAINCTL_TODAY'] = '2026-10-27'
    cmdLog(dir, { date: '2026-10-27', status: 'done' })
    const word = lang === 'pl' ? 'wykonany' : 'done'
    // C2: w wyjściu tekstowym status słowem na końcu wiersza jednostki
    expect(cmdWeek(dir).output).toMatch(new RegExp(`^WT\\b.* \\| ${word}$|^Tue\\b.* \\| ${word}$`, 'm'))
    expect(cmdStatus(dir).output).toContain(`(${word})`)
    const today = cmdToday(dir)
    expect(today.output).toContain(word)
    expect(today.data).toMatchObject({ log: { status: 'done' } })
    if (lang === 'pl') expect(cmdWeek(dir).output).not.toMatch(/\| done$/m)
  })

  it('tydzień startu: nagłówek i suma to trening obok startu, przy budżecie i bez (rejestr §14)', () => {
    for (const budget of ['', 'time:\n  weeklyMinutes: 240\n']) {
      writeFileSync(join(dir, 'trainctl.yaml'), CONFIG + budget, 'utf-8')
      process.env['TRAINCTL_TODAY'] = '2026-10-22'
      expect(cmdPlan(dir, { fresh: true }).code).toBe(0)
      const week = loadPlan(dir).weeks.find((w) => w.weekStart === '2027-03-22')!
      const km = kmLabel(week.totalKm).replace(/ km$/, '')
      const out = cmdWeek(dir, { date: '2027-03-26' }).output
      // nagłówek bez „cel”: trening rozpisany obok startu, nie cel tygodnia startowego
      expect(out, budget).toContain(`· ${km} km ·`)
      expect(out, budget).not.toMatch(/· (cel|target) /)
      // suma bez dystansu startu, który zostaje w swoim wierszu
      expect(out, budget).toMatch(new RegExp(`^(suma|total) \\| ${km.replace('.', '\\.')}( \\|.*)?$`, 'm'))
      expect(out, budget).toMatch(/(START|RACE) \| 21[,.]1 \|/)
    }
  })

  it('status po starcie: „Od startu: N dni”, jak w review, bez „N dni temu” (rejestr §14)', () => {
    process.env['TRAINCTL_TODAY'] = '2027-04-02'
    const out = cmdStatus(dir).output
    expect(out).toContain(lang === 'pl' ? 'Od startu: 5 dni' : 'Since the race: 5 days')
    expect(out).not.toMatch(/Do startu|To race day|temu|ago/)
    process.env['TRAINCTL_TODAY'] = '2027-03-23'
    expect(cmdStatus(dir).output).toContain(lang === 'pl' ? 'Do startu: 5 dni' : 'To race day: 5 days')
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
    const week = loadPlan(dir).weeks.find((w) => w.weekStart === '2026-10-26')!
    expect(week.totalKm).toBe(week.skeleton.targetKm)
    expect(out).not.toMatch(/zaplanowano|planned/)
    expect(out).toContain(kmLabel(week.totalKm))
  })
})

describe('A6: zawijanie nie tnie adresów ani ścieżek', () => {
  const url = 'https://github.com/dithiothreitol/trainctl/blob/v0.6.0/docs/science/FOUNDATIONS.md'
  it.each([40, 60, 80])('szerokość %i', (width) => {
    const lines = wrapText(`źródła i parametry: ${url} §10`, width)
    expect(lines.some((line) => line.trim() === url)).toBe(true)
  })
  it('ścieżka Windows zostaje w całości', () => {
    const path = 'C:\\Users\\someone\\AppData\\Local\\Temp\\very\\long\\training\\directory'
    expect(wrapText(path, 40)).toEqual([path])
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
  it('today pokazuje zalogowane km w formacie języka; 0 km to brak dystansu, echo log je pokazuje', () => {
    setLocale('pl')
    process.env['TRAINCTL_TODAY'] = '2026-10-27'
    cmdLog(dir, { date: '2026-10-27', status: 'modified', km: '8.5' })
    expect(cmdToday(dir).output).toContain('8,5 km')
    expect(cmdLog(dir, { date: '2026-10-27', status: 'modified', km: '0' }).output).toContain('0 km')
    expect(cmdToday(dir).output).not.toContain('0 km')
    cmdLog(dir, { date: '2026-10-27', status: 'skipped', km: '0' })
    expect(cmdToday(dir).output).not.toContain('0 km')
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
      const raw = src.split('\n').filter((line) => /\$\{(?!n2?\(|kmLabel\(|formatNumber\()[^}]*\} km/.test(line))
        .filter((line) => !line.includes('String(km)} km') && !line.includes('${from} → ${to} km'))
      expect(raw, f).toEqual([])
      expect(src, f).not.toContain('String(w.totalKm)')
    }
  })

  it('podtytuł tygodnia: bez planowanej sumy jedna liczba', () => {
    setLocale('en')
    // C2: cel tygodnia raz w nagłówku, suma dni pod tabelą; „target" tylko przy różnicy
    const out = cmdWeek(dir).output
    expect(out).toMatch(/^Week \d+\/\d+ · base · .* · \d+ km · \d+ runs/m)
    expect(out).not.toContain('target')
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
    const week = cmdWeek(dir)
    expect(week.output).toMatch(/\| constructor$/m)
    expect(week.output).not.toContain('native code')
    // w terminalu znacznik „?" zamiast funkcji z prototypu (C2)
    const ansi = renderAnsi((week as { blocks: Block[] }).blocks, new Theme({ color: false, unicode: true, width: 100 }))
    expect(ansi).not.toContain('native code')
    expect(ansi).toMatch(/^\? Tue /m)
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
    const choices = logChoices(loadPlan(dir), '2027-03-29', new Map([['2027-03-28', { status: 'done' }]]))
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
})

describe('poprawki po ósmej rundzie przeglądu etapu 1', () => {

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
})

describe('poprawki po dziesiątej rundzie przeglądu etapu 1', () => {

  it('log.jsonl: minuty siły w granicach `log --strength` (całkowite 1–300)', () => {
    appendFileSync(join(dir, 'log.jsonl'), [
      JSON.stringify({ date: '2026-10-27', activity: 'strength', status: 'done', minutes: '0,5', loggedAt: 'x' }),
      JSON.stringify({ date: '2026-10-28', activity: 'strength', status: 'done', minutes: 5000, loggedAt: 'x' }),
      JSON.stringify({ date: '2026-10-29', activity: 'strength', status: 'done', minutes: '45', loggedAt: 'x' }),
    ].join('\n') + '\n')
    expect(readStrengthLog(dir).map((e) => e.minutes)).toEqual([undefined, undefined, 45])
  })
})

describe('why: kalibracja stref — decyzje z dnia kalibracji i podpowiedź na dziś', () => {
  const RESULT = '    - { date: "2026-09-27", distanceKm: 10, timeSec: 2580 }'
  /** Plan wygenerowany 2026-10-22 z podanymi wynikami (i opcjonalnie innym celem). */
  const planWith = (results: string, goalExtra = '') => {
    writeFileSync(join(dir, 'trainctl.yaml'), CONFIG.replace(RESULT, results).replace('  priority: A\n', `  priority: A\n${goalExtra}`), 'utf-8')
    cmdPlan(dir, { fresh: true })
    setLocale('en')
  }
  const profile = (results: string) => writeFileSync(join(dir, 'trainctl.yaml'), CONFIG.replace(RESULT, results), 'utf-8')
  const whyOn = (today: string, date: string) => {
    process.env['TRAINCTL_TODAY'] = today
    return cmdWhy(dir, { date })
  }

  it('opis wyniku to decyzja z dnia kalibracji, wiek liczony od dziś, bez ujemnego wieku', () => {
    planWith(`${RESULT}\n    - { date: "2026-10-25", distanceKm: 5, timeSec: 1200 }`)
    const why = whyOn('2026-10-29', '2026-10-27')
    expect(why.output).toMatch(/2026-10-25 · 5 km · VDOT [\d.]+ · After the calibration date · 4 days old/)
    expect(why.output).toMatch(/2026-09-27 · 10 km · VDOT [\d.]+ · Used for zones · 32 days old/)
    expect(why.output).not.toMatch(/-\d+ days/)
    // lepszy wynik po dniu kalibracji: dziś plan skalibrowałby strefy z niego
    expect(why.output).toContain('would calibrate the zones from the 2026-10-25 result (5 km)')
    expect(why.data).toMatchObject({ recalibration: { changed: true, selected: { date: '2026-10-25' } } })
  })

  it('wynik użyty do stref, dziś starszy niż 540 dni, bez następcy: podpowiedź o świeżym wyniku', () => {
    planWith('    - { date: "2025-06-09", distanceKm: 10, timeSec: 2580 }')
    const why = whyOn('2026-12-21', '2026-12-22')
    expect(why.output).toMatch(/2025-06-09 · 10 km · VDOT [\d.]+ · Used for zones · 560 days old/)
    expect(why.output).toContain('No result meets the policy today')
    expect(why.data).toMatchObject({ recalibration: { changed: true, selected: null } })
  })

  it('świeży wynik dopisany do trainctl.yaml bez regeneracji: podpowiedź z jego datą', () => {
    planWith('    - { date: "2025-06-09", distanceKm: 10, timeSec: 2580 }')
    profile('    - { date: "2025-06-09", distanceKm: 10, timeSec: 2580 }\n    - { date: "2026-12-01", distanceKm: 10, timeSec: 2600 }')
    const why = whyOn('2026-12-21', '2026-12-22')
    expect(why.output).toContain('would calibrate the zones from the 2026-12-01 result')
    expect(why.output).not.toContain('No result meets the policy today')
  })

  it('wynik wykluczony w trainctl.yaml: decyzja zostaje, podpowiedź mówi o zmianie', () => {
    planWith(RESULT)
    profile('    - { date: "2026-09-27", distanceKm: 10, timeSec: 2580, excluded: true, exclusionReason: "injury" }')
    const why = whyOn('2026-10-29', '2026-10-27')
    expect(why.output).toMatch(/2026-09-27 · 10 km · VDOT [\d.]+ · Used for zones/)
    expect(why.output).toContain('No result meets the policy today')
  })

  it('nowa nazwa wyniku w trainctl.yaml to ten sam wynik: bez podpowiedzi', () => {
    planWith(RESULT)
    profile('    - { date: "2026-09-27", distanceKm: 10, timeSec: 2580, name: "Parkrun" }')
    expect(whyOn('2026-10-29', '2026-10-27').data).toMatchObject({ recalibration: { changed: false } })
  })

  it('trail przy wyniku szosowym (Z-10): wybór się nie zmienia, bez podpowiedzi', () => {
    planWith(`${RESULT}\n    - { date: "2026-10-25", distanceKm: 21.1, timeSec: 7200, terrain: trail }`)
    const why = whyOn('2026-10-29', '2026-10-27')
    expect(why.output).toMatch(/2026-10-25 · 21\.1 km · VDOT [\d.]+ · After the calibration date/)
    expect(why.output).not.toContain('would calibrate')
    expect(why.data).toMatchObject({ recalibration: { changed: false } })
  })

  it('cel trailowy: wynik z trailu, który ustawił strefy, jest „użyty"', () => {
    planWith('    - { date: "2026-09-27", distanceKm: 10, timeSec: 2700 }\n    - { date: "2026-09-20", distanceKm: 21.1, timeSec: 5400, terrain: trail }', '  terrain: trail\n')
    const why = whyOn('2026-10-29', '2026-10-27')
    expect(why.output).toMatch(/2026-09-20 · 21\.1 km · VDOT [\d.]+ · Used for zones/)
    expect(why.output).not.toContain('would calibrate')
  })

  it('przeterminowany wynik szosowy: trail, który ustawił strefy, jest „użyty", szosa „starsza niż 540 dni"', () => {
    planWith('    - { date: "2025-01-10", distanceKm: 10, timeSec: 2580 }\n    - { date: "2026-09-20", distanceKm: 21.1, timeSec: 6000, terrain: trail }')
    const why = whyOn('2026-10-29', '2026-10-27')
    expect(why.output).toMatch(/2026-09-20 · 21\.1 km · VDOT [\d.]+ · Used for zones/)
    expect(why.output).toMatch(/2025-01-10 · 10 km · VDOT [\d.]+ · Older than 540 days on the calibration date/)
    expect(why.output).not.toContain('Trail result')
  })

  it('bez czytelnego trainctl.yaml why działa, bez podpowiedzi', () => {
    writeFileSync(join(dir, 'trainctl.yaml'), 'athlete: [', 'utf-8')
    const why = whyOn('2026-10-29', '2026-10-27')
    expect(why.code).toBe(0)
    expect(why.data).toMatchObject({ recalibration: null })
    expect(why.output).toContain('trainctl.yaml cannot be read')
  })

  it('recalibrationToday: ten sam wynik, inny wynik, brak wyniku, zmiana czasu docelowego', () => {
    const a = { date: '2026-09-27', distanceKm: 10, timeSec: 2580 }
    const b = { date: '2026-10-25', distanceKm: 5, timeSec: 1200 }
    const goal = { kind: 'race', distanceKm: 21.0975 }
    const calibration = { evaluatedAt: '2026-10-22', policy: 'best-vdot-540-days' as const, results: [a], selected: a, candidates: [] }
    const fromResult = { calibration, vdot: Math.round(vdotFromRace(10, 2580) * 10) / 10, vdotSource: 'result' }
    expect(recalibrationToday(fromResult, [a], '2026-10-29', goal)).toEqual({ selected: a, source: 'result', changed: false })
    expect(recalibrationToday(fromResult, [a, b], '2026-10-29', goal)).toMatchObject({ selected: b, changed: true })
    expect(recalibrationToday(fromResult, [{ ...a, excluded: true }], '2026-10-29', goal)).toEqual({ selected: null, source: 'none', changed: true })
    // plan z czasu docelowego: bez wyniku nic się nie zmienia, póki ten sam czas; inny czas albo brak — zmiana
    const { selected: _, ...noResult } = calibration
    const fromGoal = { calibration: noResult, vdot: Math.round(vdotFromRace(21.0975, 5700) * 10) / 10, vdotSource: 'goal-target' }
    expect(recalibrationToday(fromGoal, [], '2026-10-29', { ...goal, targetTimeSec: 5700 })).toMatchObject({ source: 'goal-target', changed: false })
    expect(recalibrationToday(fromGoal, [], '2026-10-29', { ...goal, targetTimeSec: 5400 })).toMatchObject({ source: 'goal-target', changed: true })
    expect(recalibrationToday(fromGoal, [], '2026-10-29', goal)).toMatchObject({ source: 'none', changed: true })
  })
})

describe('liczby wpisywane przez człowieka', () => {
  it('log --km przyjmuje przecinek, jak polskie wyjście', () => {
    process.env['TRAINCTL_TODAY'] = '2026-10-27'
    expect(cmdLog(dir, { date: '2026-10-27', status: 'done', km: '8,5' }).code).toBe(0)
    expect(readLog(dir).at(-1)).toMatchObject({ km: 8.5 })
  })

  it('parseDecimal: zwykły zapis dziesiętny, nic więcej', () => {
    expect(parseDecimal('8,5')).toBe(8.5)
    expect(parseDecimal(' 8.25 ')).toBe(8.25)
    for (const bad of ['0x10', '1e3', '-5', '', 'osiem']) expect(parseDecimal(bad)).toBeNaN()
  })

  it('zapis w log i today pokazują dystans tak, jak go wpisano', () => {
    setLocale('pl')
    process.env['TRAINCTL_TODAY'] = '2026-10-27'
    expect(cmdLog(dir, { date: '2026-10-27', status: 'done', km: '8.25' }).output).toContain('8,25 km')
    expect(cmdToday(dir).output).toContain('8,25 km')
  })

  it('granice dziennika jedne dla log i odczytu log.jsonl', () => {
    expect(LOG_LIMITS.rpe(10)).toBe(true)
    expect(LOG_LIMITS.rpe(11)).toBe(false)
    expect(LOG_LIMITS.minutes(300)).toBe(true)
    expect(LOG_LIMITS.minutes(301)).toBe(false)
    process.env['TRAINCTL_TODAY'] = '2026-10-27'
    expect(cmdLog(dir, { date: '2026-10-27', strength: 'done', minutes: 301 }).code).not.toBe(0)
    expect(cmdLog(dir, { date: '2026-10-27', status: 'done', km: '-5' }).code).not.toBe(0)
  })

  it('log.jsonl: czas „58:30" wpisany ręcznie zostaje odczytany', () => {
    appendFileSync(join(dir, 'log.jsonl'), JSON.stringify({ date: '2026-10-27', status: 'done', timeSec: '58:30', loggedAt: 'x' }) + '\n')
    expect(readLog(dir)[0]).toMatchObject({ timeSec: 3510 })
  })
})

describe('dziennik: jedna reguła liczb i wpisów', () => {
  it('RPE i minuty siły przez ten sam parser co km: przecinek tak, zapis szesnastkowy i wykładniczy nie', () => {
    process.env['TRAINCTL_TODAY'] = '2026-10-27'
    expect(cmdLog(dir, { date: '2026-10-27', status: 'done', rpe: '0xA' }).code).not.toBe(0)
    expect(cmdLog(dir, { date: '2026-10-27', status: 'done', rpe: '7,0' }).code).toBe(0)
    expect(readLog(dir).at(-1)).toMatchObject({ rpe: 7 })
    expect(cmdLog(dir, { date: '2026-10-28', strength: 'done', minutes: '1e2' }).code).not.toBe(0)
    expect(cmdLog(dir, { date: '2026-10-28', strength: 'done', minutes: '45' }).code).toBe(0)
  })

  it('parseDecimal przyjmuje „.5", „5." i „,5"', () => {
    expect(parseDecimal('.5')).toBe(0.5)
    expect(parseDecimal('5.')).toBe(5)
    expect(parseDecimal(',5')).toBe(0.5)
    expect(parseDecimal('.')).toBeNaN()
  })

  it('kreator dziennika podpowiada dystans w formacie języka z pełną dokładnością', () => {
    const race = loadPlan(dir).weeks.flatMap((w) => w.days).find((d) => d.date === '2027-03-28')!
    setLocale('pl')
    expect(plannedKmDefault(race)).toBe('21,0975')
    expect(parseDecimal(plannedKmDefault(race)!)).toBe(21.0975)
    setLocale('en')
    expect(plannedKmDefault(race)).toBe('21.0975')
    const rest = loadPlan(dir).weeks[0]!.days.find((d) => !d.workout)!
    expect(plannedKmDefault(rest)).toBeUndefined()
  })

  it('latestByDate: późniejszy wpis daty wygrywa', () => {
    const map = latestByDate([{ date: 'a', n: 1 }, { date: 'b', n: 2 }, { date: 'a', n: 3 }])
    expect(map.get('a')).toMatchObject({ n: 3 })
    expect(map.size).toBe(2)
  })

  it('lineSeparator: nowa linia tylko po niepustym tekście bez końcowego znaku nowej linii', () => {
    expect(lineSeparator('')).toBe('')
    expect(lineSeparator('{}\n')).toBe('')
    expect(lineSeparator('{}')).toBe('\n')
  })

  it('PLAN.md cytuje historię zmian tak, jak zapisano ją w plan.yaml', () => {
    setLocale('pl')
    const plan = loadPlan(dir)
    plan.changes.push({ at: '2026-10-27', action: 'shorten', detail: '2026-10-27: 8.5 → 6 km; 40 min; shortened' })
    writePlan(dir, plan)
    expect(readFileSync(join(dir, 'plan', 'PLAN.md'), 'utf-8')).toContain('2026-10-27: 8.5 → 6 km; 40 min; shortened')
  })
})

describe('regeneracja zapisuje zmianę wyniku, z którego liczone są strefy', () => {
  it('nowy wynik z tym samym VDOT: podpowiedź w why znika po trainctl plan', () => {
    const r1 = '    - { date: "2026-09-27", distanceKm: 10, timeSec: 2580 }'
    writeFileSync(join(dir, 'trainctl.yaml'), CONFIG.replace(r1, `${r1}\n    - { date: "2026-10-10", distanceKm: 10, timeSec: 2580 }`), 'utf-8')
    setLocale('en')
    process.env['TRAINCTL_TODAY'] = '2026-10-29'
    expect(cmdWhy(dir, { date: '2026-10-27' }).output).toContain('would calibrate the zones from the 2026-10-10 result')
    expect(cmdPlan(dir).data).toMatchObject({ regeneration: { upToDate: false } })
    const why = cmdWhy(dir, { date: '2026-10-27' })
    expect(why.output).not.toContain('would calibrate')
    expect(why.data).toMatchObject({ recalibration: { changed: false } })
    // ten sam profil drugi raz: nic do zapisania
    expect(cmdPlan(dir).data).toMatchObject({ regeneration: { upToDate: true } })
  })

  it('echo zapisu pokazuje dystans z podpowiedzi kreatora bez zaokrąglenia', () => {
    setLocale('pl')
    process.env['TRAINCTL_TODAY'] = '2026-10-27'
    expect(cmdLog(dir, { date: '2026-10-27', status: 'modified', km: '21,0975' }).output).toContain('21,0975 km')
  })

  it('adres w nawiasie zostaje w całości', () => {
    const url = 'https://github.com/dithiothreitol/trainctl/blob/v0.6.0/docs/science/FOUNDATIONS.md'
    expect(wrapText(`pliki aktywności (${url})`, 40).some((line) => line.trim() === `(${url})`)).toBe(true)
  })
})

describe('regeneracja i teren wyniku (Z-10)', () => {
  it('zmiana terenu jedynego wyniku zapisuje plan i zdejmuje ostrzeżenie o kalibracji z trailu', () => {
    const road = '    - { date: "2026-09-27", distanceKm: 10, timeSec: 2580 }'
    writeFileSync(join(dir, 'trainctl.yaml'), CONFIG.replace(road, '    - { date: "2026-09-27", distanceKm: 10, timeSec: 2580, terrain: trail }'), 'utf-8')
    setLocale('en')
    cmdPlan(dir, { fresh: true })
    expect(loadPlan(dir).feasibilityWarnings.join(' ')).toContain('trail result')
    writeFileSync(join(dir, 'trainctl.yaml'), CONFIG, 'utf-8')
    expect(cmdPlan(dir).data).toMatchObject({ regeneration: { upToDate: false } })
    expect(loadPlan(dir).feasibilityWarnings.join(' ')).not.toContain('trail result')
  })
})

describe('piętnasta runda: zawijanie, komunikat bez wyniku, teren w podpowiedzi', () => {
  it('wrap domyślnie trzyma szerokość także dla adresu; wrapText zostawia go w całości', () => {
    const url = 'https://github.com/dithiothreitol/trainctl/blob/v0.6.0/docs/science/FOUNDATIONS.md'
    expect(wrap(url, 30).every((line) => line.length <= 30)).toBe(true)
    expect(wrapText(url, 30)).toEqual([url])
  })

  it('bez wyniku z czasem docelowym: podpowiedź mówi o kalibracji z czasu docelowego', () => {
    writeFileSync(join(dir, 'trainctl.yaml'), CONFIG.replace('  priority: A\n', '  priority: A\n  targetTimeSec: 5700\n'), 'utf-8')
    cmdPlan(dir, { fresh: true })
    writeFileSync(join(dir, 'trainctl.yaml'), CONFIG.replace(/  results:\n.*\n/, '  results: []\n').replace('  priority: A\n', '  priority: A\n  targetTimeSec: 5700\n'), 'utf-8')
    setLocale('en')
    process.env['TRAINCTL_TODAY'] = '2026-10-29'
    expect(cmdWhy(dir, { date: '2026-10-27' }).output).toContain('would calibrate the zones from the goal time 1:35:00')
  })

  it('zmiana terenu wybranego wyniku: why podpowiada trainctl plan, jak regeneracja', () => {
    const road = '    - { date: "2026-09-27", distanceKm: 10, timeSec: 2580 }'
    writeFileSync(join(dir, 'trainctl.yaml'), CONFIG.replace(road, '    - { date: "2026-09-27", distanceKm: 10, timeSec: 2580, terrain: trail }'), 'utf-8')
    setLocale('en')
    process.env['TRAINCTL_TODAY'] = '2026-10-29'
    expect(cmdWhy(dir, { date: '2026-10-27' }).data).toMatchObject({ recalibration: { changed: true } })
    expect(cmdPlan(dir).data).toMatchObject({ regeneration: { upToDate: false } })
    expect(cmdWhy(dir, { date: '2026-10-27' }).data).toMatchObject({ recalibration: { changed: false } })
  })
})

describe('szesnasta runda: źródło stref, siła „zmieniona", kreator init', () => {
  it('zoneSource: wynik, czas docelowy przy celu ze startem, inaczej brak', () => {
    const r = { date: '2026-09-27', distanceKm: 10, timeSec: 2580 }
    expect(zoneSource(r, { kind: 'race' })).toBe('result')
    expect(zoneSource(undefined, { kind: 'race', targetTimeSec: 5700 })).toBe('goal-target')
    expect(zoneSource(undefined, { kind: 'base', targetTimeSec: 5700 })).toBe('none')
    expect(zoneSource(undefined, { kind: 'race' })).toBe('none')
  })

  it('siła „zmieniona" po polsku słowem z katalogu', () => {
    setLocale('pl')
    expect(logStatusText('modified', true)).toBe('zmieniona')
    setLocale('en')
    expect(logStatusText('modified', true)).toBe('modified')
  })

  it('kreator init czyta dystans tym samym parserem: przecinek tak, „0x10" nie', () => {
    expect(parseDistanceInput('21,1')).toBe(21.1)
    expect(() => parseDistanceInput('0x10')).toThrow()
    expect(() => parseDistanceInput('1e2')).toThrow()
  })
})

describe('siedemnasta runda: dni do startu, zbiór wyników, granice dziennika', () => {
  it('today po angielsku: „1 day to race"', () => {
    setLocale('en')
    process.env['TRAINCTL_TODAY'] = '2027-03-27'
    expect(cmdToday(dir).output).toContain('1 day to race')
  })

  it('nowy, słabszy wynik w trainctl.yaml: plan zapisany, why pokazuje go na liście', () => {
    const r1 = '    - { date: "2026-09-27", distanceKm: 10, timeSec: 2580 }'
    writeFileSync(join(dir, 'trainctl.yaml'), CONFIG.replace(r1, `${r1}\n    - { date: "2026-10-15", distanceKm: 5, timeSec: 1500 }`), 'utf-8')
    setLocale('en')
    process.env['TRAINCTL_TODAY'] = '2026-10-29'
    expect(cmdPlan(dir).data).toMatchObject({ regeneration: { upToDate: false } })
    expect(cmdWhy(dir, { date: '2026-10-29' }).output).toMatch(/2026-10-15 · 5 km · VDOT [\d.]+ · Lower VDOT/)
    expect(cmdPlan(dir).data).toMatchObject({ regeneration: { upToDate: true } })
  })

  it('log: dystans ponad 500 km odrzucony, zapis z dokładnością 0,1 m', () => {
    setLocale('en')
    process.env['TRAINCTL_TODAY'] = '2026-10-27'
    expect(cmdLog(dir, { date: '2026-10-27', status: 'done', km: '8500' }).code).not.toBe(0)
    const saved = cmdLog(dir, { date: '2026-10-27', status: 'done', km: '8.123456' })
    expect(readLog(dir).at(-1)).toMatchObject({ km: 8.1235 })
    expect(saved.output).toContain('8.1235 km')
  })
})

describe('osiemnasta runda: kreator, pominięte wartości dziennika', () => {
  it('kreator przekazuje tekst, który przyjął (bez zapisu wykładniczego)', () => {
    expect(parseKmText('0.0000001')).toBe('0.0000001')
    expect(parseKmText(' 8,5 ')).toBe('8,5')
    expect(parseRpeText('7')).toBe('7')
    process.env['TRAINCTL_TODAY'] = '2026-10-27'
    // tak mała wartość znikłaby przy zapisie z dokładnością 0,1 m — błąd z własnym komunikatem, nie cichy zapis 0 km
    setLocale('en')
    const tiny = cmdLog(dir, { date: '2026-10-27', status: 'done', km: parseKmText('0.0000001') })
    expect(tiny.code).not.toBe(0)
    expect(tiny.output).toContain('below 0.1 m cannot be recorded')
  })

  it('status mówi o wartościach dziennika pominiętych przy odczycie', () => {
    setLocale('en')
    process.env['TRAINCTL_TODAY'] = '2026-10-27'
    appendFileSync(join(dir, 'log.jsonl'), JSON.stringify({ date: '2026-10-27', status: 'done', km: '8500', loggedAt: 'x' }) + '\n')
    const out = cmdStatus(dir).output
    expect(out).toContain('values outside the limits of trainctl log were ignored (2026-10-27 km)')
  })
})

describe('dziewiętnasta runda: VDOT stref z jednej funkcji', () => {
  it('zoneCalibration: wynik, czas docelowy, brak; roundVdot jak w planie', () => {
    const r = { date: '2026-09-27', distanceKm: 10, timeSec: 2580 }
    expect(zoneCalibration(r, { kind: 'race', distanceKm: 21.0975 })).toEqual({ source: 'result', vdot: vdotFromRace(10, 2580) })
    expect(zoneCalibration(undefined, { kind: 'race', distanceKm: 21.0975, targetTimeSec: 5700 })).toEqual({ source: 'goal-target', vdot: vdotFromRace(21.0975, 5700) })
    expect(zoneCalibration(undefined, { kind: 'race', distanceKm: 21.0975 })).toEqual({ source: 'none' })
    expect(roundVdot(47.66)).toBe(47.7)
    expect(loadPlan(dir).vdot).toBe(roundVdot(vdotFromRace(10, 2580)))
  })
})

describe('dwudziesta runda: wybór, uszkodzone wiersze dziennika, przecinek', () => {
  it('lista wyboru trzyma szerokość terminala także z adresem we wskazówce', () => {
    const theme = new Theme({ color: false, unicode: true, width: 40 })
    const url = 'https://github.com/dithiothreitol/trainctl/blob/v0.6.0/docs/science/FOUNDATIONS.md'
    const lines = renderChoices([{ label: 'jeden', value: 1, hint: `źródło ${url} i długa wskazówka, która nie mieści się w jednym wierszu` }], 0, theme)
    for (const line of lines) expect(visibleLength(line)).toBeLessThanOrEqual(40)
  })

  it('log.jsonl: wiersz, który nie jest obiektem JSON, pominięty i zgłoszony, reszta działa', () => {
    setLocale('en')
    process.env['TRAINCTL_TODAY'] = '2026-10-27'
    appendFileSync(join(dir, 'log.jsonl'), [
      JSON.stringify({ date: '2026-10-26', status: 'done', loggedAt: 'x' }),
      '{"date": "2026-10-27", "status": "done",',
      '"abc"',
      JSON.stringify({ date: '2026-10-27', status: 'done', km: 8, loggedAt: 'y' }),
    ].join('\n') + '\n')
    expect(readLog(dir).map((e) => e.date)).toEqual(['2026-10-26', '2026-10-27'])
    expect(cmdToday(dir).code).toBe(0)
    expect(cmdStatus(dir).output).toContain('line 2, line 3')
  })

  it('parseDecimal bez przecinka: „1,500" to nie 1,5', () => {
    expect(parseDecimal('1,500', false)).toBeNaN()
    expect(parseDecimal('1.5', false)).toBe(1.5)
    expect(parseDecimal('1,5')).toBe(1.5)
  })
})

describe('dwudziesta pierwsza runda: ochrona dni przy uszkodzonym dzienniku, dokładna dawka', () => {
  it('uszkodzony wiersz log.jsonl: widoki działają, zmiana planu czeka na poprawkę pliku', () => {
    setLocale('en')
    process.env['TRAINCTL_TODAY'] = '2026-10-27'
    cmdLog(dir, { date: '2026-10-27', status: 'done', km: '8' })
    const before = readFileSync(join(dir, 'plan', 'plan.yaml'), 'utf-8')
    appendFileSync(join(dir, 'log.jsonl'), '{"date": "2026-10-28", "status": "done",\n')
    expect(cmdToday(dir).code).toBe(0)
    writeFileSync(join(dir, 'trainctl.yaml'), CONFIG.replace('recentWeeklyKm: 45', 'recentWeeklyKm: 50'), 'utf-8')
    const plan = cmdPlan(dir)
    expect(plan.code).not.toBe(0)
    expect(plan.output).toContain('cannot read line 2')
    expect(readFileSync(join(dir, 'plan', 'plan.yaml'), 'utf-8')).toBe(before)
  })

  it('dawka w why z dokładnością do 0,01 km', () => {
    expect(coachEn.segment('strides', 1.25, '')).toContain('1.25 km')
    expect(coachPl.segment('przebieżki', 1.25, '')).toContain('1,25 km')
    expect(coachEn.adjusted('easy', 10.25, 40)).toContain('10.25 km')
  })
})

describe('dwudziesta druga runda: shift i reschedule przy uszkodzonym dzienniku', () => {
  const breakLog = () => {
    setLocale('en')
    process.env['TRAINCTL_TODAY'] = '2026-10-27'
    cmdLog(dir, { date: '2026-10-27', status: 'done', km: '8' })
    appendFileSync(join(dir, 'log.jsonl'), '{"date": "2026-10-27", "status": "done", "km": 8\n')
    return readFileSync(join(dir, 'plan', 'plan.yaml'), 'utf-8')
  }

  it('shift czeka na poprawkę dziennika', () => {
    const before = breakLog()
    const r = cmdShift(dir, { from: '2026-10-27', to: '2026-10-28' })
    expect(r.code).not.toBe(0)
    expect(r.output).toContain('cannot read line 2')
    expect(readFileSync(join(dir, 'plan', 'plan.yaml'), 'utf-8')).toBe(before)
  })

  it('reschedule czeka na poprawkę dziennika', () => {
    const before = breakLog()
    const r = cmdReschedule(dir, { block: ['2026-10-29'], date: '2026-10-27', apply: true })
    expect(r.code).not.toBe(0)
    expect(r.output).toContain('cannot read line 2')
    expect(readFileSync(join(dir, 'plan', 'plan.yaml'), 'utf-8')).toBe(before)
  })

  it('status nazywa uszkodzony wiersz komunikatem o zmianie planu', () => {
    breakLog()
    expect(cmdStatus(dir).output).toContain('Fix the file before changing the plan')
  })

  it('opuszczona sesja z czasem: komunikat o opuszczonej sesji, nie o zapisie czasu', () => {
    setLocale('en')
    process.env['TRAINCTL_TODAY'] = '2026-10-27'
    expect(cmdLog(dir, { date: '2026-10-27', status: 'skipped', time: '5km' }).output).toContain('A skipped session cannot have a distance or duration.')
  })

  it('workoutKm: start z jednym miejscem, sesja do dwóch', () => {
    setLocale('en')
    expect(workoutKm({ distanceKm: 0, raceDistanceKm: 42.195 })).toBe('42.2 km')
    expect(workoutKm({ distanceKm: 10.25 })).toBe('10.25 km')
  })
})

describe('dwudziesta trzecia runda: adapt i review przy uszkodzonym dzienniku, klasa dystansu', () => {
  const breakLog = () => {
    setLocale('en')
    process.env['TRAINCTL_TODAY'] = '2026-10-29'
    cmdLog(dir, { date: '2026-10-27', status: 'done', km: '8' })
    appendFileSync(join(dir, 'log.jsonl'), '{"date": "2026-10-28", "status": "done",\n')
  }

  it('adapt nie stawia diagnozy z niepełnego dziennika', () => {
    breakLog()
    const r = cmdAdapt(dir, {})
    expect(r.code).not.toBe(0)
    expect(r.output).toContain('cannot read line 2')
  })

  it('review ostrzega, że dziennik jest niepełny', async () => {
    breakLog()
    const r = await cmdReview(dir, {})
    expect(r.code).toBe(0)
    expect(r.output).toContain('cannot read line 2')
  })

  it('distanceClass: te same granice co goalClass', () => {
    expect(distanceClass(42.195)).toBe('marathon')
    expect(distanceClass(50)).toBe('ultra')
    expect(distanceClass(21.0975)).toBe('half')
    expect(distanceClass(10)).toBe('short')
    expect(goalClass({ kind: 'base', distanceKm: 0 })).toBe('base')
  })
})

describe('dwudziesta czwarta runda: jedna dokładność dystansu', () => {
  it('kmLabel: do dwóch miejsc w każdym widoku, start bez artefaktu zapisu binarnego', () => {
    setLocale('en')
    expect(kmLabel(42.195)).toBe('42.2 km')
    expect(kmLabel(21.0975)).toBe('21.1 km')
    expect(kmLabel(10.25)).toBe('10.25 km')
    expect(kmLabel(8.123)).toBe('8.12 km')
    expect(kmLabel(1.005)).toBe('1.01 km')
    expect(kmLabel(21.0975, 4)).toBe('21.0975 km')
    setLocale('pl')
    expect(kmLabel(10.25)).toBe('10,25 km')
  })

  it('today: „następny" ma tę samą dokładność co panel dnia', () => {
    setLocale('en')
    process.env['TRAINCTL_TODAY'] = '2027-03-26'
    expect(cmdToday(dir).output).toMatch(/next: .* · 21\.1 km/)
  })
})
