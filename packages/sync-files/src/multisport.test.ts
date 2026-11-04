import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { activityFit, FitBuilder, FILE_ID_FIELDS, fileIdValues, fitTime } from './fit-fixture.ts'
import { parseFitActivity } from './fit.ts'
import { scanActivityFiles } from './files.ts'
import { parseTcxActivity } from './tcx.ts'

describe('multisport activity preservation',()=>{
  it('keeps swim, transitions, ride and both runs with stable component IDs',()=>{
    const dir=mkdtempSync(join(tmpdir(),'trainctl-parts-'))
    try {
      const bytes=activityFit({utcOffsetSec:0,sessions:[
        {start:'2026-11-02T09:00:00Z',sport:5,timerSec:600,distanceM:500},
        {start:'2026-11-02T09:10:00Z',sport:3,timerSec:60},
        {start:'2026-11-02T09:11:00Z',sport:2,timerSec:3600,distanceM:20000},
        {start:'2026-11-02T10:11:00Z',sport:1,timerSec:1200,distanceM:3000},
        {start:'2026-11-02T10:31:00Z',sport:1,timerSec:600,distanceM:1500},
      ]})
      writeFileSync(join(dir,'multi.fit'),bytes)
      const a=scanActivityFiles(dir,{preserveParts:true}).activities
      expect(a.map(x=>x.type)).toEqual(['Swim','Transition','Ride','Run','Run'])
      expect(a.map(x=>x.distanceKm)).toEqual([0.5,undefined,20,3,1.5])
      expect(a.map(x=>x.partIndex)).toEqual([0,1,2,3,4])
      expect(new Set(a.map(x=>x.parentActivityId)).size).toBe(1)
      expect(a.every(x=>x.startTime)).toBe(true)
      writeFileSync(join(dir,'duplicate.fit'),bytes)
      expect(scanActivityFiles(dir,{preserveParts:true}).activities.map(({name,...rest})=>rest)).toEqual(a.map(({name,...rest})=>rest))
      expect(scanActivityFiles(dir).activities[0]).toMatchObject({type:'Run',distanceKm:4.5})
    } finally { rmSync(dir,{recursive:true,force:true}) }
  })
  it('retains cycling power, cadence and pool length from the FIT session',()=>{
    const b=new FitBuilder().define(0,0,FILE_ID_FIELDS).data(0,fileIdValues(4,fitTime('2026-11-02T10:00:00Z')))
      .define(1,18,[{num:2,type:'uint32'},{num:5,type:'enum'},{num:8,type:'uint32'},{num:20,type:'uint16'},{num:18,type:'uint8'},{num:44,type:'uint16'}])
      .data(1,[fitTime('2026-11-02T10:00:00Z'),2,3600000,180,85,2500])
    const a=parseFitActivity(b.build(),{preserveParts:true})!
    expect(a).toMatchObject({type:'Ride',avgPowerWatts:180,avgCadence:85,poolLengthM:25})
  })
  it('keeps every TCX component and unknown sports without relabeling them as runs',()=>{
    const xml='<TrainingCenterDatabase><Activities><MultiSportSession>'+['Running','Biking','Other','Running'].map((sport,i)=>`<Activity Sport="${sport}"><Id>2026-11-02T0${i+6}:00:00Z</Id><Lap StartTime="2026-11-02T0${i+6}:00:00Z"><TotalTimeSeconds>600</TotalTimeSeconds><DistanceMeters>1000</DistanceMeters></Lap></Activity>`).join('')+'</MultiSportSession></Activities></TrainingCenterDatabase>'
    const a=parseTcxActivity(xml,{preserveParts:true})!
    expect(a.parts!.map(p=>p.type)).toEqual(['Run','Ride','Other','Run'])
    expect(a.parts!.every(p=>p.movingTimeSec===600&&p.distanceM===1000)).toBe(true)
  })
})
