/**
 * Eksport planu: plik na zegarek (FIT), kalendarz (ICS), rozpiska do wydruku (HTML).
 * Handler jest czysty i nieinteraktywny — pytania zadaje warstwa CLI (bin.ts),
 * żeby to samo działało z MCP i ze skryptu.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { PlannedDay, Weekday } from '@tren/core'
import { encodeWorkoutFit, toIcs, toPrintableHtml, type PrintWeek } from '@tren/export'
import { findDay, loadPlan, workoutText, type StoredPlan } from './planfile.ts'

export const EXPORT_DIR = 'export'

const WEEKDAY_SHORT: Record<Weekday, string> = {
  mon: 'PN', tue: 'WT', wed: 'ŚR', thu: 'CZ', fri: 'PT', sat: 'SB', sun: 'ND',
}

const KIND_LABEL: Record<string, string> = {
  easy: 'Spokojne',
  long: 'Długie wybieganie',
  easy_hills: 'Podbiegi',
  quality_intervals: 'Interwały',
  quality_continuous: 'Akcent ciągły',
  sharpener: 'Rozruch',
  race: 'START',
}

const PHASE_LABEL: Record<string, string> = {
  base: 'baza', build: 'budowanie', peak: 'szczyt', taper: 'taper', race: 'tydzień startowy',
}

export type ExportWhat = 'plan' | 'workout' | 'print' | 'calendar'
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
  const label = KIND_LABEL[day.workout.kind] ?? day.workout.kind
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
  const plan = loadPlan(cwd)
  const dir = req.outDir ?? join(cwd, EXPORT_DIR)
  mkdirSync(dir, { recursive: true })
  const files: ExportedFile[] = []

  if (req.what === 'workout') {
    if (!req.date) throw new Error('Podaj datę treningu (--date).')
    const hit = findDay(plan, req.date)
    if (!hit) throw new Error(`Data ${req.date} poza zakresem planu.`)
    const file = fitFor(plan, hit.day, dir)
    if (!file) {
      throw new Error(
        hit.day.workout
          ? 'To dzień startu — nie eksportujemy go jako treningu.'
          : `${req.date} to dzień wolny — nie ma czego eksportować.`,
      )
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
    if (files.length === 0) throw new Error('Plan nie zawiera treningów do eksportu.')
    return files
  }

  if (req.what === 'calendar') {
    const entries = plan.weeks
      .flatMap((w) => w.days)
      .filter((d) => d.workout)
      .map((day) => ({
        day,
        summary: `${KIND_LABEL[day.workout!.kind] ?? day.workout!.kind}${
          day.workout!.distanceKm ? ` ${day.workout!.distanceKm} km` : ''
        }`,
        description: workoutText(day),
      }))
    const ics = toIcs(entries, {
      planName: `${plan.goal.name} (tren)`,
      uidPrefix: `tren-${safeName(plan.goal.name)}`,
      stamp: `${plan.generatedAt.replace(/-/g, '')}T000000Z`,
    })
    const file = join(dir, `${safeName(plan.goal.name)}.ics`)
    writeFileSync(file, ics, 'utf-8')
    files.push({
      path: file,
      bytes: Buffer.byteLength(ics),
      description: `${entries.length} treningów w kalendarzu`,
    })
    return files
  }

  // rozpiska do wydruku
  const weeks: PrintWeek[] = plan.weeks.map((w) => ({
    index: w.skeleton.index,
    weekStart: w.weekStart,
    phase: PHASE_LABEL[w.skeleton.phase] ?? w.skeleton.phase,
    targetKm: w.skeleton.targetKm,
    totalKm: w.totalKm,
    deload: w.skeleton.deload,
    days: w.days.map((d) => ({
      weekday: WEEKDAY_SHORT[d.weekday],
      date: d.date.slice(5).replace('-', '.'),
      km: d.workout?.distanceKm ? `${d.workout.distanceKm} km` : '',
      text: d.workout ? workoutText(d) : '—',
    })),
  }))
  const html = toPrintableHtml({
    title: `${plan.goal.name} — ${plan.goal.date}`,
    subtitle:
      `Plan ${plan.weeks.length}-tygodniowy · szczyt ${plan.peakKmPlanned} km/tydz. · ` +
      `VDOT ${plan.vdot} · wygenerowano ${plan.generatedAt}`,
    weeks,
    footer: 'Wygenerowane przez tren. Uzasadnienia jednostek: tren why --date <data>.',
  })
  const file = join(dir, `${safeName(plan.goal.name)}-rozpiska.html`)
  writeFileSync(file, html, 'utf-8')
  files.push({
    path: file,
    bytes: Buffer.byteLength(html),
    description: `rozpiska ${plan.weeks.length} tygodni do wydruku`,
  })
  return files
}
