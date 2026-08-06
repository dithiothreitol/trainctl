/**
 * Eksport planu: plik na zegarek (FIT), kalendarz (ICS), rozpiska do wydruku (HTML).
 * Handler jest czysty i nieinteraktywny — pytania zadaje warstwa CLI (bin.ts),
 * żeby to samo działało z MCP i ze skryptu.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { getLocale, heatLadder, messages, type PlannedDay } from '@trainctl/core'
import {
  encodeWorkoutFit,
  fmtClock,
  fmtPace,
  toIcs,
  toPrintableHtml,
  toRacePackHtml,
  type PrintWeek,
  type RacePackInput,
  type RaceScenario,
} from '@trainctl/export'
import { ui } from './i18n/index.ts'
import { findDay, loadPlan, workoutText, type StoredPlan } from './planfile.ts'

/**
 * Tabela korekty na temperaturę (H-1…H-5). Model milczy powyżej 25 °C i poniżej
 * optimum — wtedy wierszy po prostu nie ma, zamiast zmyślonych liczb.
 */
function heatTableFor(
  distanceKm: number,
  totalSec: number,
  scenarioLabel: string,
): RacePackInput['heatTable'] | undefined {
  const ladder = heatLadder(distanceKm, totalSec).filter((a) => a.timePenaltyPct > 0.05)
  if (ladder.length === 0) return undefined
  const first = ladder[0]!
  const t = ui().exportCmd.heat
  return {
    // etykieta mówi wprost, KTÓRY scenariusz korygujemy — tabela dotyczy tylko opaski
    header: [
      t.columns.temperature,
      t.scenarioColumn(scenarioLabel),
      t.columns.pace,
      t.columns.loss,
    ],
    rows: ladder.map((a) => [
      `${a.tempC} °C`,
      fmtClock(a.adjustedSec),
      fmtPace(a.adjustedPaceSecPerKm),
      t.lossValue(a.paceDeltaSecPerKm),
    ]),
    note: t.note(scenarioLabel, first.curveLabel, first.tOptC),
  }
}

export const EXPORT_DIR = 'export'

/** Etykieta jednostki na plik/kalendarz — z katalogu domenowego, wielką literą. */
const kindLabel = (kind: string): string => {
  const label = (messages().kind as Record<string, string>)[kind] ?? kind
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export type ExportWhat = 'plan' | 'workout' | 'print' | 'calendar' | 'race'
export type ExportFormat = 'fit' | 'ics' | 'html'

export interface ExportRequest {
  what: ExportWhat
  date?: string | undefined
  outDir?: string | undefined
}

export interface ExportedFile {
  path: string
  bytes: number
  description: string
}

const safeName = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 40)

function fitFor(plan: StoredPlan, day: PlannedDay, dir: string): ExportedFile | undefined {
  if (!day.workout || day.workout.kind === 'race') return undefined
  const label = kindLabel(day.workout.kind)
  const name = `${day.date} ${label}`
  const bytes = encodeWorkoutFit(day.workout, name, {
    createdAtSec: Math.floor(Date.parse(`${day.date}T06:00:00Z`) / 1000),
  })
  const file = join(dir, `${day.date}-${safeName(label)}.fit`)
  writeFileSync(file, bytes)
  return {
    path: file,
    bytes: bytes.length,
    description: `${name} · ${day.workout.distanceKm} km`,
  }
}

