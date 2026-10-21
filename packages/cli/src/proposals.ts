import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { estimateWorkoutMinutes, validatePlan, weekTotals, withLocale, generateMicrocycle, paceZones, recalibrateWorkout, testDistanceKm, parseIso, shortenWorkout, type ShortenedWorkout, type AdaptationProposal, type PlannedDay } from 'trainctl-core'
import { CONFIG_FILE, loadConfig } from './config.ts'
import { readLog, LOG_FILE } from './logfile.ts'
import { computePlan, cycleWeeksOf, dayFingerprint, loadPlan, planEnd, PLAN_YAML, writePlan, workoutText, type StoredPlan } from './planfile.ts'
import { ui } from './i18n/index.ts'
import { readSnapshot } from './sync.ts'
import { isRunningActivity } from './execution.ts'
import { clockToday } from './clock.ts'
import { resultKey } from './calibration.ts'

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
  changes: { date: string; before: string; after: string; beforeKm: number; afterKm: number }[]
  protectedDates: string[]
  plan: StoredPlan
}

const hash = (text: string): string => createHash('sha256').update(text).digest('hex')
/** Prawdziwy (albo jawnie symulowany) dzień kalendarzowy — granica ochrony przeszłości. */
export const calendarToday = (): string => clockToday()
export function workspaceHash(cwd: string): string {
  return hash(JSON.stringify([PLAN_YAML, CONFIG_FILE, LOG_FILE, 'sync.json'].map((name) => {
    const path = join(cwd, name)
    return [name, existsSync(path) ? readFileSync(path, 'utf-8') : null]
  })))
}
const proposalId = (proposal: Omit<PlanProposal, 'id'>): string => hash(JSON.stringify(proposal)).slice(0, 24)

function saveProposal(cwd: string, body: Omit<PlanProposal, 'id'>): PlanProposal {
  if (validatePlan(body.plan).some(issue => issue.severity === 'error')) throw new Error(ui().improve.invalidProposal)
  const proposal: PlanProposal = { ...body, id: proposalId(body) }
  const dir = join(cwd, 'plan', 'proposals')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, `${proposal.id}.json`), JSON.stringify(proposal, null, 2) + '\n', 'utf-8')
  return proposal
}

