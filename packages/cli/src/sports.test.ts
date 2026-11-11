import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parse, stringify } from 'yaml'
import ICAL from 'ical.js'
import { buildSportSession, setLocale, type SportsPlan, type SportsConfig, type SyncProvider, type PushableWorkout } from 'trainctl-core'
import { cmdInit, cmdPlan, cmdReplace, cmdMigrate, cmdLog, cmdCheck, cmdWeek, cmdToday, cmdShorten, cmdShift, cmdExport, cmdPush, cmdPull, cmdAdapt, cmdDiff, cmdReview, cmdWhy, cmdReschedule } from './commands.ts'
import { loadSportsPlan, sportsTemplate } from './sports-store.ts'
import { pushableSession, sessionExternalId } from './sports-sync.ts'

let dir: string
beforeEach(() => { dir = mkdtempSync(join(tmpdir(),'trainctl-sports-')); vi.stubEnv('TRAINCTL_TODAY','2026-11-02') })
afterEach(() => { vi.unstubAllEnvs(); rmSync(dir,{recursive:true,force:true,maxRetries:3}) })
function init(goalDate?: string) {
  const config = parse(sportsTemplate('run,bike,swim','2026-11-02')) as SportsConfig
  if (goalDate) config.goal.date = goalDate
  config.athlete.sports.bike!.calibration = {date:"2026-11-01",source:"test"}; config.athlete.sports.bike!.ftpWatts = 220; config.athlete.sports.swim!.cssSecPer100m = 120
  expect(cmdInit(dir,stringify(config)).code).toBe(0)
  const r = cmdPlan(dir); expect(r.output).not.toMatch(/Error/); expect(r.code,r.output).toBe(0)
  return loadSportsPlan(dir)
}
function proposalId(r: ReturnType<typeof cmdReplace>): string { expect(r.code,r.output).toBe(0); return (r.data!.proposal as {id:string}).id }

