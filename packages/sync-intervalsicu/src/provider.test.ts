/**
 * Testy adaptera na nagranych odpowiedziach — bez sieci i bez klucza.
 * Kształt odpowiedzi wzorowany na przykładach z docs/integrations/intervalsicu.md §2.
 */
import { describe, expect, it } from 'vitest'
import { setLocale } from 'trainctl-core'

setLocale('pl')
import { IntervalsIcuClient, IntervalsIcuError } from './client.ts'
import { IntervalsIcuProvider } from './provider.ts'

interface Recorded {
  url: string
  init?: RequestInit
}

function fakeFetch(handler: (url: string, init?: RequestInit) => { status?: number; body?: unknown }) {
  const calls: Recorded[] = []
  const fn = async (url: string, init?: RequestInit): Promise<Response> => {
    calls.push({ url, ...(init ? { init } : {}) })
    const { status = 200, body = [] } = handler(url, init)
    return new Response(JSON.stringify(body), {
      status,
      statusText: status === 200 ? 'OK' : 'Error',
      headers: { 'Content-Type': 'application/json' },
    })
  }
  return { fn, calls }
}

const provider = (handler: Parameters<typeof fakeFetch>[0]) => {
  const { fn, calls } = fakeFetch(handler)
  return {
    calls,
    provider: new IntervalsIcuProvider(
      new IntervalsIcuClient({ apiKey: 'test-key-123', fetch: fn }),
    ),
  }
}

it('publishes distinct Ride and Swim events with session IDs, time and distance', async () => {
  const {provider:p,calls}=provider(()=>({body:[]}))
  const r=await p.pushWorkouts([
    {externalId:'trainctl-p-bike1',date:'2026-11-03',startTime:'07:30',name:'Bike',description:'- 1800s 130w',sport:'bike',durationSec:1800},
    {externalId:'trainctl-p-swim1',date:'2026-11-03',startTime:'18:00',name:'Swim',description:'- 1000mtr',sport:'swim',durationSec:1200,distanceKm:1},
  ])
  expect(r.pushed).toBe(2)
  const body=JSON.parse(calls[0]!.init!.body as string)
  expect(body.map((w:{type:string})=>w.type)).toEqual(['Ride','Swim'])
  expect(body[0]).toMatchObject({moving_time:1800,start_date_local:'2026-11-03T07:30:00'})
  expect(body[1]).toMatchObject({distance_target:1000,external_id:'trainctl-p-swim1'})
})

describe('autoryzacja', () => {
  it('Basic auth z username API_KEY (§1.1)', async () => {
    const { provider: p, calls } = provider(() => ({ body: { id: 'i123', name: 'Test' } }))
    await p.verify()
    const auth = (calls[0]!.init!.headers as Record<string, string>)['Authorization']!
    expect(auth.startsWith('Basic ')).toBe(true)
    expect(Buffer.from(auth.slice(6), 'base64').toString()).toBe('API_KEY:test-key-123')
  })

  it('domyślnie athlete 0 (atleta powiązany z kluczem)', async () => {
    const { provider: p, calls } = provider(() => ({ body: {} }))
    await p.verify()
    expect(calls[0]!.url).toBe('https://intervals.icu/api/v1/athlete/0')
  })

  it('401 → czytelna podpowiedź o kluczu', async () => {
    const { provider: p } = provider(() => ({ status: 401, body: { error: 'unauthorized' } }))
    await expect(p.verify()).rejects.toThrow(/Developer Settings/)
  })

  it('429 → informacja o limicie zapytań', async () => {
    const { provider: p } = provider(() => ({ status: 429, body: {} }))
    await expect(p.listActivities('2026-08-01', '2026-08-05')).rejects.toThrow(/limit zapytań/)
  })

  it('błąd niesie status', async () => {
    const { provider: p } = provider(() => ({ status: 500, body: {} }))
    await p.verify().catch((e: unknown) => {
      expect(e).toBeInstanceOf(IntervalsIcuError)
      expect((e as IntervalsIcuError).status).toBe(500)
    })
    expect.assertions(2)
  })

  it('brak klucza → wyjątek przy konstrukcji', () => {
    expect(() => new IntervalsIcuClient({ apiKey: '' })).toThrow(/klucz/)
  })
})

