/** Handlery komend CLI — czyste funkcje (cwd, argumenty) → { output, code }. */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { isAbsolute, join } from 'node:path'
import {
  addDays,
  analyzeExecution,
  diffDays,
  getLocale,
  inferProfile,
  estimateWorkoutMinutes,
  formatNumber,
  messages,
  mondayOf,
  parseIso,
  planDeskDay,
  reschedule,
  validatePlan,
  weekTotals,
  COACH_STYLE,
  INFER_WINDOW_WEEKS,
  type ExecutionRecord,
  type ActivitySource,
  type InferenceOutcome,
  type PlanIssue,
  type PlannedWorkout,
  type SyncedActivity,
  type Weekday,
} from 'trainctl-core'
import { AGENTS_FILE, agentsTemplate } from './agents-md.ts'
import { ENV_FILE } from './env-file.ts'
import { ui } from './i18n/index.ts'
import { inferredConfigYaml, loadConfig, writeConfigTemplate, CONFIG_FILE } from './config.ts'
import { appendLog, logFor, parseTime, readLog, type LogEntry } from './logfile.ts'
import {
  computePlan,
  cycleWeeksOf,
  dayFingerprint,
  findDay,
  fmtTime,
  loadPlan,
  loadPlanFile,
  loadPlanIfUsable,
  readPlanDocument,
  shiftWorkout,
  workoutText,
  weekPosition,
  writePlan,
  PLAN_MD,
  PLAN_YAML,
  type StoredPlan,
} from './planfile.ts'
import { foundationsUrl, kindPurpose, ruleExplain, ruleEvidence } from './rules-explain.ts'
import { packageVersion } from './version.ts'
import { clockToday } from './clock.ts'
import { rebuildPlan, type Regeneration } from './regenerate.ts'
import { commitFiles } from './git.ts'
import { LOG_FILE } from './logfile.ts'
export { cmdStatus } from './status.ts'
export { pluginSkills, renderSkill, type Skill } from './plugin-skills.ts'
export { AGENTS, type AgentChoice } from './agent-setup.ts'
export { foundationsUrl } from './rules-explain.ts'
import { AGENTS, writeAgentSetup, type AgentChoice } from './agent-setup.ts'
export { resolveDateInput, type DateDirection } from './date-input.ts'
export { completionScript, SHELLS, type CompletionSpec, type Shell } from './completion.ts'
export { simulationNotice, simulatedToday, SIMULATED_TODAY_ENV } from './clock.ts'
import { runExport, EXPORT_DIR, type ExportWhat } from './export.ts'
import { b, renderPlain, type Block } from './ui/blocks.ts'
import type { ColorName } from './ui/theme.ts'
import { buildExecution, isRunningActivity } from './execution.ts'
import { resultKey } from './calibration.ts'
import { applyProposal, prepareProposal, prepareShortening, recordedDates, type PlanProposal } from './proposals.ts'
import { explainSession } from './explain-session.ts'
export { buildExecution } from './execution.ts'

/** Prefiks identyfikatorów, które tworzy `trainctl` — granica tego, co wolno nam kasować. */
const OUR_EXTERNAL_ID_PREFIX = 'trainctl-'

/** Kolor semantyczny jednostki treningowej — spójny w całym CLI. */
export const KIND_COLOR: Record<string, ColorName> = {
  easy: 'easy',
  long: 'long',
  easy_hills: 'accent',
  quality_intervals: 'quality',
  quality_continuous: 'quality',
  sharpener: 'quality',
  test: 'race',
  race: 'race',
}

/** Etykiety jednostek i faz pochodzą z katalogu — zmieniają się razem z językiem. */
export const kindLabel = (kind: string): string =>
  (messages().kind as Record<string, string>)[kind] ?? kind
export const phaseLabel = (phase: string): string =>
  (messages().phase as Record<string, string>)[phase] ?? phase
import {
  chooseSource,
  compare,
  defaultProviderFactory,
  defaultRange,
  hasApiKey,
  readSnapshot,
  workoutsToPush,
  writeSnapshot,
  SECRET_FILE,
  SYNC_FILE,
  type ProviderFactory,
} from './sync.ts'

// dla MCP (importuje wyłącznie z trainctl = commands.ts)
export { defaultProviderFactory, hasApiKey, type ProviderFactory } from './sync.ts'
export { readConfigLanguage } from './config.ts'
export { loadEnvFile, ENV_FILE, type EnvFileOutcome } from './env-file.ts'
// serwer MCP opisuje narzędzia tym samym katalogiem, co CLI
export { ui, type CliMessages } from './i18n/index.ts'

export interface CmdResult {
  data?: Record<string, unknown>
  /** Czysty tekst — to widzi MCP/agent i potok. */
  output: string
  code: number
  /** Semantyczny opis wyjścia — CLI renderuje z kolorami. */
  blocks?: Block[]
}

const ok = (output: string): CmdResult => ({ output, code: 0 })
/** Wynik opisany blokami: CLI dostaje kolor, MCP ten sam tekst bez ozdobników. */
const okDoc = (blocks: Block[], data?: Record<string, unknown>): CmdResult => ({ output: renderPlain(blocks), code: 0, blocks, ...(data ? { data } : {}) })
const fail = (e: unknown): CmdResult => {
  const message = e instanceof Error ? e.message : String(e)
  return { output: message, code: 1, blocks: [b.error(message)] }
}

/** Wartość flagi `--commit`: brak, `true` (domyślna wiadomość) albo własna wiadomość. */
export type CommitOption = boolean | string | undefined

const PLAN_FILES = [PLAN_YAML, PLAN_MD]

/**
 * `--commit` po udanym zapisie (ADR-040) — nigdy zamiast niego: brak gita albo
 * brak zmian to informacja, nieudany commit to ostrzeżenie, a zapis zostaje.
 */
function commitBlocks(cwd: string, commit: CommitOption, files: string[], message: string): { blocks: Block[]; outcome: unknown } {
  if (commit === undefined || commit === false) return { blocks: [], outcome: null }
  const outcome = commitFiles(cwd, files, typeof commit === 'string' && commit.trim() ? commit.trim() : message)
  const t = ui().commit
  const block = outcome.status === 'committed' ? b.success(t.done(outcome.sha, outcome.files.join(', ')))
    : outcome.status === 'no-git' ? b.info(t.noGit)
      : outcome.status === 'nothing' ? b.info(t.nothing)
        : b.warn(t.failed(outcome.detail))
  return { blocks: [block], outcome }
}

/** Dokłada wynik commita do gotowego wyniku komendy (bloki i dane). */
function withCommit(result: CmdResult, cwd: string, commit: CommitOption, files: string[], message: string): CmdResult {
  if (result.code !== 0 || commit === undefined || commit === false) return result
  const { blocks, outcome } = commitBlocks(cwd, commit, files, message)
  const all = [...(result.blocks ?? []), ...blocks]
  return { ...result, blocks: all, output: renderPlain(all), data: { ...(result.data ?? {}), commit: outcome } }
}

/**
 * Plan z innego minora silnika nadal działa, ale poniżej 1.0 regeneracja może dać
 * inne tygodnie (CHANGELOG). Mówimy o tym przy czytaniu planu — nie blokujemy.
 */
export function compatibilityNotes(plan: StoredPlan): Block[] {
  const current = packageVersion()
  if (!plan.engineVersion) return [b.info(ui().common.planFromOldEngine(current))]
  const minor = (v: string) => v.split('.').slice(0, 2).join('.')
  return minor(plan.engineVersion) === minor(current) ? [] : [b.info(ui().common.planFromOtherEngine(plan.engineVersion, current))]
}

/** „Dziś" komend: lokalny kalendarz albo jawna symulacja TRAINCTL_TODAY (ADR-034). */
export const localToday = (): string => clockToday()

const weekdayName = (day: Weekday): string => messages().weekday[day]
/** Skróty jak w planach trenera (korpus) — po angielsku Mon/Tue/… */
const weekdayShort = (day: Weekday): string => messages().weekdayShort[day]

/** Sekundy → H:MM:SS albo MM:SS — do pokazywania czasów kandydatów. */
export function fmtClock(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  const p = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${p(m)}:${p(s)}` : `${m}:${p(s)}`
}

/** Pobranie historii i inferencja profilu — wspólne dla flagi CLI, kreatora i MCP. */
export async function fetchInferredProfile(
  cwd: string,
  today: string,
  factory: ProviderFactory = defaultProviderFactory,
): Promise<InferenceOutcome> {
  const provider = factory(cwd)
  const oldest = addDays(mondayOf(today), -INFER_WINDOW_WEEKS * 7)
  const activities = await provider.listActivities(oldest, today)
  return inferProfile(activities, today)
}

/**
 * `trainctl init --from-intervals` poza TTY: zapisuje trainctl.yaml z propozycjami
 * (komentarze proweniencji, ADR-019); kandydatów na wyniki tylko WYPISUJE —
 * dopisanie do results wymaga potwierdzenia użytkownika.
 */
export async function cmdInitFromIntervals(
  cwd: string,
  opts: { date?: string | undefined } = {},
  factory: ProviderFactory = defaultProviderFactory,
): Promise<CmdResult> {
  try {
    const today = opts.date ?? localToday()
    const outcome = await fetchInferredProfile(cwd, today, factory)
    if (!outcome.ok) return fail(new Error(outcome.reason))
    const p = outcome.profile
    writeConfigTemplate(cwd, inferredConfigYaml(p))
    writeAgentsFile(cwd)
    protectSecrets(cwd)

    const recent4 = p.weeklyKm.slice(-4).map((w) => w.km)
    const blocks: Block[] = [
      b.success(ui().init.fromIntervals(CONFIG_FILE)),
      b.kv([
        [ui().init.window, `${p.window.oldest} → ${p.window.newest}`],
        [ui().init.currentVolume, `${messages().units.kmPerWeek(p.recentWeeklyKm)} (${p.recentBasis})`],
        ...(p.peakWeeklyKm !== undefined
          ? ([[ui().init.windowPeak, messages().units.kmPerWeek(p.peakWeeklyKm)]] as [string, string][])
          : []),
        [ui().init.trainingDays, p.daysAvailable.join(', ')],
        ...(p.longRunDay ? ([[ui().init.longRunDay, p.longRunDay]] as [string, string][]) : []),
        [ui().init.lastFourWeeks, recent4.map((km) => `${km} km`).join(' · ')],
      ]),
    ]
    for (const c of p.caveats) blocks.push(b.warn(c))
    if (p.raceCandidates.length) {
      blocks.push(
        b.section(ui().init.raceCandidates),
        b.bullets(
          p.raceCandidates.slice(0, 5).map(
            (c) =>
              `${c.date} · ${c.name ?? ui().init.unnamed} · ${c.distanceKm} km — ` +
              `${fmtClock(c.timeSec)} (${c.reason})` +
              ` → results: { date: "${c.date}", distanceKm: ${c.distanceKm}, timeSec: ${c.timeSec} }`,
          ),
        ),
      )
    } else {
      blocks.push(b.info(ui().init.noRaceCandidates))
    }
    blocks.push(b.blank(), b.hint(ui().init.fillGoal))
    return okDoc(blocks)
  } catch (e) {
    return fail(e)
  }
}

/**
 * Persona trenera dla agenta — powstaje razem z profilem, nigdy nie nadpisuje
 * istniejącego pliku (użytkownik mógł go dopasować pod siebie).
 */
function writeAgentsFile(cwd: string): boolean {
  const path = join(cwd, AGENTS_FILE)
  if (existsSync(path)) return false
  writeFileSync(path, agentsTemplate(), 'utf-8')
  return true
}

/** Pliki z sekretami, które nigdy nie mogą trafić do repozytorium (ADR-009). */
// `activities/` to domyślny katalog eksportu FIT/TCX/GPX — ślady GPS zdradzają adres domu.
const SECRET_PATTERNS = [ENV_FILE, '.env.*', SECRET_FILE, 'activities/']

/**
 * Ochrona sekretów w katalogu treningowym. Katalog jest repozytorium gita,
 * a od kiedy czytamy `.env`, brak wpisu w `.gitignore` to prosta droga do
 * wypchnięcia klucza API. Istniejącego pliku nie nadpisujemy — dokładamy
 * wyłącznie brakujące wzorce, żeby nie ruszać reguł użytkownika.
 */
function protectSecrets(cwd: string): string[] {
  const path = join(cwd, '.gitignore')
  const existing = existsSync(path) ? readFileSync(path, 'utf-8') : ''
  const present = new Set(existing.split('\n').map((l) => l.trim().replace(/^\/+/, '')))
  const missing = SECRET_PATTERNS.filter((p) => !present.has(p))
  if (missing.length === 0) return []
  const header = `# ${ui().init.gitignoreHeader}`
  const block = `${header}\n${missing.join('\n')}\n`
  writeFileSync(path, existing && !existing.endsWith('\n') ? `${existing}\n${block}` : existing + block, 'utf-8')
  return missing
}

