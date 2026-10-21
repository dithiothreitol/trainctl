/**
 * Dekoder FIT na syntetycznych plikach z testowego kodera (fit-fixture.ts).
 * Żadnych realnych aktywności — wszystkie wartości są wymyślone.
 */
import { describe, expect, it } from 'vitest'
import { localDateFromMs } from './dates.ts'
import { fitCrc, parseFitActivity } from './fit.ts'
import {
  ACTIVITY_FIELDS,
  FILE_ID_FIELDS,
  FitBuilder,
  SESSION_FIELDS,
  activityFit,
  crc16Arc,
  fileIdValues,
  fitTime,
  sessionValues,
  type SessionSpec,
} from './fit-fixture.ts'

const RUN: SessionSpec = {
  start: '2026-09-14T22:30:00Z',
  sport: 1,
  elapsedSec: 3150,
  timerSec: 3000,
  distanceM: 10012.34,
  avgHr: 152,
  ascentM: 85,
}

describe('CRC', () => {
  it('tablicowy CRC dekodera = CRC-16/ARC (wartość kontrolna 0xBB3D dla „123456789")', () => {
    const check = new TextEncoder().encode('123456789')
    expect(fitCrc(check)).toBe(0xbb3d)
    expect(crc16Arc(check)).toBe(0xbb3d)
  })
})

describe('parseFitActivity: bieg', () => {
  it('sesja biegowa: dystans, czas stopera vs całkowity, tętno, podejścia', () => {
    const a = parseFitActivity(activityFit({ sessions: [RUN], utcOffsetSec: 2 * 3600 }))!
    expect(a).toMatchObject({
      type: 'Run',
      startTime: '2026-09-14T22:30:00.000Z',
      distanceM: 10012.34,
      movingTimeSec: 3000,
      elapsedTimeSec: 3150,
      avgHr: 152,
      elevationGainM: 85,
    })
  })

  it('data lokalna z local_timestamp: 22:30 UTC przy UTC+2 to już następny dzień', () => {
    const a = parseFitActivity(activityFit({ sessions: [RUN], utcOffsetSec: 2 * 3600 }))!
    expect(a.date).toBe('2026-09-15')
  })

  it('data lokalna przy ujemnym przesunięciu: 02:00 UTC przy UTC−5 to poprzedni dzień', () => {
    const a = parseFitActivity(
      activityFit({ sessions: [{ ...RUN, start: '2026-09-15T02:00:00Z' }], utcOffsetSec: -5 * 3600 }),
    )!
    expect(a.date).toBe('2026-09-14')
  })

  it('bez komunikatu activity — data w strefie maszyny', () => {
    const a = parseFitActivity(activityFit({ sessions: [RUN] }))!
    expect(a.date).toBe(localDateFromMs(Date.parse(RUN.start)))
  })

  it('wartości „invalid" (0xFF tętno, 0xFFFF podejścia) to brak pola, nie liczba', () => {
    const a = parseFitActivity(
      activityFit({ sessions: [{ start: RUN.start, sport: 1, timerSec: 600, distanceM: 2000 }], utcOffsetSec: 0 }),
    )!
    expect(a.avgHr).toBeUndefined()
    expect(a.elevationGainM).toBeUndefined()
    expect(a.elapsedTimeSec).toBeUndefined()
    expect(a.distanceM).toBe(2000)
  })

  it.each([
    [1, 0, 'Run'],
    [1, 3, 'TrailRun'],
    [1, 1, 'VirtualRun'],
    [1, 45, 'VirtualRun'],
    [1, 58, 'VirtualRun'],
    [2, 0, 'Ride'],
    [11, 0, 'Walk'],
    [17, 0, 'Hike'],
    [5, 17, 'Swim'],
    [4, 20, 'WeightTraining'],
    [10, 20, 'WeightTraining'],
    [4, 15, 'Other'],
    [15, 0, 'Other'],
  ])('sport %i / sub_sport %i → %s', (sport, subSport, type) => {
    const a = parseFitActivity(activityFit({ sessions: [{ ...RUN, sport, subSport }], utcOffsetSec: 0 }))!
    expect(a.type).toBe(type)
  })
})