describe('pull aktywności', () => {
  const RAW = [
    {
      id: 'i55751783',
      start_date_local: '2026-08-04T17:12:00',
      type: 'Run',
      name: 'Interwały 5x1km',
      distance: 12400,
      moving_time: 3180,
      elapsed_time: 3400,
      total_elevation_gain: 85,
      average_heartrate: 158.6,
      icu_rpe: 7,
    },
  ]

  it('mapuje jednostki i liczy tempo średnie', async () => {
    const { provider: p, calls } = provider(() => ({ body: RAW }))
    const [a] = await p.listActivities('2026-08-01', '2026-08-07')
    expect(calls[0]!.url).toContain('/activities?oldest=2026-08-01&newest=2026-08-07')
    expect(a).toMatchObject({
      externalId: 'i55751783',
      date: '2026-08-04',
      type: 'Run',
      distanceKm: 12.4,
      movingTimeSec: 3180,
      elevationGainM: 85,
      avgHr: 159,
      rpe: 7,
    })
    expect(a!.avgPaceSecPerKm).toBe(256) // 3180 s / 12,4 km
  })

  it('pusta odpowiedź i braki pól nie wywracają mapowania', async () => {
    const { provider: p } = provider(() => ({ body: [{ id: 'x', start_date_local: '2026-08-04T00:00:00' }] }))
    const [a] = await p.listActivities('2026-08-01', '2026-08-07')
    expect(a!.type).toBe('Unknown')
    expect(a!.distanceKm).toBeUndefined()
    expect(a!.avgPaceSecPerKm).toBeUndefined()
  })
})

describe('aktywności, których hub nie oddaje', () => {
  // Odpowiedź z prawdziwego konta (2026-08-07): intervals.icu zwraca sam
  // identyfikator, datę i źródło, gdy aktywność przyszła ze Stravy — warunki
  // Stravy zakazują re-eksportu przez API huba.
  const STUB = [
    {
      id: '19572987988',
      start_date_local: '2026-08-02T12:45:43',
      source: 'STRAVA',
    },
  ]

  it('oznacza je jako dataWithheld i zapamiętuje źródło', async () => {
    const { provider: p } = provider(() => ({ body: STUB }))
    const [a] = await p.listActivities('2026-08-01', '2026-08-07')
    expect(a!.dataWithheld).toBe(true)
    expect(a!.source).toBe('STRAVA')
    expect(a!.distanceKm).toBeUndefined()
  })

  it('wykrywa je po BRAKU pól, nie po treści komunikatu z API', async () => {
    // gdyby intervals.icu zmieniło brzmienie swojej adnotacji, detekcja ma dalej działać
    const { provider: p } = provider(() => ({
      body: [{ id: 'x', start_date_local: '2026-08-02T10:00:00', source: 'INNY_HUB' }],
    }))
    const [a] = await p.listActivities('2026-08-01', '2026-08-07')
    expect(a!.dataWithheld).toBe(true)
    expect(a!.source).toBe('INNY_HUB')
  })

  it('normalna aktywność NIE jest oznaczana', async () => {
    const { provider: p } = provider(() => ({
      body: [{ id: 'y', start_date_local: '2026-08-02T10:00:00', type: 'Run', distance: 10000 }],
    }))
    const [a] = await p.listActivities('2026-08-01', '2026-08-07')
    expect(a!.dataWithheld).toBeUndefined()
  })
})

