/**
 * PLAN-v0.7 C10: `notation: club` w profilu — kody planów klubowych w widokach po
 * polsku i legenda pod widokiem; po angielsku notacja neutralna; dane (`--json`,
 * `structuredContent`), `plan.yaml` i eksport do huba bez zmian.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { setLocale, setNotation } from 'trainctl-core'
import { cmdMigrate, cmdPlan, cmdSeason, cmdToday, cmdWeek, type CmdResult } from './commands.ts'
import { configTemplate, loadConfig, readConfigNotation } from './config.ts'
import { loadPlan } from './planfile.ts'
import { workoutsToPush } from './sync.ts'

const PROFILE = (extra = '') => `${extra}athlete:
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

/**
 * Kod klubowy w rozpisce stoi przed dawką (`WT 4×1 km`, `OWB1 8,5 km`). Samo „WT” i „SB”
 * to też polskie skróty wtorku i soboty (także z datą: `WT 27.10`), więc szukamy kodu
 * z dawką: liczba, a po niej `×` albo jednostka.
 */
const CODES = /\b(OWB1|BC2|BC3|BNP|BZ|WT|RT|SB) \d+(?:[,.]\d+)?(?:×| km| m| mi)/

let dir: string
const today = process.env['TRAINCTL_TODAY']
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'trainctl-club-'))
  process.env['TRAINCTL_TODAY'] = '2026-10-22'
  setLocale('pl')
  setNotation('neutral')
})
afterEach(() => {
  setNotation('neutral')
  setLocale('en')
  rmSync(dir, { recursive: true, force: true, maxRetries: 3 })
  if (today === undefined) delete process.env['TRAINCTL_TODAY']
  else process.env['TRAINCTL_TODAY'] = today
})

/** Jak bin.ts: zapis notacji z profilu na starcie procesu. */
const start = (extra: string) => {
  writeFileSync(join(dir, 'trainctl.yaml'), PROFILE(extra), 'utf-8')
  setNotation(readConfigNotation(dir) ?? 'neutral')
  expect(cmdPlan(dir).code).toBe(0)
}
const views = (): Record<string, () => CmdResult> => ({
  week: () => cmdWeek(dir, { date: '2026-10-29' }),
  today: () => cmdToday(dir, { date: '2026-10-27' }),
  season: () => cmdSeason(dir, { date: '2026-10-29' }),
})

describe('C10: notacja klubowa', () => {
  it('profil `notation: club`: kody w tygodniu, w siatce sezonu i w PLAN.md, legenda pod widokiem', () => {
    start('language: pl\nnotation: club\n')
    expect(loadConfig(dir).notation).toBe('club')
    const week = cmdWeek(dir, { date: '2026-10-29' }).output
    expect(week).toMatch(/OWB1 \d/)
    expect(week).toContain('OWB1 bieg spokojny · BC2 drugi zakres')
    expect(cmdSeason(dir, { date: '2026-10-29' }).output).toMatch(CODES)
    const planMd = readFileSync(join(dir, 'plan', 'PLAN.md'), 'utf-8')
    expect(planMd).toMatch(/OWB1 \d/)
    expect(planMd).toContain('> OWB1 bieg spokojny')
  })

  it('bez ustawienia: notacja neutralna, bez kodów i bez legendy klubowej', () => {
    start('language: pl\n')
    for (const [name, view] of Object.entries(views())) {
      const out = view().output
      expect(out, name).not.toMatch(CODES)
      expect(out, name).not.toContain('OWB1')
    }
    expect(readFileSync(join(dir, 'plan', 'PLAN.md'), 'utf-8')).not.toMatch(CODES)
  })

  it('po angielsku `club` daje notację neutralną', () => {
    start('notation: club\n')
    setLocale('en')
    for (const [name, view] of Object.entries(views())) expect(view().output, name).not.toMatch(CODES)
  })

  it('dane widoków, plan.yaml i treningi do huba są takie same przy obu zapisach', () => {
    start('language: pl\n')
    const neutral = Object.fromEntries(Object.entries(views()).map(([name, view]) => [name, view().data]))
    const yaml = readFileSync(join(dir, 'plan', 'plan.yaml'), 'utf-8')
    const plan = loadPlan(dir)
    const pushed = workoutsToPush(plan, '2026-10-26', '2026-11-01')
    setNotation('club')
    for (const [name, view] of Object.entries(views())) expect(view().data, name).toEqual(neutral[name])
    expect(JSON.stringify(neutral)).not.toMatch(CODES)
    expect(cmdPlan(dir).code).toBe(0)
    expect(readFileSync(join(dir, 'plan', 'plan.yaml'), 'utf-8')).toBe(yaml)
    expect(workoutsToPush(loadPlan(dir), '2026-10-26', '2026-11-01')).toEqual(pushed)
  })

  it('nieznana wartość to błąd profilu z podpowiedzią; szablon opisuje opcję', () => {
    writeFileSync(join(dir, 'trainctl.yaml'), PROFILE('notation: klub\n'), 'utf-8')
    expect(readConfigNotation(dir)).toBeUndefined()
    const r = cmdPlan(dir)
    expect(r.code).toBe(1)
    expect(r.output).toContain('notation: neutral albo club')
    expect(configTemplate()).toContain('# notation: neutral')
  })
})

describe('C9, C10: migracja do v2 (runda 2 przeglądu etapu 3)', () => {
  it('nowy profil v2 zachowuje jednostkę i zapis notacji', () => {
    writeFileSync(join(dir, 'trainctl.yaml'), PROFILE('language: pl\nunits: imperial\nnotation: club\n'), 'utf-8')
    expect(cmdPlan(dir).code).toBe(0)
    const prepared = cmdMigrate(dir)
    expect(prepared.code, prepared.output).toBe(0)
    const applied = cmdMigrate(dir, { apply: (prepared.data!['proposal'] as { id: string }).id })
    expect(applied.code, applied.output).toBe(0)
    expect(parse(readFileSync(join(dir, 'trainctl.yaml'), 'utf-8'))).toMatchObject({ schemaVersion: 2, units: 'imperial', notation: 'club' })
    expect(readConfigNotation(dir)).toBe('club')
  })
})
