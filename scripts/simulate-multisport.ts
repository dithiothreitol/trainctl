/** Reproducible end-to-end simulation using the actual CLI, isolated from user plans. */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { Decoder, Stream } from '@garmin/fitsdk'
import { createAcceptanceBundle, verifySportsCalendar } from './multisport-evidence.ts'
const {parse,stringify}=createRequire(new URL('../packages/cli/package.json',import.meta.url))('yaml')

const root=resolve(fileURLToPath(new URL('..',import.meta.url)))
const binary=process.env.TRAINCTL_SIMULATION_BIN ?? join(root,'packages/cli/src/bin.ts')
const dir=mkdtempSync(join(tmpdir(),'trainctl-simulation-'))
let current = dir
const commands:{command:string;code:number}[]=[]
const artifacts=createAcceptanceBundle(root,process.argv.includes('--artifacts'))
const fitSdkVersion=createRequire(import.meta.url)('@garmin/fitsdk/package.json').version
let fitFilesVerified=0
let calendarFilesVerified=0, calendarEventsVerified=0
const currentPlan=()=>parse(readFileSync(join(current,'plan/plan.yaml'),'utf8'))
const currentCalendar=()=>readFileSync(join(current,'export/plan.ics'),'utf8')
function captureCalendar(path:string) { artifacts?.calendar(path,currentCalendar(),currentPlan()) }
function captureExports(scenario:string) { artifacts?.exports(scenario,join(current,'export'),currentPlan()) }
function verifyFitExports() {
  const plan=parse(readFileSync(join(current,'plan/plan.yaml'),'utf8'))
  const expected=plan.sessions.filter((s:any)=>s.sport!=='strength')
  const files=readdirSync(join(current,'export')).filter(file=>file.endsWith('.fit')).sort()
  assert.deepEqual(files,expected.map((s:any)=>`${s.id}.fit`).sort())
  for(const file of files) {
    const session=expected.find((s:any)=>`${s.id}.fit`===file)
    const decoder=new Decoder(Stream.fromBuffer(readFileSync(join(current,'export',file))))
    assert(decoder.isFIT(),file);assert(decoder.checkIntegrity(),file)
    const {messages,errors}=decoder.read()
    assert.deepEqual(errors,[],file)
    assert.equal(messages.fileIdMesgs?.[0]?.type,'workout',file)
    assert.equal(messages.workoutMesgs?.length,1,file)
    const header=messages.workoutMesgs![0]!, steps=messages.workoutStepMesgs??[]
    assert.equal(header.sport,({run:'running',bike:'cycling',swim:'swimming'} as Record<string,string>)[session.sport],file)
    assert.equal(header.numValidSteps,steps.length,file)
    if(session.poolLengthM) assert.equal(header.poolLength,session.poolLengthM,file)
    steps.forEach((step,i)=>{
      assert.equal(step.messageIndex,i,file)
      if(step.durationType==='repeatUntilStepsCmplt') {
        assert(Number.isInteger(step.durationStep)&&step.durationStep!>=0&&step.durationStep!<i,file)
        assert(Number.isInteger(step.repeatSteps)&&step.repeatSteps!>1,file)
      }
    })
    fitFilesVerified++
  }
}
function cli(args:string[]) {
  const r=spawnSync(process.execPath,[binary,'-C',current,'--json',...args],{
    cwd:root,encoding:'utf8',windowsHide:true,env:{...process.env,TRAINCTL_TODAY:'2026-11-02',TRAINCTL_LANG:'pl',TRAINCTL_INTERVALS_API_KEY:''},maxBuffer:10*1024*1024,timeout:30_000,
  })
  assert.equal(r.status,0,`${args.join(' ')}: ${r.error?.message??''}\n${r.stdout}\n${r.stderr}`)
  const parsed=JSON.parse(r.stdout)
  commands.push({command:args.join(' '),code:r.status??1})
  if(args[0]==='export'&&['all','ics'].includes(args[args.indexOf('--what')+1]!)) {
    calendarEventsVerified+=verifySportsCalendar(currentCalendar(),currentPlan()).length
    calendarFilesVerified++
  }
  return parsed.data
}
try {
  cli(['init','--sports','run,bike,swim'])
  const {plan}=cli(['plan'])
  cli(['export','--what','ics']);captureCalendar('calendar/01-original.ics')
  const replacements=[]
  for(const from of ['run','bike','swim']) for(const to of ['run','bike','swim'].filter(x=>x!==from)) {
    const source=plan.sessions.find((s:any)=>s.sport===from&&!replacements.some(r=>r.source===s.id))
    const {proposal}=cli(['replace','--session',source.id,'--to-sport',to,'--prepare'])
    assert.equal(proposal.plan.replacements.at(-1).proposalId,proposal.id)
    assert(proposal.plan.replacements.at(-1).impact.sports.some((s:any)=>s.deltaMinutes<0))
    const applied=cli(['replace','--apply',proposal.id])
    const target=applied.plan.sessions.find((s:any)=>s.replacesSessionId===source.id)
    assert.equal(target.sport,to)
    replacements.push({from,to,source:source.id,target:target.id,date:target.date})
  }
  const undoTarget=replacements[1]!
  const undo=cli(['replace','--session',undoTarget.target,'--restore']).proposal
  const restoredPlan=cli(['replace','--apply',undo.id]).plan
  const restored=restoredPlan.sessions.find((s:any)=>s.restoresSessionId===undoTarget.source)
  assert.deepEqual(restored.steps,plan.sessions.find((s:any)=>s.id===undoTarget.source).steps)
  const historical=readFileSync(join(dir,'plan/plan.yaml'),'utf8')
  cli(['log','--session',restored.id,'--actual-sport','swim','--minutes','25','--meters','1000','--rpe','4','--note','Pool instead of running'])
  assert.equal(readFileSync(join(dir,'plan/plan.yaml'),'utf8'),historical)
  const reviewed=cli(['review','--date',restored.date])
  assert(reviewed.execution.some((e:any)=>e.sessionId===restored.id&&e.sport==='swim'&&e.plannedSport==='run'&&e.spontaneous&&e.rpe===4))
  assert.equal(reviewed.actual.run.minutes,0)
  cli(['plan']);cli(['check'])
  assert.equal(cli(['diff','--plan',join(dir,'plan/plan.yaml')]).changed,false)
  cli(['status']);cli(['week','--sport','swim'])
  const target=replacements[0]!
  cli(['log','--session',target.target,'--status','done','--minutes','35'])
  const today=cli(['today','--date',target.date])
  assert(today.execution.some((e:any)=>e.sessionId===target.target&&e.status==='done'&&e.replacement))
  assert(!today.execution.some((e:any)=>e.sessionId===target.source))
  cli(['why','--session',target.target])
  const swim=restoredPlan.sessions.find((s:any)=>s.sport==='swim'&&s.id!==restored.id&&s.id!==target.target)
  assert.deepEqual(cli(['log','--session',swim.id,'--sets','1=3']).entry.completedRepeats,[{step:1,repeats:3}])
  const scheduled=cli(['reschedule','--date','2026-11-09','--preparation','12','--sport','bike'])
  cli(['reschedule','--apply',scheduled.proposal.id]);cli(['check'])
  cli(['export','--what','all'])
  verifyFitExports()
  captureCalendar('calendar/02-replacements.ics');captureExports('replacements')
  const ics=readFileSync(join(dir,'export/plan.ics'),'utf8').replace(/\r\n /g,'')
  const ids=ics.split('\n').filter(l=>l.startsWith('UID:'))
  assert.equal(new Set(ids).size,ids.length)
  current=join(dir,'migration');mkdirSync(current)
  cli(['init','--template']);const legacy=cli(['plan']).plan
  const migration=cli(['migrate','--prepare']).proposal
  cli(['migrate','--apply',migration.id])
  const migrated=cli(['plan']).plan
  assert(migrated.legacy)
  const cfg=parse(readFileSync(join(current,'trainctl.yaml'),'utf8'))
  cfg.athlete.sports.bike={weeklyMinutes:90,sessionsPerWeek:2,ftpWatts:210}
  cfg.athlete.sports.run.results.push({date:'2026-11-01',distanceKm:10,timeSec:2450})
  writeFileSync(join(current,'trainctl.yaml'),stringify(cfg))
  const calibrated=cli(['plan']).plan
  assert(calibrated.sessions.some((s:any)=>s.sport==='bike'))
  assert(calibrated.sessions.some((s:any)=>s.sport==='run'&&JSON.stringify(s.legacyWorkout)!==JSON.stringify(migrated.sessions.find((old:any)=>old.id===s.id)?.legacyWorkout)))
  cli(['check']);cli(['export','--what','all'])
  verifyFitExports()
  captureExports('migration')
  current=join(dir,'duathlon');mkdirSync(current)
  cli(['init','--sports','run,bike,swim'])
  const multi=parse(readFileSync(join(current,'trainctl.yaml'),'utf8'))
  multi.athlete.sports.swim.cssSecPer100m=120
  multi.athlete.sports.swim.calibration={date:"2026-11-01",source:"simulation CSS test"}
  multi.goal={kind:'multisport',name:'Duathlon',date:'2026-11-29',legs:[{id:'run1',sport:'run',distanceM:5000,estimatedMinutes:30},{id:'bike',sport:'bike',distanceM:20000,estimatedMinutes:45},{id:'run2',sport:'run',distanceM:2500,estimatedMinutes:15}]}
  multi.goal.transitionsSec=[180,120]
  multi.availabilityExceptions={'2026-11-03':[]}
  multi.tuneUpGoals=[{kind:'race',name:'Bike C',date:'2026-11-15',sport:'bike',distanceM:10000,estimatedMinutes:25,priority:'C'}]
  multi.brick={day:'sat',bikeMinutes:35,runMinutes:15,transitionMinutes:5}
  writeFileSync(join(current,'trainctl.yaml'),stringify(multi))
  const multisport=cli(['plan']).plan
  assert(multisport.sessions.some((s:any)=>s.sport==='swim'&&s.steps.some((step:any)=>step.repeat>1&&step.stroke==='freestyle'&&step.target.kind==='pace')))
  const stages=multisport.groups.find((g:any)=>g.kind==='race'&&g.id.endsWith('-race')).sessionIds.map((id:string)=>multisport.sessions.find((s:any)=>s.id===id).sport)
  assert.deepEqual(stages,['run','bike','run'])
  assert(multisport.sessions.some((s:any)=>s.racePriority==='C'))
  assert(multisport.groups.some((g:any)=>g.kind==='brick'))
  assert(!multisport.sessions.some((s:any)=>s.date==='2026-11-03'))
  assert.deepEqual(multisport.groups.find((g:any)=>g.id.endsWith('-race')).transitionsSec,[180,120])
  cli(['check']);cli(['export','--what','all'])
  verifyFitExports()
  captureExports('duathlon')
  for(const file of ['plan.html','plan.ics']) {
    const exported=readFileSync(join(current,'export',file),'utf8').replace(/\r\n /g,'')
    assert(exported.includes('T1=180'));assert(exported.includes('T2=120'))
  }
  current=join(dir,'calendar-lifecycle');mkdirSync(current)
  cli(['init','--sports','bike'])
  const original=cli(['plan']).plan
  cli(['export','--what','ics'])
  const originalCalendar=readFileSync(join(current,'export/plan.ics'),'utf8')
  captureCalendar('calendar-lifecycle/01-active.ics')
  cli(['export','--what','ics'])
  assert.equal(readFileSync(join(current,'export/plan.ics'),'utf8'),originalCalendar)
  const cycling=parse(readFileSync(join(current,'trainctl.yaml'),'utf8'))
  cycling.athlete.sports.bike.sessionsPerWeek=1
  writeFileSync(join(current,'trainctl.yaml'),stringify(cycling))
  const reduced=cli(['plan']).plan
  assert(reduced.retiredSessionIds.length>0)
  cli(['export','--what','ics'])
  const cancelledState=JSON.parse(readFileSync(join(current,'plan/calendar.json'),'utf8'))
  captureCalendar('calendar-lifecycle/02-withdrawn.ics')
  const cancelledEvents=verifySportsCalendar(currentCalendar(),reduced)
  assert.equal((readFileSync(join(current,'export/plan.ics'),'utf8').match(/STATUS:CANCELLED/g)??[]).length,reduced.retiredSessionIds.length)
  cycling.athlete.sports.bike.sessionsPerWeek=2
  writeFileSync(join(current,'trainctl.yaml'),stringify(cycling))
  const reactivated=cli(['plan']).plan
  assert.deepEqual(reactivated.sessions.map((s:any)=>s.id).sort(),original.sessions.map((s:any)=>s.id).sort())
  assert.equal(reactivated.archive.length,0)
  cli(['check']);cli(['export','--what','all'])
  verifyFitExports()
  captureCalendar('calendar-lifecycle/03-reactivated.ics');captureExports('calendar-lifecycle')
  const activeEvents=verifySportsCalendar(currentCalendar(),reactivated)
  const activeState=JSON.parse(readFileSync(join(current,'plan/calendar.json'),'utf8'))
  for(const id of reduced.retiredSessionIds) {
    assert(activeState.events[id].sequence>cancelledState.events[id].sequence)
    const uid=`trainctl-${reactivated.id}-${id}@trainctl`
    assert(activeEvents.find(e=>e.uid===uid)!.sequence>cancelledEvents.find(e=>e.uid===uid)!.sequence)
  }
  assert(!readFileSync(join(current,'export/plan.ics'),'utf8').includes('STATUS:CANCELLED'))
  const loggedRide=reactivated.sessions[0]
  const activityCopies=['a','b','c'].map((importSource,i)=>({externalId:'ride',importSource,date:loggedRide.date,type:'Ride',startTime:`${loggedRide.date}T12:00:0${i*2}Z`,movingTimeSec:1800,distanceKm:15}))
  writeFileSync(join(current,'sync.json'),JSON.stringify({pulledAt:new Date().toISOString(),activities:activityCopies,wellness:[]}))
  const ambiguous=cli(['review','--date',loggedRide.date]).execution.find((e:any)=>e.sessionId===loggedRide.id)
  assert.equal(ambiguous.status,'unknown');assert.deepEqual(ambiguous.candidates.sort(),['a/ride','b/ride','c/ride'])
  cli(['log','--session',loggedRide.id,'--activity','b/ride'])
  const explicit=cli(['review','--date',loggedRide.date]).execution.find((e:any)=>e.sessionId===loggedRide.id)
  assert.equal(explicit.status,'done');assert.equal(explicit.durationSec,1800)
  assert.deepEqual(explicit.activityIds,['b/ride'])
  const result={date:'2026-11-02',result:'PASS',commands:commands.length,directions:replacements.map(r=>`${r.from}->${r.to}`),calendarEvents:ids.length,cancelledEvents:(ics.match(/STATUS:CANCELLED/g)??[]).length,fitFilesVerified,fitSdkVersion,calendarFilesVerified,calendarEventsVerified,artifactDirectory:artifacts?.directory,checks:['CLI exit codes','six replacement directions','proposal IDs and weekly volume impact','restore archived prescription','spontaneous sport without historical plan mutation','per-sport execution and feedback','regeneration preserves replacements','journal matches active replacement','one active session per replacement','FIT/HTML/ICS export','independent Garmin FIT SDK decoding','independent ICAL.js parsing','unique calendar UIDs','status and why','scenario diff','preparation and reschedule','migration and running recalibration','duathlon stage order','secondary race','brick groups','withdrawal and reactivation preserve IDs','calendar cancellation revisions','unchanged calendar is byte-identical','ambiguous activity copies remain separate','explicit activity selection preserves source identity'],networkUsed:false}
  artifacts?.finish(result)
  console.log(JSON.stringify(result,null,2))
} finally { rmSync(dir,{recursive:true,force:true,maxRetries:3}) }