export function cmdInit(cwd: string, content?: string, opts: { commit?: CommitOption; agent?: string | undefined } = {}): CmdResult {
  if (opts.agent !== undefined && !(AGENTS as readonly string[]).includes(opts.agent)) {
    return fail(new Error(ui().init.agentUnknown(opts.agent, AGENTS.join(', '))))
  }
  const result = initImpl(cwd, content, opts.agent as AgentChoice | undefined)
  const extra = (result.data?.['agentFiles'] as string[] | undefined) ?? []
  return withCommit(result, cwd, opts.commit, [CONFIG_FILE, AGENTS_FILE, '.gitignore', ...extra], ui().commit.init)
}

/**
 * Pliki integracji agenta — tylko na jawne `--agent` (ADR-036). Istniejących
 * nie nadpisujemy: pokazujemy, co do nich dopisać.
 */
function agentBlocks(cwd: string, agent: AgentChoice | undefined): { blocks: Block[]; files: string[] } {
  if (!agent) return { blocks: [b.hint(ui().init.agentHint)], files: [] }
  const setup = writeAgentSetup(cwd, agent)
  const blocks: Block[] = setup.created.map((file) => b.success(ui().init.agentCreated(file)))
  for (const e of setup.existing) blocks.push(b.warn(ui().init.agentExists(e.file)), b.text(e.content, 'muted'))
  if (agent === 'claude' || agent === 'all') blocks.push(b.info(ui().init.agentClaudeNext))
  if (agent === 'codex' || agent === 'all') blocks.push(b.info(ui().init.agentCodexNext))
  return { blocks, files: setup.created }
}

function initImpl(cwd: string, content: string | undefined, agent: AgentChoice | undefined): CmdResult {
  try {
    writeConfigTemplate(cwd, content)
    const agents = writeAgentsFile(cwd)
    const ignored = protectSecrets(cwd)
    const integration = agentBlocks(cwd, agent)
    return okDoc([
      b.success(ui().init.created(CONFIG_FILE)),
      ...(agents ? [b.success(ui().init.createdAgents(AGENTS_FILE))] : []),
      ...(ignored.length ? [b.success(ui().init.gitignoreUpdated(ignored.join(', ')))] : []),
      ...integration.blocks,
      ...(content
        ? []
        : [
            b.text(ui().init.fillProfile),
          ]),
      b.hint(ui().common.nextStep('trainctl plan')),
    ], { agentFiles: integration.files })
  } catch (e) {
    return fail(e)
  }
}

export function cmdPlan(cwd: string, opts: { date?: string | undefined; fresh?: boolean | undefined; commit?: CommitOption } = {}): CmdResult {
  const result = planImpl(cwd, opts)
  const goal = (result.data?.['plan'] as StoredPlan | undefined)?.goal
  return withCommit(result, cwd, opts.commit, PLAN_FILES, ui().commit.plan(goal?.name ?? '', goal?.date ?? ''))
}

function planImpl(cwd: string, opts: { date?: string | undefined; fresh?: boolean | undefined }): CmdResult {
  try {
    const today = opts.date ?? localToday()
    const config = loadConfig(cwd)
    // Istniejący plan regenerujemy z ochroną przeszłości i zatwierdzonych decyzji
    // (ADR-033); od zera wyłącznie na jawne --fresh albo gdy pliku nie da się użyć.
    const existing = loadPlanIfUsable(cwd)
    const rebuild = existing && opts.fresh !== true
      ? rebuildPlan(existing, config, { today, recorded: recordedDates(cwd) })
      : undefined
    const plan = rebuild ? rebuild.plan : computePlan(config, today)
    const issues = validatePlan(plan)
    if (issues.some(issue => issue.severity === 'error')) throw new Error(issues.map(describeIssue).join('\n'))
    if (rebuild?.upToDate !== true) writePlan(cwd, plan)

    const cycle = cycleWeeksOf(plan)
    const weeksToRace = cycle.length
    const blocks: Block[] = [
      b.title(
        `${plan.goal.name} · ${plan.goal.distanceKm} km`,
        `${plan.goal.date} · ${ui().plan.weeksOfPlan(weeksToRace)}`,
      ),
      b.kv([
        [ui().plan.volumePeak, messages().units.kmPerWeek(plan.peakKmPlanned)],
        [ui().plan.recommendedForDistance, messages().units.kmPerWeek(plan.peakKmRecommended)],
        [
          ui().plan.vdot,
          `${plan.vdot} (${plan.vdotSource === 'result' ? ui().plan.vdotFromResult : ui().plan.vdotFromGoal})`,
        ],
      ]),
    ]

    if (plan.prediction) {
      const range = `${fmtTime(plan.prediction.loSec)} – ${fmtTime(plan.prediction.hiSec)}`
      blocks.push(
        b.blank(),
        b.panel(
          ui().plan.prediction,
          [
            `${range}   ${ui().plan.predictionMethod(plan.prediction.method)}`,
            ui().plan.predictionAlwaysRange,
          ],
          'brand',
        ),
      )
      const target = plan.goal.targetTimeSec
      if (target) {
        if (target < plan.prediction.loSec) {
          blocks.push(
            b.warn(
              ui().plan.goalAmbitious(fmtTime(target)),
            ),
          )
        } else if (target > plan.prediction.hiSec) {
          blocks.push(b.info(ui().plan.goalConservative(fmtTime(target))))
        } else {
          blocks.push(b.success(ui().plan.goalInRange(fmtTime(target))))
        }
      }
    }

    // szkic makrocyklu — jedna linia na fazę
    const phases: string[] = []
    let current = ''
    let from = 0
    cycle.forEach((w, i) => {
      const label = phaseLabel(w.skeleton.phase)
      if (label !== current) {
        if (current) phases.push(ui().plan.phaseSpan(current, from + 1, i))
        current = label
        from = i
      }
    })
    if (current) phases.push(ui().plan.phaseSpan(current, from + 1, cycle.length))
    blocks.push(b.section(ui().plan.structure), b.bullets(phases))
    if (rebuild && existing && !rebuild.upToDate) blocks.push(...regenerationBlocks(existing, rebuild))
    if (opts.fresh === true && existing) {
      const dropped = freshDropped(existing)
      if (dropped) blocks.push(b.blank(), b.warn(ui().plan.freshDropped(dropped)))
    }

    if (plan.feasibilityWarnings.length) {
      blocks.push(b.blank())
      for (const w of plan.feasibilityWarnings) blocks.push(b.warn(w))
    }
    for (const issue of issues) blocks.push(b.warn(describeIssue(issue)))
    blocks.push(
      b.blank(),
      rebuild?.upToDate ? b.success(ui().plan.upToDate) : b.success(ui().common.saved(`${PLAN_YAML} + ${PLAN_MD}`)),
      b.hint('trainctl today · trainctl week · trainctl why'),
    )
    return okDoc(blocks, { plan, issues, regeneration: rebuild ? regenerationData(rebuild) : null })
  } catch (e) {
    return fail(e)
  }
}

const regenerationData = (r: Regeneration) => ({
  mode: r.mode, changedDates: r.changedDates, protectedDays: r.protectedDays,
  loadState: r.loadState, droppedWeeks: r.droppedWeeks, upToDate: r.upToDate,
})

/** Co regeneracja zmienia, czego nie rusza i dlaczego — jedno źródło dla `plan` i `diff`. */
function regenerationBlocks(existing: StoredPlan, r: Regeneration, opts: { diffLines?: boolean } = {}): Block[] {
  const t = ui().plan
  const blocks: Block[] = [b.section(t.regenSection)]
  blocks.push(b.text(r.mode === 'same-cycle'
    ? t.sameCycle(r.plan.generatedAt)
    : t.newCycle(r.plan.cycleStart ?? r.plan.weeks[0]?.weekStart ?? r.plan.generatedAt)))
  const counts = new Map<string, number>()
  for (const p of r.protectedDays) counts.set(p.reason, (counts.get(p.reason) ?? 0) + 1)
  const reasons = [...counts].map(([reason, count]) => `${t.reasons[reason as keyof typeof t.reasons]} ${count}`).join(', ')
  blocks.push(b.kv([
    [t.changedDays, String(r.changedDates.length)],
    ...(r.protectedDays.length ? ([[t.keptDays, reasons]] as [string, string][]) : []),
  ]))
  if (r.loadState === 'kept' && r.plan.loadState) blocks.push(b.info(t.loadKept(r.plan.loadState.baselineWeeklyKm, r.plan.loadState.effectiveFrom)))
  if (r.loadState === 'cleared' && existing.loadState) blocks.push(b.info(t.loadCleared(existing.loadState.baselineWeeklyKm)))
  if (r.droppedWeeks.length) blocks.push(b.warn(t.droppedWeeks(r.droppedWeeks.join(', '))))
  if (opts.diffLines !== false) {
    const lines = diffWeeks(existing.weeks, r.plan.weeks)
    if (lines.length) blocks.push(b.bullets(lines.slice(0, 12)))
    if (lines.length > 12) blocks.push(b.text(t.moreLines(lines.length - 12), 'muted'))
  }
  return blocks
}

/** Czego `--fresh` się pozbywa — mówimy przed faktem dokonanym, nie po nim. */
function freshDropped(existing: StoredPlan): string {
  const t = ui().plan.freshItems
  const days = existing.weeks.flatMap((w) => w.days)
  const edited = existing.generatedDays ? days.filter((d) => existing.generatedDays![d.date] !== undefined && existing.generatedDays![d.date] !== dayFingerprint(d)).length : 0
  return [
    ...(existing.loadState ? [t.loadState(existing.loadState.baselineWeeklyKm)] : []),
    ...(days.some((d) => d.pinned) ? [t.pinned(days.filter((d) => d.pinned).length)] : []),
    ...(Object.keys(existing.timeBudgets ?? {}).length ? [t.budgets(Object.keys(existing.timeBudgets!).length)] : []),
    ...(days.some((d) => d.timeAdjustment) ? [t.approved(days.filter((d) => d.timeAdjustment).length)] : []),
    ...(edited ? [t.edited(edited)] : []),
    ...(existing.changes.length ? [t.history(existing.changes.length)] : []),
  ].join(', ')
}

