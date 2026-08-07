/**
 * Strażnik przecieków językowych.
 *
 * Katalogi mogą być kompletne, a mimo to w kodzie zostanie hardkodowane zdanie —
 * i wyjdzie dopiero u użytkownika, wymieszane z tłumaczeniem. Ten test URUCHAMIA
 * wszystkie komendy po angielsku i szuka polskich śladów w tym, co zobaczyłby
 * człowiek: w wyjściu terminala, w PLAN.md, w plikach eksportu i w opisach MCP.
 *
 * Sygnał jest dwojaki, bo sam diakrytyk nie wystarcza: „Predykcja wyniku" nie ma
 * ani jednego polskiego znaku.
 */
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { setLocale } from '@trainctl/core'
import {
  cmdAdapt,
  cmdCheck,
  cmdDesk,
  cmdDiff,
  cmdExport,
  cmdInit,
  cmdLog,
  cmdPlan,
  cmdReschedule,
  cmdShift,
  cmdToday,
  cmdWeek,
  cmdWhy,
} from '../commands.ts'
import { agentsTemplate } from '../agents-md.ts'
import { configTemplate } from '../config.ts'
import { cliEn } from './cli-en.ts'

// Cały plik pracuje po angielsku — to jest właśnie badany scenariusz.
setLocale('en')

const POLISH_CHARS = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/

/**
 * Słowa, które w angielskim tekście nie mają prawa wystąpić. Krótkie spójniki
 * („i", „w", „z") celowo pominięte — dają fałszywe trafienia w skrótach.
 */
const POLISH_WORDS = new RegExp(
  '\\b(' +
    [
      'tydzien', 'tygodni', 'tygodnie', 'tygodniu', 'dzien', 'dni', 'dnia',
      'trening', 'treningu', 'treningi', 'treningow', 'plan[ua]', 'planie',
      'predykcja', 'struktura', 'zapisano', 'utworzono', 'zalogowano', 'brak',
      'nieznany', 'nieznana', 'podaj', 'uzyj', 'uruchom', 'dopisz', 'przesun',
      'wybierz', 'anulowano', 'przerwano', 'wolne', 'metoda', 'wynik', 'wyniku',
      'objetosc', 'szczyt', 'baza', 'budowanie', 'sila', 'silowa', 'spokojne',
      'interwaly', 'podbiegi', 'sprawdzian', 'rozgrzewka', 'trucht', 'przerwa',
      'blad', 'bledy', 'reguly', 'jednostka', 'jednostki', 'odciazenie',
    ].join('|') +
    ')\\b',
  'i',
)

function expectEnglish(where: string, text: string): void {
  const chars = text.match(POLISH_CHARS)
  if (chars) {
    const at = text.indexOf(chars[0])
    expect.fail(`${where}: polski znak „${chars[0]}" w …${text.slice(Math.max(0, at - 60), at + 40)}…`)
  }
  const word = text.match(POLISH_WORDS)
  if (word) {
    const at = text.indexOf(word[0])
    expect.fail(`${where}: polskie słowo „${word[0]}" w …${text.slice(Math.max(0, at - 60), at + 40)}…`)
  }
}

// Profil celowo bez polskich nazw własnych — inaczej testowalibyśmy dane, nie interfejs.
const CONFIG = `athlete:
  recentWeeklyKm: 50
  peakWeeklyKm: 62
  daysAvailable: [mon, tue, wed, thu, sat, sun]
  longRunDay: sat
  results:
    - { date: "2026-03-29", distanceKm: 10, timeSec: 2580, name: "Spring 10K" }
goal:
  name: "Autumn Half"
  date: "2026-11-29"
  distanceKm: 21.0975
  targetTimeSec: 5700
  priority: A
desk:
  workStart: "09:00"
  workEnd: "17:00"
  lunchMinutes: 45
  prefer: evening
strength:
  enabled: true
`

const TODAY = '2026-08-06'
let dir: string

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'trainctl-leak-'))
  writeFileSync(join(dir, 'trainctl.yaml'), CONFIG, 'utf-8')
  cmdPlan(dir, { date: TODAY })
})
afterAll(() => rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }))

