import { addDays, diffDays, mondayOf, parseIso } from '../util/dates.ts'
import { sportMessages as msg } from './messages.ts'
import { ENDURANCE_SPORTS, type EnduranceSport, type SessionExecution, type SessionGroup, type SessionLog, type SessionPurpose, type SessionStep, type SportProfile, type SportsConfig, type SportsPlan, type TrainingSession } from './types.ts'
export { sportOf } from './activities.ts'
import { activityEvidence, activityKey, resolveActivity, sportOf } from './activities.ts'
import type { SyncedActivity } from '../ports/sync.ts'
import type { Weekday } from '../domain/types.ts'
import { buildSportSession, sessionTotals, stepSeconds } from './workouts.ts'
export { buildSportSession, sessionTotals, stepSeconds } from './workouts.ts'
import { sportModule, trainingIntent, replacementAssessment, type ReplacementContext } from './modules.ts'
import { shortenWorkout } from '../engine/shorten.ts'
import { estimateWorkoutMinutes } from '../engine/duration.ts'
import { planDeskDay } from '../engine/desk.ts'
import { attachRunningCoaching } from './coaching.ts'
import { runningSteps } from './running-steps.ts'
export { sportsTotals, intensityMinutes } from './metrics.ts'

const DAYS: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const finite = (v: unknown, lo: number, hi: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi
const bad = (path: string): never => { throw new Error(`${msg().invalid} ${path}`) }
const safeId = (id: unknown): id is string => typeof id === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,180}$/.test(id)
export function validateSportsConfig(raw: unknown): SportsConfig {
  const c = raw as SportsConfig
  if (!c || c.schemaVersion !== 2 || !c.athlete?.sports || !c.goal) bad('schemaVersion/athlete.sports/goal')
  const sports = Object.keys(c.athlete.sports)
  if (!sports.length || sports.some(s => !ENDURANCE_SPORTS.includes(s as EnduranceSport))) bad('athlete.sports')
  for (const sport of sports as EnduranceSport[]) {
    const p = c.athlete.sports[sport]!
    if (!p || !finite(p.weeklyMinutes, 10, 3000) || !Number.isInteger(p.sessionsPerWeek) || !finite(p.sessionsPerWeek, 1, 14) || p.weeklyMinutes < p.sessionsPerWeek * 5) bad(`athlete.sports.${sport}`)
    for (const [key, lo, hi] of [['maxSessionMinutes', 5, 1440], ['preparationMinutes', 0, 180], ['easyPaceSecPerKm', 120, 1200], ['ftpWatts', 1, 2000], ['cssSecPer100m', 20, 600], ['poolLengthM', 10, 100], ['peakWeeklyMinutes', 10, 3000], ['progressionPercent', 0, 10], ['qualitySessions', 0, 2], ['taperDays', 0, 21], ['recoveryDays', 0, 28]] as const) {
      if (p[key] !== undefined && !finite(p[key], lo, hi)) bad(`${sport}.${key}`)
    }
    if (p.experience && !['new','regular','trained'].includes(p.experience)) bad(`${sport}.experience`)
    if (p.resources && (!Array.isArray(p.resources) || p.resources.some(r => !['bike','trainer','powerMeter','pool'].includes(r)))) bad(`${sport}.resources`)
    if (p.peakWeeklyMinutes !== undefined && p.peakWeeklyMinutes < p.weeklyMinutes) bad(`${sport}.peakWeeklyMinutes`)
    if (p.qualitySessions !== undefined && !Number.isInteger(p.qualitySessions)) bad(`${sport}.qualitySessions`)
    if (p.daysAvailable && (!Array.isArray(p.daysAvailable) || !p.daysAvailable.length || p.daysAvailable.some(d => !DAYS.includes(d)))) bad(`${sport}.daysAvailable`)
    if (p.running && (sport !== 'run' || !finite(p.running.recentWeeklyKm,1,400) || (p.running.peakWeeklyKm !== undefined && !finite(p.running.peakWeeklyKm,p.running.recentWeeklyKm,500)) || (p.running.longRunDay && !DAYS.includes(p.running.longRunDay)))) bad('run.running')
    // E3: pola profilu silnika biegowego; szczegóły (zakresy HRmax, daty powrotu) sprawdza profil planu biegowego
    if (p.running?.sex !== undefined && !['male', 'female', 'unspecified'].includes(p.running.sex)) bad('run.running.sex')
    if (p.running?.strength !== undefined && (typeof p.running.strength?.enabled !== 'boolean' || (p.running.strength.days !== undefined && (!Array.isArray(p.running.strength.days) || p.running.strength.days.some(d => !DAYS.includes(d)))))) bad('run.running.strength')
    if (p.calibration) { parseIso(p.calibration.date); if (!p.calibration.source?.trim()) bad(`${sport}.calibration.source`) }
    for (const result of p.results ?? []) { parseIso(result.date); if (sport !== 'run' || !finite(result.distanceKm, 0.1, 300) || !finite(result.timeSec, 1, 604800)) bad(`${sport}.results`) }
  }
  const g = c.goal
  if (!['base', 'race', 'multisport'].includes(g.kind) || typeof g.name !== 'string' || !g.name.trim()) bad('goal')
  parseIso(g.date)
  if (g.transitionsSec !== undefined && (g.kind !== 'multisport' || !Array.isArray(g.transitionsSec) || g.transitionsSec.length !== (g.legs?.length ?? 0)-1 || g.transitionsSec.some(n=>!finite(n,0,7200)))) bad('goal.transitionsSec')
  // E3: bieg z silnikiem biegowym (profil `running`) nie potrzebuje szacunku czasu startu — podaje go predykcja
  const predicted = g.sport === 'run' && c.athlete.sports.run?.running !== undefined
  if (g.kind === 'race' && (!g.sport || !c.athlete.sports[g.sport] || !finite(g.distanceM, 1, 2_000_000) || (!(predicted && g.estimatedMinutes === undefined) && !finite(g.estimatedMinutes, 1, 3000)))) bad('goal.sport/distanceM/estimatedMinutes')
  if (g.targetTimeSec !== undefined && (g.kind !== 'race' || g.sport !== 'run' || !finite(g.targetTimeSec, 60, 172800))) bad('goal.targetTimeSec')
  if (g.kind === 'multisport') {
    if (!Array.isArray(g.legs) || g.legs.length < 2 || g.legs.length > 10) bad('goal.legs')
    const ids = new Set<string>()
    for (const l of g.legs!) {
      if (!safeId(l.id) || ids.has(l.id) || !c.athlete.sports[l.sport] || !finite(l.distanceM, 1, 2_000_000) || !finite(l.estimatedMinutes, 1, 3000)) bad('goal.legs')
      ids.add(l.id)
    }
  }
  const eventDates = new Set<string>()
  for (const goal of c.tuneUpGoals ?? []) {
    if (!['B','C'].includes(goal.priority) || goal.kind === 'base' || goal.date > c.goal.date || (c.goal.kind !== 'base' && goal.date === c.goal.date) || eventDates.has(goal.date)) bad('tuneUpGoals')
    eventDates.add(goal.date)
    const nested = { ...c, goal }; delete nested.tuneUpGoals; validateSportsConfig(nested)
  }
  if (c.time) for (const [k, v] of Object.entries(c.time)) if (!['weeklyMinutes', 'weekdayMinutes', 'weekendMinutes'].includes(k) || !finite(v, 0, 10080)) bad(`time.${k}`)
  if (c.maxSessionsPerDay !== undefined && (!Number.isInteger(c.maxSessionsPerDay) || !finite(c.maxSessionsPerDay, 1, 6))) bad('maxSessionsPerDay')
  if (c.priorities && (new Set(c.priorities).size !== c.priorities.length || c.priorities.some(s => !c.athlete.sports[s]))) bad('priorities')
  for (const w of c.availability ?? []) {
    if (!DAYS.includes(w.day) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(w.start) || !finite(w.minutes, 1, 1440) || !Array.isArray(w.sports) || !w.sports.length || w.sports.some(s => !c.athlete.sports[s]) || clockMinutes(w.start) + w.minutes > 1440) bad('availability')
  }
  if (c.availabilityExceptions !== undefined) {
    if (!c.availabilityExceptions || typeof c.availabilityExceptions !== 'object' || Array.isArray(c.availabilityExceptions)) bad('availabilityExceptions')
    for (const [date,windows] of Object.entries(c.availabilityExceptions)) {
      parseIso(date)
      if (!Array.isArray(windows)) bad('availabilityExceptions')
      for (const w of windows) if (!w || !/^([01]\d|2[0-3]):[0-5]\d$/.test(w.start) || !finite(w.minutes,1,1440) || !Array.isArray(w.sports) || !w.sports.length || w.sports.some(s=>!c.athlete.sports[s]) || clockMinutes(w.start)+w.minutes>1440) bad('availabilityExceptions')
    }
  }
  if (c.brick && (!c.athlete.sports.bike || !c.athlete.sports.run || !DAYS.includes(c.brick.day) || !finite(c.brick.bikeMinutes, 5, 1440) || !finite(c.brick.runMinutes, 5, 1440) || !finite(c.brick.transitionMinutes, 0, 120))) bad('brick')
  if (c.desk && (!/^([01]\d|2[0-3]):[0-5]\d$/.test(c.desk.workStart) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(c.desk.workEnd) || c.desk.workEnd <= c.desk.workStart || (c.desk.lunchMinutes !== undefined && !finite(c.desk.lunchMinutes, 0, 180)) || (c.desk.prefer && !['morning','lunch','evening'].includes(c.desk.prefer)))) bad('desk')
  return c
}
export const weekdayOf = (date: string): Weekday => DAYS[diffDays(mondayOf(date), date)]!
const clockMinutes = (v: string): number => Number(v.slice(0, 2)) * 60 + Number(v.slice(3))
const clockText = (v: number): string => `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`
export const occupiedMinutes = (s: TrainingSession): number => (s.durationSec + s.preparationSec) / 60
export const sportsWindows = (config: SportsConfig, date: string) => config.availabilityExceptions?.[date] ?? (config.availability?.length ? config.availability.filter(w=>w.day===weekdayOf(date)) : undefined)
const transitionAfter = (s: TrainingSession, groups: SessionGroup[]): number => {
  const g = groups.find(g => g.id === s.groupId)
  return g && g.sessionIds.at(-1) !== s.id ? (g.transitionsSec?.[g.sessionIds.indexOf(s.id)] ?? g.transitionSec / Math.max(1, g.sessionIds.length - 1)) / 60 : 0
}
export function calendarMinutes(sessions: TrainingSession[], groups: SessionGroup[]): number {
  const ids = new Set(sessions.map(s => s.id))
  return sessions.reduce((n, s) => n + occupiedMinutes(s), 0) + groups.filter(g => g.sessionIds.some(id => ids.has(id))).reduce((n, g) => n + g.transitionSec / 60, 0)
}

