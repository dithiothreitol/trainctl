/**
 * `trainctl status` — jeden ekran stanu katalogu treningowego.
 *
 * Read-only. Odpowiada na pytania, które dziś wymagały kilku komend albo
 * zaglądania do plików: czy profil się waliduje, z której wersji silnika jest
 * plan, skąd jest klucz i czy `.env` jest chroniony, kiedy był ostatni pull,
 * które propozycje są jeszcze ważne i co nie trafiło do gita.
 */
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { diffDays, messages, mondayOf } from 'trainctl-core'
import { CONFIG_FILE, loadConfig, readConfigLanguage } from './config.ts'
import { ENV_FILE, inspectEnvFile } from './env-file.ts'
import { buildExecution } from './execution.ts'
import { uncommitted } from './git.ts'
import { ui } from './i18n/index.ts'
import { LOG_FILE, readLog } from './logfile.ts'
import { cycleWeeksOf, loadPlanIfUsable, PLAN_DIR, PLAN_YAML, type StoredPlan } from './planfile.ts'
import { listProposals } from './proposals.ts'
import { readSnapshot, SECRET_FILE, SYNC_FILE } from './sync.ts'
import { b, renderPlain, type Block } from './ui/blocks.ts'
import { clockToday } from './clock.ts'
import { packageVersion } from './version.ts'

const KEY_ENV = 'TRAINCTL_INTERVALS_API_KEY'

export interface StatusResult {
  output: string
  code: number
  blocks: Block[]
  data: Record<string, unknown>
}

