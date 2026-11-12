/** Session schema v2. Legacy files remain readable through the v1 handlers. */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { parse, stringify } from 'yaml'
import {
  ENDURANCE_SPORTS, addDays, coachingLines, distanceUnit, runningSteps, sessionStepLines, estimateWorkoutMinutes, getLocale, isNotationStyle, isUnits, messages, mondayOf, notationLegend,
  sportMessages as msg, validateSportsConfig, validateSportsPlan,
  type EnduranceSport, type SessionLog, type SportsConfig, type SportsPlan, type TrainingSession,
} from 'trainctl-core'
import { ui } from './i18n/index.ts'
import { rowsTable, seasonTable, sessionRows, sessionsSeasonRows, tableMarkdown } from './ui/rows.ts'
import { CONFIG_FILE, inProfileView, loadConfig, validateConfig, type TrainctlConfig } from './config.ts'
import { PLAN_YAML, PLAN_MD, loadPlan, workoutText } from './planfile.ts'
import { LOG_FILE, readJournal } from './logfile.ts'
import { SYNC_FILE } from './sync.ts'
import { clockToday } from './clock.ts'
import { runningDurationMinutes, runningSessions } from './sports-running.ts'
import { packageVersion } from './version.ts'

import { recoverSportsTransaction, writeTransaction } from './sports-transaction.ts'
export { writeTransaction, recoverSportsTransaction } from './sports-transaction.ts'

export const fingerprint = (value: unknown): string => createHash('sha256').update(JSON.stringify(value)).digest('hex')
/**
 * plan.yaml zapisany przed E3 mógł mieć aliasy YAML (wspólny `legacy.plan` i `generatorPlan`);
 * długi plan przekraczał domyślny limit 100 aliasów parsera. Limit odczytu to wybór inżynierski:
 * plik z katalogu użytkownika, a zapis od E3 aliasów już nie ma.
 */
const PLAN_PARSE = { maxAliasCount: 10_000 }
export const readOptional = (cwd: string, path: string): string | null => existsSync(join(cwd, path)) ? readFileSync(join(cwd, path), 'utf8') : null
export function isSportsWorkspace(cwd: string): boolean {
  recoverSportsTransaction(cwd)
  // Detection must not hide damaged YAML: the selected handler reports the error.
  for (const file of [PLAN_YAML, CONFIG_FILE]) {
    const text = readOptional(cwd, file)
    if (file === CONFIG_FILE && text && /^schemaVersion:\s*(?:[2-9]|\d{2,})\s*$/m.test(text)) return true
    try { const raw = text ? parse(text, PLAN_PARSE) : undefined; if (raw?.schemaVersion >= 2 && (file === CONFIG_FILE || Array.isArray(raw.sessions))) return true } catch { /* reported by loader */ }
  }
  return false
}
export const loadSportsConfig = (cwd: string): SportsConfig => validateSportsConfig(parse(readFileSync(join(cwd, CONFIG_FILE), 'utf8')))
export function loadSportsPlan(cwd: string): SportsPlan {
  const text = readOptional(cwd, PLAN_YAML)
  if (!text) throw new Error(msg().noPlan)
  const p = parse(text, PLAN_PARSE) as SportsPlan
  if (p?.schemaVersion !== 2) throw new Error(msg().migrate)
  const issues = validateSportsPlan(p)
  if (issues.length) throw new Error(issues.join('\n'))
  return upgradeRunningSteps(p)
}

/**
 * E1: bieg zapisany przed E1 ma jeden otwarty krok, a eksporty nie czytają już `legacyWorkout`.
 * Kroki ze struktury biegu liczą się przy odczycie (także sesji zatwierdzonych, których
 * regeneracja nie przepisuje); sesja nietknięta zostaje nietknięta (`generatedSessions`).
 */
