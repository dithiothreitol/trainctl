import { activityKey, addDays, parseIso, targetText, sportMessages as msg, type PushableWorkout, type SportsPlan, type StepTarget, type TrainingSession } from 'trainctl-core'
import { FileActivitySource } from 'trainctl-sync-files'
import { resolve } from 'node:path'
import { readSyncFiles } from './config.ts'
import { b } from './ui/blocks.ts'
import { clockToday } from './clock.ts'
import { chooseSource, readSnapshot, SYNC_FILE, type ProviderFactory } from './sync.ts'
import { loadSportsConfig, loadSportsPlan, sessionText, writeTransaction } from './sports-store.ts'
import { sportsCommand, sportsFailure, sportsResult, type SportsOptions, type SportsResult } from './sports-commands.ts'

export const sessionExternalId = (p: SportsPlan, s: TrainingSession): string => `trainctl-${p.id}-${s.id}`
export function pushableSession(p: SportsPlan, s: TrainingSession): PushableWorkout {
  if (s.steps.some(x => x.sendoffSec !== undefined)) throw new Error(`${msg().exportUnsupported} ${s.id}`)
  const lines: string[] = [sessionText(s), '']
  // E1: bieg z planu biegowego też z kroków; zakres tempa jako środek, jak składnia planu biegowego
  const paceText = (target: Extract<StepTarget, { kind: 'pace' }>) =>
    `${targetText({ kind: 'pace', perM: target.perM, seconds: target.slowSeconds !== undefined ? (target.seconds + target.slowSeconds) / 2 : target.seconds }).replace('100 m','100m')} Pace`
  for (const step of s.steps) {
    const target = step.target
    const pace = target.kind === 'pace' ? paceText(target) : ''
    const dose = step.distanceM ? `${step.distanceM}mtr` : `${step.durationSec}s`
    if ((step.repeat ?? 1) > 1) lines.push('', `${step.repeat}x`)
    lines.push(`- ${step.stroke ?? (s.sport === 'run' && step.name ? step.name : step.role)} ${dose}${target.kind === 'power' ? ` ${target.watts}w` : pace ? ` ${pace}` : ''}`)
    if (step.restSec) {
      const recovery=step.recovery?.target
      const recoveryTarget=recovery?.kind==='power'?` ${recovery.watts}w`:recovery?.kind==='pace'?` ${paceText(recovery)}`:''
      lines.push(`- Rest ${step.recovery?.distanceM ? `${step.recovery.distanceM}mtr` : `${step.restSec}s`}${recoveryTarget}`)
    }
    lines.push('')
  }
  return { externalId: sessionExternalId(p, s), date: s.date, ...(s.start ? { startTime: s.start } : {}), name: `${msg().sport[s.sport]} · ${s.coaching?.title ?? msg().purpose[s.purpose]}`, description: lines.join('\n'), sport: s.sport, durationSec: s.durationSec, ...(s.distanceM ? { distanceKm: s.distanceM / 1000 } : {}), ...(s.purpose === 'race' ? { race: { priority: s.racePriority ?? 'A' } } : {}) }
}
export async function sportsSyncCommand(cwd: string, action: 'pull' | 'push' | 'review', opts: SportsOptions, factory: ProviderFactory): Promise<SportsResult> {
  try {
    loadSportsConfig(cwd)
    const p = loadSportsPlan(cwd), date = opts.date ?? clockToday(), days = Number(opts.days ?? 14)
    parseIso(date)
    if (!Number.isInteger(days) || days < 1 || days > 730) throw new Error(msg().invalid)
    if (action === 'push') {
      const from = opts.from ?? date, to = opts.to ?? addDays(from, days); parseIso(from); parseIso(to)
      if (from > to) throw new Error(msg().invalid)
      const sessions = p.sessions.filter(s => s.date >= from && s.date <= to)
      const workouts = sessions.map(s => pushableSession(p, s)), provider = factory(cwd)
      const result = await provider.pushWorkouts(workouts)
      if (workouts.some(w => !result.externalIds.includes(w.externalId))) return sportsResult([b.error(msg().syncFailed), ...(result.warnings ?? []).map(w => b.warn(w))], { result }, 1)
      // Publish ALL replacements successfully before attempting any deletion. A retry is idempotent.
      const expected = new Set(workouts.map(w => w.externalId))
      const owned = new Set([...p.sessions, ...p.archive].flatMap(s => [sessionExternalId(p, s), ...(s.externalId ? [s.externalId] : [])]))
      const remote = await provider.listPlannedWorkouts(from, to), deleted: string[] = []
      for (const r of remote) if (r.externalId?.startsWith('trainctl-') && owned.has(r.externalId) && !expected.has(r.externalId)) { await provider.deleteWorkout(r.id); deleted.push(r.id) }
      return sportsResult([b.success(`${msg().sync}: ${result.pushed}`), ...(result.warnings ?? []).map(w => b.warn(w))], { result, deleted })
    }
    let choice = chooseSource(cwd, opts.from, factory)
    const filePath = opts.from ?? (choice?.kind === 'files' ? readSyncFiles(cwd) : undefined)
    if (filePath) {
      const source = new FileActivitySource({ path: resolve(cwd, filePath), preserveParts: true })
      choice = { source, kind: 'files', label: resolve(cwd, filePath), skipped: () => source.lastSkipped }
    }
    const notes: string[] = []
    if (choice) {
      try {
        const from = addDays(date, -Math.max(days, action === 'review' ? 21 : days))
        const [activities, wellness] = await Promise.all([choice.source.listActivities(from, date), choice.source.listWellness(from, date)])
        const previous = readSnapshot(cwd), sourceId = `${choice.kind}:${choice.label}`
        const merged = new Map((previous?.activities ?? []).filter(a => a.importSource !== sourceId || a.date < from || a.date > date).map(a => [activityKey(a), a]))
        for (const a of activities) merged.set(activityKey({ ...a, importSource: sourceId }), { ...a, importSource: sourceId })
        const snapshot = { pulledAt: new Date().toISOString(), from, to: date, activities: [...merged.values()], wellness: [...(previous?.wellness ?? []).filter(w => w.date < from || w.date > date), ...wellness] }
        writeTransaction(cwd, { [SYNC_FILE]: JSON.stringify(snapshot, null, 2) + '\n' })
        notes.push(msg().snapshot, ...choice.skipped().map(s => `${s.file}: ${s.reason}`))
      } catch (e) { if (action === 'pull') throw e; notes.push(`${msg().syncFailed} ${e instanceof Error ? e.message : String(e)}`) }
    } else if (action === 'pull') throw new Error(`${msg().invalid} --from / sync.files`)
    const review = sportsCommand(cwd, 'review', opts)
    return sportsResult([...notes.map(n => b.info(n)), ...review.blocks], { ...review.data, snapshot: readSnapshot(cwd) }, review.code)
  } catch (e) { return sportsFailure(e) }
}
