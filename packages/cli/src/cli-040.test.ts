/**
 * Etap B (docs/PLAN-v0.4.md): CLI, które da się skryptować — `--json`, `-C`,
 * jawny zegar symulacji, daty względne, `status`, `--commit`, completion,
 * przykłady w pomocy i kody wyjścia. Część testów uruchamia prawdziwą binarkę.
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { setLocale } from 'trainctl-core'
import { cmdInit, cmdLog, cmdPlan, cmdShift, cmdStatus, cmdToday, completionScript, resolveDateInput } from './commands.ts'
import { logChoices, parseLogStatus } from './interactive.ts'
import { loadPlan } from './planfile.ts'

setLocale('en')
const HERE = dirname(fileURLToPath(import.meta.url))
const CLI_BIN = join(HERE, 'bin.ts')

const CONFIG = `athlete:
  recentWeeklyKm: 45
  daysAvailable: [tue, wed, thu, sat, sun]
  results:
    - { date: "2026-03-29", distanceKm: 10, timeSec: 2580 }
goal:
  name: "Half marathon"
  date: "2026-11-29"
  distanceKm: 21.0975
  priority: A
`

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'trainctl-040-'))
  writeFileSync(join(dir, 'trainctl.yaml'), CONFIG, 'utf-8')
})
afterEach(() => rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }))

const run = (args: string[], env: NodeJS.ProcessEnv = {}, cwd = dir) =>
  spawnSync(process.execPath, [CLI_BIN, ...args], {
    cwd, encoding: 'utf-8', env: { ...process.env, TRAINCTL_LANG: 'en', NO_COLOR: '1', ...env },
  })

describe('daty względne (tylko CLI)', () => {
  const today = '2026-08-12' // środa
  it.each([
    ['2026-08-20', 'forward', '2026-08-20'],
    ['today', 'forward', '2026-08-12'],
    ['yesterday', 'back', '2026-08-11'],
    ['jutro', 'forward', '2026-08-13'],
    ['+3', 'forward', '2026-08-15'],
    ['-7', 'back', '2026-08-05'],
    ['thu', 'forward', '2026-08-13'],
    ['thu', 'back', '2026-08-06'],
    ['wed', 'forward', '2026-08-12'],
    ['wed', 'back', '2026-08-12'],
    ['Śr', 'forward', '2026-08-12'],
    ['niedziela', 'back', '2026-08-09'],
    ['MONDAY', 'forward', '2026-08-17'],
  ] as const)('%s (%s) → %s', (input, direction, expected) => {
    expect(resolveDateInput(input, today, direction)).toBe(expected)
  })
  it('odrzuca to, co nie jest datą, i niemożliwą datę', () => {
    expect(() => resolveDateInput('someday', today)).toThrow(/not a date/)
    expect(() => resolveDateInput('2026-02-30', today)).toThrow()
  })
})

describe('binarka: --json, -C, TRAINCTL_TODAY, daty względne, kody wyjścia', () => {
  it('--json: czyste dane, bez ANSI, kod zgodny z kodem procesu', () => {
    expect(run(['plan', '--date', '2026-08-08', '--json']).status).toBe(0)
    const r = run(['today', '--date', '2026-08-11', '--json'])
    expect(r.status).toBe(0)
    expect(r.stdout).not.toMatch(/\u001b\[/)
    const parsed = JSON.parse(r.stdout) as { code: number; data: { date: string; day: { workout: { kind: string } } }; output: string }
    expect(parsed.code).toBe(0)
    expect(parsed.data.date).toBe('2026-08-11')
    expect(parsed.output).toContain('2026-08-11')
    const fail = run(['today', '--json'], {}, mkdtempSync(join(tmpdir(), 'trainctl-040-empty-')))
    expect(fail.status).toBe(1)
    expect(JSON.parse(fail.stdout)).toMatchObject({ code: 1 })
  }, 30_000)

  it('-C i TRAINCTL_DIR wskazują katalog treningowy spoza cwd', () => {
    const elsewhere = mkdtempSync(join(tmpdir(), 'trainctl-040-cwd-'))
    try {
      expect(run(['-C', dir, 'plan', '--date', '2026-08-08'], {}, elsewhere).stdout).toContain('Saved plan/plan.yaml')
      expect(run(['today', '--date', '2026-08-11'], { TRAINCTL_DIR: dir }, elsewhere).stdout).toContain('2026-08-11 · Tuesday')
      expect(run(['--dir', join(dir, 'missing'), 'today'], {}, elsewhere).status).toBe(1)
    } finally {
      rmSync(elsewhere, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
    }
  }, 30_000)

  it('TRAINCTL_TODAY: zegar przesunięty i ogłoszony w pierwszym wierszu', () => {
    run(['plan', '--date', '2026-08-08'])
    const r = run(['today'], { TRAINCTL_TODAY: '2026-08-11' })
    expect(r.stdout.split('\n')[0]).toContain('simulated date 2026-08-11 (TRAINCTL_TODAY)')
    expect(r.stdout).toContain('2026-08-11 · Tuesday')
    // ochrona przeszłości idzie za symulacją: dzień przed nią jest przeszły
    expect(run(['shift', '--from', '2026-08-10', '--to', '2026-08-11'], { TRAINCTL_TODAY: '2026-08-11' }).status).toBe(1)
    const json = JSON.parse(run(['today', '--json'], { TRAINCTL_TODAY: '2026-08-11' }).stdout) as { notice: string }
    expect(json.notice).toContain('2026-08-11')
    expect(run(['today'], { TRAINCTL_TODAY: 'tomorrow' }).stdout).toContain('is not a date')
  }, 30_000)

  it('daty względne w prawdziwej binarce i kod 2 dla błędu użycia', () => {
    run(['plan', '--date', '2026-08-08'])
    expect(run(['why', '--date', 'tue'], { TRAINCTL_TODAY: '2026-08-10' }).stdout).toContain('Why this session · 2026-08-11')
    const bad = run(['today', '--date', 'someday'])
    expect(bad.status).toBe(2)
    expect(bad.stderr).toContain('not a date')
    expect(run(['no-such-command']).status).toBe(2)
  }, 30_000)

  it('help komendy niesie przykłady; status i completion działają', () => {
    expect(run(['help', 'log']).stdout).toContain('trainctl log --km 8')
    run(['plan', '--date', '2026-08-08'])
    expect(run(['status']).stdout).toContain('Training directory')
    const bash = run(['completion', 'bash'])
    expect(bash.status).toBe(0)
    expect(bash.stdout).toContain('complete -F _trainctl trainctl')
    expect(bash.stdout).toContain('--fresh')
    expect(run(['completion', 'tcsh']).status).toBe(2)
  }, 30_000)
})

/** Zmienna klucza na czas testu — z przywróceniem wartości, którą miał programista. */
function withKeyEnv(value: string | undefined, fn: () => void): void {
  const previous = process.env['TRAINCTL_INTERVALS_API_KEY']
  if (value === undefined) delete process.env['TRAINCTL_INTERVALS_API_KEY']
  else process.env['TRAINCTL_INTERVALS_API_KEY'] = value
  try {
    fn()
  } finally {
    if (previous === undefined) delete process.env['TRAINCTL_INTERVALS_API_KEY']
    else process.env['TRAINCTL_INTERVALS_API_KEY'] = previous
  }
}

