import { describe, expect, it } from 'vitest'
import { setLocale, sportMessages, validateSportsConfig, type TrainingSession } from 'trainctl-core'
import { collectSportsConfig, sportsSessionChoices } from './sports-interactive.ts'

describe('sports terminal workflows',()=>{
  it.each(['en','pl'] as const)('collects independent profiles and repeated race legs in %s',async lang=>{
    setLocale(lang)
    const w=sportMessages().wizard
    const questions:string[]=[], warnings:string[]=[]
    const config=await collectSportsConfig('run,bike,swim','2026-11-02',{
      ask:async(question,fallback)=>{
        questions.push(question)
        if(question===w.goal)return 'multisport'
        if(question===w.order)return 'run,bike,run'
        if(question.endsWith(w.distance))return '5000'
        if(question.endsWith(w.duration))return '30'
        if(question.endsWith(w.ftp))return '220'
        if(question.endsWith(w.css))return '120'
        return fallback??''
      },warn:message=>warnings.push(message),
    })
    expect(warnings).toEqual([])
    expect(validateSportsConfig(config)).toBe(config)
    expect(config.goal.legs!.map(l=>l.sport)).toEqual(['run','bike','run'])
    expect(config.athlete.sports.run!.ftpWatts).toBeUndefined()
    expect(config.athlete.sports.swim!.cssSecPer100m).toBe(120)
    expect(config.athlete.sports.bike!.calibration).toMatchObject({date:'2026-11-02'})
    expect(questions.length).toBeGreaterThan(30)
    setLocale('en')
  })
  it('selects session IDs, retaining two sports on the same day and protection flags',()=>{
    const sessions:TrainingSession[]=[{id:'r',date:'2026-11-02',sport:'run',purpose:'easy',durationSec:1800,preparationSec:0,steps:[],ruleRefs:[]},{id:'b',date:'2026-11-02',sport:'bike',purpose:'easy',durationSec:2400,preparationSec:0,steps:[],ruleRefs:[]}]
    const choices=sportsSessionChoices({sessions},'2026-11-02','2026-11-08',new Set(['r']))
    expect(choices.map(c=>c.value)).toEqual(['r','b'])
    expect(choices[0]!.disabled).toBe(true)
    expect(choices[1]!.disabled).toBeUndefined()
  })
})
