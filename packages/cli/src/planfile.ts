/** Plan jako pliki: plan/plan.yaml (źródło prawdy) + plan/PLAN.md (render). */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse, stringify } from 'yaml'
import {
  diffDays,
  generateMicrocycle,
  getLocale,
  messages,
  paceZones,
  planMacrocycle,
  planStrengthWeek,
  predictRace,
  testDistanceKm,
  vdotFromRace,
  type Microcycle,
  type PlannedDay,
  type RaceGoal,
  type RacePrediction,
} from '@tren/core'
import type { StrengthConfig, TrenConfig } from './config.ts'
import { ui } from './i18n/index.ts'

export const PLAN_DIR = 'plan'
export const PLAN_YAML = join(PLAN_DIR, 'plan.yaml')
export const PLAN_MD = join(PLAN_DIR, 'PLAN.md')

export interface PlanChange {
  at: string
  action: string
  detail: string
}

export interface StoredPlan {
  generatedAt: string
  /** Język, w którym zapisano opisy jednostek — `tren diff` mówi, gdy się rozjedzie. */
  locale?: string
  vdot: number
  vdotSource: 'result' | 'goal-target'
  goal: RaceGoal
  peakKmPlanned: number
  peakKmRecommended: number
  feasibilityWarnings: string[]
  prediction?: RacePrediction
  changes: PlanChange[]
  weeks: Microcycle[]
}

export function computePlan(config: TrenConfig, today: string): StoredPlan {
  const { athlete, goal } = config
  const usable = athlete.results.filter(
    (r) => r.date <= today && diffDays(r.date, today) <= 540,
  )
  let vdot: number
  let vdotSource: StoredPlan['vdotSource']
  if (usable.length > 0) {
    vdot = Math.max(...usable.map((r) => vdotFromRace(r.distanceKm, r.timeSec)))
    vdotSource = 'result'
  } else if (goal.targetTimeSec) {
    vdot = vdotFromRace(goal.distanceKm, goal.targetTimeSec)
    vdotSource = 'goal-target'
  } else {
    throw new Error(ui().planMd.noCalibration)
  }
  const zones = paceZones(vdot)
  const macro = planMacrocycle({ today, goal, athlete })
  const weeks = macro.weeks.map((skeleton) =>
    generateMicrocycle({ skeleton, athlete, zones, goal, testDistanceKm: testDistanceKm(goal) }),
  )
  if (config.strength?.enabled) applyStrength(weeks, config.strength)
  const plan: StoredPlan = {
    generatedAt: today,
    locale: getLocale(),
    vdot: Math.round(vdot * 10) / 10,
    vdotSource,
    goal,
    peakKmPlanned: macro.peakKmPlanned,
    peakKmRecommended: macro.peakKmRecommended,
    feasibilityWarnings: [...macro.feasibilityWarnings],
    changes: [],
    weeks,
  }
  if (usable.length > 0) {
    plan.prediction = predictRace(usable, goal.distanceKm, { today })
  }
  if (vdotSource === 'goal-target') {
    plan.feasibilityWarnings.push(ui().planMd.zonesFromGoal)
  }
  return plan
}

export function writePlan(cwd: string, plan: StoredPlan): void {
  mkdirSync(join(cwd, PLAN_DIR), { recursive: true })
  // Bez aliasów YAML (`pace: *a1`): plan jest dokumentem, który użytkownik czyta
  // i edytuje (plan-as-code), a alias zmusza go do skakania po pliku — i sprawia,
  // że edycja jednego miejsca po cichu zmienia inne.
  writeFileSync(join(cwd, PLAN_YAML), stringify(plan, { aliasDuplicateObjects: false }), 'utf-8')
  writeFileSync(join(cwd, PLAN_MD), renderMarkdown(plan), 'utf-8')
}

/**
 * Rozstawienie siły na ciągu tygodni. Ciąg, a nie tydzień po tygodniu osobno:
 * odstęp ≥48 h musi obowiązywać także na styku niedziela→poniedziałek.
 * Używane przy generacji planu i ponownie po renegocjacji tygodnia.
 */
export function applyStrength(weeks: Microcycle[], strength: StrengthConfig): void {
  let lastSessionDate: string | undefined
  for (const week of weeks) {
    const { byDate, notes } = planStrengthWeek({
      week,
      phase: week.skeleton.phase,
      deload: week.skeleton.deload,
      ...(strength.days?.length ? { daysPreference: strength.days } : {}),
      ...(lastSessionDate ? { lastSessionDate } : {}),
    })
    for (const day of week.days) {
      const session = byDate.get(day.date)
      if (session) day.strength = session
      else delete day.strength
    }
    const dates = [...byDate.keys()].sort()
    if (dates.length) lastSessionDate = dates[dates.length - 1]
    if (notes.length) week.strengthNotes = notes
    else delete week.strengthNotes
  }
}

export function loadPlan(cwd: string): StoredPlan {
  const path = join(cwd, PLAN_YAML)
  if (!existsSync(path)) {
    throw new Error(ui().common.noPlan)
  }
  return parse(readFileSync(path, 'utf-8')) as StoredPlan
}

export function findDay(
  plan: StoredPlan,
  date: string,
): { week: Microcycle; day: PlannedDay } | undefined {
  for (const week of plan.weeks) {
    for (const day of week.days) {
      if (day.date === date) return { week, day }
    }
  }
  return undefined
}

