/**
 * Testy adaptera na nagranych odpowiedziach — bez sieci i bez klucza.
 * Kształt odpowiedzi wzorowany na przykładach z docs/integrations/intervalsicu.md §2.
 */
import { describe, expect, it } from 'vitest'
import { setLocale } from '@tren/core'

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
    externalId: 'tren-2026-08-04',
    date: '2026-08-04',
    name: 'Interwały — Maraton',
    description: '- 3km 5:20/km Pace Warmup\n\n5x\n- 1km 4:15/km Pace\n- 3m 6:30/km Pace',
    sport: 'run' as const,
    distanceKm: 12,
  }

  it('POST events/bulk z upsert i poprawnym payloadem', async () => {
    const { provider: p, calls } = provider(() => ({ body: {} }))
    const res = await p.pushWorkouts([workout])
    expect(res).toEqual({ pushed: 1, externalIds: ['tren-2026-08-04'] })
    expect(calls[0]!.url).toContain('/events/bulk?upsert=true')
    expect(calls[0]!.init!.method).toBe('POST')
    const body = JSON.parse(String(calls[0]!.init!.body)) as Record<string, unknown>[]
    expect(body[0]).toMatchObject({
      category: 'WORKOUT',
      type: 'Run',
      start_date_local: '2026-08-04T00:00:00',
      external_id: 'tren-2026-08-04',
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
})
