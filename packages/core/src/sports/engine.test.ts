import { describe, expect, it } from 'vitest'
import { addDays, mondayOf } from '../util/dates.ts'
import { buildSessionExecution, buildSportSession, calendarIssues, calendarMinutes, generateSportsPlan, replaceSportSession, rescheduleSportsPlan, sessionDeskDay, sessionTotals, shortenSportSession, validateSportsConfig, validateSportsPlan } from './engine.ts'
import { ENDURANCE_SPORTS, type SportsConfig, type SportsPlan } from './types.ts'

export const config: SportsConfig = { schemaVersion: 2, athlete: { sports: {
  run: { weeklyMinutes: 90, sessionsPerWeek: 2, easyPaceSecPerKm: 360, preparationMinutes: 5 },
  bike: { weeklyMinutes: 120, sessionsPerWeek: 2, ftpWatts: 220, preparationMinutes: 5 },
  swim: { weeklyMinutes: 60, sessionsPerWeek: 2, cssSecPer100m: 120, poolLengthM: 25, preparationMinutes: 5 },
} }, goal: { kind: 'base', name: 'Mixed base', date: '2026-12-06' }, maxSessionsPerDay: 2 }
const generate = (c = config) => generateSportsPlan(c, '2026-11-02', 'plan1', 'cycle1', 'test')