describe('parseFitActivity: format', () => {
  it('definicje big-endian dają ten sam wynik co little-endian', () => {
    const little = parseFitActivity(activityFit({ sessions: [RUN], utcOffsetSec: 3600 }))
    const big = parseFitActivity(activityFit({ sessions: [RUN], utcOffsetSec: 3600, bigEndian: true }))
    expect(big).toEqual(little)
    expect(big?.distanceM).toBe(10012.34)
  })

  it('pola deweloperskie są pomijane po rozmiarach — kolejne komunikaty czytają się poprawnie', () => {
    const a = parseFitActivity(activityFit({ sessions: [RUN], utcOffsetSec: 2 * 3600, devFieldSizes: [4, 1, 7] }))!
    expect(a.distanceM).toBe(10012.34)
    expect(a.avgHr).toBe(152)
    // `activity` stoi PO sesji z polami deweloperskimi — przesunięcie strefy musi przetrwać
    expect(a.date).toBe('2026-09-15')
  })

  it('nagłówek 12-bajtowy (bez CRC nagłówka)', () => {
    const b = new FitBuilder()
      .define(0, 0, FILE_ID_FIELDS)
      .data(0, fileIdValues(4, fitTime(RUN.start)))
      .define(1, 18, SESSION_FIELDS)
      .data(1, sessionValues(RUN))
    expect(parseFitActivity(b.build({ headerSize: 12 }))?.distanceM).toBe(10012.34)
  })

  it('CRC nagłówka 0x0000 jest dozwolone, plik bez CRC końcowego też', () => {
    const b = () =>
      new FitBuilder()
        .define(0, 0, FILE_ID_FIELDS)
        .data(0, fileIdValues(4, 0))
        .define(1, 18, SESSION_FIELDS)
        .data(1, sessionValues(RUN))
    expect(parseFitActivity(b().build({ headerCrc: 'zero' }))?.type).toBe('Run')
    expect(parseFitActivity(b().build({ fileCrc: 'omit' }))?.type).toBe('Run')
  })

  it('uszkodzenia → wyjątek: CRC pliku, niezerowe złe CRC nagłówka, sygnatura, ucięcie', () => {
    const good = activityFit({ sessions: [RUN], utcOffsetSec: 0 })
    const b = () => new FitBuilder().define(0, 0, FILE_ID_FIELDS).data(0, fileIdValues(4, 0))
    expect(() => parseFitActivity(b().build({ fileCrc: 'corrupt' }))).toThrow(/CRC/)
    expect(() => parseFitActivity(b().build({ headerCrc: 'corrupt' }))).toThrow(/header CRC/)
    const noSignature = good.slice()
    noSignature[8] = 0x2a
    expect(() => parseFitActivity(noSignature)).toThrow(/signature/)
    expect(() => parseFitActivity(good.slice(0, good.length - 20))).toThrow()
    expect(() => parseFitActivity(new Uint8Array(5))).toThrow()
  })

  it('rekord danych bez definicji → wyjątek', () => {
    const bytes = new FitBuilder().raw(0x03, 0x00).build()
    expect(() => parseFitActivity(bytes)).toThrow(/definition/)
  })

  it('file_id.type ≠ 4 (np. 5 = trening) → nie jest aktywnością', () => {
    expect(parseFitActivity(activityFit({ fileType: 5, sessions: [RUN], utcOffsetSec: 0 }))).toBeUndefined()
  })

  it('brak file_id → nie jest aktywnością', () => {
    const bytes = new FitBuilder().define(1, 18, SESSION_FIELDS).data(1, sessionValues(RUN)).build()
    expect(parseFitActivity(bytes)).toBeUndefined()
  })
})

describe('parseFitActivity: multisport', () => {
  it('bieg + rower + bieg: sumujemy tylko bieg, typ Run, start z pierwszej sesji', () => {
    const a = parseFitActivity(
      activityFit({
        sessions: [
          { start: '2026-09-20T07:00:00Z', sport: 1, timerSec: 1500, elapsedSec: 1510, distanceM: 5000, avgHr: 160 },
          { start: '2026-09-20T07:26:00Z', sport: 2, timerSec: 2400, elapsedSec: 2420, distanceM: 20000, avgHr: 150 },
          { start: '2026-09-20T08:07:00Z', sport: 1, timerSec: 800, elapsedSec: 805, distanceM: 2500, avgHr: 170 },
        ],
        utcOffsetSec: 3600,
      }),
    )!
    expect(a.type).toBe('Run')
    expect(a.distanceM).toBe(7500)
    expect(a.movingTimeSec).toBe(2300)
    expect(a.elapsedTimeSec).toBe(2315)
    // tętno ważone czasem stopera: (160·1500 + 170·800) / 2300 ≈ 163,5
    expect(a.avgHr).toBe(163)
    expect(a.startTime).toBe('2026-09-20T07:00:00.000Z')
    expect(a.date).toBe('2026-09-20')
  })

  it('multisport bez biegu: suma wszystkich części, typ z pierwszej', () => {
    const a = parseFitActivity(
      activityFit({
        sessions: [
          { start: '2026-09-20T07:00:00Z', sport: 5, timerSec: 900, distanceM: 1500 },
          { start: '2026-09-20T07:20:00Z', sport: 2, timerSec: 3600, distanceM: 30000 },
        ],
        utcOffsetSec: 0,
      }),
    )!
    expect(a.type).toBe('Swim')
    expect(a.distanceM).toBe(31500)
  })
})

