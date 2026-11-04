import { trainingCard, trainingDuration } from './ui/training.ts'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { parse, stringify } from 'yaml'
import {
  activityEvidence, activityKey, resolveActivity, ENDURANCE_SPORTS, addDays, buildSessionExecution, calendarIssues, calendarMinutes, generateSportsPlan, mondayOf, parseIso,
  replaceSportSession, restoreSportSession, rescheduleSportsPlan, sessionDeskDay, shortenSportSession, sportOf, sportMessages as msg, sportsTotals, validateSportsPlan,
  type EnduranceSport, type SessionLog, type SportsConfig, type SportsPlan, type TrainingSession,
} from 'trainctl-core'
import { b, renderPlain, type Block } from './ui/blocks.ts'
import { ui } from './i18n/index.ts'
import { clockToday } from './clock.ts'
import { packageVersion } from './version.ts'
import { CONFIG_FILE } from './config.ts'
import { LOG_FILE, parseTime } from './logfile.ts'
import { PLAN_MD, PLAN_YAML } from './planfile.ts'
import { commitFiles } from './git.ts'
import { readSnapshot, SYNC_FILE } from './sync.ts'
import { applySportsProposal, fingerprint, loadSportsConfig, loadSportsPlan, migrationCandidate, prepareSportsProposal, readOptional, readSessionLogs, sessionStepsText, sessionText, sportsProposalStatus, writeSportsPlan, writeTransaction } from './sports-store.ts'
import { initialRunning, regenerateRunning } from './sports-running.ts'
import { recoverSportsTransaction } from './sports-transaction.ts'
import { exportSportsPlan } from './sports-export.ts'

export interface SportsOptions {
  restore?: boolean | undefined; actualSport?: string | undefined; sets?: string | undefined;
  variant?: 'endurance' | 'quality' | undefined;
  recover?: 'resume' | 'rollback' | undefined;
  date?: string | undefined; session?: string | undefined; sport?: string | undefined; toSport?: string | undefined;
  minutes?: string | number | undefined; reason?: string | undefined; prepare?: boolean | undefined;
  apply?: string | boolean | undefined; fresh?: boolean | undefined; commit?: string | boolean | undefined;
  from?: string | undefined; to?: string | undefined; status?: string | undefined; strength?: string | undefined;
  km?: string | undefined; meters?: string | number | undefined; time?: string | string[] | undefined;
  testTime?: string | undefined; rpe?: string | undefined; note?: string | undefined; activity?: string | undefined;
  what?: string | undefined; strict?: boolean | undefined; block?: string[] | undefined; pin?: string[] | undefined;
  preparation?: string | undefined; strategy?: string | undefined; heavy?: boolean | undefined; days?: string | number | undefined; plan?: string | undefined;
}
export interface SportsResult { output: string; code: number; blocks: Block[]; data: Record<string, unknown> }
export const sportsResult = (blocks: Block[], data: Record<string, unknown> = {}, code = 0): SportsResult => ({ output: renderPlain(blocks), blocks, data, code })
export const sportsFailure = (e: unknown): SportsResult => sportsResult([b.error(e instanceof Error ? e.message : String(e))], { error: e instanceof Error ? e.message : String(e) }, 1)
const number = (v: unknown, min = 0, max = 10080): number => { const n = Number(v); if (v === '' || v === undefined || !Number.isFinite(n) || n < min || n > max) throw new Error(msg().invalid); return n }
function select(p: SportsPlan, o: SportsOptions): TrainingSession {
  const list = p.sessions.filter(s => o.session ? s.id === o.session : s.date === (o.date ?? o.from ?? clockToday()) && (!o.sport || s.sport === o.sport) && (!o.strength || s.sport === 'strength'))
  if (!list.length) throw new Error(msg().noSession)
  if (list.length !== 1) throw new Error(`${msg().ambiguous}\n${list.map(s => `${s.id}: ${sessionText(s)}`).join('\n')}`)
  return list[0]!
}
export function protectedSessions(cwd: string, p: SportsPlan): Set<string> {
  const today = clockToday(), logs = readSessionLogs(cwd)
  const execution = buildSessionExecution(p, readSnapshot(cwd)?.activities ?? [], logs, '9999-12-31')
  return new Set(p.sessions.filter(s => s.date < today || s.pinned || s.purpose === 'race' || logs.some(l => l.sessionId === s.id) || execution.some(e => e.sessionId === s.id && (e.status === 'done' || e.candidates?.length))).map(s => s.id))
}
function editable(cwd: string, p: SportsPlan, s: TrainingSession): void {
  if (protectedSessions(cwd, p).has(s.id)) throw new Error(msg().protected)
}
function change(p: SportsPlan, action: string, ids: string[]): void { p.changes.push({ at: clockToday(), action, sessionIds: ids }) }
function checked(p: SportsPlan, c: SportsConfig): void {
  const issues = [...validateSportsPlan(p), ...calendarIssues(p, c, clockToday())]
  if (issues.length) throw new Error(issues.join('\n'))
}
function volumeBlocks(sessions: TrainingSession[]): Block[] {
  const t = msg(), totals = sportsTotals(sessions), sports = [...ENDURANCE_SPORTS,'strength' as const].filter(s=>totals[s]!.sessions)
  const keys = ['easy','quality','race','recovery','technique','unknown'] as const
  const d = ui().display
  return [b.section(t.totals), b.table([d.sport,d.duration,d.distance,d.intensity],sports.map(s=>{
    const row=totals[s]!
    return [t.sport[s],trainingDuration(row.minutes * 60),`${row.distanceM} m`,
      keys.filter(k=>row.intensityPercent[k]>0).map(k=>`${t.intensity[k]} ${Number(row.intensityPercent[k].toFixed(1))}%`).join(' · ') || '—']
  }),sports),b.blank(),b.text(t.intensityMethod, 'muted')]
}

