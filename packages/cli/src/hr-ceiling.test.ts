/**
 * PLAN-v0.7 C8: tętno jako druga miara celu. Bieg spokojny i długi dostaje pułap
 * na LT1 z Z-2 według płci; tempo zostaje celem (Z-3). Bez płci pułapu nie ma
 * (N-13), szacowany HRmax daje jedno ostrzeżenie na widok (Z-5), akcenty zostają
 * przy tempie, a `review` i `adapt` tętna nie oceniają (D3).
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { inferProfile, setLocale, type SyncedActivity } from 'trainctl-core'
import { toPushableWorkout } from 'trainctl-sync-intervalsicu'
import { cmdAdapt, cmdLog, cmdPlan, cmdReview, cmdToday, cmdWeek, cmdWhy } from './commands.ts'
import { inferredConfigYaml, loadConfig } from './config.ts'
import { loadPlan } from './planfile.ts'
import { parseHrMaxInput, parseSexInput, toYaml } from './ui/wizard.ts'

const profile = (athlete = '') => `athlete:
${athlete}  recentWeeklyKm: 45
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
const today = process.env['TRAINCTL_TODAY']
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'trainctl-hr-'))
  process.env['TRAINCTL_TODAY'] = '2026-10-22'
  setLocale('pl')
})
afterEach(() => {
  rmSync(dir, { recursive: true, force: true, maxRetries: 3 })
  if (today === undefined) delete process.env['TRAINCTL_TODAY']
  else process.env['TRAINCTL_TODAY'] = today
})

function plan(athlete: string): ReturnType<typeof loadPlan> {
  writeFileSync(join(dir, 'trainctl.yaml'), profile(athlete), 'utf-8')
  const r = cmdPlan(dir)
  expect(r.code, r.output).toBe(0)
  return loadPlan(dir)
}

const longDay = (p: ReturnType<typeof loadPlan>) => p.weeks.flatMap((w) => w.days).find((d) => d.workout?.kind === 'long' && d.date >= '2026-10-26')!
const accentDay = (p: ReturnType<typeof loadPlan>) => p.weeks.flatMap((w) => w.days).find((d) => d.workout?.kind === 'quality_intervals' && d.date >= '2026-10-26')!

describe('C8: profil', () => {
  it('waliduje athlete.hrMax i athlete.sex', () => {
    writeFileSync(join(dir, 'trainctl.yaml'), profile('  sex: kobieta\n  hrMax: { bpm: 300, measured: true }\n'), 'utf-8')
    expect(() => loadConfig(dir)).toThrow(/athlete\.sex[\s\S]*athlete\.hrMax/)
    writeFileSync(join(dir, 'trainctl.yaml'), profile('  hrMax: { bpm: 185 }\n'), 'utf-8')
    expect(() => loadConfig(dir)).toThrow(/athlete\.hrMax: \{ bpm: liczba całkowita 120–230/)
    writeFileSync(join(dir, 'trainctl.yaml'), profile('  sex: female\n  hrMax: { bpm: 185, measured: false }\n'), 'utf-8')
    expect(loadConfig(dir).athlete.hrMax).toEqual({ bpm: 185, measured: false })
  })
})

describe('C8: pułap w planie i widokach', () => {
  it('mężczyzna: 78,9% HRmax przy biegu długim w wierszu, strukturze dnia, why i PLAN.md; akcent bez pułapu', () => {
    const p = plan('  sex: male\n  hrMax: { bpm: 190, measured: true }\n')
    expect(p.hrCeiling).toEqual({ bpm: 149, share: 0.789, sex: 'male', measured: true })
    const long = longDay(p), accent = accentDay(p)
    const week = cmdWeek(dir, { date: long.date })
    const rows = week.data!['rows'] as { date: string; kind: string; line: string }[]
    expect(rows.find((r) => r.date === long.date && r.kind === 'długie')!.line).toMatch(/, tętno ≤149$/)
    const weekOf = cmdWeek(dir, { date: accent.date }).data!['rows'] as { date: string; line: string }[]
    expect(weekOf.find((r) => r.date === accent.date)!.line).not.toContain('tętno')
    expect(week.output).not.toContain('Z-5')

    const day = cmdToday(dir, { date: long.date })
    expect(day.output).toMatch(/^spokojnie \| \d+(,\d+)? km \| \d:\d\d–\d:\d\d, tętno ≤149$/m)
    expect(day.output).toContain('Pułap tętna 149 ud./min: LT1 przy 78,9% HRmax dla twojej płci (Z-2). Celem zostaje tempo (Z-3).')
    expect(cmdToday(dir, { date: accent.date }).output).not.toContain('tętno')

    const why = cmdWhy(dir, { date: long.date }).output
    expect(why).toContain('Pułap tętna 149')
    expect(why).toMatch(/Z-2/)
    const md = readFileSync(join(dir, 'plan', 'PLAN.md'), 'utf-8')
    expect(md).toContain(', tętno ≤149 |')
    expect(md).toContain('> Pułap tętna 149 ud./min')
  })

  it('kobieta: 83,6% HRmax; szacowany HRmax daje jedno ostrzeżenie Z-5 na widok', () => {
    const p = plan('  sex: female\n  hrMax: { bpm: 190, measured: false }\n')
    expect(p.hrCeiling?.bpm).toBe(158)
    const long = longDay(p)
    const week = cmdWeek(dir, { date: long.date })
    expect(week.output.match(/\(Z-5\)/g)).toHaveLength(1)
    expect(cmdToday(dir, { date: long.date }).output.match(/\(Z-5\)/g)).toHaveLength(1)
    expect(readFileSync(join(dir, 'plan', 'PLAN.md'), 'utf-8').match(/\(Z-5\)/g)).toHaveLength(1)
  })

  it('bez płci nie ma pułapu, a why mówi dlaczego (N-13)', () => {
    const p = plan('  hrMax: { bpm: 190, measured: true }\n')
    expect(p.hrCeiling).toBeUndefined()
    const long = longDay(p)
    expect(cmdWeek(dir, { date: long.date }).output).not.toContain('tętno')
    const why = cmdWhy(dir, { date: long.date }).output
    expect(why).toContain('Bez athlete.sex nie ma pułapu tętna')
    expect(why).toMatch(/N-13/)
  })

  it('zmiana HRmax w profilu odświeża plan (regeneracja nie jest „aktualna")', () => {
    plan('  sex: male\n  hrMax: { bpm: 190, measured: true }\n')
    writeFileSync(join(dir, 'trainctl.yaml'), profile('  sex: male\n  hrMax: { bpm: 180, measured: true }\n'), 'utf-8')
    const again = cmdPlan(dir)
    expect(again.output).not.toContain('Plan jest aktualny')
    expect(loadPlan(dir).hrCeiling?.bpm).toBe(142)
  })

  it('review i adapt nie oceniają tętna (D3): to samo wyjście z pułapem i bez', async () => {
    const p = plan('')
    process.env['TRAINCTL_TODAY'] = '2026-11-04'
    for (const d of p.weeks.flatMap((w) => w.days).filter((d) => d.workout && d.date < '2026-11-04' && d.date >= '2026-10-26')) {
      cmdLog(dir, { date: d.date, status: 'done' })
    }
    const outputs = async () => ({ review: (await cmdReview(dir, {})).output, adapt: cmdAdapt(dir, {}).output })
    const without = await outputs()
    writeFileSync(join(dir, 'trainctl.yaml'), profile('  sex: male\n  hrMax: { bpm: 190, measured: false }\n'), 'utf-8')
    expect(cmdPlan(dir).code).toBe(0)
    expect(await outputs()).toEqual(without)
  })
})

describe('C8: eksport do intervals.icu', () => {
  it('pułap w opisie nad krokami biegu spokojnego i długiego; akcent bez niego', () => {
    const p = plan('  sex: male\n  hrMax: { bpm: 190, measured: true }\n')
    const long = toPushableWorkout(longDay(p), 'Half', p.hrCeiling?.bpm)!
    expect(long.description).toMatch(/^Tętno ≤149 ud\.\/min \(Z-2\): pułap biegu spokojnego; celem zostaje tempo\.\n\n- /)
    expect(long.description.split('\n').filter((l) => l.startsWith('- ')).every((l) => /\/km Pace/.test(l))).toBe(true)
    const accent = toPushableWorkout(accentDay(p), 'Half', p.hrCeiling?.bpm)!
    expect(accent.description).not.toContain('Tętno')
  })
})

describe('C8: HRmax z historii i kreator', () => {
  const run = (date: string, maxHr?: number): SyncedActivity => ({ externalId: date, date, type: 'Run', distanceKm: 10, movingTimeSec: 3000, ...(maxHr ? { maxHr } : {}) })

  it('init --from-intervals proponuje najwyższe tętno z okna jako szacunek; artefakt czujnika odrzucony', () => {
    const activities: SyncedActivity[] = []
    for (let week = 0; week < 8; week++) for (const day of [1, 3, 5]) {
      const date = new Date(Date.UTC(2026, 7, 3 + week * 7 + day)).toISOString().slice(0, 10)
      activities.push(run(date, date === '2026-09-03' ? 186 : date === '2026-09-10' ? 251 : 170))
    }
    expect(activities.some((a) => a.date === '2026-09-03') && activities.some((a) => a.date === '2026-09-10')).toBe(true)
    const outcome = inferProfile(activities, '2026-10-01')
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.profile.hrMax).toEqual({ bpm: 186, date: '2026-09-03' })
    const yaml = inferredConfigYaml(outcome.profile)
    expect(yaml).toMatch(/^ {2}hrMax: \{ bpm: 186, measured: false \} +# najwyższe tętno w historii \(2026-09-03\): SZACUNEK \(Z-5\)/m)
    expect(yaml).toMatch(/^ {2}sex: unspecified/m)
  })

  it('kreator: HRmax w granicach, płeć skrótem języka, zapis do trainctl.yaml', () => {
    expect(parseHrMaxInput('188')).toBe(188)
    expect(() => parseHrMaxInput('300')).toThrow('120–230')
    expect(parseSexInput('k')).toBe('female')
    expect(parseSexInput('male')).toBe('male')
    expect(() => parseSexInput('x')).toThrow()
    const yaml = toYaml({ goalName: 'Half', goalDate: '2027-03-28', goalDistanceKm: 21.0975, recentWeeklyKm: 40, daysAvailable: ['tue'], hrMax: { bpm: 188, measured: true }, sex: 'female' })
    expect(yaml).toContain('  sex: female\n  hrMax: { bpm: 188, measured: true }')
  })
})
