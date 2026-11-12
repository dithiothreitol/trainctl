/**
 * PLAN-v0.7 E4: plan v2 z silnikiem biegowym (`legacy`) czytany jako plan biegowy.
 * Tygodnie, szkielety i kalibracja pochodzą z `legacy.generatorPlan`, dni z bieżących
 * sesji v2 (przesunięcie, skrócenie, zamiana na inny sport), profil biegowy z profilu v2,
 * dziennik z wpisów sesji. Komendy planu biegowego (`why`, `status`, `review`, `adapt`)
 * czytają widok; zapis idzie ścieżką v2: propozycja v2 przyjmowana przez `--apply`.
 */
import { BREAK_REASONS, validateSportsPlan, weekTotals, type BreakReason, type SessionLog, type TrainingSession } from 'trainctl-core'
import { clockToday } from './clock.ts'
import { validateConfig } from './config.ts'
import { appendJsonLine, type LogEntry, type StrengthLogEntry } from './logfile.ts'
import { cycleWeeksOf, dayFingerprint, settleMixedWeek, type StoredPlan } from './planfile.ts'
import { legacyProfile, runningConfig, runningSessions, sportsProfilePaths } from './sports-running.ts'
import { fingerprint, isSportsWorkspace, loadSportsConfig, loadSportsPlan, prepareSportsProposal, readSessionLogs, sportsProposalStatus } from './sports-store.ts'
import { activeView, inRunningView, type RunningView } from './view-context.ts'

/** Dzień zmieniony w v2 (przesunięcie, skrócenie, zamiana, zatwierdzenie): odcisk, którego nie ma żaden dzień. */
const EDITED_IN_V2 = 'v2'

/** Dzień, z którego sesja planu biegowego pochodzi: ID zachowuje datę po przesunięciu. */
const originDate = (s: TrainingSession): string => /-(\d{4}-\d{2}-\d{2})-(?:run|strength)$/.exec(s.id)?.[1] ?? s.date

const isRunningEngine = (s: TrainingSession): boolean => s.sport === 'strength' || (s.sport === 'run' && s.legacyWorkout !== undefined)

/**
 * Widok planu biegowego katalogu v2 albo `undefined`, gdy plan nie ma silnika biegowego
 * albo profil ma inne sporty (wtedy zostaje ścieżka v2).
 */
