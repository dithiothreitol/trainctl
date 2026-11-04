import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { createTrainctlServer } from './server.ts'

it('plugin nie odczytuje ani nie tworzy planu przed wyborem katalogu i nie przenosi kontekstu między katalogami',async()=>{
  const root=mkdtempSync(join(tmpdir(),'trainctl-workspace-'))
  const cache=join(root,'plugin'),training=join(root,'training'),other=join(root,'other')
  for(const dir of [cache,training,other]) mkdirSync(dir)
  const opened:string[]=[]
  const server=createTrainctlServer(cache,undefined,{selectWorkspace:true,requireWorkspaceSelection:true,pluginRoot:cache,onWorkspaceSelected:dir=>{opened.push(dir)}})
  const client=new Client({name:'workspace-test',version:'1'})
  const [ct,st]=InMemoryTransport.createLinkedPair()
  const call=(name:string,args:Record<string,unknown>={})=>client.callTool({name:'trainctl_'+name,arguments:args})
  try {
    await Promise.all([server.connect(st),client.connect(ct)])
    expect((await call('workspace')).structuredContent).toMatchObject({data:{selected:false,directory:null}})
    expect((await call('init',{sports:'bike'})).isError).toBe(true)
    await expect(client.readResource({uri:'trainctl://config'})).rejects.toThrow()
    expect(existsSync(join(cache,'trainctl.yaml'))).toBe(false)
    for(const directory of [cache,'relative-path',join(root,'absent')]) expect((await call('workspace',{directory})).isError).toBe(true)
    expect(opened).toEqual([])
    expect((await call('workspace',{directory:training})).isError).not.toBe(true)
    expect((await call('workspace',{directory:training})).isError).not.toBe(true)
    expect(opened).toEqual([realpathSync(training)])
    expect((await call('init',{sports:'bike'})).isError).not.toBe(true)
    expect(existsSync(join(training,'trainctl.yaml'))).toBe(true)
    expect((await call('workspace',{directory:other})).isError).toBe(true)
    expect((await call('workspace')).structuredContent).toMatchObject({data:{directory:realpathSync(training)}})
    expect((await client.readResource({uri:'trainctl://config'})).contents).toHaveLength(1)
    expect(opened).toHaveLength(1)
  } finally {await client.close();await server.close();rmSync(root,{recursive:true,force:true,maxRetries:3})}
})
