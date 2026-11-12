import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { addDays, estimateWorkoutMinutes, mondayOf, validatePlan, weekTotals, withLocale, paceZones, recalibrateWorkout, parseIso, shortenWorkout, type ShortenedWorkout, type AdaptationProposal, type PlannedDay } from 'trainctl-core'
import { CONFIG_FILE, loadConfig } from './config.ts'
import { logFor, readLogForChanges, LOG_FILE } from './logfile.ts'
import { budgetWarnings, computePlan, cycleWeeksOf, dayFingerprint, goalKey, loadPlan, mergeWeekNotes, planEnd, scaleToBaseline, settleMixedWeek, PLAN_YAML, writePlan, workoutText, type StoredPlan } from './planfile.ts'
import { ui } from './i18n/index.ts'
import { readSnapshot } from './sync.ts'
import { runningKmByDate } from './execution.ts'
import { clockToday } from './clock.ts'
import { sameResults } from './calibration.ts'
import { activeView } from './view-context.ts'

export interface PlanProposal {
  /** Actual local date of creation; historical analysis does not authorize historical writes. */
  preparedOn?: string
  schemaVersion: 1
  id: string
  baseHash: string
  createdFor: string
  kind?: 'adaptation' | 'shorten'
  analysis?: AdaptationProposal
  adjustment?: ShortenedWorkout
  vdotBefore: number
  /** B11: zatwierdzona baza, którą ta propozycja powrotu zastępuje (jedna decyzja o objętości naraz). */
  replacesBaselineKm?: number
  changes: { date: string; before: string; after: string; beforeKm: number; afterKm: number }[]
  protectedDates: string[]
  plan: StoredPlan
}

const hash = (text: string): string => createHash('sha256').update(text).digest('hex')
/** Prawdziwy (albo jawnie symulowany) dzień kalendarzowy — granica ochrony przeszłości. */
export const calendarToday = (): string => clockToday()

/**
 * Wpis historii zmian w plan.yaml: dane, nie widok — surowe liczby i enum,
 * niezależne od języka CLI, którym zatwierdzono zmianę.
 */
export function shortenDetail(date: string, from: number, to: number, budget: number, status: string): string {
  return `${date}: ${from} → ${to} km; ${budget} min; ${status}`
}

export function workspaceHash(cwd: string): string {
  return hash(JSON.stringify([PLAN_YAML, CONFIG_FILE, LOG_FILE, 'sync.json'].map((name) => {
    const path = join(cwd, name)
    return [name, existsSync(path) ? readFileSync(path, 'utf-8') : null]
  })))
}
const proposalId = (proposal: Omit<PlanProposal, 'id'>): string => hash(JSON.stringify(proposal)).slice(0, 24)

function saveProposal(cwd: string, body: Omit<PlanProposal, 'id'>): PlanProposal {
  if (validatePlan(body.plan).some(issue => issue.severity === 'error')) throw new Error(ui().improve.invalidProposal)
  // E4: w katalogu v2 propozycja planu biegowego zapisuje się jako propozycja v2 (`--apply` ścieżką v2)
  const view = activeView(cwd)
  if (view) return { ...body, id: view.propose(body.plan, body.changes) }
  const proposal: PlanProposal = { ...body, id: proposalId(body) }
  const dir = join(cwd, 'plan', 'proposals')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, `${proposal.id}.json`), JSON.stringify(proposal, null, 2) + '\n', 'utf-8')
  return proposal
}

/** Daty z zapisem wykonania (dziennik albo bieg z synchronizacji) — nienaruszalne dla zmian planu. */
export function recordedDates(cwd: string): Set<string> {
  // uszkodzony wiersz dziennika zatrzymuje zmianę planu (readLogForChanges)
  const dates = new Set(readLogForChanges(cwd).map(entry => entry.date))
  for (const date of runningKmByDate(readSnapshot(cwd)?.activities ?? []).keys()) dates.add(date)
  return dates
}

/**
 * Kilometry zapisane w dniu startu celu (dziennik albo synchronizacja). Sygnał
 * dla regeneracji, czy start się odbył — sama obecność wpisu (rozruch, „pominięte")
 * tego nie mówi.
 */