describe('session planning v2', () => {
  it('generates deterministic separate sport volumes and native targets', () => {
    const p = generate()
    expect(generate()).toEqual(p)
    expect(validateSportsPlan(p)).toEqual([])
    expect(calendarIssues(p, config)).toEqual([])
    expect(p.sessions.find(s => s.sport === 'bike')!.steps[0]!.target).toEqual({ kind: 'power', watts: 143, ftpPercent: 65 })
    expect(p.sessions.find(s => s.sport === 'swim' && s.purpose === 'long')!.steps[0]!.target).toEqual({ kind: 'pace', seconds: 132, perM: 100 })
    expect(p.sessions.find(s => s.sport === 'swim' && s.purpose === 'technique')!.steps[0]!.target).toEqual({kind:'open'})
  })
  for (const source of ENDURANCE_SPORTS) for (const target of ENDURANCE_SPORTS.filter(s => s !== source)) {
    it(`replaces ${source} → ${target} without duplicate active original`, () => {
      const p = generate(), s = p.sessions.find(s => s.sport === source)!
      const next = replaceSportSession(p, config, s.id, target)
      expect(next.sessions).toHaveLength(p.sessions.length)
      expect(next.sessions.some(x => x.id === s.id)).toBe(false)
      expect(next.archive).toEqual([s])
      const replacement = next.sessions.find(x => x.replacesSessionId === s.id)!
      expect(replacement.sport).toBe(target)
      expect(replacement.id).not.toBe(s.id)
      expect(next.replacements[0]!.tradeoffs.length).toBeGreaterThan(1)
      expect(validateSportsPlan(next)).toEqual([])
      expect(calendarIssues(next, config)).toEqual([])
    })
  }
  it('never transfers VDOT, FTP or CSS to another sport', () => {
    const c = structuredClone(config); delete c.athlete.sports.bike!.ftpWatts
    const p = generate(c), s = p.sessions.find(s => s.sport === 'run')!
    const next = replaceSportSession(p, c, s.id, 'bike')
    expect(next.sessions.find(s => s.sport === 'bike' && s.replacesSessionId)!.steps[0]!.target).toEqual({ kind: 'open' })
  })
  it('retains a replacement chain and reports the lost quality objective', () => {
    const p=generate(), source=p.sessions.find(s=>s.sport==='run')!
    source.purpose='intervals'
    const bike=replaceSportSession(p,config,source.id,'bike')
    expect(bike.replacements[0]!.assessment).toMatchObject({direction:'run-bike',original:{primary:'quality'},alternative:{primary:'aerobic'}})
    const bikeId=bike.replacements[0]!.targetId
    const run=replaceSportSession(bike,config,bikeId,'run')
    expect(run.sessions).toHaveLength(p.sessions.length)
    expect(run.archive.map(s=>s.id)).toEqual([source.id,bikeId])
    expect(run.sessions.find(s=>s.replacesSessionId===bikeId)!.purpose).toBe('easy')
    expect(validateSportsPlan(run)).toEqual([])
  })
  it('rejects missing profile, invalid volume and inconsistent schema', () => {
    const c = structuredClone(config); delete c.athlete.sports.swim
    const p = generate(c)
    expect(() => replaceSportSession(p, c, p.sessions.find(s => s.sport === 'bike')!.id, 'swim')).toThrow()
    expect(() => validateSportsConfig({ ...config, schemaVersion: 3 })).toThrow()
    const bad = structuredClone(p); bad.sessions[0]!.steps[0]!.durationSec = NaN
    expect(validateSportsPlan(bad).length).toBeGreaterThan(0)
    bad.sessions[0]!.id = '../../escape'; expect(validateSportsPlan(bad).length).toBeGreaterThan(0)
  })
  it('honours pool windows and reports unsatisfied capacity', () => {
    const c: SportsConfig = { ...structuredClone(config), availability: [{day:'tue',start:'18:00',minutes:40,sports:['swim']}], time: { weekdayMinutes: 40, weekendMinutes: 40, weeklyMinutes: 40 } }
    const p = generate(c)
    expect(p.warnings.some(w => w.includes('cycle1'))).toBe(true)
    expect(p.sessions.every(s => s.sport === 'swim' && s.start === '18:00')).toBe(true)
    expect(calendarIssues(p, c)).toEqual([])
  })
  it('keeps full pool repeats when shortening, including rests', () => {
    const s = buildSportSession('swim', config.athlete.sports.swim!, 30, 'swim1', '2026-11-03')
    const shorter = shortenSportSession(s, 16)
    expect(shorter.steps[0]!.repeat).toBe(4)
    expect(shorter.distanceM).toBe(400)
    expect(shorter.durationSec).toBe(608)
    expect(shorter.durationSec + shorter.preparationSec).toBeLessThanOrEqual(16 * 60)
    expect(shortenSportSession(shorter, 16)).toEqual(shorter)
    expect(() => shortenSportSession(s, 6)).toThrow()
  })
  it('counts send-off once and rejects conflicting rests', () => {
    const p = generate(), s = p.sessions.find(s => s.sport === 'swim')!
    s.steps = [{role:'work',durationSec:120,distanceM:100,repeat:6,sendoffSec:150,target:{kind:'open'}}]
    Object.assign(s, sessionTotals(s.steps))
    expect(s.durationSec).toBe(900)
    expect(validateSportsPlan(p)).toEqual([])
    s.steps[0]!.restSec = 10
    expect(validateSportsPlan(p).length).toBeGreaterThan(0)
  })
  it('creates triathlon stages and duathlon repeated sports with unique IDs', () => {
    for (const sports of [['swim','bike','run'], ['run','bike','run']] as const) {
      const c: SportsConfig = { ...structuredClone(config), goal: {kind:'multisport',name:'Race',date:'2026-11-29',legs:sports.map((sport,i)=>({id:`leg${i}`,sport,distanceM:1000,estimatedMinutes:20}))} }
      const p = generate(c), races = p.sessions.filter(s => s.purpose === 'race')
      expect(races.map(s => s.sport)).toEqual(sports)
      expect(new Set(races.map(s => s.id)).size).toBe(3)
      expect(validateSportsPlan(p)).toEqual([])
      expect(() => replaceSportSession(p,c,races[0]!.id,'bike')).toThrow()
      p.blockedDates=[c.goal.date]
      expect(calendarIssues(p,c).length).toBeGreaterThan(0)
    }
  })
  it('moves bricks atomically and keeps transition time', () => {
    const c = { ...structuredClone(config), brick: {day:'sat' as const,bikeMinutes:45,runMinutes:20,transitionMinutes:5} }
    const p = generate(c), group = p.groups.find(g => g.kind === 'brick')!
    expect(group).toBeDefined()
    const before = p.sessions.filter(s => s.groupId === group.id)
    expect(calendarMinutes(before, [group])).toBe(80)
    const next = rescheduleSportsPlan(p,c,'2026-11-02',[before[0]!.date],new Set())
    const after = next.sessions.filter(s => s.groupId === group.id)
    expect(new Set(after.map(s => s.date)).size).toBe(1)
    expect(after[0]!.date).not.toBe(before[0]!.date)
    expect(calendarMinutes(after,[group])).toBe(80)
    expect(calendarIssues(next,c)).toEqual([])
  })
  it('does not infer a missed workout from absent or ambiguous telemetry', () => {
    const p = generate(), source = p.sessions.find(s=>s.sport==='run')!, next = replaceSportSession(p,config,source.id,'bike')
    const s = next.sessions.find(s=>s.replacesSessionId)!
    const activity = {externalId:'a',date:s.date,type:'Ride',movingTimeSec:1200}
    expect(buildSessionExecution(next,[],[],s.date).find(e=>e.sessionId===s.id)!.status).toBe('unknown')
    const records = buildSessionExecution(next,[activity],[],s.date)
    expect(records.some(e=>e.sessionId===source.id)).toBe(false)
    expect(records.find(e=>e.sessionId===s.id)).toMatchObject({status:'done',replacement:true,sport:'bike'})
    next.sessions.push({...s,id:'bike-second'})
    expect(buildSessionExecution(next,[activity],[],s.date).filter(e=>e.date===s.date&&e.sport==='bike').every(e=>e.status==='unknown')).toBe(true)
  })
  it('fits desk windows from cycling time including preparation', () => {
    const c={...structuredClone(config),desk:{workStart:'09:00',workEnd:'17:00',lunchMinutes:45}}
    const p=generate(c), s=p.sessions.find(s=>s.sport==='bike' && s.purpose==='easy')!
    const group=sessionDeskDay(p,c,s.date).groups.find(g=>g.sessionIds.includes(s.id))!
    expect(group.minutes).toBe(53)
    expect(group.windows.find(w=>w.key==='lunch')!.fits).toBe(false)
    expect(group.windows.find(w=>w.key==='evening')!.fits).toBe(true)
  })
  it('calibrates only the running profile from a running result', () => {
    const run=buildSportSession('run',{weeklyMinutes:90,sessionsPerWeek:2,results:[{date:'2026-10-01',distanceKm:10,timeSec:3000}]},30,'r1','2026-11-02')
    expect(run.steps[0]!.target.kind).toBe('pace')
    expect(run.calibration!.source).toContain('VDOT')
    const bike=buildSportSession('bike',{weeklyMinutes:90,sessionsPerWeek:2},30,'b1','2026-11-02')
    expect(bike.steps[0]!.target.kind).toBe('open')
  })
})
