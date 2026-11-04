import { describe, expect, it } from 'vitest'
import { buildSessionExecution, buildSportSession, calendarIssues, calendarMinutes, generateSportsPlan, intensityMinutes, replaceSportSession, restoreSportSession, scheduleSessions, sessionTotals, sportsTotals, validateSportsConfig, validateSportsPlan } from './engine.ts'
import type { SessionLog, SportsConfig, SportsPlan } from './types.ts'
import { sportModule } from './modules.ts'

const config: SportsConfig = {schemaVersion:2,athlete:{sports:{run:{weeklyMinutes:120,sessionsPerWeek:3,easyPaceSecPerKm:360},bike:{weeklyMinutes:180,sessionsPerWeek:3,ftpWatts:200},swim:{weeklyMinutes:90,sessionsPerWeek:3,poolLengthM:25,cssSecPer100m:120}}},goal:{kind:'base',name:'Base',date:'2026-12-20'}}
function fixture(): SportsPlan {
  return {schemaVersion:2,id:'p',cycleId:'c',engineVersion:'test',generatedAt:'2026-11-02',goal:config.goal,sessions:[buildSportSession('run',config.athlete.sports.run!,40,'original','2026-11-02')],archive:[],groups:[],replacements:[],changes:[],generatedSessions:{},warnings:[]}
}

describe('restoring saved prescriptions',()=>{
  it('restores the exact saved content after recalibration and movement, with an auditable new UID',()=>{
    const plan=fixture(), original=structuredClone(plan.sessions[0]!)
    const swapped=replaceSportSession(plan,config,original.id,'bike'), id=swapped.sessions[0]!.id
    swapped.sessions[0]!.date='2026-11-04'; swapped.sessions[0]!.start='18:00'
    const updated=structuredClone(config); updated.athlete.sports.run!.easyPaceSecPerKm=300
    const restored=restoreSportSession(swapped,updated,id)
    const session=restored.sessions[0]!
    expect(session).toMatchObject({...original,id:expect.any(String),date:'2026-11-04',start:'18:00',approved:true,replacesSessionId:id,restoresSessionId:original.id})
    expect(session.id).not.toBe(original.id)
    expect(restored.archive).toEqual([original,swapped.sessions[0]])
    expect(swapped.sessions[0]!.sport).toBe('bike')
    expect(restored.replacements.at(-1)).toMatchObject({operation:'restore',restoresSessionId:original.id})
    expect(validateSportsPlan(restored)).toEqual([])
    expect(calendarIssues(restored,updated)).toEqual([])
  })
  it('keeps the other brick member and checks current resources and time',()=>{
    const plan=fixture(), original=plan.sessions[0]!
    original.start='07:00'; original.groupId='g'
    const second=buildSportSession('bike',config.athlete.sports.bike!,30,'second',original.date);second.start='08:00';second.groupId='g'
    plan.sessions.push(second);plan.groups=[{id:'g',kind:'brick',sessionIds:[original.id,second.id],transitionSec:300}]
    const swapped=replaceSportSession(plan,config,original.id,'swim')
    const restored=restoreSportSession(swapped,config,swapped.sessions[0]!.id)
    expect(restored.groups[0]!.sessionIds).toEqual([restored.sessions[0]!.id,second.id])
    expect(restored.sessions[1]).toEqual(second)
    swapped.timeBudgets={[original.date]:60}
    expect(()=>restoreSportSession(swapped,config,swapped.sessions[0]!.id)).toThrow()
    expect(()=>restoreSportSession(plan,config,original.id)).toThrow()
    const swimPlan=fixture();swimPlan.sessions=[buildSportSession('swim',config.athlete.sports.swim!,30,'swim','2026-11-02')]
    const bike=replaceSportSession(swimPlan,config,'swim','bike')
    const noPool=structuredClone(config);noPool.athlete.sports.swim!.resources=[]
    expect(()=>restoreSportSession(bike,noPool,bike.sessions[0]!.id)).toThrow()
    const otherPool=structuredClone(config);otherPool.athlete.sports.swim!.poolLengthM=50
    expect(()=>restoreSportSession(bike,otherPool,bike.sessions[0]!.id)).toThrow()
  })
  it('does not grow IDs during a long sequence of substitutions and restores',()=>{
    let plan=fixture()
    for(let i=0;i<50;i++) {
      plan=replaceSportSession(plan,config,plan.sessions[0]!.id,'bike')
      plan=restoreSportSession(plan,config,plan.sessions[0]!.id)
    }
    expect(validateSportsPlan(plan)).toEqual([])
    expect(Math.max(...plan.archive.map(s=>s.id.length))).toBeLessThan(40)
    expect(plan.sessions[0]!.steps).toEqual(fixture().sessions[0]!.steps)
  })
})

