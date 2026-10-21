/**
 * Parser TCX na ręcznie napisanych, syntetycznych dokumentach.
 */
import { describe, expect, it } from 'vitest'
import { localDateFromMs } from './dates.ts'
import { parseTcxActivity } from './tcx.ts'

const point = (time: string, distance: number, alt?: number) => `
          <Trackpoint>
            <Time>${time}</Time>
            <Position><LatitudeDegrees>52.2</LatitudeDegrees><LongitudeDegrees>21.0</LongitudeDegrees></Position>
            ${alt === undefined ? '' : `<AltitudeMeters>${alt}</AltitudeMeters>`}
            <DistanceMeters>${distance}</DistanceMeters>
            <HeartRateBpm><Value>150</Value></HeartRateBpm>
          </Trackpoint>`

/** Dwa okrążenia: 1000 s / 3000 m / HR 140 i 500 s / 1600 m / HR 170, 20 s przerwy między nimi. */
const runningTcx = (sport = 'Running') => `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"
  xmlns:ns3="http://www.garmin.com/xmlschemas/ActivityExtension/v2">
  <Activities>
    <Activity Sport="${sport}">
      <Id>2026-09-14T10:00:00.000Z</Id>
      <!-- <Lap StartTime="2020-01-01T00:00:00Z"><TotalTimeSeconds>99999</TotalTimeSeconds></Lap> -->
      <Lap StartTime="2026-09-14T10:00:00.000Z">
        <TotalTimeSeconds>1000.0</TotalTimeSeconds>
        <DistanceMeters>3000.0</DistanceMeters>
        <MaximumSpeed>4.1</MaximumSpeed>
        <Calories>220</Calories>
        <AverageHeartRateBpm><Value>140</Value></AverageHeartRateBpm>
        <MaximumHeartRateBpm><Value>160</Value></MaximumHeartRateBpm>
        <Intensity>Active</Intensity>
        <TriggerMethod>Manual</TriggerMethod>
        <Track>${point('2026-09-14T10:00:00.000Z', 0, 100)}${point('2026-09-14T10:08:20.000Z', 1500, 101.2)}${point('2026-09-14T10:16:40.000Z', 3000, 100.4)}
        </Track>
        <Notes>okrążenie 1</Notes>
        <Extensions><ns3:LX><ns3:AvgSpeed>3.0</ns3:AvgSpeed></ns3:LX></Extensions>
      </Lap>
      <Lap StartTime="2026-09-14T10:17:00.000Z">
        <TotalTimeSeconds>500</TotalTimeSeconds>
        <DistanceMeters>1600</DistanceMeters>
        <AverageHeartRateBpm><Value>170</Value></AverageHeartRateBpm>
        <Intensity>Active</Intensity>
        <TriggerMethod>Manual</TriggerMethod>
        <Track>${point('2026-09-14T10:17:00.000Z', 3000, 103)}${point('2026-09-14T10:25:20.000Z', 4600, 104)}
        </Track>
      </Lap>
      <Notes>Tempo &amp; podbiegi</Notes>
      <Creator xsi:type="Device_t"><Name>Synthetic Watch</Name></Creator>
    </Activity>
  </Activities>
</TrainingCenterDatabase>`