/** Desk windows use each session/group's occupied time, without a running-distance proxy. */
export function sessionDeskDay(plan: SportsPlan, config: SportsConfig, date: string) {
  if (!config.desk) throw new Error(`${msg().invalid} desk`)
  const base = planDeskDay(config.desk)
  const sessions = plan.sessions.filter(s => s.date === date)
  const groups = [...new Set(sessions.map(s => s.groupId ?? s.id))].map(id => {
    const members = sessions.filter(s => (s.groupId ?? s.id) === id), minutes = calendarMinutes(members, plan.groups)
    const available = sportsWindows(config,date)
    const windows = base.windows.map(w => ({ ...w, fits: clockMinutes(w.to) - clockMinutes(w.from) >= minutes && (available === undefined || members.every(s => available.some(a => a.sports.includes(s.sport as EnduranceSport) && Math.min(clockMinutes(a.start) + a.minutes, clockMinutes(w.to)) - Math.max(clockMinutes(a.start), clockMinutes(w.from)) >= minutes))) }))
    return { id, sessionIds: members.map(s => s.id), minutes, windows }
  })
  return { groups, breaks: base.breaks, ruleRefs: base.ruleRefs }
}

export function calendarIssues(plan: SportsPlan, config: SportsConfig, from?: string): string[] {
  const issues: string[] = []
  for (const date of [...new Set(plan.sessions.map(s => s.date))]) {
    if (from && date < from) continue
    const sessions = plan.sessions.filter(s => s.date === date)
    if (sessions.some(s => s.purpose === 'race')) {
      // Race duration is exempt from ordinary training budgets, not from blocked dates.
      if (plan.blockedDates?.includes(date) || sessions.some(s => s.purpose !== 'race')) issues.push(`${msg().conflict} ${date}`)
      continue
    }
    if (config.goal.kind !== 'base' && date > config.goal.date) for (const s of sessions) {
      const recovery = s.sport === 'strength' ? 0 : config.athlete.sports[s.sport]?.recoveryDays ?? (s.legacyWorkout ? 0 : s.sport === 'run' ? 2 : 1)
      if (diffDays(config.goal.date, date) <= recovery) issues.push(`${msg().conflict} ${s.id} recovery`)
    }
    if ((config.tuneUpGoals ?? []).some(g=>g.priority==='B' && date===addDays(g.date,1))) issues.push(`${msg().conflict} ${date} recovery`)
    const day = weekdayOf(date)
    const cap = Math.min(plan.timeBudgets?.[date] ?? Infinity, (day === 'sat' || day === 'sun' ? config.time?.weekendMinutes : config.time?.weekdayMinutes) ?? Infinity)
    if (calendarMinutes(sessions, plan.groups) > cap + 0.001 || sessions.length > (config.maxSessionsPerDay ?? 2) || plan.blockedDates?.includes(date)) issues.push(`${msg().conflict} ${date}`)
    for (const s of sessions) {
      if (s.sport === 'strength') continue
      const p = config.athlete.sports[s.sport]
      if (p?.maxSessionMinutes !== undefined && s.durationSec > p.maxSessionMinutes*60+0.001) issues.push(`${msg().noFit} ${s.id}`)
      if (p?.resources && (s.sport === 'swim' ? !p.resources.includes('pool') : s.sport === 'bike' ? !p.resources.some(r=>r==='bike'||r==='trainer') : false)) issues.push(`${msg().noFit} ${s.id}`)
      if (s.sport==='bike' && p?.resources && !p.resources.includes('powerMeter') && s.steps.some(step=>step.target.kind==='power')) issues.push(`${msg().noFit} ${s.id} powerMeter`)
      if (!p || (config.availabilityExceptions?.[date] === undefined && p.daysAvailable && !p.daysAvailable.includes(day))) issues.push(`${msg().noProfile} ${s.sport} ${date}`)
      const available = sportsWindows(config,date)
      if (available !== undefined && (!s.start || !available.some(w => w.sports.includes(s.sport as EnduranceSport) && clockMinutes(s.start!) >= clockMinutes(w.start) && clockMinutes(s.start!) + occupiedMinutes(s) <= clockMinutes(w.start) + w.minutes + 0.001))) issues.push(`${msg().noFit} ${s.id}`)
    }
    for (const s of sessions.filter(s=>s.purpose==='intervals' && s.ruleRefs.includes('MS-4'))) if(plan.sessions.some(x=>x.id!==s.id&&['intervals','race'].includes(x.purpose)&&Math.abs(diffDays(x.date,s.date))<=1)) issues.push(`${msg().hardNeighbour} ${s.id}`)
    const timed = sessions.filter(s => s.start).sort((a, b) => a.start!.localeCompare(b.start!))
    for (let i = 1; i < timed.length; i++) if (clockMinutes(timed[i]!.start!) < clockMinutes(timed[i - 1]!.start!) + occupiedMinutes(timed[i - 1]!) + transitionAfter(timed[i - 1]!, plan.groups)) issues.push(`${msg().conflict} ${timed[i]!.id}`)
  }
  for (const week of [...new Set(plan.sessions.map(s => mondayOf(s.date)))]) {
    if (from && week < mondayOf(from)) continue
    const sessions = plan.sessions.filter(s => mondayOf(s.date) === week)
    if (calendarMinutes(sessions.filter(s=>s.purpose!=='race'), plan.groups) > (config.time?.weeklyMinutes ?? Infinity) + 0.001) issues.push(`${msg().conflict} ${week} ${msg().budget}`)
  }
  for (const g of plan.groups) {
    const ss = g.sessionIds.map(id => plan.sessions.find(s => s.id === id))
    if (ss.some(s => !s) || new Set(ss.map(s => s?.date)).size !== 1) issues.push(`${msg().conflict} ${g.id}`)
  }
  return [...new Set(issues)]
}