export function cmdToday(cwd: string, opts: { date?: string | undefined } = {}): CmdResult {
  try {
    const date = opts.date ?? localToday()
    const plan = loadPlan(cwd)
    const hit = findDay(plan, date)
    if (!hit) {
      return okDoc([
        b.warn(ui().common.outsidePlan(date, plan.weeks[0]?.weekStart ?? '', plan.goal.date)),
      ])
    }
    const { week, day } = hit
    const sk = week.skeleton
    const toRace = diffDays(date, plan.goal.date)
    const blocks: Block[] = [
      b.title(
        `${date} · ${weekdayName(day.weekday)}`,
        `${ui().today.weekOf(weekPosition(plan, week).index + 1, weekPosition(plan, week).total)} · ${phaseLabel(sk.phase)}` +
          `${sk.deload ? ` · ${ui().today.deload}` : ''} · ${ui().today.daysToRace(toRace)}`,
      ),
      ...compatibilityNotes(plan),
    ]

    if (!day.workout) {
      blocks.push(b.panel(ui().today.restDayTitle, [ui().today.restDayBody], 'muted'))
    } else {
      const w = day.workout
      blocks.push(
        b.panel(
          `${kindLabel(w.kind)} · ${w.raceDistanceKm ?? w.distanceKm} km`,
          [workoutText(day)],
          KIND_COLOR[w.kind] ?? 'accent',
        ),
      )
    }

    if (day.strength) {
      const kind = day.workout?.kind
      const advice = !kind
        ? ui().today.strengthAloneDay
        : kind === 'easy'
          ? ui().today.strengthWithEasy
          : kind === 'long'
            ? ui().today.strengthWithLong
            : ui().today.strengthWithQuality(kindLabel(kind))
      blocks.push(
        b.panel(ui().today.strengthTitle(day.strength.durationMin), [day.strength.description], 'accent'),
        kind && !['easy', 'long'].includes(kind) ? b.warn(advice) : b.text(advice, 'muted'),
      )
    }
    const entry = logFor(cwd, date)
    if (entry) {
      blocks.push(
        b.success(
          ui().today.logged(entry.status) +
            (entry.km ? `, ${entry.km} km` : '') +
            (entry.rpe !== undefined ? `, RPE ${entry.rpe}` : '') +
            (entry.note ? ` — ${entry.note}` : ''),
        ),
      )
    }
    const estimatedMinutes = (day.workout ? estimateWorkoutMinutes(day.workout, plan.preparationMinutes ?? 15) : 0) + (day.strength?.durationMin ?? 0)
    // Dla biegacza zza biurka dwie najważniejsze liczby dnia: ile to potrwa i co dalej.
    if ((day.workout || day.strength) && Number.isFinite(estimatedMinutes)) blocks.push(b.text(ui().today.estimate(estimatedMinutes), 'muted'))
    const next = plan.weeks.flatMap((w) => w.days).find((d) => d.date > date && d.workout)
    if (next?.workout) {
      blocks.push(b.text(ui().today.next(next.date, weekdayName(next.weekday), kindLabel(next.workout.kind), next.workout.raceDistanceKm ?? next.workout.distanceKm), 'muted'))
    }
    if (day.workout) blocks.push(b.hint(ui().today.whyHint(date)))
    return okDoc(blocks, { date, day, week: { weekStart: week.weekStart, phase: sk.phase }, log: entry ?? null, calibration: plan.calibration ?? null, estimatedMinutes: Number.isFinite(estimatedMinutes) ? estimatedMinutes : null, next: next ? { date: next.date, kind: next.workout!.kind, distanceKm: next.workout!.raceDistanceKm ?? next.workout!.distanceKm } : null })
  } catch (e) {
    return fail(e)
  }
}

export function cmdWeek(cwd: string, opts: { date?: string | undefined } = {}): CmdResult {
  try {
    const date = opts.date ?? localToday()
    const plan = loadPlan(cwd)
    const hit = findDay(plan, date)
    if (!hit) return ok(ui().common.outsidePlan(date, plan.weeks[0]?.weekStart ?? '', plan.goal.date))
    const { week } = hit
    const sk = week.skeleton
    const model = messages().intensityModel[sk.intensityModel]
    const rows: string[][] = []
    const accents: (ColorName | undefined)[] = []
    for (const day of week.days) {
      const entry = logFor(cwd, day.date)
      // status słowem, nie symbolem: to samo wyjście czyta agent przez MCP
      const mark = entry ? ` [${entry.status}]` : ''
      const kind = day.workout?.kind
      const strength = day.strength ? ` ${ui().week.strengthTag(day.strength.durationMin)}` : ''
      rows.push([
        weekdayShort(day.weekday),
        day.date.slice(5),
        day.workout ? `${day.workout.raceDistanceKm ?? day.workout.distanceKm} km` : '—',
        day.workout ? `${workoutText(day)}${strength}${mark}` : `${ui().week.rest}${strength}`,
      ])
      accents.push(kind ? KIND_COLOR[kind] : 'muted')
    }
    const blocks: Block[] = [
      b.title(
        ui().week.title(weekPosition(plan, week).index + 1, weekPosition(plan, week).total, week.weekStart),
        ui().week.subtitle(phaseLabel(sk.phase), model, sk.targetKm, week.totalKm) +
          (sk.deload ? ` · ${ui().week.deloadUpper}` : ''),
      ),
      ...compatibilityNotes(plan),
      b.table([ui().week.columns.day, ui().week.columns.date, ui().week.columns.km, ui().week.columns.workout], rows, accents),
    ]
    if (sk.raceDate) blocks.push(b.info(ui().week.raceThisWeek(sk.raceDate)))
    if (sk.keepIntensity) {
      blocks.push(b.info(ui().week.taperNote))
    }
    return okDoc(blocks, { week, execution: buildExecution(plan, readSnapshot(cwd)?.activities ?? [], readLog(cwd), date).filter((e) => week.days.some((d) => d.date === e.date)) })
  } catch (e) {
    return fail(e)
  }
}

type LogOptions = {
  date?: string | undefined
  status?: string | undefined
  km?: string | undefined
  time?: string | undefined
  testTime?: string | undefined
  rpe?: string | undefined
  note?: string | undefined
}

export function cmdLog(cwd: string, opts: LogOptions & { commit?: CommitOption } = {}): CmdResult {
  const result = logImpl(cwd, opts)
  const entry = result.data?.['entry'] as LogEntry | undefined
  return withCommit(result, cwd, opts.commit, [LOG_FILE], ui().commit.log(entry?.date ?? '', entry?.status ?? ''))
}

function logImpl(cwd: string, opts: LogOptions): CmdResult {
  try {
    const date = opts.date ?? localToday()
    const plan = loadPlan(cwd)
    if (!findDay(plan, date)) return fail(new Error(ui().log.outsidePlan(date)))
    const status = (opts.status ?? 'done') as 'done' | 'skipped' | 'modified'
    if (!['done', 'skipped', 'modified'].includes(status)) {
      return fail(new Error(ui().log.unknownStatus(String(opts.status))))
    }
    // CR-10 bez zera: wpis dotyczy odbytej sesji, a 0 znaczy „brak wysiłku" —
    // dolna granica 1 to wybór inżynierski, sama skala z P-6 (Foster).
    const rpe = opts.rpe === undefined ? undefined : Number(opts.rpe)
    if (rpe !== undefined && (!Number.isInteger(rpe) || rpe < 1 || rpe > 10)) {
      return fail(new Error(ui().log.badRpe(String(opts.rpe))))
    }
    if (opts.km !== undefined && (!opts.km.trim() || !Number.isFinite(Number(opts.km)) || Number(opts.km) < 0)) throw new Error(ui().improve.badDistance)
    const testTimeSec = opts.testTime === undefined ? undefined : parseTime(opts.testTime)
    if (testTimeSec !== undefined && (status === 'skipped' || !['test', 'race'].includes(findDay(plan, date)?.day.workout?.kind ?? ''))) throw new Error(ui().improve.testTimeOnly)
    if (status === 'skipped' && ((Number(opts.km) || 0) > 0 || opts.time !== undefined)) throw new Error(ui().improve.skippedMetrics)
    if (testTimeSec !== undefined && opts.time && testTimeSec > parseTime(opts.time)) throw new Error(ui().improve.testTimeOnly)
    const entry: LogEntry = {
      date,
      status,
      ...(opts.km ? { km: Number(opts.km) } : {}),
      ...(opts.time ? { timeSec: parseTime(opts.time) } : {}),
      ...(testTimeSec !== undefined ? { testTimeSec } : {}),
      ...(rpe !== undefined ? { rpe } : {}),
      ...(opts.note ? { note: opts.note } : {}),
      loggedAt: new Date().toISOString(),
    }
    appendLog(cwd, entry)
    // Odpowiedź odbija plan obok zapisu: samo „zalogowano" nie mówi, że w planie
    // był odpoczynek albo że zapis dotyczy innej jednostki niż zaplanowana.
    const workout = findDay(plan, date)!.day.workout
    const minutes = workout ? estimateWorkoutMinutes(workout, plan.preparationMinutes ?? 15) : undefined
    const knownMinutes = minutes !== undefined && Number.isFinite(minutes) ? minutes : null
    const planned = workout
      ? [kindLabel(workout.kind), `${formatNumber(getLocale(), workout.raceDistanceKm ?? workout.distanceKm)} km`, ...(knownMinutes !== null ? [`~${knownMinutes} min`] : [])].join(' · ')
      : ui().week.rest
    const recorded = [
      entry.status,
      ...(entry.km !== undefined ? [`${formatNumber(getLocale(), entry.km)} km`] : []),
      ...(entry.timeSec !== undefined ? [fmtTime(entry.timeSec)] : []),
      ...(entry.testTimeSec !== undefined ? [ui().log.testTime(fmtTime(entry.testTimeSec))] : []),
      ...(entry.rpe !== undefined ? [`RPE ${entry.rpe}`] : []),
      ...(entry.note ? [`“${entry.note}”`] : []),
    ].join(' · ')
    const blocks: Block[] = [
      b.success(ui().log.saved(date, status)),
      b.kv([[ui().log.planned, planned], [ui().log.recorded, recorded]]),
    ]
    if (!workout && status !== 'skipped') blocks.push(b.info(ui().log.unplanned))
    blocks.push(b.hint(ui().shift.weekHint(date)))
    return okDoc(blocks, {
      entry,
      planned: workout ? { kind: workout.kind, distanceKm: workout.raceDistanceKm ?? workout.distanceKm, estimatedMinutes: knownMinutes } : null,
    })
  } catch (e) {
    return fail(e)
  }
}

export function cmdShift(cwd: string, opts: { from: string; to: string; commit?: CommitOption }): CmdResult {
  return withCommit(shiftImpl(cwd, opts), cwd, opts.commit, PLAN_FILES, ui().commit.shift(opts.from, opts.to))
}

