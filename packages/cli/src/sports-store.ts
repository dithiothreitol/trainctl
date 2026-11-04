/** Session schema v2. Legacy files remain readable through the v1 handlers. */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { parse, stringify } from 'yaml'
import {
  ENDURANCE_SPORTS, addDays, estimateWorkoutMinutes, getLocale, mondayOf,
  sportMessages as msg, validateSportsConfig, validateSportsPlan,
  type EnduranceSport, type SessionLog, type SportsConfig, type SportsPlan, type TrainingSession,
} from 'trainctl-core'
import { CONFIG_FILE, loadConfig } from './config.ts'
import { PLAN_YAML, PLAN_MD, loadPlan, workoutText } from './planfile.ts'
import { LOG_FILE } from './logfile.ts'
import { SYNC_FILE } from './sync.ts'
import { clockToday } from './clock.ts'
import { runningDurationMinutes, runningSessions } from './sports-running.ts'
import { packageVersion } from './version.ts'

import { recoverSportsTransaction, writeTransaction } from './sports-transaction.ts'
export { writeTransaction, recoverSportsTransaction } from './sports-transaction.ts'

export const fingerprint = (value: unknown): string => createHash('sha256').update(JSON.stringify(value)).digest('hex')
export const readOptional = (cwd: string, path: string): string | null => existsSync(join(cwd, path)) ? readFileSync(join(cwd, path), 'utf8') : null
export function isSportsWorkspace(cwd: string): boolean {
  recoverSportsTransaction(cwd)
  // Detection must not hide damaged YAML: the selected handler reports the error.
  for (const file of [PLAN_YAML, CONFIG_FILE]) {
    const text = readOptional(cwd, file)
    if (file === CONFIG_FILE && text && /^schemaVersion:\s*(?:[2-9]|\d{2,})\s*$/m.test(text)) return true
    try { const raw = text ? parse(text) : undefined; if (raw?.schemaVersion >= 2 && (file === CONFIG_FILE || Array.isArray(raw.sessions))) return true } catch { /* reported by loader */ }
  }
  return false
}
export const loadSportsConfig = (cwd: string): SportsConfig => validateSportsConfig(parse(readFileSync(join(cwd, CONFIG_FILE), 'utf8')))
export function loadSportsPlan(cwd: string): SportsPlan {
  const text = readOptional(cwd, PLAN_YAML)
  if (!text) throw new Error(msg().noPlan)
  const p = parse(text) as SportsPlan
  if (p?.schemaVersion !== 2) throw new Error(msg().migrate)
  const issues = validateSportsPlan(p)
  if (issues.length) throw new Error(issues.join('\n'))
  return p
}
export function readSessionLogs(cwd: string): SessionLog[] {
  return (readOptional(cwd, LOG_FILE) ?? '').split('\n').filter(l => l.trim()).map(l => {
    const entry = JSON.parse(l) as SessionLog
    if (entry.schemaVersion !== 2 || !entry.sessionId || !['run', 'bike', 'swim', 'strength'].includes(entry.sport) || !['done', 'skipped', 'modified'].includes(entry.status) || (entry.plannedSport !== undefined && (!ENDURANCE_SPORTS.includes(entry.plannedSport as EnduranceSport) || entry.sport === 'strength' || entry.status === 'skipped'))) throw new Error(`${msg().invalid} ${LOG_FILE}`)
    if (entry.completedRepeats !== undefined && (entry.sport !== 'swim' || entry.status === 'skipped' || !Array.isArray(entry.completedRepeats) || !entry.completedRepeats.length || entry.completedRepeats.some(x=>!x || !Number.isInteger(x.step) || x.step<1 || !Number.isInteger(x.repeats) || x.repeats<0 || x.repeats>1000) || new Set(entry.completedRepeats.map(x=>x.step)).size!==entry.completedRepeats.length)) throw new Error(`${msg().invalid} ${LOG_FILE}`)
    return entry
  })
}
export function sessionText(s: TrainingSession): string {
  const t = msg()
  const steps = s.legacyWorkout ? s.description ?? workoutText({date:s.date,weekday:'mon',workout:s.legacyWorkout}) : s.steps.map(x => {
    const dose = x.distanceM ? `${x.distanceM} m` : `${Math.round(x.durationSec / 60 * 10) / 10} min`
    const target = x.target.kind === 'power' ? `${x.target.watts} W` : x.target.kind === 'pace' ? `${x.target.seconds} s/${x.target.perM} m` : 'open'
    return `${x.repeat ? `${x.repeat} × ` : ''}${dose} @ ${target}${x.restSec ? ` + ${x.restSec}s ${t.role.rest}` : ''}${x.sendoffSec ? ` / ${x.sendoffSec}s` : ''}${x.stroke ? ` (${x.stroke})` : ''}`
  }).join('; ')
  return `${t.sport[s.sport]} · ${t.purpose[s.purpose]} · ${Math.round(s.durationSec / 6) / 10} min${s.distanceM ? ` · ${s.distanceM} m` : ''} · ${steps}`
}
const cell = (s: string): string => s.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')
export function sportsMarkdown(p: SportsPlan): string {
  const t = msg()
  return [`# ${cell(p.goal.name)}`, '', t.engineering, '', '| ID | Date | Start | Session |', '| --- | --- | --- | --- |',
    ...p.sessions.map(s => `| ${cell(s.id)} | ${s.date} | ${s.start ?? ''} | ${cell(sessionText(s))}${s.replacesSessionId ? ` (${t.replaced}: ${cell(s.replacesSessionId)})` : ''} |`), '',
    ...p.warnings.map(w => `- ${w}`), '', '## History', ...p.replacements.map(r => `- ${r.sourceId} → ${r.targetId}: ${r.tradeoffs.join(' ')}`), ''].join('\n')
}
export const planFiles = (p: SportsPlan): Record<string, string> => ({ [PLAN_YAML]: stringify(p), [PLAN_MD]: sportsMarkdown(p) })
export function writeSportsPlan(cwd: string, p: SportsPlan): void {
  const issues = validateSportsPlan(p)
  if (issues.length) throw new Error(issues.join('\n'))
  writeTransaction(cwd, planFiles(p))
}
const INPUTS = [CONFIG_FILE, PLAN_YAML, LOG_FILE, SYNC_FILE]
export const stateFingerprint = (cwd: string): string => fingerprint([clockToday(), ...INPUTS.map(p => [p, readOptional(cwd, p)])])
export interface SportsProposal { schemaVersion: 2; id: string; action: string; state: string; date: string; plan: SportsPlan; config?: SportsConfig; log?: string; notes: string[]; digest: string }
export function prepareSportsProposal(cwd: string, action: string, plan: SportsPlan, notes: string[], extra: { config?: SportsConfig; log?: string } = {}): SportsProposal {
  const id = randomUUID(), snapshot = structuredClone(plan)
  if (action === 'replace' && snapshot.replacements.length) snapshot.replacements.at(-1)!.proposalId = id
  const body = { schemaVersion: 2 as const, id, action, state: stateFingerprint(cwd), date: clockToday(), plan: snapshot, notes, ...extra }
  const proposal = { ...body, digest: fingerprint(body) }
  writeTransaction(cwd, { [`plan/proposals/${proposal.id}.json`]: JSON.stringify(proposal, null, 2) + '\n' })
  return proposal
}
export function applySportsProposal(cwd: string, id: string, action: string): SportsProposal {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error(msg().stale)
  const p = JSON.parse(readFileSync(join(cwd, `plan/proposals/${id}.json`), 'utf8')) as SportsProposal
  const { digest, ...body } = p
  if (p.action !== action || p.schemaVersion !== 2 || digest !== fingerprint(body) || p.state !== stateFingerprint(cwd)) throw new Error(msg().stale)
  const errors = validateSportsPlan(p.plan)
  if (errors.length) throw new Error(errors.join('\n'))
  const files = planFiles(p.plan)
  if (p.config) files[CONFIG_FILE] = stringify(validateSportsConfig(p.config))
  if (p.log !== undefined) files[LOG_FILE] = p.log
  if (action === 'migrate') for (const path of [...INPUTS, PLAN_MD]) {
    const original = readOptional(cwd, path)
    if (original !== null) files[`plan/migrations/${id}/${path}`] = original
  }
  writeTransaction(cwd, files, () => { if (p.state !== stateFingerprint(cwd)) throw new Error(msg().stale) })
  return p
}

