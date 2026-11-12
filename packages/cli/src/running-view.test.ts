/**
 * PLAN-v0.7 E4: jedna ścieżka komend dla biegu. Po migracji `why`, `adapt`, `status`
 * i `review` czytają widok planu v2 i mówią to samo co plan biegowy przed migracją;
 * propozycja `adapt` zapisuje się jako propozycja v2 i zmienia sesje v2.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parse, stringify } from 'yaml'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { addDays, setLocale, weekdayOf, type SportsConfig } from 'trainctl-core'
import { cmdAdapt, cmdInit, cmdLog, cmdMigrate, cmdPlan, cmdReview, cmdShift, cmdWhy } from './commands.ts'
import { loadPlan, type StoredPlan } from './planfile.ts'
import { cmdStatus } from './status.ts'
import { loadSportsPlan } from './sports-store.ts'

const PROFILE = `athlete:
  recentWeeklyKm: 35
  daysAvailable: [tue, wed, thu, sat, sun]
  longRunDay: sun
  results:
    - { date: '2026-09-01', distanceKm: 10, timeSec: 3000 }
goal:
  kind: race
  name: Półmaraton
  date: '2027-03-14'
  distanceKm: 21.0975
  priority: A
`

let dir: string
const saved = process.env['TRAINCTL_TODAY']
const day = (date: string) => { process.env['TRAINCTL_TODAY'] = date }
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'trainctl-view-'))
  setLocale('pl')
  day('2026-11-02')
})
afterEach(() => {
  rmSync(dir, { recursive: true, force: true, maxRetries: 3 })
  if (saved === undefined) delete process.env['TRAINCTL_TODAY']
  else process.env['TRAINCTL_TODAY'] = saved
})

/** Plan biegowy z dwoma tygodniami wykonania (jedna sesja opuszczona), dziś 2026-11-16. */
function runningWorkspace(): StoredPlan {
  expect(cmdInit(dir, PROFILE).code).toBe(0)
  expect(cmdPlan(dir).code).toBe(0)
  const plan = loadPlan(dir)
  day('2026-11-16')
  const past = plan.weeks.flatMap((w) => w.days).filter((d) => d.workout && d.date >= '2026-11-02' && d.date < '2026-11-16')
  past.forEach((d, i) => {
    const r = i === 1 ? cmdLog(dir, { date: d.date, status: 'skipped' })
      : cmdLog(dir, { date: d.date, km: String(d.workout!.distanceKm), time: `${Math.round(d.workout!.distanceKm * 6)}:00`, rpe: '4' })
    expect(r.code, d.date).toBe(0)
  })
  return plan
}

function migrate(): void {
  const id = (cmdMigrate(dir).data!['proposal'] as { id: string }).id
  expect(cmdMigrate(dir, { apply: id }).code).toBe(0)
}

const sportsConfig = (): SportsConfig => parse(readFileSync(join(dir, 'trainctl.yaml'), 'utf8')) as SportsConfig
const writeConfig = (c: SportsConfig) => writeFileSync(join(dir, 'trainctl.yaml'), stringify(c))

