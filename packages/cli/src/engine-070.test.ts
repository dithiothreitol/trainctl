/**
 * Etap 2 (docs/PLAN-v0.7.md, pakiet B): to, co zmiana silnika pokazuje
 * w komendach — uwagi generatora w `why`, ostrzeżenie o pojemności dni w `plan`.
 * Kształt sezonu na macierzy sprawdza plan-shape.test.ts.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { earliestFeasibleRaceDate, plannedWeekKm, setLocale, type AdaptationProposal, type WeekNote } from 'trainctl-core'
import { applyProposal, prepareProposal } from './proposals.ts'
import { cmdAdapt, cmdCheck, cmdLog, cmdPlan, cmdRules, cmdWhy } from './commands.ts'
import { latestByDate, readLog } from './logfile.ts'
import { writeSnapshot } from './sync.ts'
import { buildExecution } from './execution.ts'
import { blockLevelOf, computePlan, cycleWeeksOf, loadPlan, mergeWeekNotes, settleMixedWeek, writePlan } from './planfile.ts'
import { inferredConfigYaml, loadConfig } from './config.ts'
import { parse } from 'yaml'

const config = (weeklyKm: number, days: string) => `athlete:
  recentWeeklyKm: ${weeklyKm}
  daysAvailable: [${days}]
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
  dir = mkdtempSync(join(tmpdir(), 'trainctl-070-'))
  process.env['TRAINCTL_TODAY'] = '2026-10-22'
})
afterEach(() => {
  delete process.env['TRAINCTL_TODAY']
  setLocale('en')
  rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
})

function planFor(weeklyKm: number, days: string) {
  writeFileSync(join(dir, 'trainctl.yaml'), config(weeklyKm, days), 'utf-8')
  const r = cmdPlan(dir)
  expect(r.code).toBe(0)
  return { output: r.output, plan: loadPlan(dir) }
}
const noteDay = (plan: ReturnType<typeof loadPlan>, code: string) => plan.weeks.flatMap((w) => (w.notes ?? []).filter((n) => n.code === code).map((n) => ('date' in n ? n.date : w.weekStart)))[0]

describe.each(['pl', 'en'] as const)('B1, B2 w komendach · %s', (lang) => {
  beforeEach(() => setLocale(lang))

  it('why: akcent zamieniony na przebieżki przy małej objętości mówi dlaczego (J-6)', () => {
    const { plan } = planFor(12, 'tue, wed, thu, sat, sun')
    const date = noteDay(plan, 'accentAsStrides')!
    expect(date).toBeDefined()
    const out = cmdWhy(dir, { date }).output
    expect(out).toContain(lang === 'pl' ? 'Akcent zamieniony na bieg spokojny z przebieżkami' : 'This accent is an easy run with strides')
    expect(out).toContain('J-6')
  })

  it('why: dzień podbiegów zamieniony na bieg spokojny — tylko przy tym dniu', () => {
    const { plan } = planFor(45, 'tue, thu, sat')
    const date = noteDay(plan, 'hillsDropped')!
    expect(date).toBeDefined()
    const text = lang === 'pl' ? 'Dzień podbiegów jest w tym tygodniu biegiem spokojnym' : 'The hills day is an easy run this week'
    expect(cmdWhy(dir, { date }).output).toContain(text)
    const week = plan.weeks.find((w) => w.days.some((d) => d.date === date))!
    const other = week.days.find((d) => d.date !== date && d.workout)!
    expect(cmdWhy(dir, { date: other.date }).output).not.toContain(text)
  })

  it('plan: werdykt wykonalności — trzy liczby i wyjścia jednym blokiem (B4, B8)', () => {
    const { output, plan } = planFor(12, 'tue, wed, thu, sat, sun')
    const longest = Math.max(...plan.weeks.flatMap((w) => w.days).filter((d) => d.workout?.kind === 'long').map((d) => d.workout!.distanceKm))
    const fmt = (km: number) => (lang === 'pl' ? String(km).replace('.', ',') : String(km))
    expect(output).toContain(lang === 'pl'
      ? `szczyt ${plan.peakKmPlanned} km/tydz. wobec 42 km/tydz. (P-7/P-8), najdłuższe wybieganie ${fmt(longest)} km wobec ponad 21 km`
      : `it peaks at ${plan.peakKmPlanned} km/week against 42 km/week (P-7/P-8), and its longest run is ${fmt(longest)} km against more than 21 km`)
    expect(output).toContain('athlete.peakWeeklyKm')
    expect(output).toContain('goal.kind: base')
    // jedno ostrzeżenie zamiast dwóch: bez osobnego zdania o szczycie
    expect(plan.feasibilityWarnings.filter((w) => /P-7\/P-8/.test(w))).toHaveLength(1)
    // P1: progi spełnione — bez werdyktu
    expect(planFor(45, 'tue, wed, thu, sat, sun').output).not.toMatch(/nie dochodzi do progów|stays below the thresholds/)
  })

  it('plan: werdykt podaje datę startu, od której plan zdąży urosnąć, gdy sufit z historii na to pozwala', () => {
    writeFileSync(join(dir, 'trainctl.yaml'), config(12, 'tue, wed, thu, sat, sun').replace('recentWeeklyKm: 12', 'recentWeeklyKm: 12\n  peakWeeklyKm: 50').replace('2027-03-28', '2026-12-27'), 'utf-8')
    const r = cmdPlan(dir)
    expect(r.code).toBe(0)
    expect(r.output).toMatch(lang === 'pl' ? /start nie wcześniej niż 2027-\d\d-\d\d/ : /a race on or after 2027-\d\d-\d\d/)
    // regeneracja kilka tygodni później: data liczy się od dziś, nie od startu planu
    process.env['TRAINCTL_TODAY'] = '2026-11-20'
    const again = cmdPlan(dir)
    expect(again.code).toBe(0)
    const cfg = loadConfig(dir)
    const fromToday = earliestFeasibleRaceDate(cfg.athlete, cfg.goal, '2026-11-20')!
    expect(fromToday > earliestFeasibleRaceDate(cfg.athlete, cfg.goal, '2026-10-22')!).toBe(true)
    expect(again.output).toContain(fromToday)
  })

  it('plan po przerwie (R-11): pierwszy blok spokojny, start od połowy objętości sprzed przerwy', () => {
    writeFileSync(join(dir, 'trainctl.yaml'), config(12, 'tue, wed, thu, sat, sun').replace('recentWeeklyKm: 12', 'recentWeeklyKm: 12\n  returning: { since: "2026-10-19", previousWeeklyKm: 45 }'), 'utf-8')
    const r = cmdPlan(dir)
    expect(r.code).toBe(0)
    expect(r.output).toContain(lang === 'pl' ? 'powrót po przerwie: pierwszy blok wyłącznie spokojnie' : 'return after a break: the first block is easy running only')
    const first = loadPlan(dir).weeks.slice(0, 4)
    expect(first[0]!.skeleton.targetKm).toBeGreaterThanOrEqual(Math.round(0.5 * 45 * 0.94))
    for (const w of first) expect(w.days.some((d) => d.workout && ['quality_intervals', 'quality_continuous', 'easy_hills', 'test'].includes(d.workout.kind))).toBe(false)
  })

  it('trainctl.yaml: athlete.returning z błędną datą albo objętością zatrzymuje plan', () => {
    writeFileSync(join(dir, 'trainctl.yaml'), config(12, 'tue, sat').replace('recentWeeklyKm: 12', 'recentWeeklyKm: 12\n  returning: { since: "wczoraj", previousWeeklyKm: 0 }'), 'utf-8')
    const r = cmdPlan(dir)
    expect(r.code).toBe(1)
    expect(r.output).toContain('athlete.returning.since')
    expect(r.output).toContain('athlete.returning.previousWeeklyKm')
  })

  it('B6: akcent dzień po długim cytuje S-9b, długie dzień po sprawdzianie — T-11', () => {
    const { plan } = planFor(45, 'tue, wed, thu, sat, sun')
    const days = plan.weeks.flatMap((w) => w.days)
    const before = (date: string) => days[days.findIndex((d) => d.date === date) - 1]
    const accent = days.find((d) => d.workout && ['quality_intervals', 'quality_continuous'].includes(d.workout.kind) && before(d.date)?.workout?.kind === 'long')!
    const long = days.find((d) => d.workout?.kind === 'long' && ['test', 'race'].includes(before(d.date)?.workout?.kind ?? ''))!
    const afterLong = cmdWhy(dir, { date: accent.date })
    expect(afterLong.output).toContain(lang === 'pl' ? 'Akcent wypada dzień po długim' : 'This accent comes the day after the long run')
    expect((afterLong.data as { evidence: { id: string }[] }).evidence.map((e) => e.id)).toContain('S-9b')
    const afterTest = cmdWhy(dir, { date: long.date })
    expect(afterTest.output).toContain(lang === 'pl' ? 'Długie wypada dzień po starcie albo sprawdzianie' : 'This long run comes the day after a race or time trial')
    expect((afterTest.data as { evidence: { id: string }[] }).evidence.map((e) => e.id)).toContain('T-11')
  })

  it('rules: reguły z pomiarów etapu 1 i silnika etapu 2 mają objaśnienie i pochodzenie', () => {
    for (const id of ['S-9b', 'S-10', 'S-11', 'S-12', 'P-12', 'J-4', 'J-6', 'J-8', 'J-9', 'J-10', 'J-1', 'J-2', 'J-5', 'N-19']) {
      const r = cmdRules({ id })
      expect(r.code, id).toBe(0)
      expect(r.output, id).not.toMatch(/unknown rule|nieznana reguła/i)
    }
  })

  it('plan: szczyt ograniczony przez dni ma ostrzeżenie z liczbami (S-10, E-3)', () => {
    const { output, plan } = planFor(70, 'tue, thu, sat')
    expect(output).toContain(lang === 'pl' ? `przy 3 dniach biegowych tydzień mieści ${plan.peakKmPlanned} km` : `3 running days hold ${plan.peakKmPlanned} km/week`)
  })
})

describe('B8: profil z historii proponuje powrót po przerwie', () => {
  it('trainctl.yaml z historii ma athlete.returning z komentarzem R-11', () => {
    const yaml = inferredConfigYaml({
      recentWeeklyKm: 42, returning: { since: '2026-08-05', previousWeeklyKm: 42 }, daysAvailable: ['tue', 'thu', 'sat'],
      weeklyKm: [], raceCandidates: [], caveats: [], window: { oldest: '2026-04-13', newest: '2026-08-02' }, recentBasis: 'mediana',
    })
    expect((parse(yaml) as { athlete: { returning: unknown } }).athlete.returning).toEqual({ since: '2026-08-05', previousWeeklyKm: 42 })
    expect(yaml).toContain('R-11')
  })
})

describe('B10: linty kształtu w check (ADR-047)', () => {
  beforeEach(() => setLocale('en'))
  it('świeży plan przechodzi; zamienione długie i spokojne (te same sumy) dają ostrzeżenie S-2, J-1, a --strict zawodzi', () => {
    writeFileSync(join(dir, 'trainctl.yaml'), config(45, 'tue, wed, thu, sat, sun'), 'utf-8')
    expect(cmdPlan(dir).code).toBe(0)
    const fresh = cmdCheck(dir, { strict: true })
    expect(fresh.code, fresh.output).toBe(0)
    expect((fresh.data as { shape: unknown[] }).shape).toEqual([])

    const plan = loadPlan(dir)
    const week = plan.weeks.find((w) => w.days.some((d) => d.workout?.kind === 'long') && w.days.some((d) => d.workout?.kind === 'easy'))!
    const long = week.days.find((d) => d.workout?.kind === 'long')!.workout!
    const easy = week.days.find((d) => d.workout?.kind === 'easy')!.workout!
    const [l, e] = [long.distanceKm, easy.distanceKm]
    long.distanceKm = e; long.segments[0]!.distanceKm = e
    easy.distanceKm = l; easy.segments[0]!.distanceKm = l
    writePlan(dir, plan)
    const r = cmdCheck(dir, {})
    expect(r.code).toBe(0)
    expect(r.output).toContain(`week ${week.weekStart}: the long run`)
    expect(r.output).toContain('[S-2, J-1]')
    expect((r.data as { shape: { code: string }[] }).shape.map((i) => i.code)).toContain('longNotLongest')
    expect(cmdCheck(dir, { strict: true }).code).toBe(1)
  })
})

describe('B11: przerwa w trakcie planu', () => {
  beforeEach(() => setLocale('en'))
  const setup = () => {
    writeFileSync(join(dir, 'trainctl.yaml'), config(45, 'tue, wed, thu, sat, sun'), 'utf-8')
    expect(cmdPlan(dir).code).toBe(0)
  }
  /** Sesje przed przerwą wykonane (pełne dane w oknie adapt), przerwa do dziś włącznie. */
  const breakUntilToday = (reason: string) => {
    setup()
    process.env['TRAINCTL_TODAY'] = '2026-11-12'
    for (const d of loadPlan(dir).weeks.flatMap((w) => w.days).filter((x) => x.workout && x.date >= '2026-10-23' && x.date <= '2026-10-28')) {
      expect(cmdLog(dir, { date: d.date, status: 'done' }).code).toBe(0)
    }
    expect(cmdLog(dir, { date: '2026-10-29', to: '2026-11-12', status: 'skipped', reason }).code).toBe(0)
  }

  it('log --to --reason: każdy dzień przerwy dostaje wpis skipped z przyczyną', () => {
    setup()
    const r = cmdLog(dir, { date: '2026-10-26', to: '2026-10-30', status: 'skipped', reason: 'illness' })
    expect(r.code, r.output).toBe(0)
    expect(r.output).toContain('2026-10-26 to 2026-10-30: 5 days skipped, reason: illness')
    const entries = readLog(dir).filter((e) => e.date >= '2026-10-26' && e.date <= '2026-10-30')
    expect(entries).toHaveLength(5)
    for (const e of entries) expect(e).toMatchObject({ status: 'skipped', reason: 'illness' })
  })

  it('log --to: dzień z zapisanym biegiem zostaje, przerwa go nie nadpisuje', () => {
    setup()
    process.env['TRAINCTL_TODAY'] = '2026-10-31'
    const day = loadPlan(dir).weeks.flatMap((w) => w.days).find((x) => x.workout && x.date >= '2026-10-26' && x.date <= '2026-10-30')!
    expect(cmdLog(dir, { date: day.date, status: 'done', km: '8' }).code).toBe(0)
    const r = cmdLog(dir, { date: '2026-10-26', to: '2026-10-30', status: 'skipped', reason: 'travel' })
    expect(r.code, r.output).toBe(0)
    expect(r.output).toContain(`Days with a recorded run (log or sync) stay as they are: ${day.date}`)
    expect(r.output).toContain('4 days skipped')
    expect(latestByDate(readLog(dir)).get(day.date)?.status).toBe('done')
  })

  it('log --to: dzień z biegiem z synchronizacji zostaje, przerwa go nie zeruje', () => {
    setup()
    process.env['TRAINCTL_TODAY'] = '2026-10-31'
    writeSnapshot(dir, { pulledAt: '2026-10-31', activities: [{ externalId: 'run-1', date: '2026-10-27', type: 'Run', distanceKm: 8 }], wellness: [] })
    const r = cmdLog(dir, { date: '2026-10-26', to: '2026-10-30', status: 'skipped', reason: 'illness' })
    expect(r.code, r.output).toBe(0)
    expect(r.output).toContain('Days with a recorded run (log or sync) stay as they are: 2026-10-27')
    expect(readLog(dir).some((e) => e.date === '2026-10-27')).toBe(false)
  })

  it('plan: powrót dopisany do profilu w trakcie planu działa od `since` jak blok powrotu (B8, R-11)', () => {
    setup()
    process.env['TRAINCTL_TODAY'] = '2026-11-17'
    writeFileSync(join(dir, 'trainctl.yaml'), config(45, 'tue, wed, thu, sat, sun').replace('recentWeeklyKm: 45', 'recentWeeklyKm: 45\n  returning: { since: "2026-11-16", previousWeeklyKm: 45 }'), 'utf-8')
    const r = cmdPlan(dir)
    expect(r.code, r.output).toBe(0)
    const week = loadPlan(dir).weeks.find((w) => w.weekStart === '2026-11-16')!
    expect(week.skeleton.targetKm).toBeLessThanOrEqual(Math.round(0.55 * 45))
    expect(week.skeleton.easyOnly).toBe(true)
    expect(r.output).toContain('return after a break')
  })

  it('plan: powrót z profilu po 6 tygodniach nadal obowiązuje — bez skoku przyszłych tygodni (P-3)', () => {
    setup()
    const original = loadPlan(dir)
    process.env['TRAINCTL_TODAY'] = '2027-01-05'
    writeFileSync(join(dir, 'trainctl.yaml'), config(45, 'tue, wed, thu, sat, sun').replace('recentWeeklyKm: 45', 'recentWeeklyKm: 45\n  returning: { since: "2026-11-16", previousWeeklyKm: 45 }'), 'utf-8')
    expect(cmdPlan(dir).code).toBe(0)
    const after = loadPlan(dir).weeks.find((w) => w.weekStart === '2027-01-11')!
    expect(after.skeleton.targetKm).toBeLessThan(original.weeks.find((w) => w.weekStart === '2027-01-11')!.skeleton.targetKm)
  })

  it('przerwa jako zakres: dzień odpoczynku z wpisem „skipped” to nadal odpoczynek, nie opuszczona sesja', () => {
    setup()
    process.env['TRAINCTL_TODAY'] = '2026-11-01'
    expect(cmdLog(dir, { date: '2026-10-26', to: '2026-11-01', status: 'skipped', reason: 'travel' }).code).toBe(0)
    const plan = loadPlan(dir)
    const days = plan.weeks.find((w) => w.weekStart === '2026-10-26')!.days
    const execution = buildExecution(plan, [], readLog(dir), '2026-11-01').filter((e) => e.date >= '2026-10-26')
    for (const d of days) expect(execution.find((e) => e.date === d.date)?.status, d.date).toBe(d.workout ? 'missed' : 'rest')
    expect(days.some((d) => !d.workout)).toBe(true)
  })

  it('log: przyczyna i zakres tylko przy opuszczeniu; zła przyczyna, odwrócony i za długi zakres', () => {
    setup()
    expect(cmdLog(dir, { date: '2026-10-26', reason: 'illness' }).output).toContain('skipped sessions only')
    expect(cmdLog(dir, { date: '2026-10-26', status: 'skipped', reason: 'flu' }).output).toContain('Unknown reason "flu"')
    expect(cmdLog(dir, { date: '2026-10-30', to: '2026-10-26', status: 'skipped' }).output).toContain('ends before it starts')
    expect(cmdLog(dir, { date: '2026-10-26', to: '2027-01-26', status: 'skipped' }).output).toContain('more than 60 days')
    expect(readLog(dir)).toHaveLength(0)
  })

  it('adapt po chorobie: blok powrotu do przyjęcia, plan po --apply odtwarza go regeneracja', () => {
    breakUntilToday('illness')
    const prepared = cmdAdapt(dir, { prepare: true })
    expect(prepared.code, prepared.output).toBe(0)
    const id = (prepared.data as { prepared: { id: string } }).prepared.id
    expect(cmdAdapt(dir, { apply: id }).code).toBe(0)
    const plan = loadPlan(dir)
    expect(plan.returnState).toMatchObject({ since: '2026-11-13', illness: true })
    // tydzień powrotu: wyłącznie spokojnie (R-5), dni przed powrotem bez zmian
    const week = plan.weeks.find((w) => w.weekStart === '2026-11-09')!
    expect(week.skeleton.easyOnly).toBe(true)
    expect(week.days.filter((d) => d.date >= '2026-11-13').some((d) => d.workout && d.workout.kind !== 'easy' && d.workout.kind !== 'long')).toBe(false)
    // regeneracja z tym samym profilem: plan aktualny, decyzja zostaje
    const again = cmdPlan(dir)
    expect(again.code).toBe(0)
    expect(again.data).toMatchObject({ regeneration: { upToDate: true } })
    expect(loadPlan(dir).returnState).toEqual(plan.returnState)
  })

  it('adapt: poprawiona przyczyna przerwy zastępuje wcześniejszą (najnowszy wpis dnia)', () => {
    breakUntilToday('injury')
    // to jednak nie była kontuzja: te same dni jeszcze raz, bez przyczyny
    expect(cmdLog(dir, { date: '2026-10-29', to: '2026-11-12', status: 'skipped' }).code).toBe(0)
    expect(restartOf(cmdAdapt(dir, {}))?.returnBlock?.illness).toBe(false)
  })

  it('adapt po kontuzji: bez propozycji objętości (R-6, R-7)', () => {
    breakUntilToday('injury')
    const r = cmdAdapt(dir, {})
    expect(r.output).toContain('R-6, R-7')
    expect((r.data as { proposal: { actions: { type: string }[] } }).proposal.actions.some((a) => a.type === 'conservative-restart')).toBe(false)
  })

  it('adapt --prepare po kontuzji: bez zmiany planu, także gdy nowy wynik daje rekalibrację (R-6, R-7)', () => {
    breakUntilToday('injury')
    writeFileSync(join(dir, 'trainctl.yaml'), config(45, 'tue, wed, thu, sat, sun').replace(
      '    - { date: "2026-09-27", distanceKm: 10, timeSec: 2580 }',
      '    - { date: "2026-09-27", distanceKm: 10, timeSec: 2580 }\n    - { date: "2026-10-25", distanceKm: 10, timeSec: 2500 }'), 'utf-8')
    // przypadek ma sens tylko wtedy, gdy analiza ma akcję, którą dałoby się przygotować
    const analysis = cmdAdapt(dir, {}).data as { proposal: { actions: { type: string }[]; layoff?: { reason?: string } } }
    expect(analysis.proposal.actions.map((a) => a.type)).toContain('recalibrate-zones')
    expect(analysis.proposal.layoff?.reason).toBe('injury')
    const r = cmdAdapt(dir, { prepare: true })
    expect(r.code).toBe(1)
    expect(r.output).toContain('individual decision')
  })

  type Restart = { type: string; returnBlock?: { previousWeeklyKm: number; illness: boolean } }
  const restartOf = (r: ReturnType<typeof cmdAdapt>) => (r.data as { proposal: { actions: Restart[] } }).proposal.actions.find((a) => a.type === 'conservative-restart')

  it('adapt: powrót w tygodniu odciążenia liczy się od tygodnia ładowania z ostatnim biegiem, nie od odciążenia', () => {
    breakUntilToday('illness')
    const weeks = loadPlan(dir).weeks
    const current = weeks.find((w) => w.weekStart === '2026-11-09')!
    // ostatni bieg 2026-10-28: tydzień 2026-10-26
    const loading = weeks.find((w) => w.weekStart === '2026-10-26')!
    // przypadek ma sens tylko wtedy, gdy dziś wypada w odciążeniu
    expect(current.skeleton.deload).toBe(true)
    expect(loading.skeleton.deload).toBe(false)
    expect(restartOf(cmdAdapt(dir, {}))?.returnBlock).toEqual({ previousWeeklyKm: plannedWeekKm(loading.skeleton), illness: true })
  })

  it('plan po przerwie: start kontrolny w spokojnym bloku zostaje, a plan o nim mówi (R-11)', () => {
    writeFileSync(join(dir, 'trainctl.yaml'), config(12, 'tue, wed, thu, sat, sun').replace('recentWeeklyKm: 12',
      'recentWeeklyKm: 12\n  returning: { since: "2026-10-19", previousWeeklyKm: 45 }\n  tuneUpRaces:\n    - { date: "2026-11-01", distanceKm: 10 }'), 'utf-8')
    const r = cmdPlan(dir)
    expect(r.code, r.output).toBe(0)
    const plan = loadPlan(dir)
    expect(plan.feasibilityWarnings).toContain('The tune-up race on 2026-11-01 falls in the easy block of your return (R-11): run it easy or skip it.')
    expect(r.output).toContain('2026-11-01 falls in the easy block')
    expect(plan.weeks.flatMap((w) => w.days).find((d) => d.date === '2026-11-01')?.workout?.kind).toBe('race')
    // po starcie kontrolnym regeneracja już o nim nie mówi
    process.env['TRAINCTL_TODAY'] = '2026-11-05'
    const again = cmdPlan(dir)
    expect(again.code).toBe(0)
    expect(again.output).not.toContain('2026-11-01 falls in the easy block')
  })

  it('adapt w tygodniu odciążenia: podniesienie bazy liczy się od poziomu bloku, nie od odciążenia (B3)', () => {
    setup()
    process.env['TRAINCTL_TODAY'] = '2026-11-12'
    // cały okres analizy wykonany z nadwyżką 30%
    for (const d of loadPlan(dir).weeks.flatMap((w) => w.days).filter((x) => x.workout && x.date >= '2026-10-23' && x.date <= '2026-11-12')) {
      expect(cmdLog(dir, { date: d.date, status: 'done', km: String(Math.round(d.workout!.distanceKm * 13) / 10) }).code).toBe(0)
    }
    const plan = loadPlan(dir)
    expect(plan.weeks.find((w) => w.weekStart === '2026-11-09')!.skeleton.deload).toBe(true)
    const raise = (cmdAdapt(dir, {}).data as { proposal: { actions: { type: string; suggestedWeeklyKm?: number }[] } }).proposal.actions.find((a) => a.type === 'raise-baseline')
    expect(raise?.suggestedWeeklyKm).toBe(Math.round(1.1 * blockLevelOf(plan.weeks, '2026-11-09')!))
  })

  it('adapt drugi raz po przyjętym powrocie: objętość sprzed przerwy ta sama, redukcja się nie składa', () => {
    setup()
    process.env['TRAINCTL_TODAY'] = '2026-11-19'
    // pełne dane w oknie adapt: biegi do 2026-11-06, potem choroba do dziś (tydzień 2026-11-16 to tydzień ładowania)
    for (const d of loadPlan(dir).weeks.flatMap((w) => w.days).filter((x) => x.workout && x.date >= '2026-10-30' && x.date <= '2026-11-06')) {
      expect(cmdLog(dir, { date: d.date, status: 'done' }).code).toBe(0)
    }
    expect(cmdLog(dir, { date: '2026-11-07', to: '2026-11-19', status: 'skipped', reason: 'illness' }).code).toBe(0)
    const weeks = loadPlan(dir).weeks
    const lastRunWeek = weeks.find((w) => w.weekStart === '2026-11-02')!.skeleton
    const current = weeks.find((w) => w.weekStart === '2026-11-16')!.skeleton
    expect(current.deload).toBe(false)
    expect(plannedWeekKm(current)).not.toBe(plannedWeekKm(lastRunWeek))
    const first = restartOf(cmdAdapt(dir, {}))!.returnBlock!
    // objętość sprzed przerwy: tydzień ostatniego biegu, nie cel planu z czasu przerwy
    expect(first.previousWeeklyKm).toBe(plannedWeekKm(lastRunWeek))
    const prepared = cmdAdapt(dir, { prepare: true })
    expect(cmdAdapt(dir, { apply: (prepared.data as { prepared: { id: string } }).prepared.id }).code).toBe(0)
    // dwa dni później nadal bez biegania: nowa analiza liczy od tej samej objętości
    process.env['TRAINCTL_TODAY'] = '2026-11-21'
    expect(cmdLog(dir, { date: '2026-11-20', to: '2026-11-21', status: 'skipped', reason: 'illness' }).code).toBe(0)
    expect(restartOf(cmdAdapt(dir, {}))?.returnBlock).toEqual(first)
  })

  const restartAnalysis = (illness: boolean): AdaptationProposal => ({
    dataStatus: 'complete', unknownSessions: 0, windowDays: 21, complianceKm: 0, missedSessions: 0, diagnosis: [], warnings: [],
    actions: [{ type: 'conservative-restart', detail: 'restart', suggestedWeeklyKm: 25, ruleRefs: ['R-5', 'P-3'], returnBlock: { previousWeeklyKm: 45, illness } }],
  })

  it('plan w dniu przyjęcia powrotu: dzisiejsza sesja zostaje, plan aktualny (ADR-033)', () => {
    setup()
    // dzień z sesją w środku tygodnia ładowania: blok powrotu od jutra obniża ten tydzień
    const week = loadPlan(dir).weeks.find((w) => w.weekStart >= '2026-11-16' && !w.skeleton.deload)!
    const today = week.days.find((d, i) => i >= 1 && i <= 4 && d.workout)!
    process.env['TRAINCTL_TODAY'] = today.date
    applyProposal(dir, prepareProposal(dir, today.date, restartAnalysis(true)).id)
    const r = cmdPlan(dir)
    expect(r.code, r.output).toBe(0)
    expect(r.data).toMatchObject({ regeneration: { upToDate: true } })
    expect(loadPlan(dir).weeks.flatMap((w) => w.days).find((d) => d.date === today.date)).toEqual(today)
  })

  it('nowa baza w trakcie przyjętego powrotu zastępuje powrót, a plan po --apply jest aktualny (ADR-033)', () => {
    setup()
    process.env['TRAINCTL_TODAY'] = '2026-11-12'
    applyProposal(dir, prepareProposal(dir, '2026-11-12', restartAnalysis(false)).id)
    expect(loadPlan(dir).returnState).toBeDefined()
    const reduction: AdaptationProposal = { ...restartAnalysis(false), actions: [{ type: 'reduce-volume', detail: 'reduce', suggestedWeeklyKm: 30, ruleRefs: [] }] }
    applyProposal(dir, prepareProposal(dir, '2026-11-12', reduction).id)
    expect(loadPlan(dir).returnState).toBeUndefined()
    expect(cmdPlan(dir).data).toMatchObject({ regeneration: { upToDate: true } })
  })

  it('plan po powrocie: data, od której start jest osiągalny, liczy się od powrotu, choć profil ma objętość sprzed przerwy', () => {
    writeFileSync(join(dir, 'trainctl.yaml'), config(50, 'tue, wed, thu, sat, sun'), 'utf-8')
    // powrót siedem tygodni przed startem z 45 km: krzywa nie dojdzie do 42 km
    const cfg = loadConfig(dir)
    const plan = computePlan(cfg, '2027-02-08', '2027-02-08', { returnFrom: { since: '2027-02-08', previousWeeklyKm: 45, illness: false } })
    expect(plan.feasibilityWarnings.join(' ')).toMatch(/stays below the thresholds/)
    // data liczona od tego samego startu co blok powrotu (55% objętości sprzed przerwy)
    const expected = earliestFeasibleRaceDate({ ...cfg.athlete, recentWeeklyKm: Math.round(0.55 * 45), returning: { since: '2027-02-08', previousWeeklyKm: 45 } }, cfg.goal, '2027-02-08')!
    expect(plan.feasibilityWarnings.join(' ')).toContain(`a race on or after ${expected}`)
  })

  it('plan po przerwie pod koniec przygotowań: szczyt i werdykt od powrotu, nie z tygodni sprzed przerwy', () => {
    writeFileSync(join(dir, 'trainctl.yaml'), config(45, 'tue, wed, thu, sat, sun'), 'utf-8')
    const cfg = loadConfig(dir)
    expect(computePlan(cfg, '2026-10-22').peakKmPlanned).toBeGreaterThanOrEqual(42)
    const plan = computePlan(cfg, '2026-10-22', '2026-10-22', { returnFrom: { since: '2027-02-22', previousWeeklyKm: 45, illness: false } })
    const verdict = plan.feasibilityWarnings.find((w) => /stays below the thresholds/.test(w))
    expect(verdict).toBeDefined()
    expect(Number(verdict!.match(/after the return it peaks at ([\d.]+) km\/week/)![1])).toBeLessThan(42)
    // najdłuższe wybieganie też od powrotu, nie 22 km sprzed przerwy
    expect(Number(verdict!.match(/its longest run is ([\d.]+) km/)![1])).toBeLessThan(21)
    // szczyt planu w pliku to cały cykl — tak samo jak po regeneracji i propozycji
    expect(plan.peakKmPlanned).toBe(Math.max(...cycleWeeksOf(plan).map((w) => w.totalKm)))
  })

  it('plan po powrocie z budżetem czasu: werdykt mówi o profilu, a nie o budżecie (E-2)', () => {
    writeFileSync(join(dir, 'trainctl.yaml'), config(45, 'tue, wed, thu, sat, sun') + 'time:\n  weeklyMinutes: 240\n', 'utf-8')
    const cfg = loadConfig(dir)
    // powrót od razu: krzywa z 50 km dogania plan przed startem, a budżet trzyma szczyt niżej
    const plan = computePlan(cfg, '2026-10-22', '2026-10-22', { returnFrom: { since: '2026-10-22', previousWeeklyKm: 50, illness: false } })
    expect(plan.peakKmPlanned).toBeLessThan(plan.peakKmRecommended)
    expect(plan.feasibilityWarnings.some((w) => /time budget (caps|holds) the plan/.test(w))).toBe(true)
    expect(plan.feasibilityWarnings.join(' ')).not.toMatch(/stays below the thresholds/)
  })

  it('adapt: przyczyna wcześniejszej przerwy, po której biegacz biegał, nie blokuje propozycji powrotu', () => {
    setup()
    process.env['TRAINCTL_TODAY'] = '2026-11-12'
    const days = loadPlan(dir).weeks.flatMap((w) => w.days).filter((x) => x.workout && x.date >= '2026-10-23' && x.date <= '2026-10-28')
    // jeden dzień opuszczony z powodu kontuzji, potem dalej bieganie, potem przerwa bez przyczyny
    expect(cmdLog(dir, { date: days[0]!.date, status: 'skipped', reason: 'injury' }).code).toBe(0)
    for (const d of days.slice(1)) expect(cmdLog(dir, { date: d.date, status: 'done' }).code).toBe(0)
    expect(cmdLog(dir, { date: '2026-10-29', to: '2026-11-12', status: 'skipped' }).code).toBe(0)
    const restart = restartOf(cmdAdapt(dir, {}))
    expect(restart?.returnBlock?.illness).toBe(false)
  })
})

