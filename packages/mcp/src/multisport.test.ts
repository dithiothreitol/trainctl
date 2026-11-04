import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { expect, it, vi } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { createTrainctlServer } from './server.ts'

it('refuses an actual-sport journal entry in v1 through MCP',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'trainctl-mcp-v1-'))
  const server=createTrainctlServer(dir),client=new Client({name:'legacy-test',version:'1'})
  const [ct,st]=InMemoryTransport.createLinkedPair()
  try {
    await Promise.all([server.connect(st),client.connect(ct)])
    expect((await client.callTool({name:'trainctl_init',arguments:{}})).isError).not.toBe(true)
    const response=await client.callTool({name:'trainctl_log',arguments:{actualSport:'bike',minutes:40}})
    expect(response.isError).toBe(true)
    expect(JSON.stringify(response.content)).toContain('migrate')
    expect(existsSync(join(dir,'log.jsonl'))).toBe(false)
  } finally {await client.close();await server.close();rmSync(dir,{recursive:true,force:true,maxRetries:3})}
})

it('runs init → plan → replace → apply → log → check through MCP', async()=>{
  const dir=mkdtempSync(join(tmpdir(),'trainctl-mcp-sports-'))
  vi.stubEnv('TRAINCTL_TODAY','2026-11-02')
  const server=createTrainctlServer(dir), client=new Client({name:'sports-test',version:'1'})
  const [ct,st]=InMemoryTransport.createLinkedPair()
  try {
    await Promise.all([server.connect(st),client.connect(ct)])
    const call=async(name:string,args:Record<string,unknown>={})=>{
      const r=await client.callTool({name:'trainctl_'+name,arguments:args})
      expect(r.isError,JSON.stringify(r.content)).not.toBe(true)
      return (r.structuredContent as {data:Record<string,any>}).data
    }
    await call('init',{sports:'run,bike,swim'})
    const {plan}=await call('plan')
    const source=plan.sessions.find((s:any)=>s.sport==='run')
    expect((await call('week',{session:source.id})).sessions).toEqual([source])
    expect((await client.callTool({name:'trainctl_week',arguments:{session:'missing'}})).isError).toBe(true)
    const {proposal}=await call('replace',{session:source.id,toSport:'bike',prepare:true})
    const applied=await call('replace',{apply:proposal.id})
    const target=applied.plan.sessions.find((s:any)=>s.replacesSessionId===source.id)
    expect(proposal.plan.replacements.at(-1).proposalId).toBe(proposal.id)
    expect(proposal.plan.replacements.at(-1).impact.sports.find((s:any)=>s.sport==='run').deltaMinutes).toBeLessThan(0)
    const undo=await call('replace',{session:target.id,restore:true})
    const restoredPlan=(await call('replace',{apply:undo.proposal.id})).plan
    const restored=restoredPlan.sessions.find((s:any)=>s.restoresSessionId===source.id)
    expect(restored.steps).toEqual(source.steps)
    await call('log',{session:restored.id,actualSport:'bike',minutes:301.5,rpe:'4',note:'Rain'})
    const today=await call('today',{date:restored.date})
    expect(today.execution).toEqual(expect.arrayContaining([expect.objectContaining({sessionId:restored.id,replacement:true,status:'done',sport:'bike',plannedSport:'run',spontaneous:true,rpe:4})]))
    const review=await call('review',{date:restored.date})
    expect(review.actual.bike.minutes).toBe(301.5)
    expect(review.actual.run.minutes).toBe(0)
    const swim=restoredPlan.sessions.find((s:any)=>s.sport==='swim')
    expect((await call('log',{session:swim.id,sets:'1=3'})).entry.completedRepeats).toEqual([{step:1,repeats:3}])
    await call('plan');await call('check')
  } finally {
    await client.close();await server.close();vi.unstubAllEnvs()
    rmSync(dir,{recursive:true,force:true,maxRetries:3})
  }
})
