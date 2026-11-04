import type { EnduranceSport } from './types.ts'
import type { SyncedActivity } from '../ports/sync.ts'

export const sportOf = (type: string): EnduranceSport | 'strength' | undefined => {
  const t = type.toLowerCase().replace(/[ _-]/g, '')
  if (['run', 'running', 'trailrun', 'trailrunning', 'virtualrun', 'treadmill', 'treadmillrunning'].includes(t)) return 'run'
  if (['bike', 'ride', 'cycling', 'virtualride', 'mountainbikeride', 'gravelride', 'ebikeride'].includes(t)) return 'bike'
  if (['swim', 'swimming', 'openwaterswim', 'poolswim'].includes(t)) return 'swim'
  if (['strength', 'weighttraining'].includes(t)) return 'strength'
  return undefined
}

/** Source namespaces prevent a file ID from overwriting a hub ID. */
export const activityKey = (a: SyncedActivity): string => a.importSource ? `${encodeURIComponent(a.importSource)}/${encodeURIComponent(a.externalId)}` : a.externalId
export interface ActivityEvidence { activity: SyncedActivity; aliases: string[] }
const timestamp = (s: string | undefined): number => s && /(?:Z|[+-]\d{2}:?\d{2})$/i.test(s) ? Date.parse(s) : NaN
function duplicate(a: SyncedActivity, b: SyncedActivity): boolean {
  if (!a.importSource || !b.importSource || a.importSource === b.importSource || a.dataWithheld || b.dataWithheld || (!sportOf(a.type) || sportOf(a.type) !== sportOf(b.type))) return false
  if (a.plannedSessionId && b.plannedSessionId && a.plannedSessionId !== b.plannedSessionId) return false
  if (Math.abs(timestamp(a.startTime) - timestamp(b.startTime)) > 2000 || !Number.isFinite(timestamp(a.startTime)) || !Number.isFinite(timestamp(b.startTime))) return false
  if ((a.movingTimeSec ?? 0) < 60 || (b.movingTimeSec ?? 0) < 60 || Math.abs(a.movingTimeSec! - b.movingTimeSec!) > 5) return false
  return a.distanceKm !== undefined && b.distanceKm !== undefined && Math.abs(a.distanceKm - b.distanceKm) <= Math.max(0.025, Math.min(a.distanceKm, b.distanceKm) * 0.005)
}
/** Merge only isolated groups in which every pair is compatible; ambiguous groups stay separate. */
export function activityEvidence(activities: SyncedActivity[]): ActivityEvidence[] {
  const groups: SyncedActivity[][] = []
  const unique = [...new Map(activities.map(a => [activityKey(a), a])).values()].sort((a,b) => activityKey(a).localeCompare(activityKey(b)))
  const candidates = new Map(unique.map(a => [a, new Set<SyncedActivity>()]))
  for (let i=0;i<unique.length;i++) for(let j=i+1;j<unique.length;j++) {
    const a=unique[i]!, b=unique[j]!
    if (!duplicate(a,b)) continue
    candidates.get(a)!.add(b); candidates.get(b)!.add(a)
  }
  const visited = new Set<SyncedActivity>()
  for (const a of unique) {
    if (visited.has(a)) continue
    const pending = [a], component: SyncedActivity[] = []
    visited.add(a)
    while (pending.length) {
      const current = pending.pop()!
      component.push(current)
      for (const candidate of candidates.get(current)!) if (!visited.has(candidate)) { visited.add(candidate); pending.push(candidate) }
    }
    component.sort((a,b) => activityKey(a).localeCompare(activityKey(b)))
    // Pairwise tolerances are not transitive. A bridge must not be assigned
    // arbitrarily to one side, even when each source contributes just one record.
    // duplicate() excludes same-source pairs, so a complete component also
    // guarantees at most one record per source and no conflicting plan links.
    if (component.every(record => candidates.get(record)!.size === component.length - 1)) groups.push(component)
    else groups.push(...component.map(record => [record]))
  }
  return groups.map(g => {
    const ranked = [...g].sort((a,b) => Object.values(b).filter(v=>v!==undefined).length-Object.values(a).filter(v=>v!==undefined).length || activityKey(a).localeCompare(activityKey(b)))
    const plannedSessionId=g.find(a=>a.plannedSessionId)?.plannedSessionId
    return { activity: {...ranked[0]!,...(plannedSessionId ? {plannedSessionId} : {})}, aliases: g.map(activityKey) }
  })
}
export function resolveActivity(activities: SyncedActivity[], id: string): SyncedActivity | undefined {
  const exact = activities.filter(a => activityKey(a) === id)
  if (exact.length === 1) return exact[0]
  const legacy = activities.filter(a => a.externalId === id)
  return legacy.length === 1 ? legacy[0] : undefined
}
