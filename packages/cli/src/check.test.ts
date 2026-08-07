/**
 * `trainctl check` E2E: lint planu na realnych plikach + kontrakt kodów wyjścia
 * dla CI (błędy = 1, ostrzeżenia = 0, --strict podnosi ostrzeżenia do 1).
 * Osobno: `reschedule --apply` po odpuszczeniu sesji zostawia spójne sumy —
 * regresja, którą lint właśnie wykrył.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { setLocale, weekTotals } from 'trainctl-core'
import { cmdCheck, cmdPlan, cmdReschedule, cmdShift, cmdToday } from './commands.ts'
import { loadPlan, writePlan, PLAN_YAML } from './planfile.ts'

setLocale('pl')

const TODAY = '2026-08-05'

const CONFIG = `athlete:
  recentWeeklyKm: 55
  peakWeeklyKm: 75
  daysAvailable: [tue, wed, thu, sat, sun]
  longRunDay: sat
  results:
    - { date: "2026-03-30", distanceKm: 21.0975, timeSec: 5400 }
goal:
  name: "Maraton testowy"
  date: "2026-11-29"
  distanceKm: 42.195
  priority: A
`

let dir: string

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'trainctl-check-'))
  writeFileSync(join(dir, 'trainctl.yaml'), CONFIG, 'utf-8')
  cmdPlan(dir, { date: TODAY })
})
afterAll(() => {
  rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
})

describe('trainctl check', () => {
  it('świeży plan: bez zastrzeżeń, kod 0', () => {
    const r = cmdCheck(dir)
    expect(r.code).toBe(0)
    expect(r.output).toContain('Bez zastrzeżeń')
    expect(r.output).toMatch(/17 tygodni/)
  })

  it('brak planu: czytelny błąd', () => {
    const empty = mkdtempSync(join(tmpdir(), 'trainctl-check-empty-'))
    try {
      const r = cmdCheck(empty)
      expect(r.code).toBe(1)
      expect(r.output).toContain('Brak planu')
    } finally {
      rmSync(empty, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
    }
  })

  it('pusty plan.yaml: ustalenia lintu zamiast wyjątku, kod 1', () => {
    const before = readFileSync(join(dir, PLAN_YAML), 'utf-8')
    try {
      writeFileSync(join(dir, PLAN_YAML), '', 'utf-8')
      const r = cmdCheck(dir)
      expect(r.code).toBe(1)
      expect(r.output).toContain('Integralność pliku')
      expect(r.output).toContain('brak listy tygodni')
      expect(r.output).toContain('brak celu z datą')
      expect(r.output).not.toMatch(/Cannot read|undefined/)
    } finally {
      writeFileSync(join(dir, PLAN_YAML), before, 'utf-8')
    }
  })

  it('weeks nie jest listą (ręczna edycja): błąd lintu, nie wyjątek', () => {
    const before = readFileSync(join(dir, PLAN_YAML), 'utf-8')
    try {
      writeFileSync(
        join(dir, PLAN_YAML),
        'goal: { date: "2026-11-29", distanceKm: 42.195, name: X, priority: A }\nweeks: 7\n',
        'utf-8',
      )
      const r = cmdCheck(dir)
      expect(r.code).toBe(1)
      expect(r.output).toContain('brak listy tygodni')
      expect(r.output).not.toContain('brak celu z datą')
    } finally {
      writeFileSync(join(dir, PLAN_YAML), before, 'utf-8')
    }
  })

  it('połamany plan zatrzymuje pozostałe komendy czytelnym zdaniem', () => {
    const before = readFileSync(join(dir, PLAN_YAML), 'utf-8')
    try {
      writeFileSync(join(dir, PLAN_YAML), 'goal: {}\n', 'utf-8')
      const r = cmdToday(dir, { date: TODAY })
      expect(r.code).toBe(1)
      expect(r.output).toContain('trainctl check')
    } finally {
      writeFileSync(join(dir, PLAN_YAML), before, 'utf-8')
    }
  })

  it('ręczna edycja psująca sumy: błąd z sekcją integralności, kod 1', () => {
    const plan = loadPlan(dir)
    const before = readFileSync(join(dir, PLAN_YAML), 'utf-8')
    plan.weeks[0]!.totalKm += 10
    writePlan(dir, plan)
    try {
      const r = cmdCheck(dir)
      expect(r.code).toBe(1)
      expect(r.output).toContain('Integralność pliku')
      expect(r.output).toContain('totalKm')
    } finally {
      writeFileSync(join(dir, PLAN_YAML), before, 'utf-8')
    }
  })

  it('przesunięcie łamiące I-7: ostrzeżenie z ID reguły, kod 0; --strict → kod 1', () => {
    const plan = loadPlan(dir)
    const before = readFileSync(join(dir, PLAN_YAML), 'utf-8')
    // akcent przeniesiony ręcznie na dzień obok drugiego akcentu — dokładnie to,
    // co użytkownik może zrobić edytując plan.yaml (shift by ostrzegł i pozwolił)
    const week = plan.weeks[0]!
    const accents = week.days.filter(
      (d) => d.workout && ['quality_intervals', 'quality_continuous'].includes(d.workout.kind),
    )
    expect(accents.length).toBeGreaterThanOrEqual(2)
    const [a, b] = accents
    const target = week.days[week.days.findIndex((d) => d.date === a!.date) + 1]!
    const moved = b!.workout!
    delete b!.workout
    target.workout = moved
    Object.assign(week, weekTotals(week.days))
    writePlan(dir, plan)
    try {
      const soft = cmdCheck(dir)
      expect(soft.code).toBe(0)
      expect(soft.output).toContain('Odstępstwa od reguł')
      expect(soft.output).toContain('[I-7]')
      const strict = cmdCheck(dir, { strict: true })
      expect(strict.code).toBe(1)
    } finally {
      writeFileSync(join(dir, PLAN_YAML), before, 'utf-8')
    }
  })
})

describe('reschedule --apply zostawia spójne sumy (regresja z lint)', () => {
  it('po odpuszczeniu sesji totalKm/easyShare są przeliczone i check przechodzi bez błędów', () => {
    const before = readFileSync(join(dir, PLAN_YAML), 'utf-8')
    try {
      // blokada większości tygodnia → solver musi coś odpuścić
      const r = cmdReschedule(dir, {
        date: '2026-08-05',
        block: ['2026-08-05', '2026-08-06', '2026-08-08', '2026-08-09'],
        apply: true,
      })
      expect(r.code).toBe(0)
      const plan = loadPlan(dir)
      const week = plan.weeks[0]!
      const totals = weekTotals(week.days)
      expect(week.totalKm).toBe(totals.totalKm)
      expect(week.easyShare).toBeCloseTo(totals.easyShare, 10)
      const check = cmdCheck(dir)
      expect(check.output).not.toContain('Integralność pliku')
    } finally {
      writeFileSync(join(dir, PLAN_YAML), before, 'utf-8')
    }
  })

  it('shift nie rozjeżdża sum (zamiana wewnątrz tygodnia)', () => {
    const before = readFileSync(join(dir, PLAN_YAML), 'utf-8')
    try {
      const r = cmdShift(dir, { from: '2026-08-04', to: '2026-08-07' })
      expect(r.code).toBe(0)
      const check = cmdCheck(dir)
      expect(check.output).not.toContain('Integralność pliku')
    } finally {
      writeFileSync(join(dir, PLAN_YAML), before, 'utf-8')
    }
  })
})
