/**
 * PLAN-v0.7 C5: bieg z planu biegowego w planie v2 niesie planowany zakres RPE
 * według typu segmentu (MS-6, inż.), tą samą drogą co rower i pływanie. To opis
 * zamiaru: karta go pokazuje, a `adapt`, `review` i ocena intencji zamiany go nie czytają.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parse, stringify } from 'yaml'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { runningEffort, setLocale, trainingIntent, type PlannedSegment, type PlannedWorkout, type SportsPlan } from 'trainctl-core'
import { cmdAdapt, cmdInit, cmdLog, cmdMigrate, cmdPlan, cmdReview, cmdToday, cmdWhy } from './commands.ts'
import { loadSportsPlan } from './sports-store.ts'

const seg = (type: PlannedSegment['type'], over: Partial<PlannedSegment> = {}): PlannedSegment => ({ type, description: '', distanceKm: 3, ...over })
const workout = (kind: PlannedWorkout['kind'], segments: PlannedSegment[]): PlannedWorkout => ({ kind, segments, ruleRefs: [], distanceKm: 8 })
const range = (w: PlannedWorkout) => { const e = runningEffort(w); return [e.min, e.max] }

describe('C5: zakres RPE według najmocniejszego segmentu (MS-6, inż.)', () => {
  it('spokojny i długi 3–4, podbiegi 5–6, narastanie 5–7, zmienny 6–7, odcinki 7–8, start 8–9, sprawdzian 9–10', () => {
    expect(range(workout('easy', [seg('easy')]))).toEqual([3, 4])
    expect(range(workout('long', [seg('easy')]))).toEqual([3, 4])
    expect(range(workout('easy_hills', [seg('easy'), seg('hills'), seg('cooldown')]))).toEqual([5, 6])
    expect(range(workout('quality_continuous', [seg('warmup'), seg('progression'), seg('cooldown')]))).toEqual([5, 7])
    expect(range(workout('quality_continuous', [seg('warmup'), seg('alternating'), seg('cooldown')]))).toEqual([6, 7])
    expect(range(workout('quality_intervals', [seg('warmup'), seg('intervals'), seg('cooldown')]))).toEqual([7, 8])
    expect(range(workout('race', [seg('race')]))).toEqual([8, 9])
    expect(range(workout('test', [seg('warmup'), seg('race'), seg('cooldown')]))).toEqual([9, 10])
  })

  it('słowna wskazówka z tej samej skali co rower i pływanie', () => {
    setLocale('pl')
    expect(runningEffort(workout('easy', [seg('easy')])).cue).toBe('Swobodna rozmowa pełnymi zdaniami.')
    expect(runningEffort(workout('quality_intervals', [seg('intervals')])).cue).toBe('Mocno, ale bez sprintu; pozostaw zapas na ostatni odcinek.')
  })
})

const LEGACY = `athlete:
  recentWeeklyKm: 35
  daysAvailable: [tue, thu, sat, sun]
  longRunDay: sun
  results:
    - { date: '2026-09-01', distanceKm: 10, timeSec: 3000 }
goal:
  kind: base
  name: Base
  date: '2026-12-27'
  distanceKm: 0
  priority: A
`

let dir: string
const today = process.env['TRAINCTL_TODAY']
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'trainctl-effort-'))
  process.env['TRAINCTL_TODAY'] = '2026-11-02'
  setLocale('pl')
})
afterEach(() => {
  rmSync(dir, { recursive: true, force: true, maxRetries: 3 })
  if (today === undefined) delete process.env['TRAINCTL_TODAY']
  else process.env['TRAINCTL_TODAY'] = today
})

function migrated(): SportsPlan {
  expect(cmdInit(dir, LEGACY).code).toBe(0)
  expect(cmdPlan(dir).code).toBe(0)
  const id = (cmdMigrate(dir).data!['proposal'] as { id: string }).id
  expect(cmdMigrate(dir, { apply: id }).code).toBe(0)
  return loadSportsPlan(dir)
}

describe('C5: bieg w planie v2 po migracji', () => {
  it('krok biegu ma zakres RPE, a karta go pokazuje (today --full i why)', () => {
    const plan = migrated()
    const runs = plan.sessions.filter((s) => s.sport === 'run' && s.legacyWorkout)
    expect(runs.length).toBeGreaterThan(0)
    for (const s of runs) expect(s.steps[0]!.effort).toEqual(runningEffort(s.legacyWorkout!))
    const quality = runs.find((s) => s.legacyWorkout!.kind === 'quality_intervals') ?? runs[0]!
    const effort = quality.steps[0]!.effort!
    const card = cmdToday(dir, { session: quality.id })
    expect(card.output).toContain(`Najmocniejszy etap (plan): RPE ${effort.min}–${effort.max}/10`)
    expect(card.output).not.toContain('Nie określono zakresu RPE')
    expect(cmdWhy(dir, { session: quality.id }).output).toContain(`RPE ${effort.min}–${effort.max}/10`)
  })

  it('adapt, review i ocena intencji zamiany nie czytają wskazówki RPE biegu', async () => {
    const plan = migrated()
    const past = plan.sessions.filter((s) => s.sport === 'run' && s.date < '2026-11-16').slice(0, 3)
    process.env['TRAINCTL_TODAY'] = '2026-11-17'
    for (const s of past) expect(cmdLog(dir, { session: s.id, status: 'done', minutes: 45 }).code).toBe(0)
    const ids = (text: string) => text.replace(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/g, 'ID')
    const run = async () => ({ adapt: ids(cmdAdapt(dir, {}).output), review: ids((await cmdReview(dir, {})).output) })
    const withEffort = await run()

    const path = join(dir, 'plan', 'plan.yaml')
    const stored = parse(readFileSync(path, 'utf-8')) as SportsPlan
    for (const s of stored.sessions) if (s.legacyWorkout) for (const step of s.steps) delete step.effort
    writeFileSync(path, stringify(stored), 'utf-8')
    expect(await run()).toEqual(withEffort)

    // ocena intencji (MS-5) dla biegu z planu biegowego jest ta sama z wskazówką i bez niej
    const original = plan.sessions.filter((s) => s.legacyWorkout)
    for (const s of original) {
      const bare = { ...s, steps: s.steps.map(({ effort: _effort, ...step }) => step) }
      expect(trainingIntent(s), s.id).toEqual(trainingIntent(bare))
    }
  })
})