function shiftImpl(cwd: string, opts: { from: string; to: string }): CmdResult {
  try {
    if (opts.from < localToday() || opts.to < localToday()) throw new Error(ui().improve.pastWrite)
    const plan = loadPlan(cwd)
    const recorded = new Set(readLog(cwd).map(l => l.date))
    for (const a of readSnapshot(cwd)?.activities ?? []) if (isRunningActivity(a) && (a.distanceKm ?? 0) > 0) recorded.add(a.date)
    if (recorded.has(opts.from) || recorded.has(opts.to)) throw new Error(ui().improve.pastWrite)
    const { warnings } = shiftWorkout(plan, opts.from, opts.to)
    const issues = validatePlan(plan)
    if (issues.some(i => i.severity === 'error')) throw new Error(ui().improve.invalidProposal)
    warnings.push(...issues.map(describeIssue))
    plan.changes.push({
      at: localToday(),
      action: 'shift',
      detail: `${opts.from} ↔ ${opts.to}`,
    })
    writePlan(cwd, plan)
    const blocks: Block[] = [b.success(ui().shift.swapped(opts.from, opts.to))]
    for (const w of warnings) blocks.push(b.warn(w))
    blocks.push(b.hint(ui().shift.weekHint(opts.to)))
    return okDoc(blocks)
  } catch (e) {
    return fail(e)
  }
}

export function cmdWhy(cwd: string, opts: { date?: string | undefined } = {}): CmdResult {
  try {
    const date = opts.date ?? localToday()
    parseIso(date)
    const plan = loadPlan(cwd)
    const hit = findDay(plan, date)
    if (!hit) return ok(ui().common.outsidePlan(date, plan.weeks[0]?.weekStart ?? '', plan.goal.date))
    const { week, day } = hit
    const sk = week.skeleton
    const execution = buildExecution(plan, readSnapshot(cwd)?.activities ?? [], readLog(cwd), localToday()).find(e => e.date === date)
    const explanation = explainSession(plan, week, day, execution)
    const blocks: Block[] = [
      b.title(
        ui().why.title(date),
        ui().why.phaseLine(phaseLabel(sk.phase), messages().intensityModel[sk.intensityModel]) +
          (sk.deload ? ` · ${ui().why.deloadWeek}` : ''),
      ),
    ]
    blocks.push(...compatibilityNotes(plan))
    blocks.push(b.section(ui().coach.context), b.text(explanation.purpose), b.bullets(explanation.context))
    if (explanation.dose.length) blocks.push(b.section(ui().coach.dose), b.bullets(explanation.dose))
    // Szacunek czasu ma sens tylko wtedy, gdy jest co szacować — dzień wolny to nie „0 minut".
    if (day.workout || day.strength) {
      blocks.push(Number.isFinite(explanation.estimatedMinutes) && explanation.estimatedMinutes !== null
        ? b.info(ui().improve.minuteEstimate(explanation.estimatedMinutes)) : b.info(ui().improve.unknownDuration))
    }
    if (day.strength) {
      blocks.push(b.panel(ui().today.strengthTitle(day.strength.durationMin), [day.strength.description], 'accent'))
      // Gdy siła jest jedyną aktywnością dnia, jej cel stoi już na górze jako cel dnia.
      if (day.workout) blocks.push(b.section(ui().why.strengthPurposeTitle), b.text(ui().why.strengthPurpose))
    }
    if (!day.workout && !day.strength) blocks.push(b.text(ui().why.restDay))
    blocks.push(b.section(ui().improve.calibration))
    if (plan.calibration) {
      blocks.push(b.text(ui().improve.calibrationPolicy), b.bullets(plan.calibration.candidates.map((c) =>
        [c.result.date, c.result.name ?? String(c.result.distanceKm) + ' km', 'VDOT ' + c.vdot.toFixed(1), ui().improve[c.reason], ui().improve.age(c.ageDays), c.result.exclusionReason ?? ''].filter(Boolean).join(' · '))))
    } else blocks.push(b.info(ui().improve.calibrationMissing))
    const evidence = [...new Set([...(day.workout?.ruleRefs ?? []), ...sk.ruleRefs, ...(day.strength?.ruleRefs ?? [])])].map((id) => ({ id, origin: ruleEvidence(id), explanation: ruleExplain(id) ?? id }))
    // Jedna lista reguł: ID, treść i pochodzenie razem. Wcześniej te same ID stały
    // w dwóch sekcjach — raz z klasyfikacją, raz z treścią — a cel jednostki dwa razy.
    if (evidence.length) {
      blocks.push(b.section(ui().why.rules), b.bullets(evidence.map((e) => ui().why.ruleLine(e.id, ruleExplain(e.id), ui().improve[e.origin]))))
    }
    blocks.push(b.blank(), b.hint(ui().why.sourcesHint(foundationsUrl(), day.workout || !day.strength ? '§10' : '§10.8')))
    return okDoc(blocks, { day, explanation, calibration: plan.calibration ?? null, evidence })
  } catch (e) {
    return fail(e)
  }
}

export async function cmdPush(
  cwd: string,
  opts: { from?: string | undefined; to?: string | undefined; days?: string | undefined } = {},
  factory: ProviderFactory = defaultProviderFactory,
): Promise<CmdResult> {
  try {
    const today = localToday()
    const days = Number(opts.days ?? 14)
    const range = defaultRange(today, Number.isFinite(days) ? Math.abs(days) : 14)
    const from = opts.from ?? range.from
    const to = opts.to ?? range.to
    const plan = loadPlan(cwd)
    const workouts = workoutsToPush(plan, from, to)
    if (workouts.length === 0) {
      return ok(ui().push.nothingToPush(from, to))
    }
    const provider = factory(cwd)
    const res = await provider.pushWorkouts(workouts)

    // Sprzątanie po renegocjacji: wpisy, które wypchnęliśmy wcześniej, a których
    // nie ma już w planie (np. trening przesunięty na inny dzień), muszą zniknąć
    // — inaczej zostają w kalendarzu i na zegarku jako duch.
    const stale: string[] = []
    try {
      const remote = await provider.listPlannedWorkouts(from, to)
      const current = new Set(workouts.map((w) => w.externalId))
      for (const r of remote) {
        // Kasujemy WYŁĄCZNIE wpisy z naszym prefiksem. Filtr jest też w adapterze,
        // ale tu powtórzony celowo: pomyłka oznaczałaby skasowanie treningów,
        // które użytkownik dodał sam w intervals.icu.
        if (!r.externalId?.startsWith(OUR_EXTERNAL_ID_PREFIX)) continue
        if (!current.has(r.externalId)) {
          await provider.deleteWorkout(r.id)
          stale.push(r.date)
        }
      }
    } catch {
      // brak uprawnień do listowania/kasowania nie może wywrócić samego pushu
    }

    return okDoc([
      b.success(ui().push.pushed(res.pushed, provider.name, from, to)),
      ...(res.warnings ?? []).map((w) => b.warn(w)),
      ...(stale.length
        ? [b.info(ui().push.removedStale(stale.length, stale.join(', ')))]
        : []),
      b.table(
        [ui().push.columns.date, ui().push.columns.workout],
        workouts.map((w) => [w.date, w.name]),
      ),
      b.blank(),
      b.info(ui().push.willSync),
      b.hint(ui().push.upsertHint),
    ])
  } catch (e) {
    return fail(e)
  }
}

export async function cmdPull(
  cwd: string,
  opts: { days?: string | undefined; date?: string | undefined; from?: string | undefined } = {},
  factory: ProviderFactory = defaultProviderFactory,
): Promise<CmdResult> {
  try {
    const today = opts.date ?? localToday()
    const days = Number(opts.days ?? 28)
    const { from, to } = defaultRange(today, -(Number.isFinite(days) ? Math.abs(days) : 28))
    // `--from <eksport>` albo hub; bez obu `factory` zgłosi brak klucza jak dotąd
    const choice = chooseSource(cwd, opts.from, factory)
    const provider = choice ? { name: choice.label, ...pick(choice.source) } : factory(cwd)
    const [activities, wellness] = await Promise.all([
      provider.listActivities(from, to),
      provider.listWellness(from, to).catch(() => []),
    ])
    const skipped = choice?.skipped() ?? []
    writeSnapshot(cwd, { pulledAt: today, from, to: today, activities, wellness })
    const runs = activities.filter((a) => /run/i.test(a.type))
    const km = Math.round(runs.reduce((s, a) => s + (a.distanceKm ?? 0), 0))
    const blocks: Block[] = [
      b.title(ui().pull.title(provider.name), `${from} → ${to}`),
      b.kv([
        [ui().pull.activities, ui().pull.activitiesValue(activities.length, runs.length, km)],
        [ui().pull.wellnessEntries, String(wellness.length)],
        [ui().pull.savedTo, SYNC_FILE],
      ]),
    ]
    // „19 aktywności, 0 biegowych" jest prawdą, która wprowadza w błąd: hub zna
    // te treningi, tylko nie oddaje ich danych. Bez tego zdania użytkownik
    // wnioskuje, że nie synchronizuje mu się zegarek, i nie ma jak trafić w powód.
    const withheld = activities.filter((a) => a.dataWithheld)
    if (withheld.length > 0) {
      const sources = [...new Set(withheld.map((a) => a.source ?? '?'))].sort().join(', ')
      blocks.push(b.warn(ui().pull.dataWithheld(withheld.length, sources)))
    }
    if (skipped.length) {
      blocks.push(b.info(ui().pull.filesSkipped(skipped.length, skipped.slice(0, 3).map((s) => s.file).join(', '))))
    }
    try {
      const plan = loadPlan(cwd)
      const rows = compare(plan, activities, from, to).filter((r) => r.status !== 'matched')
      if (rows.length) {
        blocks.push(
          b.section(ui().pull.mismatches),
          b.table(
            [ui().pull.columns.date, ui().pull.columns.planned, ui().pull.columns.actual, ui().pull.columns.status],
            rows.slice(-10).map((r) => [
              r.date,
              `${r.plannedKm} km`,
              r.actualKm === undefined ? '—' : `${r.actualKm} km`,
              ui().compare[r.status],
            ]),
            rows.slice(-10).map((r) => (r.status === 'missed' ? 'warn' : 'muted')),
          ),
          b.blank(),
          b.hint(ui().pull.adaptHint),
        )
      } else {
        blocks.push(b.success(ui().pull.allMatched))
      }
    } catch {
      blocks.push(b.info(ui().pull.noPlanSkipped))
    }
    return okDoc(blocks, { activities, wellness, from, to, source: choice?.kind ?? 'hub', skipped })
  } catch (e) {
    return fail(e)
  }
}

