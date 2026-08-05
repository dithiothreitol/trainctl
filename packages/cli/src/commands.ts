/** Handlery komend CLI — czyste funkcje (cwd, argumenty) → { output, code }. */
import { diffDays, type Weekday } from '@tren/core'
import { loadConfig, writeConfigTemplate, CONFIG_FILE } from './config.ts'
import { appendLog, logFor, parseTime } from './logfile.ts'
import {
  computePlan,
  findDay,
  fmtTime,
  loadPlan,
  shiftWorkout,
  workoutText,
  writePlan,
  PLAN_MD,
  PLAN_YAML,
} from './planfile.ts'
import { KIND_PURPOSE, RULE_EXPLAIN } from './rules-explain.ts'

export interface CmdResult {
  output: string
  code: number
}

const ok = (output: string): CmdResult => ({ output, code: 0 })
const fail = (e: unknown): CmdResult => ({
  output: e instanceof Error ? e.message : String(e),
  code: 1,
})

export function localToday(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

const WEEKDAY_PL: Record<Weekday, string> = {
  mon: 'poniedziałek', tue: 'wtorek', wed: 'środa', thu: 'czwartek',
  fri: 'piątek', sat: 'sobota', sun: 'niedziela',
}

export function cmdInit(cwd: string): CmdResult {
  try {
    writeConfigTemplate(cwd)
    return ok(
      `Utworzono ${CONFIG_FILE}.\n` +
        'Uzupełnij profil (zwłaszcza results — kalibrujemy z wyników startów, nie z zegarka) ' +
        'i uruchom: tren plan',
    )
  } catch (e) {
    return fail(e)
  }
}

export function cmdPlan(cwd: string, opts: { date?: string | undefined } = {}): CmdResult {
  try {
    const today = opts.date ?? localToday()
    const config = loadConfig(cwd)
    const plan = computePlan(config, today)
    const lines: string[] = []
    lines.push(
      `Plan: ${plan.goal.name} (${plan.goal.distanceKm} km) — ${plan.goal.date}, ` +
        `${plan.weeks.length} tyg., szczyt ${plan.peakKmPlanned} km/tydz., VDOT ${plan.vdot}.`,
    )
    if (plan.prediction) {
      lines.push(
        `Predykcja: ${fmtTime(plan.prediction.loSec)}–${fmtTime(plan.prediction.hiSec)} ` +
          `(${plan.prediction.method}).`,
      )
      const target = plan.goal.targetTimeSec
      if (target) {
        if (target < plan.prediction.loSec) {
          lines.push(
            `⚠ Cel ${fmtTime(target)} jest ambitniejszy niż przedział predykcji — ` +
              'realny przy idealnym cyklu albo wart korekty.',
          )
        } else if (target > plan.prediction.hiSec) {
          lines.push(`Cel ${fmtTime(target)} jest zachowawczy względem predykcji.`)
        } else {
          lines.push(`Cel ${fmtTime(target)} mieści się w przedziale predykcji.`)
        }
      }
    }
    for (const w of plan.feasibilityWarnings) lines.push(`⚠ ${w}`)
    writePlan(cwd, plan)
    lines.push(`Zapisano: ${PLAN_YAML} + ${PLAN_MD}`)
    return ok(lines.join('\n'))
  } catch (e) {
    return fail(e)
  }
}

export function cmdToday(cwd: string, opts: { date?: string | undefined } = {}): CmdResult {
  try {
    const date = opts.date ?? localToday()
    const plan = loadPlan(cwd)
    const hit = findDay(plan, date)
    if (!hit) return ok(`${date}: poza zakresem planu (${plan.weeks[0]?.weekStart} → ${plan.goal.date}).`)
    const { week, day } = hit
    const head = `${date} (${WEEKDAY_PL[day.weekday]}) · tydzień ${week.skeleton.index + 1}/${plan.weeks.length} · ${week.skeleton.phase}`
    const entry = logFor(cwd, date)
    const status = entry ? `\n[zalogowano: ${entry.status}${entry.note ? ` — ${entry.note}` : ''}]` : ''
    if (!day.workout) {
      return ok(`${head}\nDzień wolny — odpoczynek jest częścią planu.${status}`)
    }
    return ok(
      `${head}\n${workoutText(day)}\n(${day.workout.distanceKm} km, ${day.workout.kind})` +
        `${status}\nDlaczego ten trening: tren why --date ${date}`,
    )
  } catch (e) {
    return fail(e)
  }
}

export function cmdWeek(cwd: string, opts: { date?: string | undefined } = {}): CmdResult {
  try {
    const date = opts.date ?? localToday()
    const plan = loadPlan(cwd)
    const hit = findDay(plan, date)
    if (!hit) return ok(`${date}: poza zakresem planu (${plan.weeks[0]?.weekStart} → ${plan.goal.date}).`)
    const { week } = hit
    const sk = week.skeleton
    const model = sk.intensityModel === 'pyramidal' ? 'piramidalnie' : 'polaryzacja'
    const lines = [
      `Tydzień ${sk.index + 1}/${plan.weeks.length} od ${week.weekStart} · ${sk.phase} (${model}) · ` +
        `cel ${sk.targetKm} km, plan ${week.totalKm} km${sk.deload ? ' · ODCIĄŻENIE' : ''}` +
        `${sk.raceDate ? ` · START ${sk.raceDate}` : ''}`,
    ]
    for (const day of week.days) {
      const entry = logFor(cwd, day.date)
      const mark = entry ? ` [${entry.status}]` : ''
      const text = day.workout ? `${workoutText(day)} (${day.workout.distanceKm} km)` : 'wolne'
      lines.push(`- ${day.date} ${WEEKDAY_PL[day.weekday]}: ${text}${mark}`)
    }
    return ok(lines.join('\n'))
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
    if (!findDay(plan, date)) return fail(new Error(`Data ${date} poza zakresem planu.`))
    const status = (opts.status ?? 'done') as 'done' | 'skipped' | 'modified'
    if (!['done', 'skipped', 'modified'].includes(status)) {
      return fail(new Error(`Nieznany status "${opts.status}" — done|skipped|modified.`))
    }
    appendLog(cwd, {
      date,
      status,
      ...(opts.km ? { km: Number(opts.km) } : {}),
      ...(opts.time ? { timeSec: parseTime(opts.time) } : {}),
      ...(opts.note ? { note: opts.note } : {}),
      loggedAt: new Date().toISOString(),
    })
    return ok(`Zalogowano ${date}: ${status}.`)
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
    const w = warnings.map((x) => `⚠ ${x}`).join('\n')
    return ok(`Zamieniono treningi ${opts.from} ↔ ${opts.to}.${w ? `\n${w}` : ''}`)
  } catch (e) {
    return fail(e)
  }
}

export function cmdWhy(cwd: string, opts: { date?: string | undefined } = {}): CmdResult {
  try {
    const date = opts.date ?? localToday()
    const plan = loadPlan(cwd)
    const hit = findDay(plan, date)
    if (!hit) return ok(`${date}: poza zakresem planu.`)
    const { week, day } = hit
    const lines: string[] = []
    const sk = week.skeleton
    lines.push(
      `${date} · faza: ${sk.phase} (${sk.intensityModel === 'pyramidal' ? 'piramidalnie' : 'polaryzacja'})` +
        `${sk.deload ? ' · tydzień odciążeniowy' : ''}`,
    )
    if (!day.workout) {
      lines.push(
        'Dzień wolny. Adaptacja zachodzi w regeneracji — plan trenera zakładał ' +
          '2–3 dni wolne tygodniowo (korpus: PN 94%, PT 92%).',
      )
      return ok(lines.join('\n'))
    }
    lines.push('', KIND_PURPOSE[day.workout.kind], '')
    const refs = new Set([...day.workout.ruleRefs, ...sk.ruleRefs])
    for (const r of [...refs].sort()) {
      const explain = RULE_EXPLAIN[r]
      if (explain) lines.push(`- ${r}: ${explain}`)
    }
    lines.push('', 'Źródła i pełne parametry: docs/science/FOUNDATIONS.md §10.')
    return ok(lines.join('\n'))
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
      lines.push('(plan zawiera ręczne przesunięcia — pokażą się jako różnice)')
    }
    const freshByStart = new Map(fresh.weeks.map((w) => [w.weekStart, w]))
    for (const week of stored.weeks) {
      const f = freshByStart.get(week.weekStart)
      if (!f) {
        lines.push(`- tydzień ${week.weekStart}: znika z planu`)
        continue
      }
      if (f.skeleton.targetKm !== week.skeleton.targetKm) {
        lines.push(
          `~ tydzień ${week.weekStart}: objętość ${week.skeleton.targetKm} → ${f.skeleton.targetKm} km`,
        )
      }
      const fd = new Map(f.days.map((d) => [d.date, d]))
      for (const day of week.days) {
        const nd = fd.get(day.date)
        const a = day.workout?.kind ?? 'wolne'
        const b = nd?.workout?.kind ?? 'wolne'
        if (a !== b) lines.push(`~ ${day.date}: ${a} → ${b}`)
      }
    }
    for (const w of fresh.weeks) {
      if (!stored.weeks.some((s) => s.weekStart === w.weekStart)) {
        lines.push(`+ tydzień ${w.weekStart}: nowy (${w.skeleton.targetKm} km)`)
      }
    }
    if (lines.length === 0) return ok('Plan aktualny — brak różnic względem regeneracji z tren.yaml.')
    lines.push('', 'Zastosowanie zmian: tren plan (nadpisze plan/ — masz go w gicie).')
    return ok(lines.join('\n'))
  } catch (e) {
    return fail(e)
  }
}

export function daysToRace(plan: { goal: { date: string } }, today: string): number {
  return diffDays(today, plan.goal.date)
}