export function runExport(cwd: string, req: ExportRequest): ExportedFile[] {
  const t = ui().exportCmd
  const plan = loadPlan(cwd)
  const dir = req.outDir ?? join(cwd, EXPORT_DIR)
  mkdirSync(dir, { recursive: true })
  const files: ExportedFile[] = []

  if (req.what === 'workout') {
    if (!req.date) throw new Error(t.needDate)
    const hit = findDay(plan, req.date)
    if (!hit) throw new Error(ui().log.outsidePlan(req.date))
    const file = fitFor(plan, hit.day, dir)
    if (!file) {
      throw new Error(hit.day.workout ? t.raceDayNotWorkout : t.restDayNothing(req.date))
    }
    files.push(file)
    return files
  }

  if (req.what === 'plan') {
    for (const week of plan.weeks) {
      for (const day of week.days) {
        const file = fitFor(plan, day, dir)
        if (file) files.push(file)
      }
    }
    if (files.length === 0) throw new Error(t.noWorkouts)
    return files
  }

  if (req.what === 'calendar') {
    // Siła też trafia do kalendarza — inaczej dni siłowe wypadające na dniach
    // wolnych od biegania nie miałyby ŻADNEGO wpisu, mimo że są w planie.
    const entries = plan.weeks
      .flatMap((w) => w.days)
      .filter((d) => d.workout || d.strength)
      .map((day) => {
        const runLabel = day.workout
          ? `${kindLabel(day.workout.kind)}${
              day.workout.distanceKm ? ` ${day.workout.distanceKm} km` : ''
            }`
          : undefined
        const strengthLabel = day.strength
          ? ui().calendar.strengthSummary(day.strength.durationMin)
          : undefined
        return {
          day,
          summary: [runLabel, strengthLabel].filter(Boolean).join(' + '),
          description: [
            day.workout ? workoutText(day) : undefined,
            day.strength?.description,
          ]
            .filter(Boolean)
            .join('\n\n'),
        }
      })
    const ics = toIcs(entries, {
      planName: `${plan.goal.name} (trainctl)`,
      uidPrefix: `trainctl-${safeName(plan.goal.name)}`,
      stamp: `${plan.generatedAt.replace(/-/g, '')}T000000Z`,
    })
    const file = join(dir, `${safeName(plan.goal.name)}.ics`)
    writeFileSync(file, ics, 'utf-8')
    files.push({
      path: file,
      bytes: Buffer.byteLength(ics),
      description: t.calendarEntries(entries.length),
    })
    return files
  }

  if (req.what === 'race') {
    // `key` jest stabilny między językami — po nim wybieramy scenariusz na opaskę;
    // `label` idzie na wydruk i zmienia się z językiem.
    const scenarios: (RaceScenario & { key: string })[] = []
    if (plan.goal.targetTimeSec) {
      scenarios.push({ key: 'goal', label: t.scenarioGoal, totalSec: plan.goal.targetTimeSec })
    }
    if (plan.prediction) {
      scenarios.push(
        { key: 'bold', label: t.scenarioBold, totalSec: plan.prediction.loSec },
        { key: 'safe', label: t.scenarioSafe, totalSec: plan.prediction.hiSec },
      )
    }
    if (scenarios.length === 0) {
      throw new Error(t.needTargetOrPrediction)
    }
    scenarios.sort((a, b) => a.totalSec - b.totalSec)
    // Na opaskę: cel, jeśli jest; bez celu — wariant ostrożny. Pęknięcie w drugiej
    // połowie kosztuje więcej, niż zbyt zachowawcze otwarcie (W-1: przedział, nie punkt).
    const bandScenario = plan.goal.targetTimeSec
      ? scenarios.findIndex((s) => s.key === 'goal')
      : scenarios.length - 1
    const provenance = plan.prediction
      ? t.provenanceWithPrediction(plan.prediction.method, plan.generatedAt)
      : t.provenanceGoalOnly(plan.generatedAt)
    const bandLabel = scenarios[bandScenario]!.label
    const heatTable = heatTableFor(plan.goal.distanceKm, scenarios[bandScenario]!.totalSec, bandLabel)
    const rp = ui().racePack
    const html = toRacePackHtml({
      raceName: plan.goal.name,
      raceDate: plan.goal.date,
      distanceKm: plan.goal.distanceKm,
      scenarios,
      bandScenario,
      provenance,
      ...(heatTable ? { heatTable } : {}),
      labels: { lang: getLocale(), ...rp },
    })
    const file = join(dir, `${safeName(plan.goal.name)}-${safeName(t.fileRacePack)}.html`)
    writeFileSync(file, html, 'utf-8')
    files.push({
      path: file,
      bytes: Buffer.byteLength(html),
      description: t.splitsAndBand(scenarios.map((s) => s.label).join('/')),
    })
    return files
  }

  // rozpiska do wydruku
  const core = messages()
  const p = ui().print
  const weeks: PrintWeek[] = plan.weeks.map((w) => ({
    index: w.skeleton.index,
    weekStart: w.weekStart,
    phase: core.phase[w.skeleton.phase] ?? w.skeleton.phase,
    targetKm: w.skeleton.targetKm,
    totalKm: w.totalKm,
    deload: w.skeleton.deload,
    days: w.days.map((d) => ({
      weekday: core.weekdayShort[d.weekday],
      date: d.date.slice(5).replace('-', '.'),
      km: d.workout?.distanceKm ? `${d.workout.distanceKm} km` : '',
      rest: !d.workout,
      text:
        (d.workout ? workoutText(d) : p.rest) +
        (d.strength ? ` ${p.strengthTag(d.strength.durationMin)}` : ''),
    })),
  }))
  const html = toPrintableHtml({
    title: `${plan.goal.name} — ${plan.goal.date}`,
    subtitle: p.subtitle(plan.weeks.length, plan.peakKmPlanned, plan.vdot, plan.generatedAt),
    weeks,
    footer: p.footer,
    labels: { lang: getLocale(), ...p },
  })
  const file = join(dir, `${safeName(plan.goal.name)}-${safeName(t.filePrintout)}.html`)
  writeFileSync(file, html, 'utf-8')
  files.push({
    path: file,
    bytes: Buffer.byteLength(html),
    description: t.printedWeeks(plan.weeks.length),
  })
  return files
}
