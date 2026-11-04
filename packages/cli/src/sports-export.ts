import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { sportMessages as msg, type SportsPlan } from 'trainctl-core'
import { encodeSessionFit, sessionsToHtml } from 'trainctl-export'
import { b, renderPlain, type Block } from './ui/blocks.ts'
import { sessionText } from './sports-store.ts'
import { runningRacePackHtml } from './export.ts'
import type { StoredPlan } from './planfile.ts'
import type { SportsOptions, SportsResult } from './sports-commands.ts'
import { exportSportsCalendar } from './sports-calendar.ts'

export function exportSportsPlan(cwd: string, plan: SportsPlan, opts: SportsOptions): SportsResult {
  const what = ({ plan:'fit', workout:'fit', calendar:'ics', race:'racepack' } as Record<string,string>)[opts.what ?? ''] ?? opts.what ?? 'all', files: string[] = [], blocks: Block[] = [], errors: string[] = []
  if (!['all', 'fit', 'ics', 'html', 'print', 'mobile', 'racepack'].includes(what)) throw new Error(msg().exportUnsupported)
  const selected = { ...plan, sessions: plan.sessions.filter(s => (!opts.date || s.date === opts.date) && (!opts.session || s.id === opts.session) && (!opts.sport || s.sport === opts.sport)) }
  if ((opts.date || opts.session) && !selected.sessions.length) throw new Error(msg().noSession)
  mkdirSync(join(cwd, 'export'), { recursive: true })
  if (what === 'all' || what === 'fit') {
    // Pre-encode before writing; a failed session is explicitly reported, never exported as running.
    const encoded: { file: string; bytes: Uint8Array }[] = []
    for (const s of selected.sessions.filter(s => s.sport !== 'strength')) {
      try { encoded.push({ file: `export/${s.id}.fit`, bytes: encodeSessionFit(s, `${s.sport} ${s.purpose}`) }) }
      catch (e) { errors.push(`${s.id}: ${e instanceof Error ? e.message : String(e)}`) }
    }
    if (!errors.length) {
      for (const { file, bytes } of encoded) { writeFileSync(join(cwd, file), bytes); files.push(file) }
      const manifest = join(cwd, 'export/manifest.json')
      const previous: string[] = existsSync(manifest) ? JSON.parse(readFileSync(manifest, 'utf8')).files ?? [] : []
      const full = !opts.date && !opts.session && !opts.sport
      const archived = new Set(plan.archive.map(s => `export/${s.id}.fit`))
      const stale = previous.filter(f => /^export\/[A-Za-z0-9_-]+\.fit$/.test(f) && !files.includes(f) && (full || archived.has(f)))
      for (const file of stale) if (existsSync(join(cwd, file))) rmSync(join(cwd, file))
      writeFileSync(manifest, JSON.stringify({ files: [...new Set([...previous.filter(f => !stale.includes(f)), ...files.filter(f => f.endsWith('.fit'))])] }, null, 2) + '\n')
    }
    if (selected.sessions.some(s => s.sport === 'swim' && s.steps.some(x => x.stroke && x.target.kind === 'pace'))) blocks.push(b.warn(msg().swimFitPace))
  }
  if (what === 'all' || what === 'ics') files.push(exportSportsCalendar(cwd, selected))
  if (['all', 'html', 'print', 'mobile', 'racepack'].includes(what)) {
    const file = `export/${what === 'racepack' ? 'racepack' : 'plan'}.html`
    const running = (plan.legacy?.generatorPlan ?? plan.legacy?.plan) as StoredPlan | undefined
    const useRunning = what === 'racepack' && plan.goal.kind === 'race' && plan.goal.sport === 'run' && running?.goal.kind !== 'base' && running?.goal.date === plan.goal.date && running.goal.distanceKm * 1000 === plan.goal.distanceM
    const html = useRunning ? runningRacePackHtml(running!) : sessionsToHtml(what === 'racepack' ? { ...selected, sessions: selected.sessions.filter(s => s.purpose === 'race') } : selected, sessionText)
    writeFileSync(join(cwd, file), html); files.push(file)
  }
  blocks.push(...files.map(f => b.success(`${msg().exported} ${f}`)), ...errors.map(e => b.error(e)))
  return { code: errors.length ? 1 : 0, output: renderPlain(blocks), blocks, data: { files, errors } }
}
