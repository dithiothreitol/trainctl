/** Przegląd tygodnia (faza 8): kompozycja istniejących use-case'ów, read-only. */
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { SyncProvider, SyncedActivity } from 'trainctl-core'
import { cmdInit, cmdLog, cmdPlan, cmdReview } from './commands.ts'
import { AGENTS_FILE } from './agents-md.ts'
import { SECRET_FILE } from './sync.ts'
import { setLocale } from 'trainctl-core'

// Ten plik weryfikuje ZACHOWANIE komend, a asercje czyta się najłatwiej
// po polsku. Kompletność i jakość tłumaczeń pilnują testy i18n.
setLocale('pl')


const CONFIG = `athlete:
  recentWeeklyKm: 55
  daysAvailable: [tue, wed, thu, sat, sun]
  results:
    - { date: "2026-03-30", distanceKm: 21.0975, timeSec: 5400 }
  tuneUpRaces:
    - { date: "2026-09-05", distanceKm: 10, name: "Bieg Falenicki", priority: B }
goal:
  name: "Maraton testowy"
  date: "2026-11-29"
  distanceKm: 42.195
  priority: A
`

const TODAY = '2026-08-17'

const activities: SyncedActivity[] = [
  { externalId: 'r1', date: '2026-08-11', type: 'Run', distanceKm: 12 },
  { externalId: 'r2', date: '2026-08-13', type: 'Run', distanceKm: 10 },
  { externalId: 'r3', date: '2026-08-15', type: 'Run', distanceKm: 22 },
]

const provider: SyncProvider = {
  name: 'intervals.icu (test)',
  verify: async () => ({ athleteId: 'i0' }),
  listActivities: async (oldest, newest) =>
    activities.filter((a) => a.date >= oldest && a.date <= newest),
  listWellness: async () => [{ date: TODAY, restingHr: 46 }],
  pushWorkouts: async () => ({ pushed: 0, externalIds: [] }),
  listPlannedWorkouts: async () => [],
  deleteWorkout: async () => {},
}
const factory = () => provider

let dir: string
const withKey = () => writeFileSync(join(dir, SECRET_FILE), 'klucz-testowy', 'utf-8')

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'trainctl-rev-'))
  writeFileSync(join(dir, 'trainctl.yaml'), CONFIG, 'utf-8')
  cmdPlan(dir, { date: '2026-08-05' })
})
afterEach(() => rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }))

describe('trainctl review — z kluczem API', () => {
  it('odświeża dane i pokazuje wszystkie cztery sekcje', async () => {
    withKey()
    const r = await cmdReview(dir, { date: TODAY }, factory)
    expect(r.code).toBe(0)
    expect(r.output).toContain('Za nami')
    expect(r.output).toContain('Przed nami')
    expect(r.output).toContain('Do zrobienia')
    expect(existsSync(join(dir, 'sync.json'))).toBe(true)
  })

  it('liczy objętość z pobranych aktywności', async () => {
    withKey()
    const r = await cmdReview(dir, { date: TODAY }, factory)
    expect(r.output).toMatch(/4[0-9] z \d+ km/) // 12+10+22 = 44 km
  })

  it('proponuje wysyłkę na zegarek, gdy klucz jest', async () => {
    withKey()
    const r = await cmdReview(dir, { date: TODAY }, factory)
    expect(r.output).toContain('trainctl push')
  })

  it('błąd sieci nie wywraca przeglądu — praca na migawce', async () => {
    withKey()
    const breaking = () => ({
      ...provider,
      listActivities: async () => {
        throw new Error('ETIMEDOUT')
      },
    })
    const r = await cmdReview(dir, { date: TODAY }, breaking)
    expect(r.code).toBe(0)
    expect(r.output).toContain('Nie udało się odświeżyć')
    expect(r.output).toContain('Przed nami')
  })
})

describe('trainctl review — bez klucza (offline)', () => {
  it('działa z dziennika i mówi, czego brakuje', async () => {
    cmdLog(dir, { date: '2026-08-11', status: 'done', km: '12' })
    const r = await cmdReview(dir, { date: TODAY }, factory)
    expect(r.code).toBe(0)
    expect(r.output).toContain('Bez klucza API')
    expect(r.output).toContain('trainctl export --what print') // zamiast push
  })

  it('świeży plan bez żadnych danych nadal daje sensowny przegląd', async () => {
    const r = await cmdReview(dir, { date: '2026-08-05' }, factory)
    expect(r.code).toBe(0)
    expect(r.output).toContain('Przed nami')
    expect(r.output).toContain('Do zrobienia')
  })
})

describe('trainctl review — treść merytoryczna', () => {
  it('uprzedza o starcie kontrolnym w nadchodzącym tygodniu', async () => {
    const r = await cmdReview(dir, { date: '2026-08-31' }, factory)
    expect(r.output).toContain('2026-09-05')
    expect(r.output).toContain('T-10')
  })

  it('przypomina o najbliższym starcie w liście do zrobienia', async () => {
    const r = await cmdReview(dir, { date: TODAY }, factory)
    expect(r.output).toContain('Bieg Falenicki')
  })

  it('nie zmienia planu (read-only poza migawką)', async () => {
    const before = readFileSync(join(dir, 'plan/plan.yaml'), 'utf-8')
    await cmdReview(dir, { date: TODAY }, factory)
    expect(readFileSync(join(dir, 'plan/plan.yaml'), 'utf-8')).toBe(before)
  })

  it('bez planu — czytelny błąd zamiast wyjątku', async () => {
    const empty = mkdtempSync(join(tmpdir(), 'trainctl-rev-none-'))
    const r = await cmdReview(empty, { date: TODAY }, factory)
    expect(r.code).toBe(1)
    rmSync(empty, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
  })
})

describe('pakiet onboardingowy agenta', () => {
  it('trainctl init tworzy AGENTS.md z rytuałami i zasadami', () => {
    const fresh = mkdtempSync(join(tmpdir(), 'trainctl-agents-'))
    const r = cmdInit(fresh)
    expect(r.code).toBe(0)
    expect(r.output).toContain(AGENTS_FILE)
    const text = readFileSync(join(fresh, AGENTS_FILE), 'utf-8')
    expect(text).toContain('trainctl_review')
    expect(text).toContain('Nie regeneruj planu bez pytania')
    expect(text).toContain('athlete.results')
    rmSync(fresh, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
  })

  it('istniejącego AGENTS.md nie nadpisuje (użytkownik mógł go zmienić)', () => {
    const fresh = mkdtempSync(join(tmpdir(), 'trainctl-agents2-'))
    writeFileSync(join(fresh, AGENTS_FILE), 'moje zasady', 'utf-8')
    cmdInit(fresh)
    expect(readFileSync(join(fresh, AGENTS_FILE), 'utf-8')).toBe('moje zasady')
    rmSync(fresh, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
  })
})
