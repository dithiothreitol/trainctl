/**
 * Tryby interaktywne: wybór dni przy `shift` i przeglądarka tygodni.
 * Logika czysta (budowanie list, nawigacja) siedzi w ui/keys.ts i tutaj
 * w funkcjach `*Choices` — pętla wejścia jest cienka i wymaga TTY.
 */
import { emitKeypressEvents } from 'node:readline'
import { messages, type Microcycle, type PlannedDay } from 'trainctl-core'
import { cmdShift, cmdWeek } from './commands.ts'
import { ui } from './i18n/index.ts'
import { loadPlan, workoutText, type StoredPlan } from './planfile.ts'
import { renderAnsi } from './ui/blocks.ts'
import { clampIndex, keyAction, type KeyEvent } from './ui/keys.ts'
import { canPrompt, select, type Choice } from './ui/select.ts'
import { Theme } from './ui/theme.ts'

/** Pozycje listy dla dni tygodnia; dzień startu jest zablokowany (nie ruszamy go). */
export function dayChoices(week: Microcycle, exclude?: string): Choice<string>[] {
  return week.days
    .filter((d) => d.date !== exclude)
    .map((day: PlannedDay) => {
      const isRace = day.workout?.kind === 'race'
      const label = `${messages().weekdayShort[day.weekday]} ${day.date.slice(5)}`
      const what = day.workout
        ? `${day.workout.distanceKm} km · ${workoutText(day)}`
        : ui().week.rest
      return {
        label,
        value: day.date,
        hint: isRace ? ui().picker.raceLocked : truncate(what, 60),
        ...(isRace ? { disabled: true } : {}),
      }
    })
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`
}

function weekOf(plan: StoredPlan, date: string): number {
  const index = plan.weeks.findIndex((w) => w.days.some((d) => d.date === date))
  return index === -1 ? 0 : index
}

export interface InteractiveResult {
  output: string
  code: number
}

/** `trainctl shift` bez argumentów: wybierz trening → wybierz nowy dzień. */
export async function runShiftPicker(
  cwd: string,
  today: string,
  theme = new Theme(),
): Promise<InteractiveResult> {
  if (!canPrompt()) {
    return { code: 1, output: ui().picker.shiftNeedsTerminal }
  }
  let plan: StoredPlan
  try {
    plan = loadPlan(cwd)
  } catch (e) {
    return { code: 1, output: e instanceof Error ? e.message : String(e) }
  }
  const week = plan.weeks[weekOf(plan, today)]
  if (!week) return { code: 1, output: ui().picker.noWeekForToday }

  console.log(renderAnsi(cmdWeek(cwd, { date: week.weekStart }).blocks ?? [], theme))
  console.log()

  const from = await select(ui().picker.whatToMove, dayChoices(week), theme)
  if (!from) return { code: 0, output: theme.dim(ui().common.cancelled) }

  const to = await select(ui().picker.whichDay, dayChoices(week, from), theme)
  if (!to) return { code: 0, output: theme.dim(ui().common.cancelled) }

  const result = cmdShift(cwd, { from, to })
  return {
    code: result.code,
    output:
      (result.blocks ? renderAnsi(result.blocks, theme) : result.output) +
      '\n\n' +
      renderAnsi(cmdWeek(cwd, { date: week.weekStart }).blocks ?? [], theme),
  }
}

/** `trainctl export` bez argumentów: pyta, co wyeksportować (i który trening). */
export async function runExportPicker(
  cwd: string,
  today: string,
  theme = new Theme(),
): Promise<{ what: string; date?: string } | undefined> {
  const p = ui().picker
  const what = await select<string>(
    p.exportWhat,
    [
      { label: p.exportPrint, value: 'print', hint: p.exportPrintHint },
      { label: p.exportRace, value: 'race', hint: p.exportRaceHint },
      { label: p.exportPlan, value: 'plan', hint: p.exportPlanHint },
      { label: p.exportWorkout, value: 'workout', hint: p.exportWorkoutHint },
      { label: p.exportCalendar, value: 'calendar', hint: p.exportCalendarHint },
    ],
    theme,
  )
  if (!what) return undefined
  if (what !== 'workout') return { what }

  let plan: StoredPlan
  try {
    plan = loadPlan(cwd)
  } catch {
    return { what }
  }
  const week = plan.weeks[weekOf(plan, today)]
  if (!week) return { what }
  // filtrujemy po PLANIE, nie po treści podpowiedzi — porównanie z napisem
  // „wolne" działało tylko po polsku
  const withWorkout = new Set(week.days.filter((d) => d.workout).map((d) => d.date))
  const choices = dayChoices(week).filter((c) => withWorkout.has(c.value))
  const date = await select(p.whichWorkout, choices, theme)
  return date ? { what, date } : undefined
}

/** `trainctl week -i`: przeglądanie tygodni strzałkami, `s` przesuwa trening. */
export async function runWeekBrowser(
  cwd: string,
  today: string,
  theme = new Theme(),
): Promise<InteractiveResult> {
  if (!canPrompt()) return { code: 1, output: ui().common.needsTerminal('trainctl week') }
  let plan: StoredPlan
  try {
    plan = loadPlan(cwd)
  } catch (e) {
    return { code: 1, output: e instanceof Error ? e.message : String(e) }
  }

  const startIndex = weekOf(plan, today)
  let index = startIndex
  const stdin = process.stdin
  const stdout = process.stdout
  emitKeypressEvents(stdin)
  const wasRaw = stdin.isRaw === true
  if (stdin.isTTY) stdin.setRawMode(true)
  stdin.resume()

  const footer = () =>
    theme.dim(`  ${ui().picker.weekKeys}   [${index + 1}/${plan.weeks.length}]`)

  const draw = () => {
    stdout.write('[2J[H') // czyść ekran i wróć na górę
    const week = plan.weeks[index]!
    console.log(renderAnsi(cmdWeek(cwd, { date: week.weekStart }).blocks ?? [], theme))
    console.log()
    console.log(footer())
  }
  draw()

  return new Promise<InteractiveResult>((resolve) => {
    const finish = (output: string) => {
      stdin.off('keypress', onKey)
      if (stdin.isTTY) stdin.setRawMode(wasRaw)
      stdin.pause()
      stdout.write('[2J[H')
      resolve({ code: 0, output })
    }

    const onKey = async (_s: string, key: KeyEvent) => {
      switch (keyAction(key)) {
        case 'prev':
        case 'up':
          index = clampIndex(index - 1, plan.weeks.length)
          draw()
          break
        case 'next':
        case 'down':
          index = clampIndex(index + 1, plan.weeks.length)
          draw()
          break
        case 'today':
          index = startIndex
          draw()
          break
        case 'shift': {
          stdin.off('keypress', onKey)
          if (stdin.isTTY) stdin.setRawMode(wasRaw)
          const week = plan.weeks[index]!
          stdout.write('[2J[H')
          const from = await select(ui().picker.whatToMove, dayChoices(week), theme)
          const to = from
            ? await select(ui().picker.whichDay, dayChoices(week, from), theme)
            : undefined
          if (from && to) {
            const res = cmdShift(cwd, { from, to })
            plan = loadPlan(cwd)
            if (res.code !== 0) {
              console.log(renderAnsi(res.blocks ?? [], theme))
              await new Promise((r) => setTimeout(r, 1500))
            }
          }
          if (stdin.isTTY) stdin.setRawMode(true)
          stdin.on('keypress', onKey)
          draw()
          break
        }
        case 'cancel':
          finish(theme.dim(ui().picker.previewClosed))
          break
      }
    }
    stdin.on('keypress', onKey)
  })
}
