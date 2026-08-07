/** `trainctl init --from-intervals`: profil z historii, propozycje z proweniencją (ADR-019). */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { addDays, mondayOf, type SyncProvider, type SyncedActivity } from '@trainctl/core'
import { setLocale } from '@trainctl/core'
import { cmdInitFromIntervals } from './commands.ts'

// Ten plik weryfikuje ZACHOWANIE komend, a asercje czyta się najłatwiej
// po polsku. Kompletność i jakość tłumaczeń pilnują testy i18n.
setLocale('pl')


const TODAY = '2026-08-05'
const CURRENT_MONDAY = mondayOf(TODAY)

let id = 0
function run(date: string, distanceKm: number, extra: Partial<SyncedActivity> = {}): SyncedActivity {
  return {
    externalId: `a${id++}`,
    date,
    type: 'Run',
    distanceKm,
    movingTimeSec: Math.round(distanceKm * 330),
    ...extra,
  }
}

const history: SyncedActivity[] = [
  ...Array.from({ length: 16 }, (_, i) => {
    const monday = addDays(CURRENT_MONDAY, -7 * (i + 1))
    return [
      run(addDays(monday, 1), 8),
      run(addDays(monday, 3), 10),
      run(addDays(monday, 5), 18),
      run(addDays(monday, 6), 6),
    ]
  }).flat(),
  run(addDays(CURRENT_MONDAY, -10), 10.02, { name: 'Bieg po Zdrowie', movingTimeSec: 2599 }),
]

const fakeProvider: SyncProvider = {
  name: 'intervals.icu (test)',
  verify: async () => ({ athleteId: 'i0' }),
  listActivities: async (oldest, newest) =>
    history.filter((a) => a.date >= oldest && a.date <= newest),
  listWellness: async () => [],
  pushWorkouts: async () => ({ pushed: 0, externalIds: [] }),
  listPlannedWorkouts: async () => [],
  deleteWorkout: async () => {},
}
const factory = () => fakeProvider

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'trainctl-initicu-'))
})
afterEach(() => rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }))

describe('cmdInitFromIntervals', () => {
  it('zapisuje trainctl.yaml z wartościami i komentarzami proweniencji', async () => {
    const r = await cmdInitFromIntervals(dir, { date: TODAY }, factory)
    expect(r.code).toBe(0)
    const yaml = readFileSync(join(dir, 'trainctl.yaml'), 'utf-8')
    expect(yaml).toContain('recentWeeklyKm: 42')
    expect(yaml).toContain('mediana')
    expect(yaml).toContain('intervals.icu')
    expect(yaml).toContain('daysAvailable: [tue, thu, sat, sun]')
    expect(yaml).toContain('longRunDay: sat')
  })

  it('cel jest placeholderem — loadConfig celowo go nie przepuści', async () => {
    await cmdInitFromIntervals(dir, { date: TODAY }, factory)
    const yaml = readFileSync(join(dir, 'trainctl.yaml'), 'utf-8')
    expect(yaml).toContain('UZUPEŁNIJ')
    expect(yaml).toContain('date: "RRRR-MM-DD"')
    expect(yaml).toContain('distanceKm: 0')
  })

  it('kandydat na start jest w wyjściu, ale NIE w results (wymaga potwierdzenia)', async () => {
    const r = await cmdInitFromIntervals(dir, { date: TODAY }, factory)
    expect(r.output).toContain('Bieg po Zdrowie')
    expect(r.output).toContain('potwierdź')
    const yaml = readFileSync(join(dir, 'trainctl.yaml'), 'utf-8')
    expect(yaml).not.toContain('Bieg po Zdrowie')
    expect(yaml).not.toContain('2599')
  })

  it('istniejący trainctl.yaml nie jest nadpisywany', async () => {
    writeFileSync(join(dir, 'trainctl.yaml'), 'athlete: {}\n', 'utf-8')
    const r = await cmdInitFromIntervals(dir, { date: TODAY }, factory)
    expect(r.code).toBe(1)
    expect(r.output).toContain('już istnieje')
    expect(readFileSync(join(dir, 'trainctl.yaml'), 'utf-8')).toBe('athlete: {}\n')
  })

  it('za mało danych → czytelna odmowa, plik nie powstaje', async () => {
    const thin = () => ({
      ...fakeProvider,
      listActivities: async () => [run(addDays(CURRENT_MONDAY, -3), 5)],
    })
    const r = await cmdInitFromIntervals(dir, { date: TODAY }, thin)
    expect(r.code).toBe(1)
    expect(r.output).toContain('za mało')
  })

  it('bez klucza (domyślna fabryka) — instrukcja Developer Settings', async () => {
    const r = await cmdInitFromIntervals(dir, { date: TODAY })
    expect(r.code).toBe(1)
    expect(r.output).toContain('Developer Settings')
  })
})