describe('status', () => {
  it('pusty katalog: profil jest, planu nie ma — podpowiada plan', () => {
    let r = cmdStatus(dir)
    withKeyEnv(undefined, () => { r = cmdStatus(dir) })
    expect(r.code).toBe(0)
    expect(r.output).toContain('No plan yet.')
    expect(r.output).toContain('next: trainctl plan')
    expect(r.data).toMatchObject({ config: { exists: true, valid: true }, plan: null, git: null })
  })
  it('z planem: wersja silnika, dziennik i niezacommitowane pliki', () => {
    cmdPlan(dir, { date: '2026-08-08' })
    cmdLog(dir, { date: '2026-08-11', km: '8' })
    execFileSync('git', ['init', '-q'], { cwd: dir })
    const r = cmdStatus(dir)
    expect(r.output).toContain('Half marathon · 2026-11-29')
    expect(r.output).toMatch(/log\.jsonl: 1 entry, last 2026-08-11 \(done\)/)
    expect(r.data).toMatchObject({ git: { uncommitted: expect.arrayContaining(['trainctl.yaml']) } })
  })
  it('nigdy nie ujawnia wartości klucza z .env', () => {
    writeFileSync(join(dir, '.env'), 'TRAINCTL_INTERVALS_API_KEY=super-secret-value\n', 'utf-8')
    // bin.ts wczytuje .env do środowiska przed komendą — tu robimy to samo
    withKeyEnv('super-secret-value', () => {
      const r = cmdStatus(dir)
      expect(r.output).not.toContain('super-secret-value')
      expect(JSON.stringify(r.data)).not.toContain('super-secret-value')
      expect(r.data).toMatchObject({ key: { source: '.env' } })
    })
  })
  it('źródło klucza w tej samej kolejności co push: zmienna przed plikiem, pusty plik to brak klucza', () => {
    withKeyEnv(undefined, () => {
      writeFileSync(join(dir, '.trainctl-secret'), '   \n', 'utf-8')
      expect(cmdStatus(dir).data).toMatchObject({ key: { source: null } })
      writeFileSync(join(dir, '.trainctl-secret'), 'abc', 'utf-8')
      expect(cmdStatus(dir).data).toMatchObject({ key: { source: '.trainctl-secret' } })
    })
    withKeyEnv('from-env', () => {
      expect(cmdStatus(dir).data).toMatchObject({ key: { source: 'environment variable' } })
    })
  })
  it('połamany log.jsonl: status mówi, co jest nie tak, zamiast rzucać wyjątkiem', () => {
    cmdPlan(dir, { date: '2026-08-08' })
    writeFileSync(join(dir, 'log.jsonl'), '{"date":"2026-08-11"\n', 'utf-8')
    const r = cmdStatus(dir)
    expect(r.code).toBe(1)
    expect(r.data).toMatchObject({ error: expect.any(String) })
  })
  it('podpowiedź commita wymienia tylko pliki treningowe, nigdy git add -A', () => {
    cmdPlan(dir, { date: '2026-08-08' })
    execFileSync('git', ['init', '-q'], { cwd: dir })
    const out = cmdStatus(dir).output
    expect(out).not.toContain('git add -A')
    expect(out).toMatch(/git add .*trainctl\.yaml.* && git commit/)
  })
})

