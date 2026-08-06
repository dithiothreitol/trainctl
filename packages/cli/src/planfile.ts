/** Plan jako pliki: plan/plan.yaml (źródło prawdy) + plan/PLAN.md (render). */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse, stringify } from 'yaml'
import {
  diffDays,
  generateMicrocycle,
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
  type Weekday,
} from '@tren/core'
import type { StrengthConfig, TrenConfig } from './config.ts'

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
    throw new Error(
      'Brak wyniku startu z ostatnich 18 miesięcy i brak goal.targetTimeSec — ' +
        'nie mam z czego skalibrować stref (Z-6: kalibrujemy z wyników, nie z zegarka).',
    )
  }
  const zones = paceZones(vdot)
  const macro = planMacrocycle({ today, goal, athlete })
  const weeks = macro.weeks.map((skeleton) =>
    generateMicrocycle({ skeleton, athlete, zones, goal, testDistanceKm: testDistanceKm(goal) }),
  )
  if (config.strength?.enabled) applyStrength(weeks, config.strength)
  const plan: StoredPlan = {
    generatedAt: today,
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
    plan.feasibilityWarnings.push(
      'strefy skalibrowane z celu czasowego, nie z realnego wyniku — dodaj start do athlete.results',
    )
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
    throw new Error('Brak planu — uruchom najpierw: tren plan')
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

const WEEKDAY_PL: Record<Weekday, string> = {
  mon: 'PN', tue: 'WT', wed: 'ŚR', thu: 'CZ', fri: 'PT', sat: 'SB', sun: 'ND',
}

export function workoutText(day: PlannedDay): string {
  if (!day.workout) return '—'
  const parts = day.workout.segments.map((s) => s.description)
  const cooldown = parts.findIndex((p) => p.startsWith('Na koniec treningu'))
  if (cooldown === -1) return parts.join(' + ')
  const mains = parts.filter((_, i) => i !== cooldown).join(' + ')
  // człony bywają już zakończone kropką — nie dokładamy drugiej
  return `${mains.replace(/\.\s*$/, '')}. ${parts[cooldown]}`
}

const PHASE_PL: Record<string, string> = {
  base: 'baza', build: 'budowanie', peak: 'szczyt', taper: 'taper', race: 'tydzień startowy',
}

export function renderMarkdown(plan: StoredPlan): string {
  const lines: string[] = []
  const target = plan.goal.targetTimeSec ? ` · cel: ${fmtTime(plan.goal.targetTimeSec)}` : ''
  lines.push(`# Plan: ${plan.goal.name} — ${plan.goal.date}${target}`)
  lines.push('')
  lines.push(
    `Wygenerowano ${plan.generatedAt} · VDOT ${plan.vdot} (${plan.vdotSource === 'result' ? 'z wyniku startu' : 'z celu — do rekalibracji!'}) · ` +
      `szczyt ${plan.peakKmPlanned} km/tydz.`,
  )
  if (plan.prediction) {
    lines.push(
      `Predykcja na ${plan.goal.distanceKm} km: **${fmtTime(plan.prediction.loSec)}–${fmtTime(plan.prediction.hiSec)}** ` +
        `(metoda: ${plan.prediction.method}; W-1: zawsze przedział).`,
    )
  }
  for (const w of plan.feasibilityWarnings) lines.push(`> ⚠ ${w}`)
  for (const week of plan.weeks) {
    const sk = week.skeleton
    const label = [
      PHASE_PL[sk.phase] ?? sk.phase,
      sk.intensityModel === 'pyramidal' ? 'piramidalnie' : 'polaryzacja',
      `${week.totalKm} km`,
      ...(sk.deload ? ['odciążenie'] : []),
    ].join(' · ')
    lines.push('', `## Tydzień ${sk.index + 1} — od ${week.weekStart} (${label})`, '')
    lines.push('| Dzień | Data | Trening |', '|---|---|---|')
    for (const day of week.days) {
      const [, m, d] = day.date.split('-')
      const strength = day.strength ? ` **+ SIŁA** ~${day.strength.durationMin} min` : ''
      lines.push(`| ${WEEKDAY_PL[day.weekday]} | ${Number(d)}.${m} | ${workoutText(day)}${strength} |`)
    }
    for (const note of week.strengthNotes ?? []) lines.push(`> ${note}`)
  }
  if (plan.changes.length) {
    lines.push('', '## Zmiany', '')
    for (const c of plan.changes) lines.push(`- ${c.at}: ${c.action} — ${c.detail}`)
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
  const from = findDay(plan, fromDate)
  const to = findDay(plan, toDate)
  if (!from) throw new Error(`Data ${fromDate} poza planem`)
  if (!to) throw new Error(`Data ${toDate} poza planem`)
  if (from.week.weekStart !== to.week.weekStart) {
    throw new Error('shift działa w obrębie jednego tygodnia (pełna renegocjacja — Faza 3)')
  }
  const race = from.week.skeleton.raceDate
  if (race) {
    if (fromDate === race || toDate === race) throw new Error('Dnia startu nie ruszamy.')
    const dayBefore = diffDays(fromDate, race) === 1 ? fromDate : diffDays(toDate, race) === 1 ? toDate : null
    const moved = from.day.workout
    if (dayBefore === toDate && moved && QUALITY_KINDS.has(moved.kind)) {
      throw new Error('Dzień przed startem zostaje lekki — nie wstawiam tam akcentu.')
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
      warnings.push(
        `akcenty ${qualityDays[i - 1]} i ${qualityDays[i]} są dzień po dniu — ` +
          'reguła I-7 zaleca ≥48 h między sesjami jakościowymi',
      )
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
      warnings.push(
        `${day.date}: akcent wylądował w dniu sesji siłowej — S-5 odradza ciężką siłę ` +
          'przy jednostce jakościowej; przenieś siłownię albo wygeneruj plan ponownie (tren plan)',
      )
    } else if (dayBeforeQuality) {
      warnings.push(
        `${day.date}: sesja siłowa wypada dzień przed akcentem (${next!.date}) — ` +
          'S-5 zaleca ≥24 h odstępu po ciężkiej sile',
      )
    }
  }
  return { warnings }
}