function analyzeAdapt(cwd: string, opts: { date?: string | undefined } = {}): CmdResult {
  try {
    const today = opts.date ?? localToday()
    const plan = loadPlan(cwd)
    const config = loadConfig(cwd)
    const snapshot = readSnapshot(cwd)
    const logs = readLog(cwd)
    const execution = buildExecution(plan, snapshot?.activities ?? [], logs, today)

    const currentWeek = plan.weeks.find((w) => w.days.some((d) => d.date === today))
    const currentWeeklyKm = currentWeek?.skeleton.targetKm ?? plan.peakKmPlanned
    const known = new Set((plan.calibration?.results ?? []).map(resultKey))
    const newResults = config.athlete.results.filter(
      (r) => !r.excluded && r.date <= today && (plan.calibration ? !known.has(resultKey(r)) : r.date > plan.generatedAt),
    )
    const allDays = plan.weeks.flatMap((w) => w.days)
    const lastRaceDay = allDays
      .filter((d) => d.workout?.kind === 'race' && d.date <= today && execution.some((e) => e.date === d.date && e.status === 'done'))
      .at(-1)

    // Pomiary (sprawdziany i starty kontrolne) wykonane, ale niewpisane do results —
    // bez tego kroku kalibracja stref stoi w miejscu (W-11).
    const resultDates = new Set(config.athlete.results.map((r) => r.date))
    const tuneUpByDate = new Map(
      (config.athlete.tuneUpRaces ?? []).map((r) => [r.date, r.distanceKm]),
    )
    const uncalibratedTests = allDays
      .filter((d) => {
        if (d.date > today || diffDays(d.date, today) > 60) return false
        const isTest = d.workout?.kind === 'test'
        const isTuneUp = d.workout?.kind === 'race' && tuneUpByDate.has(d.date)
        if (!isTest && !isTuneUp) return false
        if (resultDates.has(d.date)) return false
        return execution.some(e => e.date === d.date && e.status === 'done')
      })
      .map((d) => {
        const log = logs.filter((l) => l.date === d.date).at(-1)
        const measured =
          tuneUpByDate.get(d.date) ??
          d.workout?.segments.find((s) => s.type === 'race')?.distanceKm ??
          0
        return {
          date: d.date,
          distanceKm: measured,
          ...(log?.testTimeSec ? { timeSec: log.testTimeSec } : {}),
        }
      })

    const proposal = analyzeExecution({
      today,
      execution,
      currentWeeklyKm,
      ...(newResults.length ? { newResults } : {}),
      calibrationChanged: plan.calibration !== undefined && JSON.stringify(config.athlete.results.map(resultKey).sort()) !== JSON.stringify(plan.calibration.results.map(resultKey).sort()),
      ...(lastRaceDay ? { lastRace: { date: lastRaceDay.date, distanceKm: tuneUpByDate.get(lastRaceDay.date) ?? plan.goal.distanceKm } } : {}),
      ...(uncalibratedTests.length ? { uncalibratedTests } : {}),
    })

    const compliance = Math.round(proposal.complianceKm * 100)
    const blocks: Block[] = [
      b.title(ui().adapt.title(proposal.windowDays, today)),
      b.kv([
        [ui().adapt.volumeDone, proposal.dataStatus === 'complete' ? String(compliance) + '%' : ui().compare.unknown],
        [ui().adapt.missedSessions, String(proposal.missedSessions)],
      ]),
    ]
    if (!snapshot) {
      blocks.push(b.info(ui().adapt.noSnapshot))
    }
    blocks.push(b.info(ui().improve.dataStatus(proposal.dataStatus, proposal.unknownSessions)))
    if (snapshot) blocks.push(b.info(ui().improve.syncedAt(snapshot.pulledAt)))
    if (proposal.diagnosis.length) {
      blocks.push(b.section(ui().improve.diagnosis), b.bullets(proposal.diagnosis))
    }
    blocks.push(b.section(ui().improve.proposals))
    for (const a of proposal.actions) {
      const refs = a.ruleRefs.length ? ` [${a.ruleRefs.join(', ')}]` : ''
      blocks.push(b.panel(a.type, [a.detail + refs], a.type === 'hold-course' ? 'success' : 'accent'))
    }
    if (proposal.warnings.length) {
      blocks.push(b.blank())
      for (const w of proposal.warnings) blocks.push(b.warn(w))
    }
    const volume = proposal.actions.find((a) => a.suggestedWeeklyKm)
    if (volume) {
      blocks.push(
        b.blank(),
        b.info(ui().adapt.applyHint(volume.suggestedWeeklyKm!)),
      )
    }
    return okDoc(blocks, { proposal, execution, snapshotDate: snapshot?.pulledAt ?? null })
  } catch (e) {
    return fail(e)
  }
}

export function cmdAdapt(cwd: string, opts: { date?: string | undefined; prepare?: boolean | undefined; apply?: string | undefined; commit?: CommitOption } = {}): CmdResult {
  const result = adaptImpl(cwd, opts)
  return opts.apply ? withCommit(result, cwd, opts.commit, PLAN_FILES, ui().commit.apply(opts.apply)) : result
}

function adaptImpl(cwd: string, opts: { date?: string | undefined; prepare?: boolean | undefined; apply?: string | undefined }): CmdResult {
  try {
    if (opts.prepare && opts.apply) throw new Error(ui().improve.proposalOptions)
    if (opts.apply) {
      const saved = applyProposal(cwd, opts.apply)
      return okDoc([b.success(ui().improve.proposalApplied(saved.id))], { applied: true, id: saved.id, changes: saved.changes })
    }
    const result = analyzeAdapt(cwd, opts)
    if (!opts.prepare || result.code !== 0) return result
    const saved = prepareProposal(cwd, opts.date ?? localToday(), result.data!.proposal as ReturnType<typeof analyzeExecution>)
    const blocks = [...result.blocks ?? [], ...proposalBlocks(saved)]
    return okDoc(blocks, { ...result.data, prepared: { id: saved.id, changes: saved.changes, protectedDates: saved.protectedDates, vdot: saved.plan.vdot } })
  } catch (e) { return fail(e) }
}

function proposalBlocks(saved: PlanProposal): Block[] {
  return [
    b.section(ui().improve.changedDays),
    b.kv([[ui().plan.vdot, `${saved.vdotBefore} → ${saved.plan.vdot}`]]),
    b.table([ui().improve.date, ui().improve.before, ui().improve.after], saved.changes.map((c) => [c.date, c.before, c.after])),
    b.info(ui().improve.protected), b.info(ui().improve.changedConfig),
    b.table([ui().improve.date, ui().week.columns.km], saved.plan.weeks.filter((w) => w.days.some((d) => saved.changes.some((c) => c.date === d.date))).map((w) => [w.weekStart, String(w.totalKm)])),
    ...validatePlan(saved.plan).map((issue) => b.warn(describeIssue(issue))),
    b.hint(ui().coach.applyHint(saved.id)),
  ]
}

export function cmdShorten(cwd: string, opts: { date?: string | undefined; minutes?: string | number | undefined; apply?: string | undefined; commit?: CommitOption } = {}): CmdResult {
  try {
    if (opts.apply) {
      if (opts.minutes !== undefined || opts.date !== undefined) throw new Error(ui().coach.options)
      return cmdAdapt(cwd, { apply: opts.apply, commit: opts.commit })
    }
    if (opts.minutes === undefined || String(opts.minutes).trim() === '') throw new Error(ui().coach.options)
    const date = opts.date ?? localToday()
    const { adjustment, proposal } = prepareShortening(cwd, date, Number(opts.minutes))
    if (!adjustment) return okDoc([b.info(ui().coach.noWorkout)], { date, adjustment: null, prepared: null })
    const t = ui().coach
    const blocks: Block[] = [b.title(t.shortenTitle(date)), b.info(t.budget(adjustment.budgetMinutes, adjustment.preparationMinutes, adjustment.strengthMinutes)),
      b.text(t[adjustment.reason]), b.info(t.estimates(String(adjustment.beforeMinutes ?? t.unknown), String(adjustment.afterMinutes ?? t.unknown)))]
    if (adjustment.status !== 'unchanged') blocks.push(b.info(t.heuristic))
    if (proposal) blocks.push(...proposalBlocks(proposal))
    return okDoc(blocks, { date, adjustment, prepared: proposal ? { id: proposal.id, changes: proposal.changes, protectedDates: proposal.protectedDates } : null })
  } catch (e) { return fail(e) }
}

export function cmdDesk(
  cwd: string,
  opts: { date?: string | undefined; heavy?: boolean | undefined } = {},
): CmdResult {
  try {
    const date = opts.date ?? localToday()
    const config = loadConfig(cwd)
    if (!config.desk) {
      return fail(new Error(ui().desk.missingSection))
    }
    let workout: PlannedWorkout | undefined
    try {
      workout = findDay(loadPlan(cwd), date)?.day.workout
    } catch {
      workout = undefined
    }
    const day = planDeskDay(config.desk, workout, { heavyCognitiveDay: opts.heavy === true })
    const blocks: Block[] = [
      b.title(
        ui().desk.title(date),
        ui().desk.subtitle(config.desk.workStart, config.desk.workEnd) +
          (opts.heavy === true ? ` · ${ui().desk.heavyDay}` : ''),
      ),
    ]

    if (workout) {
      blocks.push(
        b.panel(
          `${kindLabel(workout.kind)} · ${workout.distanceKm} km`,
          day.recommended
            ? [ui().desk.proposedWindow(day.recommended.label, day.recommended.from, day.recommended.to)]
            : [ui().desk.noWindowFits],
          KIND_COLOR[workout.kind] ?? 'accent',
        ),
        b.section(ui().desk.windows),
        b.table(
          [ui().desk.columns.window, ui().desk.columns.hours, ui().desk.columns.status],
          day.windows.map((w) => [
            w.label,
            `${w.from}–${w.to}`,
            w.fits ? ui().desk.fits : ui().desk.tooShort,
          ]),
          day.windows.map((w) => (w.fits ? 'success' : 'muted')),
        ),
      )
    } else {
      blocks.push(b.panel(ui().desk.noRunToday, [ui().desk.breaksStay], 'muted'))
    }

    blocks.push(
      b.section(ui().desk.breaksCount(day.breaks.length)),
      b.text(day.breaks.map((x) => `${x.at} ${x.what}`).join('  ·  '), 'muted'),
      b.section(ui().desk.notes),
    )
    for (const g of day.guidance) {
      // regułę „po tempie, nie po odczuciu" wyróżniamy — to jedyna porada,
      // która realnie zmienia sposób prowadzenia sesji (B-10/S-8)
      const isPaceRule = g === messages().desk.heavyDayPaceNotFeel
      blocks.push(opts.heavy === true && isPaceRule ? b.warn(g) : b.text(g))
      blocks.push(b.blank())
    }
    blocks.push(b.hint(ui().desk.rulesHint(day.ruleRefs.join(', '), foundationsUrl())))
    return okDoc(blocks, { day })
  } catch (e) {
    return fail(e)
  }
}

type RescheduleOptions = { block?: string[] | undefined; date?: string | undefined; apply?: boolean | undefined;
  time?: string[] | undefined; pin?: string[] | undefined; preparation?: string | undefined;
  strategy?: string | undefined }

export function cmdReschedule(cwd: string, opts: RescheduleOptions & { commit?: CommitOption } = {}): CmdResult {
  const result = rescheduleImpl(cwd, opts)
  const weekStart = mondayOf(opts.date ?? opts.block?.[0] ?? localToday())
  return opts.apply === true && result.data?.['applied'] === true && (result.data?.['result'] as { changed?: boolean } | undefined)?.changed !== false
    ? withCommit(result, cwd, opts.commit, PLAN_FILES, ui().commit.reschedule(weekStart))
    : result
}

