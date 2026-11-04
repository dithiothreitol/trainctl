import { describe, expect, it } from 'vitest'
import { addDays, mondayOf } from '../util/dates.ts'
import { activityEvidence, activityKey } from './activities.ts'
import { buildSessionExecution, buildSportSession, calendarIssues, generateSportsPlan, replaceSportSession, scheduleSessions, shortenSportSession, validateSportsPlan } from './engine.ts'
import { sportModule } from './modules.ts'
import type { SportsConfig, SportsPlan, TrainingSession } from './types.ts'

const c: SportsConfig = {schemaVersion:2,athlete:{sports:{bike:{weeklyMinutes:180,peakWeeklyMinutes:240,progressionPercent:5,sessionsPerWeek:3,ftpWatts:200,calibration:{date:'2026-10-01',source:'test'},experience:'regular'},run:{weeklyMinutes:120,sessionsPerWeek:3,easyPaceSecPerKm:360},swim:{weeklyMinutes:90,sessionsPerWeek:3,cssSecPer100m:120,poolLengthM:25}}},goal:{kind:'race',sport:'bike',name:'Race',date:'2026-12-20',distanceM:40000,estimatedMinutes:90}}
const base = ():SportsPlan=>({schemaVersion:2,id:'p',cycleId:'c',generatedAt:'2026-11-02',engineVersion:'test',goal:c.goal,sessions:[],archive:[],groups:[],replacements:[],changes:[],generatedSessions:{},warnings:[]})
describe('sport-specific policies',()=>{
  it('builds volume within the declared ceiling, deloads, tapers and recovers',()=>{
    const module=sportModule('bike'), profile=c.athlete.sports.bike!
    const weeks=Array.from({length:9},(_,i)=>module.weekly(profile,c,'2026-11-02',addDays('2026-11-02',i*7),'2026-11-02'))
    const volumes=weeks.map(w=>w.doses.reduce((n,d)=>n+d.minutes,0))
    expect(volumes[1]).toBeGreaterThan(volumes[0]!)
    expect(volumes[3]).toBeLessThan(volumes[2]!)
    expect(volumes.every(v=>v<=240)).toBe(true)
    expect(weeks[6]!.phase).toBe('taper')
    expect(weeks[6]!.doses).toHaveLength(3)
    expect(weeks[6]!.doses.some(d=>d.purpose==='intervals')).toBe(true)
    expect(weeks[7]!.phase).toBe('recovery')
    expect(weeks[7]!.doses.every(d=>d.purpose==='easy')).toBe(true)
    const p=generateSportsPlan(c,'2026-11-02','p','c','test')
    expect(calendarIssues(p,c)).toEqual([])
    expect(p.sessions.some(s=>s.sport==='run'&&s.date>'2026-12-20'&&s.date<='2026-12-22')).toBe(false)
  })
  it('keeps B/C races out of brick substitution and preserves every group',()=>{
    const cfg=structuredClone(c)
    cfg.goal={kind:'multisport',name:'Duathlon',date:'2026-11-29',legs:[{id:'run1',sport:'run',distanceM:5000,estimatedMinutes:30},{id:'ride',sport:'bike',distanceM:20000,estimatedMinutes:45},{id:'run2',sport:'run',distanceM:2500,estimatedMinutes:15}]}
    cfg.tuneUpGoals=[{kind:'race',name:'B',priority:'B',sport:'bike',date:'2026-11-15',distanceM:10000,estimatedMinutes:30}]
    cfg.brick={day:'sat',bikeMinutes:35,runMinutes:15,transitionMinutes:5}
    const p=generateSportsPlan(cfg,'2026-11-02','p','c','test')
    expect(validateSportsPlan(p)).toEqual([])
    expect(calendarIssues(p,cfg)).toEqual([])
    expect(p.sessions.find(s=>s.racePriority==='B')?.purpose).toBe('race')
    expect(p.groups.find(g=>g.id==='c-race')!.sessionIds.map(id=>p.sessions.find(s=>s.id===id)!.sport)).toEqual(['run','bike','run'])
    expect(p.sessions.filter(s=>s.date==='2026-11-16')).toEqual([])
  })
  it('retains a calibrated quality intent but downgrades near a race or hard neighbour',()=>{
    const p=base(), s=buildSportSession('run',c.athlete.sports.run!,40,'r','2026-11-10','intervals');p.sessions=[s]
    const next=replaceSportSession(p,c,'r','bike',undefined,undefined,{asOf:'2026-11-02',variant:'quality'})
    expect(next.sessions[0]!.purpose).toBe('intervals')
    expect(next.sessions[0]!.steps.find(s=>s.role==='work')!.target).toMatchObject({kind:'power',watts:176})
    p.sessions.push(buildSportSession('bike',c.athlete.sports.bike!,40,'b','2026-11-11','intervals'))
    expect(replaceSportSession(p,c,'r','bike').sessions[0]!.purpose).toBe('easy')
    expect(()=>replaceSportSession(p,c,'r','bike',undefined,undefined,{variant:'quality'})).toThrow()
    p.sessions=[{...s,date:'2026-12-18'}]
    expect(replaceSportSession(p,c,'r','bike').replacements[0]!.assessment!.limits.length).toBeGreaterThan(0)
  })
  it('limits unfamiliar running and refuses unavailable resources',()=>{
    const p=base();p.sessions=[buildSportSession('bike',c.athlete.sports.bike!,90,'b','2026-11-10','long')]
    const next=replaceSportSession(p,c,'b','run')
    expect(next.sessions[0]!.durationSec).toBeLessThanOrEqual(1200)
    expect(next.sessions[0]!.purpose).toBe('easy')
    const noPool=structuredClone(c);noPool.athlete.sports.swim!.resources=[]
    expect(()=>replaceSportSession(p,noPool,'b','swim')).toThrow()
  })
  it('never uses future results and preserves warm-up, recovery and cool-down when shortening quality',()=>{
    const run=buildSportSession('run',{weeklyMinutes:90,sessionsPerWeek:2,results:[{date:'2026-11-10',distanceKm:10,timeSec:2500}]},40,'r','2026-11-12','easy','2026-11-02')
    expect(run.steps[0]!.target.kind).toBe('open')
    const bike=buildSportSession('bike',c.athlete.sports.bike!,50,'b','2026-11-10','intervals')
    const shorter=shortenSportSession(bike,50)
    expect(shorter.steps[0]).toEqual(bike.steps[0])
    expect(shorter.steps.at(-1)).toEqual(bike.steps.at(-1))
    expect(shorter.steps.find(s=>s.role==='work')!.restSec).toBe(180)
    expect(shorter.durationSec+shorter.preparationSec).toBeLessThanOrEqual(3000)
  })
})
describe('calendar search',()=>{
  it.each([10,14])('places %i sessions deterministically within bounded work',count=>{
    const cfg:SportsConfig={schemaVersion:2,athlete:{sports:{run:{weeklyMinutes:200,sessionsPerWeek:5},bike:{weeklyMinutes:200,sessionsPerWeek:5},swim:{weeklyMinutes:160,sessionsPerWeek:4}}},goal:{kind:'base',name:'Benchmark',date:'2026-11-08'},maxSessionsPerDay:2,time:{weeklyMinutes:700,weekdayMinutes:100,weekendMinutes:100},availability:[...(['mon','tue','wed','thu','fri','sat','sun'] as const)].map(day=>({day,start:'18:00',minutes:100,sports:['run','bike','swim']}))}
    const requests:TrainingSession[]=Array.from({length:count},(_,i)=>buildSportSession((['run','bike','swim']as const)[i%3]!,{weeklyMinutes:200,sessionsPerWeek:5},40,`s${i}`,'2026-11-02'))
    const dates=Array.from({length:7},(_,i)=>addDays('2026-11-02',i))
    const first=scheduleSessions({...base(),goal:cfg.goal},requests,[],dates,cfg)
    expect(first.plan?.sessions).toHaveLength(count)
    expect(first.visited).toBeLessThan(200)
    expect(first.exhausted).toBe(false)
    expect(calendarIssues(first.plan!,cfg)).toEqual([])
    expect(scheduleSessions({...base(),goal:cfg.goal},requests,[],dates,cfg)).toEqual(first)
    expect(scheduleSessions({...base(),goal:cfg.goal},requests,[],dates,cfg,1).exhausted).toBe(true)
  })
  it('reserves a scarce pool slot before flexible sessions',()=>{
    const cfg=structuredClone(c);cfg.goal={kind:'base',name:'base',date:'2026-11-08'};cfg.maxSessionsPerDay=1;cfg.availability=[{day:'mon',start:'18:00',minutes:60,sports:['bike','swim']},{day:'tue',start:'18:00',minutes:60,sports:['bike']}]
    const requests=[buildSportSession('bike',cfg.athlete.sports.bike!,40,'bike','2026-11-02'),buildSportSession('swim',cfg.athlete.sports.swim!,30,'swim','2026-11-02')]
    const result=scheduleSessions({...base(),goal:cfg.goal},requests,[],['2026-11-02','2026-11-03'],cfg)
    expect(result.plan!.sessions.find(s=>s.sport==='swim')!.date).toBe('2026-11-02')
    expect(result.plan!.sessions.find(s=>s.sport==='bike')!.date).toBe('2026-11-03')
  })
})
describe('source evidence',()=>{
  const a={externalId:'42',importSource:'hub:one',date:'2026-11-02',type:'Ride',startTime:'2026-11-02T12:00:00Z',movingTimeSec:1800,distanceKm:15}
  const copy={...a,externalId:'file1',importSource:'files:one',startTime:'2026-11-02T13:00:00+01:00'}
  it('deduplicates copies across sources with explicit offsets and counts them once',()=>{
    expect(activityEvidence([a,copy])).toHaveLength(1)
    const p=base();p.sessions=[buildSportSession('bike',c.athlete.sports.bike!,30,'b',a.date)]
    const row=buildSessionExecution(p,[a,copy],[],a.date)[0]!
    expect(row).toMatchObject({status:'done',durationSec:1800,distanceM:15000})
    expect(row.activityIds).toEqual(expect.arrayContaining([activityKey(a),activityKey(copy)]))
    expect(activityEvidence([a,{...copy,startTime:'2026-11-02T12:00:00'}])).toHaveLength(2)
  })
  it('sums explicitly selected parts and does not steal them for another session',()=>{
    const second={...a,externalId:'43',startTime:'2026-11-02T13:00:00Z',movingTimeSec:900,distanceKm:7}
    const p=base();p.sessions=[buildSportSession('bike',c.athlete.sports.bike!,50,'b',a.date),buildSportSession('bike',c.athlete.sports.bike!,30,'b2',a.date)]
    const rows=buildSessionExecution(p,[a,copy,second],[{schemaVersion:2,sessionId:'b',date:a.date,sport:'bike',status:'done',loggedAt:a.startTime,activityIds:[activityKey(a),activityKey(second)]}],a.date)
    expect(rows[0]).toMatchObject({durationSec:2700,distanceM:22000,matching:'explicit'})
    expect(rows[1]!.status).toBe('unknown')
    expect(mondayOf(rows[0]!.date)).toBe('2026-11-02')
  })
})