export function raceDayKm(cwd: string, plan: StoredPlan): number {
  const date = plan.goal.date
  const entry = logFor(cwd, date)
  // jawne „pominięte" (DNS) wygrywa nad zegarkiem — tak jak w buildExecution
  if (entry?.status === 'skipped') return 0
  const logged = entry ? entry.km ?? (entry.status === 'done' ? plan.goal.distanceKm : 0) : 0
  const synced = runningKmByDate(readSnapshot(cwd)?.activities ?? []).get(date) ?? 0
  // Świadomie inaczej niż buildExecution (tam wpis dziennika wygrywa z zegarkiem):
  // tu pytanie brzmi „czy start się odbył", a poranny rozruch w dzienniku to inna
  // sesja tego dnia niż start pobrany z zegarka — liczy się większa z dwóch wartości.
  return Math.max(logged, synced)
}

const describeDay = (day: PlannedDay): string => [workoutText(day), ...(day.strength ? [ui().today.strengthTitle(day.strength.durationMin) + ': ' + day.strength.description] : [])].join(' + ')

/** A single explicitly selected session; all other days and profile data survive. */
export function prepareShortening(cwd: string, date: string, minutes: number): { adjustment: ShortenedWorkout | null; proposal?: PlanProposal } {
  parseIso(date)
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 1440) throw new Error(ui().improve.badBudget)
  if (date < calendarToday() || recordedDates(cwd).has(date)) throw new Error(ui().improve.pastWrite)
  const baseHash = workspaceHash(cwd)
  const plan = loadPlan(cwd)
  const week = plan.weeks.find(w => w.days.some(d => d.date === date))
  const day = week?.days.find(d => d.date === date)
  if (!day) throw new Error(ui().common.outsidePlan(date, plan.weeks[0]?.weekStart ?? '', planEnd(plan)))
  if (day.pinned) throw new Error(ui().coach.pinned)
  if (!day.workout) return { adjustment: null }
  const before = structuredClone(day)
  // A previously tighter budget remains binding.
  const budget = Math.min(minutes, plan.timeBudgets?.[date] ?? minutes)
  const adjustment = withLocale(plan.locale === 'pl' ? 'pl' : 'en', () => shortenWorkout(day.workout!, budget, {
    preparationMinutes: plan.preparationMinutes ?? 15, strengthMinutes: day.strength?.durationMin ?? 0,
  }))
  if (adjustment.status === 'unchanged' || adjustment.status === 'unavailable' || !adjustment.workout) return { adjustment }
  day.timeAdjustment = { originalKind: day.workout.kind, originalDistanceKm: day.workout.distanceKm, budgetMinutes: budget, status: adjustment.status }
  day.workout = adjustment.workout
  plan.timeBudgets = { ...plan.timeBudgets, [date]: budget }
  // Keep the generation fingerprint: an approved exception must survive adaptation.
  Object.assign(week!, weekTotals(week!.days))
  plan.peakKmPlanned = Math.max(...cycleWeeksOf(plan).map(w => w.totalKm))
  plan.changes.push({ at: calendarToday(), action: 'shorten', detail: shortenDetail(date, before.workout!.distanceKm, day.workout.distanceKm, budget, adjustment.status) })
  const proposal = saveProposal(cwd, { schemaVersion: 1, kind: 'shorten', preparedOn: calendarToday(), createdFor: date, baseHash,
    adjustment, vdotBefore: plan.vdot, plan,
    changes: [{ date, before: describeDay(before), after: describeDay(day), beforeKm: before.workout!.distanceKm, afterKm: day.workout.distanceKm }],
    protectedDates: plan.weeks.flatMap(w => w.days).filter(d => d.date !== date).map(d => d.date),
  })
  return { adjustment, proposal }
}