describe('E4: plan v2 z silnikiem biegowym idzie ścieżką planu biegowego', () => {
  it('why, adapt i status po migracji mówią to samo co plan biegowy przed migracją', () => {
    const plan = runningWorkspace()
    const quality = plan.weeks.flatMap((w) => w.days).find((d) => d.date > '2026-11-16' && d.workout?.kind.startsWith('quality'))!
    const before = { why: cmdWhy(dir, { date: quality.date }), adapt: cmdAdapt(dir), status: cmdStatus(dir) }
    migrate()
    const after = { why: cmdWhy(dir, { date: quality.date }), adapt: cmdAdapt(dir), status: cmdStatus(dir) }
    expect(after.why.code).toBe(0)
    expect(after.why.output).toBe(before.why.output)
    expect(after.adapt.output).toBe(before.adapt.output)
    expect(after.adapt.data!['proposal']).toEqual(before.adapt.data!['proposal'])
    expect((after.adapt.data!['proposal'] as { missedSessions: number }).missedSessions).toBe(1)
    for (const key of ['plan', 'journal'] as const) expect(after.status.data[key]).toEqual(before.status.data[key])
    expect(after.status.data['schemaVersion']).toBe(2)
    // ta sama sesja z karty v2 objaśniona przez ID
    const session = loadSportsPlan(dir).sessions.find((s) => s.date === quality.date && s.sport === 'run')!
    expect(cmdWhy(dir, { session: session.id }).output).toBe(before.why.output)
  })

  it('dziennik sesji v2 zasila analizę planu biegowego', () => {
    runningWorkspace()
    migrate()
    const missed = () => (cmdAdapt(dir).data!['proposal'] as { missedSessions: number }).missedSessions
    expect(missed()).toBe(1)
    const done = loadSportsPlan(dir).sessions.find((s) => s.sport === 'run' && s.date === '2026-11-15')
      ?? loadSportsPlan(dir).sessions.filter((s) => s.sport === 'run' && s.date < '2026-11-16').at(-1)!
    expect(cmdLog(dir, { session: done.id, status: 'skipped' }).code).toBe(0)
    expect(missed()).toBe(2)
  })

  it('adapt --prepare zapisuje propozycję v2, --apply zmienia sesje i plan generatora; przesunięta sesja zostaje', () => {
    runningWorkspace()
    migrate()
    // przesunięcie w v2 na wolny dzień profilu: dzień źródłowy i docelowy są chronione
    const sessions = loadSportsPlan(dir).sessions
    const moved = sessions.find((s) => s.sport === 'run' && s.date >= '2026-11-24' && s.legacyWorkout?.kind === 'easy')!
    const free = [1, 2, 3, 4, 5, 6].map((i) => addDays(moved.date, i))
      .find((d) => ['tue', 'wed', 'thu', 'sat', 'sun'].includes(weekdayOf(d)) && !sessions.some((s) => s.date === d))!
    expect(free).toBeDefined()
    const shifted = cmdShift(dir, { session: moved.id, from: moved.date, to: free })
    expect(shifted.code, shifted.output).toBe(0)
    // nowy wynik w profilu v2: rekalibracja stref planu biegowego
    const c = sportsConfig()
    c.athlete.sports.run!.results = [...c.athlete.sports.run!.results!, { date: '2026-11-14', distanceKm: 5, timeSec: 1380 }]
    writeConfig(c)
    const prepared = cmdAdapt(dir, { prepare: true })
    expect(prepared.code, prepared.output).toBe(0)
    const info = prepared.data!['prepared'] as { id: string; changes: { date: string }[]; protectedDates: string[] }
    expect(info.id).toMatch(/^[a-f0-9-]{36}$/)
    expect(info.changes.length).toBeGreaterThan(0)
    expect(info.changes.map((x) => x.date)).not.toContain(moved.date)
    expect(info.changes.map((x) => x.date)).not.toContain(free)
    expect(info.protectedDates).toEqual(expect.arrayContaining([moved.date, free]))
    expect(prepared.output).toContain(`trainctl adapt --apply ${info.id}`)
    // status widzi propozycję v2 i podpowiada jej przyjęcie
    const status = cmdStatus(dir)
    expect(status.output).toContain(`trainctl adapt --apply ${info.id}`)

    const vdotBefore = (loadSportsPlan(dir).legacy!.generatorPlan as StoredPlan | undefined ?? loadSportsPlan(dir).legacy!.plan as StoredPlan).vdot
    const applied = cmdAdapt(dir, { apply: info.id })
    expect(applied.code, applied.output).toBe(0)
    const after = loadSportsPlan(dir)
    const generator = after.legacy!.generatorPlan as StoredPlan
    expect(generator.vdot).toBeGreaterThan(vdotBefore)
    const changedDate = info.changes[0]!.date
    const changedRun = after.sessions.find((s) => s.date === changedDate && s.sport === 'run')!
    const genDay = generator.weeks.flatMap((w) => w.days).find((d) => d.date === changedDate)!
    expect(changedRun.legacyWorkout).toEqual(genDay.workout)
    expect(after.changes.at(-1)!.action).toBe('adapt')
    // przesunięta sesja stoi na nowym dniu, a regeneracja nie dokłada drugiego biegu
    expect(after.sessions.filter((s) => s.id === moved.id).map((s) => s.date)).toEqual([free])
    expect(cmdPlan(dir).code).toBe(0)
    const regenerated = loadSportsPlan(dir)
    expect(regenerated.sessions.filter((s) => s.date === free && s.sport === 'run')).toHaveLength(1)
    expect(regenerated.sessions.filter((s) => s.date === moved.date && s.sport === 'run')).toHaveLength(0)
  })

  it('review: przegląd planu biegowego; --prepare daje propozycję v2', async () => {
    runningWorkspace()
    migrate()
    const c = sportsConfig()
    c.athlete.sports.run!.results = [...c.athlete.sports.run!.results!, { date: '2026-11-14', distanceKm: 5, timeSec: 1380 }]
    writeConfig(c)
    const review = await cmdReview(dir, { prepare: true })
    expect(review.code, review.output).toBe(0)
    expect(review.data).toHaveProperty('period')
    expect(review.data!['preparation']).toEqual({ status: 'prepared' })
    expect((review.data!['prepared'] as { id: string }).id).toMatch(/^[a-f0-9-]{36}$/)
  })

  it('katalog z innym sportem zostaje na ścieżce v2', () => {
    runningWorkspace()
    migrate()
    const c = sportsConfig()
    c.athlete.sports.bike = { weeklyMinutes: 60, sessionsPerWeek: 1, preparationMinutes: 10 }
    writeConfig(c)
    expect(cmdWhy(dir, { date: '2026-11-17' }).data).toHaveProperty('schemaVersion', 2)
    expect(cmdStatus(dir).data).toHaveProperty('schemaVersion', 2)
    expect(cmdAdapt(dir).data).not.toHaveProperty('proposal.missedSessions')
  })
})
