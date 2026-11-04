import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parse, stringify } from 'yaml'
import ICAL from 'ical.js'
import { validateSportsPlan, type SportsConfig, type SportsPlan, type SyncProvider } from 'trainctl-core'
import { cmdCheck, cmdExport, cmdInit, cmdPlan, cmdPush, cmdReplace } from './commands.ts'
import { loadSportsPlan, sportsTemplate } from './sports-store.ts'
import { sessionExternalId } from './sports-sync.ts'

let dir: string
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'trainctl-calendar-')); vi.stubEnv('TRAINCTL_TODAY', '2026-11-02') })
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); rmSync(dir, { recursive: true, force: true, maxRetries: 3 }) })
const read = (file: string): string => readFileSync(join(dir, file), 'utf8')
function init(sports = 'bike') {
  const config = parse(sportsTemplate(sports, '2026-11-02')) as SportsConfig
  config.athlete.sports.bike!.ftpWatts = 220
  expect(cmdInit(dir, stringify(config)).code).toBe(0)
  regenerate()
  return loadSportsPlan(dir)
}
function configure(change: (config: SportsConfig) => void) {
  const config = parse(read('trainctl.yaml')) as SportsConfig
  change(config); writeFileSync(join(dir, 'trainctl.yaml'), stringify(config))
}
function regenerate(): SportsPlan {
  const result = cmdPlan(dir); expect(result.code, result.output).toBe(0)
  return loadSportsPlan(dir)
}
function calendar(opts: { sport?: string } = {}): Map<string, string> {
  const result = cmdExport(dir, { what: 'ics', ...opts }); expect(result.code, result.output).toBe(0)
  const components = new ICAL.Component(ICAL.parse(read('export/plan.ics'))).getAllSubcomponents('vevent')
  const events = components.map(component => [new ICAL.Event(component).uid, component.toString().replace(/\r\n /g, '')] as const)
  expect(new Set(events.map(([id]) => id)).size).toBe(events.length)
  return new Map(events)
}
const sequence = (event: string): number => Number(event.match(/^SEQUENCE:(\d+)/m)![1])
const uid = (plan: SportsPlan, id: string): string => `${sessionExternalId(plan, { id } as SportsPlan['sessions'][number])}@trainctl`