/** Walidacja ręcznie edytowanego pliku; nigdy nie ufa sumom zapisanym w YAML. */
export function validateSportsPlan(raw: unknown): string[] {
  const p = raw as SportsPlan
  if (!p || p.schemaVersion !== 2 || !Array.isArray(p.sessions) || !Array.isArray(p.groups) || !Array.isArray(p.archive) || !Array.isArray(p.replacements) || !p.goal || !safeId(p.id) || !safeId(p.cycleId) || !p.generatedSessions || !Array.isArray(p.changes) || !Array.isArray(p.warnings)) return [`${msg().invalid} plan`]
  const issues: string[] = [], ids = new Set<string>()
  for (const s of [...p.sessions, ...p.archive]) {
    try {
      if (!s || !safeId(s.id) || ids.has(s.id) || ![...ENDURANCE_SPORTS, 'strength'].includes(s.sport) || !['easy','long','intervals','technique','race','strength'].includes(s.purpose) || !Array.isArray(s.ruleRefs) || !Array.isArray(s.steps) || !s.steps.length || !finite(s.durationSec, 1, 604800) || !finite(s.preparationSec, 0, 86400)) throw new Error('session')
      if (s.start !== undefined && !/^([01]\d|2[0-3]):[0-5]\d$/.test(s.start)) throw new Error('start')
      if (s.poolLengthM !== undefined && !finite(s.poolLengthM, 10, 100)) throw new Error('pool')
      parseIso(s.date); ids.add(s.id)
      for (const step of s.steps) {
        if (!finite(step.durationSec, 0.001, 604800) || (step.distanceM !== undefined && !finite(step.distanceM, 0.001, 2e6)) || (step.repeat !== undefined && (!Number.isInteger(step.repeat) || !finite(step.repeat, 1, 1000))) || (step.restSec !== undefined && !finite(step.restSec, 0, 86400)) || (step.sendoffSec !== undefined && (!finite(step.sendoffSec, step.durationSec, 86400) || step.restSec !== undefined))) throw new Error('step')
        if (!['warmup','work','rest','cooldown','drill'].includes(step.role)) throw new Error('role')
        if (!step.target || !['open', 'pace', 'power'].includes(step.target.kind)) throw new Error('target')
        if (step.target.kind === 'pace' && (!finite(step.target.seconds, 1, 3600) || ![100, 1000].includes(step.target.perM) || (step.target.slowSeconds !== undefined && !finite(step.target.slowSeconds, step.target.seconds, 3600)))) throw new Error('pace')
        if (step.target.kind === 'power' && (s.sport !== 'bike' || !finite(step.target.watts, 1, 3000))) throw new Error('power')
        for (const text of [step.name,step.instruction]) if (text !== undefined && (typeof text !== 'string' || !text.trim() || text.length>2000)) throw new Error('instruction')
        for (const effort of [step.effort,step.recovery?.effort]) if (effort && (!finite(effort.min,1,10) || !finite(effort.max,effort.min,10) || typeof effort.cue!=='string' || !effort.cue.trim() || effort.cue.length>1000)) throw new Error('effort')
        if (step.recovery) {
          const r=step.recovery, target=r.target
          if (!step.restSec || typeof r.instruction!=='string' || !r.instruction.trim() || r.instruction.length>2000 || !target || !['open','pace','power'].includes(target.kind)) throw new Error('recovery')
          if (target.kind==='power' && (s.sport!=='bike' || !finite(target.watts,1,3000))) throw new Error('recovery power')
          if (target.kind==='pace' && (!finite(target.seconds,1,3600) || ![100,1000].includes(target.perM))) throw new Error('recovery pace')
          if (r.distanceM !== undefined && !finite(r.distanceM, 0.001, 2e6)) throw new Error('recovery distance')
        }
        if (s.sport === 'swim' && s.purpose !== 'race' && step.distanceM !== undefined && s.poolLengthM && Math.abs(step.distanceM / s.poolLengthM - Math.round(step.distanceM / s.poolLengthM)) > 1e-6) throw new Error('pool')
      }
      const total = sessionTotals(s.steps)
      if (s.coaching) {
        const c=s.coaching
        if (c.version!==1 || !safeId(c.recipeId) || [c.title,c.objective,c.rationale].some(x=>typeof x!=='string'||!x.trim()||x.length>4000) || [c.successCriteria,c.adjustments].some(a=>!Array.isArray(a)||a.length>30||a.some(x=>typeof x!=='string'||!x.trim()||x.length>4000)) || !c.successCriteria.length || (c.minimumWorkSec!==undefined && !finite(c.minimumWorkSec,1,s.durationSec))) throw new Error('coaching')
      }
      if (Math.abs(total.durationSec - s.durationSec) > 1 || (!s.legacyWorkout && Math.abs((total.distanceM ?? 0) - (s.distanceM ?? 0)) > 0.1)) throw new Error('totals')
    } catch { issues.push(`${msg().invalid} ${s?.id ?? 'session'}`) }
  }
  for (const g of p.groups) if (!safeId(g.id) || !['brick','race'].includes(g.kind) || !Array.isArray(g.sessionIds) || !g.sessionIds.length || new Set(g.sessionIds).size !== g.sessionIds.length || !finite(g.transitionSec, 0, 86400) || g.sessionIds.some(id => !p.sessions.some(s => s.id === id && s.groupId === g.id))) issues.push(`${msg().invalid} group`)
  for (const g of p.groups) if (g.transitionsSec !== undefined && (!Array.isArray(g.transitionsSec) || g.transitionsSec.length !== g.sessionIds.length-1 || g.transitionsSec.some(n=>!finite(n,0,7200)) || Math.abs(g.transitionsSec.reduce((n,v)=>n+v,0)-g.transitionSec)>0.001)) issues.push(`${msg().invalid} transitions`)
  if (new Set(p.groups.map(g => g.id)).size !== p.groups.length || p.sessions.some(s => s.groupId && !p.groups.some(g => g.id === s.groupId && g.sessionIds.includes(s.id)))) issues.push(`${msg().invalid} group`)
  for (const r of p.replacements) if (!p.archive.some(s => s.id === r.sourceId) || ![...p.sessions, ...p.archive].some(s => s.id === r.targetId && s.replacesSessionId === r.sourceId)) issues.push(`${msg().invalid} replacement`)
  for (const r of p.replacements) if (r.operation === 'restore' && (!p.archive.some(s=>s.id===r.restoresSessionId) || ![...p.sessions,...p.archive].some(s=>s.id===r.targetId && s.restoresSessionId===r.restoresSessionId))) issues.push(`${msg().invalid} restore`)
  if (p.retiredSessionIds !== undefined && (!Array.isArray(p.retiredSessionIds) || new Set(p.retiredSessionIds).size !== p.retiredSessionIds.length || p.retiredSessionIds.some(id => !p.archive.some(s => s.id === id) || p.replacements.some(r => r.sourceId === id || r.targetId === id)))) issues.push(`${msg().invalid} retiredSessionIds`)
  return [...new Set(issues)]
}

