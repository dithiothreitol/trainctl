/** Handlery komend CLI — czyste funkcje (cwd, argumenty) → { output, code }. */
import { existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  addDays,
  analyzeExecution,
  diffDays,
  getLocale,
  inferProfile,
  messages,
  mondayOf,
  planDeskDay,
  reschedule,
  COACH_STYLE,
  INFER_WINDOW_WEEKS,
  type ExecutionRecord,
  type InferenceOutcome,
  type PlannedWorkout,
  type SyncedActivity,
  type Weekday,
} from '@trainctl/core'
import { AGENTS_FILE, agentsTemplate } from './agents-md.ts'
import { ui } from './i18n/index.ts'
import { inferredConfigYaml, loadConfig, writeConfigTemplate, CONFIG_FILE } from './config.ts'
import { appendLog, logFor, parseTime, readLog, type LogEntry } from './logfile.ts'
import {
  applyStrength,
  computePlan,
  findDay,
  fmtTime,
  loadPlan,
  shiftWorkout,
  workoutText,
  writePlan,
  PLAN_MD,
  PLAN_YAML,
  type StoredPlan,
} from './planfile.ts'
import { kindPurpose, ruleExplain } from './rules-explain.ts'
import { runExport, EXPORT_DIR, type ExportWhat } from './export.ts'
import { b, renderPlain, type Block } from './ui/blocks.ts'
import type { ColorName } from './ui/theme.ts'

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
  compare,
  defaultProviderFactory,
  defaultRange,
  hasApiKey,
  readSnapshot,
  workoutsToPush,
  writeSnapshot,
  SYNC_FILE,
  type ProviderFactory,
} from './sync.ts'

// dla MCP (importuje wyłącznie z @trainctl/cli = commands.ts)
export { defaultProviderFactory, hasApiKey, type ProviderFactory } from './sync.ts'
export { readConfigLanguage } from './config.ts'
// serwer MCP opisuje narzędzia tym samym katalogiem, co CLI
export { ui, type CliMessages } from './i18n/index.ts'

/** Wykonanie = plan × (aktywności z sync ∪ wpisy z dziennika). */
export function buildExecution(
  plan: StoredPlan,
  activities: SyncedActivity[],
  logs: LogEntry[],
  today: string,
): ExecutionRecord[] {
  const actualByDate = new Map<string, number>()
  for (const a of activities) {
    if (!/run/i.test(a.type)) continue
    actualByDate.set(a.date, (actualByDate.get(a.date) ?? 0) + (a.distanceKm ?? 0))
  }
  const logByDate = new Map<string, LogEntry>()
  for (const l of logs) logByDate.set(l.date, l)

  const out: ExecutionRecord[] = []
  const seen = new Set<string>()
  for (const week of plan.weeks) {
    for (const day of week.days) {
      if (day.date > today) continue
      seen.add(day.date)
      const log = logByDate.get(day.date)
      const synced = actualByDate.get(day.date)
      const plannedKm = day.workout?.distanceKm ?? 0
      const actualKm = synced ?? log?.km ?? (log?.status === 'done' ? plannedKm : undefined)
      let status: ExecutionRecord['status']
      if (!day.workout) status = actualKm ? 'unplanned' : 'rest'
      else if (actualKm && actualKm > 0) status = 'done'
      else status = 'missed'
      out.push({
        date: day.date,
        plannedKm,
        ...(actualKm !== undefined && actualKm > 0 ? { actualKm } : {}),
        ...(day.workout ? { kind: day.workout.kind } : {}),
        status,
      })
    }
  }
  for (const [date, km] of actualByDate) {
    if (seen.has(date) || date > today) continue
    out.push({ date, plannedKm: 0, actualKm: km, status: 'unplanned' })
  }
  return out.sort((a, b) => a.date.localeCompare(b.date))
}

export interface CmdResult {
  /** Czysty tekst — to widzi MCP/agent i potok. */
  output: string
  code: number
  /** Semantyczny opis wyjścia — CLI renderuje z kolorami. */
  blocks?: Block[]
}