/** Sekundy → „H:MM:SS"/„M:SS". Zaokrąglamy CAŁOŚĆ, inaczej 3599,7 s dałoby „59:60". */
export function fmtTime(sec: number): string {
  const total = Math.round(sec)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`
}

export function workoutText(day: PlannedDay): string {
  if (!day.workout) return ui().planMd.rest
  const segments = day.workout.segments
  // Człon schłodzenia rozpoznajemy po TYPIE, nie po treści opisu: dopasowanie do
  // tekstu („Na koniec treningu…") działało tylko po polsku i cicho przestawało
  // po zmianie brzmienia opisu.
  const cooldown = segments.findIndex((s) => s.type === 'cooldown')
  const parts = segments.map((s) => s.description)
  if (cooldown === -1) return parts.join(' + ')
  const mains = parts.filter((_, i) => i !== cooldown).join(' + ')
  // człony bywają już zakończone kropką — nie dokładamy drugiej
  return `${mains.replace(/\.\s*$/, '')}. ${parts[cooldown]}`
}

export function renderMarkdown(plan: StoredPlan): string {
  const m = ui().planMd
  const core = messages()
  const lines: string[] = []
  const target = plan.goal.targetTimeSec ? m.goalTime(fmtTime(plan.goal.targetTimeSec)) : ''
  lines.push(`# ${m.heading(plan.goal.name, plan.goal.date)}${target}`)
  lines.push('')
  lines.push(
    m.meta(
      plan.generatedAt,
      plan.vdot,
      plan.vdotSource === 'result' ? m.vdotFromResult : m.vdotFromGoal,
      plan.peakKmPlanned,
    ),
  )
  if (plan.prediction) {
    lines.push(
      m.prediction(
        plan.goal.distanceKm,
        fmtTime(plan.prediction.loSec),
        fmtTime(plan.prediction.hiSec),
        plan.prediction.method,
      ),
    )
  }
  for (const w of plan.feasibilityWarnings) lines.push(`> ⚠ ${w}`)
  for (const week of plan.weeks) {
    const sk = week.skeleton
    const label = [
      core.phase[sk.phase] ?? sk.phase,
      core.intensityModel[sk.intensityModel],
      `${week.totalKm} km`,
      ...(sk.deload ? [m.deload] : []),
    ].join(' · ')
    lines.push('', `## ${m.weekHeading(sk.index + 1, week.weekStart, label)}`, '')
    lines.push(
      `| ${m.columns.day} | ${m.columns.date} | ${m.columns.workout} |`,
      '|---|---|---|',
    )
    for (const day of week.days) {
      const [, mo, d] = day.date.split('-')
      const strength = day.strength ? m.strengthTag(day.strength.durationMin) : ''
      lines.push(
        `| ${core.weekdayShort[day.weekday]} | ${Number(d)}.${mo} | ${workoutText(day)}${strength} |`,
      )
    }
    for (const note of week.strengthNotes ?? []) lines.push(`> ${note}`)
  }
  if (plan.changes.length) {
    lines.push('', `## ${m.changes}`, '')
    for (const c of plan.changes) lines.push(`- ${m.changeLine(c.at, c.action, c.detail)}`)
  }
  lines.push('')
  return lines.join('\n')
}

const QUALITY_KINDS = new Set(['quality_intervals', 'quality_continuous', 'sharpener'])

/** Zamiana treningów między dwoma datami tego samego tygodnia (renegocjacja ręczna). */
export function shiftWorkout(
  plan: StoredPlan,
  fromDate: string,
  toDate: string,
): { warnings: string[] } {
  const t = ui().shift
  const from = findDay(plan, fromDate)
  const to = findDay(plan, toDate)
  if (!from) throw new Error(t.outsidePlan(fromDate))
  if (!to) throw new Error(t.outsidePlan(toDate))
  if (from.week.weekStart !== to.week.weekStart) {
    throw new Error(t.sameWeekOnly)
  }
  const race = from.week.skeleton.raceDate
  if (race) {
    if (fromDate === race || toDate === race) throw new Error(t.notRaceDay)
    const dayBefore = diffDays(fromDate, race) === 1 ? fromDate : diffDays(toDate, race) === 1 ? toDate : null
    const moved = from.day.workout
    if (dayBefore === toDate && moved && QUALITY_KINDS.has(moved.kind)) {
      throw new Error(t.dayBeforeRaceLight)
    }
  }
  const tmp = from.day.workout
  if (to.day.workout) from.day.workout = to.day.workout
  else delete from.day.workout
  if (tmp) to.day.workout = tmp
  else delete to.day.workout

  const warnings: string[] = []
  const qualityDays = from.week.days
    .filter((d) => d.workout && QUALITY_KINDS.has(d.workout.kind))
    .map((d) => d.date)
  for (let i = 1; i < qualityDays.length; i++) {
    const gap = Math.abs(diffDays(qualityDays[i - 1]!, qualityDays[i]!))
    if (gap < 2) {
      warnings.push(t.accentsTooClose(qualityDays[i - 1]!, qualityDays[i]!))
    }
  }

  // Siła zostaje na swoim dniu (przesuwamy bieganie, nie siłownię), ale
  // przesunięcie akcentu mogło ją postawić obok jednostki jakościowej albo
  // dzień przed nią — S-5 tego zabrania, więc musimy o tym powiedzieć.
  for (const day of from.week.days) {
    if (!day.strength) continue
    const sameDay = day.workout && QUALITY_KINDS.has(day.workout.kind)
    const next = from.week.days.find((d) => diffDays(day.date, d.date) === 1)
    const dayBeforeQuality = next?.workout && QUALITY_KINDS.has(next.workout.kind)
    if (sameDay) {
      warnings.push(t.strengthSameDay(day.date))
    } else if (dayBeforeQuality) {
      warnings.push(t.strengthDayBefore(day.date, next!.date))
    }
  }
  return { warnings }
}