describe('actual sport and prescribed intensity accounting',()=>{
  it('attributes spontaneous execution only to the actual sport and preserves feedback',()=>{
    const plan=fixture(), log:SessionLog={schemaVersion:2,sessionId:'original',date:'2026-11-02',sport:'bike',plannedSport:'run',status:'modified',durationSec:1500,rpe:4,note:'Rain',loggedAt:'2026-11-02'}
    const execution=buildSessionExecution(plan,[],[log],'2026-11-02')[0]!
    expect(execution).toMatchObject({sport:'bike',plannedSport:'run',spontaneous:true,durationSec:1500,rpe:4,note:'Rain'})
    delete log.durationSec;log.status='done'
    expect(buildSessionExecution(plan,[],[log],'2026-11-02')[0]!.durationSec).toBeUndefined()
    expect(plan).toEqual(fixture())
  })
  it('does not turn partially missing explicit activity bindings into complete totals',()=>{
    const log:SessionLog={schemaVersion:2,sessionId:'original',date:'2026-11-02',sport:'run',status:'done',loggedAt:'2026-11-02',activityIds:['found','missing']}
    const rows=buildSessionExecution(fixture(),[{externalId:'found',date:'2026-11-02',type:'Run',movingTimeSec:1200,distanceKm:3}], [log],'2026-11-02')
    expect(rows[0]!.durationSec).toBeUndefined(); expect(rows[0]!.distanceM).toBeUndefined()
  })
  it('separates warm-up, repeats, rests and cool-down and reports percentages per sport',()=>{
    const session=buildSportSession('bike',config.athlete.sports.bike!,40,'bike','2026-11-02','intervals')
    const split=intensityMinutes(session)
    expect(split.easy).toBe(18);expect(split.recovery).toBe(6)
    expect(split.quality).toBe(16)
    expect(Object.values(split).reduce((a,b)=>a+b,0)).toBe(session.durationSec/60)
    const totals=sportsTotals([session,fixture().sessions[0]!])
    expect(totals.bike!.intensityPercent.quality).toBe(40)
    expect(totals.run!.intensityPercent.easy).toBe(100)
    expect(totals.swim!.intensityPercent.unknown).toBe(0)
  })
  it('counts send-off recovery once and keeps uncalibrated work unknown',()=>{
    const swim=buildSportSession('swim',config.athlete.sports.swim!,30,'swim','2026-11-02','intervals')
    swim.steps=[{role:'work',durationSec:100,sendoffSec:120,repeat:5,distanceM:100,target:{kind:'open'}}]
    Object.assign(swim,sessionTotals(swim.steps))
    const split=intensityMinutes(swim)
    expect(split.quality).toBe(0);expect(split.unknown).toBeCloseTo(500/60);expect(split.recovery).toBeCloseTo(100/60)
    expect(Object.values(split).reduce((a,b)=>a+b,0)).toBe(10)
  })
  it('uses saved running segments, with mixed work and rounding reported as unknown',()=>{
    const session=fixture().sessions[0]!
    session.durationSec=2160
    session.legacyWorkout={kind:'quality_intervals',distanceKm:6,ruleRefs:[],segments:[{type:'warmup',distanceKm:2,pace:{loSecPerKm:350,hiSecPerKm:360},description:''},{type:'intervals',reps:4,repM:500,pace:{loSecPerKm:290,hiSecPerKm:300},recoverySec:60,description:''},{type:'cooldown',distanceKm:1,description:''},{type:'alternating',distanceKm:1,description:''}]}
    const split=intensityMinutes(session)
    expect(split.quality).toBeCloseTo(600/2280*36)
    expect(split.recovery).toBeGreaterThan(0);expect(split.unknown).toBeGreaterThan(0)
    expect(Object.values(split).reduce((a,b)=>a+b,0)).toBeCloseTo(36)
  })
})