/** Keep proposal data intact; present the session comparison as structured cards. */
function changeDisplay(action: string, before: SportsPlan | undefined, after: SportsPlan, notes: string[], applied = false): Block[] {
  if (!before || !['replace', 'shorten'].includes(action)) return notes.map(n => b.info(n))
  const change = after.changes.at(-1)
  const source = before.sessions.find(s => s.id === change?.sessionIds[0])
  const target = after.sessions.find(s => s.id === (action === 'replace' ? change?.sessionIds[1] : change?.sessionIds[0]))
  if (!source || !target) return notes.map(n => b.info(n))
  const t = msg()
  const summary = (s: TrainingSession) => t.sport[s.sport] + ' · ' + trainingDuration(s.durationSec) + (s.distanceM ? ' · ' + s.distanceM + ' m' : '')
  if (applied) return [b.kv([[t.before, summary(source)], [t.after, summary(target)]]), ...notes.slice(2).map(n => b.info(n)), b.hint('trainctl today --session ' + target.id)]
  return [trainingCard(source, false, t.before), trainingCard(target, false, t.after), ...notes.slice(2).map(n => b.info(n))]
}

function proposed(cwd: string, action: string, p: SportsPlan, notes: string[], o: SportsOptions, extra: { config?: SportsConfig; log?: string } = {}): SportsResult {
  const proposal = prepareSportsProposal(cwd, action, p, notes, extra)
  const before = ['replace', 'shorten'].includes(action) ? loadSportsPlan(cwd) : undefined
  const result = sportsResult([b.success(`${msg().prepared} ${proposal.id}`), ...changeDisplay(action, before, p, notes), b.hint(`trainctl ${action} --apply ${proposal.id}`)], { proposal, applied: false })
  return result
}
function commitResult(cwd: string, o: SportsOptions, result: SportsResult, files: string[], action: string): SportsResult {
  if (o.commit !== undefined && o.commit !== false && result.code === 0 && result.data.applied) {
    const commit = commitFiles(cwd, files, typeof o.commit === 'string' ? o.commit : `trainctl ${action}`)
    result.data.commit = commit
    if (commit.status === 'failed') result.blocks.push(b.warn(commit.detail))
    else result.blocks.push(b.info(`git: ${commit.status}`))
    result.output = renderPlain(result.blocks)
  }
  return result
}

