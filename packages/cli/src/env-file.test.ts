/**
 * `.env` w katalogu treningowym: wczytanie i — ważniejsze — wykrycie sytuacji,
 * w której sekret leży w repozytorium bez ochrony.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { setLocale } from 'trainctl-core'
import { cmdInit } from './commands.ts'
import { loadEnvFile, ENV_FILE } from './env-file.ts'

setLocale('pl')

const VAR = 'TRAINCTL_TEST_ENVFILE'
let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'trainctl-env-'))
  delete process.env[VAR]
})
afterEach(() => {
  delete process.env[VAR]
  rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
})

const writeEnv = (body: string) => writeFileSync(join(dir, ENV_FILE), body, 'utf-8')
const gitRepo = () => mkdirSync(join(dir, '.git'), { recursive: true })

describe('wczytywanie', () => {
  it('brak pliku to normalna sytuacja, nie błąd', () => {
    const out = loadEnvFile(dir)
    expect(out.loaded).toBe(false)
    expect(out.unprotected).toBe(false)
  })

  it('wczytuje zmienne z pliku', () => {
    writeEnv(`${VAR}=z_pliku\n`)
    expect(loadEnvFile(dir).loaded).toBe(true)
    expect(process.env[VAR]).toBe('z_pliku')
  })

  it('NIE nadpisuje zmiennej ustawionej jawnie w środowisku', () => {
    // jawny `export` to świadoma decyzja użytkownika i musi wygrać nad plikiem
    process.env[VAR] = 'ze_srodowiska'
    writeEnv(`${VAR}=z_pliku\n`)
    loadEnvFile(dir)
    expect(process.env[VAR]).toBe('ze_srodowiska')
  })

  it('radzi sobie z komentarzami i cudzysłowami', () => {
    writeEnv(`# komentarz\n\n${VAR}="w cudzysłowie"\n`)
    loadEnvFile(dir)
    expect(process.env[VAR]).toBe('w cudzysłowie')
  })
})

describe('ochrona sekretu', () => {
  it('katalog spoza repozytorium gita: brak ostrzeżenia', () => {
    writeEnv(`${VAR}=x\n`)
    expect(loadEnvFile(dir).unprotected).toBe(false)
  })

  it('repozytorium bez .gitignore: OSTRZEGAMY', () => {
    gitRepo()
    writeEnv(`${VAR}=x\n`)
    expect(loadEnvFile(dir).unprotected).toBe(true)
  })

  it('repozytorium z .gitignore, ale bez wpisu o .env: OSTRZEGAMY', () => {
    gitRepo()
    writeEnv(`${VAR}=x\n`)
    writeFileSync(join(dir, '.gitignore'), 'node_modules\nexport/\n', 'utf-8')
    expect(loadEnvFile(dir).unprotected).toBe(true)
  })

  it.each([['.env'], ['/.env'], ['.env*'], ['*.env'], ['  .env  ']])(
    'wzorzec %s w .gitignore uznajemy za ochronę',
    (pattern) => {
      gitRepo()
      writeEnv(`${VAR}=x\n`)
      writeFileSync(join(dir, '.gitignore'), `node_modules\n${pattern}\n`, 'utf-8')
      expect(loadEnvFile(dir).unprotected).toBe(false)
    },
  )

  it('zanegowany wpis (!.env) NIE jest ochroną', () => {
    gitRepo()
    writeEnv(`${VAR}=x\n`)
    writeFileSync(join(dir, '.gitignore'), '!.env\n', 'utf-8')
    expect(loadEnvFile(dir).unprotected).toBe(true)
  })

  it('.gitignore z katalogu nadrzędnego też chroni', () => {
    gitRepo()
    writeFileSync(join(dir, '.gitignore'), '.env\n', 'utf-8')
    const sub = join(dir, 'trening')
    mkdirSync(sub)
    writeFileSync(join(sub, ENV_FILE), `${VAR}=x\n`, 'utf-8')
    expect(loadEnvFile(sub).unprotected).toBe(false)
  })
})

describe('init domyka lukę', () => {
  it('dopisuje wzorce sekretów do .gitignore i gasi ostrzeżenie', () => {
    gitRepo()
    writeEnv(`${VAR}=x\n`)
    expect(loadEnvFile(dir).unprotected).toBe(true)

    const out = cmdInit(dir)
    expect(out.code).toBe(0)
    expect(out.output).toContain('.gitignore')
    expect(loadEnvFile(dir).unprotected).toBe(false)
  })

  it('nie nadpisuje istniejącego .gitignore — dokłada tylko brakujące', () => {
    gitRepo()
    writeFileSync(join(dir, '.gitignore'), '# moje reguły\nnode_modules\n', 'utf-8')
    cmdInit(dir)
    const after = require('node:fs').readFileSync(join(dir, '.gitignore'), 'utf-8') as string
    expect(after).toContain('# moje reguły')
    expect(after).toContain('node_modules')
    expect(after).toContain('.env')
    expect(after).toContain('.trainctl-secret')
  })

  it('uruchomiony dwa razy nie duplikuje wpisów', () => {
    gitRepo()
    writeFileSync(join(dir, '.gitignore'), '.env\n.env.*\n.trainctl-secret\n', 'utf-8')
    const before = require('node:fs').readFileSync(join(dir, '.gitignore'), 'utf-8') as string
    cmdInit(dir)
    const after = require('node:fs').readFileSync(join(dir, '.gitignore'), 'utf-8') as string
    expect(after).toBe(before)
  })
})