describe('--commit', () => {
  const gitEnv = { GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@example.test', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@example.test' }
  beforeEach(() => { Object.assign(process.env, gitEnv) })
  afterEach(() => { for (const k of Object.keys(gitEnv)) delete process.env[k] })
  const gitOut = (args: string[]) => execFileSync('git', args, { cwd: dir, encoding: 'utf-8' })

  it('commituje wyłącznie pliki zmienione przez komendę — nigdy sekretów ani cudzych zmian', () => {
    execFileSync('git', ['init', '-q'], { cwd: dir })
    writeFileSync(join(dir, '.env'), 'TRAINCTL_INTERVALS_API_KEY=x\n', 'utf-8')
    writeFileSync(join(dir, 'notes.md'), 'mine\n', 'utf-8')
    execFileSync('git', ['add', 'notes.md'], { cwd: dir })
    const r = cmdPlan(dir, { date: '2026-08-08', commit: true })
    expect(r.code).toBe(0)
    expect(r.output).toMatch(/Committed [0-9a-f]+: plan\/plan\.yaml, plan\/PLAN\.md/)
    expect(gitOut(['show', '--name-only', '--format=%s', 'HEAD']).trim().split('\n')).toEqual(
      ['trainctl plan: Half marathon (2026-11-29)', '', 'plan/PLAN.md', 'plan/plan.yaml'])
    // cudza zmiana w indeksie została w indeksie, sekret nietknięty
    expect(gitOut(['diff', '--cached', '--name-only']).trim()).toBe('notes.md')
    expect(gitOut(['ls-files'])).not.toContain('.env')
  })
  it('własna wiadomość; dziennik; brak gita to informacja, nie błąd', () => {
    cmdPlan(dir, { date: '2026-08-08' })
    const noGit = cmdLog(dir, { date: '2026-08-11', km: '8', commit: true })
    expect(noGit.code).toBe(0)
    expect(noGit.output).toContain('Not a git repository')
    execFileSync('git', ['init', '-q'], { cwd: dir })
    const r = cmdLog(dir, { date: '2026-08-13', km: '10', commit: 'easy run, legs fine' })
    expect(r.output).toMatch(/Committed [0-9a-f]+: log\.jsonl/)
    expect(gitOut(['log', '-1', '--format=%s']).trim()).toBe('easy run, legs fine')
  })
  it('init --commit commituje tylko to, co zapisał — nie cudze zmiany w AGENTS.md', () => {
    rmSync(join(dir, 'trainctl.yaml'))
    execFileSync('git', ['init', '-q'], { cwd: dir })
    writeFileSync(join(dir, 'AGENTS.md'), '# my own coach notes\n', 'utf-8')
    writeFileSync(join(dir, '.gitignore'), '.env\n.env.*\n.trainctl-secret\nactivities/\n', 'utf-8')
    const r = cmdInit(dir, undefined, { commit: true })
    expect(r.code).toBe(0)
    expect(gitOut(['show', '--name-only', '--format=', 'HEAD']).trim().split('\n')).toEqual(['trainctl.yaml'])
  })
  it('odmowa zapisu nie commituje niczego', () => {
    cmdPlan(dir, { date: '2026-08-08' })
    execFileSync('git', ['init', '-q'], { cwd: dir })
    const r = cmdShift(dir, { from: '2026-11-29', to: '2026-11-28', commit: true })
    expect(r.code).toBe(1)
    expect(spawnSync('git', ['rev-parse', 'HEAD'], { cwd: dir }).status).not.toBe(0)
  })
})

