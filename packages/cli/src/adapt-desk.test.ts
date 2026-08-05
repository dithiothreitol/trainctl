/** E2E komend adapt/desk na realnych plikach. */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildExecution, cmdAdapt, cmdDesk, cmdLog, cmdPlan, cmdReschedule } from './commands.ts'
import { loadPlan } from './planfile.ts'
import { readLog } from './logfile.ts'

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
const WITH_DESK = BASE + `desk:
  workStart: "09:00"
  workEnd: "17:30"
  lunchMinutes: 45
  prefer: evening
`

let dir: string

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'tren-p5-'))
  writeFileSync(join(dir, 'tren.yaml'), WITH_DESK, 'utf-8')
  cmdPlan(dir, { date: '2026-08-05' })
})
afterAll(() => rmSync(dir, { recursive: true, force: true }))

describe('buildExecution', () => {
  it('scala plan z sync i dziennikiem; klasyfikuje statusy', () => {
    const plan = loadPlan(dir)
    const exec = buildExecution(
      plan,
      [{ externalId: 'a', date: '2026-08-04', type: 'Run', distanceKm: 11 }],
      [{ date: '2026-08-05', status: 'done', km: 12, loggedAt: '' }],
      '2026-08-09',
    )
    const byDate = new Map(exec.map((e) => [e.date, e]))
    expect(byDate.get('2026-08-04')!.status).toBe('done')
    expect(byDate.get('2026-08-04')!.actualKm).toBe(11)
    expect(byDate.get('2026-08-05')!.actualKm).toBe(12) // z dziennika
    expect(byDate.get('2026-08-03')!.status).toBe('rest')
    expect(byDate.get('2026-08-06')!.status).toBe('missed')
    expect(exec.every((e) => e.date <= '2026-08-09')).toBe(true)
  })

  it('aktywność w dniu spoza planu trafia jako nieplanowana', () => {
    const plan = loadPlan(dir)
    const exec = buildExecution(
      plan,
      [{ externalId: 'x', date: '2026-07-20', type: 'Run', distanceKm: 8 }],
      [],
      '2026-08-09',
    )
    expect(exec.find((e) => e.date === '2026-07-20')!.status).toBe('unplanned')
  })

  it('ignoruje aktywności niebiegowe', () => {
    const plan = loadPlan(dir)
    const exec = buildExecution(
      plan,
      [{ externalId: 'b', date: '2026-08-04', type: 'Ride', distanceKm: 40 }],
      [],
      '2026-08-09',
    )
    expect(exec.find((e) => e.date === '2026-08-04')!.status).toBe('missed')
  })
})

describe('tren adapt', () => {
  it('bez danych wykonania proponuje konserwatywny restart', () => {
    const r = cmdAdapt(dir, { date: '2026-09-01' })
    expect(r.code).toBe(0)
    expect(r.output).toContain('conservative-restart')
    expect(r.output).toContain('Brak sync.json')
  })

  it('po zalogowaniu treningów diagnoza uwzględnia dziennik', () => {
    for (const d of ['2026-08-04', '2026-08-05', '2026-08-06', '2026-08-08', '2026-08-09']) {
      cmdLog(dir, { date: d, status: 'done', km: '12' })
    }
    expect(readLog(dir).length).toBeGreaterThanOrEqual(5)
    const r = cmdAdapt(dir, { date: '2026-08-10' })
    expect(r.code).toBe(0)
    expect(r.output).toMatch(/21 dni/)
    expect(r.output).toContain('Propozycje:')
  })

  it('propozycja objętości mówi wprost, jak ją zastosować (nie zmienia planu sama)', () => {
    const r = cmdAdapt(dir, { date: '2026-08-10' })
    if (r.output.includes('recentWeeklyKm')) {
      expect(r.output).toContain('tren diff')
      expect(r.output).toContain('Silnik nie przepisuje planu sam')
    }
  })
})

describe('tren desk', () => {
  it('pokazuje okna, przerwy i reguły', () => {
    const r = cmdDesk(dir, { date: '2026-08-04' })
    expect(r.code).toBe(0)
    expect(r.output).toContain('praca 09:00–17:30')
    expect(r.output).toContain('Okna treningowe:')
    expect(r.output).toContain('Przerwy w siedzeniu')
    expect(r.output).toContain('FOUNDATIONS')
  })

  it('flaga --heavy dokłada regułę tempa zamiast odczucia', () => {
    const normal = cmdDesk(dir, { date: '2026-08-04' })
    const heavy = cmdDesk(dir, { date: '2026-08-04', heavy: true })
    expect(normal.output).not.toContain("PO TEMPIE")
    expect(heavy.output).toContain("PO TEMPIE")
    expect(heavy.output).toContain('B-10')
  })

  it('bez sekcji desk w tren.yaml — instrukcja z gotowym fragmentem', () => {
    const bare = mkdtempSync(join(tmpdir(), 'tren-nodesk-'))
    writeFileSync(join(bare, 'tren.yaml'), BASE, 'utf-8')
    const r = cmdDesk(bare, { date: '2026-08-04' })
    expect(r.code).toBe(1)
    expect(r.output).toContain('workStart')
    rmSync(bare, { recursive: true, force: true })
  })

  it('działa bez wygenerowanego planu (same przerwy)', () => {
    const bare = mkdtempSync(join(tmpdir(), 'tren-desk-only-'))
    writeFileSync(join(bare, 'tren.yaml'), WITH_DESK, 'utf-8')
    const r = cmdDesk(bare, { date: '2026-08-04' })
    expect(r.code).toBe(0)
    expect(r.output).toContain('Dziś bez biegania')
    rmSync(bare, { recursive: true, force: true })
  })
})

describe('tren reschedule', () => {
  it('podgląd nie zapisuje planu', () => {
    const before = JSON.stringify(loadPlan(dir).weeks[2])
    const r = cmdReschedule(dir, { block: ['2026-08-20'], date: '2026-08-20' })
    expect(r.code).toBe(0)
    expect(r.output).toContain('Co się zmienia')
    expect(JSON.stringify(loadPlan(dir).weeks[2])).toBe(before)
  })

  it('--apply zapisuje nowy układ i zostawia ślad w changes', () => {
    const r = cmdReschedule(dir, { block: ['2026-08-20'], date: '2026-08-20', apply: true })
    expect(r.code).toBe(0)
    expect(r.output).toContain('Zastosowano')
    const plan = loadPlan(dir)
    const day = plan.weeks.flatMap((w) => w.days).find((d) => d.date === '2026-08-20')!
    expect(day.workout).toBeUndefined()
    expect(plan.changes.some((c) => c.action === 'reschedule')).toBe(true)
  })

  it('tydzień bez konfliktów zostaje nietknięty', () => {
    const r = cmdReschedule(dir, { date: '2026-09-01' })
    expect(r.output).toContain('bez zmian')
  })

  it('data poza planem — czytelny błąd', () => {
    const r = cmdReschedule(dir, { date: '2030-01-01' })
    expect(r.code).toBe(1)
  })
})
