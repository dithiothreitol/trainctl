/**
 * PLAN-v0.7 C9: mile i tempo na milę wyłącznie w warstwie widoku. `units: imperial`
 * w profilu albo `--units` zmienia tekst `week`, `today`, `season`, PLAN.md i wydruku;
 * `plan.yaml`, `log.jsonl` i dane (`--json`, `structuredContent`) zostają w kilometrach.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { setLocale, setUnits, withUnits, type Units } from 'trainctl-core'
import { cmdExport, cmdLog, cmdPlan, cmdSeason, cmdToday, cmdWeek, type CmdResult } from './commands.ts'
import { loadConfig, readConfigUnits } from './config.ts'
import { readLog } from './logfile.ts'
import { renderAnsi, type Block } from './ui/blocks.ts'
import { Theme } from './ui/theme.ts'
import { parseUnitsInput, toYaml } from './ui/wizard.ts'

const PROFILE = (units = '') => `${units}athlete:
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
  dir = mkdtempSync(join(tmpdir(), 'trainctl-units-'))
  process.env['TRAINCTL_TODAY'] = '2026-10-22'
  writeFileSync(join(dir, 'trainctl.yaml'), PROFILE(), 'utf-8')
  setUnits('metric')
  expect(cmdPlan(dir).code).toBe(0)
  process.env['TRAINCTL_TODAY'] = '2026-10-29'
})
afterEach(() => {
  setUnits('metric')
  rmSync(dir, { recursive: true, force: true, maxRetries: 3 })
  if (today === undefined) delete process.env['TRAINCTL_TODAY']
  else process.env['TRAINCTL_TODAY'] = today
})

const views = (): Record<string, () => CmdResult> => ({
  week: () => cmdWeek(dir, { date: '2026-10-29' }),
  today: () => cmdToday(dir, { date: '2026-10-27' }),
  season: () => cmdSeason(dir, { date: '2026-10-29' }),
})
const render = (r: CmdResult) => renderAnsi((r as CmdResult & { blocks?: Block[] }).blocks ?? [], new Theme({ color: false, unicode: true, width: 80 }))

describe('C9: widoki w milach', () => {
  for (const lang of ['pl', 'en'] as const) {
    for (const [name, view] of Object.entries(views())) {
      it(`${lang} · ${name}: mile i tempo na milę, bez „km" w tekście`, () => {
        setLocale(lang)
        const r = withUnits('imperial', view)
        expect(r.code, r.output).toBe(0)
        const text = render(r)
        expect(text).not.toMatch(/\bkm\b/)
        expect(r.output).not.toMatch(/\bkm\b/)
        expect(text).toMatch(/\bmi\b/)
        expect(text).toMatchSnapshot()
      })
    }
  }

  it('--json bez zmian: dane week, today i season te same w km przy obu jednostkach', () => {
    setLocale('pl')
    for (const [name, view] of Object.entries(views())) {
      const metric = JSON.stringify(withUnits('metric', view).data)
      const imperial = JSON.stringify(withUnits('imperial', view).data)
      expect(imperial, name).toBe(metric)
      expect(metric, name).toContain('km')
    }
  })

  it('PLAN.md w milach z profilu (units: imperial), plan.yaml w km', () => {
    setLocale('pl')
    writeFileSync(join(dir, 'trainctl.yaml'), PROFILE('units: imperial\n'), 'utf-8')
    expect(loadConfig(dir).units).toBe('imperial')
    expect(readConfigUnits(dir)).toBe('imperial')
    const before = readFileSync(join(dir, 'plan', 'plan.yaml'), 'utf-8')
    withUnits('imperial', () => cmdPlan(dir))
    const md = readFileSync(join(dir, 'plan', 'PLAN.md'), 'utf-8')
    expect(md).toContain('| tydz | od | faza | mi | akcenty | długie |')
    expect(md).toContain('tempo w min/mi')
    expect(md).toMatch(/Predykcja na 13,1 mi/)
    expect(readFileSync(join(dir, 'plan', 'plan.yaml'), 'utf-8')).toBe(before)
  })

  it('PLAN.md idzie za profilem, nie za flagą jednego wywołania (runda 1 przeglądu etapu 3)', () => {
    setLocale('pl')
    const md = () => readFileSync(join(dir, 'plan', 'PLAN.md'), 'utf-8')
    expect(cmdPlan(dir).code).toBe(0) // PLAN.md po polsku, w km z profilu
    const metric = md()
    // profil metryczny, podgląd z --units imperial: plan aktualny, PLAN.md bez zmian
    const peek = withUnits('imperial', () => cmdPlan(dir))
    expect(peek.code, peek.output).toBe(0)
    expect(md()).toBe(metric)
    expect(peek.output).not.toContain('PLAN.md')
    // zapis planu pod tą samą flagą (plan od nowa) też zostawia PLAN.md w km z profilu
    expect(withUnits('imperial', () => cmdPlan(dir, { fresh: true })).code).toBe(0)
    expect(md()).not.toContain('min/mi')
    expect(md()).toContain('tempo w min/km')
    // profil w milach: PLAN.md w milach także wtedy, gdy wywołanie idzie w km
    writeFileSync(join(dir, 'trainctl.yaml'), PROFILE('units: imperial\n'), 'utf-8')
    withUnits('metric', () => cmdPlan(dir))
    expect(md()).toContain('tempo w min/mi')
  })
})

describe('C9: wydruk w milach (runda 1 przeglądu etapu 3)', () => {
  it('nagłówek wydruku podaje szczyt w milach, jak kolumny i tygodnie', () => {
    setLocale('pl')
    const r = withUnits('imperial', () => cmdExport(dir, { what: 'print' }))
    expect(r.code, r.output).toBe(0)
    const html = readFileSync(join(dir, 'export', 'half-rozpiska.html'), 'utf-8')
    expect(html).toMatch(/szczyt \d+(,\d+)? mi\/tydz\./)
    expect(html).not.toMatch(/szczyt \d+(,\d+)? km/)
  })
})

describe('C9: wpis w milach zapisuje kilometry', () => {
  it('log --km w jednostce profilu; dziennik w km, echo w milach', () => {
    setLocale('pl')
    const r = withUnits('imperial', () => cmdLog(dir, { date: '2026-10-27', status: 'done', km: '5' }))
    expect(r.code, r.output).toBe(0)
    expect(readLog(dir).at(-1)!.km).toBe(8.0467)
    expect(r.output).toContain('5 mi')
    expect(withUnits('imperial', () => cmdLog(dir, { date: '2026-10-27', status: 'done', km: '400' })).code).toBe(1)
  })
})

describe('C9: profil i kreator', () => {
  it('units: metric | imperial; inna wartość to błąd profilu', () => {
    writeFileSync(join(dir, 'trainctl.yaml'), PROFILE('units: miles\n'), 'utf-8')
    expect(() => loadConfig(dir)).toThrow(/units: metric (albo|or) imperial/)
    expect(readConfigUnits(dir)).toBeUndefined()
  })

  it('kreator: jednostka skrótem, zapis units w trainctl.yaml', () => {
    expect(parseUnitsInput('mi')).toBe<Units>('imperial')
    expect(parseUnitsInput('km')).toBe<Units>('metric')
    expect(() => parseUnitsInput('miles')).toThrow()
    expect(toYaml({ goalName: 'Half', goalDate: '2027-03-28', goalDistanceKm: 21.0975, recentWeeklyKm: 48.3, daysAvailable: ['tue'], units: 'imperial' }))
      .toMatch(/^units: imperial\nathlete:\n {2}recentWeeklyKm: 48\.3$/m)
  })
})