describe('B1: tydzień mieszany (regeneracja, propozycja)', () => {
  beforeEach(() => setLocale('en'))

  it('settleMixedWeek: to, co dni mieszczą (layoutKm), to suma dni po złożeniu — bez fałszywego targetKmMismatch', () => {
    writeFileSync(join(dir, 'trainctl.yaml'), config(45, 'tue, wed, thu, sat, sun'), 'utf-8')
    const plan = computePlan(loadConfig(dir), '2026-10-22')
    const week = structuredClone(plan.weeks[2]!)
    week.skeleton = { ...week.skeleton, layoutKm: week.skeleton.targetKm - 4 }
    // dzień zachowany ze starego planu, o kilometr dłuższy niż w nowym układzie
    week.days.find((d) => d.workout)!.workout!.distanceKm += 1
    settleMixedWeek(week)
    expect(week.skeleton.layoutKm).toBe(week.totalKm)
  })

  it('mergeWeekNotes: uwaga dnia z planu, z którego pochodzi dzień; uwaga tygodnia z nowego', () => {
    const old: WeekNote[] = [{ code: 'accentAsStrides', date: '2026-11-03' }, { code: 'hillsDropped', date: '2026-11-05' }]
    const fresh: WeekNote[] = [{ code: 'hillsDropped', date: '2026-11-03' }, { code: 'volumeShort', targetKm: 40, plannedKm: 36 }]
    expect(mergeWeekNotes(old, fresh, new Set(['2026-11-05']))).toEqual([
      { code: 'volumeShort', targetKm: 40, plannedKm: 36 },
      { code: 'accentAsStrides', date: '2026-11-03' },
    ])
  })

  it('regeneracja: dzień zachowany ze starego planu zachowuje swoją uwagę w `why`', () => {
    writeFileSync(join(dir, 'trainctl.yaml'), config(12, 'tue, wed, thu, sat, sun'), 'utf-8')
    expect(cmdPlan(dir).code).toBe(0)
    const before = loadPlan(dir)
    const week = before.weeks.find((w) => w.weekStart > '2026-10-26' && (w.notes ?? []).some((n) => n.code === 'accentAsStrides'))!
    const note = week.notes!.find((n) => n.code === 'accentAsStrides') as { code: 'accentAsStrides'; date: string }
    process.env['TRAINCTL_TODAY'] = note.date
    expect(cmdLog(dir, { date: note.date, status: 'done' }).code).toBe(0)
    // nowy profil: przy 30 km ten dzień byłby akcentem, a nie przebieżkami
    writeFileSync(join(dir, 'trainctl.yaml'), config(30, 'tue, wed, thu, sat, sun'), 'utf-8')
    const fresh = computePlan(loadConfig(dir), before.generatedAt)
    expect((fresh.weeks.find((w) => w.weekStart === week.weekStart)!.notes ?? []).some((n) => 'date' in n && n.date === note.date)).toBe(false)
    expect(cmdPlan(dir).code).toBe(0)
    const after = loadPlan(dir).weeks.find((w) => w.weekStart === week.weekStart)!
    expect(after.notes).toContainEqual(note)
    expect(cmdWhy(dir, { date: note.date }).output).toContain('This accent is an easy run with strides')
  })
})

