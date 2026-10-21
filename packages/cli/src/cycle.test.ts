/**
 * Etap E (docs/PLAN-v0.4.md): życie po starcie (R-8…R-10) i plan bez startu (P-11)
 * — od profilu przez plik planu do tego, co widzi biegacz.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { setLocale, validatePlan } from 'trainctl-core'
import { cmdCheck, cmdExport, cmdLog, cmdPlan, cmdReview, cmdToday, cmdWhy } from './commands.ts'
import { cycleWeeksOf, loadPlan } from './planfile.ts'

setLocale('en')

const PROFILE = `athlete:
  recentWeeklyKm: 50
  daysAvailable: [tue, wed, thu, sat, sun]
  results:
    - { date: "2026-03-29", distanceKm: 10, timeSec: 2580 }
strength:
  enabled: true
`
const RACE = `${PROFILE}goal:
  name: "Half marathon"
  date: "2026-11-29"
  distanceKm: 21.0975
  priority: A
`
const BASE = `${PROFILE}goal:
  kind: base
  until: "2026-10-25"
`

let dir: string
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'trainctl-cycle-')) })
afterEach(() => {
  delete process.env['TRAINCTL_TODAY']
  rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
})
const write = (yaml: string) => writeFileSync(join(dir, 'trainctl.yaml'), yaml, 'utf-8')

describe('po starcie: blok przejściowy w planie i w tym, co widać', () => {
  it('dwa tygodnie po półmaratonie: pierwszy spokojny, bez długiego i bez siły, bieganie od 2. dnia', () => {
    write(RACE)
    expect(cmdPlan(dir, { date: '2026-08-08' }).code).toBe(0)
    const plan = loadPlan(dir)
    const [t1, t2] = plan.weeks.filter((w) => w.skeleton.phase === 'transition')
    expect(t1!.weekStart).toBe('2026-11-30')
    const runs1 = t1!.days.filter((d) => d.workout)
    expect(runs1.length).toBeGreaterThan(0)
    expect(runs1.every((d) => d.workout!.kind === 'easy')).toBe(true)
    expect(runs1.every((d) => d.date >= '2026-12-01')).toBe(true)
    expect(t1!.days.some((d) => d.strength)).toBe(false)
    expect(t2!.days.filter((d) => d.workout && ['quality_intervals', 'quality_continuous'].includes(d.workout.kind)).length).toBeLessThanOrEqual(1)
    expect(t2!.days.filter((d) => d.strength).every((d) => d.strength!.kind === 'intro')).toBe(true)
    expect(validatePlan(plan).filter((i) => i.severity === 'error')).toEqual([])
    expect(cmdCheck(dir).code).toBe(0)
  })
  it('today i why po starcie mówią „po starcie", nie „poza planem"', () => {
    write(RACE)
    cmdPlan(dir, { date: '2026-08-08' })
    const plan = loadPlan(dir)
    const day = plan.weeks.find((w) => w.skeleton.phase === 'transition')!.days.find((d) => d.workout)!
    const today = cmdToday(dir, { date: day.date })
    expect(today.output).toContain('after the race')
    expect(today.output).toMatch(/\d+ days? after the race/)
    expect(cmdWhy(dir, { date: day.date }).output).toContain('Goal behind you')
  })
  it('poza zakresem planu: koniec zakresu to koniec bloku przejściowego, nie dzień startu', () => {
    write(RACE)
    cmdPlan(dir, { date: '2026-08-08' })
    expect(cmdToday(dir, { date: '2027-01-20' }).output).toContain('2026-08-03 → 2026-12-13')
  })
  it('w dniu startu, po zalogowaniu startu, nowy cel tego samego dystansu otwiera nowy cykl', () => {
    write(RACE)
    cmdPlan(dir, { date: '2026-08-08' })
    process.env['TRAINCTL_TODAY'] = '2026-11-29'
    expect(cmdLog(dir, { date: '2026-11-29', km: '21.1', time: '1:35:10' }).code).toBe(0)
    write(RACE.replace('2026-11-29', '2027-04-11'))
    const r = cmdPlan(dir)
    expect(r.code, r.output).toBe(0)
    expect(r.data).toMatchObject({ regeneration: { mode: 'new-cycle' } })
  })
  it('start przełożony rano w dniu zawodów to ten sam cykl — taper się wydłuża, bez bloku po starcie', () => {
    write(RACE)
    cmdPlan(dir, { date: '2026-08-08' })
    process.env['TRAINCTL_TODAY'] = '2026-11-29'
    write(RACE.replace('2026-11-29', '2026-12-06'))
    const r = cmdPlan(dir)
    expect(r.code, r.output).toBe(0)
    expect(r.data).toMatchObject({ regeneration: { mode: 'same-cycle' } })
    expect(loadPlan(dir).weeks.find((w) => w.skeleton.raceDate)!.skeleton.raceDate).toBe('2026-12-06')
  })
  it('w dniu startu ten sam cel to nadal ten sam cykl', () => {
    write(RACE)
    cmdPlan(dir, { date: '2026-08-08' })
    process.env['TRAINCTL_TODAY'] = '2026-11-29'
    expect(cmdPlan(dir).data).toMatchObject({ regeneration: { mode: 'same-cycle' } })
  })
  it('nowy cel w trakcie bloku: nowy cykl zaczyna się PO bloku przejściowym, historia zostaje', () => {
    write(RACE)
    cmdPlan(dir, { date: '2026-08-08' })
    process.env['TRAINCTL_TODAY'] = '2026-12-02'
    write(RACE.replace('"Half marathon"', '"Spring 10K"').replace('2026-11-29', '2027-03-14').replace('21.0975', '10'))
    const r = cmdPlan(dir)
    expect(r.code, r.output).toBe(0)
    expect(r.output).toContain('New training cycle from 2026-12-14')
    expect(r.output).toContain('The new cycle starts from')
    const plan = loadPlan(dir)
    expect(plan.cycleStart).toBe('2026-12-14')
    expect(plan.weeks.filter((w) => w.skeleton.phase === 'transition' && w.weekStart < '2026-12-14')).toHaveLength(2)
    expect(cycleWeeksOf(plan)[0]!.weekStart).toBe('2026-12-14')
    expect(validatePlan(plan).filter((i) => i.severity === 'error')).toEqual([])
  })
})

describe('plan bez startu (goal.kind: base)', () => {
  it('generuje bazę do daty końca: bez startu, predykcji i taperu; lint bez fałszywego braku dnia startu', () => {
    write(BASE)
    const r = cmdPlan(dir, { date: '2026-08-08' })
    expect(r.code, r.output).toBe(0)
    expect(r.output).toContain('base training until 2026-10-25')
    expect(r.output).not.toContain('Predicted finish')
    expect(r.output).not.toContain('Recommended for this distance')
    const plan = loadPlan(dir)
    expect(plan.goal).toMatchObject({ kind: 'base', distanceKm: 0, name: 'Base training' })
    expect(plan.prediction).toBeUndefined()
    expect(plan.weeks.every((w) => w.skeleton.phase === 'base')).toBe(true)
    expect(plan.weeks.flatMap((w) => w.days).some((d) => d.workout?.kind === 'race')).toBe(false)
    expect(cmdCheck(dir).code).toBe(0)
  })
  it('today, review i eksport wiedzą, że nie ma startu', async () => {
    write(BASE)
    cmdPlan(dir, { date: '2026-08-08' })
    expect(cmdToday(dir, { date: '2026-08-11' }).output).toContain('base training until 2026-10-25')
    const review = await cmdReview(dir, { date: '2026-08-16' })
    expect(review.output).toContain('Base plan until')
    expect(review.output).not.toContain('To race day')
    const race = cmdExport(dir, { what: 'race' })
    expect(race.code).toBe(1)
    expect(race.output).toContain('A base plan has no race')
  })
  it('profil bez daty końca albo z nieznanym rodzajem celu: czytelny błąd', () => {
    write(`${PROFILE}goal:\n  kind: base\n`)
    expect(cmdPlan(dir, { date: '2026-08-08' }).output).toContain('goal.until')
    write(`${PROFILE}goal:\n  kind: fun-run\n  name: x\n  date: "2026-10-25"\n  distanceKm: 5\n`)
    expect(cmdPlan(dir, { date: '2026-08-08' }).output).toContain('goal.kind: race (default) or base')
  })
})