const ok = (output: string): CmdResult => ({ output, code: 0 })
/** Wynik opisany blokami: CLI dostaje kolor, MCP ten sam tekst bez ozdobników. */
const okDoc = (blocks: Block[]): CmdResult => ({ output: renderPlain(blocks), code: 0, blocks })
const fail = (e: unknown): CmdResult => {
  const message = e instanceof Error ? e.message : String(e)
  return { output: message, code: 1, blocks: [b.error(message)] }
}

export function localToday(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

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

export function cmdInit(cwd: string, content?: string): CmdResult {
  try {
    writeConfigTemplate(cwd, content)
    const agents = writeAgentsFile(cwd)
    return okDoc([
      b.success(ui().init.created(CONFIG_FILE)),
      ...(agents ? [b.success(ui().init.createdAgents(AGENTS_FILE))] : []),
      ...(content
        ? []
        : [
            b.text(ui().init.fillProfile),
          ]),
      b.hint(ui().common.nextStep('trainctl plan')),
    ])
  } catch (e) {
    return fail(e)
  }
}

export function cmdPlan(cwd: string, opts: { date?: string | undefined } = {}): CmdResult {
  try {
    const today = opts.date ?? localToday()
    const config = loadConfig(cwd)
    const plan = computePlan(config, today)
    writePlan(cwd, plan)

    const weeksToRace = plan.weeks.length
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
    plan.weeks.forEach((w, i) => {
      const label = phaseLabel(w.skeleton.phase)
      if (label !== current) {
        if (current) phases.push(ui().plan.phaseSpan(current, from + 1, i))
        current = label
        from = i
      }
    })
    if (current) phases.push(ui().plan.phaseSpan(current, from + 1, plan.weeks.length))
    blocks.push(b.section(ui().plan.structure), b.bullets(phases))

    if (plan.feasibilityWarnings.length) {
      blocks.push(b.blank())
      for (const w of plan.feasibilityWarnings) blocks.push(b.warn(w))
    }
    blocks.push(
      b.blank(),
      b.success(ui().common.saved(`${PLAN_YAML} + ${PLAN_MD}`)),
      b.hint('trainctl today · trainctl week · trainctl why'),
    )
    return okDoc(blocks)
  } catch (e) {
    return fail(e)
  }
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
        `${ui().today.weekOf(sk.index + 1, plan.weeks.length)} · ${phaseLabel(sk.phase)}` +
          `${sk.deload ? ` · ${ui().today.deload}` : ''} · ${ui().today.daysToRace(toRace)}`,
      ),
    ]

    if (!day.workout) {
      blocks.push(b.panel(ui().today.restDayTitle, [ui().today.restDayBody], 'muted'))
    } else {
      const w = day.workout
      blocks.push(
        b.panel(
          `${kindLabel(w.kind)} · ${w.distanceKm} km`,
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
            (entry.note ? ` — ${entry.note}` : ''),
        ),
      )
    }
    if (day.workout) blocks.push(b.hint(ui().today.whyHint(date)))
    return okDoc(blocks)
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
    const model = sk.intensityModel === 'pyramidal' ? 'piramidalnie' : 'polaryzacja'
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
        day.workout ? `${day.workout.distanceKm} km` : '—',
        day.workout ? `${workoutText(day)}${strength}${mark}` : `${ui().week.rest}${strength}`,
      ])
      accents.push(kind ? KIND_COLOR[kind] : 'muted')
    }
    const blocks: Block[] = [
      b.title(
        ui().week.title(sk.index + 1, plan.weeks.length, week.weekStart),
        ui().week.subtitle(phaseLabel(sk.phase), model, sk.targetKm, week.totalKm) +
          (sk.deload ? ` · ${ui().week.deloadUpper}` : ''),
      ),
      b.table([ui().week.columns.day, ui().week.columns.date, ui().week.columns.km, ui().week.columns.workout], rows, accents),
    ]
    if (sk.raceDate) blocks.push(b.info(ui().week.raceThisWeek(sk.raceDate)))
    if (sk.keepIntensity) {
      blocks.push(b.info(ui().week.taperNote))
    }
    return okDoc(blocks)
  } catch (e) {
    return fail(e)
  }
}