describe('B7: budżet czasu na brzegach (E-2)', () => {
  beforeEach(() => setLocale('en'))
  const budgetText = /time budget (caps|holds) the plan/

  it('blok powrotu poniżej sufitu budżetu nie jest ostrzeżeniem budżetu', () => {
    writeFileSync(join(dir, 'trainctl.yaml'), config(45, 'tue, wed, thu, sat, sun') + 'time:\n  weeklyMinutes: 240\n', 'utf-8')
    const cfg = loadConfig(dir)
    // przypadek ma sens tylko wtedy, gdy budżet sam obniża ten plan
    expect(computePlan(cfg, '2027-01-04').feasibilityWarnings.some((w) => budgetText.test(w))).toBe(true)
    const back = computePlan(cfg, '2027-01-04', '2027-01-04', { returnFrom: { since: '2027-01-04', previousWeeklyKm: 12, illness: false } })
    expect(back.weeks.filter((w) => w.skeleton.uncappedKm !== undefined)).toEqual([])
    expect(back.feasibilityWarnings.some((w) => budgetText.test(w))).toBe(false)
  })

  it('budżet, w którym nie mieści się żaden kilometr, nie zeruje planu: tygodnie ponad budżetem z ostrzeżeniem', () => {
    writeFileSync(join(dir, 'trainctl.yaml'), config(30, 'tue, thu, sat, sun') + 'time:\n  weeklyMinutes: 60\nstrength:\n  enabled: true\n', 'utf-8')
    const plan = computePlan(loadConfig(dir), '2026-11-11')
    const loading = plan.weeks.filter((w) => ['base', 'build', 'peak'].includes(w.skeleton.phase))
    expect(loading.length).toBeGreaterThan(0)
    expect(loading.filter((w) => w.totalKm === 0)).toEqual([])
    expect(plan.feasibilityWarnings.join(' ')).toContain('over the weekly time budget')
  })
})