describe('parseTcxActivity', () => {
  it('Running z dwoma okrążeniami: sumy z poziomu Lap, nie z punktów', () => {
    const a = parseTcxActivity(runningTcx())!
    expect(a).toMatchObject({
      type: 'Run',
      startTime: '2026-09-14T10:00:00.000Z',
      distanceM: 4600,
      movingTimeSec: 1500,
      // start 10:00:00, koniec drugiego okrążenia 10:17:00 + 500 s
      elapsedTimeSec: 1520,
      name: 'Tempo & podbiegi',
    })
  })

  it('tętno: średnia okrążeń ważona czasem — (140·1000 + 170·500) / 1500 = 150', () => {
    expect(parseTcxActivity(runningTcx())!.avgHr).toBe(150)
  })

  it('podejścia z AltitudeMeters punktów (próg szumu 1 m)', () => {
    // 100 → 101,2 (+1,2); 100,4 to szum (spadek < 1 m, odniesienie zostaje 101,2);
    // → 103 (+1,8); → 104 (+1) = 4
    expect(parseTcxActivity(runningTcx())!.elevationGainM).toBe(4)
  })

  it('data lokalna z czasu UTC — w strefie maszyny', () => {
    expect(parseTcxActivity(runningTcx())!.date).toBe(localDateFromMs(Date.parse('2026-09-14T10:00:00Z')))
  })

  it('jawne przesunięcie w StartTime: data jak zapisana, niezależnie od strefy maszyny', () => {
    // 00:30 w UTC+14 to 10:30Z poprzedniego dnia — strefa maszyny (−10…+13) dałaby 13 września
    const tcx = runningTcx().replaceAll('2026-09-14T10:00:00.000Z', '2026-09-14T00:30:00+14:00')
    const a = parseTcxActivity(tcx)!
    expect(a.startTime).toBe('2026-09-13T10:30:00.000Z')
    expect(a.date).toBe('2026-09-14')
  })

  it('Biking → Ride, Other → Other', () => {
    expect(parseTcxActivity(runningTcx('Biking'))!.type).toBe('Ride')
    expect(parseTcxActivity(runningTcx('Other'))!.type).toBe('Other')
  })

  it('znaczniki z prefiksem przestrzeni nazw (ns2:) czytają się tak samo', () => {
    const prefixed = runningTcx()
      .replace(/<(\/?)(?!\?|!|ns3:)([A-Za-z])/g, '<$1ns2:$2')
      .replace('xmlns="', 'xmlns:ns2="')
    expect(prefixed).toContain('<ns2:Lap StartTime=')
    const plain = parseTcxActivity(runningTcx())
    expect(parseTcxActivity(prefixed)).toEqual(plain)
  })

  it('multisport: z sesji bieg + rower liczymy wyłącznie bieg', () => {
    const lap = (start: string, sec: number, m: number) =>
      `<Lap StartTime="${start}"><TotalTimeSeconds>${sec}</TotalTimeSeconds><DistanceMeters>${m}</DistanceMeters></Lap>`
    const tcx = `<TrainingCenterDatabase><Activities><MultiSportSession>
      <Id>2026-09-20T07:00:00Z</Id>
      <FirstSport><Activity Sport="Biking"><Id>2026-09-20T07:00:00Z</Id>${lap('2026-09-20T07:00:00Z', 2400, 20000)}</Activity></FirstSport>
      <NextSport><Transition>${lap('2026-09-20T07:40:00Z', 60, 0)}</Transition>
        <Activity Sport="Running"><Id>2026-09-20T07:41:00Z</Id>${lap('2026-09-20T07:41:00Z', 1500, 5000)}</Activity></NextSport>
    </MultiSportSession></Activities></TrainingCenterDatabase>`
    const a = parseTcxActivity(tcx)!
    expect(a.type).toBe('Run')
    expect(a.distanceM).toBe(5000)
    expect(a.movingTimeSec).toBe(1500)
    expect(a.startTime).toBe('2026-09-20T07:00:00.000Z')
  })

  it('kilka zwykłych Activity w jednym pliku: bierzemy pierwszą, bez sumowania', () => {
    const one = (start: string, m: number) =>
      `<Activity Sport="Running"><Id>${start}</Id><Lap StartTime="${start}"><TotalTimeSeconds>600</TotalTimeSeconds><DistanceMeters>${m}</DistanceMeters></Lap></Activity>`
    const a = parseTcxActivity(
      `<TrainingCenterDatabase><Activities>${one('2026-09-01T06:00:00Z', 2000)}${one('2026-09-02T06:00:00Z', 3000)}</Activities></TrainingCenterDatabase>`,
    )!
    expect(a.distanceM).toBe(2000)
  })

  it('dokument bez aktywności (np. sam kurs) → undefined', () => {
    expect(parseTcxActivity('<TrainingCenterDatabase><Courses><Course/></Courses></TrainingCenterDatabase>')).toBeUndefined()
    expect(parseTcxActivity('to nie jest XML')).toBeUndefined()
  })
})