export function sportsTemplate(sports: string, today = clockToday()): string {
  const selected = [...new Set(sports.split(',').map(s => s.trim()))]
  if (!selected.length || selected.some(s => !ENDURANCE_SPORTS.includes(s as EnduranceSport))) throw new Error(`${msg().invalid} --sports run,bike,swim`)
  const config: SportsConfig = { schemaVersion: 2, language: getLocale(), athlete: { sports: Object.fromEntries(selected.map(s => [s, { weeklyMinutes: 90, sessionsPerWeek: 2, preparationMinutes: 10, ...(s === 'swim' ? { poolLengthM: 25 } : {}) }])) }, goal: { kind: 'base', name: 'Base', date: addDays(today, 55) }, maxSessionsPerDay: 2 }
  return stringify(config)
}

export function migrationCandidate(cwd: string): { plan: SportsPlan; config: SportsConfig; log: string } {
  const old = loadPlan(cwd), configV1 = loadConfig(cwd), rawConfig = parse(readFileSync(join(cwd, CONFIG_FILE), 'utf8'))
  const id = randomUUID(), cycleId = `c-${id.slice(0, 8)}`
  const goal = old.goal.kind === 'base' ? { kind: 'base' as const, date: old.goal.date, name: old.goal.name } : { kind: 'race' as const, date: old.goal.date, name: old.goal.name, sport: 'run' as const, distanceM: old.goal.distanceKm * 1000, estimatedMinutes: old.weeks.flatMap(w => w.days).filter(d => d.workout?.kind === 'race' && d.date === old.goal.date).map(d => runningDurationMinutes(old,d.workout!,d.date))[0] ?? ((old.goal.targetTimeSec ?? 0) / 60) }
  const plan: SportsPlan = { schemaVersion: 2, id, cycleId, engineVersion: packageVersion(), generatedAt: old.generatedAt, goal, sessions: [], archive: [], groups: [], replacements: [], changes: [], generatedSessions: {}, warnings: [...old.feasibilityWarnings], legacy: { plan: old, config: rawConfig, cycleId }, ...(old.timeBudgets ? { timeBudgets: old.timeBudgets } : {}) }
  plan.sessions = runningSessions(old, cycleId)
  plan.generatedSessions = Object.fromEntries(plan.sessions.map(s => [s.id, fingerprint(s)]))
  const weekly = old.weeks.map(w => plan.sessions.filter(s => s.sport === 'run' && mondayOf(s.date) === w.weekStart).reduce((n, s) => n + s.durationSec / 60, 0)).filter(n => n > 0)
  const config: SportsConfig = { schemaVersion: 2, ...(rawConfig.language ? { language: rawConfig.language } : {}), athlete: { sports: { run: { weeklyMinutes: Math.max(10, Math.round(weekly[0] ?? configV1.athlete.recentWeeklyKm * 6)), sessionsPerWeek: configV1.athlete.daysAvailable.length, daysAvailable: configV1.athlete.daysAvailable, results: configV1.athlete.results, running: { recentWeeklyKm: configV1.athlete.recentWeeklyKm, ...(configV1.athlete.peakWeeklyKm !== undefined ? {peakWeeklyKm: configV1.athlete.peakWeeklyKm} : {}), ...(configV1.athlete.longRunDay ? {longRunDay: configV1.athlete.longRunDay} : {}), ...(configV1.athlete.tuneUpRaces ? {tuneUpRaces: configV1.athlete.tuneUpRaces} : {}) }, preparationMinutes: old.preparationMinutes ?? 15 } } }, goal,
    ...(rawConfig.time ? { time: rawConfig.time } : {}), ...(rawConfig.sync ? { sync: rawConfig.sync } : {}), ...(rawConfig.desk ? { desk: rawConfig.desk } : {}) }
  const logs = (readOptional(cwd, LOG_FILE) ?? '').split('\n').filter(l => l.trim()).map(l => {
    const oldLog = JSON.parse(l)
    const sport = oldLog.activity === 'strength' ? 'strength' : 'run'
    const sessionId = `${cycleId}-${oldLog.date}-${sport}`
    return { ...oldLog, schemaVersion: 2, sessionId, sport, ...(oldLog.timeSec !== undefined ? { durationSec: oldLog.timeSec } : oldLog.minutes !== undefined ? { durationSec: oldLog.minutes * 60 } : {}), ...(oldLog.km !== undefined ? { distanceM: oldLog.km * 1000 } : {}) }
  })
  return { plan, config: validateSportsConfig(config), log: logs.map(l => JSON.stringify(l)).join('\n') + (logs.length ? '\n' : '') }
}

export function sportsProposalStatus(cwd: string): { id: string; action: string; valid: boolean }[] {
  const dir = join(cwd,'plan/proposals')
  if (!existsSync(dir)) return []
  const state = stateFingerprint(cwd)
  return readdirSync(dir).filter(name=>/^[a-f0-9-]{36}\.json$/.test(name)).map(name=>{
    try { const p=JSON.parse(readFileSync(join(dir,name),'utf8')) as SportsProposal; const {digest,...body}=p; return {id:p.id,action:p.action,valid:p.schemaVersion===2&&digest===fingerprint(body)&&p.state===state} }
    catch {return {id:name.slice(0,-5),action:'?',valid:false}}
  })
}
