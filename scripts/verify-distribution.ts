/** Instalacja rzeczywistych tarballi poza workspace; domyślnie bez dostępu do sieci. */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root=resolve(fileURLToPath(new URL('..',import.meta.url)))
const pnpm=process.env.npm_execpath
const online=process.argv.includes('--online')
assert(pnpm && /pnpm\.(?:c?js)$/.test(pnpm),'Run with pnpm verify:distribution')
const dir=mkdtempSync(join(tmpdir(),'trainctl-distribution-')), archives=join(dir,'archives')
mkdirSync(archives)
const env={...process.env,CI:'true',TRAINCTL_TODAY:'2026-11-02',TRAINCTL_LANG:'en',TRAINCTL_INTERVALS_API_KEY:''}
function run(command:string,args:string[],cwd=dir,extra:Record<string,string>={},timeout=180_000) {
  const result=spawnSync(command,args,{cwd,encoding:'utf8',windowsHide:true,env:{...env,...extra},timeout,maxBuffer:20*1024*1024})
  assert.equal(result.status,0,`${args[0]}: ${result.error?.message??''}\n${result.stdout}\n${result.stderr}`)
  return result.stdout
}
try {
  const packages=['core','export','sync-intervalsicu','sync-files','cli','mcp']
  for (const pkg of packages) {
    run(process.execPath,[pnpm,'pack','--pack-destination',archives,'--json'],join(root,'packages',pkg))
    console.log(`Packed ${pkg}`)
  }
  const files=readdirSync(archives).filter(file=>file.endsWith('.tgz'))
  assert.equal(files.length,packages.length)
  const dependencies:Record<string,string>={}
  for (const pkg of packages) {
    const manifest=JSON.parse(readFileSync(join(root,'packages',pkg,'package.json'),'utf8'))
    dependencies[manifest.name]=`file:./archives/${manifest.name}-${manifest.version}.tgz`
  }
  writeFileSync(join(dir,'package.json'),JSON.stringify({name:'trainctl-distribution-probe',version:'1.0.0',private:true,type:'module',dependencies,pnpm:{overrides:dependencies}},null,2))
  console.log(`Installing tarballs (${online?'registry dependencies allowed':'offline'})`)
  const store=run(process.execPath,[pnpm,'store','path'],root).trim()
  run(process.execPath,[pnpm,'install',online?'--prefer-offline':'--offline','--ignore-scripts','--no-frozen-lockfile','--store-dir',dirname(store)])
  for (const name of Object.keys(dependencies)) {
    const location=realpathSync(join(dir,'node_modules',name))
    assert(!relative(dir,location).startsWith('..'+sep),`${name} escaped the isolated installation`)
    const manifest=JSON.parse(readFileSync(join(location,'package.json'),'utf8'))
    assert.match(manifest.exports['.'].default,/^\.\/dist\/.+\.js$/)
    assert(!Object.values(manifest.dependencies??{}).some(v=>String(v).startsWith('workspace:')))
  }
  const binary=join(dir,'node_modules/trainctl/dist/bin.js')
  // Każde polecenie CLI ma własny limit 30 s; 10 min dotyczy całej sekwencji.
  const simulation=JSON.parse(run(process.execPath,[join(root,'scripts/simulate-multisport.ts')],root,{TRAINCTL_SIMULATION_BIN:binary},600_000))
  assert.equal(simulation.result,'PASS')
  assert(simulation.fitFilesVerified>0)
  assert(simulation.calendarFilesVerified>0 && simulation.calendarEventsVerified>0)
  console.log(`Installed CLI: ${simulation.commands} scenario commands passed`)
  const legacy=join(dir,'legacy');mkdirSync(legacy)
  run(process.execPath,[binary,'-C',legacy,'--json','init','--template'])
  for(const args of [['log','--actual-sport','bike','--minutes','40'],['export','--session','id'],['shift','--sport','bike']]) {
    const rejected=spawnSync(process.execPath,[binary,'-C',legacy,'--json',...args],{cwd:dir,encoding:'utf8',windowsHide:true,env,timeout:30_000})
    assert.equal(rejected.status,1,rejected.stdout+rejected.stderr)
    assert.match(JSON.parse(rejected.stdout).output,/migrate/)
  }
  assert(!existsSync(join(legacy,'log.jsonl')))
  const completion=run(process.execPath,[binary,'completion','bash'])
  for(const flag of ['--restore','--actual-sport','--sets']) assert(completion.includes(flag))
  const fixture=join(dir,'mcp-training');mkdirSync(fixture)
  // Kopia sondy rozwiązuje zależności wyłącznie z instalacji testowej.
  const probe=join(dir,'probe.mjs')
  writeFileSync(probe,readFileSync(join(root,'scripts/probe-distribution.mjs'),'utf8'))
  const mcp=JSON.parse(run(process.execPath,[probe,fixture]))
  assert.equal(mcp.result,'PASS')
  console.log(JSON.stringify({result:'PASS',installedPackages:packages.length,cliCommands:simulation.commands,fitFilesVerified:simulation.fitFilesVerified,fitSdkVersion:simulation.fitSdkVersion,calendarFilesVerified:simulation.calendarFilesVerified,calendarEventsVerified:simulation.calendarEventsVerified,legacyRefusal:true,completion:true,mcpCalls:mcp.calls,node:process.version,installation:'tarballs',registryAccess:online,trainingNetworkUsed:false},null,2))
} finally {
  const target=realpathSync(dir), parent=realpathSync(tmpdir())
  assert.equal(dirname(target).toLowerCase(),parent.toLowerCase())
  assert(target.split(sep).at(-1)!.startsWith('trainctl-distribution-'))
  rmSync(target,{recursive:true,force:true,maxRetries:3})
}