/** Daty z zapisem wykonania (dziennik albo bieg z synchronizacji) — nienaruszalne dla zmian planu. */
export function recordedDates(cwd: string): Set<string> {
  const dates = new Set(readLog(cwd).map(entry => entry.date))
  for (const a of readSnapshot(cwd)?.activities ?? []) if (isRunningActivity(a) && (a.distanceKm ?? 0) > 0) dates.add(a.date)
  return dates
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
  plan.changes.push({ at: calendarToday(), action: 'shorten', detail: `${date}: ${before.workout!.distanceKm} → ${day.workout.distanceKm} km; ${budget} min; ${adjustment.status}` })
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
  if (analysis.actions.some((a) => a.type === 'post-race-recovery' || a.type === 'conservative-restart')) throw new Error(ui().improve.manualRecovery)
  const volume = analysis.actions.find((a) => a.suggestedWeeklyKm !== undefined)
  const recalibrate = analysis.actions.some((a) => a.type === 'recalibrate-zones')
  if (!volume && !recalibrate) throw new Error(ui().improve.noPatch)
  const config = loadConfig(cwd)
  if (JSON.stringify(config.goal) !== JSON.stringify(plan.goal)) throw new Error(ui().improve.changedGoal)
  // A completed time trial with no result in the profile is a request for data,
  // not permission to rewrite calibration timestamps and call that a plan change.
  if (!volume && JSON.stringify(config.athlete.results.map(resultKey).sort()) === JSON.stringify(plan.calibration.results.map(resultKey).sort()))
    throw new Error(ui().improve.noPatch)
  const nextConfig = structuredClone(config)
  const candidate = withLocale(plan.locale === 'pl' ? 'pl' : 'en', () => computePlan(nextConfig, plan.generatedAt, today, {
    // Tygodnie zapisanego planu zamiast świeżych; budżet czasu z profilu stosuje
    // potem computePlan (E-2), a siła zostaje na swoich dniach.
    budgetStrength: 'keep',
    beforeTimeBudget: (metadata) => {
    // Compute calibration metadata separately; never replay a new baseline from August.
    const zones = paceZones(metadata.vdot)
    const anchor = plan.weeks.find(w => w.weekStart > today && !w.skeleton.deload && !['taper', 'race'].includes(w.skeleton.phase))
      ?? plan.weeks.find(w => w.days.some(d => d.date > today))
    metadata.weeks = plan.weeks.map(week => {
      if (!volume) {
        const copy = structuredClone(week)
        for (const day of copy.days) if (day.workout) day.workout = recalibrateWorkout(day.workout, zones, week.skeleton.intensityModel === 'polarized')
        return copy
      }
      const skeleton = structuredClone(week.skeleton)
      delete skeleton.timeCappedKm // budżet zastosuje computePlan po skalowaniu
      skeleton.targetKm = Math.round(volume.suggestedWeeklyKm! * skeleton.targetKm / Math.max(1, anchor?.skeleton.targetKm ?? skeleton.targetKm))
      const generated = generateMicrocycle({ skeleton, athlete: nextConfig.athlete, goal: plan.goal, zones, testDistanceKm: testDistanceKm(plan.goal) })
      // Strength is an independent track; a volume correction does not reassign it.
      for (const day of generated.days) {
        const strength = week.days.find(d => d.date === day.date)?.strength
        if (strength) day.strength = structuredClone(strength)
      }
      return generated
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
    if (changes.some((c) => week.days.some((d) => d.date === c.date))) {
      Object.assign(week, weekTotals(week.days))
      const skeleton = candidate.weeks.find((w) => w.weekStart === week.weekStart)?.skeleton
      if (skeleton) week.skeleton = structuredClone(skeleton)
    }
  }
  next.calibration = candidate.calibration!
  if (volume) next.loadState = { baselineWeeklyKm: volume.suggestedWeeklyKm!, effectiveFrom: today, profileWeeklyKm: config.athlete.recentWeeklyKm }
  next.vdot = candidate.vdot
  next.vdotSource = candidate.vdotSource
  if (candidate.prediction) next.prediction = candidate.prediction
  else delete next.prediction
  next.peakKmPlanned = Math.max(...cycleWeeksOf(next).map((w) => w.totalKm))
  next.feasibilityWarnings = candidate.feasibilityWarnings
  next.changes.push({ at: today, action: 'adapt', detail: analysis.actions.map((a) => a.type).join(', ') })
  // Lint remains visible in the preview; broken file invariants never reach disk.
  const errors = validatePlan(next).filter((issue) => issue.severity === 'error')
  if (errors.length) throw new Error(ui().improve.invalidProposal)
  if (!changes.length && JSON.stringify(next.calibration) === JSON.stringify(plan.calibration)) throw new Error(ui().improve.noPatch)
  return saveProposal(cwd, { schemaVersion: 1, kind: 'adaptation', preparedOn: calendarToday(), baseHash, createdFor: today, analysis, vdotBefore: plan.vdot, changes, protectedDates, plan: next })
}

export type ProposalState = 'valid' | 'expired' | 'stale' | 'invalid'

/**
 * Zapisane propozycje z ich stanem na dziś — te same warunki, które sprawdza
 * `applyProposal`, w tej samej kolejności. Dziś nic ich nie listowało, więc
 * zgubiony ID trzeba było szukać w `plan/proposals/`.
 */
export function listProposals(cwd: string): { id: string; kind: string; createdFor: string; preparedOn: string | null; changes: number; firstDate: string | null; state: ProposalState }[] {
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
