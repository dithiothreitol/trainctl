/**
 * Tryby interaktywne: wybór dni przy `shift` i przeglądarka tygodni.
 * Logika czysta (budowanie list, nawigacja) siedzi w ui/keys.ts i tutaj
 * w funkcjach `*Choices` — pętla wejścia jest cienka i wymaga TTY.
 */
import { emitKeypressEvents } from 'node:readline'
import type { Microcycle, PlannedDay, Weekday } from '@tren/core'
import { cmdShift, cmdWeek } from './commands.ts'
import { loadPlan, workoutText, type StoredPlan } from './planfile.ts'
import { renderAnsi } from './ui/blocks.ts'
import { clampIndex, keyAction, type KeyEvent } from './ui/keys.ts'
import { canPrompt, select, type Choice } from './ui/select.ts'
import { Theme } from './ui/theme.ts'

const WEEKDAY_SHORT: Record<Weekday, string> = {
  mon: 'PN', tue: 'WT', wed: 'ŚR', thu: 'CZ', fri: 'PT', sat: 'SB', sun: 'ND',
}

/** Pozycje listy dla dni tygodnia; dzień startu jest zablokowany (nie ruszamy go). */
export function dayChoices(week: Microcycle, exclude?: string): Choice<string>[] {
  return week.days
    .filter((d) => d.date !== exclude)
    .map((day: PlannedDay) => {
      const isRace = day.workout?.kind === 'race'
      const label = `${WEEKDAY_SHORT[day.weekday]} ${day.date.slice(5)}`
      const what = day.workout ? `${day.workout.distanceKm} km · ${workoutText(day)}` : 'wolne'
      return {
        label,
        value: day.date,
        hint: isRace ? 'START — nie do przesunięcia' : truncate(what, 60),
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

/** `tren shift` bez argumentów: wybierz trening → wybierz nowy dzień. */
export async function runShiftPicker(
  cwd: string,
  today: string,
  theme = new Theme(),
): Promise<InteractiveResult> {
  if (!canPrompt()) {
    return {
      code: 1,
      output:
        'Tryb interaktywny wymaga terminala. Podaj daty wprost:\n' +
        '  tren shift --from 2026-08-04 --to 2026-08-05',
    }
  }
  let plan: StoredPlan
  try {
    plan = loadPlan(cwd)
  } catch (e) {
    return { code: 1, output: e instanceof Error ? e.message : String(e) }
  }
  const week = plan.weeks[weekOf(plan, today)]
  if (!week) return { code: 1, output: 'Nie znalazłem tygodnia dla dzisiejszej daty.' }

  console.log(renderAnsi(cmdWeek(cwd, { date: week.weekStart }).blocks ?? [], theme))
  console.log()

  const from = await select('Który trening przesunąć?', dayChoices(week), theme)
  if (!from) return { code: 0, output: theme.dim('anulowano') }

  const to = await select('Na który dzień?', dayChoices(week, from), theme)
  if (!to) return { code: 0, output: theme.dim('anulowano') }

  const result = cmdShift(cwd, { from, to })
  return {
    code: result.code,
    output:
      (result.blocks ? renderAnsi(result.blocks, theme) : result.output) +
      '\n\n' +
      renderAnsi(cmdWeek(cwd, { date: week.weekStart }).blocks ?? [], theme),
  }
}

/** `tren export` bez argumentów: pyta, co wyeksportować (i który trening). */
export async function runExportPicker(
  cwd: string,
  today: string,
  theme = new Theme(),
): Promise<{ what: string; date?: string } | undefined> {
  const what = await select<string>(
    'Co wyeksportować?',
    [
      { label: 'Rozpiska do wydruku', value: 'print', hint: 'HTML pod A4 — Ctrl+P' },
      { label: 'Pakiet startowy', value: 'race', hint: 'splity + opaska tempa do wycięcia' },
      { label: 'Cały plan na zegarek', value: 'plan', hint: 'pliki .fit dla każdego treningu' },
      { label: 'Jeden trening na zegarek', value: 'workout', hint: 'pojedynczy .fit' },
      { label: 'Kalendarz', value: 'calendar', hint: '.ics do Google/Outlooka' },
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
  const choices = dayChoices(week).filter((c) => c.hint !== 'wolne')
  const date = await select('Który trening?', choices, theme)
  return date ? { what, date } : undefined
}

/** `tren week -i`: przeglądanie tygodni strzałkami, `s` przesuwa trening. */
export async function runWeekBrowser(
  cwd: string,
  today: string,
  theme = new Theme(),
): Promise<InteractiveResult> {
  if (!canPrompt()) return { code: 1, output: 'Tryb interaktywny wymaga terminala (użyj: tren week).' }
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
    theme.dim(
      `  ←/→ tydzień · t dziś · s przesuń trening · q wyjście` +
        `   [${index + 1}/${plan.weeks.length}]`,
    )

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
          const from = await select('Który trening przesunąć?', dayChoices(week), theme)
          const to = from
            ? await select('Na który dzień?', dayChoices(week, from), theme)
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
          finish(theme.dim('zamknięto podgląd'))
          break
      }
    }
    stdin.on('keypress', onKey)
  })
}
