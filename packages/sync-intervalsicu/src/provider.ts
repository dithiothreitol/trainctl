/**
 * Adapter SyncProvider dla intervals.icu (hub → Garmin/Coros/Wahoo; ADR-002).
 * Mapowanie pól jest defensywne: dokumentacja pokazuje niespójny casing
 * (`restingHR` vs `resting_hr`) — czytamy oba warianty.
 */
import type {
  PushResult,
  PushableWorkout,
  SyncProvider,
  SyncedActivity,
  SyncedWellness,
} from '@tren/core'
import { IntervalsIcuClient, type ClientOptions } from './client.ts'

interface RawActivity {
  id?: string
  start_date_local?: string
  type?: string
  name?: string
  distance?: number
  moving_time?: number
  elapsed_time?: number
  total_elevation_gain?: number
  average_heartrate?: number
  average_speed?: number
  icu_rpe?: number
}

interface RawWellness {
  id?: string
  restingHR?: number
  resting_hr?: number
  hrv?: number
  sleepSecs?: number
  sleep_secs?: number
  weight?: number
  ctl?: number
  atl?: number
}

const num = (...vals: (number | undefined)[]): number | undefined =>
  vals.find((v) => typeof v === 'number' && Number.isFinite(v))

export class IntervalsIcuProvider implements SyncProvider {
  readonly name = 'intervals.icu'
  private readonly client: IntervalsIcuClient

  constructor(opts: ClientOptions | IntervalsIcuClient) {
    this.client = opts instanceof IntervalsIcuClient ? opts : new IntervalsIcuClient(opts)
  }

  async verify(): Promise<{ athleteId: string; name?: string }> {
    const a = await this.client.request<{ id?: string; name?: string }>(
      this.client.athletePath(''),
    )
    return {
      athleteId: a?.id ?? this.client.athleteId,
      ...(a?.name ? { name: a.name } : {}),
    }
  }

  async listActivities(oldest: string, newest: string): Promise<SyncedActivity[]> {
    const raw = await this.client.request<RawActivity[]>(
      this.client.athletePath(`/activities?oldest=${oldest}&newest=${newest}`),
    )
    return (raw ?? []).map((a) => {
      const distanceKm = typeof a.distance === 'number' ? a.distance / 1000 : undefined
      const movingTimeSec = a.moving_time
      const activity: SyncedActivity = {
        externalId: a.id ?? '',
        date: (a.start_date_local ?? '').slice(0, 10),
        type: a.type ?? 'Unknown',
      }
      if (a.name) activity.name = a.name
      if (distanceKm !== undefined) activity.distanceKm = Math.round(distanceKm * 100) / 100
      if (movingTimeSec !== undefined) activity.movingTimeSec = movingTimeSec
      if (a.elapsed_time !== undefined) activity.elapsedTimeSec = a.elapsed_time
      if (a.total_elevation_gain !== undefined) activity.elevationGainM = a.total_elevation_gain
      if (a.average_heartrate !== undefined) activity.avgHr = Math.round(a.average_heartrate)
      if (distanceKm && movingTimeSec) {
        activity.avgPaceSecPerKm = Math.round(movingTimeSec / distanceKm)
      }
      if (a.icu_rpe !== undefined) activity.rpe = a.icu_rpe
      return activity
    })
  }

  async listWellness(oldest: string, newest: string): Promise<SyncedWellness[]> {
    const raw = await this.client.request<RawWellness[]>(
      this.client.athletePath(`/wellness?oldest=${oldest}&newest=${newest}`),
    )
    return (raw ?? []).map((w) => {
      const entry: SyncedWellness = { date: w.id ?? '' }
      const restingHr = num(w.restingHR, w.resting_hr)
      const sleepSec = num(w.sleepSecs, w.sleep_secs)
      if (restingHr !== undefined) entry.restingHr = restingHr
      if (w.hrv !== undefined) entry.hrv = w.hrv
      if (sleepSec !== undefined) entry.sleepSec = sleepSec
      if (w.weight !== undefined) entry.weightKg = w.weight
      if (w.ctl !== undefined) entry.ctl = w.ctl
      if (w.atl !== undefined) entry.atl = w.atl
      return entry
    })
  }

  /** Upsert po `external_id` — ponowny push tego samego dnia nadpisuje, nie duplikuje. */
  async pushWorkouts(workouts: PushableWorkout[]): Promise<PushResult> {
    if (workouts.length === 0) return { pushed: 0, externalIds: [] }
    const payload = workouts.map((w) => ({
      category: 'WORKOUT',
      start_date_local: `${w.date}T00:00:00`,
      type: 'Run',
      name: w.name,
      description: w.description,
      external_id: w.externalId,
      ...(w.distanceKm ? { distance_target: Math.round(w.distanceKm * 1000) } : {}),
    }))
    await this.client.request(this.client.athletePath('/events/bulk?upsert=true'), {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    return { pushed: workouts.length, externalIds: workouts.map((w) => w.externalId) }
  }
}