export function runningView(cwd: string): RunningView | undefined {
  const sports = loadSportsPlan(cwd), sportsConfig = loadSportsConfig(cwd)
  const generator = (sports.legacy?.generatorPlan ?? sports.legacy?.plan) as StoredPlan | undefined
  const kinds = Object.keys(sportsConfig.athlete.sports)
  if (!generator?.weeks || kinds.length !== 1 || kinds[0] !== 'run') return undefined
  const config = validateConfig({ ...runningConfig(sportsConfig, legacyProfile(sports)),
    ...(sportsConfig.units ? { units: sportsConfig.units } : {}), ...(sportsConfig.notation ? { notation: sportsConfig.notation } : {}) })
  const generatorDays = new Map(generator.weeks.flatMap((w) => w.days).map((d) => [d.date, d]))
  const sessions = sports.sessions.filter(isRunningEngine)

  const plan = structuredClone(generator)
  plan.engineVersion = sports.engineVersion
  if (sports.timeBudgets) plan.timeBudgets = { ...sports.timeBudgets }
  for (const week of plan.weeks) {
    let edited = false
    for (const day of week.days) {
      const original = generatorDays.get(day.date)!
      const here = sessions.filter((s) => s.date === day.date)
      const run = here.find((s) => s.sport === 'run')
      const strength = here.find((s) => s.sport === 'strength')
      const strengthSource = strength ? generatorDays.get(originDate(strength))?.strength : undefined
      if (run) day.workout = structuredClone(run.legacyWorkout!)
      else delete day.workout
      if (strength && strengthSource) day.strength = { ...structuredClone(strengthSource), durationMin: Math.round(strength.durationSec / 60) }
      else delete day.strength
      if (here.some((s) => s.pinned)) day.pinned = true
      const same = dayFingerprint(day) === dayFingerprint(original)
      if (!same) edited = true
      // dzień zmieniony w v2 chroni się jak dzień edytowany w planie biegowym (ADR-033)
      const untouched = same && plan.generatedDays?.[day.date] === dayFingerprint(original) && here.every((s) => !s.approved)
      if (plan.generatedDays) plan.generatedDays[day.date] = untouched ? dayFingerprint(day) : EDITED_IN_V2
    }
    if (edited) Object.assign(week, weekTotals(week.days))
  }

  const journal = { runs: [] as LogEntry[], strength: [] as StrengthLogEntry[] }
  for (const l of readSessionLogs(cwd)) {
    const reason = (l as { reason?: unknown }).reason
    if (l.sport === 'strength') {
      journal.strength.push({ date: l.date, activity: 'strength', status: l.status === 'skipped' ? 'skipped' : 'done',
        ...(l.durationSec ? { minutes: Math.min(300, Math.max(1, Math.round(l.durationSec / 60))) } : {}), ...(l.note ? { note: l.note } : {}), loggedAt: l.loggedAt })
    } else if (l.sport === 'run') {
      journal.runs.push({ date: l.date, status: l.status,
        ...(l.distanceM !== undefined && l.status !== 'skipped' ? { km: Math.round(l.distanceM * 10) / 1e4 } : {}), ...(l.durationSec ? { timeSec: l.durationSec } : {}),
        ...(l.testTimeSec ? { testTimeSec: l.testTimeSec } : {}), ...(l.rpe !== undefined ? { rpe: l.rpe } : {}), ...(l.note ? { note: l.note } : {}),
        ...((BREAK_REASONS as readonly unknown[]).includes(reason) ? { reason: reason as BreakReason } : {}), loggedAt: l.loggedAt })
    } else if (l.plannedSport === 'run') {
      // bieg zastąpiony innym sportem: biegu tego dnia nie było
      journal.runs.push({ date: l.date, status: 'skipped', ...(l.note ? { note: l.note } : {}), loggedAt: l.loggedAt })
    }
  }

  const propose = (next: StoredPlan, changes: { date: string; before: string; after: string }[]): string => {
    const changed = new Set(changes.map((c) => c.date))
    // do planu generatora wracają dni, których propozycja nie zmieniła: widok niesie zmiany v2,
    // które zostają w sesjach v2 (inaczej przesunięta sesja wróciłaby przy regeneracji podwójnie)
    const stored = structuredClone(next)
    for (const week of stored.weeks) {
      let restored = false
      week.days = week.days.map((day) => {
        const original = generatorDays.get(day.date)
        if (changed.has(day.date) || !original) return day
        if (dayFingerprint(original) !== dayFingerprint(day)) restored = true
        return structuredClone(original)
      })
      if (restored) settleMixedWeek(week)
    }
    stored.generatedDays = { ...generator.generatedDays, ...Object.fromEntries([...changed].flatMap((d) => (next.generatedDays?.[d] ? [[d, next.generatedDays[d]]] : []))) }
    if (generator.timeBudgets) stored.timeBudgets = generator.timeBudgets
    else delete stored.timeBudgets
    if (generator.engineVersion) stored.engineVersion = generator.engineVersion
    else delete stored.engineVersion
    stored.peakKmPlanned = Math.max(...cycleWeeksOf(stored).map((w) => w.totalKm))
    const fresh = runningSessions(stored, sports.legacy!.cycleId ?? sports.cycleId).filter((s) => changed.has(s.date))
    const result = structuredClone(sports)
    result.sessions = [...result.sessions.filter((s) => !(changed.has(s.date) && isRunningEngine(s))), ...fresh]
      .sort((a, z) => a.date.localeCompare(z.date) || (a.start ?? '').localeCompare(z.start ?? '') || a.id.localeCompare(z.id))
    for (const s of fresh) result.generatedSessions[s.id] = fingerprint(s)
    result.legacy = { ...result.legacy!, generatorPlan: stored }
    result.changes.push({ at: clockToday(), action: 'adapt', sessionIds: fresh.map((s) => s.id) })
    const issues = validateSportsPlan(result)
    if (issues.length) throw new Error(issues.join('\n'))
    return prepareSportsProposal(cwd, 'adapt', result, changes.map((c) => `${c.date}: ${c.before} → ${c.after}`)).id
  }

  const proposals = () => sportsProposalStatus(cwd).map((p) => ({
    id: p.id, kind: p.action, createdFor: p.date ?? '', preparedOn: p.date ?? null, changes: p.changes ?? 0, firstDate: null,
    state: p.valid ? 'valid' as const : 'stale' as const,
  }))

  // B11: przerwa z planu biegowego jako wpisy sesji v2; dzień bez sesji dostaje ID, które
  // silnik biegowy nadałby jego sesji (widoki v2 go pomijają, analiza planu biegowego czyta)
  const record = (entry: LogEntry | StrengthLogEntry): void => {
    const strength = 'activity' in entry
    const sport = strength ? 'strength' as const : 'run' as const
    const session = sports.sessions.find((s) => s.date === entry.date && s.sport === sport && isRunningEngine(s))
    const minutes = strength ? entry.minutes : undefined
    const run = strength ? undefined : entry
    const line: SessionLog & { reason?: BreakReason } = {
      schemaVersion: 2, sessionId: session?.id ?? `${sports.legacy?.cycleId ?? sports.cycleId}-${entry.date}-${sport}`, date: entry.date, sport,
      status: entry.status, loggedAt: entry.loggedAt,
      ...(minutes !== undefined ? { durationSec: minutes * 60 } : run?.timeSec !== undefined ? { durationSec: run.timeSec } : {}),
      ...(run?.km !== undefined ? { distanceM: Math.round(run.km * 1e4) / 10 } : {}),
      ...(run?.testTimeSec !== undefined ? { testTimeSec: run.testTimeSec } : {}), ...(run?.rpe !== undefined ? { rpe: run.rpe } : {}),
      ...(entry.note ? { note: entry.note } : {}), ...(run?.reason ? { reason: run.reason } : {}),
    }
    // dopisanie wiersza jak w dzienniku planu biegowego: przerwa 60 dni to 60 krótkich zapisów,
    // nie 60 przepisań całego pliku (transakcję przerwaną wcześniej odzyskał isSportsWorkspace)
    appendJsonLine(cwd, line)
    if (strength) journal.strength.push(entry)
    else journal.runs.push(entry)
  }

  return { plan, config, journal, propose, proposals, record }
}