describe('parseFitActivity: bez sesji (punkty record)', () => {
  const RECORD_FULL = [
    { num: 253, type: 'uint32' as const },
    { num: 5, type: 'uint32' as const }, // distance (cm)
    { num: 3, type: 'uint8' as const }, // heart_rate
    { num: 2, type: 'uint16' as const }, // altitude (skala 5, offset 500)
  ]
  const alt = (m: number) => Math.round((m + 500) * 5)

  it('dystans z ostatniego punktu, pauza > 60 s poza czasem ruchu, sport z komunikatu sport', () => {
    const t0 = fitTime('2026-09-16T05:00:00Z')
    const b = new FitBuilder()
      .define(0, 0, FILE_ID_FIELDS)
      .data(0, fileIdValues(4, t0))
      .define(3, 12, [
        { num: 0, type: 'enum' },
        { num: 1, type: 'enum' },
      ])
      .data(3, [1, 3]) // running / trail
      .define(1, 20, RECORD_FULL)
    const points: [number, number, number, number][] = [
      // [s od startu, m, tętno, wysokość]
      [0, 0, 120, 100],
      [10, 30, 130, 101],
      [20, 60, 140, 103],
      [30, 90, 150, 103.4],
      [200, 95, 110, 103], // 170 s przerwy — pauza
      [210, 125, 140, 105],
      [220, 155, 150, 106],
    ]
    for (const [dt, d, hr, a] of points) b.data(1, [t0 + dt, d * 100, hr, alt(a)])
    const a = parseFitActivity(b.build())!
    expect(a.type).toBe('TrailRun')
    expect(a.distanceM).toBe(155)
    expect(a.elapsedTimeSec).toBe(220)
    expect(a.movingTimeSec).toBe(50)
    expect(a.avgHr).toBe(Math.round((120 + 130 + 140 + 150 + 110 + 140 + 150) / 7))
    // histereza 1 m: 100→101 (+1), →103 (+2), 103,4 i 103 to szum, →105 (+2), →106 (+1)
    expect(a.elevationGainM).toBe(6)
    expect(a.startTime).toBe('2026-09-16T05:00:00.000Z')
  })

  it('skompresowany znacznik czasu, także z przeniesieniem przez granicę 32 s', () => {
    // t0 ≡ 28 (mod 32), żeby przesunięcia 29, 31, 1, 5 dawały +1, +3, +5 (przeniesienie), +9
    let t0 = fitTime('2026-09-17T06:00:00Z')
    t0 += (28 - (t0 % 32) + 32) % 32
    const b = new FitBuilder()
      .define(0, 0, FILE_ID_FIELDS)
      .data(0, fileIdValues(4, t0))
      .define(1, 20, [
        { num: 253, type: 'uint32' },
        { num: 5, type: 'uint32' },
      ])
      .data(1, [t0, 0])
      .define(2, 20, [{ num: 5, type: 'uint32' }]) // bez timestamp — czas z nagłówka
      .compressed(2, 29, [300])
      .compressed(2, 31, [900])
      .compressed(2, 1, [1500])
      .compressed(2, 5, [2700])
    const a = parseFitActivity(b.build())!
    expect(a.elapsedTimeSec).toBe(9)
    expect(a.movingTimeSec).toBe(9)
    expect(a.distanceM).toBe(27)
    // brak komunikatu sport: heurystyka tempa (3 m/s ≈ 5:33 min/km → bieg)
    expect(a.type).toBe('Run')
  })

  it('skompresowany znacznik bez wcześniejszego pełnego → wyjątek', () => {
    const b = new FitBuilder()
      .define(0, 0, FILE_ID_FIELDS)
      .data(0, fileIdValues(4, 0)) // file_id nie ma pola 253 — to nie jest punkt odniesienia
      .define(2, 20, [{ num: 5, type: 'uint32' }])
      .compressed(2, 3, [100])
    expect(() => parseFitActivity(b.build())).toThrow(/compressed/)
  })

  it('plik aktywności bez sesji i bez punktów → nie ma czego porównać', () => {
    const b = new FitBuilder().define(0, 0, FILE_ID_FIELDS).data(0, fileIdValues(4, 0))
    b.define(2, 34, ACTIVITY_FIELDS).data(2, [1000, 0, 0, 1000])
    expect(parseFitActivity(b.build())).toBeUndefined()
  })
})