export function cmdLog(
  cwd: string,
  opts: {
    date?: string | undefined
    status?: string | undefined
    km?: string | undefined
    time?: string | undefined
    note?: string | undefined
  } = {},
): CmdResult {
  try {
    const date = opts.date ?? localToday()
    const plan = loadPlan(cwd)
    if (!findDay(plan, date)) return fail(new Error(ui().log.outsidePlan(date)))
    const status = (opts.status ?? 'done') as 'done' | 'skipped' | 'modified'
    if (!['done', 'skipped', 'modified'].includes(status)) {
      return fail(new Error(ui().log.unknownStatus(String(opts.status))))
    }
    appendLog(cwd, {
      date,
      status,
      ...(opts.km ? { km: Number(opts.km) } : {}),
      ...(opts.time ? { timeSec: parseTime(opts.time) } : {}),
      ...(opts.note ? { note: opts.note } : {}),
      loggedAt: new Date().toISOString(),
    })
    return ok(ui().log.saved(date, status))
  } catch (e) {
    return fail(e)
  }
}

export function cmdShift(cwd: string, opts: { from: string; to: string }): CmdResult {
  try {
    const plan = loadPlan(cwd)
    const { warnings } = shiftWorkout(plan, opts.from, opts.to)
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
    const plan = loadPlan(cwd)
    const hit = findDay(plan, date)
    if (!hit) return ok(ui().common.outsidePlan(date, plan.weeks[0]?.weekStart ?? '', plan.goal.date))
    const { week, day } = hit
    const sk = week.skeleton
    const blocks: Block[] = [
      b.title(
        ui().why.title(date),
        ui().why.phaseLine(phaseLabel(sk.phase), messages().intensityModel[sk.intensityModel]) +
          (sk.deload ? ` · ${ui().why.deloadWeek}` : ''),
      ),
    ]
    if (!day.workout && !day.strength) {
      blocks.push(b.text(ui().why.restDay))
      return okDoc(blocks)
    }
    if (day.strength) {
      blocks.push(
        b.panel(ui().today.strengthTitle(day.strength.durationMin), [day.strength.description], 'accent'),
        b.section(ui().why.strengthPurposeTitle),
        b.text(ui().why.strengthPurpose),
      )
      const refs = day.strength.ruleRefs.filter(ruleExplain).map((r) => `${r} — ${ruleExplain(r)}`)
      if (refs.length) blocks.push(b.section(ui().why.strengthRules), b.bullets(refs))
      if (!day.workout) {
        blocks.push(b.blank(), b.hint(ui().why.sourcesHint('§10.8')))
        return okDoc(blocks)
      }
      blocks.push(b.blank())
    }
    const workout = day.workout
    if (!workout) return okDoc(blocks)
    blocks.push(
      b.panel(kindLabel(workout.kind), [kindPurpose(workout.kind)],
        KIND_COLOR[workout.kind] ?? 'accent'),
    )
    const refs = [...new Set([...workout.ruleRefs, ...sk.ruleRefs])].sort()
    const explained = refs.filter(ruleExplain).map((r) => `${r} — ${ruleExplain(r)}`)
    if (explained.length) blocks.push(b.section(ui().why.rules), b.bullets(explained))
    blocks.push(b.blank(), b.hint(ui().why.sourcesHint('§10')))
    return okDoc(blocks)
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
  opts: { days?: string | undefined } = {},
  factory: ProviderFactory = defaultProviderFactory,
): Promise<CmdResult> {
  try {
    const today = localToday()
    const days = Number(opts.days ?? 28)
    const { from, to } = defaultRange(today, -(Number.isFinite(days) ? Math.abs(days) : 28))
    const provider = factory(cwd)
    const [activities, wellness] = await Promise.all([
      provider.listActivities(from, to),
      provider.listWellness(from, to).catch(() => []),
    ])
    writeSnapshot(cwd, { pulledAt: today, activities, wellness })
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
    return okDoc(blocks)
  } catch (e) {
    return fail(e)
  }
}

export function cmdAdapt(cwd: string, opts: { date?: string | undefined } = {}): CmdResult {
  try {
    const today = opts.date ?? localToday()
    const plan = loadPlan(cwd)
    const config = loadConfig(cwd)
    const snapshot = readSnapshot(cwd)
    const logs = readLog(cwd)
    const execution = buildExecution(plan, snapshot?.activities ?? [], logs, today)

    const currentWeek = plan.weeks.find((w) => w.days.some((d) => d.date === today))
    const currentWeeklyKm = currentWeek?.skeleton.targetKm ?? plan.peakKmPlanned
    const known = new Set(config.athlete.results.map((r) => `${r.date}:${r.distanceKm}`))
    const newResults = config.athlete.results.filter(
      (r) => r.date > plan.generatedAt && !known.has(`${r.date}:${r.distanceKm}`),
    )
    const allDays = plan.weeks.flatMap((w) => w.days)
    const lastRaceDay = allDays
      .filter((d) => d.workout?.kind === 'race' && d.date <= today)
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
        const log = logs.find((l) => l.date === d.date)
        return log?.status === 'done' || (log?.timeSec ?? 0) > 0
      })
      .map((d) => {
        const log = logs.find((l) => l.date === d.date)
        const measured =
          tuneUpByDate.get(d.date) ??
          d.workout?.segments.find((s) => s.type === 'race')?.distanceKm ??
          0
        return {
          date: d.date,
          distanceKm: measured,
          ...(log?.timeSec ? { timeSec: log.timeSec } : {}),
        }
      })

    const proposal = analyzeExecution({
      today,
      execution,
      currentWeeklyKm,
      ...(newResults.length ? { newResults } : {}),
      ...(lastRaceDay ? { lastRace: { date: lastRaceDay.date, distanceKm: plan.goal.distanceKm } } : {}),
      ...(uncalibratedTests.length ? { uncalibratedTests } : {}),
    })

    const compliance = Math.round(proposal.complianceKm * 100)
    const blocks: Block[] = [
      b.title(ui().adapt.title(proposal.windowDays, today)),
      b.kv([
        [ui().adapt.volumeDone, `${compliance}%`],
        [ui().adapt.missedSessions, String(proposal.missedSessions)],
      ]),
    ]
    if (!snapshot) {
      blocks.push(b.info(ui().adapt.noSnapshot))
    }
    if (proposal.diagnosis.length) {
      blocks.push(b.section('Diagnoza'), b.bullets(proposal.diagnosis))
    }
    blocks.push(b.section('Propozycje'))
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
    return okDoc(blocks)
  } catch (e) {
    return fail(e)
  }
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
    blocks.push(b.hint(ui().desk.rulesHint(day.ruleRefs.join(', '))))
    return okDoc(blocks)
  } catch (e) {
    return fail(e)
  }
}

