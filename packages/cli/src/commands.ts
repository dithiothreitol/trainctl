/** Handlery komend CLI — czyste funkcje (cwd, argumenty) → { output, code }. */
import {
  analyzeExecution,
  diffDays,
  planDeskDay,
  type ExecutionRecord,
  type PlannedWorkout,
  type SyncedActivity,
  type Weekday,
} from '@tren/core'
import { loadConfig, writeConfigTemplate, CONFIG_FILE } from './config.ts'
import { appendLog, logFor, parseTime, readLog, type LogEntry } from './logfile.ts'
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
  type StoredPlan,
} from './planfile.ts'
import { KIND_PURPOSE, RULE_EXPLAIN } from './rules-explain.ts'
import {
  compare,
  defaultProviderFactory,
  defaultRange,
  readSnapshot,
  workoutsToPush,
  writeSnapshot,
  SYNC_FILE,
  type ProviderFactory,
} from './sync.ts'

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
      return ok(`Brak treningów do wypchnięcia w zakresie ${from} → ${to}.`)
    }
    const provider = factory(cwd)
    const res = await provider.pushWorkouts(workouts)
    return ok(
      `Wypchnięto ${res.pushed} treningów do ${provider.name} (${from} → ${to}).\n` +
        'Trafią na zegarek przy najbliższej synchronizacji urządzenia.\n' +
        'Ponowny push tych samych dni nadpisuje wpisy (upsert po external_id).',
    )
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
    const lines = [
      `Pobrano z ${provider.name} (${from} → ${to}): ${activities.length} aktywności ` +
        `(w tym ${runs.length} biegowych, ${km} km), ${wellness.length} wpisów wellness.`,
      `Zapisano: ${SYNC_FILE}`,
    ]
    try {
      const plan = loadPlan(cwd)
      const rows = compare(plan, activities, from, to).filter((r) => r.status !== 'zgodne')
      if (rows.length) {
        lines.push('', 'Rozjazdy plan ↔ wykonanie:')
        for (const r of rows.slice(-10)) {
          const actual = r.actualKm === undefined ? '—' : `${r.actualKm} km`
          lines.push(`- ${r.date}: plan ${r.plannedKm} km, wykonano ${actual} → ${r.status}`)
        }
      } else {
        lines.push('Wykonanie zgodne z planem w całym zakresie.')
      }
    } catch {
      lines.push('(brak planu — pominięto porównanie)')
    }
    return ok(lines.join('\n'))
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
    const lastRaceDay = [...plan.weeks.flatMap((w) => w.days)]
      .filter((d) => d.workout?.kind === 'race' && d.date <= today)
      .at(-1)

    const proposal = analyzeExecution({
      today,
      execution,
      currentWeeklyKm,
      ...(newResults.length ? { newResults } : {}),
      ...(lastRaceDay ? { lastRace: { date: lastRaceDay.date, distanceKm: plan.goal.distanceKm } } : {}),
    })

    const lines: string[] = []
    lines.push(
      `Analiza ${proposal.windowDays} dni (do ${today}): wykonanie ` +
        `${Math.round(proposal.complianceKm * 100)}% objętości, ` +
        `${proposal.missedSessions} pominiętych sesji.`,
    )
    if (!snapshot) {
      lines.push('(brak sync.json — analiza tylko z dziennika; uruchom tren pull po pełne dane)')
    }
    if (proposal.diagnosis.length) {
      lines.push('', 'Diagnoza:')
      for (const d of proposal.diagnosis) lines.push(`- ${d}`)
    }
    lines.push('', 'Propozycje:')
    for (const a of proposal.actions) {
      const refs = a.ruleRefs.length ? ` [${a.ruleRefs.join(', ')}]` : ''
      lines.push(`- ${a.type}: ${a.detail}${refs}`)
    }
    for (const w of proposal.warnings) lines.push(`⚠ ${w}`)
    const volume = proposal.actions.find((a) => a.suggestedWeeklyKm)
    if (volume) {
      lines.push(
        '',
        `Aby zastosować: ustaw athlete.recentWeeklyKm: ${volume.suggestedWeeklyKm} w tren.yaml, ` +
          'sprawdź tren diff, potem tren plan. Silnik nie przepisuje planu sam.',
      )
    }
    return ok(lines.join('\n'))
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
      return fail(
        new Error(
          'Brak sekcji desk w tren.yaml. Dodaj np.:\n' +
            'desk:\n  workStart: "09:00"\n  workEnd: "17:00"\n  lunchMinutes: 45\n  prefer: evening',
        ),
      )
    }
    let workout: PlannedWorkout | undefined
    try {
      workout = findDay(loadPlan(cwd), date)?.day.workout
    } catch {
      workout = undefined
    }
    const day = planDeskDay(config.desk, workout, { heavyCognitiveDay: opts.heavy === true })
    const lines: string[] = [`${date} · praca ${config.desk.workStart}–${config.desk.workEnd}`]
    if (workout) {
      lines.push(
        `Trening: ${workout.kind}, ${workout.distanceKm} km` +
          (day.recommended ? ` → okno ${day.recommended.label} (${day.recommended.from}–${day.recommended.to})` : ''),
      )
      lines.push('', 'Okna treningowe:')
      for (const w of day.windows) {
        lines.push(`- ${w.label}: ${w.from}–${w.to} ${w.fits ? '✓ mieści się' : '✗ za krótkie'}`)
      }
    } else {
      lines.push('Dziś bez biegania.')
    }
    lines.push('', `Przerwy w siedzeniu (${day.breaks.length}):`)
    lines.push(day.breaks.map((b) => `${b.at} ${b.what}`).join(' · '))
    lines.push('', 'Uwagi:')
    for (const g of day.guidance) lines.push(`- ${g}`)
    lines.push('', `Reguły: ${day.ruleRefs.join(', ')} (docs/science/FOUNDATIONS.md §10.10)`)
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