export function sportsCommand(cwd: string, action: string, o: SportsOptions = {}): SportsResult {
  try {
    if (o.recover) {
      if (action !== 'migrate' || !['resume', 'rollback'].includes(o.recover)) throw new Error(msg().invalid)
      const recovered = recoverSportsTransaction(cwd, o.recover)
      return sportsResult([b.success(recovered ? msg().applied : msg().noChanges)], { recovered, mode: o.recover })
    }
    recoverSportsTransaction(cwd)
    const t = msg(), today = clockToday(), date = o.date ?? today
    parseIso(date)
    if (typeof o.apply === 'string') {
      if (o.prepare || o.session || o.toSport || o.restore || o.actualSport || o.variant || o.reason || o.minutes !== undefined || o.date || o.block || o.time) throw new Error(t.invalid)
      if (!['migrate', 'replace', 'adapt', 'shorten', 'reschedule'].includes(action)) throw new Error(t.invalid)
      const before = ['replace', 'shorten'].includes(action) ? loadSportsPlan(cwd) : undefined
      const proposal = applySportsProposal(cwd, o.apply, action)
      return commitResult(cwd, o, sportsResult([b.success(t.applied), ...changeDisplay(action, before, proposal.plan, proposal.notes, true)], { proposal, plan: proposal.plan, applied: true }), [PLAN_YAML, PLAN_MD, ...(action === 'migrate' ? [CONFIG_FILE, LOG_FILE] : [])], action)
    }
    if (action === 'migrate') {
      const raw = readOptional(cwd, PLAN_YAML)
      if (raw?.includes('schemaVersion: 2')) return sportsResult([b.info(t.alreadyV2)])
      const candidate = migrationCandidate(cwd)
      return proposed(cwd, action, candidate.plan, [t.migrated, `${candidate.plan.sessions.length} ${t.session}`], o, { config: candidate.config, log: candidate.log })
    }
    const config = loadSportsConfig(cwd)
    if (action === 'plan') return generate(cwd, config, o)
    const plan = loadSportsPlan(cwd), logs = readSessionLogs(cwd), activities = readSnapshot(cwd)?.activities ?? []
    const execution = buildSessionExecution(plan, activities, logs, date)
    if (['today', 'week', 'why', 'desk', 'status'].includes(action)) {
      const list = plan.sessions.filter(s => o.session ? s.id === o.session : action === 'status' ? s.date >= date && s.date < addDays(date, 7) : action === 'week' ? mondayOf(s.date) === mondayOf(date) : s.date === date).filter(s => !o.sport || s.sport === o.sport)
      if (o.session && !list.length) throw new Error(t.noSession)
      const d = ui().display
      const view = d.views[action as keyof typeof d.views]
      const start = o.session ? list[0]!.date : action === 'week' ? mondayOf(date) : date
      const period = !o.session && (action === 'week' || action === 'status') ? `${start} – ${addDays(start, 6)}` : start
      const blocks: Block[] = [b.title(`${t.plan}: ${plan.goal.name}`, `${view} · ${period}`)]
      if (list.length) blocks.push(b.kv([
        [d.sessions, String(list.length)],
        [d.trainingTime, trainingDuration(list.reduce((sum, s) => sum + s.durationSec, 0))],
        [d.occupiedTime, trainingDuration(calendarMinutes(list, plan.groups) * 60)],
      ]))
      blocks.push(...list.map(s=>trainingCard(s,action==='today'||action==='why'||!!o.session)))
      if (!list.length) blocks.push(b.info(t.rest))
      if (action === 'week' || action === 'status') blocks.push(...volumeBlocks(list))
      for (const group of plan.groups.filter(g=>g.sessionIds.some(id=>list.some(s=>s.id===id)) && g.transitionSec>0)) blocks.push(b.info(`${t.group}: ${group.id} · ${t.transitions}: ${group.transitionsSec?.map((n,i)=>`T${i+1}=${n}`).join(', ') ?? group.transitionSec}`))
      if (action === 'why') for (const s of list) {
        blocks.push(b.info(`${s.ruleRefs.join(', ')}: ${s.ruleRefs.includes('MS-2') ? t.substitution : s.ruleRefs.includes('MS-1') ? t.engineering : s.description ?? ''}`))
        const replacement = plan.replacements.find(r=>r.targetId===s.id)
        if (replacement) blocks.push(...replacement.tradeoffs.map(note=>b.info(note)))
        if (s.phase) blocks.push(b.info(`${t.phase}: ${t.phases[s.phase]}`))
        if (s.calibration) blocks.push(b.info(`${t.source}: ${s.calibration.date} · ${s.calibration.source}`))
      }
      const desk = action === 'desk' ? sessionDeskDay(plan, config, date) : undefined
      if (desk) {
        blocks.push(b.info(`${t.budget}: ${calendarMinutes(list, plan.groups)} min`))
        for (const group of desk.groups) blocks.push(b.panel(group.id, group.windows.map(w => `${w.label} ${w.from}–${w.to}: ${w.fits ? t.valid : t.noFit}`)))
        blocks.push(b.text(desk.breaks.map(w => `${w.at} ${w.what}`).join(' · ')))
      }
      const proposals = action === 'status' ? sportsProposalStatus(cwd) : undefined
      if (proposals?.length) blocks.push(b.table(['ID',t.action,t.validity],proposals.map(p=>[p.id,p.action,p.valid?t.valid:t.stale])))
      if (action === 'status') blocks.push(...plan.warnings.map(w => b.warn(w)), ...calendarIssues(plan, config).map(w => b.warn(w)))
      return sportsResult(blocks, { sessions: list, totals: sportsTotals(list), occupiedMinutes: calendarMinutes(list, plan.groups), execution: execution.filter(e => list.some(s => s.id === e.sessionId)), schemaVersion: 2, ...(proposals ? {proposals,engineVersion:plan.engineVersion,currentEngineVersion:packageVersion(),lastPull:readSnapshot(cwd)?.pulledAt??null} : {}), ...(desk ? {desk} : {}) })
    }
    if (action === 'log') {
      const s = select(plan, o), actualSport = o.actualSport ?? s.sport, spontaneous = actualSport !== s.sport
      const status = o.strength ?? o.status ?? (spontaneous || o.sets !== undefined ? 'modified' : 'done')
      if ((o.actualSport !== undefined && !ENDURANCE_SPORTS.includes(actualSport as EnduranceSport)) || (spontaneous && (s.sport === 'strength' || status === 'skipped'))) throw new Error(t.invalid)
      if (!['done', 'skipped', 'modified'].includes(status) || (o.km !== undefined && o.meters !== undefined) || (o.minutes !== undefined && o.time !== undefined)) throw new Error(t.invalid)
      const durationSec = typeof o.time === 'string' ? parseTime(o.time) : o.minutes !== undefined ? number(o.minutes, 0, 3000) * 60 : undefined
      const distanceM = o.meters !== undefined ? number(o.meters, 0, 2e6) : o.km !== undefined ? number(o.km, 0, 2000) * 1000 : undefined
      const testTimeSec = o.testTime === undefined ? undefined : parseTime(o.testTime)
      if (testTimeSec !== undefined && (s.sport !== 'run' || spontaneous || status === 'skipped' || !(s.purpose === 'race' || s.legacyWorkout?.kind === 'test') || (durationSec !== undefined && testTimeSec > durationSec))) throw new Error(t.invalid)
      const rpe = o.rpe === undefined ? undefined : number(o.rpe, 1, 10)
      if ((rpe !== undefined && !Number.isInteger(rpe)) || (status === 'skipped' && ((durationSec ?? 0) > 0 || (distanceM ?? 0) > 0))) throw new Error(t.invalid)
      const activityIds = o.activity?.split(',').map(id=>id.trim()).filter(Boolean)
      const completedRepeats = o.sets === undefined ? undefined : o.sets.split(',').map(value=>{
        const match=/^(\d+)=(\d+)$/.exec(value.trim())
        if (!match) throw new Error(`${t.invalid} ${t.sets}`)
        const step=Number(match[1]), repeats=Number(match[2])
        if (s.sport!=='swim' || actualSport!=='swim' || status==='skipped' || step<1 || step>s.steps.length || repeats>1000) throw new Error(`${t.invalid} ${t.sets}`)
        return {step,repeats}
      })
      if (completedRepeats && new Set(completedRepeats.map(x=>x.step)).size!==completedRepeats.length) throw new Error(`${t.invalid} ${t.sets}`)
      if (activityIds?.length) {
        if (status === 'skipped') throw new Error(t.invalid)
        const evidence = activityEvidence(activities), selected = new Set<string>(), latest = [...new Map(logs.map(l=>[l.sessionId,l])).values()]
        for (const id of activityIds) {
          const a=resolveActivity(activities,id)
          if (!a || a.date !== s.date || sportOf(a.type) !== actualSport || a.dataWithheld) throw new Error(t.invalid)
          const aliases=evidence.find(e=>e.aliases.includes(activityKey(a)))!.aliases
          if (aliases.some(alias=>selected.has(alias))) throw new Error(t.invalid)
          if (latest.some(l=>l.sessionId!==s.id && l.activityIds?.some(bound=>{const other=resolveActivity(activities,bound);return other && aliases.includes(activityKey(other))}))) throw new Error(t.invalid)
          for (const alias of aliases) selected.add(alias)
        }
        for (let i=0;i<activityIds.length;i++) activityIds[i]=activityKey(resolveActivity(activities,activityIds[i]!)!)
      }
      if (spontaneous && !(durationSec !== undefined && durationSec > 0) && !(durationSec === undefined && activityIds?.length && activityIds.every(id=>(resolveActivity(activities,id)?.movingTimeSec ?? 0)>0))) throw new Error(`${t.invalid} ${t.minutes}`)
      const entry: SessionLog = { schemaVersion: 2, sessionId: s.id, date: s.date, sport: actualSport as SessionLog['sport'], ...(spontaneous ? {plannedSport:s.sport} : {}), status: status as SessionLog['status'], loggedAt: new Date().toISOString(), ...(durationSec !== undefined ? { durationSec } : {}), ...(distanceM !== undefined ? { distanceM } : {}), ...(testTimeSec !== undefined ? { testTimeSec } : {}), ...(rpe !== undefined ? { rpe } : {}), ...(o.note ? { note: o.note } : {}), ...(activityIds?.length ? { activityIds } : {}) }
      if (completedRepeats) entry.completedRepeats = completedRepeats
      const before = readOptional(cwd, LOG_FILE) ?? ''
      writeTransaction(cwd, { [LOG_FILE]: before + (before && !before.endsWith('\n') ? '\n' : '') + JSON.stringify(entry) + '\n' })
      return commitResult(cwd, o, sportsResult([b.success(t.logged), b.text(`${s.id}: ${status}`), ...(spontaneous ? [b.info(t.spontaneous)] : [])], { entry, applied: true }), [LOG_FILE], action)
    }
    if (action === 'replace') {
      const s = select(plan, o); editable(cwd, plan, s)
      const target = o.toSport as EnduranceSport
      if (o.variant && !['quality','endurance'].includes(o.variant)) throw new Error(t.invalid)
      if (o.restore && (o.toSport || o.minutes !== undefined || o.variant)) throw new Error(t.invalid)
      if (!o.restore && !ENDURANCE_SPORTS.includes(target)) throw new Error(`${t.invalid} --to-sport run|bike|swim`)
      const next = o.restore ? restoreSportSession(plan, config, s.id, o.reason) : replaceSportSession(plan, config, s.id, target, o.minutes === undefined ? undefined : number(o.minutes, 5, 1440), o.reason, { asOf: today, execution: buildSessionExecution(plan, activities, logs, today), ...(o.variant ? { variant: o.variant } : {}) })
      change(next, action, [s.id, next.replacements.at(-1)!.targetId]); checked(next, config)
      const replacement = next.replacements.at(-1)!, week = mondayOf(s.date)
      replacement.at = today
      const before = plan.sessions.filter(x=>mondayOf(x.date)===week), after = next.sessions.filter(x=>mondayOf(x.date)===week)
      const beforeTotals = sportsTotals(before), afterTotals = sportsTotals(after)
      replacement.impact = {week, sports:[...ENDURANCE_SPORTS,'strength' as const].map(sport=>({sport,beforeMinutes:beforeTotals[sport]!.minutes,afterMinutes:afterTotals[sport]!.minutes,deltaMinutes:afterTotals[sport]!.minutes-beforeTotals[sport]!.minutes,beforeDistanceM:beforeTotals[sport]!.distanceM,afterDistanceM:afterTotals[sport]!.distanceM})),beforeOccupiedMinutes:calendarMinutes(before,plan.groups),afterOccupiedMinutes:calendarMinutes(after,next.groups)}
      const impact = replacement.impact
      return proposed(cwd, action, next, [`${t.before}: ${sessionText(s)}`, `${t.after}: ${sessionText(next.sessions.find(x => x.id === replacement.targetId)!)}`, ...replacement.tradeoffs,
        `${t.weekImpact}: ${week}`, ...impact.sports.filter(x=>x.beforeMinutes || x.afterMinutes).map(x=>`${t.sport[x.sport]}: ${x.beforeMinutes.toFixed(1)} → ${x.afterMinutes.toFixed(1)} min (${t.delta}: ${x.deltaMinutes.toFixed(1)} min); ${x.beforeDistanceM} → ${x.afterDistanceM} m`), `${t.budget}: ${impact.beforeOccupiedMinutes.toFixed(1)} → ${impact.afterOccupiedMinutes.toFixed(1)} min`, t.goalImpact], o)
    }
    if (action === 'shorten') {
      const s = select(plan, o); editable(cwd, plan, s)
      const next = structuredClone(plan), replacement = shortenSportSession(s, number(o.minutes, 1, 1440))
      next.sessions = next.sessions.map(x => x.id === s.id ? replacement : x); change(next, action, [s.id]); checked(next, config)
      return proposed(cwd, action, next, [`${t.before}: ${sessionText(s)}`, `${t.after}: ${sessionText(replacement)}`], o)
    }
    if (action === 'shift') {
      const s = select(plan, { ...o, date: o.from ?? o.date }); editable(cwd, plan, s)
      if (!o.to) throw new Error(t.invalid)
      parseIso(o.to); if (o.to < today || o.to > addDays(plan.goal.date, 7)) throw new Error(t.protected)
      const ids = s.groupId ? plan.groups.find(g => g.id === s.groupId)!.sessionIds : [s.id]
      for (const id of ids) editable(cwd, plan, plan.sessions.find(s => s.id === id)!)
      const next = structuredClone(plan)
      for (const x of next.sessions) if (ids.includes(x.id)) { x.date = o.to; x.approved = true }
      checked(next, config); change(next, action, ids); writeSportsPlan(cwd, next)
      return commitResult(cwd, o, sportsResult([b.success(t.shifted)], { plan: next, applied: true }), [PLAN_YAML, PLAN_MD], action)
    }
    if (action === 'reschedule') {
      const next = structuredClone(plan)
      for (const value of Array.isArray(o.time) ? o.time : []) {
        const [day, minutes] = value.split('='); parseIso(day!); next.timeBudgets ??= {}; next.timeBudgets[day!] = number(minutes)
      }
      for (const id of o.pin ?? []) { const s = next.sessions.find(s => s.id === id); if (!s) throw new Error(t.noSession); s.pinned = true }
      const blocked = o.block ?? []; for (const d of blocked) parseIso(d)
      if (o.strategy && !['long','quality'].includes(o.strategy)) throw new Error(t.invalid)
      if (o.preparation !== undefined) {
        const seconds = number(o.preparation,0,180)*60, fixed = protectedSessions(cwd,plan)
        for (const s of next.sessions) if (s.date >= date && mondayOf(s.date) === mondayOf(date) && !fixed.has(s.id) && (!o.sport || s.sport === o.sport)) s.preparationSec = seconds
      }
      const result = rescheduleSportsPlan(next, config, date < today ? today : date, blocked, protectedSessions(cwd, plan), o.strategy as 'long' | 'quality' | undefined)
      change(result, action, result.sessions.filter(s => fingerprint(s) !== fingerprint(plan.sessions.find(x => x.id === s.id))).map(s => s.id))
      checked(result, config)
      if (o.apply === true) { writeSportsPlan(cwd, result); return commitResult(cwd, o, sportsResult([b.success(t.applied)], { plan: result, applied: true }), [PLAN_YAML, PLAN_MD], action) }
      return proposed(cwd, action, result, [t.budget], o)
    }
    if (action === 'adapt') return adapt(cwd, plan, config, o)
    if (action === 'review') {
      const from = addDays(date, -number(o.days ?? 14, 1, 730))
      const records = execution.filter(e => e.date >= from)
      const actual = Object.fromEntries([...ENDURANCE_SPORTS,'strength'].map(sport=>{ const rows=records.filter(e=>e.sport===sport); return [sport,{done:rows.filter(e=>e.status==='done').length,missed:rows.filter(e=>e.status==='missed').length,unknown:rows.filter(e=>e.status==='unknown').length,minutes:rows.filter(e=>e.status==='done'&&e.durationSec!==undefined).reduce((n,e)=>n+e.durationSec!/60,0),distanceM:rows.filter(e=>e.status==='done'&&e.distanceM!==undefined).reduce((n,e)=>n+e.distanceM!,0)}] }))
      const substitutions = [
        ...plan.replacements.filter(r=>r.at>=from&&r.at<=date).map(r=>({source:'plan',sourceId:r.sourceId,targetId:r.targetId,operation:r.operation??'replace',fromSport:plan.archive.find(s=>s.id===r.sourceId)!.sport,toSport:[...plan.sessions,...plan.archive].find(s=>s.id===r.targetId)!.sport})),
        ...records.filter(e=>e.spontaneous).map(e=>({source:'journal',sourceId:e.sessionId,targetId:e.sessionId,operation:'performed',fromSport:e.plannedSport!,toSport:e.sport})),
      ]
      const result = sportsResult([b.title(t.review), b.table(['ID', t.plannedSport, t.performedSport, 'Date', 'Status',t.rpe,t.note], records.map(e => [e.sessionId, t.sport[e.plannedSport??e.sport], t.sport[e.sport], e.date, t[e.status]+(e.replacement?` · ${t.replaced}`:''), e.rpe?.toString()??'',e.note??''])), ...(records.some(e=>e.candidates?.length) ? [b.info(t.noAutoMatch)] : []), ...(records.some(e=>e.spontaneous) ? [b.info(t.spontaneous)] : []), b.info(`${t.substitutionHistory}: ${substitutions.length}`)], { execution: records, actual, substitutions, totals: sportsTotals(plan.sessions.filter(s => s.date >= from && s.date <= date)) })
      for (const e of records.filter(e=>e.completedRepeats)) result.blocks.push(b.info(`${e.sessionId} · ${t.sets}: ${e.completedRepeats!.map(x=>`${x.step}=${x.repeats}`).join(',')}`))
      if (substitutions.length) result.blocks.push(b.table([t.source,t.before,t.after,t.action],substitutions.map(s=>[s.sourceId,t.sport[s.fromSport],t.sport[s.toSport],s.operation])))
      result.blocks.push(...volumeBlocks(plan.sessions.filter(s=>s.date>=from&&s.date<=date)))
      result.output = renderPlain(result.blocks)
      if (o.prepare) { const proposal = adapt(cwd, plan, config, o); result.blocks.push(...proposal.blocks); result.output = renderPlain(result.blocks); result.data.adaptation = proposal.data; result.code = proposal.code }
      return result
    }
    if (action === 'export') return exportSportsPlan(cwd, plan, o)
    if (action === 'check') {
      const issues = [...validateSportsPlan(plan), ...calendarIssues(plan, config, today)]
      return sportsResult([b.title(t.checks), ...(issues.length ? issues.map(i => b.error(i)) : [b.success(t.valid)]), ...plan.warnings.map(w => b.warn(w))], { issues, warnings: plan.warnings }, issues.length || (o.strict && plan.warnings.some(w => w !== t.engineering)) ? 1 : 0)
    }
    if (action === 'diff') {
      if (o.plan) {
        const other = parse(readFileSync(resolve(cwd,o.plan),'utf8')) as SportsPlan
        const issues = validateSportsPlan(other); if(issues.length)throw new Error(issues.join('\n'))
        const before = new Map(plan.sessions.map(s=>[s.id,s])), after = new Map(other.sessions.map(s=>[s.id,s]))
        const differences = [...new Set([...before.keys(),...after.keys()])].filter(id=>fingerprint(before.get(id)??null)!==fingerprint(after.get(id)??null)).map(id=>({id,before:before.get(id)??null,after:after.get(id)??null}))
        return sportsResult([b.table(['ID',t.before,t.after],differences.map(d=>[d.id,d.before?sessionText(d.before):'—',d.after?sessionText(d.after):'—']))],{changed:!!differences.length||fingerprint(plan.goal)!==fingerprint(other.goal),differences,goals:{before:plan.goal,after:other.goal},totals:{before:sportsTotals(plan.sessions),after:sportsTotals(other.sessions)}})
      }
      return generate(cwd, config, o, true)
    }
    throw new Error(`${t.unsupported} ${action}`)
  } catch (e) { return sportsFailure(e) }
}