function sessionChoices(s: TrainingSession, dates: string[], plan: SportsPlan, c: SportsConfig): TrainingSession[] {
  const choices: { s: TrainingSession; score: number }[] = []
  for (const date of dates) {
    if (plan.sessions.some(x => x.date === date && x.purpose === 'race')) continue
    const day = weekdayOf(date)
    const windows = sportsWindows(c,date)?.filter(w=>w.sports.includes(s.sport as EnduranceSport)) ?? [{ start: '06:00', minutes: 1080 }]
    for (const w of windows) {
      let start = clockMinutes(w.start)
      const existing = plan.sessions.filter(x => x.date === date && x.start).sort((a, b) => a.start!.localeCompare(b.start!))
      for (const x of existing) if (start < clockMinutes(x.start!) + occupiedMinutes(x) + transitionAfter(x, plan.groups) && start + occupiedMinutes(s) > clockMinutes(x.start!)) start = Math.ceil(clockMinutes(x.start!) + occupiedMinutes(x) + transitionAfter(x, plan.groups))
      if (start + occupiedMinutes(s) > clockMinutes(w.start) + w.minutes) continue
      const candidate = { ...s, date, start: clockText(start) }
      const next = { ...plan, sessions: [...plan.sessions, candidate] }
      if (calendarIssues(next, c, dates[0]).length) continue
      // MS-1: równomierne rozłożenie i preferencja dnia; bez obietnicy optymalności.
      const sameSport = plan.sessions.filter(x => x.sport === s.sport && Math.abs(diffDays(x.date, date)) <= 1).length
      choices.push({ s: candidate, score: plan.sessions.filter(x => x.date === date).length * 100 + sameSport * 50 + (date === s.date ? 0 : 10) })
    }
  }
  choices.sort((a, b) => a.score - b.score || a.s.date.localeCompare(b.s.date) || a.s.start!.localeCompare(b.s.start!))
  return choices.map(c => c.s)
}
const placeSession = (s: TrainingSession, dates: string[], plan: SportsPlan, c: SportsConfig): TrainingSession | undefined => sessionChoices(s, dates, plan, c)[0]


