/**
 * Plugin Claude Code / Codex (ADR-036) — struktura plików, wersje, skille zgodne
 * z generatorem i hooki. Testy nie udają agentów: sprawdzają to, co da się
 * sprawdzić bez nich, a hooki uruchamiają naprawdę.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { setLocale } from 'trainctl-core'
import { cmdInit, cmdPlan, cmdRules, pluginSkills, renderSkill } from './commands.ts'
import { PLAN_YAML } from './planfile.ts'
// @ts-expect-error — skrypty hooków to czysty JS bez deklaracji typów
import { feedback, trainingDirOf, TRAINCTL_VERSION } from '../../../plugin/scripts/check-plan.mjs'
// @ts-expect-error — jw.
import { LIMIT, sessionContext } from '../../../plugin/scripts/session-start.mjs'

setLocale('en')
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf-8').replace(/\r\n/g, '\n')
const json = (path: string) => JSON.parse(read(path)) as Record<string, any>
const version = json('package.json')['version'] as string
const tools = new Set([...read('packages/mcp/src/server.ts').matchAll(/registerTool\(\s*'(trainctl_[a-z_]+)'/g)].map((m) => m[1]!))

describe('manifesty i wersje', () => {
  it('Claude Code i Codex: ta sama nazwa i wersja co paczki', () => {
    for (const path of ['plugin/.claude-plugin/plugin.json', 'plugin/.codex-plugin/plugin.json']) {
      expect(json(path)).toMatchObject({ name: 'trainctl', version, license: 'MIT' })
    }
    expect(json('plugin/.codex-plugin/plugin.json')).toMatchObject({ skills: './skills/', mcpServers: './codex.mcp.json' })
  })
  it('serwery MCP pluginu przypinają trainctl-mcp do tej samej wersji', () => {
    for (const path of ['plugin/.mcp.json', 'plugin/codex.mcp.json']) {
      expect(json(path)['mcpServers']['trainctl']).toMatchObject({ command: 'npx', args: ['-y', `trainctl-mcp@${version}`] })
    }
    expect(json('plugin/.mcp.json')['mcpServers']['trainctl']['env']).toEqual({ TRAINCTL_DIR: '${CLAUDE_PROJECT_DIR}' })
    expect(TRAINCTL_VERSION).toBe(version)
  })
  it('repozytorium jest marketplace’em dla obu agentów, wskazującym na plugin/', () => {
    const claude = json('.claude-plugin/marketplace.json')
    expect(claude).toMatchObject({ name: 'trainctl', owner: { name: expect.any(String) } })
    expect(claude['plugins'][0]).toMatchObject({ name: 'trainctl', source: './plugin', version })
    const codex = json('.agents/plugins/marketplace.json')
    expect(codex['plugins'][0]).toMatchObject({ name: 'trainctl', source: { source: 'local', path: './plugin' } })
    expect(existsSync(join(ROOT, 'plugin'))).toBe(true)
  })
  it('przykłady CI przypinają tę samą wersję trainctl', () => {
    for (const file of readdirSync(join(ROOT, 'docs/examples')).filter((f) => f.endsWith('.md'))) {
      for (const m of read(`docs/examples/${file}`).matchAll(/trainctl@(\d+\.\d+\.\d+)/g)) expect(m[1], file).toBe(version)
    }
  })
})

describe('skille', () => {
  it('pliki w plugin/skills są dokładnie tym, co generuje plugin-skills.ts (node tools/plugin/render-skills.ts)', () => {
    const skills = pluginSkills()
    expect(readdirSync(join(ROOT, 'plugin/skills')).sort()).toEqual(skills.map((s) => s.name).sort())
    for (const skill of skills) expect(read(`plugin/skills/${skill.name}/SKILL.md`), skill.name).toBe(renderSkill(skill))
  })
  it('każdy skill ma frontmatter i wymienia tylko istniejące narzędzia MCP', () => {
    for (const skill of pluginSkills()) {
      const text = renderSkill(skill)
      expect(text).toMatch(/^---\nname: [a-z-]+\ndescription: ".+"\n---\n/)
      for (const m of text.matchAll(/trainctl_[a-z_]+/g)) expect(tools.has(m[0]), `${skill.name}: ${m[0]}`).toBe(true)
    }
  })
  it('persona w skillu coach to AGENTS.md, który zapisuje init', () => {
    const dir = mkdtempSync(join(tmpdir(), 'trainctl-plugin-agents-'))
    try {
      cmdInit(dir)
      expect(read('plugin/skills/coach/SKILL.md')).toContain(readFileSync(join(dir, 'AGENTS.md'), 'utf-8').trim())
    } finally {
      rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
    }
  })
})

describe('hooki', () => {
  it('hooks.json wskazuje istniejące skrypty, z limitem czasu', () => {
    const hooks = json('plugin/hooks/hooks.json')['hooks']
    for (const event of ['SessionStart', 'PostToolUse']) {
      for (const handler of hooks[event][0]['hooks']) {
        const script = /scripts\/[a-z-]+\.mjs/.exec(handler.command)![0]
        expect(existsSync(join(ROOT, 'plugin', script)), script).toBe(true)
        expect(handler.timeout).toBeGreaterThan(0)
      }
    }
    expect(hooks['PostToolUse'][0]['matcher']).toBe('Edit|Write')
  })
  it('rozpoznaje edycję planu po ścieżce — także z separatorami Windows', () => {
    expect(trainingDirOf('/home/a/training/plan/plan.yaml')).toBe('/home/a/training')
    expect(trainingDirOf('C:\\Users\\a\\training\\plan\\plan.yaml')).toBe('C:/Users/a/training')
    expect(trainingDirOf('/home/a/training/plan/PLAN.md')).toBeUndefined()
    expect(trainingDirOf('/home/a/training/myplan/plan.yaml.bak')).toBeUndefined()
    expect(trainingDirOf(undefined)).toBeUndefined()
  })
  it('błąd lintu → kod 2 na stderr; ostrzeżenia → additionalContext; czysto → cisza', () => {
    expect(feedback({ code: 1, output: 'broken', data: { errors: 1, warnings: 0 } })).toMatchObject({ exit: 2, stderr: expect.stringContaining('broken') })
    const warn = feedback({ code: 0, output: 'I-7 warning', data: { errors: 0, warnings: 1 } })
    expect(warn.exit).toBe(0)
    expect(JSON.parse(warn.stdout)).toEqual({ hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: expect.stringContaining('I-7 warning') } })
    expect(feedback({ code: 0, output: 'ok', data: { errors: 0, warnings: 0 } })).toEqual({ exit: 0 })
    expect(feedback(undefined)).toEqual({ exit: 0 })
  })

  let dir: string
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'trainctl-plugin-')) })
  afterEach(() => rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }))

  it('SessionStart: cisza poza katalogiem treningowym, persona w nim, limit znaków', () => {
    expect(sessionContext(dir)).toBeUndefined()
    cmdInit(dir)
    const text = sessionContext(dir) as string
    expect(text).toContain('trainctl training directory')
    expect(text).toContain(readFileSync(join(dir, 'AGENTS.md'), 'utf-8').slice(0, 200))
    writeFileSync(join(dir, 'AGENTS.md'), 'x'.repeat(20_000), 'utf-8')
    expect((sessionContext(dir) as string).length).toBeLessThan(10_000)
    expect(LIMIT).toBeLessThan(10_000)
  })

  it('PostToolUse end-to-end na lokalnej binarce: połamany plan → kod 2 z opisem', () => {
    cmdInit(dir)
    expect(cmdPlan(dir, { date: '2026-08-08' }).code).toBe(0)
    const hook = (filePath: string) => spawnSync(process.execPath, [join(ROOT, 'plugin/scripts/check-plan.mjs')], {
      input: JSON.stringify({ hook_event_name: 'PostToolUse', tool_name: 'Edit', tool_input: { file_path: filePath } }),
      encoding: 'utf-8',
      env: { ...process.env, TRAINCTL_PLUGIN_CLI: join(ROOT, 'packages/cli/src/bin.ts'), TRAINCTL_LANG: 'en' },
    })
    const planPath = join(dir, PLAN_YAML)
    expect(hook(planPath).status).toBe(0)
    writeFileSync(planPath, readFileSync(planPath, 'utf-8').replace(/totalKm: \d+/, 'totalKm: 999'), 'utf-8')
    const broken = hook(planPath)
    expect(broken.status).toBe(2)
    expect(broken.stderr).toContain('trainctl check: plan/plan.yaml has problems')
    expect(hook(join(dir, 'notes.md')).status).toBe(0)
  }, 30_000)
})

describe('reguły i init --agent', () => {
  let dir: string
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'trainctl-agent-')) })
  afterEach(() => rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }))

  it('rules: lista z pochodzeniem; jedna reguła; nieznane ID to czytelny błąd', () => {
    const all = cmdRules()
    expect(all.code).toBe(0)
    expect(all.output).toMatch(/I-7 — .+ · Interpretation of published research/)
    expect(cmdRules({ id: 'i-7' }).data).toMatchObject({ id: 'I-7', origin: 'research', source: expect.stringContaining('FOUNDATIONS.md') })
    expect(cmdRules({ id: 'E-1' }).data).toMatchObject({ origin: 'engineering' })
    expect(cmdRules({ id: 'X-99' }).code).toBe(1)
  })
  it('--agent claude: ustawienia z marketplace i włączonym pluginem, bez .mcp.json (dwa serwery)', () => {
    const r = cmdInit(dir, undefined, { agent: 'claude' })
    expect(r.code).toBe(0)
    expect(JSON.parse(readFileSync(join(dir, '.claude/settings.json'), 'utf-8'))).toEqual({
      extraKnownMarketplaces: { trainctl: { source: { source: 'github', repo: 'dithiothreitol/trainctl' } } },
      enabledPlugins: { 'trainctl@trainctl': true },
    })
    expect(existsSync(join(dir, '.mcp.json'))).toBe(false)
    expect(r.output).toContain('/plugin install trainctl@trainctl')
  })
  it('--agent codex: serwer MCP w .codex/config.toml; istniejący plik nie jest nadpisywany', () => {
    cmdInit(dir, undefined, { agent: 'codex' })
    expect(readFileSync(join(dir, '.codex/config.toml'), 'utf-8')).toContain(`args = ["-y", "trainctl-mcp@${version}"]`)
    rmSync(join(dir, 'trainctl.yaml'))
    writeFileSync(join(dir, '.codex/config.toml'), '# mine\n', 'utf-8')
    const again = cmdInit(dir, undefined, { agent: 'all' })
    expect(readFileSync(join(dir, '.codex/config.toml'), 'utf-8')).toBe('# mine\n')
    expect(again.output).toContain('.codex/config.toml already exists')
    expect(existsSync(join(dir, '.claude/settings.json'))).toBe(true)
  })
  it('bez --agent: tylko podpowiedź; nieznany agent: błąd przed zapisem', () => {
    expect(cmdInit(dir).output).toContain('trainctl init --agent claude|codex')
    expect(existsSync(join(dir, '.claude'))).toBe(false)
    const other = mkdtempSync(join(tmpdir(), 'trainctl-agent-bad-'))
    try {
      expect(cmdInit(other, undefined, { agent: 'cursor' }).code).toBe(1)
      expect(existsSync(join(other, 'trainctl.yaml'))).toBe(false)
    } finally {
      rmSync(other, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
    }
  })
})
