/**
 * Parser plików GPX 1.0/1.1 (Strava, Garmin, Komoot…) — bez biblioteki XML.
 *
 * GPX nie niesie podsumowania aktywności — wszystko liczymy z punktów `trkpt`:
 * - dystans: haversine między kolejnymi punktami jednego segmentu (`trkseg`).
 *   Zgodnie ze specyfikacją GPX 1.1 nowy segment oznacza utratę sygnału albo
 *   wyłączony odbiornik, więc odcinka między segmentami nie liczymy;
 * - czas całkowity: ostatni − pierwszy znacznik czasu;
 * - czas ruchu: odcinki z prędkością ≥ 0,5 m/s i przerwą ≤ 60 s (measure.ts);
 * - podejścia: dodatnie zmiany `ele` z progiem szumu 1 m (measure.ts);
 * - tętno: średnia z `…TrackPointExtension/hr` (Garmin, Strava), jeśli jest.
 * Sport z `trk/type`; bez niego heurystyka tempa (measure.ts — bez wpływu na kalibrację).
 */
import { toParsed, type ActivityPart, type ActivityType, type ParsedActivity } from './activity.ts'
import { localDateFromIso, parseIsoMs } from './dates.ts'
import { classifyByPace, elevationGainM, haversineM, movingTimeSec, type MotionSample } from './measure.ts'
import { attr, childNumber, childText, elements, stripComments, without } from './xml.ts'

/**
 * `trk/type` po normalizacji (małe litery, bez spacji, `_` i `-`). Garmin pisze
 * nazwy (`running`, `trail_running`), część eksportów Stravy — kody liczbowe
 * (9 = bieg, 1 = rower). Nieznany typ → `Other`.
 */
const GPX_TYPES: Record<string, ActivityType> = {
  running: 'Run',
  run: 'Run',
  '9': 'Run',
  trailrunning: 'TrailRun',
  trailrun: 'TrailRun',
  treadmillrunning: 'VirtualRun',
  treadmill: 'VirtualRun',
  indoorrunning: 'VirtualRun',
  virtualrun: 'VirtualRun',
  cycling: 'Ride',
  ride: 'Ride',
  biking: 'Ride',
  '1': 'Ride',
  walking: 'Walk',
  walk: 'Walk',
  hiking: 'Hike',
  hike: 'Hike',
  swimming: 'Swim',
  swim: 'Swim',
}

export function gpxType(raw: string): ActivityType {
  return GPX_TYPES[raw.toLowerCase().replace(/[\s_-]/g, '')] ?? 'Other'
}

interface Point {
  lat: number
  lon: number
  timeIso?: string
  timeMs?: number
  ele?: number
  hr?: number
}

function readPoint(attrs: string, inner: string): Point | undefined {
  const lat = Number(attr(attrs, 'lat'))
  const lon = Number(attr(attrs, 'lon'))
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return undefined
  }
  const point: Point = { lat, lon }
  const time = childText(inner, 'time')
  const timeMs = time === undefined ? undefined : parseIsoMs(time)
  if (time !== undefined && timeMs !== undefined) {
    point.timeIso = time
    point.timeMs = timeMs
  }
  const ele = childNumber(inner, 'ele')
  if (ele !== undefined) point.ele = ele
  const hr = childNumber(inner, 'hr')
  if (hr !== undefined && hr > 0) point.hr = hr
  return point
}

/**
 * Tekst GPX → aktywność. `undefined`, gdy plik nie ma śladu z czasem
 * (np. sama trasa `rte` albo punkty `wpt` narysowane na mapie).
 */
export function parseGpxActivity(text: string): ParsedActivity | undefined {
  const doc = stripComments(text)
  const tracks = elements(doc, 'trk')
  const firstTrack = tracks[0]
  if (!firstTrack) return undefined
  // Nazwa i typ to dzieci `trk` — nie `trkpt` (punkt też może mieć `name`).
  const meta = without(firstTrack.inner, 'trkseg')
  const name = childText(meta, 'name')
  const typeRaw = childText(meta, 'type')

  let distanceM = 0
  let moving = 0
  let first: Point | undefined
  let last: Point | undefined
  const elevations: number[] = []
  const hrs: number[] = []

  for (const track of tracks) {
    for (const segment of elements(track.inner, 'trkseg')) {
      let prev: Point | undefined
      let cumulative = 0
      const samples: MotionSample[] = []
      for (const raw of elements(segment.inner, 'trkpt')) {
        const point = readPoint(raw.attrs, raw.inner)
        if (!point) continue
        if (prev) cumulative += haversineM(prev.lat, prev.lon, point.lat, point.lon)
        prev = point
        if (point.ele !== undefined) elevations.push(point.ele)
        if (point.hr !== undefined) hrs.push(point.hr)
        if (point.timeMs === undefined) continue
        samples.push({ t: point.timeMs / 1000, d: cumulative })
        if (!first || point.timeMs < first.timeMs!) first = point
        if (!last || point.timeMs > last.timeMs!) last = point
      }
      distanceM += cumulative
      moving += movingTimeSec(samples)
    }
  }

  if (!first?.timeIso || first.timeMs === undefined || last?.timeMs === undefined) return undefined
  const date = localDateFromIso(first.timeIso)
  if (date === undefined) return undefined

  const part: ActivityPart = {
    startMs: first.timeMs,
    type: typeRaw === undefined ? classifyByPace(distanceM, moving) : gpxType(typeRaw),
    distanceM,
    movingTimeSec: moving,
    elapsedTimeSec: (last.timeMs - first.timeMs) / 1000,
  }
  const gain = elevationGainM(elevations)
  if (gain !== undefined) part.elevationGainM = gain
  if (hrs.length) part.avgHr = hrs.reduce((a, b) => a + b, 0) / hrs.length
  return toParsed(part, date, name)
}
