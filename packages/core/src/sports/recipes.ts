import { messages } from '../i18n/index.ts'
import type { EnduranceSport, SessionContext, SessionPurpose, SportProfile } from './types.ts'

/** Explicit engineering recipes, not individually validated physiological prescriptions. MS-6. */
export interface WorkoutRecipe {
  id: string; title: string; objective: string; rpe: [number, number]
  workSec?: number; recoverySec?: number; maxRepeats?: number
  ftpPercent?: number; cssOffset?: number; lengths?: number
}
export function recipeRationale(r: WorkoutRecipe, p: SportProfile): string {
  const c = messages().coaching, why = c.reason
  const level=p.experience==='trained'?c.level.trained:p.experience==='regular'?c.level.regular:c.level.new
  const reason=r.id.endsWith('-race')?why.race
    :r.id==='bike-aerobic-power'||r.id==='bike-threshold'||r.id==='swim-controlled-speed'?why.hard
    :r.id==='bike-sustained'?why.sustained
    :r.id.includes('technique')?why.technique
    :r.id.includes('openers')?why.openers
    :r.id==='bike-tempo'?why.tempo
    :r.id==='swim-css-repeats'?why.swimCss
    :r.id==='swim-timed-repeats'?why.swimTimed
    :r.id==='run-controlled-repeats'?why.runRepeats
    :why.easy
  return `${c.label.experience}: `+level+'. '+reason
}
export function selectRecipe(sport: EnduranceSport, purpose: SessionPurpose, p: SportProfile, c: SessionContext): WorkoutRecipe {
  const r = messages().coaching.recipe
  const phase = c.phase ?? 'build', week = Math.max(0, c.weekIndex ?? 0)
  const reduced = phase === 'deload' || phase === 'recovery', trained = p.experience === 'trained'
  const distance = c.goal?.sport === sport ? c.goal.distanceM : c.goal?.legs?.filter(l=>l.sport===sport).reduce((n,l)=>n+l.distanceM,0)
  const shortRace = !!distance && distance <= (sport === 'bike' ? 40000 : sport === 'swim' ? 1500 : 10000)
  const progression = reduced || phase === 'taper' ? 0 : Math.min(2, week % 4)
  if (purpose === 'race') return {id:`${sport}-race`,title:r.race.title,objective:r.race.objective,rpe:[4,8]}
  if (c.brick) {
    const brick = sport==='bike' ? r.brickBike : r.brickRun
    return {id:`${sport}-brick`,title:brick.title,objective:brick.objective,ftpPercent:65,cssOffset:12,rpe:[3,4]}
  }
  if (purpose === 'intervals' && sport === 'bike') {
    if (phase === 'taper') return {id:'bike-openers',title:r.bikeOpeners.title,objective:r.bikeOpeners.objective,workSec:60,recoverySec:120,maxRepeats:3,ftpPercent:100,rpe:[6,7]}
    if (phase === 'base' || reduced) return {id:'bike-tempo',title:r.bikeTempo.title,objective:r.bikeTempo.objective,workSec:360,recoverySec:120,maxRepeats:reduced?2:3+progression,ftpPercent:80,rpe:[5,6]}
    if (trained && shortRace && week % 2 === 0) return {id:'bike-aerobic-power',title:r.bikeAerobicPower.title,objective:r.bikeAerobicPower.objective,workSec:180,recoverySec:180,maxRepeats:4+Math.min(1,progression),ftpPercent:110,rpe:[7,8]}
    if (trained && shortRace) return {id:'bike-threshold',title:r.bikeThreshold.title,objective:r.bikeThreshold.objective,workSec:360,recoverySec:180,maxRepeats:3+Math.min(1,progression),ftpPercent:95,rpe:[6,7]}
    return {id:'bike-sustained',title:r.bikeSustained.title,objective:r.bikeSustained.objective,workSec:480,recoverySec:180,maxRepeats:3+Math.min(1,progression),ftpPercent:88,rpe:[5,6]}
  }
  if (purpose === 'intervals' && sport === 'swim') {
    if (phase === 'taper') return {id:'swim-openers',title:r.swimOpeners.title,objective:r.swimOpeners.objective,lengths:2,cssOffset:0,recoverySec:30,maxRepeats:4,rpe:[5,6]}
    if (trained && shortRace && phase === 'build' && week % 2 === 0) return {id:'swim-controlled-speed',title:r.swimControlledSpeed.title,objective:r.swimControlledSpeed.objective,lengths:1,cssOffset:-4,recoverySec:30,maxRepeats:8+progression*2,rpe:[6,7]}
    return {id:'swim-css-repeats',title:r.swimCssRepeats.title,objective:r.swimCssRepeats.objective,lengths:4,cssOffset:phase==='base'||reduced?5:2,recoverySec:20,maxRepeats:reduced?4:(trained?10:6)+progression,rpe:[5,6]}
  }
  if (purpose === 'technique') return {id:`${sport}-technique-${week%2===0?'alignment':'rhythm'}`,title:r.technique.title,objective:sport==='swim'?r.technique.objectiveSwim:r.technique.objective,cssOffset:18,ftpPercent:60,lengths:2,rpe:[2,4]}
  if (purpose === 'intervals') return {id:'run-controlled-repeats',title:r.runRepeats.title,objective:r.runRepeats.objective,workSec:180,recoverySec:120,maxRepeats:4+Math.min(1,progression),rpe:[6,7]}
  const long = purpose === 'long'
  return {id:`${sport}-${long?'endurance':reduced?'recovery':'easy'}`,title:long?r.endurance.title:r.aerobic.title,objective:long?r.endurance.objective:r.aerobic.objective,ftpPercent:reduced?55:65,cssOffset:reduced?20:12,lengths:long?8:4,rpe:reduced?[2,3]:[3,4]}
}