describe('today i interaktywny log', () => {
  it('today pokazuje szacowany czas i następną sesję', () => {
    cmdPlan(dir, { date: '2026-08-08' })
    const r = cmdToday(dir, { date: '2026-08-11' })
    expect(r.output).toMatch(/about \d+ min including preparation/)
    expect(r.output).toMatch(/next: \w+ 2026-08-1\d · /)
    expect(r.data).toMatchObject({ next: { date: expect.stringMatching(/^2026-08-1\d$/) } })
  })
  it('lista wyboru: ostatnie siedem dni od dziś wstecz, ze statusem z dziennika', () => {
    cmdPlan(dir, { date: '2026-08-08' })
    const choices = logChoices(loadPlan(dir), '2026-08-13', new Map([['2026-08-11', 'done']]))
    expect(choices.map((c) => c.value)).toEqual(['2026-08-13', '2026-08-12', '2026-08-11', '2026-08-10', '2026-08-09', '2026-08-08', '2026-08-07'])
    expect(choices.find((c) => c.value === '2026-08-11')!.hint).toContain('[logged: done]')
  })
  it('status odpowiedzi: skróty i pełne nazwy', () => {
    expect(parseLogStatus('d')).toBe('done')
    expect(parseLogStatus('Skipped')).toBe('skipped')
    expect(parseLogStatus('m')).toBe('modified')
    expect(() => parseLogStatus('maybe')).toThrow()
  })
})

describe('completion', () => {
  const specs = [{ name: 'plan', description: "plan it's", options: [{ long: '--fresh', description: 'start over' }] }]
  it.each(['bash', 'zsh', 'fish', 'pwsh'] as const)('%s: każda komenda i flaga w skrypcie', (shell) => {
    const script = completionScript(shell, specs, [{ long: '--json', description: 'json' }])
    expect(script).toContain('plan')
    expect(script).toContain(shell === 'fish' ? '-l fresh' : '--fresh')
  })
})

// katalog z planem w podkatalogu git — -C działa także na ścieżkach względnych
describe('-C ze ścieżką względną', () => {
  it('rozwiązuje ją względem katalogu procesu', () => {
    const parent = mkdtempSync(join(tmpdir(), 'trainctl-040-rel-'))
    try {
      mkdirSync(join(parent, 'training'))
      writeFileSync(join(parent, 'training', 'trainctl.yaml'), CONFIG, 'utf-8')
      expect(run(['-C', 'training', 'plan', '--date', '2026-08-08'], {}, parent).status).toBe(0)
      expect(readFileSync(join(parent, 'training', 'plan', 'plan.yaml'), 'utf-8')).toContain('Half marathon')
    } finally {
      rmSync(parent, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
    }
  }, 30_000)
})