/**
 * Komenda planu biegowego na widoku planu v2. W otwartym już widoku (np. `adapt`
 * wywołany przez `review`) ten sam widok; poza katalogiem v2 albo bez planu biegowego
 * `undefined` — wtedy zostaje ścieżka v2, która też zgłasza błąd plików.
 */
export function onRunningView<T>(cwd: string, run: () => T): T | undefined {
  if (activeView(cwd)) return run()
  if (!isSportsWorkspace(cwd)) return undefined
  let view: RunningView | undefined
  try { view = runningView(cwd) } catch { return undefined }
  if (!view) return undefined
  const result = inRunningView(cwd, view, run)
  return result instanceof Promise ? result.then(withSportsPaths) as T : withSportsPaths(result)
}

/** Komunikaty planu biegowego w katalogu v2 wskazują pola profilu v2 (tekst, bloki i dane). */
function withSportsPaths<T>(result: T): T {
  return JSON.parse(JSON.stringify(result), (_key, value: unknown) => typeof value === 'string' ? sportsProfilePaths(value) : value) as T
}

/**
 * Dzień `why` w widoku: wybrana sesja albo data, której wszystkie sesje pochodzą z silnika
 * biegowego. Dzień z sesją innego sportu (zamiana MS-2) objaśnia ścieżka v2.
 */
export function runningDay(cwd: string, o: { session?: string | undefined; sport?: string | undefined; date?: string | undefined }): string | undefined {
  try {
    const plan = loadSportsPlan(cwd)
    if (o.sport !== undefined && o.sport !== 'run' && o.sport !== 'strength') return undefined
    if (o.session !== undefined) {
      const s = plan.sessions.find((x) => x.id === o.session)
      return s && isRunningEngine(s) ? s.date : undefined
    }
    const date = o.date ?? clockToday()
    return plan.sessions.filter((s) => s.date === date).every(isRunningEngine) ? date : undefined
  } catch { return undefined }
}