export function cmdReschedule(
  cwd: string,
  opts: { block?: string[] | undefined; date?: string | undefined; apply?: boolean | undefined } = {},
): CmdResult {
  try {
    const date = opts.date ?? opts.block?.[0] ?? localToday()
    const plan = loadPlan(cwd)
    const config = loadConfig(cwd)
    const hit = findDay(plan, date)
    if (!hit) return fail(new Error(ui().log.outsidePlan(date)))
    const weekIndex = plan.weeks.findIndex((w) => w.weekStart === hit.week.weekStart)
    const week = plan.weeks[weekIndex]!

    const result = reschedule({
      week,
      blockedDates: opts.block ?? [],
      availableDays: config.athlete.daysAvailable,
      qualityDayPreference: COACH_STYLE.qualityDayPreference,
      longRunDayPreference: COACH_STYLE.longRunDayPreference,
    })

    const blocks: Block[] = [
      b.title(
        ui().reschedule.title(week.weekStart),
        opts.block?.length
          ? ui().reschedule.blockedDates(opts.block.join(', '))
          : ui().reschedule.noBlocks,
      ),
    ]
    if (!result.changed) {
      blocks.push(b.success(ui().reschedule.unchanged))
      for (const w of result.warnings) blocks.push(b.warn(w))
      return okDoc(blocks)
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

    if (opts.apply === true) {
      week.days = result.days
      // Bieganie się przesunęło, więc sesje siłowe mogły trafić obok akcentu.
      // Solver zachował je na miejscu (to nie jego domena) — tu je przeliczamy,
      // bo dopiero ta warstwa zna konfigurację siły.
      if (config.strength?.enabled) {
        applyStrength([week], config.strength)
        for (const note of week.strengthNotes ?? []) blocks.push(b.info(note))
      }
      plan.changes.push({
        at: localToday(),
        action: 'reschedule',
        detail: `${week.weekStart}: ${result.tradeoffs.join('; ')}`,
      })
      writePlan(cwd, plan)
      blocks.push(
        b.blank(),
        b.success(ui().reschedule.applied(`${PLAN_YAML} + ${PLAN_MD}`)),
      )
    } else {
      blocks.push(b.blank(), b.hint(ui().reschedule.previewHint))
    }
    return okDoc(blocks)
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
    if (!['plan', 'workout', 'print', 'calendar', 'race'].includes(what)) {
      return fail(new Error(ui().exportCmd.unknownKind(String(opts.what))))
    }
    const files = runExport(cwd, { what, date: opts.date })
    const total = files.reduce((s, f) => s + f.bytes, 0)

    const blocks: Block[] = [
      b.title(
        ui().exportCmd.titles[what],
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
      what === 'print' || what === 'race'
        ? b.info(ui().exportCmd.printHint)
        : what === 'calendar'
          ? b.info(ui().exportCmd.calendarHint)
          : b.info(ui().exportCmd.fitHint),
    )
    return okDoc(blocks)
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
  opts: { date?: string | undefined; days?: string | undefined } = {},
  factory: ProviderFactory = defaultProviderFactory,
): Promise<CmdResult> {
  try {
    const today = opts.date ?? localToday()
    const days = Math.abs(Number(opts.days ?? 7)) || 7
    const from = addDays(today, -days)
    const plan = loadPlan(cwd)
    const config = loadConfig(cwd)

    // 1) świeże dane, jeśli klucz jest pod ręką; inaczej pracujemy na migawce
    const notes: string[] = []
    if (hasApiKey(cwd)) {
      try {
        const provider = factory(cwd)
        const [activities, wellness] = await Promise.all([
          provider.listActivities(from, today),
          provider.listWellness(from, today).catch(() => []),
        ])
        writeSnapshot(cwd, { pulledAt: today, activities, wellness })
      } catch (e) {
        notes.push(ui().review.refreshFailed(e instanceof Error ? e.message : String(e)))
      }
    } else {
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

    // 2) co się wydarzyło — te same porównania co w trainctl pull
    const rows = compare(plan, snapshot?.activities ?? [], from, today)
    const plannedKm = rows.reduce((s, r) => s + r.plannedKm, 0)
    const actualKm = rows.reduce((s, r) => s + (r.actualKm ?? 0), 0)
    const done = rows.filter((r) => r.status === 'matched' || r.status === 'longer').length
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

    // 3) sygnały adaptacji — sekcja pojawia się tylko wtedy, gdy jest co powiedzieć
    const adapt = cmdAdapt(cwd, { date: today })
    const meaningful = (adapt.blocks ?? []).length > 0 && !adapt.output.includes('hold-course')
    if (adapt.code === 0 && meaningful) {
      blocks.push(b.section(ui().review.signals))
      const lines = adapt.output
        .split('\n')
        .filter((l) => /^(reduce-volume|conservative-restart|recalibrate-zones|raise-baseline|post-race-recovery)/.test(l))
      blocks.push(b.bullets(lines.length ? lines : [ui().review.seeAdapt]))
    } else {
      blocks.push(b.success(ui().review.noSignals))
    }

    // 4) co przed nami — bieżący tydzień, dopóki coś w nim jeszcze zostało
    // (w poniedziałek „przed nami" to tydzień, który się właśnie zaczyna),
    // a gdy jest już wybiegany do końca — następny
    const thisWeekStart = mondayOf(today)
    const thisWeek = plan.weeks.find((w) => w.weekStart === thisWeekStart)
    const hasFuture = thisWeek?.days.some((d) => d.date >= today && d.workout) === true
    const week =
      (hasFuture ? thisWeek : plan.weeks.find((w) => w.weekStart === mondayOf(addDays(today, 7)))) ??
      plan.weeks.find((w) => w.days.some((d) => d.date >= today))
    if (week) {
      const sk = week.skeleton
      const upcoming = week.days.filter((d) => d.workout)
      blocks.push(
        b.section(ui().review.ahead(week.weekStart)),
        b.kv([
          [
            ui().review.phase,
            `${phaseLabel(sk.phase)}${sk.deload ? ` · ${ui().today.deload}` : ''}`,
          ],
          [ui().review.volume, ui().review.volumeAhead(week.totalKm, upcoming.length)],
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
    if (adapt.output.includes('athlete.results')) todo.push(ui().review.todoWriteResult)
    if (meaningful) todo.push(ui().review.todoSeeAdapt)
    if (hasApiKey(cwd)) todo.push(ui().review.todoPush)
    else todo.push(ui().review.todoPrint)
    if (missed.length >= 2) todo.push(ui().review.todoReschedule)
    const nextRace = (config.athlete.tuneUpRaces ?? []).find((r) => r.date > today)
    if (nextRace) {
      todo.push(
        ui().review.todoNextRace(nextRace.date, nextRace.name ?? `${nextRace.distanceKm} km`),
      )
    }
    blocks.push(b.section(ui().review.todo), b.bullets(todo))
    return okDoc(blocks)
  } catch (e) {
    return fail(e)
  }
}

export function cmdDiff(cwd: string): CmdResult {
  try {
    const stored = loadPlan(cwd)
    const config = loadConfig(cwd)
    const fresh = computePlan(config, stored.generatedAt)
    const lines: string[] = []
    if (stored.changes.length) {
      lines.push(ui().diff.manualShifts)
    }
    // Sam `diff` porównuje rodzaje jednostek (klucze), więc zmiana języka go nie
    // ruszy — ale opisy w plan/PLAN.md zostają w starym. Mówimy o tym wprost,
    // bo inaczej „plan aktualny" byłoby nieprawdą wobec tego, co widzi biegacz.
    const current = getLocale()
    const staleLocale = stored.locale !== undefined && stored.locale !== current
    const freshByStart = new Map(fresh.weeks.map((w) => [w.weekStart, w]))
    for (const week of stored.weeks) {
      const f = freshByStart.get(week.weekStart)
      if (!f) {
        lines.push(ui().diff.weekGone(week.weekStart))
        continue
      }
      if (f.skeleton.targetKm !== week.skeleton.targetKm) {
        lines.push(
          ui().diff.weekVolume(week.weekStart, week.skeleton.targetKm, f.skeleton.targetKm),
        )
      }
      const fd = new Map(f.days.map((d) => [d.date, d]))
      for (const day of week.days) {
        const nd = fd.get(day.date)
        const a = day.workout?.kind ?? ui().week.rest
        const b = nd?.workout?.kind ?? ui().week.rest
        if (a !== b) lines.push(ui().diff.dayChanged(day.date, a, b))
      }
    }
    for (const w of fresh.weeks) {
      if (!stored.weeks.some((s) => s.weekStart === w.weekStart)) {
        lines.push(ui().diff.weekNew(w.weekStart, w.skeleton.targetKm))
      }
    }
    const localeNote = staleLocale
      ? [b.warn(ui().diff.localeChanged(stored.locale!, current))]
      : []
    if (lines.length === 0) {
      return okDoc([b.success(ui().diff.upToDate), ...localeNote])
    }
    return okDoc([
      b.title(ui().diff.title),
      b.bullets(lines),
      ...localeNote,
      b.blank(),
      b.hint(ui().diff.applyHint),
    ])
  } catch (e) {
    return fail(e)
  }
}

export function daysToRace(plan: { goal: { date: string } }, today: string): number {
  return diffDays(today, plan.goal.date)
}