export function cmdStatus(cwd: string): StatusResult {
  const t = ui().status
  const today = clockToday()
  const blocks: Block[] = [b.title(t.title, cwd)]
  const next: string[] = []

  // profil
  let configErrors: string | undefined
  const hasConfig = existsSync(join(cwd, CONFIG_FILE))
  if (hasConfig) {
    try {
      loadConfig(cwd)
    } catch (e) {
      configErrors = e instanceof Error ? e.message : String(e)
    }
  }
  blocks.push(b.section(t.profile), b.kv([
    [CONFIG_FILE, !hasConfig ? t.missing : configErrors ? t.invalid : t.ok],
    [t.language, readConfigLanguage(cwd) ?? 'en'],
  ]))
  if (configErrors) blocks.push(b.warn(configErrors))
  if (!hasConfig) next.push('trainctl init')

  // plan
  let plan: StoredPlan | undefined
  let planError: string | undefined
  try {
    plan = loadPlanIfUsable(cwd)
  } catch (e) {
    planError = e instanceof Error ? e.message : String(e)
  }
  const current = packageVersion()
  if (plan) {
    const cycle = cycleWeeksOf(plan)
    const sessions = cycle.reduce((s, w) => s + w.days.filter((d) => d.workout).length, 0)
    const minor = (v: string) => v.split('.').slice(0, 2).join('.')
    blocks.push(b.section(t.plan), b.kv([
      [t.goal, `${plan.goal.name} · ${plan.goal.date} · ${messages().units.kmPerWeek(plan.peakKmPlanned)}`],
      [t.toRace, t.daysToRace(diffDays(today, plan.goal.date))],
      [t.weeks, t.weeksSessions(cycle.length, sessions)],
      [t.generated, plan.generatedAt],
      [t.engine, plan.engineVersion
        ? minor(plan.engineVersion) === minor(current) ? plan.engineVersion : t.engineOther(plan.engineVersion, current)
        : t.engineOld(current)],
      ...(plan.loadState ? ([[t.loadState, t.loadStateValue(plan.loadState.baselineWeeklyKm, plan.loadState.effectiveFrom)]] as [string, string][]) : []),
    ]))
    const selected = plan.calibration?.selected
    blocks.push(b.section(t.calibration), b.text(selected
      ? t.calibrationSelected(selected.date, selected.distanceKm, diffDays(selected.date, today), plan.vdot)
      : plan.vdotSource === 'goal-target' ? t.calibrationFromGoal(plan.vdot) : t.calibrationNone))
  } else {
    blocks.push(b.section(t.plan), b.text(planError ?? (existsSync(join(cwd, PLAN_YAML)) ? t.planUnusable(PLAN_YAML) : t.noPlan)))
    if (hasConfig && !configErrors) next.push('trainctl plan')
  }

  // dane: klucz, synchronizacja, dziennik
  const env = inspectEnvFile(cwd, KEY_ENV)
  const keySource = existsSync(join(cwd, SECRET_FILE))
    ? SECRET_FILE
    : env.hasKey ? ENV_FILE : process.env[KEY_ENV]?.trim() ? t.keyFromEnv : undefined
  const snapshot = readSnapshot(cwd)
  const logs = readLog(cwd)
  const last = logs.at(-1)
  const weekStart = mondayOf(today)
  const unconfirmed = plan
    ? buildExecution(plan, snapshot?.activities ?? [], logs, today)
      .filter((e) => e.status === 'unknown' && e.date >= weekStart && e.date < today).map((e) => e.date)
    : []
  blocks.push(b.section(t.data), b.kv([
    [t.key, keySource ?? t.keyNone],
    ...(env.exists ? ([[ENV_FILE, env.unprotected ? t.envUnprotected : t.envProtected]] as [string, string][]) : []),
    [SYNC_FILE, snapshot
      ? t.syncValue(snapshot.pulledAt, snapshot.activities.length, snapshot.activities.filter((a) => a.dataWithheld).length)
      : t.never],
    [LOG_FILE, last ? t.logValue(logs.length, last.date, last.status) : t.empty],
  ]))
  if (env.unprotected) blocks.push(b.warn(ui().envFile.unprotected(ENV_FILE, '.gitignore')))
  if (unconfirmed.length) blocks.push(b.info(t.unconfirmed(unconfirmed.join(', '))))

  // propozycje
  const proposals = listProposals(cwd)
  if (proposals.length) {
    blocks.push(b.section(t.proposals), b.table(
      [t.columns.id, t.columns.kind, t.columns.for, t.columns.state, t.columns.changes],
      proposals.map((p) => [p.id, p.kind, p.createdFor, t.state[p.state], String(p.changes)]),
      proposals.map((p) => (p.state === 'valid' ? 'success' : 'muted')),
    ))
    const valid = proposals.find((p) => p.state === 'valid')
    if (valid) next.push(`trainctl ${valid.kind === 'shorten' ? 'shorten' : 'adapt'} --apply ${valid.id}`)
  }

  // git
  const dirty = uncommitted(cwd, [CONFIG_FILE, PLAN_DIR, LOG_FILE, 'AGENTS.md'])
  blocks.push(b.section(t.git), b.text(dirty === undefined ? t.noGit : dirty.length ? t.dirty(dirty.join(', ')) : t.clean))
  if (dirty?.length) next.push('git add -A && git commit')

  if (next.length) blocks.push(b.blank(), b.hint(t.next(next.join(' · '))))
  return {
    output: renderPlain(blocks),
    code: 0,
    blocks,
    data: {
      dir: cwd,
      today,
      config: { exists: hasConfig, valid: hasConfig && !configErrors, errors: configErrors ?? null },
      plan: plan
        ? { goal: plan.goal, generatedAt: plan.generatedAt, engineVersion: plan.engineVersion ?? null, cliVersion: current,
          weeks: cycleWeeksOf(plan).length, loadState: plan.loadState ?? null, vdot: plan.vdot,
          calibration: plan.calibration?.selected ?? null }
        : null,
      key: { source: keySource ?? null, envFileUnprotected: env.unprotected },
      sync: snapshot ? { pulledAt: snapshot.pulledAt, from: snapshot.from ?? null, to: snapshot.to ?? null, activities: snapshot.activities.length } : null,
      journal: { entries: logs.length, last: last ?? null, unconfirmedThisWeek: unconfirmed },
      proposals,
      git: dirty === undefined ? null : { uncommitted: dirty },
    },
  }
}