function rescheduleImpl(cwd: string, opts: RescheduleOptions): CmdResult {
  try {
    const date = opts.date ?? opts.block?.[0] ?? localToday()
    const plan = loadPlan(cwd)
    const config = loadConfig(cwd)
    const hit = findDay(plan, date)
    if (!hit) return fail(new Error(ui().log.outsidePlan(date)))
    const weekIndex = plan.weeks.findIndex((w) => w.weekStart === hit.week.weekStart)
    const week = plan.weeks[weekIndex]!

    const timeBudgets: Record<string, number> = {}
    for (const day of week.days) {
      const budget = plan.timeBudgets?.[day.date]
      if (budget !== undefined) timeBudgets[day.date] = budget
    }
    for (const item of opts.time ?? []) {
      const [day, minutes, extra] = item.split('=')
      if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day) || !minutes || extra !== undefined || !Number.isInteger(Number(minutes)) || Number(minutes) < 0 || Number(minutes) > 1440) throw new Error(ui().improve.badBudget)
      timeBudgets[day] = Number(minutes)
    }
    const preparationMinutes = Number(opts.preparation ?? plan.preparationMinutes ?? 15)
    if (!Number.isInteger(preparationMinutes) || preparationMinutes < 0 || preparationMinutes > 120 || (opts.strategy && !['long', 'quality'].includes(opts.strategy))) throw new Error(ui().improve.badBudget)
    const request = {
      week,
      blockedDates: opts.block ?? [],
      availableDays: config.athlete.daysAvailable,
      qualityDayPreference: COACH_STYLE.qualityDayPreference,
      longRunDayPreference: config.athlete.longRunDay ? [config.athlete.longRunDay] : COACH_STYLE.longRunDayPreference,
      ...(Object.keys(timeBudgets).length ? { timeBudgets } : {}),
      preparationMinutes,
      pinnedDates: opts.pin ?? [],
      fixedDates: [...new Set([
        ...week.days.filter((d) => d.date < date || d.date < localToday()).map((d) => d.date),
        ...readLog(cwd).filter((l) => week.days.some((d) => d.date === l.date)).map((l) => l.date),
        ...(readSnapshot(cwd)?.activities ?? []).filter((a) => isRunningActivity(a) && (a.distanceKm ?? 0) > 0 && week.days.some((d) => d.date === a.date)).map((a) => a.date),
      ])],
      strategy: (opts.strategy ?? 'long') as 'long' | 'quality',
    }
    const result = reschedule(request)
    const alternative = reschedule({ ...request, strategy: request.strategy === 'long' ? 'quality' : 'long' })
    const budgetRows = result.days.map((d) => ({ date: d.date,
      minutes: (d.workout ? estimateWorkoutMinutes(d.workout, preparationMinutes) : 0) + (d.strength?.durationMin ?? 0),
      budget: timeBudgets[d.date] ?? null }))
    for (const row of budgetRows) if (row.budget !== null && row.minutes > row.budget) throw new Error(ui().improve.badBudget)
    const constraintsChanged = (opts.pin?.length ?? 0) > 0 || (opts.time?.length ?? 0) > 0 || opts.preparation !== undefined


    const blocks: Block[] = [
      b.title(
        ui().reschedule.title(week.weekStart),
        opts.block?.length
          ? ui().reschedule.blockedDates(opts.block.join(', '))
          : ui().reschedule.noBlocks,
      ),
    ]
    if (!result.changed && !constraintsChanged) {
      blocks.push(b.success(ui().reschedule.unchanged))
      for (const w of result.warnings) blocks.push(b.warn(w))
      return okDoc(blocks, { result, alternative, budgetRows, applied: opts.apply === true })
    }

    blocks.push(
      b.table(
        [
          ui().reschedule.columns.day,
          ui().reschedule.columns.date,
          ui().reschedule.columns.before,
          ui().reschedule.columns.after,
        ],
        week.days.map((before, i) => {
          const after = result.days[i]!
          const label = (k?: string) => (k ? kindLabel(k) : ui().reschedule.none)
          return [
            weekdayShort(before.weekday),
            before.date.slice(5),
            label(before.workout?.kind),
            label(after.workout?.kind),
          ]
        }),
        week.days.map((before, i) =>
          before.workout?.kind === result.days[i]!.workout?.kind
            ? 'muted'
            : result.days[i]!.workout
              ? 'success'
              : 'warn',
        ),
      ),
      b.section(ui().reschedule.whatChanges),
      b.bullets(result.tradeoffs),
    )
    for (const w of result.warnings) blocks.push(b.warn(w))

    blocks.push(b.section(ui().improve.budgetSummary), b.bullets(budgetRows.map((r) => r.date + ': ' + (Number.isFinite(r.minutes) ? r.minutes + ' min' : ui().improve.unknownDuration) + (r.budget === null ? '' : ' / ' + r.budget + ' min'))))
    if (JSON.stringify(alternative.days) !== JSON.stringify(result.days)) {
      blocks.push(b.section(ui().improve.alternatives), b.bullets(alternative.tradeoffs),
        b.hint('--strategy ' + (request.strategy === 'long' ? 'quality' : 'long')))
    }
    if (opts.apply === true) {
      week.days = result.days
      // Solver mógł odpuścić sesję (dropped) — bez przeliczenia totalKm/easyShare
      // zapisany plan kłamałby w sumach i `trainctl check` miałby rację, czerwieniejąc.
      Object.assign(week, weekTotals(week.days))
      // Strength stays on its day except on explicit full-day blocks. The final
      // lint reports new running/strength conflicts without undoing those blocks.
      plan.changes.push({
        at: localToday(),
        action: 'reschedule',
        detail: `${week.weekStart}: ${result.tradeoffs.join('; ')}`,
      })
      plan.timeBudgets = { ...plan.timeBudgets, ...timeBudgets }
      plan.preparationMinutes = preparationMinutes
      for (const issue of validatePlan(plan)) {
        if (issue.severity === 'error') throw new Error(describeIssue(issue))
        blocks.push(b.warn(describeIssue(issue)))
      }
      writePlan(cwd, plan)
      blocks.push(
        b.blank(),
        b.success(ui().reschedule.applied(`${PLAN_YAML} + ${PLAN_MD}`)),
      )
    } else {
      blocks.push(b.blank(), b.hint(ui().reschedule.previewHint))
    }
    return okDoc(blocks, { result, alternative, budgetRows, applied: opts.apply === true })
  } catch (e) {
    return fail(e)
  }
}

export function cmdExport(
  cwd: string,
  opts: { what?: string | undefined; date?: string | undefined } = {},
): CmdResult {
  try {
    const what = (opts.what ?? 'print') as ExportWhat
    if (!['plan', 'workout', 'print', 'calendar', 'race', 'mobile'].includes(what)) {
      return fail(new Error(ui().exportCmd.unknownKind(String(opts.what))))
    }
    const files = runExport(cwd, { what, date: opts.date })
    const total = files.reduce((s, f) => s + f.bytes, 0)

    const blocks: Block[] = [
      b.title(
        (what === 'mobile' ? ui().improve.mobile : ui().exportCmd.titles[what]),
        ui().exportCmd.summary(files.length, (total / 1024).toFixed(1)),
      ),
    ]
    if (files.length <= 8) {
      blocks.push(b.bullets(files.map((f) => `${f.path} — ${f.description}`)))
    } else {
      blocks.push(
        b.bullets(files.slice(0, 5).map((f) => `${f.path} — ${f.description}`)),
        b.text(ui().exportCmd.andMore(files.length - 5, EXPORT_DIR), 'muted'),
      )
    }
    blocks.push(
      b.blank(),
      what === 'mobile' ? b.info(ui().improve.mobileOpen) : what === 'print' || what === 'race'
        ? b.info(ui().exportCmd.printHint)
        : what === 'calendar'
          ? b.info(ui().exportCmd.calendarHint)
          : b.info(ui().exportCmd.fitHint),
    )
    return okDoc(blocks, { files })
  } catch (e) {
    return fail(e)
  }
}

/**
 * Poniedziałkowy przegląd (ADR-021): co było, co to znaczy, co przed nami,
 * co zrobić — w jednym miejscu. Wyłącznie **kompozycja** istniejących
 * use-case'ów: żadnej nowej logiki treningowej. Read-only poza migawką sync.
 */