describe('multisport CLI workflows',()=>{
  it('exports fractional pace in workout and recovery steps as valid minute clocks',()=>{
    const s=buildSportSession('run',{weeklyMinutes:120,sessionsPerWeek:3},40,'fractional','2026-11-02','intervals')
    const work=s.steps.find(x=>x.repeat)!
    work.target={kind:'pace',seconds:359.6,perM:1000}
    work.recovery!.target={kind:'pace',seconds:419.9,perM:1000}
    const output=pushableSession({id:'p'} as SportsPlan,s).description
    expect(output).toContain('6:00/km Pace')
    expect(output).toContain('- Rest 120s 7:00/km Pace')
    expect(output).not.toMatch(/:60\/|:59\.9|:59\.6/)
    const swim=buildSportSession('swim',{weeklyMinutes:120,sessionsPerWeek:3,cssSecPer100m:108.2,calibration:{date:'2026-11-01',source:'test'}},30,'swim','2026-11-02')
    expect(pushableSession({id:'p'} as SportsPlan,swim).description).toContain('2:00/100m Pace')
  })
  it('preserves detailed coaching in CLI, JSON, saved plans and all readable exports',()=>{
    const config=parse(sportsTemplate('bike,swim','2026-11-02')) as SportsConfig
    config.language='en';config.goal.date='2026-11-15'
    for(const p of Object.values(config.athlete.sports)){p.weeklyMinutes=180;p.sessionsPerWeek=3;p.experience='regular';p.calibration={date:'2026-11-01',source:'test'}}
    config.athlete.sports.bike!.ftpWatts=250;config.athlete.sports.swim!.cssSecPer100m=120
    expect(cmdInit(dir,stringify(config)).code).toBe(0)
    expect(cmdPlan(dir).code).toBe(0)
    const p=loadSportsPlan(dir), s=p.sessions.find(x=>x.sport==='bike'&&x.purpose==='intervals')!
    const today=cmdToday(dir,{session:s.id}),why=cmdWhy(dir,{session:s.id})
    expect(today.code,today.output).toBe(0);expect(why.code,why.output).toBe(0)
    expect(today.output).toContain('Objective:');expect(today.output).toContain('RPE')
    expect(why.output).toContain('Why this workout:');expect(why.output).toContain(config.goal.name)
    expect((why.data!.sessions as typeof p.sessions)[0]!.coaching).toEqual(s.coaching)
    expect(cmdExport(dir,{what:'all'}).code).toBe(0)
    const html=readFileSync(join(dir,'export/plan.html'),'utf8')
    expect(html).toContain(s.coaching!.objective);expect(html).toContain('white-space:pre-line')
    const calendar=new ICAL.Component(ICAL.parse(readFileSync(join(dir,'export/plan.ics'),'utf8')))
    expect(calendar.getAllSubcomponents('vevent').some(e=>new ICAL.Event(e).description.includes(s.coaching!.objective))).toBe(true)
    const markdown=readFileSync(join(dir,'plan/PLAN.md'),'utf8')
    expect(markdown).toContain(s.coaching!.objective)
    const outbound=pushableSession(p,s)
    expect(outbound.description).toContain(s.coaching!.objective)
    expect(outbound.description).toContain('RPE')
    expect(outbound.description).toContain('- Rest 120s 125w')
    const swim=p.sessions.find(x=>x.sport==='swim'&&x.purpose==='technique')!
    expect(html).toContain(swim.steps.find(x=>x.role==='drill')!.instruction!)
    const preserved=structuredClone(s.coaching)
    const replacement=cmdReplace(dir,{session:s.id,toSport:'swim',prepare:true})
    const id=proposalId(replacement)
    expect(cmdReplace(dir,{apply:id}).code).toBe(0)
    const updated=loadSportsPlan(dir)
    expect(updated.archive.find(x=>x.id===s.id)!.coaching).toEqual(preserved)
    expect(updated.sessions.find(x=>x.replacesSessionId===s.id)!.coaching?.recipeId).toMatch(/^swim-/)
  })
  it('week --session wskazuje jedną sesję i odrzuca nieznane ID',()=>{
    const p=init(), session=p.sessions.find(s=>s.date>'2026-11-08')!
    const result=cmdWeek(dir,{session:session.id})
    expect(result.code,result.output).toBe(0)
    expect(result.data?.sessions).toEqual([session])
    expect(cmdWeek(dir,{session:'missing'}).code).toBe(1)
    expect(cmdWeek(dir,{session:session.id,sport:session.sport==='bike'?'swim':'bike'}).code).toBe(1)
  })

  it('refuses session-schema options in v1 without recording the wrong sport or changing a plan',()=>{
    const legacy=`athlete:\n  recentWeeklyKm: 35\n  daysAvailable: [tue, thu, sat, sun]\n  longRunDay: sun\n  results:\n    - { date: '2026-09-01', distanceKm: 10, timeSec: 3000 }\ngoal:\n  kind: base\n  name: Base\n  date: '2026-12-27'\n  distanceKm: 0\n  priority: A\n`
    expect(cmdInit(dir,legacy).code).toBe(0);expect(cmdPlan(dir).code).toBe(0)
    const before=readFileSync(join(dir,'plan/plan.yaml'),'utf8'), day=parse(before).weeks.flatMap((w:any)=>w.days).find((d:any)=>d.workout).date
    for(const opts of [{actualSport:'bike',minutes:40},{sets:'1=3'},{activity:'id'},{meters:'1000'},{session:'id'},{sport:'swim'}]) {
      const result=cmdLog(dir,{date:day,...opts})
      expect(result.code,result.output).toBe(1);expect(result.output).toContain('migrate')
      expect(existsSync(join(dir,'log.jsonl'))).toBe(false)
    }
    const results=[cmdToday(dir,{session:'id'}),cmdWeek(dir,{sport:'swim'}),cmdWhy(dir,{session:'id'}),cmdShorten(dir,{session:'id',minutes:20}),cmdShift(dir,{session:'id',from:day,to:'2026-11-08'}),cmdExport(dir,{session:'id',what:'workout'}),cmdReschedule(dir,{sport:'bike',preparation:'5'})]
    for(const result of results) {expect(result.code,result.output).toBe(1);expect(result.output).toContain('migrate')}
    expect(readFileSync(join(dir,'plan/plan.yaml'),'utf8')).toBe(before)
    expect(existsSync(join(dir,'export'))).toBe(false)
    expect(cmdLog(dir,{date:day,status:'done'}).code).toBe(0)
  })
  it('potwierdzenie wpisu sesji podaje status słowem z katalogu', () => {
    const plan = init(), first = [...plan.sessions].sort((a, z) => a.date.localeCompare(z.date))[0]!
    setLocale('pl')
    try {
      const saved = cmdLog(dir, { session: first.id, status: 'done' })
      expect(saved.code, saved.output).toBe(0)
      expect(saved.output).toContain(`${first.id}: wykonany`)
    } finally { setLocale('en') }
  })
  it('wpis sesji v2: dystans z przecinkiem, bez zapisu szesnastkowego; siła w rodzaju żeńskim', () => {
    const plan = init(), sorted = [...plan.sessions].sort((a, z) => a.date.localeCompare(z.date))
    const run = sorted.find((s) => s.sport === 'run')!
    expect(cmdLog(dir, { session: run.id, status: 'done', km: '0x10' }).code).toBe(1)
    expect(cmdLog(dir, { session: run.id, status: 'done', km: '800' }).code).toBe(1)
    const ok = cmdLog(dir, { session: run.id, status: 'done', km: '8,5' })
    expect(ok.code, ok.output).toBe(0)
    expect(ok.data!.entry).toMatchObject({ distanceM: 8500 })
  })
  it('potwierdzenie wpisu siły v2 w rodzaju żeńskim (siła z migracji planu biegowego)', () => {
    const legacy = `athlete:
  recentWeeklyKm: 35
  daysAvailable: [tue, thu, sat, sun]
  results:
    - { date: '2026-09-01', distanceKm: 10, timeSec: 3000 }
strength:
  enabled: true
goal:
  kind: base
  name: Base
  date: '2026-12-27'
  distanceKm: 0
  priority: A
`
    expect(cmdInit(dir, legacy).code).toBe(0); expect(cmdPlan(dir).code).toBe(0)
    expect(cmdMigrate(dir, { apply: proposalId(cmdMigrate(dir)) }).code).toBe(0)
    const strength = [...loadSportsPlan(dir).sessions].sort((a, z) => a.date.localeCompare(z.date)).find((s) => s.sport === 'strength')!
    setLocale('pl')
    try {
      const saved = cmdLog(dir, { session: strength.id, status: 'done' })
      expect(saved.code, saved.output).toBe(0)
      expect(saved.output).toContain(`${strength.id}: wykonana`)
    } finally { setLocale('en') }
  })
  it('records actual swimming repetitions without inferring full duration or distance',async()=>{
    const plan=init(), swim=plan.sessions.find(s=>s.sport==='swim')!, run=plan.sessions.find(s=>s.sport==='run')!
    expect(cmdLog(dir,{session:run.id,sets:'1=3'}).code).toBe(1)
    for(const sets of ['0=3','99=3','1=-1','1=3,1=2','']) expect(cmdLog(dir,{session:swim.id,sets}).code).toBe(1)
    const saved=cmdLog(dir,{session:swim.id,sets:'1=3'})
    expect(saved.code,saved.output).toBe(0)
    expect(saved.data!.entry).toMatchObject({status:'modified',completedRepeats:[{step:1,repeats:3}]})
    const review=await cmdReview(dir,{date:swim.date})
    const row=(review.data!.execution as {sessionId:string;completedRepeats:unknown;durationSec?:number;distanceM?:number}[]).find(e=>e.sessionId===swim.id)!
    expect(row.completedRepeats).toEqual([{step:1,repeats:3}])
    expect(row.durationSec).toBeUndefined();expect(row.distanceM).toBeUndefined()
    expect(review.output).toContain('1=3')
  })
  it('does not freeze generator calendar corrections as manual or approved sessions',()=>{
    // Dwa tygodnie zachowują przesunięcie, rekalibrację i sprawdzenie idempotencji.
    const plan=init('2026-11-15'), source=plan.sessions.find(s=>s.sport==='bike')!
    plan.timeBudgets={[source.date]:0}
    writeFileSync(join(dir,'plan/plan.yaml'),stringify(plan))
    const regenerate=cmdPlan(dir);expect(regenerate.code,regenerate.output).toBe(0)
    const moved=loadSportsPlan(dir).sessions.find(s=>s.id===source.id)!
    expect(moved.date).not.toBe(source.date);expect(moved.approved).toBeUndefined()
    const config=parse(readFileSync(join(dir,'trainctl.yaml'),'utf8')) as SportsConfig
    config.athlete.sports.bike!.ftpWatts=300
    writeFileSync(join(dir,'trainctl.yaml'),stringify(config))
    const recalibrate=cmdPlan(dir);expect(recalibrate.code,recalibrate.output).toBe(0)
    const updated=loadSportsPlan(dir).sessions.find(s=>s.id===source.id)!
    expect(updated.steps).not.toEqual(moved.steps)
    expect(updated.approved).toBeUndefined()
    expect(cmdPlan(dir).data!.changed).toBe(false)
  })
  it('previews per-sport impact, restores the saved prescription and keeps history through regeneration',()=>{
    const plan=init(), source=plan.sessions.find(s=>s.sport==='run')!
    const prepare=cmdReplace(dir,{session:source.id,toSport:'bike'})
    const id=proposalId(prepare), proposal=prepare.data!.proposal as {plan:SportsPlan}
    const record=proposal.plan.replacements.at(-1)!
    expect(record.proposalId).toBe(id)
    expect(record.impact!.sports.find(s=>s.sport==='run')!.deltaMinutes).toBe(-source.durationSec/60)
    expect(cmdReplace(dir,{apply:id}).code).toBe(0)
    const originalBytes=readFileSync(join(dir,'plan/plan.yaml'),'utf8'), target=loadSportsPlan(dir).sessions.find(s=>s.replacesSessionId===source.id)!
    expect(cmdReplace(dir,{session:target.id,restore:true,minutes:20}).code).toBe(1)
    const undo=proposalId(cmdReplace(dir,{session:target.id,restore:true}))
    expect(readFileSync(join(dir,'plan/plan.yaml'),'utf8')).toBe(originalBytes)
    expect(cmdReplace(dir,{apply:undo}).code).toBe(0)
    const restored=loadSportsPlan(dir).sessions.find(s=>s.restoresSessionId===source.id)!
    expect(restored.steps).toEqual(source.steps)
    expect(restored.durationSec).toBe(source.durationSec)
    expect(cmdPlan(dir).code).toBe(0)
    expect(loadSportsPlan(dir).sessions.find(s=>s.id===restored.id)).toEqual(restored)
    expect(loadSportsPlan(dir).sessions.some(s=>s.id===source.id||s.id===target.id)).toBe(false)
    expect(cmdCheck(dir).code).toBe(0)
    expect(cmdLog(dir,{session:restored.id}).code).toBe(0)
    expect(cmdReplace(dir,{session:restored.id,restore:true}).code).toBe(1)
  })
  it('logs an unplanned sport without changing the plan or crediting it to the original sport',async()=>{
    const plan=init(), source=plan.sessions.find(s=>s.sport==='run')!, before=readFileSync(join(dir,'plan/plan.yaml'),'utf8')
    expect(cmdLog(dir,{session:source.id,actualSport:'bike'}).code).toBe(1)
    expect(cmdLog(dir,{session:source.id,actualSport:'bike',status:'skipped',minutes:30}).code).toBe(1)
    expect(cmdLog(dir,{session:source.id,actualSport:'bike',minutes:30,km:'12',rpe:'5',note:'Rain'}).code).toBe(0)
    expect(readFileSync(join(dir,'plan/plan.yaml'),'utf8')).toBe(before)
    const review=await cmdReview(dir,{date:source.date})
    expect(review.code,review.output).toBe(0)
    expect(review.data!.execution).toEqual(expect.arrayContaining([expect.objectContaining({sessionId:source.id,sport:'bike',plannedSport:'run',spontaneous:true,rpe:5,note:'Rain'})]))
    expect(review.data!.actual).toMatchObject({bike:{minutes:30,distanceM:12000},run:{minutes:0,done:0}})
    expect(review.data!.substitutions).toEqual(expect.arrayContaining([expect.objectContaining({source:'journal',fromSport:'run',toSport:'bike'})]))
    for(const s of plan.sessions.filter(s=>s.date<'2026-11-16'&&s.id!==source.id)) expect(cmdLog(dir,{session:s.id,minutes:s.durationSec/120}).code).toBe(0)
    vi.stubEnv('TRAINCTL_TODAY','2026-11-16')
    const adaptation=cmdAdapt(dir,{prepare:true})
    expect(adaptation.code,adaptation.output).toBe(0)
    const proposed=(adaptation.data!.proposal as {plan:SportsPlan}).plan
    expect(proposed.baselines?.run).toBeUndefined()
    expect(proposed.sessions.filter(s=>s.sport==='run')).toEqual(plan.sessions.filter(s=>s.sport==='run'))
  })
  it('initializes sports directly and produces a valid idempotent plan',()=>{
    expect(cmdInit(dir,undefined,{sports:'bike,swim'}).code).toBe(0)
    expect(cmdPlan(dir).code).toBe(0)
    const before=readFileSync(join(dir,'plan/plan.yaml'),'utf8')
    expect(cmdPlan(dir).data?.changed).toBe(false)
    expect(readFileSync(join(dir,'plan/plan.yaml'),'utf8')).toBe(before)
    expect(cmdCheck(dir).code).toBe(0)
  })
  it('prepares, applies and preserves a replacement on regeneration and execution',()=>{
    const p=init(), s=p.sessions.find(s=>s.sport==='run')!, original=readFileSync(join(dir,'plan/plan.yaml'),'utf8')
    const id=proposalId(cmdReplace(dir,{session:s.id,toSport:'bike',reason:'rain'}))
    expect(readFileSync(join(dir,'plan/plan.yaml'),'utf8')).toBe(original)
    expect(cmdReplace(dir,{apply:id}).code).toBe(0)
    const replaced=loadSportsPlan(dir), target=replaced.sessions.find(x=>x.replacesSessionId===s.id)!
    expect(cmdPlan(dir).code).toBe(0)
    expect(loadSportsPlan(dir).sessions.find(x=>x.id===target.id)).toEqual(target)
    expect(loadSportsPlan(dir).sessions.some(x=>x.id===s.id)).toBe(false)
    expect(cmdReplace(dir,{apply:id}).code).toBe(1)
    expect(cmdLog(dir,{session:target.id,status:'done',minutes:40}).code).toBe(0)
    expect(cmdReplace(dir,{session:target.id,toSport:'swim'}).code).toBe(1)
    const today=cmdToday(dir,{date:target.date}); expect(today.code).toBe(0)
    expect(today.data!.execution).toEqual(expect.arrayContaining([expect.objectContaining({sessionId:target.id,status:'done',replacement:true})]))
    expect(cmdCheck(dir).code).toBe(0)
  })
  it('invalidates a proposal after config, journal, snapshot or day changes',()=>{
    const p=init(), s=p.sessions.find(s=>s.sport==='run')!
    for(const file of ['trainctl.yaml','log.jsonl','sync.json']){
      const before=existsSync(join(dir,file))?readFileSync(join(dir,file),'utf8'):undefined
      const id=proposalId(cmdReplace(dir,{session:s.id,toSport:'swim'}))
      writeFileSync(join(dir,file),(before??'')+'\n')
      expect(cmdReplace(dir,{apply:id}).code).toBe(1)
      if(before!==undefined)writeFileSync(join(dir,file),before);else rmSync(join(dir,file))
    }
    const id=proposalId(cmdReplace(dir,{session:s.id,toSport:'bike'}));vi.stubEnv('TRAINCTL_TODAY','2026-11-03')
    expect(cmdReplace(dir,{apply:id}).code).toBe(1)
  })
  it('requires a session ID when a day is ambiguous and permits separate logs',()=>{
    const p=init(), s=p.sessions[0]!, second={...s,id:'same-day-second',sport:'bike' as const}; p.sessions.push(second)
    writeFileSync(join(dir,'plan/plan.yaml'),stringify(p))
    expect(cmdLog(dir,{date:s.date}).code).toBe(1)
    expect(cmdLog(dir,{session:s.id}).code).toBe(0)
    expect(cmdLog(dir,{session:second.id}).code).toBe(0)
    expect(readFileSync(join(dir,'log.jsonl'),'utf8').trim().split('\n')).toHaveLength(2)
  })
  it('shortens whole swimming repeats and exports distinct session IDs',()=>{
    const p=init(), s=p.sessions.find(s=>s.sport==='swim')!
    const id=proposalId(cmdShorten(dir,{session:s.id,minutes:25}))
    expect(cmdShorten(dir,{apply:id}).code).toBe(0)
    expect(cmdExport(dir,{what:'all'}).code).toBe(0)
    expect(existsSync(join(dir,`export/${s.id}.fit`))).toBe(true)
    const ics=readFileSync(join(dir,'export/plan.ics'),'utf8')
    expect((ics.match(/UID:/g)??[])).toHaveLength(p.sessions.length)
    expect(new Set(ics.replace(/\r\n /g,'').split('\n').filter(l=>l.startsWith('UID:'))).size).toBe(p.sessions.length)
  })
  it('cancels replaced calendar events and removes only managed obsolete FIT files',()=>{
    const p=init(), s=p.sessions.find(s=>s.sport==='run')!
    expect(cmdExport(dir,{what:'all'}).code).toBe(0)
    writeFileSync(join(dir,'export/user-owned.fit'),'keep')
    const id=proposalId(cmdReplace(dir,{session:s.id,toSport:'bike'}))
    expect(cmdReplace(dir,{apply:id}).code).toBe(0)
    expect(cmdExport(dir,{what:'all'}).code).toBe(0)
    expect(existsSync(join(dir,`export/${s.id}.fit`))).toBe(false)
    expect(readFileSync(join(dir,'export/user-owned.fit'),'utf8')).toBe('keep')
    const calendar=readFileSync(join(dir,'export/plan.ics'),'utf8').replace(/\r\n /g,'')
    const oldEvent=calendar.split('BEGIN:VEVENT').find(e=>e.includes(`UID:trainctl-${p.id}-${s.id}@trainctl`))!
    expect(oldEvent).toContain('STATUS:CANCELLED')
  })
  it('opens a new cycle while retaining past sessions and keeping later regeneration stable',()=>{
    const p=init();vi.stubEnv('TRAINCTL_TODAY','2026-11-16')
    const cfg=parse(readFileSync(join(dir,'trainctl.yaml'),'utf8')) as SportsConfig
    cfg.goal={kind:'multisport',name:'Duathlon',date:'2027-01-10',legs:[{id:'run1',sport:'run',distanceM:5000,estimatedMinutes:30},{id:'ride',sport:'bike',distanceM:20000,estimatedMinutes:50},{id:'run2',sport:'run',distanceM:2500,estimatedMinutes:15}]}
    writeFileSync(join(dir,'trainctl.yaml'),stringify(cfg))
    expect(cmdPlan(dir).code).toBe(1)
    const r=cmdPlan(dir,{fresh:true});expect(r.code,r.output).toBe(0)
    const next=loadSportsPlan(dir)
    expect(next.cycleId).not.toBe(p.cycleId)
    expect(next.sessions.filter(s=>s.date<'2026-11-16')).toEqual(p.sessions.filter(s=>s.date<'2026-11-16'))
    expect(next.sessions.filter(s=>s.purpose==='race')).toHaveLength(3)
    expect(cmdPlan(dir).code).toBe(0)
    expect(loadSportsPlan(dir)).toEqual(next)
  })
  it('preserves approved moves and refuses past changes',()=>{
    const p=init(), s=p.sessions.find(s=>s.date==='2026-11-02')!
    expect(cmdShift(dir,{session:s.id,from:s.date,to:'2026-11-08'}).code).toBe(0)
    expect(cmdPlan(dir).code).toBe(0)
    expect(loadSportsPlan(dir).sessions.find(x=>x.id===s.id)!.date).toBe('2026-11-08')
    vi.stubEnv('TRAINCTL_TODAY','2026-11-09')
    expect(cmdReplace(dir,{session:s.id,toSport:'swim'}).code).toBe(1)
  })
  it('does not adapt incomplete telemetry or mix disciplines',()=>{
    const p=init();vi.stubEnv('TRAINCTL_TODAY','2026-11-16')
    expect(cmdAdapt(dir,{prepare:true}).data?.changed).toBe(false)
    for(const s of p.sessions.filter(s=>s.date<'2026-11-16'&&s.sport==='bike')) expect(cmdLog(dir,{session:s.id,status:'modified',minutes:s.durationSec/120}).code).toBe(0)
    const r=cmdAdapt(dir,{prepare:true}), id=proposalId(r)
    expect(cmdAdapt(dir,{apply:id}).code).toBe(0)
    const next=loadSportsPlan(dir)
    expect(next.sessions.filter(s=>s.sport==='run')).toEqual(p.sessions.filter(s=>s.sport==='run'))
    expect(next.baselines!.bike!.weeklyMinutes).toBeLessThan(90)
    expect(cmdPlan(dir).code).toBe(0)
    expect(cmdCheck(dir).code).toBe(0)
  })
  it('migrates v1 without losing original workouts, history or logs',()=>{
    const legacy=`athlete:\n  recentWeeklyKm: 35\n  daysAvailable: [tue, thu, sat, sun]\n  longRunDay: sun\n  results:\n    - { date: '2026-09-01', distanceKm: 10, timeSec: 3000 }\ngoal:\n  kind: base\n  name: Base\n  date: '2026-12-27'\n  distanceKm: 0\n  priority: A\n`
    expect(cmdInit(dir,legacy).code).toBe(0);expect(cmdPlan(dir).code).toBe(0)
    const old=readFileSync(join(dir,'plan/plan.yaml'),'utf8'), parsed=parse(old)
    const day=parsed.weeks.flatMap((w:any)=>w.days).find((d:any)=>d.workout)
    expect(cmdLog(dir,{date:day.date,status:'done'}).code).toBe(0)
    const originalLog=readFileSync(join(dir,'log.jsonl'),'utf8')
    const id=proposalId(cmdMigrate(dir,{prepare:true}));expect(readFileSync(join(dir,'plan/plan.yaml'),'utf8')).toBe(old)
    const apply=cmdMigrate(dir,{apply:id});expect(apply.code,apply.output).toBe(0)
    const p=loadSportsPlan(dir)
    expect(p.legacy!.plan).toEqual(parsed)
    expect(p.sessions.find(s=>s.date===day.date&&s.sport==='run')!.legacyWorkout).toEqual(day.workout)
    expect(readFileSync(join(dir,`plan/migrations/${id}/log.jsonl`),'utf8')).toBe(originalLog)
    expect(cmdPlan(dir).code).toBe(0)
    expect(loadSportsPlan(dir).sessions).toEqual(p.sessions)
    expect(cmdCheck(dir).code).toBe(0)
  })
  it('recalibrates migrated running while preserving a swap and a logged day',()=>{
    const legacy = `athlete:
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
    expect(cmdInit(dir,legacy).code).toBe(0); expect(cmdPlan(dir).code).toBe(0)
    expect(cmdMigrate(dir,{apply:proposalId(cmdMigrate(dir))}).code).toBe(0)
    const cfg=parse(readFileSync(join(dir,'trainctl.yaml'),'utf8')) as SportsConfig
    cfg.athlete.sports.bike={weeklyMinutes:90,sessionsPerWeek:2,ftpWatts:220}
    writeFileSync(join(dir,'trainctl.yaml'),stringify(cfg))
    const before=loadSportsPlan(dir), source=before.sessions.find(s=>s.sport==='run')!
    expect(cmdReplace(dir,{apply:proposalId(cmdReplace(dir,{session:source.id,toSport:'bike'}))}).code).toBe(0)
    const swapped=loadSportsPlan(dir).sessions.find(s=>s.replacesSessionId===source.id)!
    const logged=before.sessions.find(s=>s.id!==source.id&&s.sport==='run')!
    expect(cmdLog(dir,{session:logged.id}).code).toBe(0)
    cfg.athlete.sports.run!.results!.push({date:'2026-11-01',distanceKm:10,timeSec:2700})
    writeFileSync(join(dir,'trainctl.yaml'),stringify(cfg))
    const result=cmdPlan(dir); expect(result.code,result.output).toBe(0)
    const after=loadSportsPlan(dir)
    expect(after.sessions.find(s=>s.id===swapped.id)).toEqual(swapped)
    expect(after.sessions.some(s=>s.id===source.id)).toBe(false)
    expect(after.sessions.find(s=>s.id===logged.id)).toEqual(logged)
    expect(after.sessions.some(s=>s.sport==='run'&&s.id!==logged.id&&JSON.stringify(s.legacyWorkout)!==JSON.stringify(before.sessions.find(b=>b.id===s.id)?.legacyWorkout))).toBe(true)
    expect(cmdPlan(dir).data?.changed).toBe(false)
  })
  it('migrates a race with unknown stored duration and retains the running recovery and race pack',()=>{
    expect(cmdInit(dir).code).toBe(0);expect(cmdPlan(dir).code).toBe(0)
    const old=parse(readFileSync(join(dir,'plan/plan.yaml'),'utf8'))
    expect(cmdExport(dir,{what:'race'}).code).toBe(0)
    const oldHtml=readFileSync(join(dir,'export',readdirSync(join(dir,'export')).find(f=>f.endsWith('.html'))!),'utf8')
    const id=proposalId(cmdMigrate(dir));expect(cmdMigrate(dir,{apply:id}).code).toBe(0)
    const before=loadSportsPlan(dir),race=before.sessions.find(s=>s.purpose==='race'&&s.date===old.goal.date)!
    expect(race.durationSec).toBeGreaterThan(0)
    expect(race.durationSource).toBe('running-prediction')
    const regenerated=cmdPlan(dir);expect(regenerated.code,regenerated.output).toBe(0)
    expect(loadSportsPlan(dir).sessions).toEqual(before.sessions)
    expect(cmdExport(dir,{what:'racepack'}).code).toBe(0)
    expect(readFileSync(join(dir,'export/racepack.html'),'utf8')).toBe(oldHtml)
    expect(cmdCheck(dir).code).toBe(0)
  })
  it('publishes the replacement before deleting the original; retries partial failures',async()=>{
    const p=init(), s=p.sessions.find(s=>s.sport==='run')!
    s.externalId='user-event';writeFileSync(join(dir,'plan/plan.yaml'),stringify(p))
    const id=proposalId(cmdReplace(dir,{session:s.id,toSport:'bike'}))
    expect(cmdReplace(dir,{apply:id}).code).toBe(0)
    const calls:string[]=[], sent:PushableWorkout[]=[];let fail=true
    const provider:SyncProvider={name:'fake',verify:async()=>({athleteId:'a'}),listActivities:async()=>[],listWellness:async()=>[],
      pushWorkouts:async ws=>{calls.push('push');sent.push(...ws);return{pushed:fail?0:ws.length,externalIds:fail?[]:ws.map(w=>w.externalId)}},
      listPlannedWorkouts:async()=>[{id:'old',date:s.date,externalId:sessionExternalId(p,s)},{id:'foreign',date:s.date,externalId:'trainctl-other-plan'},{id:'user',date:s.date,externalId:'user-event'}],deleteWorkout:async id=>{calls.push('delete:'+id)}}
    expect((await cmdPush(dir,{from:s.date,to:s.date},()=>provider)).code).toBe(1)
    expect(calls).toEqual(['push']);fail=false
    expect((await cmdPush(dir,{from:s.date,to:s.date},()=>provider)).code).toBe(0)
    expect(calls).toEqual(['push','push','delete:old'])
    expect(sent.every(w=>w.sport==='bike')).toBe(true)
  })
})
