import { describe, expect, it } from 'vitest'
import { setLocale } from '../i18n/index.ts'
import { buildSportSession, generateSportsPlan, calendarIssues, shortenSportSession, validateSportsPlan } from './engine.ts'
import { coachingLines, sessionStepLines, targetText } from './coaching.ts'
import { intensityMinutes } from './metrics.ts'
import type { EnduranceSport, SessionContext, SessionPurpose, SportProfile, SportsConfig, SportsPlan } from './types.ts'

const date='2026-11-02'
const profile:SportProfile={weeklyMinutes:240,sessionsPerWeek:3,experience:'trained',ftpWatts:250,cssSecPer100m:120,poolLengthM:25,calibration:{date,source:'test'}}
const shell=(session:ReturnType<typeof buildSportSession>):SportsPlan=>({schemaVersion:2,id:'p',cycleId:'c',engineVersion:'test',generatedAt:date,goal:{kind:'base',date,name:'Test'},sessions:[session],groups:[],archive:[],replacements:[],changes:[],generatedSessions:{},warnings:[]})

describe('complete coaching prescriptions',()=>{
  it('formats fractional pace across a minute boundary without an impossible clock',()=>{
    expect(targetText({kind:'pace',seconds:119.8,perM:100})).toBe('2:00/100 m')
    expect(targetText({kind:'pace',seconds:359.6,perM:1000})).toBe('6:00/km')
    expect(targetText({kind:'pace',seconds:120.2,perM:100})).toBe('2:00/100 m')
  })
  it.each(['pl','en'] as const)('explains harder run and timed swim repetitions accurately in %s',locale=>{
    setLocale(locale)
    for(const sport of ['run','swim'] as const){
      const s=buildSportSession(sport,{weeklyMinutes:180,sessionsPerWeek:3,experience:'regular'},40,'s',date,'intervals')
      expect(s.purpose).toBe('intervals')
      expect(s.coaching!.rationale).toContain('RPE')
      expect(s.coaching!.rationale).not.toContain(locale==='pl'?'Spokojna intensywność':'Easy intensity')
      expect(s.coaching!.rationale).not.toMatch(/Faza: Baza|Phase: Base/)
    }
  })
  it('keeps warm-up, main set, cool-down and explicit effort within the budget across profiles',()=>{
    let checked=0
    for(const sport of ['run','bike','swim'] as EnduranceSport[])
    for(const purpose of ['easy','long','intervals','technique'] as SessionPurpose[])
    for(const minutes of [5,10,20,40,60,120])
    for(const experience of ['new','regular','trained'] as const)
    for(const calibrated of [true,false]) {
      const p={...profile,experience}
      if(!calibrated)delete p.calibration
      const original=structuredClone(p)
      const s=buildSportSession(sport,p,minutes,'unit',date,purpose,date,{phase:'build',weekIndex:2})
      expect(p).toEqual(original)
      expect(s.durationSec).toBeLessThanOrEqual(minutes*60)
      expect(s.steps[0]!.role).toBe('warmup');expect(s.steps.at(-1)!.role).toBe('cooldown')
      expect(s.steps.some(x=>x.role==='work')).toBe(true)
      expect(s.steps.every(x=>x.durationSec>0 && x.effort && (x.effort.min<=x.effort.max))).toBe(true)
      expect(s.steps.filter(x=>x.restSec).every(x=>x.recovery?.instruction && x.recovery.effort)).toBe(true)
      expect(validateSportsPlan(shell(s)),JSON.stringify(s)).toEqual([])
      expect(s.coaching?.objective.length).toBeGreaterThan(15)
      if(s.purpose==='intervals') {
        const work=s.steps.filter(x=>x.role==='work'&&(x.effort?.max??0)>4)
        expect(work.some(x=>(x.repeat??0)>=2)).toBe(true)
        expect(work.reduce((n,x)=>n+x.durationSec*(x.repeat??1),0)).toBeGreaterThanOrEqual(s.coaching!.minimumWorkSec!)
      }
      if(experience==='new')expect(s.purpose).not.toBe('intervals')
      checked++
    }
    expect(checked).toBe(432)
  })
  it('respects complete pool lengths at fast and slow CSS, and explains timed fallback',()=>{
    for(const poolLengthM of [25,50,100])for(const cssSecPer100m of [20,120,600])for(const minutes of [5,15,45])for(const purpose of ['easy','intervals','technique'] as const){
      const s=buildSportSession('swim',{...profile,poolLengthM,cssSecPer100m},minutes,'pool',date,purpose)
      expect(s.durationSec).toBeLessThanOrEqual(minutes*60)
      expect(s.steps.every(x=>!x.distanceM||Number.isInteger(x.distanceM/poolLengthM))).toBe(true)
      expect(validateSportsPlan(shell(s)),JSON.stringify(s)).toEqual([])
      expect(s.steps.some(x=>x.role==='work')).toBe(true)
      if(s.purpose==='technique')expect(s.steps.find(x=>x.role==='drill')?.instruction).toBeTruthy()
    }
  })
  it('selects distinct cycling recipes for base, short-race build, long-race build and taper',()=>{
    const contexts:SessionContext[]=[{phase:'base'},{phase:'build',weekIndex:2},{phase:'build',weekIndex:3},{phase:'taper'}]
    const goal:SportsConfig['goal']={kind:'race',name:'40 km',date:'2026-12-20',sport:'bike',distanceM:40000,estimatedMinutes:90}
    const sessions=contexts.map(c=>buildSportSession('bike',profile,90,'bike',date,'intervals',date,{...c,goal}))
    expect(sessions.map(s=>s.coaching?.recipeId)).toEqual(['bike-tempo','bike-aerobic-power','bike-threshold','bike-openers'])
    const long=buildSportSession('bike',profile,90,'long',date,'intervals',date,{phase:'build',goal:{...goal,distanceM:180000}})
    expect(long.coaching?.recipeId).toBe('bike-sustained')
    expect(intensityMinutes(sessions[3]!).quality).toBeLessThan(intensityMinutes(sessions[1]!).quality)
    const tempo=sessions[0]!.steps.find(s=>s.repeat)!
    expect(tempo.durationSec).toBe(360) // Long budgets do not stretch each repeat indefinitely.
    expect(intensityMinutes(long).easy).toBeGreaterThan(0)
  })
  it('uses meaningful skill instructions and includes transfer to normal swimming',()=>{
    const a=buildSportSession('swim',profile,40,'a',date,'technique',date,{weekIndex:0})
    const b=buildSportSession('swim',profile,40,'b',date,'technique',date,{weekIndex:1})
    expect(a.steps.find(s=>s.role==='drill')!.instruction).not.toBe(b.steps.find(s=>s.role==='drill')!.instruction)
    expect(a.steps.find(s=>s.role==='drill')!.target.kind).toBe('open')
    expect(a.steps.some(s=>s.role==='work'&&s.stroke==='freestyle')).toBe(true)
  })
  it('does not prescribe measured targets from absent, future or expired calibration',()=>{
    for(const calibration of [undefined,{date:'2026-11-03',source:'future'},{date:'2025-01-01',source:'expired'}])for(const sport of ['bike','swim'] as const){
      const p={...profile}
      if(calibration)p.calibration=calibration;else delete p.calibration
      const s=buildSportSession(sport,p,40,'s',date)
      expect(s.steps.every(x=>x.target.kind==='open')).toBe(true)
      expect(sessionStepLines(s).join('\n')).toContain('RPE')
      expect(s.calibration).toBeUndefined()
    }
  })
  it('does not use easy running pace as a calibrated interval target',()=>{
    const s=buildSportSession('run',{weeklyMinutes:90,sessionsPerWeek:3,experience:'regular',easyPaceSecPerKm:360},40,'r',date,'intervals')
    expect(s.purpose).toBe('intervals')
    const work=s.steps.find(x=>x.repeat)!
    expect(work.target.kind).toBe('open');expect(work.effort!.min).toBeGreaterThan(4)
    expect(s.steps[0]!.target.kind).toBe('pace')
  })
  it('shortens quality by whole repetitions, protects recovery and rejects a lost stimulus',()=>{
    const s=buildSportSession('bike',profile,60,'b',date,'intervals')
    const shorter=shortenSportSession(s,50)
    expect(shorter.steps[0]).toEqual(s.steps[0]);expect(shorter.steps.at(-1)).toEqual(s.steps.at(-1))
    expect(shorter.steps.find(x=>x.repeat)?.repeat).toBe(2)
    expect(shorter.steps.find(x=>x.repeat)?.recovery).toEqual(s.steps.find(x=>x.repeat)?.recovery)
    expect(validateSportsPlan(shell(shorter))).toEqual([])
    expect(()=>shortenSportSession(s,25)).toThrow()
    expect(s.steps.find(x=>x.repeat)?.repeat).toBe(3)
  })
  it('rejects malformed coaching, effort and recovery while reading old sessions',()=>{
    const original=buildSportSession('bike',profile,60,'s',date,'intervals')
    for(const change of [(s:typeof original)=>{s.steps[0]!.effort!.min=11},(s:typeof original)=>{s.coaching!.successCriteria=[]},(s:typeof original)=>{s.steps.find(x=>x.restSec)!.recovery!.target={kind:'power',watts:-1}}]){
      const s=structuredClone(original);change(s);expect(validateSportsPlan(shell(s)).length).toBeGreaterThan(0)
    }
    const old=structuredClone(original);delete old.coaching
    old.steps.forEach(x=>{delete x.effort;delete x.recovery;delete x.instruction})
    expect(validateSportsPlan(shell(old))).toEqual([])
  })
  it.each(['pl','en'] as const)('explains purpose, phase and goal in %s',locale=>{
    setLocale(locale)
    const s=buildSportSession('bike',profile,60,'s',date,'intervals',date,{phase:'base',weekIndex:2,goal:{kind:'base',date,name:'My goal'}})
    const text=coachingLines(s).join('\n')
    expect(text).toContain(locale==='pl'?'Cel:':'Objective:')
    expect(text).toContain('My goal');expect(text).toContain('3.')
    expect(text).toContain(locale==='pl'?'Dlaczego:':'Why:')
  })
  it('produces valid phase-specific multisport plans with progressing bricks',()=>{
    const c:SportsConfig={schemaVersion:2,athlete:{sports:{run:{...profile,weeklyMinutes:120},bike:profile,swim:{...profile,weeklyMinutes:120}}},goal:{kind:'multisport',name:'Triathlon',date:'2026-12-27',legs:[{id:'swim',sport:'swim',distanceM:750,estimatedMinutes:20},{id:'bike',sport:'bike',distanceM:20000,estimatedMinutes:45},{id:'run',sport:'run',distanceM:5000,estimatedMinutes:30}]},brick:{day:'sat',bikeMinutes:40,runMinutes:20,transitionMinutes:5},maxSessionsPerDay:2}
    const p=generateSportsPlan(c,date,'p','c','test')
    expect(validateSportsPlan(p)).toEqual([]);expect(calendarIssues(p,c)).toEqual([])
    expect(p.sessions.every(s=>s.coaching?.objective)).toBe(true)
    const bricks=p.groups.filter(g=>g.kind==='brick').map(g=>p.sessions.find(s=>s.id===g.sessionIds[0])!)
    expect(bricks.length).toBeGreaterThan(3)
    expect(new Set(bricks.map(s=>s.durationSec)).size).toBeGreaterThan(1)
    expect(bricks.every(s=>s.durationSec<=2400 && s.coaching?.recipeId==='bike-brick')).toBe(true)
  })
})