describe('okrążenia biegów (D1)', () => {
  // Odpowiedzi wymyślone, w kształcie z docs/integrations/intervalsicu.md §2d.
  const LIST = [
    { id: 'i1001', start_date_local: '2026-08-04T07:00:00', type: 'Run', distance: 6420, moving_time: 1800 },
    { id: 'i1002', start_date_local: '2026-08-05T07:00:00', type: 'Ride', distance: 30000, moving_time: 3600 },
    { id: 'i1003', start_date_local: '2026-08-05T18:00:00', source: 'STRAVA' },
    { id: 'i1004', start_date_local: '2026-08-06T07:00:00', type: 'TrailRun', distance: 8000, moving_time: 3000 },
    // bieg wpisany ręcznie, bez dystansu: odcinków z niego nie będzie
    { id: 'i1005', start_date_local: '2026-08-07T07:00:00', type: 'Run', moving_time: 1800 },
  ]
  const INTERVALS = {
    icu_intervals: [
      { id: 1, type: 'RECOVERY', distance: 2000.4, moving_time: 600, elapsed_time: 600, average_heartrate: 135.6 },
      { id: 2, type: 'WORK', distance: 1000, moving_time: 240, elapsed_time: 240, average_heartrate: 168 },
      // przerwa w miejscu: zero metrów i zero ruchu, ale 90 s zegara
      { id: 3, type: 'RECOVERY', distance: 0, moving_time: 0, elapsed_time: 90 },
      { id: 4, type: 'WORK', distance: 1002.6, moving_time: 239.6, elapsed_time: 240, average_heartrate: 171.4 },
      { id: 5, type: 'WORK', moving_time: 30 }, // bez dystansu — odpada
      { id: 6, distance: 1420, moving_time: 480, elapsed_time: 482 }, // bez typu — bez roli
    ],
    icu_groups: [],
  }
  const route = (status: Record<string, number> = {}) => (url: string) => {
    if (url.includes('/activities?')) return { body: LIST }
    const id = /\/activity\/([^/]+)\/intervals$/.exec(url)?.[1]
    if (id && status[id]) return { status: status[id], body: {} }
    return { body: id ? INTERVALS : {} }
  }

  it('na życzenie: jedno zapytanie na bieg z dystansem, bez roweru i bez aktywności zatrzymanych przez Stravę', async () => {
    const { provider: p, calls } = provider(route())
    const activities = await p.listActivities('2026-08-01', '2026-08-07', { laps: true })
    expect(calls.map((c) => c.url)).toEqual([
      'https://intervals.icu/api/v1/athlete/0/activities?oldest=2026-08-01&newest=2026-08-07',
      'https://intervals.icu/api/v1/activity/i1001/intervals',
      'https://intervals.icu/api/v1/activity/i1004/intervals',
    ])
    expect(activities[0]!.laps).toEqual([
      { distanceKm: 2, movingTimeSec: 600, avgHr: 136, intensity: 'rest' },
      { distanceKm: 1, movingTimeSec: 240, avgHr: 168, intensity: 'work' },
      { distanceKm: 0, movingTimeSec: 90, intensity: 'rest' },
      { distanceKm: 1.003, movingTimeSec: 240, avgHr: 171, intensity: 'work' },
      { distanceKm: 1.42, movingTimeSec: 480 },
    ])
    expect(activities[1]).not.toHaveProperty('laps')
    expect(activities[2]).not.toHaveProperty('laps')
    expect(activities[3]!.laps).toHaveLength(5)
    expect(activities[4]).not.toHaveProperty('laps')
  })

  it('bez flagi laps: samo zapytanie o listę (init --from-intervals nie płaci za okrążenia)', async () => {
    const { provider: p, calls } = provider(route())
    const activities = await p.listActivities('2026-08-01', '2026-08-07')
    expect(calls).toHaveLength(1)
    expect(activities.some((a) => a.laps)).toBe(false)
  })

  it('błąd jednej aktywności: bez okrążeń dla niej, następna dalej pobierana', async () => {
    const { provider: p, calls } = provider(route({ i1001: 500 }))
    const activities = await p.listActivities('2026-08-01', '2026-08-07', { laps: true })
    expect(calls).toHaveLength(3)
    expect(activities[0]).not.toHaveProperty('laps')
    expect(activities[3]!.laps).toHaveLength(5)
  })

  it('limit zapytań (429): koniec dociągania, aktywności zostają', async () => {
    const { provider: p, calls } = provider(route({ i1001: 429 }))
    const activities = await p.listActivities('2026-08-01', '2026-08-07', { laps: true })
    expect(calls).toHaveLength(2)
    expect(activities).toHaveLength(5)
    expect(activities.some((a) => a.laps)).toBe(false)
  })
})

describe('pull wellness', () => {
  it('czyta oba warianty casingu pól (§1.2 — niespójność w dokumentacji)', async () => {
    const { provider: p } = provider(() => ({
      body: [
        { id: '2026-08-04', restingHR: 44, hrv: 92, sleepSecs: 27000, weight: 71.2, ctl: 58, atl: 62 },
        { id: '2026-08-03', resting_hr: 46, sleep_secs: 25200 },
      ],
    }))
    const [a, b] = await p.listWellness('2026-08-03', '2026-08-04')
    expect(a).toMatchObject({ date: '2026-08-04', restingHr: 44, hrv: 92, sleepSec: 27000, weightKg: 71.2, ctl: 58 })
    expect(b).toMatchObject({ date: '2026-08-03', restingHr: 46, sleepSec: 25200 })
  })
})

