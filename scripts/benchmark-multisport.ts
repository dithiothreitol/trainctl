import assert from 'node:assert/strict'
import { performance } from 'node:perf_hooks'
import { addDays, buildSportSession, calendarIssues, scheduleSessions, type SportsConfig, type SportsPlan, type TrainingSession } from '../packages/core/src/index.ts'

const reports=[]
for(const count of [10,14]) {
  const cfg:SportsConfig={schemaVersion:2,athlete:{sports:{run:{weeklyMinutes:200,sessionsPerWeek:5},bike:{weeklyMinutes:200,sessionsPerWeek:5},swim:{weeklyMinutes:160,sessionsPerWeek:4}}},goal:{kind:'base',name:'Benchmark',date:'2026-11-08'},maxSessionsPerDay:2,time:{weeklyMinutes:700,weekdayMinutes:100,weekendMinutes:100},availability:[]}
  for(const day of ['mon','tue','wed','thu','fri','sat','sun'] as const)cfg.availability!.push({day,start:'18:00',minutes:100,sports:['run','bike',...(['tue','thu','sat'].includes(day)?['swim' as const]:[])]})
  const p:SportsPlan={schemaVersion:2,id:'benchmark',cycleId:'cycle',generatedAt:'2026-11-02',engineVersion:'benchmark',goal:cfg.goal,sessions:[],groups:[],archive:[],replacements:[],changes:[],generatedSessions:{},warnings:[]}
  const requests:TrainingSession[]=Array.from({length:count},(_,i)=>{
    const sport=(['run','bike','swim'] as const)[i%3]!
    const s=buildSportSession(sport,cfg.athlete.sports[sport]!,40,`s${i}`,'2026-11-02',i===1||i===5||i===9?'intervals':'easy')
    s.ruleRefs.push('MS-4');return s
  })
  const dates=Array.from({length:7},(_,i)=>addDays('2026-11-02',i))
  const started=performance.now(), result=scheduleSessions(p,requests,[],dates,cfg)
  const elapsedMs=Math.round((performance.now()-started)*10)/10
  assert.equal(result.plan?.sessions.length,count)
  assert.deepEqual(calendarIssues(result.plan!,cfg),[])
  assert.deepEqual(scheduleSessions(p,requests,[],dates,cfg),result)
  assert.equal(result.exhausted,false)
  reports.push({sessions:count,qualitySessions:3,poolDays:3,visitedNodes:result.visited,limit:5000,elapsedMs,deterministic:true,result:'PASS'})
}
console.log(JSON.stringify(reports,null,2))