/** Bounded deterministic search; failure is limited to these enumerated calendar slots. */
export function scheduleSessions(base: SportsPlan, requests: TrainingSession[], groups: SessionGroup[], dates: string[], c: SportsConfig, limit = 5000, strategy: 'long' | 'quality' = 'long'): { plan?: SportsPlan; visited: number; exhausted: boolean } {
  let visited = 0, exhausted = false
  const units = [...groups.map(g => ({ id: g.id, members: g.sessionIds.map(id => requests.find(s => s.id === id)!), group: g })), ...requests.filter(s => !s.groupId).map(s => ({ id: s.id, members: [s], group: undefined }))]
  type Unit = typeof units[number]
  function choices(unit: Unit, current: SportsPlan): TrainingSession[][] {
    if (!unit.group) return sessionChoices(unit.members[0]!, dates, current, c).map(s => [s])
    const result: TrainingSession[][] = [], first = unit.members[0]!
    for (const date of dates) {
      const windows = sportsWindows(c,date)?.filter(w=>w.sports.includes(first.sport as EnduranceSport)) ?? [{ start: '06:00', minutes: 1080 }]
      for (const window of windows) {
        const starts = new Set([clockMinutes(window.start), ...current.sessions.filter(s => s.date === date && s.start).map(s => Math.ceil(clockMinutes(s.start!) + occupiedMinutes(s) + transitionAfter(s, current.groups)))])
        for (const start of starts) {
          let minute = start
          const placed = unit.members.map((s,i) => { const result = { ...s, date, start: clockText(Math.ceil(minute)) }; minute += occupiedMinutes(s) + (i < unit.members.length - 1 ? (unit.group!.transitionsSec?.[i] ?? unit.group!.transitionSec / (unit.members.length - 1)) / 60 : 0); return result })
          if (minute <= 1440 && !calendarIssues({ ...current, sessions: [...current.sessions, ...placed], groups: [...current.groups, unit.group] }, c, dates[0]).length) result.push(placed)
        }
      }
    }
    return result.sort((a,b) => Number(a[0]!.date !== first.date) - Number(b[0]!.date !== first.date) || a[0]!.date.localeCompare(b[0]!.date) || a[0]!.start!.localeCompare(b[0]!.start!))
  }
  function search(current: SportsPlan, pending: Unit[]): SportsPlan | undefined {
    if (!pending.length) return current
    if (++visited > limit) { exhausted = true; return undefined }
    // Shared weekly capacity is monotonic: reject before branching.
    const week = dates[0] ? mondayOf(dates[0]) : ''
    const existing = current.sessions.filter(s => mondayOf(s.date) === week)
    const demand = pending.reduce((n,u) => n+calendarMinutes(u.members,u.group ? [u.group] : []),0)
    if (calendarMinutes(existing.filter(s=>s.purpose!=='race'),current.groups) + demand > (c.time?.weeklyMinutes ?? Infinity) + 0.001) return undefined
    const ranked = pending.map(unit => ({ unit, choices: choices(unit, current) })).sort((a,b) => a.choices.length-b.choices.length || Number(b.unit.members.some(s=>s.purpose === (strategy === 'long' ? 'long' : 'intervals')))-Number(a.unit.members.some(s=>s.purpose === (strategy === 'long' ? 'long' : 'intervals'))) || a.unit.id.localeCompare(b.unit.id))
    const pick = ranked[0]!
    for (const placement of pick.choices) {
      const next = { ...current, sessions: [...current.sessions, ...placement], groups: pick.unit.group ? [...current.groups, pick.unit.group] : current.groups }
      const solved = search(next, pending.filter(u => u.id !== pick.unit.id))
      if (solved) return solved
      if (exhausted) break
    }
    return undefined
  }
  const plan = search(base, units)
  return { ...(plan ? {plan} : {}), visited, exhausted }
}