describe('calendar revisions and generated-session lifecycle', () => {
  it('withdraws and reactivates generated sessions under the same IDs, with newer calendar revisions and remote cleanup', async () => {
    const initial = init(), original = calendar()
    const remote = new Map(initial.sessions.map(s => [s.id, { id: s.id, date: s.date, externalId: sessionExternalId(initial, s) }]))
    remote.set('foreign', { id: 'foreign', date: initial.sessions[0]!.date, externalId: 'trainctl-another-plan' })
    const deleted: string[] = []
    const provider: SyncProvider = {
      name: 'fake', verify: async () => ({ athleteId: 'a' }), listActivities: async () => [], listWellness: async () => [],
      pushWorkouts: async workouts => {
        for (const w of workouts) remote.set(w.externalId.replace(`trainctl-${initial.id}-`, ''), { id: w.externalId.replace(`trainctl-${initial.id}-`, ''), date: w.date, externalId: w.externalId })
        return { pushed: workouts.length, externalIds: workouts.map(w => w.externalId) }
      },
      listPlannedWorkouts: async () => [...remote.values()],
      deleteWorkout: async id => { deleted.push(id); remote.delete(id) },
    }
    configure(c => { c.athlete.sports.bike!.sessionsPerWeek = 1 })
    const reduced = regenerate(), cancelled = calendar()
    const withdrawn = initial.sessions.filter(s => !reduced.sessions.some(x => x.id === s.id))
    expect(withdrawn.length).toBeGreaterThan(0)
    expect(reduced.archive.map(s => s.id).sort()).toEqual(withdrawn.map(s => s.id).sort())
    expect(reduced.retiredSessionIds!.sort()).toEqual(withdrawn.map(s => s.id).sort())
    for (const s of withdrawn) {
      const event = cancelled.get(uid(initial, s.id))!
      expect(event).toContain('STATUS:CANCELLED')
      expect(sequence(event)).toBeGreaterThan(sequence(original.get(uid(initial, s.id))!))
    }
    expect((await cmdPush(dir, { from: '2026-11-02', to: initial.goal.date }, () => provider)).code).toBe(0)
    expect(deleted.sort()).toEqual(withdrawn.map(s => s.id).sort()); expect(remote.has('foreign')).toBe(true)
    expect(cmdPlan(dir).data!.changed).toBe(false)
    configure(c => { c.athlete.sports.bike!.sessionsPerWeek = 2 })
    const restored = regenerate(), active = calendar()
    expect(restored.sessions.map(s => s.id).sort()).toEqual(initial.sessions.map(s => s.id).sort())
    expect(restored.archive).toEqual([]); expect(restored.retiredSessionIds).toEqual([])
    for (const s of withdrawn) {
      const event = active.get(uid(initial, s.id))!
      expect(event).not.toContain('STATUS:CANCELLED')
      expect(sequence(event)).toBeGreaterThan(sequence(cancelled.get(uid(initial, s.id))!))
    }
    expect((await cmdPush(dir, { from: '2026-11-02', to: initial.goal.date }, () => provider)).code).toBe(0)
    expect(remote.size).toBe(initial.sessions.length + 1)
    expect(cmdCheck(dir).code).toBe(0)
  })

  it('updates only changed events after calibration or manual edits and repeats byte-identically', () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-02T10:00:00Z'))
    const initial = init('bike,swim'), first = calendar(), bytes = read('export/plan.ics'), state = read('plan/calendar.json')
    vi.setSystemTime(new Date('2026-11-02T11:00:00Z'))
    calendar(); expect(read('export/plan.ics')).toBe(bytes); expect(read('plan/calendar.json')).toBe(state)
    configure(c => { c.athlete.sports.bike!.ftpWatts = 300 })
    const calibrated = regenerate(), second = calendar()
    expect(calibrated.changes).toEqual(initial.changes)
    for (const s of initial.sessions) {
      const before = first.get(uid(initial, s.id))!, after = second.get(uid(initial, s.id))!
      if (s.sport === 'bike') {
        expect(sequence(after)).toBe(sequence(before) + 1)
        expect(after).toContain('DTSTAMP:20261102T110000Z'); expect(after).toContain('LAST-MODIFIED:20261102T110000Z')
      } else expect(after).toBe(before)
    }
    const session = calibrated.sessions.find(s => s.sport === 'bike')!
    session.preparationSec += 60
    session.start = '18:00'
    writeFileSync(join(dir, 'plan/plan.yaml'), stringify(calibrated))
    const manual = calendar()
    expect(sequence(manual.get(uid(initial, session.id))!)).toBe(sequence(second.get(uid(initial, session.id))!) + 1)
    expect(manual.get(uid(initial, session.id))).toContain('T180000')
    const final = read('export/plan.ics')
    rmSync(join(dir, 'export/plan.ics'))
    calendar(); expect(read('export/plan.ics')).toBe(final)
  })

  it('keeps revisions of omitted sports during filtered export', () => {
    init('bike,swim'); calendar()
    const before = read('plan/calendar.json')
    calendar({ sport: 'bike' })
    expect(read('plan/calendar.json')).toBe(before)
    const state = JSON.parse(before)
    configure(c => { c.athlete.sports.bike!.ftpWatts = 300 }); regenerate()
    calendar({ sport: 'swim' }); expect(read('plan/calendar.json')).toBe(before)
    calendar()
    const updated = JSON.parse(read('plan/calendar.json'))
    expect(Object.keys(updated.events)).toEqual(Object.keys(state.events))
    expect(Object.values(updated.events).some((event: any) => event.sequence > 2)).toBe(true)
  })

  it('reactivates withdrawn sessions after removing and re-adding an unprotected sport', () => {
    const initial = init('bike,swim')
    const bike = (parse(read('trainctl.yaml')) as SportsConfig).athlete.sports.bike!
    configure(c => { delete c.athlete.sports.bike })
    const removed = regenerate()
    expect(removed.sessions.every(s => s.sport === 'swim')).toBe(true)
    expect(removed.archive.map(s => s.id).sort()).toEqual(initial.sessions.filter(s => s.sport === 'bike').map(s => s.id).sort())
    configure(c => { c.athlete.sports.bike = bike })
    const restored = regenerate()
    expect(restored.sessions.map(s => s.id).sort()).toEqual(initial.sessions.map(s => s.id).sort())
    expect(restored.archive).toEqual([])
  })

  it('accepts valid session IDs that coincide with JavaScript property names', () => {
    const plan = init(), session = plan.sessions[0]!
    session.id = 'constructor'
    writeFileSync(join(dir, 'plan/plan.yaml'), stringify(plan))
    const exported = calendar()
    expect(sequence(exported.get(uid(plan, session.id))!)).toBe(2)
    const bytes = read('export/plan.ics'); calendar(); expect(read('export/plan.ics')).toBe(bytes)
  })

  it.each(['invalid JSON', 'future schema', 'negative sequence', 'invalid date', 'sequence overflow'])('refuses %s without overwriting the previous calendar', problem => {
    init(); calendar()
    const before = read('export/plan.ics'), state = JSON.parse(read('plan/calendar.json')), event = Object.values(state.events)[0] as any
    if (problem === 'future schema') state.schemaVersion = 2
    if (problem === 'negative sequence') event.sequence = -1
    if (problem === 'invalid date') event.updatedAt = 'not-a-date'
    if (problem === 'sequence overflow') { event.sequence = 2147483647; configure(c => { c.athlete.sports.bike!.ftpWatts = 300 }); regenerate() }
    const invalid = problem === 'invalid JSON' ? '{bad' : JSON.stringify(state)
    writeFileSync(join(dir, 'plan/calendar.json'), invalid)
    const result = cmdExport(dir, { what: 'ics' })
    expect(result.code, result.output).toBe(1); expect(result.output).toContain('plan/calendar.json')
    expect(read('export/plan.ics')).toBe(before); expect(read('plan/calendar.json')).toBe(invalid)
  })

  it('never reactivates replaced originals when frequency is reduced and restored', () => {
    const initial = init('bike,swim'), source = initial.sessions.find(s => s.sport === 'bike')!
    const prepare = cmdReplace(dir, { session: source.id, toSport: 'swim' })
    expect(prepare.code, prepare.output).toBe(0)
    expect(cmdReplace(dir, { apply: (prepare.data!.proposal as { id: string }).id }).code).toBe(0)
    configure(c => { c.athlete.sports.bike!.sessionsPerWeek = 1 }); regenerate()
    configure(c => { c.athlete.sports.bike!.sessionsPerWeek = 2 }); const restored = regenerate()
    expect(restored.sessions.some(s => s.id === source.id)).toBe(false)
    expect(restored.sessions.some(s => s.replacesSessionId === source.id)).toBe(true)
    expect(restored.archive.map(s => s.id)).toEqual([source.id])
    restored.retiredSessionIds = [source.id]
    expect(validateSportsPlan(restored)).not.toEqual([])
  })
})