export async function cmdReview(
  cwd: string,
  opts: { date?: string | undefined; days?: string | undefined; prepare?: boolean | undefined } = {},
  factory: ProviderFactory = defaultProviderFactory,
): Promise<CmdResult> {
  try {
    const today = opts.date ?? localToday()
    parseIso(today)
    const days = Number(opts.days ?? 7)
    if (!Number.isInteger(days) || days < 1 || days > 365) throw new Error(ui().coach.badDays)
    const from = addDays(today, 1 - days)
    const syncFrom = addDays(today, 1 - Math.max(days, 21))
    const plan = loadPlan(cwd)
    const config = loadConfig(cwd)

    // 1) świeże dane, jeśli klucz jest pod ręką; inaczej pracujemy na migawce
    const notes: string[] = []
    let choice: ReturnType<typeof chooseSource>
    try {
      choice = chooseSource(cwd, undefined, factory)
    } catch (e) {
      notes.push(ui().review.refreshFailed(e instanceof Error ? e.message : String(e)))
    }
    if (choice) {
      try {
        const provider = choice.source
        const [activities, wellness] = await Promise.all([
          provider.listActivities(syncFrom, today),
          provider.listWellness(syncFrom, today).catch(() => []),
        ])
        writeSnapshot(cwd, { pulledAt: today, from: syncFrom, to: today, activities, wellness })
        if (choice.kind === 'files') notes.push(ui().review.fromFiles(choice.label))
      } catch (e) {
        notes.push(ui().review.refreshFailed(e instanceof Error ? e.message : String(e)))
      }
    } else if (!notes.length) {
      notes.push(ui().review.noKey)
    }

    const snapshot = readSnapshot(cwd)
    const logs = readLog(cwd)
    const blocks: Block[] = [
      b.title(
        ui().review.title,
        ui().review.subtitle(from, today, plan.goal.name, plan.goal.date),
      ),
    ]
    for (const n of notes) blocks.push(b.info(n))
    blocks.push(...compatibilityNotes(plan))
    blocks.push(b.info(ui().coach.reviewWindow(from, today, days)))

    // 2) co się wydarzyło — te same porównania co w trainctl pull
    const rows = compare(plan, snapshot?.activities ?? [], from, today, logs)
    const plannedKm = rows.reduce((s, r) => s + r.plannedKm, 0)
    const actualKm = rows.reduce((s, r) => s + (r.actualKm ?? 0), 0)
    const execution = buildExecution(plan, snapshot?.activities ?? [], logs, today).filter(e => e.date >= from)
    const done = execution.filter(e => e.status === 'done').length
    const missed = rows.filter((r) => r.status === 'missed')
    blocks.push(
      b.section(ui().review.pastWeek),
      b.kv([
        [ui().review.volume, ui().review.volumeValue(Math.round(actualKm), Math.round(plannedKm))],
        [ui().review.doneSessions, `${done}/${rows.filter((r) => r.plannedKm > 0).length}`],
        ...(missed.length
          ? ([[ui().compare.missed, missed.map((r) => r.date.slice(5)).join(', ')]] as [string, string][])
          : []),
      ]),
    )
    blocks.push(b.section(ui().coach.reviewFacts), b.table([ui().improve.date, ui().improve.before, ui().improve.after, ui().improve.data],
      execution.filter(e => e.kind || e.status === 'unplanned').map(e => [e.date, `${e.plannedKm} km`, e.actualKm === undefined ? ui().compare.unknown : `${e.actualKm} km`, ui().coach.status[e.status]])))
    const unknown = execution.filter(e => e.status === 'unknown').map(e => e.date)
    if (unknown.length) blocks.push(b.warn(ui().coach.reviewUnknown(unknown.join(', '))))

    // 2b) ślad subiektywny — dziennik cytowany dosłownie, po jednym wpisie na
    // datę (późniejszy nadpisuje wcześniejszy, jak w logFor). Żadnej agregacji
    // ani progów: interpretacja odczuć należy do rozmowy z trenerem-agentem,
    // silnik z RPE niczego nie liczy (ADR-027, Z-4).
    const latestByDate = new Map<string, LogEntry>()
    for (const l of logs) if (l.date >= from && l.date <= today) latestByDate.set(l.date, l)
    const feel = [...latestByDate.values()]
      .filter((l) => l.rpe !== undefined || l.note)
      .sort((a, z) => a.date.localeCompare(z.date))
    // RPE wpisane w hubie (zegarek, aplikacja) — tylko tam, gdzie dziennik go nie ma:
    // własny wpis biegacza ma pierwszeństwo, a źródło jest nazwane wprost.
    const hubFeel = (snapshot?.activities ?? [])
      .filter((a) => a.rpe !== undefined && a.date >= from && a.date <= today && isRunningActivity(a) && latestByDate.get(a.date)?.rpe === undefined)
      .sort((a, z) => a.date.localeCompare(z.date))
    if (feel.length || hubFeel.length) {
      const lines = [
        ...feel.map((l) => ({ date: l.date, text: ui().review.feelLine(l.date, l.rpe, l.note) })),
        ...hubFeel.map((a) => ({ date: a.date, text: ui().review.feelFromHub(a.date, a.rpe!, a.source ?? 'intervals.icu') })),
      ].sort((a, z) => a.date.localeCompare(z.date))
      blocks.push(b.section(ui().review.feel), b.bullets(lines.map((l) => l.text)))
    }

    // 2c) kontekst z zegarka — cytowany jak odczucia: bez średnich, progów i
    // wniosków (ADR-027). HRV i CTL/ATL świadomie pomijamy: gotowości z HRV silnik
    // odmawia (H-1), a obciążenia z huba to deskryptory, nie wskazówki (P-4) —
    // pokazane obok planu zaczęłyby sterować decyzjami.
    const wellnessLines = (snapshot?.wellness ?? [])
      .filter((w) => w.date >= from && w.date <= today)
      .sort((a, z) => a.date.localeCompare(z.date))
      .map((w) => ui().review.wellnessLine(w.date, w.restingHr, w.sleepSec, w.weightKg))
      .filter((line): line is string => line !== undefined)
    if (wellnessLines.length) blocks.push(b.section(ui().review.wellness), b.bullets(wellnessLines))

    // 3) sygnały adaptacji — sekcja pojawia się tylko wtedy, gdy jest co powiedzieć
    const adapt = cmdAdapt(cwd, { date: today })
    if (adapt.code !== 0) return adapt
    const adaptation = adapt.data?.proposal as ReturnType<typeof analyzeExecution> | undefined
    const meaningful = adaptation?.actions.some((a) => a.type !== 'hold-course') === true
    if (adapt.code === 0 && meaningful) {
      blocks.push(b.section(ui().review.signals))
      const lines = adaptation?.actions.filter((a) => a.type !== 'hold-course').map((a) => a.detail) ?? []
      blocks.push(b.bullets(lines.length ? lines : [ui().review.seeAdapt]))
    } else {
      blocks.push(adaptation?.dataStatus === 'complete' ? b.success(ui().review.noSignals) : b.warn(messages().adapt.incompleteData))
    }

    // 4) co przed nami — bieżący tydzień, dopóki coś w nim jeszcze zostało
    // (w poniedziałek „przed nami" to tydzień, który się właśnie zaczyna),
    // a gdy jest już wybiegany do końca — następny
    const thisWeekStart = mondayOf(today)
    const thisWeek = plan.weeks.find((w) => w.weekStart === thisWeekStart)
    const finishedDates = new Set(execution.filter(e => e.status === 'done' || e.status === 'missed').map(e => e.date))
    const isUpcoming = (d: { date: string; workout?: PlannedWorkout }) => d.workout && d.date >= today && !finishedDates.has(d.date)
    const hasFuture = thisWeek?.days.some(isUpcoming) === true
    const week =
      (hasFuture ? thisWeek : plan.weeks.find((w) => w.weekStart === mondayOf(addDays(today, 7)))) ??
      plan.weeks.find((w) => w.days.some((d) => d.date >= today))
    if (week) {
      const sk = week.skeleton
      const upcoming = week.days.filter(isUpcoming)
      blocks.push(
        b.section(ui().review.ahead(week.weekStart)),
        b.kv([
          [
            ui().review.phase,
            `${phaseLabel(sk.phase)}${sk.deload ? ` · ${ui().today.deload}` : ''}`,
          ],
          // pozostałe km liczone tą samą miarą co totalKm (objętość treningowa, bez dystansu startu)
          [ui().review.volume, ui().review.volumeAhead(Math.round(upcoming.reduce((s, d) => s + (d.workout?.distanceKm ?? 0), 0) * 10) / 10, week.totalKm, upcoming.length)],
          [ui().review.toRace, ui().review.toRaceValue(diffDays(today, plan.goal.date))],
        ]),
      )
      const race = upcoming.find((d) => d.workout?.kind === 'race')
      const test = upcoming.find((d) => d.workout?.kind === 'test')
      if (race) blocks.push(b.warn(ui().review.raceThisWeek(race.date)))
      if (test) blocks.push(b.warn(ui().review.timeTrialThisWeek(test.date)))
      const key = upcoming.find((d) =>
        ['quality_intervals', 'quality_continuous'].includes(d.workout!.kind),
      )
      if (key) {
        blocks.push(
          b.panel(
            `${ui().review.keySession} · ${key.date}`,
            [workoutText(key), kindPurpose(key.workout!.kind)],
            KIND_COLOR[key.workout!.kind] ?? 'accent',
          ),
        )
      }
    }

    // 5) konkretne następne kroki
    const todo: string[] = []
    // Niedomkniętą kalibrację rozpoznajemy po NAZWIE POLA, nie po zdaniu:
    // `athlete.results` brzmi tak samo w każdym języku, a polski literał
    // sprawiłby, że ta gałąź milczy w angielskim interfejsie.
    if (adaptation?.actions.some((a) => a.type === 'recalibrate-zones')) todo.push(ui().review.todoWriteResult)
    if (meaningful) todo.push(ui().review.todoSeeAdapt)
    if (choice?.kind === 'hub') todo.push(ui().review.todoPush)
    else todo.push(ui().review.todoPrint)
    if (missed.length >= 2) todo.push(ui().review.todoReschedule)
    const nextRace = (config.athlete.tuneUpRaces ?? []).find((r) => r.date > today)
    if (nextRace) {
      todo.push(
        ui().review.todoNextRace(nextRace.date, nextRace.name ?? `${nextRace.distanceKm} km`),
      )
    }
    blocks.push(b.section(ui().review.todo), b.bullets(todo))
    let prepared: { id: string; changes: PlanProposal['changes']; protectedDates: string[]; vdot: number } | null = null
    let preparation: { status: 'not-requested' | 'prepared' | 'no-change' | 'blocked'; reason?: string } = { status: 'not-requested' }
    if (opts.prepare && adaptation) {
      try {
        const saved = prepareProposal(cwd, today, adaptation)
        prepared = { id: saved.id, changes: saved.changes, protectedDates: saved.protectedDates, vdot: saved.plan.vdot }
        preparation = { status: 'prepared' }
        blocks.push(...proposalBlocks(saved))
      } catch (e) {
        const reason = e instanceof Error ? e.message : String(e)
        preparation = { status: reason === ui().improve.noPatch ? 'no-change' : 'blocked', reason }
        blocks.push(reason === ui().improve.noPatch ? b.info(ui().coach.reviewNoChange) : b.warn(ui().coach.reviewBlocked(reason)))
      }
    } else blocks.push(b.hint(ui().coach.reviewHint))
    return okDoc(blocks, { rows, execution, period: { from, to: today, days }, adaptation: adaptation ?? null, upcoming: week ?? null, notes, preparation, prepared })
  } catch (e) {
    return fail(e)
  }
}

/**
 * Jedno ustalenie walidatora → zdanie w języku interfejsu. Etykiety jednostek
 * i dni tygodnia idą przez katalog (kindLabel/weekday), ID reguł zostają surowe —
 * to odnośniki do FOUNDATIONS §10, nie tekst do tłumaczenia.
 */
function describeIssue(issue: PlanIssue): string {
  const t = ui().check
  const label = (kind?: string) => (kind ? kindLabel(kind) : '')
  const weekdayLabel = (wd?: string) =>
    wd && wd in messages().weekday ? messages().weekday[wd as Weekday] : (wd ?? '')
  let text: string
  switch (issue.code) {
    case 'weeksMissing':
      text = t.weeksMissing(PLAN_YAML)
      break
    case 'goalMissing':
      text = t.goalMissing(PLAN_YAML)
      break
    case 'malformed':
      text = t.malformed(issue.date)
      break
    case 'weekLength':
      text = t.weekLength(issue.date, issue.actual ?? 0)
      break
    case 'weekStartNotMonday':
      text = t.weekStartNotMonday(issue.date)
      break
    case 'weeksNotContiguous':
      text = t.weeksNotContiguous(issue.date, issue.otherDate ?? '')
      break
    case 'dayOutOfPlace':
      text = t.dayOutOfPlace(issue.date, issue.otherDate ?? '')
      break
    case 'weekdayMismatch':
      text = t.weekdayMismatch(issue.date, weekdayLabel(issue.kind), weekdayLabel(issue.otherKind))
      break
    case 'targetKmMismatch':
      text = ui().improve.targetMismatch(issue.date, issue.expected ?? 0, issue.actual ?? 0)
      break
    case 'frequencyMismatch':
      text = ui().improve.frequencyMismatch(issue.date, issue.expected ?? 0, issue.actual ?? 0)
      break
    case 'totalKmDesync':
      text = t.totalKmDesync(issue.date, issue.expected ?? 0, issue.actual ?? 0)
      break
    case 'easyShareDesync':
      text = t.easyShareDesync(
        issue.date,
        Math.round((issue.expected ?? 0) * 100),
        Math.round((issue.actual ?? 0) * 100),
      )
      break
    case 'workoutKmDesync':
      text = t.workoutKmDesync(issue.date, label(issue.kind), issue.expected ?? 0, issue.actual ?? 0)
      break
    case 'raceDayMissing':
      text = t.raceDayMissing(issue.date)
      break
    case 'accentGap':
      text = t.accentGap(issue.date, issue.otherDate ?? '', label(issue.kind), label(issue.otherKind))
      break
    case 'workoutBeforeRace':
      text = t.workoutBeforeRace(issue.date, label(issue.kind), issue.otherDate ?? '')
      break
    case 'longInTaper':
      text = t.longInTaper(issue.date)
      break
    case 'hillsInTaper':
      text = t.hillsInTaper(issue.date)
      break
    case 'strengthInTaper':
      text = t.strengthInTaper(issue.date)
      break
    case 'strengthOnQualityDay':
      text = t.strengthOnQualityDay(issue.date, label(issue.kind))
      break
    case 'strengthDayBeforeQuality':
      text = t.strengthDayBeforeQuality(issue.date, label(issue.otherKind), issue.otherDate ?? '')
      break
    case 'strengthOnLongDay':
      text = t.strengthOnLongDay(issue.date, label(issue.kind))
      break
    case 'strengthGap':
      text = t.strengthGap(issue.date, issue.otherDate ?? '')
      break
    case 'easyShareLow':
      text = t.easyShareLow(issue.date, Math.round((issue.actual ?? 0) * 100))
      break
    case 'longOverCap':
      text = t.longOverCap(issue.date, issue.actual ?? 0, issue.expected ?? 0)
      break
    case 'qualityWithoutFrame':
      text = t.qualityWithoutFrame(issue.date, label(issue.kind))
      break
    case 'taperNotMonotonic':
      text = t.taperNotMonotonic(issue.date, issue.actual ?? 0, issue.expected ?? 0)
      break
  }
  return issue.ruleRefs.length ? `${text} [${issue.ruleRefs.join(', ')}]` : text
}

