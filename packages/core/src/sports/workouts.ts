import { diffDays } from '../util/dates.ts'
import { paceZones, vdotFromRace } from '../zones/daniels.ts'
import { sportMessages as msg } from './messages.ts'
import { coachText as t, contextRationale, effortGuide } from './coaching.ts'
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
    purpose='easy'; adjustments.push(t('Akcent zastąpiony spokojną jednostką ze względu na doświadczenie lub regenerację.','Quality work replaced by an easy session because of experience or recovery.'))
  }
  let recipe=selectRecipe(sport,purpose,profile,context)
  if (sport==='swim' && purpose==='intervals' && !profile.cssSecPer100m) recipe={...recipe,id:'swim-timed-repeats',title:t('Odcinki czasowe według odczucia','Timed repetitions by feel'),workSec:60,recoverySec:30,maxRepeats:6}
  const easyTarget=(recovery=false):StepTarget=>sport==='bike'&&profile.ftpWatts
    ? {kind:'power',watts:Math.round(profile.ftpWatts*(recovery?.5:.6)),ftpPercent:recovery?50:60}
    : sport==='swim'&&profile.cssSecPer100m?{kind:'pace',seconds:profile.cssSecPer100m+(recovery?30:20),perM:100}
    : sport==='run'&&profile.easyPaceSecPerKm?{kind:'pace',seconds:profile.easyPaceSecPerKm+(recovery?30:0),perM:1000}:{kind:'open'}
  const targetFor=(r:WorkoutRecipe):StepTarget=>sport==='run'&&purpose==='intervals'&&!zones?{kind:'open'}:sport==='bike'&&profile.ftpWatts?{kind:'power',watts:Math.round(profile.ftpWatts*(r.ftpPercent??65)/100),ftpPercent:r.ftpPercent??65}
    :sport==='swim'&&profile.cssSecPer100m?{kind:'pace',seconds:Math.max(20,profile.cssSecPer100m+(r.cssOffset??12)),perM:100}
    :sport==='run'&&(zones||profile.easyPaceSecPerKm)?{kind:'pace',seconds:purpose==='intervals'&&zones?zones.lt2SecPerKm:profile.easyPaceSecPerKm!,perM:1000}:{kind:'open'}
  const step=(role:SessionStep['role'],durationSec:number,target:StepTarget,rpe:[number,number],instruction?:string):SessionStep=>({role,durationSec,target,effort:effortGuide(...rpe,sport==='swim'),...(instruction?{instruction}:{}),...(sport==='swim'?{stroke:'freestyle' as const}:{})})
  const recovery=()=>({target:sport==='swim'?{kind:'open' as const}:easyTarget(true),effort:effortGuide(1,2,sport==='swim'),instruction:t(sport==='swim'?'Odpocznij przy ścianie po każdym odcinku, również ostatnim.':'Bardzo lekki ruch po każdym odcinku, również ostatnim.',sport==='swim'?'Rest at the wall after every repetition, including the last.':'Move very easily after every repetition, including the last.')})
  const warmInstruction=t('Zacznij bardzo spokojnie; stopniowo ustabilizuj rytm i oddech.','Start very gently; gradually settle rhythm and breathing.')
  const coolInstruction=t('Stopniowo zmniejsz wysiłek i rozluźnij ruch.','Gradually reduce effort and relax your movement.')
  const drillInstruction=(context.weekIndex??0)%2===0
    ?t('Spokojny kraul: patrz w dół, wydychaj powietrze do wody, odwróć głowę do naturalnego wdechu. Nie wydłużaj przerw w oddychaniu.','Easy freestyle: look down, exhale into the water and turn for a natural breath. Do not lengthen breath holds.')
    :t('Luźny powrót ramienia w kraulu: lekko prowadź opuszki nad powierzchnią wody. Nie wymuszaj ruchu w barku; potem płyń zwykłym kraulem.','Relaxed freestyle recovery: skim the fingertips above the surface. Do not force the shoulder; then return to normal freestyle.')
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
      drill.target={kind:'open'};drill.stroke='drill';drill.name=t('Ćwiczenie techniczne','Technique drill');drill.restSec=20;drill.recovery=recovery()
      drill.repeat=Math.min(12,Math.floor(left*.5/stepSeconds(drill)))
      if(drill.repeat>0) {steps.push(drill);left-=stepSeconds(drill)}
    }
    let pace=profile.cssSecPer100m+(recipe.cssOffset??12), lengths=recipe.lengths??4
    let unit=poolStep('work',lengths,pace,recipe.rpe,purpose==='technique'?t('Przenieś ćwiczoną umiejętność do spokojnego kraula.','Transfer the practised skill to easy freestyle.'):t('Utrzymuj równy rytm i jakość ruchu od pierwszego do ostatniego odcinka.','Keep rhythm and stroke quality consistent from the first repetition to the last.'))
    unit.restSec=recipe.recoverySec??20;unit.recovery=recovery()
    if(purpose==='intervals'&&Math.floor(left/stepSeconds(unit))<2) {
      purpose='easy';recipe=selectRecipe(sport,purpose,profile,context)
      adjustments.push(t('Za mało czasu na pełną serię jakościową; wybrano spokojne pływanie.','Too little time for a complete quality set; easy swimming selected.'))
    }
    if(purpose!=='intervals') {
      pace=profile.cssSecPer100m+(recipe.cssOffset??12)
      lengths=Math.max(1,Math.min(recipe.lengths??4,Math.floor((left-20)/(pool*pace/100))))
      unit={...unit,...poolStep('work',lengths,pace,recipe.rpe,unit.instruction)}
    }
    unit.repeat=Math.min(recipe.maxRepeats??40,Math.floor(left/stepSeconds({...unit,repeat:1})))
    if(unit.repeat>0) {steps.push(unit);left-=stepSeconds(unit);if(purpose==='intervals')minimumWorkSec=2*unit.durationSec}
    const spare=Math.floor(left/(pool*easyPace/100))
    if(spare>0) steps.push(poolStep('work',spare,easyPace,[2,3],t('Dopłyń spokojnie; utrzymaj swobodną sylwetkę.','Swim easily; maintain relaxed alignment.')))
    if(steps.length===1) steps.push(step('work',left,{kind:'open'},[2,3],t('Płyń spokojnie; zakończ przy ścianie.','Swim easily and finish at the wall.')))
    steps.push(cool)
  } else {
    if(sport==='swim') adjustments.push(t('Bez wiarygodnego CSS lub miejsca na pełne długości: odcinki czasowe według RPE, bez zgadywania dystansu. Kończ przy ścianie.','Without usable CSS or room for complete lengths: timed repetitions by RPE, without guessing distance. Finish at the wall.'))
    const quality=purpose==='intervals', warm=Math.min(quality?600:300,Math.max(60,Math.floor(seconds*(quality?.25:.15))))
    const cool=Math.min(300,Math.max(60,Math.floor(seconds*.1)))
    let left=seconds-warm-cool
    steps=[step('warmup',warm,easyTarget(),[2,3],warmInstruction)]
    if(quality) {
      const work=recipe.workSec??60, rest=recipe.recoverySec??30, repeats=Math.min(recipe.maxRepeats??6,Math.floor(left/(work+rest)))
      if(repeats>=2) {
        steps.push({...step('work',work,targetFor(recipe),recipe.rpe,t('Ostatni odcinek wykonaj równie równo jak pierwszy; nie przyspieszaj ponad cel.','Make the last repetition as controlled as the first; do not exceed the target.')),repeat:repeats,restSec:rest,recovery:recovery()})
        left-=repeats*(work+rest);minimumWorkSec=2*work
      } else {
        purpose='easy';recipe=selectRecipe(sport,purpose,profile,context)
        adjustments.push(t('Za mało czasu na pełną serię wraz z rozgrzewką i przerwami; wybrano spokojny trening.','Too little time for a complete set with warm-up and recoveries; easy training selected.'))
      }
    }
    if(purpose==='technique') {
      const unit=sport==='swim'?60:120, rest=sport==='swim'?20:30, repeats=Math.min(8,Math.floor(left*.5/(unit+rest)))
      if(repeats) {steps.push({...step('drill',unit,{kind:'open'},[2,3],sport==='swim'?drillInstruction:t('Równy, swobodny rytm; rozluźnij barki i nie zwiększaj siły ruchu.','Keep a smooth rhythm; relax the shoulders without adding force.')),repeat:repeats,restSec:rest,recovery:recovery(),...(sport==='swim'?{stroke:'drill' as const}:{})});left-=repeats*(unit+rest)}
    }
    if(left>0) steps.push(step('work',left,purpose==='intervals'?easyTarget():targetFor(recipe),purpose==='intervals'?[2,3]:recipe.rpe,context.brick?t('Kontroluj oddech i rytm podczas zmiany dyscypliny; bez przyspieszania na zmęczeniu.','Control breathing and rhythm through the sport transition; do not accelerate into fatigue.'):t('Utrzymuj równy wysiłek i swobodną technikę.','Keep an even effort and relaxed technique.')))
    steps.push(step('cooldown',cool,easyTarget(true),[1,2],coolInstruction))
  }
  if(purpose==='technique'&&!steps.some(x=>x.role==='drill')) {
    purpose='easy';recipe=selectRecipe(sport,purpose,profile,context)
    adjustments.push(t('Budżet nie mieści ćwiczenia technicznego i części głównej po ćwiczeniu; wykonaj spokojną jednostkę.','The budget does not fit a drill and follow-up main set; complete an easy session.'))
  }
  if(!steps.some(x=>x.target.kind!=='open')) adjustments.push(t('Intensywność określa RPE 1–10; brak aktualnego pomiaru nie jest zastępowany wynikiem z innej dyscypliny.','Intensity is guided by RPE 1–10; a missing current measurement is not replaced by another sport’s result.'))
  adjustments.push(t('Jeśli wysiłek lub technika wykraczają poza wskazówki, zwolnij albo skróć serię. Nie nadrabiaj pominiętych odcinków.','If effort or form falls outside the guidance, slow down or shorten the set. Do not make up missed repetitions.'))
  return {id,date,sport,purpose,steps,...sessionTotals(steps),preparationSec:(profile.preparationMinutes??10)*60,
    coaching:{version:1,recipeId:recipe.id,title:recipe.title,objective:recipe.objective,rationale:contextRationale(context,sport)+' '+recipeRationale(recipe,profile),successCriteria:[
      purpose==='race'?t('Zrealizuj osobny plan startowy; zapisz wynik i obserwacje z przebiegu zawodów.','Execute the separate race plan; record your result and observations from the event.')
      :purpose==='technique'?t('Przenieś wskazówkę z ćwiczenia do części głównej: zachowaj spokojny oddech i swobodny ruch.','Transfer the drill cue to the main set: keep relaxed breathing and smooth movement.')
      :purpose==='intervals'?t('Utrzymaj zadany wysiłek i pełne przerwy; porównaj tempo lub moc pierwszego i ostatniego odcinka.','Keep the prescribed effort and full recoveries; compare pace or power in the first and last repetitions.')
      :t('Utrzymaj swobodny oddech i stabilną technikę; zakończ z zapasem sił.','Keep comfortable breathing and stable form; finish with reserves.'),
      t('Zapisz czas, odczuwany wysiłek RPE i ewentualne zmniejszenie liczby powtórzeń.','Log duration, perceived effort (RPE) and any reduction in repetitions.')],adjustments,...(minimumWorkSec?{minimumWorkSec}:{})},
    ...(sport==='swim'?{poolLengthM:profile.poolLengthM??25}:{}),...(profile.calibration?{calibration:profile.calibration}:{}),...(context.phase?{phase:context.phase}:{}),ruleRefs:['MS-1','MS-6']}
}