export function upgradeRunningSteps(p: SportsPlan): SportsPlan {
  for (const list of [p.sessions, p.archive]) {
    for (let i = 0; i < list.length; i++) {
      const s = list[i]!
      const step = s.steps[0]
      if (s.sport !== 'run' || !s.legacyWorkout || s.steps.length !== 1 || !step || step.role !== 'work' || step.target.kind !== 'open' || step.distanceM !== undefined || (step.repeat ?? 1) !== 1) continue
      const upgraded = { ...s, steps: runningSteps(s.legacyWorkout, s.durationSec) }
      if (p.generatedSessions[s.id] === fingerprint(s)) p.generatedSessions[s.id] = fingerprint(upgraded)
      list[i] = upgraded
    }
  }
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
export function sessionStepsText(s: TrainingSession): string {
  return sessionStepLines(s).join('\n')
}
export function sessionText(s: TrainingSession): string {
  const t = msg(), steps = sessionStepsText(s)
  return [`${t.sport[s.sport]} · ${s.coaching?.title ?? t.purpose[s.purpose]} · ${Math.round(s.durationSec / 6) / 10} min${s.distanceM ? ` · ${s.distanceM} m` : ''}`, ...coachingLines(s), steps].join('\n')
}
const cell = (s: string): string => s.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')
/**
 * PLAN.md planu v2 (C3): siatka sezonu na górze, niżej tygodnie w układzie wiersza
 * z C2, a pod tabelą tygodnia szczegóły każdej sesji (ID, cel, kroki) — plik
 * zachowuje pełny coaching tak jak dotąd.
 */
export function sportsMarkdown(p: SportsPlan): string {
  const t = msg(), m = ui().planMd, r = ui().rows
  const season = sessionsSeasonRows(p.sessions)
  const lines = ['# ' + cell(p.goal.name), '', t.engineering, '', `## ${m.season}`, '', ...tableMarkdown(seasonTable(season, { sessions: true })), '',
    `> ${r.season.legendSessions('↓', season.some(w => w.accents.length > 0))}  `, `> ${notationLegend(distanceUnit())}`]
  for (const monday of [...new Set(p.sessions.map(s => mondayOf(s.date)))].sort()) {
    const week = p.sessions.filter(s => mondayOf(s.date) === monday).sort((a, z) => a.date.localeCompare(z.date) || (a.start ?? '').localeCompare(z.start ?? ''))
    lines.push('', `## ${r.sessionsHeading(r.shortDate(monday), r.shortDate(addDays(monday, 6)), week.length)}`, '', ...tableMarkdown(rowsTable(sessionRows(week), { sport: true })))
    for (const s of week) lines.push('', '### ' + s.date + (s.start ? ' ' + s.start : '') + ' · ' + t.sport[s.sport] + ' · ' + cell(s.coaching?.title ?? t.purpose[s.purpose]), '', 'ID: ' + s.id, '', ...coachingLines(s).map(x => cell(x)), '', ...sessionStepLines(s).map(x => cell(x)))
  }
  if (p.warnings.length) lines.push('', ...p.warnings.map(w => '- ' + w))
  if (p.replacements.length) lines.push('', `## ${m.changes}`, '', ...p.replacements.map(x => '- ' + x.sourceId + ' → ' + x.targetId + ': ' + x.tradeoffs.join(' ')))
  return lines.join('\n') + '\n'
}
/**
 * PLAN.md w jednostce i zapisie z profilu katalogu (C9, C10), nie z flagi jednego wywołania.
 * plan.yaml bez aliasów YAML, jak plan biegowy: `legacy.plan` i `generatorPlan` bywają tym
 * samym obiektem, a przy długim planie liczba aliasów przekracza limit parsera (E3, B0).
 */
export const planFiles = (p: SportsPlan, cwd: string): Record<string, string> =>
  ({ [PLAN_YAML]: stringify(p, { aliasDuplicateObjects: false }), [PLAN_MD]: inProfileView(cwd, () => sportsMarkdown(p)) })
export function writeSportsPlan(cwd: string, p: SportsPlan): void {
  const issues = validateSportsPlan(p)
  if (issues.length) throw new Error(issues.join('\n'))
  writeTransaction(cwd, planFiles(p, cwd))
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
  const files = planFiles(p.plan, cwd)
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

/**
 * Profil v2 z profilu planu biegowego — migracja i kreator `init` (E3). Każde pole planu
 * biegowego ma miejsce w v2: objętość, płeć, HRmax, powrót i siła w `running`, czas
 * docelowy w celu. `weeklyMinutes` to szacunek do przeglądu (biegu sam nie ogranicza).
 */
export function sportsConfigFromRunning(c: TrainctlConfig, o: { weeklyMinutes: number; preparationMinutes?: number; estimatedMinutes?: number; language?: string | undefined }): SportsConfig {
  const { daysAvailable, results, ...athlete } = c.athlete
  const g = c.goal
  const goal: SportsConfig['goal'] = g.kind === 'base' ? { kind: 'base', date: g.date, name: g.name }
    : { kind: 'race', date: g.date, name: g.name, sport: 'run', distanceM: g.distanceKm * 1000,
      ...(o.estimatedMinutes ? { estimatedMinutes: o.estimatedMinutes } : {}), ...(g.targetTimeSec ? { targetTimeSec: g.targetTimeSec } : {}) }
  return validateSportsConfig({ schemaVersion: 2, ...(o.language ? { language: o.language } : {}),
    ...(c.units ? { units: c.units } : {}), ...(c.notation ? { notation: c.notation } : {}),
    athlete: { sports: { run: {
      // walidacja v2: co najmniej 5 minut na sesję
      weeklyMinutes: Math.max(10, 5 * daysAvailable.length, Math.round(o.weeklyMinutes)), sessionsPerWeek: daysAvailable.length,
      daysAvailable, results, preparationMinutes: o.preparationMinutes ?? 15,
      running: { ...athlete, ...(c.strength ? { strength: c.strength } : {}) },
    } } },
    goal, ...(c.time ? { time: c.time } : {}), ...(c.sync ? { sync: c.sync } : {}), ...(c.desk ? { desk: c.desk } : {}) })
}

/** E3: profil z kreatora `init` (układ planu biegowego) zapisany jako profil v2; błędny zostaje bez zmian. */
export function sportsYamlFromRunning(text: string): string {
  try {
    const raw = parse(text) as { language?: string } | null
    const c = validateConfig(raw)
    // minuty tygodnia z objętości przy 6:00/km (E-3, inż.), jak przy migracji bez planu
    const config = sportsConfigFromRunning(c, { weeklyMinutes: c.athlete.recentWeeklyKm * 6, language: raw?.language })
    return [ui().configFile.generatedByWizard, stringify(config)].join('\n')
  } catch {
    return text
  }
}

export function migrationCandidate(cwd: string): { plan: SportsPlan; config: SportsConfig; log: string } {
  const old = loadPlan(cwd), configV1 = loadConfig(cwd), rawConfig = parse(readFileSync(join(cwd, CONFIG_FILE), 'utf8'))
  const id = randomUUID(), cycleId = `c-${id.slice(0, 8)}`
  const goal = old.goal.kind === 'base' ? { kind: 'base' as const, date: old.goal.date, name: old.goal.name } : { kind: 'race' as const, date: old.goal.date, name: old.goal.name, sport: 'run' as const, distanceM: old.goal.distanceKm * 1000, estimatedMinutes: old.weeks.flatMap(w => w.days).filter(d => d.workout?.kind === 'race' && d.date === old.goal.date).map(d => runningDurationMinutes(old,d.workout!,d.date))[0] ?? ((old.goal.targetTimeSec ?? 0) / 60) }
  const plan: SportsPlan = { schemaVersion: 2, id, cycleId, engineVersion: packageVersion(), generatedAt: old.generatedAt, goal, sessions: [], archive: [], groups: [], replacements: [], changes: [], generatedSessions: {}, warnings: [...old.feasibilityWarnings], legacy: { plan: old, config: rawConfig, cycleId, profileInV2: true }, ...(old.timeBudgets ? { timeBudgets: old.timeBudgets } : {}) }
  plan.sessions = runningSessions(old, cycleId)
  plan.generatedSessions = Object.fromEntries(plan.sessions.map(s => [s.id, fingerprint(s)]))
  const weekly = old.weeks.map(w => plan.sessions.filter(s => s.sport === 'run' && mondayOf(s.date) === w.weekStart).reduce((n, s) => n + s.durationSec / 60, 0)).filter(n => n > 0)
  // C9, C10: jednostka i zapis notacji przechodzą z profilu; E3: płeć, HRmax, powrót, siła i czas docelowy też
  const config = sportsConfigFromRunning(configV1, { weeklyMinutes: weekly[0] ?? configV1.athlete.recentWeeklyKm * 6,
    preparationMinutes: old.preparationMinutes ?? 15, language: rawConfig.language, ...(goal.kind === 'race' ? { estimatedMinutes: goal.estimatedMinutes } : {}) })
  // cel planu = cel profilu v2 (z czasem docelowym): inaczej pierwszy `plan` uznałby go za nowy cel
  plan.goal = structuredClone(config.goal)
  // dziennik tą samą normalizacją co komendy (liczby zapisane tekstem, wartości spoza granic);
  // uszkodzony wiersz zatrzymuje migrację, jak każdą zmianę planu (readLogForChanges)
  const journal = readJournal(cwd)
  if (journal.broken.length) throw new Error(ui().common.logBroken(LOG_FILE, journal.broken.join(', ')))
  const logs = [...journal.runs, ...journal.strength].map((entry) => {
    const oldLog = entry as unknown as Record<string, unknown> & { date: string }
    const sport = oldLog['activity'] === 'strength' ? 'strength' : 'run'
    const sessionId = `${cycleId}-${oldLog.date}-${sport}`
    const km = oldLog['km'] as number | undefined, timeSec = oldLog['timeSec'] as number | undefined, minutes = oldLog['minutes'] as number | undefined
    return { ...oldLog, schemaVersion: 2, sessionId, sport, ...(timeSec !== undefined ? { durationSec: timeSec } : minutes !== undefined ? { durationSec: minutes * 60 } : {}), ...(km !== undefined ? { distanceM: Math.round(km * 1e4) / 10 } : {}) }
  })
  return { plan, config, log: logs.map(l => JSON.stringify(l)).join('\n') + (logs.length ? '\n' : '') }
}

export function sportsProposalStatus(cwd: string): { id: string; action: string; valid: boolean; date?: string; changes?: number }[] {
  const dir = join(cwd,'plan/proposals')
  if (!existsSync(dir)) return []
  const state = stateFingerprint(cwd)
  return readdirSync(dir).filter(name=>/^[a-f0-9-]{36}\.json$/.test(name)).map(name=>{
    try { const p=JSON.parse(readFileSync(join(dir,name),'utf8')) as SportsProposal; const {digest,...body}=p; return {id:p.id,action:p.action,valid:p.schemaVersion===2&&digest===fingerprint(body)&&p.state===state,date:p.date,changes:p.plan.changes.at(-1)?.sessionIds.length??0} }
    catch {return {id:name.slice(0,-5),action:'?',valid:false}}
  })
}