function generate(cwd: string, config: SportsConfig, o: SportsOptions, preview = false): SportsResult {
  const t = msg(), date = o.date ?? clockToday(), existing = readOptional(cwd, PLAN_YAML) ? loadSportsPlan(cwd) : undefined
  const changedGoal = existing && fingerprint(existing.goal) !== fingerprint(config.goal)
  if (changedGoal && !o.fresh) throw new Error(t.changedGoal)
  if (o.fresh && existing && !changedGoal) throw new Error(t.noFresh)
  const id = existing?.id ?? randomUUID(), cycleId = !changedGoal && existing ? existing.cycleId : `c-${randomUUID().slice(0, 8)}`
  const effectiveConfig = structuredClone(config)
  for (const sport of ENDURANCE_SPORTS) {
    const baseline = existing?.baselines?.[sport], profile = effectiveConfig.athlete.sports[sport]
    if (profile && baseline && baseline.profileWeeklyMinutes === profile.weeklyMinutes) profile.weeklyMinutes = baseline.weeklyMinutes
  }
  let next = generateSportsPlan(effectiveConfig, !changedGoal && existing ? existing.generatedAt : date, id, cycleId, packageVersion(), date)
  const retained = new Set<string>()
  const initial = !existing ? initialRunning(config,date,cycleId) : undefined
  if (initial) {
    const eventDates = new Set(next.sessions.filter(s=>s.purpose==='race' && (config.goal.kind==='multisport' || s.racePriority!=='A')).map(s=>s.date))
    next.sessions = [...next.sessions.filter(s=>(s.sport!=='run'&&s.sport!=='strength') || (s.purpose==='race'&&eventDates.has(s.date))),...initial.sessions.filter(s=>!eventDates.has(s.date))]
    next.groups = next.groups.filter(g=>g.sessionIds.every(id=>next.sessions.some(s=>s.id===id)))
    next.legacy=initial.legacy
  }
  next.generatedSessions = Object.fromEntries(next.sessions.map(s => [s.id, fingerprint(s)]))
  if (existing) {
    const fixed = protectedSessions(cwd, existing)
    for (const s of existing.sessions) if (s.approved || (existing.generatedSessions[s.id] && existing.generatedSessions[s.id] !== fingerprint(s))) fixed.add(s.id)
    for (const g of existing.groups) if (g.sessionIds.some(id => fixed.has(id))) for (const id of g.sessionIds) fixed.add(id)
    for (const s of existing.sessions) if (s.purpose === 'race' && s.racePriority && s.racePriority !== 'A' && s.date >= date && !s.approved && !next.sessions.some(x=>x.id===s.id) && !readSessionLogs(cwd).some(l=>l.sessionId===s.id)) fixed.delete(s.id)
    if (changedGoal) for (const s of existing.sessions) if (s.purpose === 'race' && s.date >= date && !s.approved) fixed.delete(s.id)
    const running = regenerateRunning(existing, config, date, fixed, cycleId)
    if (running) {
      const eventDates = new Set(next.sessions.filter(s=>s.purpose==='race' && (config.goal.kind==='multisport' || s.racePriority!=='A')).map(s=>s.date))
      next.sessions = [...next.sessions.filter(s=>(s.sport!=='run'&&s.sport!=='strength') || (s.purpose==='race'&&eventDates.has(s.date))),...running.sessions.filter(s=>!eventDates.has(s.date))]
      next.groups = next.groups.filter(g => g.sessionIds.every(id => next.sessions.some(s => s.id === id)))
      next.generatedSessions = Object.fromEntries(next.sessions.map(s => [s.id, fingerprint(s)]))
      next.legacy = { ...existing.legacy!, cycleId, generatorPlan: running.generatorPlan }
    }
    const retired = new Set(existing.retiredSessionIds ?? [])
    const ancestors = new Set(existing.archive.filter(s => !retired.has(s.id)).map(s => s.id))
    const kept = existing.sessions.filter(s => fixed.has(s.id))
    for (const s of kept) retained.add(s.id)
    next.sessions = [...next.sessions.filter(s => !fixed.has(s.id) && !ancestors.has(s.id) && s.date >= date), ...kept]
    const activeIds = new Set(next.sessions.map(s => s.id))
    const withdrawn = existing.sessions.filter(s => !activeIds.has(s.id))
    next.archive = [...existing.archive.filter(s => !activeIds.has(s.id)), ...withdrawn]
    if (!changedGoal) for (const s of withdrawn) retired.add(s.id)
    next.retiredSessionIds = [...retired].filter(id => !activeIds.has(id))
    next.replacements = existing.replacements; next.changes = existing.changes
    next.groups = [...next.groups.filter(g => !existing.groups.some(x => x.id === g.id && x.sessionIds.some(id => fixed.has(id)))), ...existing.groups.filter(g => g.sessionIds.every(id => next.sessions.some(s => s.id === id)))]
    next.groups = [...new Map(next.groups.map(g => [g.id, g])).values()]
    if (existing.legacy && !next.legacy) next.legacy = existing.legacy
    if (existing.timeBudgets) next.timeBudgets = existing.timeBudgets
    if (existing.blockedDates) next.blockedDates = existing.blockedDates
    if (existing.baselines) next.baselines = existing.baselines
    for (const s of kept) if (existing.generatedSessions[s.id]) next.generatedSessions[s.id] = existing.generatedSessions[s.id]!
  }
  if (changedGoal) change(next, 'goal', next.sessions.filter(s => s.date >= date).map(s => s.id))
  next.sessions.sort((a, b) => a.date.localeCompare(b.date) || (a.start ?? '').localeCompare(b.start ?? '') || a.id.localeCompare(b.id))
  if (calendarIssues(next, config, date).length) {
    const approvals = new Map(next.sessions.map(s=>[s.id,s.approved]))
    const fixed = existing ? protectedSessions(cwd, existing) : new Set<string>()
    for (const s of next.sessions) if (s.approved) fixed.add(s.id)
    for (const week of [...new Set(next.sessions.filter(s => s.date >= date).map(s => mondayOf(s.date)))]) next = rescheduleSportsPlan(next, config, week < date ? date : week, next.blockedDates ?? [], fixed)
    // A generator calendar correction is not an explicit user approval.
    for (const s of next.sessions) if (!retained.has(s.id) && approvals.get(s.id) === undefined) delete s.approved
  }
  for (const s of next.sessions) if (!retained.has(s.id)) next.generatedSessions[s.id] = fingerprint(s)
  checked(next, config)
  const changed = !existing || fingerprint({ sessions: existing.sessions, goal: existing.goal, groups: existing.groups }) !== fingerprint({ sessions: next.sessions, goal: next.goal, groups: next.groups })
  if (preview) return sportsResult([b.info(changed ? t.written : t.unchanged)], { changed, plan: next })
  if (changed) writeSportsPlan(cwd, next)
  return commitResult(cwd, o, sportsResult([b.success(changed ? t.written : t.unchanged), ...next.warnings.map(w => b.warn(w))], { plan: changed ? next : existing, changed, applied: changed }), [PLAN_YAML, PLAN_MD], 'plan')
}