export function cmdCheck(cwd: string, opts: { strict?: boolean | undefined } = {}): CmdResult {
  try {
    // Czytamy surowy dokument, nie `loadPlan`: lint jest jedyną komendą, która ma
    // o połamanym pliku opowiedzieć zamiast odmówić działania.
    const doc = readPlanDocument(cwd)
    const plan = (doc && typeof doc === 'object' ? doc : {}) as Partial<StoredPlan>
    const issues = validatePlan({ weeks: plan.weeks, goal: plan.goal })
    const errors = issues.filter((i) => i.severity === 'error')
    const warns = issues.filter((i) => i.severity === 'warn')
    const t = ui().check
    // Wersja silnika to informacja, nie ustalenie lintu: nie liczy się do --strict.
    const versionNotes = plan.goal && Array.isArray(plan.weeks) ? compatibilityNotes(plan as StoredPlan) : []

    if (issues.length === 0) {
      const weeks = plan.weeks ?? []
      const sessions = weeks.reduce((sum, w) => sum + w.days.filter((d) => d.workout).length, 0)
      return okDoc([b.success(t.passed(weeks.length, sessions)), ...versionNotes], { issues: [], errors: 0, warnings: 0 })
    }

    const blocks: Block[] = [b.title(t.title, t.subtitle(PLAN_YAML)), ...versionNotes]
    if (errors.length) {
      blocks.push(b.section(t.errorsSection))
      for (const issue of errors) blocks.push(b.error(describeIssue(issue)))
    }
    if (warns.length) {
      blocks.push(b.section(t.warnsSection))
      for (const issue of warns) blocks.push(b.warn(describeIssue(issue)))
    }
    blocks.push(b.blank(), b.text(t.summary(errors.length, warns.length)))
    const failed = errors.length > 0 || (opts.strict === true && warns.length > 0)
    if (opts.strict === true && errors.length === 0 && warns.length > 0) {
      blocks.push(b.text(t.strictNote, 'muted'))
    } else if (!failed && warns.length > 0) {
      blocks.push(b.hint(t.strictHint))
    }
    return { output: renderPlain(blocks), code: failed ? 1 : 0, blocks, data: { issues, errors: errors.length, warnings: warns.length } }
  } catch (e) {
    return fail(e)
  }
}

/**
 * Reguły silnika po ID — dla agenta, który nie ma FOUNDATIONS na dysku, i dla
 * człowieka, który chce zobaczyć całą listę (`trainctl rules`).
 */
export function cmdRules(opts: { id?: string | undefined } = {}): CmdResult {
  try {
    const t = ui().rulesCmd
    const ids = [...Object.keys(ui().rules), 'E-1'].sort((a, z) => a.localeCompare(z, 'en', { numeric: true }))
    const url = foundationsUrl()
    if (!opts.id) {
      return okDoc([
        b.title(t.title, t.subtitle(ids.length)),
        b.bullets(ids.map((id) => ui().why.ruleLine(id, ruleExplain(id), ui().improve[ruleEvidence(id)]))),
        b.blank(),
        b.hint(ui().why.sourcesHint(url, '§10')),
      ], { rules: ids.map((id) => ({ id, explanation: ruleExplain(id), origin: ruleEvidence(id) })), source: url })
    }
    const id = opts.id.trim().toUpperCase()
    const explanation = ruleExplain(id)
    if (!explanation) throw new Error(t.unknown(opts.id, ids.join(', ')))
    const origin = ruleEvidence(id)
    return okDoc([
      b.title(id, ui().improve[origin]),
      b.text(explanation),
      b.blank(),
      b.hint(ui().why.sourcesHint(url, '§10')),
    ], { id, explanation, origin, source: url })
  } catch (e) {
    return fail(e)
  }
}

/**
 * Kształt jednostki bez opisów i temp: typy członów, powtórzenia, dystanse.
 * Po tym poznajemy przebudowę akcentu (6×800 → 4×1200) przy tej samej objętości —
 * sam rodzaj i suma kilometrów by ją przemilczały.
 */
const segmentShape = (workout: PlannedWorkout): string =>
  (workout.segments ?? [])
    .map((s) => `${s.type}/${s.reps ?? 0}×${s.repM ?? 0}/${Math.round((s.distanceKm ?? 0) * 10)}`)
    .join('|')

const kmDiffers = (a: number | undefined, b: number | undefined): boolean =>
  Math.abs((a ?? 0) - (b ?? 0)) > 0.05

/**
 * Różnice tydzień po tygodniu, dzień po dniu — po danych planu (rodzaj, objętość,
 * układ członów, siła), nie po opisach: te zależą od języka katalogu.
 */
function diffWeeks(from: StoredPlan['weeks'], to: StoredPlan['weeks']): string[] {
  const t = ui().diff
  const lines: string[] = []
  const toByStart = new Map(to.map((w) => [w.weekStart, w]))
  for (const week of from) {
    const f = toByStart.get(week.weekStart)
    if (!f) {
      lines.push(t.weekGone(week.weekStart))
      continue
    }
    if (f.skeleton.targetKm !== week.skeleton.targetKm) {
      lines.push(t.weekVolume(week.weekStart, week.skeleton.targetKm, f.skeleton.targetKm))
    }
    // targetKm to zamiar szkieletu, totalKm — plan faktycznie rozpisany na dni.
    // Scenariusz bywa zmianą wyłącznie tego drugiego (skrócone jednostki).
    if (kmDiffers(week.totalKm, f.totalKm)) {
      lines.push(t.weekTotalKm(week.weekStart, week.totalKm ?? 0, f.totalKm ?? 0))
    }
    const fd = new Map(f.days.map((d) => [d.date, d]))
    for (const day of week.days) {
      const other = fd.get(day.date)
      const a = day.workout
      const c = other?.workout
      const aKind = a?.kind ?? ui().week.rest
      const cKind = c?.kind ?? ui().week.rest
      if (aKind !== cKind) {
        lines.push(t.dayChanged(day.date, aKind, cKind))
      } else if (a && c) {
        if (kmDiffers(a.distanceKm, c.distanceKm)) {
          lines.push(t.dayDistance(day.date, aKind, a.distanceKm, c.distanceKm))
        } else if (segmentShape(a) !== segmentShape(c)) {
          lines.push(t.daySegments(day.date, aKind))
        }
      }
      // Siła to osobny tor (nie WorkoutKind), więc jej pojawienie się albo znik
      // nie ruszy porównania biegania — trzeba o nią zapytać wprost.
      if (!other) continue
      const as = day.strength
      const cs = other.strength
      if (!as && cs) lines.push(t.strengthAdded(day.date, cs.durationMin))
      else if (as && !cs) lines.push(t.strengthGone(day.date))
      else if (as && cs && as.durationMin !== cs.durationMin) {
        lines.push(t.strengthDuration(day.date, as.durationMin, cs.durationMin))
      }
    }
  }
  for (const w of to) {
    if (!from.some((s) => s.weekStart === w.weekStart)) {
      lines.push(t.weekNew(w.weekStart, w.skeleton.targetKm))
    }
  }
  return lines
}

/**
 * Porównanie scenariuszowe: bieżący plan vs plan z innego pliku (inna gałąź,
 * worktree, kopia). Obie strony to zapisane plany — poza układem tygodni
 * porównujemy też cel, kalibrację i predykcję, bo scenariusz zwykle zmienia
 * właśnie je („co jeśli przełożę start o trzy tygodnie?").
 */
function diffAgainstPlanFile(stored: StoredPlan, path: string): CmdResult {
  const other = loadPlanFile(path)
  const t = ui().diff
  const lines: string[] = []
  // Dystans jest częścią celu tak samo jak data: scenariusz „ten sam start, ale
  // połówka zamiast maratonu" nie zmienia ani nazwy, ani terminu.
  const goalOf = (p: StoredPlan) =>
    t.goalDesc(
      p.goal.name,
      p.goal.distanceKm,
      p.goal.date,
      p.goal.targetTimeSec ? fmtTime(p.goal.targetTimeSec) : '',
    )
  if (goalOf(stored) !== goalOf(other)) lines.push(t.goalChanged(goalOf(stored), goalOf(other)))
  if (stored.vdot !== other.vdot) lines.push(t.vdotChanged(stored.vdot, other.vdot))
  const predOf = (p: StoredPlan) =>
    p.prediction ? `${fmtTime(p.prediction.loSec)}–${fmtTime(p.prediction.hiSec)}` : undefined
  const predA = predOf(stored)
  const predB = predOf(other)
  if (predA && predB && predA !== predB) lines.push(t.predictionChanged(predA, predB))
  lines.push(...diffWeeks(stored.weeks, other.weeks))
  if (lines.length === 0) {
    return okDoc([b.success(t.identical(path))])
  }
  return okDoc([b.title(t.titleFile(path)), b.bullets(lines)])
}

export function cmdDiff(cwd: string, opts: { plan?: string | undefined } = {}): CmdResult {
  try {
    const stored = loadPlan(cwd)
    if (opts.plan) {
      return diffAgainstPlanFile(stored, isAbsolute(opts.plan) ? opts.plan : join(cwd, opts.plan))
    }
    const config = loadConfig(cwd)
    // Dry-run dokładnie tej regeneracji, którą wykona `plan` (ADR-033) — inaczej
    // diff pokazywałby zmiany dni, których plan i tak nie ruszy.
    const rebuild = rebuildPlan(stored, config, { today: localToday(), recorded: recordedDates(cwd) })
    const fresh = rebuild.plan
    const lines: string[] = []
    if (rebuild.protectedDays.some((p) => p.reason === 'edited')) {
      lines.push(ui().diff.manualShifts)
    }
    // Sam `diff` porównuje rodzaje jednostek (klucze), więc zmiana języka go nie
    // ruszy — ale opisy w plan/PLAN.md zostają w starym. Mówimy o tym wprost,
    // bo inaczej „plan aktualny" byłoby nieprawdą wobec tego, co widzi biegacz.
    const current = getLocale()
    const staleLocale = stored.locale !== undefined && stored.locale !== current
    lines.push(...diffWeeks(stored.weeks, fresh.weeks))
    const localeNote = staleLocale
      ? [b.warn(ui().diff.localeChanged(stored.locale!, current))]
      : []
    if (lines.length === 0 && rebuild.upToDate) {
      return okDoc([b.success(ui().diff.upToDate), ...localeNote], { regeneration: regenerationData(rebuild) })
    }
    return okDoc([
      b.title(ui().diff.title),
      b.bullets(lines.length ? lines : [ui().diff.metadataOnly]),
      ...regenerationBlocks(stored, rebuild, { diffLines: false }),
      ...localeNote,
      b.blank(),
      b.hint(ui().diff.applyHint),
    ], { regeneration: regenerationData(rebuild) })
  } catch (e) {
    return fail(e)
  }
}

/** Metody źródła jako zwykłe funkcje — `this` klasy zostaje przy nich. */
function pick(source: ActivitySource): Pick<ActivitySource, 'listActivities' | 'listWellness'> {
  return {
    listActivities: (a, z) => source.listActivities(a, z),
    listWellness: (a, z) => source.listWellness(a, z),
  }
}

export function daysToRace(plan: { goal: { date: string } }, today: string): number {
  return diffDays(today, plan.goal.date)
}
