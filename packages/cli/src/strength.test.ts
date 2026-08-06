/** Siła w planie od strony CLI: opt-in, widoczność, uczciwy „why". */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cmdExport, cmdPlan, cmdToday, cmdWeek, cmdWhy } from './commands.ts'
import { loadPlan } from './planfile.ts'
import { setLocale } from '@trainctl/core'

// Ten plik weryfikuje ZACHOWANIE komend, a asercje czyta się najłatwiej
// po polsku. Kompletność i jakość tłumaczeń pilnują testy i18n.
setLocale('pl')


const BASE = `athlete:
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
const WITH_STRENGTH = BASE + `strength:
  enabled: true
`

let dir: string
const setup = (yaml: string) => {
  writeFileSync(join(dir, 'trainctl.yaml'), yaml, 'utf-8')
  cmdPlan(dir, { date: '2026-08-05' })
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'trainctl-str-'))
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

const strengthDays = () =>
  loadPlan(dir)
    .weeks.flatMap((w) => w.days)
    .filter((d) => d.strength)

describe('opt-in', () => {
  it('bez sekcji strength plan nie zawiera ani jednej sesji siłowej', () => {
    setup(BASE)
    expect(strengthDays()).toHaveLength(0)
  })

  it('enabled: true dokłada siłę do planu', () => {
    setup(WITH_STRENGTH)
    expect(strengthDays().length).toBeGreaterThan(10)
  })

  it('siła nie zmienia kilometrażu planu', () => {
    setup(BASE)
    const kmWithout = loadPlan(dir).weeks.map((w) => w.totalKm)
    rmSync(join(dir, 'plan'), { recursive: true, force: true })
    setup(WITH_STRENGTH)
    expect(loadPlan(dir).weeks.map((w) => w.totalKm)).toEqual(kmWithout)
  })

  it('błędna konfiguracja siły → czytelny komunikat', () => {
    writeFileSync(join(dir, 'trainctl.yaml'), BASE + 'strength:\n  enabled: tak\n', 'utf-8')
    const r = cmdPlan(dir, { date: '2026-08-05' })
    expect(r.code).toBe(1)
    expect(r.output).toContain('strength.enabled')
  })
})

describe('widoczność w komendach', () => {
  beforeEach(() => setup(WITH_STRENGTH))

  it('today pokazuje sesję siłową z opisem i regułą odstępu', () => {
    const day = strengthDays()[0]!
    const r = cmdToday(dir, { date: day.date })
    expect(r.output).toContain('Siła')
    expect(r.output).toMatch(/1RM/)
  })

  it('week oznacza dni z siłą', () => {
    const day = strengthDays().find((d) => d.date >= '2026-08-03')!
    const r = cmdWeek(dir, { date: day.date })
    expect(r.output).toContain('SIŁA')
  })

  it('rozpiska do druku zawiera siłę', () => {
    const r = cmdExport(dir, { what: 'print' })
    expect(r.code).toBe(0)
    const file = readFileSync(
      join(dir, 'export', 'maraton-testowy-rozpiska.html'),
      'utf-8',
    )
    expect(file).toContain('siła')
  })
})

describe('why mówi prawdę o sile (F-8/F-9/F-15/F-17)', () => {
  beforeEach(() => setup(WITH_STRENGTH))

  it('uzasadnia ekonomią biegu, nie prewencją urazów', () => {
    const day = strengthDays()[0]!
    const out = cmdWhy(dir, { date: day.date }).output
    expect(out).toContain('ekonomia')
    expect(out).toMatch(/NIE jest .ochrona przed urazami|nie jest .ochrona/i)
  })

  it('nie obiecuje sekund i przyznaje ograniczenia wiekowe oraz dystansowe', () => {
    const day = strengthDays()[0]!
    const out = cmdWhy(dir, { date: day.date }).output
    expect(out).toContain('34–45')
    expect(out).toContain('laboratorium')
    expect(out).not.toMatch(/zmniejsz\w* ryzyko urazu/i)
  })
})

describe('taper bez siły (F-13)', () => {
  it('ostatnie tygodnie planu nie mają sesji siłowych', () => {
    setup(WITH_STRENGTH)
    const plan = loadPlan(dir)
    const taperWeeks = plan.weeks.filter((w) => ['taper', 'race'].includes(w.skeleton.phase))
    expect(taperWeeks.length).toBeGreaterThan(0)
    for (const w of taperWeeks) {
      expect(w.days.some((d) => d.strength)).toBe(false)
    }
  })
})
