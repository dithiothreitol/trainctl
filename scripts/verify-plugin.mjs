#!/usr/bin/env node
/** Sonda rzeczywistych procesów CLI i MCP z przeniesionej kopii pluginu. Dane wyłącznie syntetyczne. */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { appendFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
const supplied=resolve(process.argv[2] ?? join(root,'plugin'))
const output=resolve(process.argv[3] ?? mkdtempSync(join(root,'artifacts/plugin-check-')))
mkdirSync(output,{recursive:true})
const isolated=mkdtempSync(join(tmpdir(),'trainctl-plugin-check-'))
const plugin=join(isolated,'plugin with spaces')
cpSync(supplied,plugin,{recursive:true})
const cliBin=join(plugin,'scripts/trainctl.mjs')
const require=createRequire(join(root,'packages/mcp/package.json'))
const {Client}=await import(pathToFileURL(require.resolve('@modelcontextprotocol/sdk/client/index.js')).href)
const {StdioClientTransport}=await import(pathToFileURL(require.resolve('@modelcontextprotocol/sdk/client/stdio.js')).href)
const env={...process.env,TRAINCTL_TODAY:'2026-11-02',TRAINCTL_LANG:'pl',TRAINCTL_INTERVALS_API_KEY:'',NO_COLOR:'1'}
const transcript=[], clients=[], called=new Set()
let toolCount=0, resourcesCount=0, promptsCount=0
const save=(name,data)=>writeFileSync(join(output,name),JSON.stringify(data,null,2)+'\n')
const cliDir=join(isolated,'CLI training'),mcpDir=join(isolated,'MCP training')
mkdirSync(cliDir);mkdirSync(mcpDir)
function cli(args, expected=0, json=true, dir=cliDir) {
  const result=spawnSync(process.execPath,[cliBin,'-C',dir,...(json?['--json']:[]),...args],{cwd:isolated,env,encoding:'utf8',timeout:30000,maxBuffer:20*1024*1024,windowsHide:true})
  transcript.push({surface:'CLI',args,code:result.status,stdout:result.stdout,stderr:result.stderr})
  assert.equal(result.status,expected,`${args.join(' ')}: ${result.error?.message??''}\n${result.stdout}\n${result.stderr}`)
  return json?JSON.parse(result.stdout):result.stdout
}
async function connect(dir,language='pl') {
  const manifest=JSON.parse(readFileSync(join(plugin,'.codex-plugin/plugin.json'),'utf8'))
  const config=JSON.parse(readFileSync(resolve(plugin,manifest.mcpServers),'utf8')).mcpServers.trainctl
  assert.equal(config.command,'node')
  const args=config.args.map(s=>s.replaceAll('${PLUGIN_ROOT}',plugin))
  assert(args.every(s=>!s.includes('${')))
  const transport=new StdioClientTransport({command:process.execPath,args,cwd:plugin,env:{...env,TRAINCTL_LANG:language,TRAINCTL_DIR:'',PLUGIN_ROOT:plugin},stderr:'pipe'})
  let stderr='';transport.stderr?.on('data',chunk=>{stderr+=chunk})
  const client=new Client({name:'trainctl-plugin-audit',version:'1.0.0'})
  clients.push(client)
  await client.connect(transport)
  const version=JSON.parse(readFileSync(join(plugin,'runtime/package.json'),'utf8')).version
  assert.equal(client.getServerVersion().version,version)
  transcript.push({surface:'MCP',method:'initialize',response:client.getServerVersion()})
  await call(client,'today',{},true)
  await call(client,'workspace',{directory:plugin},true)
  assert(!existsSync(join(plugin,'trainctl.yaml')))
  assert.equal((await call(client,'workspace',{directory:dir})).selected,true)
  await call(client,'workspace',{directory:isolated},true)
  assert.equal((await call(client,'workspace')).directory,dir)
  return {client,stderr:()=>stderr}
}
async function call(client,name,args={},expectedError=false) {
  const response=await client.callTool({name:'trainctl_'+name,arguments:args})
  called.add('trainctl_'+name)
  transcript.push({surface:'MCP',method:'tools/call',name:'trainctl_'+name,args,response})
  assert.equal(!!response.isError,expectedError,`${name}: ${JSON.stringify(response.content)}`)
  if (!expectedError) assert.equal(response.structuredContent.code,0)
  return response.structuredContent?.data
}
let failure
try {
  // Pomoc wszystkich publicznych komend i oba języki z faktycznej binarki.
  const names=[...readFileSync(join(root,'packages/cli/src/bin.ts'),'utf8').matchAll(/\.command\('([a-z-]+)'\)/g)].map(m=>m[1])
  for(const name of names) assert(cli([name,'--help'],0,false).includes(name))
  assert(cli(['--lang','en','--help'],0,false).includes('training'))
  cli(['unknown-command'],2,false)
  cli(['init','--sports','bike','--from-intervals','--template'],1)
  assert(!existsSync(join(cliDir,'trainctl.yaml')))
  cli(['init','--sports','run,bike,swim','--template'])
  const plan=cli(['plan']).data.plan
  const first=plan.sessions.find(s=>s.sport==='run')
  assert.deepEqual(cli(['week','--session',first.id]).data.sessions,[first])
  cli(['week','--session','missing'],1)
  const week=cli(['week'],0,false)
  writeFileSync(join(output,'example-cli-week.txt'),week)
  const prepare=cli(['replace','--session',first.id,'--to-sport','bike','--minutes','50']).data.proposal
  const changed=cli(['replace','--apply',prepare.id]).data.plan
  const target=changed.sessions.find(s=>s.replacesSessionId===first.id)
  const undo=cli(['replace','--session',target.id,'--restore']).data.proposal
  const restored=cli(['replace','--apply',undo.id]).data.plan.sessions.find(s=>s.restoresSessionId===first.id)
  assert.deepEqual(restored.steps,first.steps)
  const entry=cli(['log','--session',restored.id,'--actual-sport','swim','--minutes','25','--meters','1000','--rpe','4']).data.entry
  assert.equal(entry.status,'modified')
  cli(['check']);cli(['export','--what','all'])
  assert(cli(['completion','bash'],0,false).includes('replace'))

  const {client,stderr}=await connect(mcpDir)
  const tools=await client.listTools();toolCount=tools.tools.length;save('mcp-tools.json',tools)
  assert(tools.tools.find(t=>t.name==='trainctl_review').inputSchema.properties.days)
  await call(client,'init',{fromIntervals:true,sports:'bike'},true)
  assert(!existsSync(join(mcpDir,'trainctl.yaml')))
  await call(client,'init',{sports:'run,bike,swim'})
  appendFileSync(join(mcpDir,'trainctl.yaml'),'\ndesk: {workStart: "09:00", workEnd: "17:00", lunchMinutes: 45}\n')
  const initial=(await call(client,'plan')).plan
  const source=initial.sessions.find(s=>s.sport==='run')
  assert(source.coaching.objective && source.coaching.rationale)
  assert(source.steps.every(s=>s.effort?.cue))
  for(const name of ['today','week','why']) await call(client,name,{session:source.id})
  assert.deepEqual((await call(client,'week',{session:source.id})).sessions,[source])
  await call(client,'week',{session:'missing'},true)
  await call(client,'desk',{date:source.date})
  await call(client,'status');await call(client,'check');await call(client,'diff')
  await call(client,'rule',{id:'MS-2'})
  await call(client,'rule',{id:'MS-6'})
  await call(client,'rule',{id:'NOT-A-RULE'},true)

  const resources=await client.listResources();resourcesCount=resources.resources.length
  for(const resource of resources.resources) assert((await client.readResource({uri:resource.uri})).contents.length)
  const templates=await client.listResourceTemplates();assert(templates.resourceTemplates.some(t=>t.uriTemplate==='trainctl://rules/{id}'))
  assert((await client.readResource({uri:'trainctl://rules/MS-2'})).contents.length)
  const prompts=await client.listPrompts();promptsCount=prompts.prompts.length
  for(const prompt of prompts.prompts) assert((await client.getPrompt({name:prompt.name,arguments:{date:source.date}})).messages.length)
  save('mcp-discovery.json',{resources,templates,prompts})

  const short=await call(client,'shorten',{session:source.id,minutes:30})
  await call(client,'shorten',{apply:short.proposal.id})
  const used=new Set();let last
  for(const from of ['run','bike','swim']) for(const to of ['run','bike','swim'].filter(s=>s!==from)) {
    const original=initial.sessions.find(s=>s.sport===from&&!used.has(s.id));used.add(original.id)
    const prepared=await call(client,'replace',{session:original.id,toSport:to,reason:'Syntetyczna próba audytu'})
    const applied=await call(client,'replace',{apply:prepared.proposal.id})
    const replacement=applied.plan.sessions.find(s=>s.replacesSessionId===original.id)
    assert.equal(replacement.sport,to)
    last={original,replacement}
  }
  const restore=await call(client,'replace',{session:last.replacement.id,restore:true})
  const restoredPlan=(await call(client,'replace',{apply:restore.proposal.id})).plan
  const restoredSession=restoredPlan.sessions.find(s=>s.restoresSessionId===last.original.id)
  assert.deepEqual(restoredSession.steps,last.original.steps)
  const candidate=restoredPlan.sessions.find(s=>s.date==='2026-11-09'&&s.sport==='bike') ?? restoredPlan.sessions.find(s=>s.date>='2026-11-09')
  await call(client,'shift',{session:candidate.id,to:'2026-11-15'})
  const rescheduled=await call(client,'reschedule',{date:'2026-11-16',preparation:'5',sport:'bike'})
  await call(client,'reschedule',{apply:rescheduled.proposal.id})
  const actualSport=restoredSession.sport==='run'?'bike':'run'
  const logged=await call(client,'log',{session:restoredSession.id,actualSport,minutes:25,rpe:'4',note:'Syntetyczny wpis audytu'})
  assert.equal(logged.entry.status,'modified')
  const reviewed=await call(client,'review',{date:restoredSession.date,days:'7'})
  assert(reviewed.execution.some(e=>e.sessionId===restoredSession.id&&e.spontaneous&&e.sport===actualSport))
  await call(client,'adapt',{prepare:true,date:restoredSession.date})
  await call(client,'plan');await call(client,'check');await call(client,'export',{what:'all'})
  const activities=join(mcpDir,'activities');mkdirSync(activities)
  writeFileSync(join(activities,'ride.tcx'),`<?xml version="1.0"?><TrainingCenterDatabase><Activities><Activity Sport="Biking"><Id>2026-11-02T08:00:00Z</Id><Lap StartTime="2026-11-02T08:00:00Z"><TotalTimeSeconds>1800</TotalTimeSeconds><DistanceMeters>12000</DistanceMeters></Lap></Activity></Activities></TrainingCenterDatabase>`)
  const pulled=await call(client,'pull',{from:activities,date:'2026-11-02'})
  assert.equal(pulled.snapshot.activities.length,1)
  assert.equal(pulled.snapshot.activities[0].type,'Ride')
  await call(client,'push',{},true)
  await call(client,'replace',{session:'missing',toSport:'bike'},true)
  await call(client,'log',{session:restoredSession.id,minutes:-1},true)
  await call(client,'today')
  writeFileSync(join(output,'mcp-stderr.txt'),stderr())

  // Osobny proces weryfikuje rzeczywistą migrację v1 → v2 i język angielski.
  const legacy=join(isolated,'legacy');mkdirSync(legacy)
  cli(['init','--template'],0,true,legacy);cli(['plan'],0,true,legacy)
  const second=await connect(legacy,'en')
  const migration=await call(second.client,'migrate',{prepare:true})
  await call(second.client,'migrate',{apply:migration.proposal.id})
  await call(second.client,'check')
  assert.deepEqual([...called].sort(),tools.tools.map(t=>t.name).sort())
  cpSync(join(cliDir,'export'),join(output,'cli-export'),{recursive:true})
  cpSync(join(mcpDir,'export'),join(output,'mcp-export'),{recursive:true})
} catch(error) { failure=error;process.exitCode=1 }
finally {
  for(const client of clients) await client.close()
  save('transcript.json',transcript)
  const result={result:failure?'FAIL':'PASS',node:process.version,plugin:supplied,isolated,toolCount,toolsExercised:called.size,resources:resourcesCount,prompts:promptsCount,cliCalls:transcript.filter(t=>t.surface==='CLI').length,mcpCalls:transcript.filter(t=>t.method==='tools/call').length,...(failure?{error:failure.stack}:{}),finishedAt:new Date().toISOString()}
  save('result.json',result);console.log(JSON.stringify(result))
}
