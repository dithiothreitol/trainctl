/**
 * FileActivitySource — port `ActivitySource` nad katalogiem plików.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ActivitySource } from 'trainctl-core'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { activityFit } from './fit-fixture.ts'
import { FileActivitySource } from './provider.ts'

const run = (day: string, km: number) =>
  activityFit({
    sessions: [{ start: `${day}T06:00:00Z`, sport: 1, timerSec: km * 330, distanceM: km * 1000 }],
    utcOffsetSec: 2 * 3600,
  })

let dir: string

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'trainctl-sync-files-provider-'))
  writeFileSync(join(dir, 'mon.fit'), run('2026-09-07', 8))
  writeFileSync(join(dir, 'wed.fit'), run('2026-09-09', 10))
  writeFileSync(join(dir, 'sat.fit'), run('2026-09-12', 16))
  writeFileSync(join(dir, 'sun.fit'), run('2026-09-13', 6))
  writeFileSync(join(dir, 'garbage.tcx'), '<TrainingCenterDatabase/>')
})

afterAll(() => {
  rmSync(dir, { recursive: true, force: true, maxRetries: 5 })
})

describe('FileActivitySource', () => {
  it('implementuje ActivitySource pod nazwą „files"', () => {
    const source: ActivitySource = new FileActivitySource({ path: dir })
    expect(source.name).toBe('files')
  })

  it('listActivities filtruje po zakresie dat włącznie z granicami', async () => {
    const source = new FileActivitySource({ path: dir })
    const week = await source.listActivities('2026-09-09', '2026-09-12')
    expect(week.map((a) => [a.date, a.distanceKm])).toEqual([
      ['2026-09-09', 10],
      ['2026-09-12', 16],
    ])
    expect(await source.listActivities('2026-09-14', '2026-09-20')).toEqual([])
  })

  it('lastSkipped: puste przed skanem, potem pliki pominięte w ostatnim skanie', async () => {
    const source = new FileActivitySource({ path: dir })
    expect(source.lastSkipped).toEqual([])
    await source.listActivities('2026-09-01', '2026-09-30')
    expect(source.lastSkipped).toEqual([{ file: join(dir, 'garbage.tcx'), reason: 'not-an-activity' }])
  })

  it('wellness z plików nie istnieje — pusta lista', async () => {
    expect(await new FileActivitySource({ path: dir }).listWellness('2026-09-01', '2026-09-30')).toEqual([])
  })

  it('pojedynczy plik jako źródło', async () => {
    const source = new FileActivitySource({ path: join(dir, 'sat.fit') })
    const all = await source.listActivities('2026-01-01', '2026-12-31')
    expect(all).toHaveLength(1)
    expect(all[0]!.avgPaceSecPerKm).toBe(330)
  })
})
