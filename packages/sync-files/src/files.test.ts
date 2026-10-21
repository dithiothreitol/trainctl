/**
 * Skan katalogu na tymczasowym drzewie z syntetycznymi plikami.
 */
import { mkdirSync, mkdtempSync, rmSync, truncateSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { activityFit, FitBuilder, FILE_ID_FIELDS, fileIdValues } from './fit-fixture.ts'
import { MAX_FILE_BYTES, scanActivityFiles, type ScanResult } from './files.ts'

const RUN_FIT = activityFit({
  sessions: [
    { start: '2026-09-14T05:00:00Z', sport: 1, timerSec: 3000, elapsedSec: 3100, distanceM: 10012.34, avgHr: 150 },
  ],
  utcOffsetSec: 2 * 3600,
})

const RIDE_FIT = activityFit({
  sessions: [{ start: '2026-09-10T15:00:00Z', sport: 2, timerSec: 3600, distanceM: 30000 }],
  utcOffsetSec: 2 * 3600,
})

const TRAIL_FIT = activityFit({
  sessions: [{ start: '2026-09-11T06:00:00Z', sport: 1, subSport: 3, timerSec: 1800, distanceM: 5000 }],
  utcOffsetSec: 2 * 3600,
})

const tcx = (sport: string, start: string, notes?: string) => `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"><Activities>
  <Activity Sport="${sport}"><Id>${start}</Id>
    <Lap StartTime="${start}"><TotalTimeSeconds>3600</TotalTimeSeconds><DistanceMeters>30000</DistanceMeters></Lap>
    ${notes ? `<Notes>${notes}</Notes>` : ''}
  </Activity>
</Activities></TrainingCenterDatabase>`

const WALK_GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1"><trk><type>walking</type><trkseg>
  <trkpt lat="52.000" lon="21"><time>2026-09-13T18:00:00+02:00</time></trkpt>
  <trkpt lat="52.001" lon="21"><time>2026-09-13T18:01:00+02:00</time></trkpt>
  <trkpt lat="52.002" lon="21"><time>2026-09-13T18:02:00+02:00</time></trkpt>
</trkseg></trk></gpx>`

const WORKOUT_FIT = new FitBuilder().define(0, 0, FILE_ID_FIELDS).data(0, fileIdValues(5, 0)).build()
const BROKEN_FIT = new FitBuilder().define(0, 0, FILE_ID_FIELDS).data(0, fileIdValues(4, 0)).build({ fileCrc: 'corrupt' })

let dir: string
let result: ScanResult

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'trainctl-sync-files-'))
  const put = (rel: string, content: Uint8Array | string) => {
    const full = join(dir, rel)
    mkdirSync(join(full, '..'), { recursive: true })
    writeFileSync(full, content)
  }
  put('2026/09/a-run.fit', RUN_FIT)
  put('2026/09/b-copy.FIT', RUN_FIT) // ta sama treść pod inną nazwą
  put('copy.fit.gz', gzipSync(RUN_FIT)) // i jeszcze raz, spakowana
  put('ride.FIT', RIDE_FIT)
  put('nested/deeper/trail.Fit.GZ', gzipSync(TRAIL_FIT))
  put('2026/ride.tcx.gz', gzipSync(tcx('Biking', '2026-09-12T08:00:00+02:00', 'Rower do pracy')))
  put('walk.gpx', WALK_GPX)
  put('notes.txt', 'nie jest aktywnością')
  put('summary.csv', 'id,date\n1,2026-09-14\n')
  put('.hidden/secret.fit', RUN_FIT)
  put('broken.fit', BROKEN_FIT)
  put('workout.fit', WORKOUT_FIT)
  put('bad.gpx.gz', 'to nie jest gzip')
  put('empty.tcx', '')
  put('bomb.fit.gz', gzipSync(Buffer.alloc(MAX_FILE_BYTES + 1024)))
  put('huge.gpx', '')
  truncateSync(join(dir, 'huge.gpx'), MAX_FILE_BYTES + 1)
  result = scanActivityFiles(dir)
})

afterAll(() => {
  // Windows potrafi chwilowo trzymać uchwyt (EBUSY) — stąd ponowienia.
  rmSync(dir, { recursive: true, force: true, maxRetries: 5 })
})

describe('scanActivityFiles: katalog', () => {
  it('rekurencyjnie, z wariantami .gz i dowolną wielkością liter; posortowane po dacie', () => {
    expect(result.activities.map((a) => [a.date, a.type])).toEqual([
      ['2026-09-10', 'Ride'],
      ['2026-09-11', 'TrailRun'],
      ['2026-09-12', 'Ride'],
      ['2026-09-13', 'Walk'],
      ['2026-09-14', 'Run'],
    ])
  })

  it('ta sama aktywność trzy razy (dwie nazwy + .gz) → jeden wpis, id z treści', () => {
    const runs = result.activities.filter((a) => a.type === 'Run')
    expect(runs).toHaveLength(1)
    expect(runs[0]!.externalId).toMatch(/^file-[0-9a-f]{16}$/)
    // pierwszy w kolejności przejścia (katalogi i pliki alfabetycznie)
    expect(runs[0]!.name).toBe('a-run')
    const ids = result.activities.map((a) => a.externalId)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('normalizacja do SyncedActivity: km do 2 miejsc, tempo z czasu ruchu, źródło file', () => {
    const run = result.activities.find((a) => a.type === 'Run')!
    expect(run).toEqual({
      externalId: run.externalId,
      date: '2026-09-14',
      type: 'Run',
      name: 'a-run',
      source: 'file',
      distanceKm: 10.01,
      movingTimeSec: 3000,
      elapsedTimeSec: 3100,
      avgHr: 150,
      // 3000 s / 10,01234 km = 299,6 → 300
      avgPaceSecPerKm: 300,
    })
  })

  it('nazwa: z pliku, gdy ją niesie (TCX Notes), inaczej nazwa pliku bez rozszerzenia', () => {
    const byDate = Object.fromEntries(result.activities.map((a) => [a.date, a.name]))
    expect(byDate['2026-09-12']).toBe('Rower do pracy')
    expect(byDate['2026-09-11']).toBe('trail')
    expect(byDate['2026-09-13']).toBe('walk')
  })

  it('pominięte pliki z powodem; obce rozszerzenia i pliki ukryte — po cichu', () => {
    const skipped = result.skipped.map((s) => [basename(s.file), s.reason]).sort()
    expect(skipped).toEqual(
      [
        ['bad.gpx.gz', 'unreadable'],
        ['bomb.fit.gz', 'unsupported'],
        ['broken.fit', 'unreadable'],
        ['empty.tcx', 'not-an-activity'],
        ['huge.gpx', 'unsupported'],
        ['workout.fit', 'not-an-activity'],
      ].sort(),
    )
    const all = JSON.stringify(result)
    expect(all).not.toContain('notes.txt')
    expect(all).not.toContain('summary.csv')
    expect(all).not.toContain('secret')
  })
})

describe('scanActivityFiles: pojedynczy plik', () => {
  it('wskazany plik aktywności', () => {
    const one = scanActivityFiles(join(dir, 'walk.gpx'))
    expect(one.activities).toHaveLength(1)
    expect(one.activities[0]!.type).toBe('Walk')
    expect(one.skipped).toEqual([])
  })

  it('id nie zależy od nazwy ani od spakowania', () => {
    const plain = scanActivityFiles(join(dir, '2026', '09', 'b-copy.FIT')).activities[0]!
    const packed = scanActivityFiles(join(dir, 'copy.fit.gz')).activities[0]!
    expect(plain.externalId).toBe(packed.externalId)
    expect(plain.name).toBe('b-copy')
  })

  it('wskazany wprost plik o obcym rozszerzeniu → unsupported', () => {
    const one = scanActivityFiles(join(dir, 'notes.txt'))
    expect(one.activities).toEqual([])
    expect(one.skipped).toEqual([{ file: join(dir, 'notes.txt'), reason: 'unsupported' }])
  })

  it('uszkodzony plik nie rzuca — trafia do skipped', () => {
    expect(scanActivityFiles(join(dir, 'broken.fit')).skipped).toEqual([
      { file: join(dir, 'broken.fit'), reason: 'unreadable' },
    ])
  })

  it('kodowanie z prologu XML (windows-1250) — polskie znaki w nazwie przeżywają', () => {
    const [head, tail] = tcx('Running', '2026-09-15T06:00:00+02:00', 'Bieg z@bkowy')
      .replace('encoding="UTF-8"', 'encoding="windows-1250"')
      .split('@')
    // „ą" w windows-1250 to jeden bajt 0xB9 — jako UTF-8 byłby nieczytelny
    const bytes = Buffer.concat([Buffer.from(head!, 'latin1'), Buffer.from([0xb9]), Buffer.from(tail!, 'latin1')])
    const file = join(dir, 'cp1250.tcx')
    writeFileSync(file, bytes)
    expect(scanActivityFiles(file).activities[0]!.name).toBe('Bieg ząbkowy')
  })

  it('nieistniejąca ścieżka to błąd konfiguracji — wyjątek ENOENT', () => {
    expect(() => scanActivityFiles(join(dir, 'nie-ma-mnie'))).toThrow(/ENOENT/)
  })
})

describe('ten sam bieg w dwóch formatach', () => {
  it('FIT i GPX z tym samym startem liczą się raz — zostaje FIT, bogatszy w dane', () => {
    const twinDir = mkdtempSync(join(tmpdir(), 'trainctl-sync-files-twin-'))
    try {
      // GPX tego samego biegu co RUN_FIT: start 05:00Z, ~10 km na północ, punkt co 10 s
      const points = Array.from({ length: 301 }, (_, i) =>
        `<trkpt lat="${(52 + (10.0 / 111.195) * (i / 300)).toFixed(6)}" lon="21"><time>${new Date(Date.parse('2026-09-14T05:00:00Z') + i * 10_000).toISOString()}</time></trkpt>`)
      writeFileSync(join(twinDir, 'strava.gpx'), `<?xml version="1.0"?><gpx version="1.1"><trk><type>running</type><trkseg>${points.join('')}</trkseg></trk></gpx>`)
      writeFileSync(join(twinDir, 'garmin.fit'), RUN_FIT)
      const scan = scanActivityFiles(twinDir)
      expect(scan.activities).toHaveLength(1)
      expect(scan.activities[0]!.name).toBe('garmin')
    } finally {
      rmSync(twinDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
    }
  })
})