/** Prepare a complete, content-addressed future plan. No changes to athlete files. */
export function prepareProposal(cwd: string, today: string, analysis: AdaptationProposal): PlanProposal {
  const baseHash = workspaceHash(cwd)
  const plan = loadPlan(cwd)
  if (!plan.calibration || !plan.generatedDays) throw new Error(ui().improve.oldPlan)
  if (analysis.actions.some((a) => a.type === 'post-race-recovery' || (a.type === 'conservative-restart' && !a.returnBlock))) throw new Error(ui().improve.manualRecovery)
  // R-6, R-7: po kontuzji żadna zmiana planu (także sama rekalibracja) nie powstaje automatycznie
  if (analysis.layoff?.reason === 'injury') throw new Error(ui().improve.manualRecovery)
  // B11: restart po przerwie to blok powrotu od jutra (R-5 po chorobie, R-11 po innej), a przy
  // przerwie zapisanej także na kolejne dni — od dnia po jej końcu
  const restart = analysis.actions.find((a) => a.type === 'conservative-restart' && a.returnBlock)
  const returnFrom = restart?.returnBlock ? { since: addDays(analysis.layoff?.until ?? today, 1), ...restart.returnBlock } : undefined
  const volume = returnFrom ? undefined : analysis.actions.find((a) => a.suggestedWeeklyKm !== undefined)
  const recalibrate = analysis.actions.some((a) => a.type === 'recalibrate-zones')
  if (!volume && !recalibrate && !returnFrom) throw new Error(ui().improve.noPatch)
  const config = loadConfig(cwd)
  if (goalKey(config.goal) !== goalKey(plan.goal)) throw new Error(ui().improve.changedGoal)
  // A completed time trial with no result in the profile is a request for data,
  // not permission to rewrite calibration timestamps and call that a plan change.
  if (!volume && !returnFrom && sameResults(config.athlete.results, plan.calibration.results))
    throw new Error(ui().improve.noPatch)
  const nextConfig = structuredClone(config)
  const candidate = withLocale(plan.locale === 'pl' ? 'pl' : 'en', () => computePlan(nextConfig, plan.generatedAt, today, {
    // Tygodnie zapisanego planu zamiast świeżych; budżet czasu z profilu stosuje
    // potem computePlan (E-2) od tygodnia decyzji, a siła zostaje na swoich dniach.
    // Rekalibracja zmienia tylko tempa: w bieżącym tygodniu limit dnia skraca za
    // długie dni, całe tygodnie budżet przycina od następnego poniedziałku, a poziom
    // bez budżetu tygodnie niosą z zapisanego planu (`uncappedKm`). Ostrzeżenia
    // budżetu liczy budgetWarnings na planie po złożeniu, od pierwszego dnia, który
    // propozycja może zmienić.
    budgetFrom: mondayOf(today),
    budgetWarnings: false,
    ...(volume || returnFrom ? {} : { weeklyBudgetFrom: addDays(mondayOf(today), 7) }),
    ...(returnFrom ? { returnFrom } : {}),
    beforeTimeBudget: (metadata) => {
      // Metadane kalibracji liczy computePlan; nowa baza nie sięga wstecz (tygodnie
      // sprzed decyzji zostają). Bieżący cykl jak w zapisanym planie — szczyt
      // i ostrzeżenia nie liczą historii poprzedniego.
      if (plan.cycleStart) metadata.cycleStart = plan.cycleStart
      // blok powrotu: tygodnie od powrotu z computePlan, wcześniejsze z zapisanego planu
      if (returnFrom) {
        const from = mondayOf(returnFrom.since)
        metadata.weeks = metadata.weeks.map((w) => w.weekStart < from ? structuredClone(plan.weeks.find((x) => x.weekStart === w.weekStart) ?? w) : w)
        return
      }
      if (volume) {
        // siła to osobny tor — korekta objętości jej nie przestawia. Nowa baza zastępuje
        // przyjęty powrót (B11), więc skalujemy tygodnie bez bloku powrotu — tak jak potem
        // regeneracja, która bloku już nie stosuje
        metadata.weeks = scaleToBaseline(plan.returnState ? metadata.weeks : plan.weeks, {
          baselineKm: volume.suggestedWeeklyKm!, decidedOn: today, config: nextConfig, goal: plan.goal, vdot: metadata.vdot,
          reference: plan.weeks,
        })
        return
      }
      const zones = paceZones(metadata.vdot)
      metadata.weeks = plan.weeks.map((week) => {
        const copy = structuredClone(week)
        for (const day of copy.days) if (day.workout) day.workout = recalibrateWorkout(day.workout, zones, week.skeleton.intensityModel === 'polarized')
        return copy
      })
    },
  }))
  const candidateDays = new Map(candidate.weeks.flatMap((w) => w.days).map((day) => [day.date, day]))
  const recorded = recordedDates(cwd)
  const next = structuredClone(plan)
  const protectedDates: string[] = []
  const changes: PlanProposal['changes'] = []
  for (const week of next.weeks) {
    for (let i = 0; i < week.days.length; i++) {
      const before = week.days[i]!
      const after = candidateDays.get(before.date)
      const untouched = plan.generatedDays[before.date] === dayFingerprint(before)
      const budget = plan.timeBudgets?.[before.date]
      const tooLong = after && budget !== undefined && (after.workout ? estimateWorkoutMinutes(after.workout, plan.preparationMinutes ?? 15) : 0) + (after.strength?.durationMin ?? 0) > budget
      if (before.date <= today || before.date < calendarToday() || before.pinned || recorded.has(before.date) || !untouched || before.workout?.kind === 'race' || tooLong) {
        protectedDates.push(before.date)
        continue
      }
      if (!after || dayFingerprint(before) === dayFingerprint(after)) continue
      changes.push({ date: before.date, before: describeDay(before), after: describeDay(after), beforeKm: before.workout?.distanceKm ?? 0, afterKm: after.workout?.distanceKm ?? 0 })
      week.days[i] = structuredClone(after)
      next.generatedDays![before.date] = dayFingerprint(after)
    }
    // Preserve the history and phase boundaries; refresh totals of changed weeks.
    const candidateWeek = candidate.weeks.find((w) => w.weekStart === week.weekStart)
    const changedHere = new Set(changes.filter((c) => week.days.some((d) => d.date === c.date)).map((c) => c.date))
    if (changedHere.size) {
      if (candidateWeek) {
        week.skeleton = structuredClone(candidateWeek.skeleton)
        // uwagi generatora (`why`): dni zmienione mówią o nowym układzie, pozostałe o starym
        const notes = mergeWeekNotes(week.notes, candidateWeek.notes, changedHere)
        if (notes) week.notes = notes
        else delete week.notes
      }
      settleMixedWeek(week)
    } else if ((volume || returnFrom) && candidateWeek && week.weekStart >= mondayOf(today) &&
      JSON.stringify(candidateWeek.skeleton) !== JSON.stringify(week.skeleton)) {
      // Dni do zmiany wychodzą takie same (budżet czasu tnie stary i nowy zamiar do tych
      // samych dni albo tydzień powrotu ma resztę dni bez zmian), ale zamiarem tygodnia jest
      // już nowa baza albo krzywa powrotu — z niej „bez budżetu" w ostrzeżeniu (E-2), a z reguł
      // R-5/R-11 `adapt` wie, że powrót trwa (B11). Sumy jak w tygodniu mieszanym regeneracji.
      week.skeleton = structuredClone(candidateWeek.skeleton)
      // uwagi dni zostają przy dniach (bez zmian), uwaga tygodnia (`volumeShort`) — z nowego
      // zamiaru, jak w gałęzi zmienionych dni
      const notes = mergeWeekNotes(week.notes, candidateWeek.notes, new Set())
      if (notes) week.notes = notes
      else delete week.notes
      settleMixedWeek(week)
    }
  }
  next.calibration = candidate.calibration!
  if (volume) next.loadState = { baselineWeeklyKm: volume.suggestedWeeklyKm!, effectiveFrom: today, profileWeeklyKm: config.athlete.recentWeeklyKm }
  // jedna decyzja o objętości naraz: powrót po przerwie zastępuje bazę, nowa baza — powrót
  if (returnFrom) {
    next.returnState = { ...returnFrom, decidedOn: today }
    delete next.loadState
  } else if (volume) delete next.returnState
  next.vdot = candidate.vdot
  next.vdotSource = candidate.vdotSource
  if (candidate.prediction) next.prediction = candidate.prediction
  else delete next.prediction
  next.peakKmPlanned = Math.max(...cycleWeeksOf(next).map((w) => w.totalKm))
  // ostrzeżenia budżetu na tym, co propozycja zapisze, i tylko dla dni, które może zmienić
  const firstChangeable = [addDays(today, 1), calendarToday()].sort().at(-1)!
  next.feasibilityWarnings = [...candidate.feasibilityWarnings,
    ...withLocale(plan.locale === 'pl' ? 'pl' : 'en', () => budgetWarnings(next, nextConfig, firstChangeable))]
  next.changes.push({ at: today, action: 'adapt', detail: analysis.actions.map((a) => a.type).join(', ') })
  // Lint remains visible in the preview; broken file invariants never reach disk.
  const errors = validatePlan(next).filter((issue) => issue.severity === 'error')
  if (errors.length) throw new Error(ui().improve.invalidProposal)
  if (!changes.length && JSON.stringify(next.calibration) === JSON.stringify(plan.calibration)) throw new Error(ui().improve.noPatch)
  const replacesBaselineKm = returnFrom ? plan.loadState?.baselineWeeklyKm : undefined
  return saveProposal(cwd, {
    schemaVersion: 1, kind: 'adaptation', preparedOn: calendarToday(), baseHash, createdFor: today, analysis, vdotBefore: plan.vdot,
    ...(replacesBaselineKm !== undefined ? { replacesBaselineKm } : {}), changes, protectedDates, plan: next,
  })
}