describe('komendy po angielsku nie przeciekają polskim', () => {
  const cases: [string, () => { output: string }][] = [
    ['plan', () => cmdPlan(dir, { date: TODAY })],
    ['today', () => cmdToday(dir, { date: TODAY })],
    ['today (dzień wolny)', () => cmdToday(dir, { date: '2026-08-07' })],
    ['week', () => cmdWeek(dir, { date: TODAY })],
    ['why', () => cmdWhy(dir, { date: TODAY })],
    ['why (dzień wolny)', () => cmdWhy(dir, { date: '2026-08-07' })],
    ['log', () => cmdLog(dir, { date: TODAY, km: '9', note: 'felt good' })],
    ['log (zły status)', () => cmdLog(dir, { date: TODAY, status: 'nonsense' })],
    ['log (poza planem)', () => cmdLog(dir, { date: '2030-01-01' })],
    ['adapt', () => cmdAdapt(dir, { date: TODAY })],
    ['desk', () => cmdDesk(dir, { date: TODAY })],
    ['desk (ciężki dzień)', () => cmdDesk(dir, { date: TODAY, heavy: true })],
    ['diff', () => cmdDiff(dir)],
    ['check', () => cmdCheck(dir)],
    ['check (po przesunięciu — ostrzeżenia)', () => {
      // przesunięcie łamiące I-7 → wyjście z ostrzeżeniami też musi być angielskie
      cmdShift(dir, { from: '2026-08-09', to: '2026-08-05' })
      const r = cmdCheck(dir, { strict: true })
      cmdShift(dir, { from: '2026-08-05', to: '2026-08-09' })
      return r
    }],
    ['reschedule', () => cmdReschedule(dir, { date: TODAY, block: ['2026-08-06'] })],
    ['shift', () => cmdShift(dir, { from: '2026-08-06', to: '2026-08-07' })],
    ['shift (błąd)', () => cmdShift(dir, { from: '2030-01-01', to: '2030-01-02' })],
    ['init (istnieje)', () => cmdInit(dir)],
    ['export print', () => cmdExport(dir, { what: 'print' })],
    ['export race', () => cmdExport(dir, { what: 'race' })],
    ['export calendar', () => cmdExport(dir, { what: 'calendar' })],
    ['export workout', () => cmdExport(dir, { what: 'workout', date: TODAY })],
    ['export (zły rodzaj)', () => cmdExport(dir, { what: 'nonsense' as any })],
  ]

  for (const [name, run] of cases) {
    it(name, () => expectEnglish(`trainctl ${name}`, run().output))
  }
})

describe('pliki dla człowieka nie przeciekają polskim', () => {
  it('plan/PLAN.md', () => {
    expectEnglish('PLAN.md', readFileSync(join(dir, 'plan', 'PLAN.md'), 'utf-8'))
  })

  it('trainctl.yaml z szablonu', () => {
    expectEnglish('trainctl.yaml', configTemplate())
  })

  it('AGENTS.md — instrukcja, którą czyta agent w katalogu treningowym', () => {
    expectEnglish('AGENTS.md', agentsTemplate())
  })

  it('rozpiska, pakiet startowy i kalendarz', () => {
    cmdExport(dir, { what: 'print' })
    cmdExport(dir, { what: 'race' })
    cmdExport(dir, { what: 'calendar' })
    const out = join(dir, 'export')
    for (const file of readdirSync(out).filter((f) => /\.(html|ics)$/.test(f))) {
      expectEnglish(`export/${file}`, readFileSync(join(out, file), 'utf-8'))
      expectEnglish(`nazwa pliku ${file}`, file)
    }
  })
})

describe('interfejs agenta nie przecieka polskim', () => {
  it('opisy narzędzi MCP', () => {
    for (const [key, value] of Object.entries(cliEn.mcp)) {
      if (typeof value === 'string') expectEnglish(`mcp.${key}`, value)
    }
  })

  it('cały katalog angielski', () => {
    const walk = (obj: object, prefix = ''): void => {
      for (const [k, v] of Object.entries(obj)) {
        const path = prefix ? `${prefix}.${k}` : k
        if (typeof v === 'string') expectEnglish(path, v)
        else if (Array.isArray(v)) v.forEach((x, i) => expectEnglish(`${path}[${i}]`, String(x)))
        else if (v !== null && typeof v === 'object') walk(v as object, path)
      }
    }
    walk(cliEn)
    expectEnglish('agentsMd', cliEn.agentsMd())
  })
})
