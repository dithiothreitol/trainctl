import { diffDays } from '../util/dates.ts'
import { paceZones, vdotFromRace } from '../zones/daniels.ts'
import { messages } from '../i18n/index.ts'
import { sportMessages as msg } from './messages.ts'
import { contextRationale, effortGuide } from './coaching.ts'
import { recipeRationale, selectRecipe, type WorkoutRecipe } from './recipes.ts'
import type { EnduranceSport, SessionContext, SessionPurpose, SessionStep, SportProfile, StepTarget, TrainingSession } from './types.ts'
const finite = (v: number, lo: number, hi: number): boolean => Number.isFinite(v) && v >= lo && v <= hi
export const stepSeconds = (s: SessionStep): number => (s.repeat ?? 1) * (s.sendoffSec ?? s.durationSec + (s.restSec ?? 0))
export const sessionTotals = (steps: SessionStep[]): { durationSec: number; distanceM?: number } => {
  const distanceM = steps.reduce((n,s) => n + (s.distanceM ?? 0)*(s.repeat ?? 1),0)
  return {durationSec:steps.reduce((n,s)=>n+stepSeconds(s),0),...(distanceM?{distanceM}:{})}
}
/** MS-6: bounded, phase-specific recipes; no cross-sport equivalence. */
export function buildSportSession(sport: EnduranceSport, original: SportProfile, minutes: number, id: string, date: string, requested: SessionPurpose = 'easy', asOf = date, context: SessionContext = {}): TrainingSession {
  if (!finite(minutes,5,1440)) throw new Error(msg().noFit)
  const c = messages().coaching
  const profile = {...original}, adjustments: string[] = []
  let purpose = requested
  const result = profile.results?.filter(r=>!r.excluded && r.terrain!=='trail' && r.date<=asOf && diffDays(r.date,asOf)<=540).sort((a,b)=>b.date.localeCompare(a.date))[0]
  const zones = sport==='run' && result ? paceZones(vdotFromRace(result.distanceKm,result.timeSec)) : undefined
  if (zones && !profile.easyPaceSecPerKm) {
    profile.easyPaceSecPerKm=Math.round((zones.easy.loSecPerKm+zones.easy.hiSecPerKm)/2)
    profile.calibration={date:result!.date,source:'VDOT '+result!.distanceKm+'km/'+result!.timeSec+'s'}
  }
  if (sport!=='run' && (!profile.calibration || diffDays(profile.calibration.date,asOf)<0 || diffDays(profile.calibration.date,asOf)>180)) {
    delete profile.ftpWatts; delete profile.cssSecPer100m; delete profile.calibration
  }
  if (sport==='bike' && profile.resources && !profile.resources.includes('powerMeter')) delete profile.ftpWatts
  const seconds=Math.floor(Math.min(minutes,profile.maxSessionMinutes??minutes)*60)
  if (seconds<300) throw new Error(msg().noFit)
  if (purpose==='intervals' && (profile.experience==='new' || context.phase==='recovery')) {
    purpose='easy'; adjustments.push(c.adjust.replacedQuality)
  }
  let recipe=selectRecipe(sport,purpose,profile,context)
  if (sport==='swim' && purpose==='intervals' && !profile.cssSecPer100m) recipe={...recipe,id:'swim-timed-repeats',title:c.recipe.swimTimedRepeats.title,workSec:60,recoverySec:30,maxRepeats:6}
  const easyTarget=(recovery=false):StepTarget=>sport==='bike'&&profile.ftpWatts
    ? {kind:'power',watts:Math.round(profile.ftpWatts*(recovery?.5:.6)),ftpPercent:recovery?50:60}
    : sport==='swim'&&profile.cssSecPer100m?{kind:'pace',seconds:profile.cssSecPer100m+(recovery?30:20),perM:100}
    : sport==='run'&&profile.easyPaceSecPerKm?{kind:'pace',seconds:profile.easyPaceSecPerKm+(recovery?30:0),perM:1000}:{kind:'open'}
  const targetFor=(r:WorkoutRecipe):StepTarget=>sport==='run'&&purpose==='intervals'&&!zones?{kind:'open'}:sport==='bike'&&profile.ftpWatts?{kind:'power',watts:Math.round(profile.ftpWatts*(r.ftpPercent??65)/100),ftpPercent:r.ftpPercent??65}
    :sport==='swim'&&profile.cssSecPer100m?{kind:'pace',seconds:Math.max(20,profile.cssSecPer100m+(r.cssOffset??12)),perM:100}
    :sport==='run'&&(zones||profile.easyPaceSecPerKm)?{kind:'pace',seconds:purpose==='intervals'&&zones?zones.lt2SecPerKm:profile.easyPaceSecPerKm!,perM:1000}:{kind:'open'}
  const step=(role:SessionStep['role'],durationSec:number,target:StepTarget,rpe:[number,number],instruction?:string):SessionStep=>({role,durationSec,target,effort:effortGuide(...rpe,sport==='swim'),...(instruction?{instruction}:{}),...(sport==='swim'?{stroke:'freestyle' as const}:{})})
  const recovery=()=>({target:sport==='swim'?{kind:'open' as const}:easyTarget(true),effort:effortGuide(1,2,sport==='swim'),instruction:sport==='swim'?c.step.recoverySwim:c.step.recovery})
  const warmInstruction=c.step.warmup
  const coolInstruction=c.step.cooldown
  const drillInstruction=(context.weekIndex??0)%2===0 ? c.step.drillBreathing : c.step.drillRecovery
  let steps:SessionStep[], minimumWorkSec:number|undefined
  if(purpose==='race') steps=[step('work',seconds,{kind:'open'},[4,8])]
  else if(sport==='swim'&&profile.cssSecPer100m&&seconds>=3*Math.ceil((profile.cssSecPer100m+20)*(profile.poolLengthM??25)/100)) {
    const pool=profile.poolLengthM??25, easyPace=profile.cssSecPer100m+20
    const poolStep=(role:SessionStep['role'],lengths:number,pace:number,rpe:[number,number],instruction?:string):SessionStep=>({...step(role,Math.ceil(lengths*pool*pace/100),{kind:'pace',seconds:pace,perM:100},rpe,instruction),distanceM:lengths*pool})
    const warm=poolStep('warmup',Math.max(1,Math.floor(seconds*.18/(pool*easyPace/100))),easyPace,[2,3],warmInstruction)
    const cool=poolStep('cooldown',Math.max(1,Math.floor(seconds*.1/(pool*easyPace/100))),easyPace,[1,2],coolInstruction)
    let left=seconds-warm.durationSec-cool.durationSec
    steps=[warm]
    if(purpose==='technique') {
      const drill=poolStep('drill',1,profile.cssSecPer100m+35,[2,3],drillInstruction)
      drill.target={kind:'open'};drill.stroke='drill';drill.name=c.step.drillName;drill.restSec=20;drill.recovery=recovery()
      drill.repeat=Math.min(12,Math.floor(left*.5/stepSeconds(drill)))
      if(drill.repeat>0) {steps.push(drill);left-=stepSeconds(drill)}
    }
    let pace=profile.cssSecPer100m+(recipe.cssOffset??12), lengths=recipe.lengths??4
    let unit=poolStep('work',lengths,pace,recipe.rpe,purpose==='technique'?c.step.transfer:c.step.swimRepeats)
    unit.restSec=recipe.recoverySec??20;unit.recovery=recovery()
    if(purpose==='intervals'&&Math.floor(left/stepSeconds(unit))<2) {
      purpose='easy';recipe=selectRecipe(sport,purpose,profile,context)
      adjustments.push(c.adjust.swimNoSet)
    }
    if(purpose!=='intervals') {
      pace=profile.cssSecPer100m+(recipe.cssOffset??12)
      lengths=Math.max(1,Math.min(recipe.lengths??4,Math.floor((left-20)/(pool*pace/100))))
      unit={...unit,...poolStep('work',lengths,pace,recipe.rpe,unit.instruction)}
    }
    unit.repeat=Math.min(recipe.maxRepeats??40,Math.floor(left/stepSeconds({...unit,repeat:1})))
    if(unit.repeat>0) {steps.push(unit);left-=stepSeconds(unit);if(purpose==='intervals')minimumWorkSec=2*unit.durationSec}
    const spare=Math.floor(left/(pool*easyPace/100))
    if(spare>0) steps.push(poolStep('work',spare,easyPace,[2,3],c.step.swimSpare))
    if(steps.length===1) steps.push(step('work',left,{kind:'open'},[2,3],c.step.swimFinish))
    steps.push(cool)
  } else {
    if(sport==='swim') adjustments.push(c.adjust.swimTimed)
    const quality=purpose==='intervals', warm=Math.min(quality?600:300,Math.max(60,Math.floor(seconds*(quality?.25:.15))))
    const cool=Math.min(300,Math.max(60,Math.floor(seconds*.1)))
    let left=seconds-warm-cool
    steps=[step('warmup',warm,easyTarget(),[2,3],warmInstruction)]
    if(quality) {
      const work=recipe.workSec??60, rest=recipe.recoverySec??30, repeats=Math.min(recipe.maxRepeats??6,Math.floor(left/(work+rest)))
      if(repeats>=2) {
        steps.push({...step('work',work,targetFor(recipe),recipe.rpe,c.step.lastRep),repeat:repeats,restSec:rest,recovery:recovery()})
        left-=repeats*(work+rest);minimumWorkSec=2*work
      } else {
        purpose='easy';recipe=selectRecipe(sport,purpose,profile,context)
        adjustments.push(c.adjust.noSet)
      }
    }
    if(purpose==='technique') {
      const unit=sport==='swim'?60:120, rest=sport==='swim'?20:30, repeats=Math.min(8,Math.floor(left*.5/(unit+rest)))
      if(repeats) {steps.push({...step('drill',unit,{kind:'open'},[2,3],sport==='swim'?drillInstruction:c.step.drill),repeat:repeats,restSec:rest,recovery:recovery(),...(sport==='swim'?{stroke:'drill' as const}:{})});left-=repeats*(unit+rest)}
    }
    if(left>0) steps.push(step('work',left,purpose==='intervals'?easyTarget():targetFor(recipe),purpose==='intervals'?[2,3]:recipe.rpe,context.brick?c.step.brick:c.step.even))
    steps.push(step('cooldown',cool,easyTarget(true),[1,2],coolInstruction))
  }
  if(purpose==='technique'&&!steps.some(x=>x.role==='drill')) {
    purpose='easy';recipe=selectRecipe(sport,purpose,profile,context)
    adjustments.push(c.adjust.noDrill)
  }
  if(!steps.some(x=>x.target.kind!=='open')) adjustments.push(c.adjust.rpeOnly)
  adjustments.push(c.adjust.slowDown)
  return {id,date,sport,purpose,steps,...sessionTotals(steps),preparationSec:(profile.preparationMinutes??10)*60,
    coaching:{version:1,recipeId:recipe.id,title:recipe.title,objective:recipe.objective,rationale:contextRationale(context,sport)+' '+recipeRationale(recipe,profile),successCriteria:[
      purpose==='race'?c.success.race
      :purpose==='technique'?c.success.technique
      :purpose==='intervals'?c.success.intervals
      :c.success.easy,
      c.success.log],adjustments,...(minimumWorkSec?{minimumWorkSec}:{})},
    ...(sport==='swim'?{poolLengthM:profile.poolLengthM??25}:{}),...(profile.calibration?{calibration:profile.calibration}:{}),...(context.phase?{phase:context.phase}:{}),ruleRefs:['MS-1','MS-6']}
}
