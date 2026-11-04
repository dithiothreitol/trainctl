/** Real CLI processes and reviewable synthetic examples; never touches a user's plan. */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { SportsConfig, SportsPlan, TrainingSession } from '../packages/core/src/sports/types.ts'

const root=fileURLToPath(new URL('..',import.meta.url))
mkdirSync(join(root,'artifacts'),{recursive:true})
const out=mkdtempSync(join(root,'artifacts/coaching-')), workspace=join(out,'training')
mkdirSync(workspace)
const config:SportsConfig={schemaVersion:2,language:'pl',athlete:{sports:{
  run:{weeklyMinutes:90,sessionsPerWeek:2,experience:'regular'},
  bike:{weeklyMinutes:240,sessionsPerWeek:3,experience:'trained',ftpWatts:250,calibration:{date:'2026-11-01',source:'synthetic test'},resources:['bike','powerMeter']},
  swim:{weeklyMinutes:180,sessionsPerWeek:3,experience:'trained',cssSecPer100m:120,poolLengthM:25,calibration:{date:'2026-11-01',source:'synthetic test'},resources:['pool']},
}},goal:{kind:'multisport',name:'Przykładowy triathlon',date:'2026-12-27',legs:[{id:'swim',sport:'swim',distanceM:1500,estimatedMinutes:35},{id:'bike',sport:'bike',distanceM:40000,estimatedMinutes:90},{id:'run',sport:'run',distanceM:10000,estimatedMinutes:60}]},maxSessionsPerDay:2,brick:{day:'sat',bikeMinutes:40,runMinutes:20,transitionMinutes:5}}
writeFileSync(join(workspace,'trainctl.yaml'),JSON.stringify(config,null,2))
let cliCommands=0
function cli(args:string[],json=true) {
  const r=spawnSync(process.execPath,[join(root,'packages/cli/src/bin.ts'),'-C',workspace,...(json?['--json']:[]),...args],{cwd:root,encoding:'utf8',windowsHide:true,timeout:30000,maxBuffer:20*1024*1024,env:{...process.env,TRAINCTL_TODAY:'2026-11-02',TRAINCTL_LANG:'pl',TRAINCTL_INTERVALS_API_KEY:'',NO_COLOR:'1'}})
  assert.equal(r.status,0,args.join(' ')+'\n'+r.stdout+'\n'+r.stderr)
  cliCommands++
  return json?JSON.parse(r.stdout).data:r.stdout
}
const plan=cli(['plan']).plan as SportsPlan
cli(['check'])
assert(plan.sessions.every(s=>s.coaching?.objective))
const samples=[
  plan.sessions.find(s=>s.sport==='bike'&&s.purpose==='intervals'&&s.phase==='build')!,
  plan.sessions.find(s=>s.sport==='swim'&&s.purpose==='technique')!,
  plan.sessions.find(s=>s.coaching?.recipeId==='run-brick')!,
]
for(const s of samples){
  assert(s)
  const why=cli(['why','--session',s.id]).sessions[0] as TrainingSession
  assert.deepEqual(why.coaching,s.coaching)
  const text=cli(['today','--session',s.id],false) as string
  assert(text.includes('Cel')&&text.includes('RPE'))
  writeFileSync(join(out,s.sport+'.txt'),text)
  writeFileSync(join(out,s.sport+'.json'),JSON.stringify(why,null,2))
  cli(['export','--what','html','--session',s.id])
  copyFileSync(join(workspace,'export/plan.html'),join(out,s.sport+'.html'))
}
cli(['export','--what','all'])
const source=plan.sessions.find(s=>s.sport==='run'&&!s.groupId&&s.purpose!=='race')!
const proposal=cli(['replace','--session',source.id,'--to-sport','swim','--prepare']).proposal
const replaced=cli(['replace','--apply',proposal.id]).plan as SportsPlan
const target=replaced.sessions.find(s=>s.replacesSessionId===source.id)!
assert.equal(target.sport,'swim');assert(target.coaching?.recipeId.startsWith('swim-'))
assert.deepEqual(replaced.archive.find(s=>s.id===source.id)!.coaching,source.coaching)
const restore=cli(['replace','--session',target.id,'--restore']).proposal
const restored=cli(['replace','--apply',restore.id]).plan as SportsPlan
assert.deepEqual(restored.sessions.find(s=>s.restoresSessionId===source.id)!.coaching,source.coaching)
cli(['check'])
const summary={result:'PASS',cliCommands,sessions:plan.sessions.length,recipes:[...new Set(plan.sessions.map(s=>s.coaching!.recipeId))].sort(),examples:samples.map(s=>({sport:s.sport,recipe:s.coaching!.recipeId})),output:out}
writeFileSync(join(out,'summary.json'),JSON.stringify(summary,null,2))
console.log(JSON.stringify(summary))