describe('push treningów', () => {
  const workout = {
    externalId: 'trainctl-2026-08-04',
    date: '2026-08-04',
    name: 'Interwały — Maraton',
    description: '- 3km 5:20/km Pace Warmup\n\n5x\n- 1km 4:15/km Pace\n- 3m 6:30/km Pace',
    sport: 'run' as const,
    distanceKm: 12,
  }

  it('POST events/bulk z upsert i poprawnym payloadem', async () => {
    const { provider: p, calls } = provider(() => ({ body: {} }))
    const res = await p.pushWorkouts([workout])
    expect(res).toEqual({ pushed: 1, externalIds: ['trainctl-2026-08-04'] })
    expect(calls[0]!.url).toContain('/events/bulk?upsert=true')
    expect(calls[0]!.init!.method).toBe('POST')
    const body = JSON.parse(String(calls[0]!.init!.body)) as Record<string, unknown>[]
    expect(body[0]).toMatchObject({
      category: 'WORKOUT',
      type: 'Run',
      start_date_local: '2026-08-04T00:00:00',
      external_id: 'trainctl-2026-08-04',
      distance_target: 12000,
    })
    expect(body[0]!['description']).toContain('4:15/km Pace')
  })

  it('pusta lista nie wywołuje sieci', async () => {
    const { provider: p, calls } = provider(() => ({ body: {} }))
    const res = await p.pushWorkouts([])
    expect(res.pushed).toBe(0)
    expect(calls).toHaveLength(0)
  })

  const race = { externalId: 'trainctl-2026-11-29', date: '2026-11-29', name: 'START — Maraton', description: 'Maraton',
    sport: 'run' as const, distanceKm: 42.195, race: { priority: 'A' as const } }
  const strength = { externalId: 'trainctl-2026-08-07-strength', date: '2026-08-07', name: 'Siła — Maraton', description: 'Siła ciężka',
    sport: 'strength' as const }
  const bodies = (calls: Recorded[]) => calls.map((c) => JSON.parse(String(c.init!.body)) as Record<string, unknown>[])

  it('starty i siła: osobne żądania, kategoria RACE_A i typ WeightTraining, bez celu dystansu', async () => {
    const { provider: p, calls } = provider(() => ({ body: {} }))
    const res = await p.pushWorkouts([workout, race, strength])
    expect(res).toEqual({ pushed: 3, externalIds: ['trainctl-2026-08-04', 'trainctl-2026-11-29', 'trainctl-2026-08-07-strength'] })
    const [runs, races, gym] = bodies(calls)
    expect(runs!.map((e) => e['category'])).toEqual(['WORKOUT'])
    expect(races![0]).toMatchObject({ category: 'RACE_A', type: 'Run', external_id: 'trainctl-2026-11-29' })
    expect(races![0]).not.toHaveProperty('distance_target')
    expect(gym![0]).toMatchObject({ category: 'WORKOUT', type: 'WeightTraining', external_id: 'trainctl-2026-08-07-strength' })
  })

  it('odrzucona kategoria startu: wpis wraca jako zwykły, z ostrzeżeniem; odrzucona siła nie psuje pushu', async () => {
    const { provider: p, calls } = provider((_url, init) => {
      const body = String(init?.body ?? '')
      return body.includes('RACE_A') || body.includes('WeightTraining') ? { status: 422, body: { error: 'nope' } } : { body: {} }
    })
    const res = await p.pushWorkouts([workout, race, strength])
    expect(res.externalIds).toEqual(['trainctl-2026-08-04', 'trainctl-2026-11-29'])
    expect(res.warnings).toHaveLength(2)
    expect(res.warnings!.join(' ')).toMatch(/2026-11-29/)
    expect(res.warnings!.join(' ')).toMatch(/2026-08-07/)
    expect(bodies(calls).map((b) => b[0]!['category'])).toEqual(['WORKOUT', 'RACE_A', 'WORKOUT', 'WORKOUT'])
  })

  it('start odrzucony w obu postaciach: ostrzeżenie mówi, że go nie ma — nie że jest zwykłym wpisem', async () => {
    const { provider: p } = provider((_url, init) => (String(init?.body ?? '').includes('START') ? { status: 422, body: {} } : { body: {} }))
    const res = await p.pushWorkouts([workout, race])
    expect(res.externalIds).toEqual(['trainctl-2026-08-04'])
    expect(res.warnings).toHaveLength(1)
    expect(res.warnings![0]).toMatch(/nie ma ich w kalendarzu|not in the calendar/)
  })

  it('błąd pushu treningów biegowych nadal jest błędem', async () => {
    const { provider: p } = provider(() => ({ status: 500, body: {} }))
    await expect(p.pushWorkouts([workout, race])).rejects.toThrow()
  })

  it('sprzątanie listuje wszystkie nasze wpisy, także starty — bez filtra kategorii', async () => {
    const { provider: p, calls } = provider(() => ({ body: [
      { id: 1, start_date_local: '2026-11-29T00:00:00', external_id: 'trainctl-2026-11-29', category: 'RACE_A' },
      { id: 2, start_date_local: '2026-11-28T00:00:00', external_id: 'moj-wpis', category: 'NOTE' },
    ] }))
    const remote = await p.listPlannedWorkouts('2026-11-23', '2026-11-29')
    expect(calls[0]!.url).not.toContain('category=')
    expect(remote).toEqual([{ id: '1', date: '2026-11-29', externalId: 'trainctl-2026-11-29' }])
  })
})
