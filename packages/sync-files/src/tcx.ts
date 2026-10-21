/**
 * Parser plików TCX (Garmin Training Center XML v2) — bez biblioteki XML.
 *
 * Bierzemy wartości z poziomu okrążenia (`Lap`), nie z punktów: `DistanceMeters`
 * występuje w obu miejscach, a w punkcie jest dystansem NARASTAJĄCYM — suma
 * z punktów dałaby bzdurę. Dlatego z okrążenia najpierw wycinamy `Track`.
 *
 * - `Activity Sport`: schemat zna tylko Running, Biking i Other.
 * - Start: `StartTime` pierwszego okrążenia (UTC), awaryjnie `Activity/Id`.
 * - Czas ruchu: suma `TotalTimeSeconds` okrążeń (czas stopera).
 * - Czas całkowity: od startu do końca ostatniego okrążenia albo ostatniego punktu.
 * - Tętno: średnia `AverageHeartRateBpm/Value` okrążeń ważona ich czasem.
 * - Podejścia: TCX ich nie podsumowuje — liczymy z `AltitudeMeters` punktów.
 * - Multisport (`MultiSportSession`): części biegowe sumowane (jak w FIT).
 */
import { combineParts, toParsed, type ActivityPart, type ActivityType, type ParsedActivity } from './activity.ts'
import { localDateFromIso, parseIsoMs } from './dates.ts'
import { elevationGainM } from './measure.ts'
import { attr, childNumber, childText, element, elements, stripComments, without, type XmlElement } from './xml.ts'

const SPORTS: Record<string, ActivityType> = { running: 'Run', biking: 'Ride' }

interface TcxPart {
  part: ActivityPart
  startIso: string
  name?: string
}

function activityPart(activity: XmlElement): TcxPart | undefined {
  const laps = elements(activity.inner, 'Lap')
  const startIso = (laps[0] && attr(laps[0].attrs, 'StartTime')) ?? childText(activity.inner, 'Id')
  const startMs = startIso === undefined ? undefined : parseIsoMs(startIso)
  if (startIso === undefined || startMs === undefined) return undefined

  let moving: number | undefined
  let lapDistance: number | undefined
  let maxPointDistance: number | undefined
  let endMs = startMs
  let hrWeighted = 0
  let hrWeight = 0
  const altitudes: number[] = []

  for (const lap of laps) {
    const summary = without(lap.inner, 'Track')
    const total = childNumber(summary, 'TotalTimeSeconds')
    const distance = childNumber(summary, 'DistanceMeters')
    const hrBlock = element(summary, 'AverageHeartRateBpm')
    const hr = hrBlock ? childNumber(hrBlock.inner, 'Value') : undefined
    if (total !== undefined) moving = (moving ?? 0) + total
    if (distance !== undefined) lapDistance = (lapDistance ?? 0) + distance
    if (hr !== undefined && total !== undefined && total > 0) {
      hrWeighted += hr * total
      hrWeight += total
    }
    const lapStartIso = attr(lap.attrs, 'StartTime')
    const lapStart = lapStartIso === undefined ? undefined : parseIsoMs(lapStartIso)
    if (lapStart !== undefined && total !== undefined) endMs = Math.max(endMs, lapStart + total * 1000)

    for (const point of elements(lap.inner, 'Trackpoint')) {
      const time = childText(point.inner, 'Time')
      const timeMs = time === undefined ? undefined : parseIsoMs(time)
      if (timeMs !== undefined) endMs = Math.max(endMs, timeMs)
      const alt = childNumber(point.inner, 'AltitudeMeters')
      if (alt !== undefined) altitudes.push(alt)
      const d = childNumber(point.inner, 'DistanceMeters')
      if (d !== undefined) maxPointDistance = Math.max(maxPointDistance ?? 0, d)
    }
  }

  const sport = (attr(activity.attrs, 'Sport') ?? '').toLowerCase()
  const part: ActivityPart = { startMs, type: SPORTS[sport] ?? 'Other' }
  // Okrążenie bez DistanceMeters łamie schemat, ale bywa — wtedy ostatni dystans narastający.
  const distanceM = lapDistance ?? maxPointDistance
  if (distanceM !== undefined) part.distanceM = distanceM
  if (moving !== undefined) part.movingTimeSec = moving
  if (endMs > startMs) part.elapsedTimeSec = (endMs - startMs) / 1000
  if (hrWeight > 0) part.avgHr = hrWeighted / hrWeight
  const gain = elevationGainM(altitudes)
  if (gain !== undefined) part.elevationGainM = gain

  const result: TcxPart = { part, startIso }
  // `Notes` aktywności (nie okrążenia) — tam Garmin i część eksporterów wpisują nazwę.
  const name = childText(without(activity.inner, 'Lap'), 'Notes')
  if (name) result.name = name
  return result
}

/**
 * Tekst TCX → aktywność. `undefined`, gdy dokument nie zawiera aktywności
 * z czasem startu (np. sam kurs `Courses` albo pusty eksport).
 */
export function parseTcxActivity(text: string): ParsedActivity | undefined {
  const doc = stripComments(text)
  const activities = elements(doc, 'Activity')
  if (activities.length === 0) return undefined
  // Kilka `Activity` w zwykłym pliku to historia wielu treningów — bierzemy
  // pierwszą. Łączymy wyłącznie części jednej sesji multisportowej.
  const multisport = element(doc, 'MultiSportSession') !== undefined
  const parts = (multisport ? activities : activities.slice(0, 1))
    .map(activityPart)
    .filter((p): p is TcxPart => p !== undefined)
  const combined = combineParts(parts.map((p) => p.part))
  if (!combined) return undefined
  const first = parts.reduce((a, b) => (b.part.startMs < a.part.startMs ? b : a))
  const date = localDateFromIso(first.startIso)
  if (date === undefined) return undefined
  return toParsed(combined, date, first.name)
}
