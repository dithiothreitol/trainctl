/** Handlery komend CLI — czyste funkcje (cwd, argumenty) → { output, code }. */
import {
  analyzeExecution,
  diffDays,
  planDeskDay,
  reschedule,
  COACH_STYLE,
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
import { b, renderPlain, type Block } from './ui/blocks.ts'
import type { ColorName } from './ui/theme.ts'

/** Kolor semantyczny jednostki treningowej — spójny w całym CLI. */
export const KIND_COLOR: Record<string, ColorName> = {
  easy: 'easy',
  long: 'long',
  easy_hills: 'accent',
  quality_intervals: 'quality',
  quality_continuous: 'quality',
  sharpener: 'quality',
  race: 'race',
}

const KIND_LABEL: Record<string, string> = {
  easy: 'spokojne',
  long: 'długie',
  easy_hills: 'podbiegi',
  quality_intervals: 'interwały',
  quality_continuous: 'akcent ciągły',
  sharpener: 'rozruch',
  race: 'START',
}

const PHASE_LABEL: Record<string, string> = {
  base: 'baza',
  build: 'budowanie',
  peak: 'szczyt',
  taper: 'taper',
  race: 'tydzień startowy',
}
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

const WEEKDAY_PL: Record<Weekday, string> = {
  mon: 'poniedziałek', tue: 'wtorek', wed: 'środa', thu: 'czwartek',
  fri: 'piątek', sat: 'sobota', sun: 'niedziela',
}

/** Skróty jak w planach trenera (korpus). */
const WEEKDAY_SHORT: Record<Weekday, string> = {
  mon: 'PN', tue: 'WT', wed: 'ŚR', thu: 'CZ', fri: 'PT', sat: 'SB', sun: 'ND',
}

export function cmdInit(cwd: string, content?: string): CmdResult {
  try {
    writeConfigTemplate(cwd, content)
    return okDoc([
      b.success(`Utworzono ${CONFIG_FILE}`),
      ...(content
        ? []
        : [
            b.text(
              'Uzupełnij profil — zwłaszcza results: strefy kalibrujemy z wyników startów, ' +
                'nie z odczytów zegarka.',
            ),
          ]),
      b.hint('następny krok: tren plan'),
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
        `${plan.goal.date} · ${weeksToRace} tygodni planu`,
      ),
      b.kv([
        ['Szczyt objętości', `${plan.peakKmPlanned} km/tydz.`],
        ['Rekomendacja dla dystansu', `${plan.peakKmRecommended} km/tydz.`],
        ['VDOT', `${plan.vdot} (${plan.vdotSource === 'result' ? 'z wyniku startu' : 'z celu — do rekalibracji'})`],
      ]),
    ]

    if (plan.prediction) {
      const range = `${fmtTime(plan.prediction.loSec)} – ${fmtTime(plan.prediction.hiSec)}`
      blocks.push(b.blank(), b.panel('Predykcja wyniku', [
        `${range}   (metoda: ${plan.prediction.method})`,
        'Zawsze przedział, nigdy pojedyncza liczba (W-1).',
      ], 'brand'))
      const target = plan.goal.targetTimeSec
      if (target) {
        if (target < plan.prediction.loSec) {
          blocks.push(
            b.warn(
              `Cel ${fmtTime(target)} jest ambitniejszy niż przedział — realny przy idealnym cyklu albo wart korekty.`,
            ),
          )
        } else if (target > plan.prediction.hiSec) {
          blocks.push(b.info(`Cel ${fmtTime(target)} jest zachowawczy względem predykcji.`))
        } else {
          blocks.push(b.success(`Cel ${fmtTime(target)} mieści się w przedziale predykcji.`))
        }
      }
    }

    // szkic makrocyklu — jedna linia na fazę
    const phases: string[] = []
    let current = ''
    let from = 0
    plan.weeks.forEach((w, i) => {
      const label = PHASE_LABEL[w.skeleton.phase] ?? w.skeleton.phase
      if (label !== current) {
        if (current) phases.push(`${current}: tyg. ${from + 1}–${i}`)
        current = label
        from = i
      }
    })
    if (current) phases.push(`${current}: tyg. ${from + 1}–${plan.weeks.length}`)
    blocks.push(b.section('Struktura'), b.bullets(phases))

    if (plan.feasibilityWarnings.length) {
      blocks.push(b.blank())
      for (const w of plan.feasibilityWarnings) blocks.push(b.warn(w))
    }
    blocks.push(
      b.blank(),
      b.success(`Zapisano ${PLAN_YAML} i ${PLAN_MD}`),
      b.hint('tren today · tren week · tren why'),
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
        b.warn(`${date}: poza zakresem planu (${plan.weeks[0]?.weekStart} ${plan.goal.date}).`),
      ])
    }
    const { week, day } = hit
    const sk = week.skeleton
    const toRace = diffDays(date, plan.goal.date)
    const blocks: Block[] = [
      b.title(
        `${date} · ${WEEKDAY_PL[day.weekday]}`,
        `tydzień ${sk.index + 1}/${plan.weeks.length} · ${PHASE_LABEL[sk.phase] ?? sk.phase}` +
          `${sk.deload ? ' · odciążenie' : ''} · do startu: ${toRace} dni`,
      ),
    ]

    if (!day.workout) {
      blocks.push(b.panel('Dzień wolny', ['Odpoczynek jest częścią planu — adaptacja zachodzi w regeneracji.'], 'muted'))
    } else {
      const w = day.workout
      blocks.push(
        b.panel(
          `${KIND_LABEL[w.kind] ?? w.kind} · ${w.distanceKm} km`,
          [workoutText(day)],
          KIND_COLOR[w.kind] ?? 'accent',
        ),
      )
    }

    const entry = logFor(cwd, date)
    if (entry) {
      blocks.push(
        b.success(
          `Zalogowano: ${entry.status}` +
            (entry.km ? `, ${entry.km} km` : '') +
            (entry.note ? ` — ${entry.note}` : ''),
        ),
      )
    }
    if (day.workout) blocks.push(b.hint(`dlaczego ten trening: tren why --date ${date}`))
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
    if (!hit) return ok(`${date}: poza zakresem planu (${plan.weeks[0]?.weekStart} → ${plan.goal.date}).`)
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
      rows.push([
        WEEKDAY_SHORT[day.weekday],
        day.date.slice(5),
        day.workout ? `${day.workout.distanceKm} km` : '—',
        day.workout ? `${workoutText(day)}${mark}` : 'wolne',
      ])
      accents.push(kind ? KIND_COLOR[kind] : 'muted')
    }
    const blocks: Block[] = [
      b.title(
        `Tydzień ${sk.index + 1}/${plan.weeks.length} · od ${week.weekStart}`,
        `${PHASE_LABEL[sk.phase] ?? sk.phase} (${model}) · cel ${sk.targetKm} km · zaplanowano ${week.totalKm} km` +
          `${sk.deload ? ' · ODCIĄŻENIE' : ''}`,
      ),
      b.table(['dzień', 'data', 'km', 'trening'], rows, accents),
    ]
    if (sk.raceDate) blocks.push(b.info(`Start w tym tygodniu: ${sk.raceDate}`))
    if (sk.keepIntensity) {
      blocks.push(b.info('Taper: objętość w dół, ale intensywność i liczba sesji zostają (T-1/T-2).'))
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
    const blocks: Block[] = [b.success(`Zamieniono treningi ${opts.from} ↔ ${opts.to}`)]
    for (const w of warnings) blocks.push(b.warn(w))
    blocks.push(b.hint(`podgląd tygodnia: tren week --date ${opts.to}`))
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
    if (!hit) return ok(`${date}: poza zakresem planu.`)
    const { week, day } = hit
    const sk = week.skeleton
    const blocks: Block[] = [
      b.title(
        `Dlaczego ten trening · ${date}`,
        `faza: ${PHASE_LABEL[sk.phase] ?? sk.phase} (${sk.intensityModel === 'pyramidal' ? 'piramidalnie' : 'polaryzacja'})` +
          `${sk.deload ? ' · tydzień odciążeniowy' : ''}`,
      ),
    ]
    if (!day.workout) {
      blocks.push(
        b.text(
          'Dzień wolny. Adaptacja zachodzi w regeneracji — plan trenera zakładał ' +
            '2–3 dni wolne tygodniowo (korpus: PN 94%, PT 92%).',
        ),
      )
      return okDoc(blocks)
    }
    blocks.push(
      b.panel(KIND_LABEL[day.workout.kind] ?? day.workout.kind, [KIND_PURPOSE[day.workout.kind]],
        KIND_COLOR[day.workout.kind] ?? 'accent'),
    )
    const refs = [...new Set([...day.workout.ruleRefs, ...sk.ruleRefs])].sort()
    const explained = refs.filter((r) => RULE_EXPLAIN[r]).map((r) => `${r} — ${RULE_EXPLAIN[r]}`)
    if (explained.length) blocks.push(b.section('Reguły'), b.bullets(explained))
    blocks.push(b.blank(), b.hint('źródła i parametry: docs/science/FOUNDATIONS.md §10'))
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
      return ok(`Brak treningów do wypchnięcia w zakresie ${from} → ${to}.`)
    }
    const provider = factory(cwd)
    const res = await provider.pushWorkouts(workouts)
    return okDoc([
      b.success(`Wypchnięto ${res.pushed} treningów do ${provider.name} (${from} → ${to})`),
      b.table(
        ['data', 'trening'],
        workouts.map((w) => [w.date, w.name]),
      ),
      b.blank(),
      b.info('Trafią na zegarek przy najbliższej synchronizacji urządzenia.'),
      b.hint('ponowny push tych samych dni nadpisuje wpisy (upsert po external_id)'),
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
      b.title(`Pobrano z ${provider.name}`, `${from} → ${to}`),
      b.kv([
        ['Aktywności', `${activities.length} (biegowych: ${runs.length}, ${km} km)`],
        ['Wpisy wellness', String(wellness.length)],
        ['Zapisano', SYNC_FILE],
      ]),
    ]
    try {
      const plan = loadPlan(cwd)
      const rows = compare(plan, activities, from, to).filter((r) => r.status !== 'zgodne')
      if (rows.length) {
        blocks.push(
          b.section('Rozjazdy plan ↔ wykonanie'),
          b.table(
            ['data', 'plan', 'wykonano', 'status'],
            rows.slice(-10).map((r) => [
              r.date,
              `${r.plannedKm} km`,
              r.actualKm === undefined ? '—' : `${r.actualKm} km`,
              r.status,
            ]),
            rows.slice(-10).map((r) => (r.status === 'brak wykonania' ? 'warn' : 'muted')),
          ),
          b.blank(),
          b.hint('propozycje korekt: tren adapt'),
        )
      } else {
        blocks.push(b.success('Wykonanie zgodne z planem w całym zakresie.'))
      }
    } catch {
      blocks.push(b.info('Brak planu — pominięto porównanie.'))
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

    const compliance = Math.round(proposal.complianceKm * 100)
    const blocks: Block[] = [
      b.title(`Analiza wykonania · ${proposal.windowDays} dni do ${today}`),
      b.kv([
        ['Zrealizowana objętość', `${compliance}%`],
        ['Pominięte sesje', String(proposal.missedSessions)],
      ]),
    ]
    if (!snapshot) {
      blocks.push(b.info('Brak sync.json — analiza tylko z dziennika. Pełne dane: tren pull'))
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
        b.info(
          `Aby zastosować: athlete.recentWeeklyKm: ${volume.suggestedWeeklyKm} w tren.yaml ` +
            '→ tren diff → tren plan. Silnik nie przepisuje planu sam.',
        ),
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
    const blocks: Block[] = [
      b.title(
        `Dzień przy biurku · ${date}`,
        `praca ${config.desk.workStart}–${config.desk.workEnd}` +
          (opts.heavy === true ? ' · ciężki dzień kognitywny' : ''),
      ),
    ]

    if (workout) {
      blocks.push(
        b.panel(
          `${KIND_LABEL[workout.kind] ?? workout.kind} · ${workout.distanceKm} km`,
          day.recommended
            ? [`Proponowane okno: ${day.recommended.label} (${day.recommended.from}–${day.recommended.to})`]
            : ['Żadne okno dnia pracy nie mieści tej jednostki.'],
          KIND_COLOR[workout.kind] ?? 'accent',
        ),
        b.section('Okna treningowe'),
        b.table(
          ['okno', 'godziny', 'status'],
          day.windows.map((w) => [w.label, `${w.from}–${w.to}`, w.fits ? 'mieści się' : 'za krótkie']),
          day.windows.map((w) => (w.fits ? 'success' : 'muted')),
        ),
      )
    } else {
      blocks.push(b.panel('Dziś bez biegania', ['Przerwy w siedzeniu zostają — to nie jest trening.'], 'muted'))
    }

    blocks.push(
      b.section(`Przerwy w siedzeniu (${day.breaks.length})`),
      b.text(day.breaks.map((x) => `${x.at} ${x.what}`).join('  ·  '), 'muted'),
      b.section('Uwagi'),
    )
    for (const g of day.guidance) {
      blocks.push(opts.heavy === true && g.includes('PO TEMPIE') ? b.warn(g) : b.text(`${g}`))
      blocks.push(b.blank())
    }
    blocks.push(b.hint(`reguły: ${day.ruleRefs.join(', ')} — docs/science/FOUNDATIONS.md §10.10`))
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
    if (!hit) return fail(new Error(`Data ${date} poza zakresem planu.`))
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
        `Renegocjacja tygodnia · od ${week.weekStart}`,
        opts.block?.length ? `zablokowane: ${opts.block.join(', ')}` : 'bez blokad',
      ),
    ]
    if (!result.changed) {
      blocks.push(b.success('Plan tygodnia zostaje bez zmian — nic nie wymaga przestawienia.'))
      for (const w of result.warnings) blocks.push(b.warn(w))
      return okDoc(blocks)
    }

    blocks.push(
      b.table(
        ['dzień', 'data', 'było', 'będzie'],
        week.days.map((before, i) => {
          const after = result.days[i]!
          const label = (k?: string) => (k ? (KIND_LABEL[k] ?? k) : '—')
          return [
            WEEKDAY_SHORT[before.weekday],
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
      b.section('Co się zmienia'),
      b.bullets(result.tradeoffs),
    )
    for (const w of result.warnings) blocks.push(b.warn(w))

    if (opts.apply === true) {
      week.days = result.days
      plan.changes.push({
        at: localToday(),
        action: 'reschedule',
        detail: `${week.weekStart}: ${result.tradeoffs.join('; ')}`,
      })
      writePlan(cwd, plan)
      blocks.push(b.blank(), b.success(`Zastosowano — zapisano ${PLAN_YAML} i ${PLAN_MD}`))
    } else {
      blocks.push(b.blank(), b.hint('to podgląd; zastosuj: tren reschedule --apply (z tymi samymi --block)'))
    }
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
      lines.push('plan zawiera ręczne przesunięcia — pokażą się jako różnice')
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
    if (lines.length === 0) {
      return okDoc([b.success('Plan aktualny — brak różnic względem regeneracji z tren.yaml.')])
    }
    return okDoc([
      b.title('Różnice: plan zapisany → plan z aktualnego tren.yaml'),
      b.bullets(lines),
      b.blank(),
      b.hint('zastosowanie: tren plan (nadpisze plan/ — masz go w gicie)'),
    ])
  } catch (e) {
    return fail(e)
  }
}

export function daysToRace(plan: { goal: { date: string } }, today: string): number {
  return diffDays(today, plan.goal.date)
}