export type ProposalState = 'valid' | 'expired' | 'stale' | 'invalid'

/**
 * Zapisane propozycje z ich stanem na dziś — te same warunki, które sprawdza
 * `applyProposal`, w tej samej kolejności. Dziś nic ich nie listowało, więc
 * zgubiony ID trzeba było szukać w `plan/proposals/`.
 */
export function listProposals(cwd: string): { id: string; kind: string; createdFor: string; preparedOn: string | null; changes: number; firstDate: string | null; state: ProposalState }[] {
  const view = activeView(cwd)
  if (view) return view.proposals()
  const dir = join(cwd, 'plan', 'proposals')
  if (!existsSync(dir)) return []
  const base = workspaceHash(cwd)
  const today = calendarToday()
  return readdirSync(dir).filter((f) => /^[a-f0-9]{24}\.json$/.test(f)).sort().map((file) => {
    const id = file.slice(0, 24)
    try {
      const proposal = JSON.parse(readFileSync(join(dir, file), 'utf-8')) as PlanProposal
      const { id: storedId, ...body } = proposal
      const state: ProposalState =
        storedId !== id || proposalId(body) !== id || proposal.schemaVersion !== 1 ? 'invalid'
          : proposal.baseHash !== base ? 'stale'
            : !proposal.preparedOn || proposal.preparedOn !== today || proposal.changes.some((c) => c.date < today) ? 'expired'
              : 'valid'
      return { id, kind: proposal.kind ?? 'adaptation', createdFor: proposal.createdFor, preparedOn: proposal.preparedOn ?? null,
        changes: proposal.changes.length, firstDate: proposal.changes[0]?.date ?? null, state }
    } catch {
      return { id, kind: '?', createdFor: '', preparedOn: null, changes: 0, firstDate: null, state: 'invalid' as const }
    }
  })
}

/** Apply exactly the reviewed bytes; do not recompute using new data. */
export function applyProposal(cwd: string, id: string): PlanProposal {
  if (!/^[a-f0-9]{24}$/.test(id)) throw new Error(ui().improve.invalidProposal)
  const path = join(cwd, 'plan', 'proposals', `${id}.json`)
  if (!existsSync(path)) throw new Error(ui().improve.invalidProposal)
  const proposal = JSON.parse(readFileSync(path, 'utf-8')) as PlanProposal
  const { id: storedId, ...body } = proposal
  if (storedId !== id || proposalId(body) !== id || proposal.schemaVersion !== 1) throw new Error(ui().improve.invalidProposal)
  if (proposal.baseHash !== workspaceHash(cwd)) throw new Error(ui().improve.staleProposal)
  if (!proposal.preparedOn || proposal.preparedOn !== calendarToday() || proposal.changes.some(c => c.date < calendarToday())) throw new Error(ui().improve.expiredProposal)
  if (validatePlan(proposal.plan).some((issue) => issue.severity === 'error')) throw new Error(ui().improve.invalidProposal)
  withLocale(proposal.plan.locale === 'pl' ? 'pl' : 'en', () => writePlan(cwd, proposal.plan))
  return proposal
}