describe('date exceptions, transitions and equipment',()=>{
  it('replaces weekly availability, opens an exceptional weekday and closes a selected date',()=>{
    const c=structuredClone(config);c.athlete.sports.bike!.daysAvailable=['mon']
    c.availability=[{day:'mon',start:'08:00',minutes:60,sports:['bike']}]
    c.availabilityExceptions={'2026-11-02':[],'2026-11-03':[{start:'18:00',minutes:60,sports:['bike']}]}
    const plan=fixture();plan.sessions=[]
    const session=buildSportSession('bike',c.athlete.sports.bike!,30,'bike','2026-11-02')
    const result=scheduleSessions(plan,[session],[],['2026-11-02','2026-11-03'],c)
    expect(result.plan!.sessions[0]).toMatchObject({date:'2026-11-03',start:'18:00'})
    expect(calendarIssues(result.plan!,c)).toEqual([])
    expect(()=>replaceSportSession(result.plan!,c,'bike','run')).toThrow()
    c.availabilityExceptions['2026-11-03']=[{start:'23:00',minutes:120,sports:['bike']}]
    expect(()=>validateSportsConfig(c)).toThrow()
  })
  it('honours exceptional windows for whole groups and distinct transition durations',()=>{
    const c=structuredClone(config);c.maxSessionsPerDay=3
    c.availabilityExceptions={'2026-11-02':[],'2026-11-03':[{start:'18:00',minutes:60,sports:['bike']}]}
    const plan=fixture();plan.sessions=[]
    const members=['a','b','c'].map(id=>({...buildSportSession('bike',c.athlete.sports.bike!,5,id,'2026-11-02'),groupId:'g'}))
    const group={id:'g',kind:'brick' as const,sessionIds:['a','b','c'],transitionSec:180,transitionsSec:[60,120]}
    const result=scheduleSessions(plan,members,[group],['2026-11-02','2026-11-03'],c)
    expect(result.plan!.sessions.map(s=>s.start)).toEqual(['18:00','18:16','18:33'])
    expect(result.plan!.sessions.every(s=>s.date==='2026-11-03')).toBe(true)
    expect(calendarMinutes(result.plan!.sessions,result.plan!.groups)).toBe(48)
    expect(validateSportsPlan(result.plan)).toEqual([])
  })
  it('stores T1 and T2 in order and counts their time once, without adding sport volume',()=>{
    const c=structuredClone(config)
    c.goal={kind:'multisport',name:'Triathlon',date:'2026-11-08',legs:[{id:'swim',sport:'swim',distanceM:750,estimatedMinutes:20},{id:'bike',sport:'bike',distanceM:20000,estimatedMinutes:40},{id:'run',sport:'run',distanceM:5000,estimatedMinutes:30}],transitionsSec:[180,120]}
    const plan=generateSportsPlan(c,'2026-11-02','p','c','test'), race=plan.sessions.filter(s=>s.purpose==='race')
    expect(plan.groups[0]).toMatchObject({transitionSec:300,transitionsSec:[180,120]})
    expect(calendarMinutes(race,plan.groups)).toBe(125)
    expect(Object.values(sportsTotals(race)).reduce((n,s)=>n+s.minutes,0)).toBe(90)
    expect(validateSportsPlan(plan)).toEqual([])
    plan.groups[0]!.transitionSec=0;expect(validateSportsPlan(plan)).not.toEqual([])
    c.goal.transitionsSec=[180];expect(()=>validateSportsConfig(c)).toThrow()
  })
  it('uses power targets only with declared measuring equipment when resources are explicit',()=>{
    const profile={...config.athlete.sports.bike!,resources:['bike' as const],calibration:{date:'2026-11-01',source:'test'}}
    expect(buildSportSession('bike',profile,30,'b','2026-11-02').steps[0]!.target.kind).toBe('open')
    expect(sportModule('bike').calibrated(profile,'2026-11-02')).toBe(false)
    const measured={...profile,resources:['bike','powerMeter'] as ('bike'|'powerMeter')[]}
    expect(buildSportSession('bike',measured,30,'b','2026-11-02').steps[0]!.target.kind).toBe('power')
    expect(sportModule('bike').calibrated(measured,'2026-11-02')).toBe(true)
  })
})
