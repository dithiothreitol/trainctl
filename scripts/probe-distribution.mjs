/** Sonda uruchamiana z katalogu zainstalowanych paczek, nie z drzewa źródeł. */
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { realpathSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
const require=createRequire(realpathSync(new URL('./node_modules/trainctl-mcp/package.json',import.meta.url)))
const {Client}=await import(pathToFileURL(require.resolve('@modelcontextprotocol/sdk/client/index.js')).href)
const {StdioClientTransport}=await import(pathToFileURL(require.resolve('@modelcontextprotocol/sdk/client/stdio.js')).href)
const client=new Client({name:'distribution-probe',version:'1.0.0'})
const transport=new StdioClientTransport({command:process.execPath,args:[join(import.meta.dirname,'node_modules/trainctl-mcp/dist/bin.js')],env:{...process.env,TRAINCTL_DIR:process.argv[2],TRAINCTL_TODAY:'2026-11-02',TRAINCTL_INTERVALS_API_KEY:''},stderr:'pipe'})
let calls=0
async function call(name,args={}) {
  const response=await client.callTool({name:'trainctl_'+name,arguments:args})
  assert(!response.isError,JSON.stringify(response.content));calls++
  return response.structuredContent.data
}
try {
  await client.connect(transport)
  const tools=await client.listTools()
  assert(tools.tools.some(t=>t.name==='trainctl_replace'))
  await call('init',{sports:'run,bike,swim'})
  const {plan}=await call('plan'), source=plan.sessions.find(s=>s.sport==='run')
  const prepared=await call('replace',{session:source.id,toSport:'bike'})
  const {plan:changed}=await call('replace',{apply:prepared.proposal.id})
  const target=changed.sessions.find(s=>s.replacesSessionId===source.id)
  const undo=await call('replace',{session:target.id,restore:true})
  const {plan:restoredPlan}=await call('replace',{apply:undo.proposal.id})
  const restored=restoredPlan.sessions.find(s=>s.restoresSessionId===source.id)
  assert.deepEqual(restored.steps,source.steps)
  await call('log',{session:restored.id,actualSport:'bike',minutes:35,rpe:'4'})
  const review=await call('review',{date:restored.date})
  assert(review.execution.some(e=>e.sessionId===restored.id&&e.spontaneous&&e.sport==='bike'&&e.plannedSport==='run'))
  assert.equal(review.actual.run.minutes,0)
  await call('plan');await call('check');await call('export',{what:'all'})
  console.log(JSON.stringify({result:'PASS',calls}))
} finally {await client.close()}
