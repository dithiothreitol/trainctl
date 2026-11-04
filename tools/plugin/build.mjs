#!/usr/bin/env node
/** Lokalny plugin zawiera bieżący kod i zależności, bez pobierania paczek przy starcie. */
import { build } from 'esbuild'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const plugin = join(root, 'plugin')
const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version
const args = process.argv.slice(2)
if (args.length && (args.length !== 2 || args[0] !== '--out')) throw new Error('Usage: pnpm plugin:build [--out NEW_DIRECTORY]')
mkdirSync(join(root, 'artifacts'), {recursive:true})
const out = args[1] ? resolve(args[1]) : mkdtempSync(join(root, 'artifacts/trainctl-codex-'))
if (args[1] && existsSync(out)) throw new Error('Output already exists; choose a new directory.')
mkdirSync(out, {recursive:true})

// Wersja czytana przez CLI/MCP z ../package.json musi być obok dist/ także po bundlowaniu.
const runtime = join(plugin, 'runtime')
mkdirSync(runtime, {recursive:true})
const result = await build({
  absWorkingDir: root,
  entryPoints: {cli:join(root,'packages/cli/src/bin.ts'), mcp:join(root,'packages/mcp/src/bin.ts')},
  outdir: join(runtime, 'dist'), outExtension:{'.js':'.mjs'},
  bundle:true, platform:'node', target:'node22.18', format:'esm', metafile:true,
  banner:{js:"import { createRequire as __trainctlCreateRequire } from 'node:module'; const require = __trainctlCreateRequire(import.meta.url);"},
  legalComments:'eof', logLevel:'warning',
})
writeFileSync(join(runtime, 'package.json'), JSON.stringify({name:'trainctl-plugin-runtime',version,private:true,type:'module',engines:{node:'>=22.18.0'}}, null, 2)+'\n')

const inputs = Object.keys(result.metafile.inputs).sort()
const hash = createHash('sha256')
const licenses = new Map()
for (const input of inputs) {
  const full = resolve(root,input)
  hash.update(input.replaceAll('\\','/')).update('\0').update(readFileSync(full)).update('\0')
  if (!input.includes('node_modules/')) continue
  let folder = dirname(full)
  while (!existsSync(join(folder,'package.json')) && dirname(folder)!==folder) folder=dirname(folder)
  if (!existsSync(join(folder,'package.json'))) continue
  const pkg=JSON.parse(readFileSync(join(folder,'package.json'),'utf8'))
  const id=`${pkg.name}@${pkg.version}`
  if (licenses.has(id)) continue
  const files=readdirSync(folder).filter(f=>/^(licen[sc]e|copying|notice)(\.|$)/i.test(f))
  licenses.set(id,files.map(f=>readFileSync(join(folder,f),'utf8')).join('\n') || `License: ${pkg.license ?? 'see package source'}`)
}
writeFileSync(join(runtime,'THIRD-PARTY-NOTICES.txt'),[...licenses].sort(([a],[b])=>a.localeCompare(b)).map(([id,text])=>`${id}\n${'='.repeat(id.length)}\n${text}`).join('\n\n'))
let commit='unknown'
try {commit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore'],windowsHide:true}).trim()} catch {}
const provenance={version,commit,inputSha256:hash.digest('hex'),inputFiles:inputs.length,builtAt:new Date().toISOString(),node:process.version}
writeFileSync(join(runtime,'build.json'),JSON.stringify(provenance,null,2)+'\n')

// Biała lista wyklucza hooki Claude, sekrety i dane treningowe.
const packaged=join(out,'plugin')
mkdirSync(packaged)
for (const name of ['plugin.json','mcp.json','codex.mcp.json','.codex-plugin','skills','runtime','README.md']) cpSync(join(plugin,name),join(packaged,name),{recursive:true})
mkdirSync(join(packaged,'scripts'))
for (const name of ['start-mcp.mjs','trainctl.mjs']) cpSync(join(plugin,'scripts',name),join(packaged,'scripts',name))
cpSync(join(root,'LICENSE'),join(packaged,'LICENSE'))
mkdirSync(join(out,'.agents/plugins'),{recursive:true})
writeFileSync(join(out,'.agents/plugins/marketplace.json'),JSON.stringify({name:'trainctl-local',interface:{displayName:'trainctl · local build'},plugins:[{name:'trainctl',source:{source:'local',path:'./plugin'},policy:{installation:'AVAILABLE',authentication:'ON_USE'},category:'Productivity'}]},null,2)+'\n')
writeFileSync(join(out,'INSTALL.txt'),`trainctl Codex plugin — local build ${version}\nSource digest: ${provenance.inputSha256}\n\nRequires Node >=22.18.0 on PATH. No npm download at startup.\n\nOpen a terminal in the extracted directory containing this INSTALL.txt file. Keep that directory available as the local marketplace source.\n\n1. codex plugin marketplace add .\n2. codex plugin add trainctl@trainctl-local\n   Or install trainctl from trainctl-local in the Plugins Directory.\n3. Open a new Codex session and ask trainctl_workspace to select your training directory by absolute path. Alternatively set TRAINCTL_DIR before launching Codex.\n4. Ask: "Show my week. Propose replacing a run with a bike session, then wait for my decision."\n\nCLI: node plugin/scripts/trainctl.mjs --help\nInitialize a separate training directory with: -C <directory> init --sports run,bike,swim --template\nDo not also add a second trainctl MCP server via init --agent codex.\n\nThis command creates a local bundle; it does not publish to npm or a public plugin directory.\n`)
console.log(JSON.stringify({result:'PASS',marketplace:out,plugin:packaged,...provenance}))
