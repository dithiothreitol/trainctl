import { createInterface } from 'node:readline/promises'
import { stringify } from 'yaml'
import { ENDURANCE_SPORTS, addDays, getLocale, mondayOf, parseIso, sportMessages as msg, validateSportsConfig, type EnduranceSport, type SportsConfig, type SportsPlan, type Weekday } from 'trainctl-core'
import { loadSportsPlan, sessionText } from './sports-store.ts'
import { protectedSessions, sportsCommand, sportsFailure, sportsResult } from './sports-commands.ts'
import { select, type Choice } from './ui/select.ts'
import { Theme } from './ui/theme.ts'
import { b, renderAnsi } from './ui/blocks.ts'
import { ui } from './i18n/index.ts'
import { ask, parseDaysInput } from './ui/wizard.ts'
import { parseLogStatus } from './interactive.ts'

export interface SportsWizardIO { ask(question: string, defaultValue?: string): Promise<string>; warn(message: string): void }
export async function collectSportsConfig(sports: string, today: string, io: SportsWizardIO): Promise<SportsConfig> {
  const t = msg(), w = t.wizard
  const selected = [...new Set(sports.split(',').map(s=>s.trim()))] as EnduranceSport[]
  if (!selected.length || selected.some(s=>!ENDURANCE_SPORTS.includes(s))) throw new Error(t.invalid)
  async function value<T>(question: string, parse: (s:string)=>T, fallback?: string): Promise<T> {
    for (;;) { try { const answer = await io.ask(question,fallback); return parse(answer.trim() || fallback || '') } catch(e) { io.warn(e instanceof Error ? e.message : String(e)) } }
  }
  const num = (min:number,max:number,integer=false) => (s:string):number => {const n=Number(s.replace(',','.'));if(!s || !Number.isFinite(n)||n<min||n>max||(integer&&!Number.isInteger(n)))throw new Error(t.invalid);return n}
  const one = <T extends string>(choices: readonly T[]) => (s:string):T => { if (!choices.includes(s as T)) throw new Error(t.invalid);return s as T }
  const c: SportsConfig = { schemaVersion:2,language:getLocale(),athlete:{sports:{}},goal:{kind:'base',name:w.base,date:addDays(today,55)},availability:[],maxSessionsPerDay:2 }
  for (const sport of selected) {
    const prefix=t.sport[sport]+' · '
    const weeklyMinutes=await value(prefix+w.weekly,num(10,3000),'90')
    const sessionsPerWeek=await value(prefix+w.frequency,num(1,Math.min(14,Math.floor(weeklyMinutes/5)),true),'2')
    const experience=await value(prefix+w.experience,one(['new','regular','trained'] as const),'new')
    const daysAvailable=await value(prefix+w.days,s=>parseDaysInput(s) as Weekday[],'mon,tue,wed,thu,fri,sat,sun')
    const preparationMinutes=await value(prefix+w.preparation,num(0,180,true),'10')
    const maxSessionMinutes=await value(prefix+w.maximum,num(5,1440),String(Math.max(5,Math.ceil(weeklyMinutes/sessionsPerWeek*1.5))))
    const p: NonNullable<SportsConfig['athlete']['sports']['run']> = {weeklyMinutes,sessionsPerWeek,experience,daysAvailable,preparationMinutes,maxSessionMinutes}
    if (sport==='bike') p.resources=await value(prefix+w.resources,s=>s.split(',').map(one(['bike','trainer','powerMeter'] as const)),'bike')
    if (sport==='swim') { p.resources=['pool'];p.poolLengthM=await value(prefix+w.pool,num(10,100),'25') }
    const calibration=await value(prefix+(sport==='bike'?w.ftp:sport==='swim'?w.css:w.pace),s=>s?num(sport==='bike'?1:sport==='swim'?20:120,sport==='bike'?2000:sport==='swim'?600:1200)(s):undefined)
    if (calibration!==undefined) {
      if(sport==='bike')p.ftpWatts=calibration;else if(sport==='swim')p.cssSecPer100m=calibration;else p.easyPaceSecPerKm=calibration
      const date=await value(prefix+w.calibrationDate,s=>{parseIso(s);if(s>today)throw new Error(t.invalid);return s},today)
      const source=await value(prefix+w.calibrationSource,s=>{if(!s)throw new Error(t.invalid);return s},w.manual)
      p.calibration={date,source}
    }
    p.peakWeeklyMinutes=await value(prefix+w.peak,num(weeklyMinutes,3000),String(weeklyMinutes))
    p.progressionPercent=p.peakWeeklyMinutes>weeklyMinutes ? await value(prefix+w.progression,num(0,10),'0') : 0
    const start=await value(prefix+w.start,s=>{if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(s))throw new Error(t.invalid);return s},'18:00')
    const remaining=1440-Number(start.slice(0,2))*60-Number(start.slice(3))
    const minutes=await value(prefix+w.window,num(1,remaining),String(Math.min(remaining,maxSessionMinutes+preparationMinutes)))
    for(const day of daysAvailable)c.availability!.push({day,start,minutes,sports:[sport]})
    c.athlete.sports[sport]=p
  }
  c.goal.kind=await value(w.goal,one(['base','race','multisport'] as const),'base')
  c.goal.name=await value(w.name,s=>{if(!s)throw new Error(t.invalid);return s},w.base)
  c.goal.date=await value(w.date,s=>{parseIso(s);if(s<today||s>addDays(today,730))throw new Error(t.invalid);return s},addDays(today,55))
  if(c.goal.kind==='race') {
    c.goal.sport=await value(w.raceSport,one(selected),selected[0])
    c.goal.distanceM=await value(w.distance,num(1,2e6))
    c.goal.estimatedMinutes=await value(w.duration,num(1,3000))
  } else if(c.goal.kind==='multisport') {
    const order=await value(w.order,s=>{const parts=s.split(',').map(one(selected));if(parts.length<2||parts.length>10)throw new Error(t.invalid);return parts},[...selected].sort((a,b)=>['swim','bike','run'].indexOf(a)-['swim','bike','run'].indexOf(b)).join(','))
    c.goal.legs=[]
    for(const [i,sport]of order.entries())c.goal.legs.push({id:`leg${i+1}`,sport,distanceM:await value(`${i+1} ${t.sport[sport]} · ${w.distance}`,num(1,2e6)),estimatedMinutes:await value(`${i+1} ${t.sport[sport]} · ${w.duration}`,num(1,3000))})
  }
  c.maxSessionsPerDay=await value(w.daily,num(1,6,true),'2')
  return validateSportsConfig(c)
}
export async function runSportsWizard(sports:string,today:string,theme=new Theme()):Promise<string> {
  const rl=createInterface({input:process.stdin,output:process.stdout})
  try {return stringify(await collectSportsConfig(sports,today,{ask:(question,fallback)=>rl.question(`${question}${fallback ? ` [${fallback}]` : ''}: `),warn:message=>console.log(theme.dim(message))}))} finally {rl.close()}
}
export function sportsSessionChoices(p:Pick<SportsPlan,'sessions'>,from:string,to:string,blocked=new Set<string>()):Choice<string>[] {
  return p.sessions.filter(s=>s.date>=from&&s.date<=to).map(s=>({value:s.id,label:`${s.date} ${s.start??''} · ${msg().sport[s.sport]}`,hint:sessionText(s),...(blocked.has(s.id)?{disabled:true}:{})}))
}
export async function runSportsPicker(cwd:string,action:'log'|'shift'|'export'|'replace',today:string,theme=new Theme()) {
  try {
    const p=loadSportsPlan(cwd), t=msg()
    const choices=sportsSessionChoices(p,action==='log'?addDays(today,-13):today,action==='log'?today:addDays(p.goal.date,7),action==='shift'||action==='replace'?protectedSessions(cwd,p):new Set())
    const session=await select(t.session,choices,theme)
    if(!session)return sportsResult([b.info(ui().common.cancelled)])
    if(action==='export') {
      const what=await select(ui().picker.exportWhat,['fit','html','ics','all'].map(value=>({label:value,value})),theme)
      return what ? sportsCommand(cwd,'export',{session,what}) : sportsResult([b.info(ui().common.cancelled)])
    }
    const rl=createInterface({input:process.stdin,output:process.stdout})
    try {
      if(action==='shift') {const to=await ask(rl,theme,ui().picker.whichDay,s=>{parseIso(s);return s});return sportsCommand(cwd,'shift',{session,to})}
      if(action==='replace') {
        const toSport=await ask(rl,theme,t.targetSport+(p.replacements.some(r=>r.targetId===session)?` | restore (${t.restore})`:''),s=>{if(s!=='restore'&&!ENDURANCE_SPORTS.includes(s as EnduranceSport))throw new Error(t.invalid);return s})
        if(toSport==='restore')return sportsCommand(cwd,'replace',{session,restore:true})
        const minutes=await ask(rl,theme,t.budget,s=>{const n=Number(s);if(!Number.isFinite(n)||n<5)throw new Error(t.invalid);return n},{optional:true})
        return sportsCommand(cwd,'replace',{session,toSport,minutes})
      }
      const status=await ask(rl,theme,ui().log.prompt.status,parseLogStatus,{default:'done'})
      const plannedSport=p.sessions.find(s=>s.id===session)!.sport
      const actualSport=status==='skipped'||plannedSport==='strength'?undefined:await ask(rl,theme,t.actualSport,s=>{if(!ENDURANCE_SPORTS.includes(s as EnduranceSport))throw new Error(t.invalid);return s},{default:plannedSport})
      const numeric=(s:string):string=>{const n=Number(s.replace(',','.'));if(!Number.isFinite(n)||n<0)throw new Error(t.invalid);return String(n)}
      const minutes=status==='skipped'?undefined:await ask(rl,theme,t.minutes,numeric,{optional:true})
      const meters=status==='skipped'?undefined:await ask(rl,theme,t.meters,numeric,{optional:true})
      const sets=status!=='skipped'&&plannedSport==='swim'&&actualSport==='swim'?await ask(rl,theme,t.sets,s=>s,{optional:true}):undefined
      const rpe=status==='skipped'?undefined:await ask(rl,theme,t.rpe,s=>{const n=Number(s);if(!Number.isInteger(n)||n<1||n>10)throw new Error(t.invalid);return String(n)},{optional:true})
      const note=await ask(rl,theme,ui().log.prompt.note,s=>s,{optional:true})
      return sportsCommand(cwd,'log',{session,status,actualSport,minutes,meters,sets,rpe,note})
    } finally {rl.close()}
  } catch(e) {return sportsFailure(e)}
}
export async function runSportsWeekBrowser(cwd:string,date:string,theme=new Theme()) {
  let week=mondayOf(date)
  for (;;) {
    const result=sportsCommand(cwd,'week',{date:week});console.log(renderAnsi(result.blocks,theme))
    if(result.code)return result
    const direction=await select(msg().plan,[{label:'← '+addDays(week,-7),value:-1},{label:'→ '+addDays(week,7),value:1}],theme)
    if(direction===undefined)return sportsResult([])
    week=addDays(week,direction*7)
  }
}
