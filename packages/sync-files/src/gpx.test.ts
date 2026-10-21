/**
 * Parser GPX na syntetycznych śladach o znanej geometrii.
 */
import { describe, expect, it } from 'vitest'
import { localDateFromMs } from './dates.ts'
import { gpxType, parseGpxActivity } from './gpx.ts'
import { EARTH_RADIUS_M, haversineM } from './measure.ts'

interface Pt {
  lat: number
  lon: number
  /** Sekundy od startu; `undefined` = punkt bez czasu. */
  t?: number
  ele?: number
  hr?: number
}

const START_MS = Date.parse('2026-09-14T06:00:00Z')
const iso = (t: number) => new Date(START_MS + t * 1000).toISOString()

const trkpt = (p: Pt) =>
  `<trkpt lat="${p.lat}" lon="${p.lon}">` +
  (p.ele === undefined ? '' : `<ele>${p.ele}</ele>`) +
  (p.t === undefined ? '' : `<time>${iso(p.t)}</time>`) +
  (p.hr === undefined
    ? ''
    : `<extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>${p.hr}</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions>`) +
  `</trkpt>`

const gpx = (segments: Pt[][], meta: { name?: string; type?: string } = {}) => `<?xml version="1.0" encoding="UTF-8"?>
<gpx creator="SyntheticGPX" version="1.1" xmlns="http://www.topografix.com/GPX/1/1"
  xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1">
  <metadata><time>${iso(0)}</time></metadata>
  <trk>
    ${meta.name === undefined ? '' : `<name>${meta.name}</name>`}
    ${meta.type === undefined ? '' : `<type>${meta.type}</type>`}
    ${segments.map((s) => `<trkseg>${s.map(trkpt).join('\n')}</trkseg>`).join('\n')}
  </trk>
</gpx>`

/** Ślad na południk 21°E: co 30 s o 0,001° na północ (~111 m → ~3,7 m/s). */
const northward = (n: number, from = 0, latStart = 52): Pt[] =>
  Array.from({ length: n }, (_, i) => ({ lat: latStart + i * 0.001, lon: 21, t: from + i * 30 }))

/** Łuk południka: R · Δφ — dokładny wynik dla modelu kulistego, niezależny od wzoru haversine. */
const meridianM = (dLatDeg: number) => EARTH_RADIUS_M * ((dLatDeg * Math.PI) / 180)

describe('haversine', () => {
  it('wzdłuż południka zgadza się z R·Δφ', () => {
    expect(haversineM(52, 21, 53, 21)).toBeCloseTo(meridianM(1), 3)
  })

  it('wzdłuż równoleżnika 52° — w granicach 0,5% od R·cos φ·Δλ', () => {
    const expected = EARTH_RADIUS_M * Math.cos((52 * Math.PI) / 180) * ((0.01 * Math.PI) / 180)
    const d = haversineM(52, 21, 52, 21.01)
    expect(Math.abs(d - expected) / expected).toBeLessThan(0.005)
  })
})

