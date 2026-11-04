import { describe, expect, it } from 'vitest'
import { activityEvidence, activityKey } from './activities.ts'
import { buildSessionExecution, buildSportSession } from './engine.ts'
import type { SyncedActivity } from '../ports/sync.ts'
import type { SportsPlan } from './types.ts'

const activity:SyncedActivity={externalId:'1',importSource:'a',date:'2026-11-02',type:'Ride',startTime:'2026-11-02T12:00:00Z',movingTimeSec:1800,distanceKm:15}
describe('mutually unambiguous activity copies',()=>{
  it.each(['a','z'])('keeps ambiguous copies separate regardless of source ordering (%s)',source=>{
    const first={...activity,importSource:source}, other={...activity,importSource:'m'}, extra={...other,externalId:'2',distanceKm:15.01}
    for (const input of [[first,other,extra],[extra,first,other],[other,extra,first]]) {
      const evidence=activityEvidence(input)
      expect(evidence).toHaveLength(3)
      expect(evidence.every(e=>e.aliases.length===1)).toBe(true)
    }
  })
  it('retains an explicit plan link from a less detailed copy',()=>{
    const rich={...activity,name:'Ride',avgHr:130,avgPowerWatts:150,avgCadence:80}, linked={...activity,importSource:'b',plannedSessionId:'second'}
    const evidence=activityEvidence([rich,linked])
    expect(evidence).toHaveLength(1)
    expect(evidence[0]!.activity).toMatchObject({plannedSessionId:'second',avgPowerWatts:150})
    const profile={weeklyMinutes:90,sessionsPerWeek:2}
    const plan:SportsPlan={schemaVersion:2,id:'p',cycleId:'c',engineVersion:'test',generatedAt:activity.date,goal:{kind:'base',date:'2026-12-20',name:'Base'},sessions:['first','second'].map(id=>buildSportSession('bike',profile,30,id,activity.date)),groups:[],archive:[],replacements:[],changes:[],generatedSessions:{},warnings:[]}
    const rows=buildSessionExecution(plan,[rich,linked],[],activity.date)
    expect(rows[0]!.status).toBe('unknown')
    expect(rows[1]).toMatchObject({status:'done',matching:'session-id',activityIds:expect.arrayContaining([activityKey(rich),activityKey(linked)])})
  })
  it.each(['abc','bca','cab'])('does not assign an unlinked bridge to either conflicting plan ID (%s)',sources=>{
    const records=[{...activity,importSource:sources[0]!,plannedSessionId:'first'},{...activity,importSource:sources[1]!},{...activity,importSource:sources[2]!,plannedSessionId:'second'}]
    for(const order of [[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]]) {
      const evidence=activityEvidence(order.map(i=>records[i]!))
      expect(evidence).toHaveLength(3)
      expect(evidence.every(e=>e.aliases.length===1)).toBe(true)
    }
  })
  it.each(['startTime','movingTimeSec','distanceKm'] as const)('keeps a non-transitive tolerance chain separate (%s)',field=>{
    const values={startTime:['2026-11-02T12:00:00Z','2026-11-02T12:00:02Z','2026-11-02T12:00:04Z'],movingTimeSec:[1800,1805,1810],distanceKm:[15,15.07,15.14]}
    const records=['a','b','c'].map((importSource,i)=>({...activity,importSource,[field]:values[field][i]}))
    const evidence=activityEvidence(records)
    expect(evidence).toHaveLength(3)
    expect(evidence.every(e=>e.aliases.length===1)).toBe(true)
  })
  it('does not merge an apparently unique pair inside a larger ambiguous group',()=>{
    const records=[{...activity,importSource:'a',startTime:'2026-11-02T12:00:00Z'},{...activity,importSource:'b',startTime:'2026-11-02T12:00:02Z'},{...activity,importSource:'c',startTime:'2026-11-02T12:00:04Z'},{...activity,importSource:'c',externalId:'2',startTime:'2026-11-02T12:00:04Z'}]
    const evidence=activityEvidence(records)
    expect(evidence).toHaveLength(4)
    expect(evidence.every(e=>e.aliases.length===1)).toBe(true)
  })
  it('merges three mutually compatible copies and leaves unrelated evidence separate',()=>{
    const records=[{...activity,plannedSessionId:'session'},{...activity,importSource:'b',avgPowerWatts:170,avgHr:130},{...activity,importSource:'c',startTime:'2026-11-02T13:00:01+01:00'},{...activity,importSource:'d',externalId:'unrelated',startTime:'2026-11-02T14:00:00Z'}]
    const evidence=activityEvidence(records)
    expect(evidence).toHaveLength(2)
    const merged=evidence.find(e=>e.aliases.includes('a/1'))!
    expect(merged.aliases).toEqual(['a/1','b/1','c/1'])
    expect(merged.activity).toMatchObject({plannedSessionId:'session',avgPowerWatts:170})
    expect(activityEvidence([...records].reverse())).toEqual(evidence)
  })
})