export function generateSportsPlan(c: SportsConfig, from: string, id: string, cycleId: string, engineVersion: string, asOf = from): SportsPlan {
  validateSportsConfig(c); parseIso(from)
  if (diffDays(from, c.goal.date) < 0 || diffDays(from, c.goal.date) > 730) bad('goal.date (0..730 days)')
  const p: SportsPlan = { schemaVersion: 2, id, cycleId, generatedAt: from, engineVersion, goal: structuredClone(c.goal), sessions: [], groups: [], archive: [], replacements: [], changes: [], generatedSessions: {}, warnings: [msg().engineering] }
  const sports = [...new Set([...(c.priorities ?? []), ...ENDURANCE_SPORTS.filter(s => c.athlete.sports[s])])]
  const events = [...(c.goal.kind !== 'base' ? [{ ...c.goal, priority: 'A' as const }] : []), ...(c.tuneUpGoals ?? [])].filter(g=>g.date>=from)
  for (const event of events) {
    // bieg bez szacunku czasu (E3): 6:00/km jako miejsce na sesję startu (E-3, inż.); silnik biegowy
    // zastępuje ją startem z predykcją, a start B i C zostaje z tym szacunkiem
    const legs = event.kind === 'race' ? [{ id: 'race', sport: event.sport!, distanceM: event.distanceM!, estimatedMinutes: event.estimatedMinutes ?? Math.round(event.distanceM! / 1000 * 6) }] : event.legs!
    const groupId = event.priority === 'A' ? `${cycleId}-race` : `${cycleId}-race-${event.date}`
    const members: string[] = []
    for (const leg of legs) {
      const id = event.priority === 'A' ? `${cycleId}-${leg.id}` : `${cycleId}-tune-${event.date}-${leg.id}`
      const s = buildSportSession(leg.sport, c.athlete.sports[leg.sport]!, Math.max(5, Math.min(1440, leg.estimatedMinutes!)), id, event.date, 'race', asOf, {phase:'race',goal:event})
      s.steps = [{ role: 'work', durationSec: leg.estimatedMinutes! * 60, distanceM: leg.distanceM, target: { kind: 'open' } }]
      Object.assign(s, sessionTotals(s.steps)); s.pinned = true; s.groupId = groupId; s.racePriority = event.priority; s.phase = 'race'; s.intent = trainingIntent(s); p.sessions.push(s); members.push(s.id)
    }
    p.groups.push({ id: groupId, kind: 'race', sessionIds: members, transitionSec: event.transitionsSec?.reduce((n,v)=>n+v,0) ?? 0, ...(event.transitionsSec ? {transitionsSec:[...event.transitionsSec]} : {}) })
  }
  // MS-1: ostatnie 7 dni i pierwszy tydzień po zawodach mają połowę zadeklarowanego czasu.
  const end = c.goal.kind === 'base' ? c.goal.date : addDays(c.goal.date, 7)
  for (let week = mondayOf(from); week <= end; week = addDays(week, 7)) {
    const dates = DAYS.map((_, i) => addDays(week, i)).filter(d => d >= from && d <= end && !events.some(g=>g.date===d))
    if (c.goal.kind === 'base' && !events.some(g=>g.date===c.goal.date) && week === mondayOf(c.goal.date) && !dates.includes(c.goal.date)) dates.push(c.goal.date)
    const factor = c.goal.kind !== 'base' && diffDays(week, c.goal.date) < 14 ? 0.5 : 1
    const requests: TrainingSession[] = []
    for (const sport of sports) {
      const profile = c.athlete.sports[sport]!
      const module = sportModule(sport), prescription = module.weekly(profile, c, from, week, asOf)
      const eligibleDates = dates.filter(d => d >= prescription.earliest && !(c.goal.kind !== 'base' && d > c.goal.date && d <= addDays(c.goal.date, profile.recoveryDays ?? (sport === 'run' ? 2 : 1))))
      const eventCount = events.some(g=>mondayOf(g.date)===week && (g.sport===sport || g.legs?.some(l=>l.sport===sport))) ? 1 : 0
      for (const [i, dose] of prescription.doses.slice(0,prescription.doses.length-eventCount).entries()) {
        const preferred = eligibleDates[Math.floor(i * eligibleDates.length / profile.sessionsPerWeek)] ?? eligibleDates[0]
        if (!preferred) continue
        const request = module.session(sport, profile, dose.minutes, `${cycleId}-${week}-${sport}-${i}`, preferred, dose.purpose, asOf, {phase:prescription.phase,weekIndex:Math.max(0,Math.floor(diffDays(mondayOf(from),week)/7)),slot:i,goal:c.goal})
        request.phase = prescription.phase; request.intent = trainingIntent(request)
        request.ruleRefs.push('MS-4'); requests.push(request)
      }
    }

    const scheduled = scheduleSessions(p, requests, [], dates, c)
    if (scheduled.plan) p.sessions = scheduled.plan.sessions
    else {
      if (scheduled.exhausted) p.warnings.push(`${msg().searchLimit} ${week}`)
      for (const request of requests) {
        const placed = placeSession(request, dates, p, c)
        if (placed) p.sessions.push(placed)
        else p.warnings.push(`${msg().capacity} ${week} ${msg().sport[request.sport]} ${request.id}`)
      }
    }
    if (c.brick && factor === 1) {
      const date = addDays(week, DAYS.indexOf(c.brick.day))
      const bike = p.sessions.find(s => mondayOf(s.date) === week && s.sport === 'bike' && s.purpose !== 'race' && !s.groupId)
      const run = p.sessions.find(s => mondayOf(s.date) === week && s.sport === 'run' && s.purpose !== 'race' && !s.groupId)
      if (bike && run && dates.includes(date)) {
        const gid = `${cycleId}-${week}-brick`
        const weekIndex=Math.max(0,Math.floor(diffDays(mondayOf(from),week)/7))
        const brickFactor=weekIndex%4===3?0.7:Math.min(1,0.75+0.125*(weekIndex%4))
        const a = buildSportSession('bike', c.athlete.sports.bike!, Math.max(5,c.brick.bikeMinutes*brickFactor), bike.id, date, 'easy', asOf, {phase:bike.phase,weekIndex,goal:c.goal,brick:'bike'})
        const b = buildSportSession('run', c.athlete.sports.run!, Math.max(5,c.brick.runMinutes*brickFactor), run.id, date, 'easy', asOf, {phase:run.phase,weekIndex,goal:c.goal,brick:'run'})
        a.intent=trainingIntent(a); b.intent=trainingIntent(b)
        a.start = sportsWindows(c,date)?.find(w=>w.sports.includes('bike'))?.start ?? '07:00'
        b.start = clockText(Math.ceil(clockMinutes(a.start) + occupiedMinutes(a) + c.brick.transitionMinutes))
        a.groupId = gid; b.groupId = gid
        const group: SessionGroup = { id: gid, kind: 'brick', sessionIds: [a.id, b.id], transitionSec: c.brick.transitionMinutes * 60 }
        const candidate = { ...p, sessions: [...p.sessions.filter(s => s.id !== a.id && s.id !== b.id), a, b], groups: [...p.groups, group] }
        if (!calendarIssues(candidate, c).length) { p.sessions = candidate.sessions; p.groups = candidate.groups }
        else {
          try {
            // A requested brick reserves its day before the remaining sessions are placed.
            const adjusted = rescheduleSportsPlan(candidate, c, dates[0]!, [], new Set([a.id, b.id]))
            for (const s of adjusted.sessions) if (mondayOf(s.date) === week) delete s.approved
            p.sessions = adjusted.sessions; p.groups = adjusted.groups
          } catch { p.warnings.push(`${msg().noFit} ${gid}`) }
        }
      }
    }
  }
  p.sessions.sort((a, b) => a.date.localeCompare(b.date) || (a.start ?? '').localeCompare(b.start ?? '') || a.id.localeCompare(b.id))
  p.warnings = [...new Set(p.warnings)]
  return p
}

function replacementId(plan: SportsPlan): string {
  const ids = new Set([...plan.sessions, ...plan.archive].map(s=>s.id))
  let n = plan.replacements.length + 1
  while (ids.has(`${plan.cycleId}-replacement-${n}`)) n++
  return `${plan.cycleId}-replacement-${n}`
}

/** Restore the saved prescription at the current calendar position, under a new export UID. */
export function restoreSportSession(plan: SportsPlan, config: SportsConfig, id: string, reason?: string): SportsPlan {
  const source = plan.sessions.find(s=>s.id===id)
  if (!source) throw new Error(msg().noSession)
  if (source.pinned || source.purpose === 'race' || source.sport === 'strength') throw new Error(msg().protected)
  const history = plan.replacements.find(r=>r.targetId===id)
  const original = plan.archive.find(s=>s.id===history?.sourceId)
  if (!original || original.sport === 'strength') throw new Error(msg().noOriginal)
  const profile = config.athlete.sports[original.sport]
  if (!profile) throw new Error(`${msg().noProfile} ${original.sport}`)
  if (original.sport === 'swim' && profile.poolLengthM && ((original.poolLengthM !== undefined && original.poolLengthM !== profile.poolLengthM) || original.steps.some(s=>s.distanceM !== undefined && Math.abs(s.distanceM/profile.poolLengthM!-Math.round(s.distanceM/profile.poolLengthM!))>1e-6))) throw new Error(msg().noFit)
  const restored = structuredClone(original)
  restored.id = replacementId(plan); restored.date = source.date; restored.approved = true
  restored.replacesSessionId = source.id; restored.restoresSessionId = original.id
  delete restored.externalId; delete restored.start; delete restored.groupId
  if (source.start) restored.start = source.start
  if (source.groupId) restored.groupId = source.groupId
  const next = structuredClone(plan)
  next.sessions = next.sessions.map(s=>s.id===id ? restored : s)
  next.archive.push(structuredClone(source))
  for (const group of next.groups) group.sessionIds = group.sessionIds.map(x=>x===id ? restored.id : x)
  next.replacements.push({sourceId:id,targetId:restored.id,restoresSessionId:original.id,operation:'restore',at:source.date,tradeoffs:[msg().restored],...(reason ? {reason} : {})})
  const issues = [...validateSportsPlan(next), ...calendarIssues(next,config,source.date)]
  if (issues.length) throw new Error(issues.join('\n'))
  return next
}