function adapt(cwd: string, plan: SportsPlan, config: SportsConfig, o: SportsOptions): SportsResult {
  const t = msg(), date = o.date ?? clockToday(), boundary = mondayOf(date), from = addDays(boundary, -14)
  const records = buildSessionExecution(plan, readSnapshot(cwd)?.activities ?? [], readSessionLogs(cwd), addDays(boundary, -1)).filter(e => e.date >= from)
  const next = structuredClone(plan), protectedIds = protectedSessions(cwd, plan), notes: string[] = []
  for (const sport of ENDURANCE_SPORTS) {
    const profile = config.athlete.sports[sport], history = plan.sessions.filter(s => s.sport === sport && s.date >= from && s.date < boundary)
    if (!profile || !history.length) continue
    const rows = history.map(s => records.find(e => e.sessionId === s.id))
    if (rows.some(r=>r?.spontaneous)) { notes.push(`${t.sport[sport]}: ${t.substitutionAdapt}`); continue }
    if (rows.some(r => !r || r.status === 'unknown' || (r.status === 'done' && r.durationSec === undefined))) { notes.push(`${t.sport[sport]}: ${t.incomplete}`); continue }
    const actual = rows.reduce((n, r) => n + (r!.status === 'missed' ? 0 : r!.durationSec ?? 0), 0)
    const planned = history.reduce((n, s) => n + s.durationSec, 0), ratio = Math.min(1, actual / planned)
    if (ratio >= 0.95 || ratio < 0.25) { notes.push(`${t.sport[sport]}: ${t.noChanges}`); continue }
    for (let i = 0; i < next.sessions.length; i++) {
      const s = next.sessions[i]!
      if (s.sport !== sport || s.date < date || protectedIds.has(s.id) || s.approved || s.groupId) continue
      try { next.sessions[i] = shortenSportSession(s, (s.durationSec * ratio + s.preparationSec) / 60); next.sessions[i]!.ruleRefs = [...new Set([...s.ruleRefs, 'MS-3'])] } catch { notes.push(`${t.noFit} ${s.id}`) }
    }
    next.baselines ??= {}; next.baselines[sport] = { weeklyMinutes: Math.max(10, Math.floor((plan.baselines?.[sport]?.weeklyMinutes ?? profile.weeklyMinutes) * ratio)), profileWeeklyMinutes: profile.weeklyMinutes }
    notes.push(`${t.sport[sport]}: ${Math.round(ratio * 100)}% · MS-3`)
  }
  if (fingerprint(next.sessions) === fingerprint(plan.sessions)) return sportsResult([b.info(t.noChanges), ...notes.map(n => b.info(n))], { changed: false })
  change(next, 'adapt', next.sessions.filter(s => fingerprint(s) !== fingerprint(plan.sessions.find(x => x.id === s.id))).map(s => s.id)); checked(next, config)
  return proposed(cwd, 'adapt', next, [t.adaptation, ...notes], o)
}