describe('parseGpxActivity', () => {
  it('ślad o znanych współrzędnych: dystans w granicach 0,5%, czasy, nazwa i typ z trk', () => {
    const points = northward(11).map((p, i) => ({ ...p, ele: 100 + i * 0.5, hr: 150 }))
    const text = gpx([points], { name: 'Poranny bieg', type: 'running' }).replace(
      '<trkpt lat="52.001"',
      '<trkpt lat="52.001"><name>punkt, nie ślad</name></trkpt><trkpt lat="52.001"',
    )
    const a = parseGpxActivity(text)!
    const expected = meridianM(0.01)
    expect(Math.abs(a.distanceM! - expected) / expected).toBeLessThan(0.005)
    expect(a).toMatchObject({
      type: 'Run',
      name: 'Poranny bieg',
      startTime: '2026-09-14T06:00:00.000Z',
      elapsedTimeSec: 300,
      movingTimeSec: 300,
      // +0,5 m na punkt: łagodne podejście liczy się w całości (5 m), mimo progu 1 m
      elevationGainM: 5,
      avgHr: 150,
      date: localDateFromMs(START_MS),
    })
  })

  it('pauza dłuższa niż 60 s nie wlicza się do czasu ruchu', () => {
    const points = [...northward(3, 0), ...northward(3, 300, 52.002 + 0.0005)]
    const a = parseGpxActivity(gpx([points], { type: 'running' }))!
    expect(a.elapsedTimeSec).toBe(360)
    expect(a.movingTimeSec).toBe(120)
  })

  it('odcinek między segmentami (utrata sygnału) nie wlicza się do dystansu', () => {
    const a = parseGpxActivity(gpx([northward(6, 0), northward(6, 200, 53)], { type: 'running' }))!
    const expected = 2 * meridianM(0.005)
    expect(Math.abs(a.distanceM! - expected) / expected).toBeLessThan(0.005)
    expect(a.elapsedTimeSec).toBe(350)
  })

  it('brak typu: heurystyka tempa — ~4:30 min/km to bieg, rower i marsz to Other', () => {
    const at = (stepDeg: number) =>
      Array.from({ length: 11 }, (_, i) => ({ lat: 52 + i * stepDeg, lon: 21, t: i * 30 }))
    expect(parseGpxActivity(gpx([at(0.001)]))!.type).toBe('Run') // ~3,7 m/s
    expect(parseGpxActivity(gpx([at(0.003)]))!.type).toBe('Other') // ~11 m/s
    expect(parseGpxActivity(gpx([at(0.0003)]))!.type).toBe('Other') // ~1,1 m/s
  })

  it('typ cycling → Ride (nawet przy tempie biegowym)', () => {
    expect(parseGpxActivity(gpx([northward(5)], { type: 'cycling' }))!.type).toBe('Ride')
  })

  it.each([
    ['running', 'Run'],
    ['Run', 'Run'],
    ['9', 'Run'],
    ['trail_running', 'TrailRun'],
    ['cycling', 'Ride'],
    ['1', 'Ride'],
    ['walking', 'Walk'],
    ['Hiking', 'Hike'],
    ['kayaking', 'Other'],
  ])('trk/type %s → %s', (raw, type) => {
    expect(gpxType(raw)).toBe(type)
  })

  it('nazwa w CDATA i czas z jawnym przesunięciem (data jak zapisana, nie ze strefy maszyny)', () => {
    // Te same chwile zapisane jako czas ścienny UTC−12: 06:00Z to 18:00 poprzedniego dnia.
    // Maszyna w strefie od −6 do +14 policzyłaby 14 września — zapis mówi 13.
    const minus12 = (z: string) => new Date(Date.parse(z) - 12 * 3600_000).toISOString().slice(0, 19) + '-12:00'
    const text = gpx([northward(4)], { name: '<![CDATA[Bieg & podbiegi]]>', type: 'running' }).replace(
      /<time>([^<]+)<\/time>/g,
      (_, z: string) => `<time>${minus12(z)}</time>`,
    )
    expect(text).toContain('<time>2026-09-13T18:00:00-12:00</time>')
    const a = parseGpxActivity(text)!
    expect(a.name).toBe('Bieg & podbiegi')
    expect(a.startTime).toBe('2026-09-14T06:00:00.000Z')
    expect(a.date).toBe('2026-09-13')
  })

  it('ślad bez czasu (narysowana trasa) i plik bez trk → undefined', () => {
    const untimed = northward(5).map(({ lat, lon }) => ({ lat, lon }))
    expect(parseGpxActivity(gpx([untimed], { type: 'running' }))).toBeUndefined()
    expect(
      parseGpxActivity('<gpx><rte><rtept lat="52" lon="21"/><rtept lat="52.1" lon="21"/></rte></gpx>'),
    ).toBeUndefined()
  })
})