export function replaceSportSession(plan: SportsPlan, config: SportsConfig, id: string, targetSport: EnduranceSport, minutes?: number, reason?: string, context: ReplacementContext = {}): SportsPlan {
  const source = plan.sessions.find(s => s.id === id)
  if (!source) throw new Error(msg().noSession)
  if (source.sport === targetSport) throw new Error(msg().sameSport)
  if (source.purpose === 'race' || source.sport === 'strength') throw new Error(msg().protected)
  const profile = config.athlete.sports[targetSport]
  if (!profile) throw new Error(`${msg().noProfile} ${targetSport}`)
  const remaining = plan.sessions.filter(s=>s.id!==source.id), day=weekdayOf(source.date)
  const daily = Math.min(plan.timeBudgets?.[source.date] ?? Infinity,(day==='sat'||day==='sun'?config.time?.weekendMinutes:config.time?.weekdayMinutes) ?? Infinity) - calendarMinutes(remaining.filter(s=>s.date===source.date),plan.groups)
  const weekly = (config.time?.weeklyMinutes ?? Infinity) - calendarMinutes(remaining.filter(s=>mondayOf(s.date)===mondayOf(source.date)&&s.purpose!=='race'),plan.groups)
  const available = sportsWindows(config,source.date)
  const window = source.start && available !== undefined ? Math.max(0,...available.filter(w=>w.sports.includes(targetSport) && clockMinutes(w.start)<=clockMinutes(source.start!)).map(w=>clockMinutes(w.start)+w.minutes-clockMinutes(source.start!))) : Infinity
  const nextStart = source.start ? Math.min(Infinity,...remaining.filter(s=>s.date===source.date&&s.start&&s.start>source.start!).map(s=>clockMinutes(s.start!)-clockMinutes(source.start!)-transitionAfter(source,plan.groups))) : Infinity
  const allowed = Math.min(minutes ?? occupiedMinutes(source),daily,weekly,window,nextStart)
  const decision = replacementAssessment(plan, config, source, targetSport, allowed, context)
  const replacement = sportModule(targetSport).session(targetSport, profile, decision.minutes, replacementId(plan), source.date, decision.purpose, context.asOf ?? source.date, {phase:source.phase,goal:config.goal})
  replacement.intent = trainingIntent(replacement)
  if (context.variant==='quality' && replacement.purpose!=='intervals') throw new Error(msg().qualityUnavailable)
  decision.assessment.alternative = replacement.intent
  if (decision.purpose==='intervals' && replacement.purpose!=='intervals') {
    decision.assessment.preserved=decision.assessment.preserved.filter(x=>x!==msg().qualityIntent)
    decision.assessment.lost.push(msg().differentPurpose)
  }
  decision.assessment.afterMinutes = occupiedMinutes(replacement)
  if (source.start) replacement.start = source.start
  replacement.approved = true; replacement.replacesSessionId = source.id
  if (source.groupId) replacement.groupId = source.groupId
  replacement.ruleRefs = ['MS-1', 'MS-2', 'MS-5', 'MS-6']
  const next = structuredClone(plan)
  next.sessions = next.sessions.map(s => s.id === source.id ? replacement : s)
  next.archive.push(structuredClone(source))
  for (const group of next.groups) group.sessionIds = group.sessionIds.map(x => x === id ? replacement.id : x)
  next.replacements.push({ sourceId: id, targetId: replacement.id, at: source.date, ...(reason ? { reason } : {}), assessment: decision.assessment, tradeoffs: [msg().substitution, ...decision.assessment.preserved, ...decision.assessment.lost, ...decision.assessment.limits] })
  const issues = calendarIssues(next, config, source.date)
  if (issues.length) throw new Error(issues.join('\n'))
  return next
}

export function shortenSportSession(source: TrainingSession, minutes: number): TrainingSession {
  if (!finite(minutes, 0, 1440) || source.purpose === 'race') throw new Error(msg().noFit)
  if (source.legacyWorkout) {
    const result = shortenWorkout(source.legacyWorkout, Math.floor(minutes), { preparationMinutes: Math.ceil(source.preparationSec / 60) })
    if (!result.workout) throw new Error(msg().noFit)
    const workout = result.workout, durationSec = Math.round(estimateWorkoutMinutes(workout, 0) * 60)
    const shortened:TrainingSession = { ...source, legacyWorkout: workout, description: workout.segments.map(s => s.description).join('; '),
      durationSec, distanceM: workout.distanceKm * 1000, ruleRefs: workout.ruleRefs, approved: true,
      purpose: result.status === 'easy-alternative' ? 'easy' : source.purpose,
      // E1: skrócony bieg zachowuje strukturę w krokach (karta, FIT, intervals.icu)
      steps: runningSteps(workout, durationSec),
    }
    const updated=attachRunningCoaching(shortened,{phase:source.phase})
    if(source.coaching)updated.coaching!.rationale=source.coaching.rationale
    updated.intent=trainingIntent(updated)
    return updated
  }
  const budgetSec = Math.floor(minutes * 60 - source.preparationSec)
  if (budgetSec >= source.durationSec) return structuredClone(source)
  const steps: SessionStep[] = []
  const fixed = source.steps.filter(s => s.role === 'warmup' || s.role === 'cooldown')
  let left = budgetSec - fixed.reduce((n,s) => n + stepSeconds(s), 0)
  for (const original of source.steps.filter(s => s.role !== 'warmup' && s.role !== 'cooldown')) {
    const step = structuredClone(original)
    if (stepSeconds(step) <= left) { steps.push(step); left -= stepSeconds(step); continue }
    if ((step.repeat ?? 1) > 1) {
      const count = Math.floor(left / stepSeconds({ ...step, repeat: 1 }))
      if (count > 0) { step.repeat = count; steps.push(step); left -= stepSeconds(step) }
    } else if (step.distanceM === undefined && !step.restSec && !step.sendoffSec && left >= 60) {
      step.durationSec = left; steps.push(step); left = 0
    }
    break
  }
  if (!steps.length || sessionTotals(steps).durationSec < 60) throw new Error(msg().noFit)
  if (source.purpose === 'intervals') {
    const work=(list:SessionStep[])=>list.filter(s=>s.role==='work' && (!s.effort || s.effort.max>4)).reduce((n,s)=>n+s.durationSec*(s.repeat??1),0)
    if(work(steps)<Math.max(source.coaching?.minimumWorkSec??0,work(source.steps)*.5)) throw new Error(msg().noFit)
  }
  if (source.purpose==='technique' && source.steps.some(s=>s.role==='drill') && (!steps.some(s=>s.role==='drill') || !steps.some(s=>s.role==='work'))) throw new Error(msg().noFit)
  steps.unshift(...fixed.filter(s => s.role === 'warmup')); steps.push(...fixed.filter(s => s.role === 'cooldown'))
  const next = { ...source, steps, ...sessionTotals(steps), approved: true }
  delete next.legacyWorkout
  if (sessionTotals(steps).distanceM === undefined) delete next.distanceM
  return next
}

export function buildSessionExecution(plan: SportsPlan, activities: SyncedActivity[], logs: SessionLog[], today: string): SessionExecution[] {
  const journal = new Map(logs.map(l => [l.sessionId, l])), evidence = activityEvidence(activities)
  const used = new Set<string>()
  for (const log of journal.values()) for (const id of log.activityIds ?? []) {
    const a = resolveActivity(activities,id)
    if (a) for (const alias of evidence.find(e => e.aliases.includes(activityKey(a)))?.aliases ?? [activityKey(a)]) used.add(alias)
  }
  return plan.sessions.filter(s => s.date <= today).map(s => {
    const log = journal.get(s.id), base = { sessionId: s.id, date: s.date, sport: s.sport, replacement: !!s.replacesSessionId }
    if (log) {
      const selected = new Set((log.activityIds ?? []).map(id => resolveActivity(activities,id)).filter((a): a is SyncedActivity => !!a).map(activityKey))
      const bound = evidence.filter(e => e.aliases.some(id => selected.has(id)))
      const complete = bound.length > 0 && selected.size === log.activityIds?.length && bound.every(e=>!e.activity.dataWithheld && e.activity.date===s.date && sportOf(e.activity.type)===log.sport)
      const duration = complete && bound.every(e=>e.activity.movingTimeSec !== undefined) ? bound.reduce((n,e)=>n+e.activity.movingTimeSec!,0) : undefined
      const distance = complete && bound.every(e=>e.activity.distanceKm !== undefined) ? bound.reduce((n,e)=>n+e.activity.distanceKm!*1000,0) : undefined
      const spontaneous = log.sport !== s.sport
      return { ...base, sport: log.sport, ...(spontaneous ? {plannedSport:s.sport,spontaneous:true} : {}), ...(log.rpe !== undefined ? {rpe:log.rpe} : {}), ...(log.note ? {note:log.note} : {}), ...(log.completedRepeats ? {completedRepeats:log.completedRepeats} : {}), status: log.status === 'skipped' ? 'missed' : 'done', source: 'journal', durationSec: log.durationSec ?? duration ?? (log.status === 'done' && !spontaneous && !log.activityIds?.length && !log.completedRepeats ? s.durationSec : undefined), distanceM: log.distanceM ?? distance, activityIds: bound.flatMap(e=>e.aliases), matching: 'explicit' } as SessionExecution
    }
    const candidates = evidence.filter(e => { const a=e.activity; return !a.dataWithheld && a.classification !== 'inferred' && a.classification !== 'unknown' && !e.aliases.some(id=>used.has(id)) && (!a.plannedSessionId || a.plannedSessionId === s.id) && a.date === s.date && sportOf(a.type) === s.sport })
    const exact = candidates.filter(e => e.activity.plannedSessionId === s.id)
    const sameDay = plan.sessions.filter(x => x.date === s.date && x.sport === s.sport)
    const match = exact.length === 1 ? exact[0] : sameDay.length === 1 && candidates.length === 1 ? candidates[0] : undefined
    if (match && ((match.activity.movingTimeSec ?? 0) > 0 || (match.activity.distanceKm ?? 0) > 0)) {
      for (const alias of match.aliases) used.add(alias)
      const a=match.activity
      return { ...base, status: 'done', source: 'sync', activityIds: match.aliases, matching: exact.length === 1 ? 'session-id' : 'unique-day-sport', ...(a.movingTimeSec !== undefined ? { durationSec: a.movingTimeSec } : {}), ...(a.distanceKm !== undefined ? { distanceM: a.distanceKm * 1000 } : {}) }
    }
    return { ...base, status: 'unknown', source: 'none', ...(candidates.length ? { candidates: candidates.flatMap(e=>e.aliases) } : {}) }
  })
}

/** Renegocjacja deterministyczna: jawna heurystyka, bez deklaracji globalnego optimum. */
export function rescheduleSportsPlan(plan: SportsPlan, config: SportsConfig, from: string, blocked: string[], fixedIds: Set<string>, strategy: 'long' | 'quality' = 'long'): SportsPlan {
  const next = structuredClone(plan), week = mondayOf(from)
  next.blockedDates = [...new Set([...(next.blockedDates ?? []), ...blocked])]
  const eligible = (s: TrainingSession): boolean => mondayOf(s.date) === week && s.date >= from && !fixedIds.has(s.id) && !s.pinned && s.purpose !== 'race'
  const movableGroups = next.groups.filter(g => g.kind === 'brick' && g.sessionIds.every(id => eligible(next.sessions.find(s => s.id === id)!)))
  const movable = next.sessions.filter(s => eligible(s) && (!s.groupId || movableGroups.some(g => g.id === s.groupId)))
  next.sessions = next.sessions.filter(s => !movable.some(m => m.id === s.id))
  next.groups = next.groups.filter(g => !movableGroups.some(m => m.id === g.id))
  const dates = DAYS.map((_, i) => addDays(week, i)).filter(d => d >= from && !blocked.includes(d))
  const result = scheduleSessions(next, movable, movableGroups, dates, config, 5000, strategy)
  if (!result.plan) throw new Error(result.exhausted ? msg().searchLimit : msg().noFit)
  next.sessions = result.plan.sessions.map(s => {
    const before = movable.find(m => m.id === s.id)
    return before ? { ...s, ...(s.date !== before.date || s.start !== before.start || before.approved ? {approved:true} : {}) } : s
  })
  next.groups = result.plan.groups
  const issues = calendarIssues(next, config, from)
  if (issues.length) throw new Error(issues.join('\n'))
  return next
}
