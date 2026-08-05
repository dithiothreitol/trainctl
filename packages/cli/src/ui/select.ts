/**
 * Interaktywna lista wyboru: strzałki / hjkl, cyfry 1–9, Enter, Esc.
 * Rysuje w miejscu (bez przewijania historii), sprząta po sobie.
 * Wymaga TTY — wywołujący sprawdza `canPrompt()` i podaje ścieżkę nieinteraktywną.
 */
import { emitKeypressEvents } from 'node:readline'
import { Theme } from './theme.ts'
import { digitIndex, keyAction, moveIndex, type KeyEvent } from './keys.ts'

export interface Choice<T> {
  label: string
  value: T
  hint?: string
  disabled?: boolean
}

export function canPrompt(stdin: NodeJS.ReadStream = process.stdin): boolean {
  return Boolean(stdin.isTTY)
}

/** Linie listy — wydzielone, żeby dało się je sprawdzić w teście bez TTY. */
export function renderChoices<T>(
  choices: Choice<T>[],
  active: number,
  theme: Theme,
): string[] {
  const s = theme.sym
  return choices.map((choice, i) => {
    const number = theme.dim(`${i + 1}`.padStart(2))
    const label = choice.disabled ? theme.dim(choice.label) : choice.label
    const hint = choice.hint ? theme.dim(`  ${choice.hint}`) : ''
    if (i === active) {
      return `${number} ${theme.color(s.arrow, 'brand')} ${theme.bold(label)}${hint}`
    }
    return `${number}   ${label}${hint}`
  })
}

export async function select<T>(
  title: string,
  choices: Choice<T>[],
  theme = new Theme(),
  stdin: NodeJS.ReadStream = process.stdin,
  stdout: NodeJS.WriteStream = process.stdout,
): Promise<T | undefined> {
  const usable = choices.filter((c) => !c.disabled)
  if (usable.length === 0) return undefined

  let active = choices.findIndex((c) => !c.disabled)
  const footer = theme.dim('  ↑↓ wybór · 1–9 skok · Enter zatwierdź · Esc anuluj')

  emitKeypressEvents(stdin)
  const wasRaw = stdin.isRaw === true
  if (stdin.isTTY) stdin.setRawMode(true)
  stdin.resume()
  stdout.write(theme.bold(`${title}\n`))

  let printed = 0
  const draw = () => {
    if (printed > 0) stdout.write(`[${printed}A`)
    const lines = [...renderChoices(choices, active, theme), footer]
    stdout.write(lines.map((l) => `[2K${l}`).join('\n') + '\n')
    printed = lines.length
  }
  draw()

  return new Promise<T | undefined>((resolve) => {
    const finish = (value: T | undefined) => {
      stdin.off('keypress', onKey)
      if (stdin.isTTY) stdin.setRawMode(wasRaw)
      stdin.pause()
      stdout.write(`[${printed}A`)
      for (let i = 0; i < printed; i++) stdout.write('[2K\n')
      stdout.write(`[${printed}A`)
      resolve(value)
    }

    const onKey = (_str: string, key: KeyEvent) => {
      const quick = digitIndex(key, choices.length)
      if (quick !== undefined && !choices[quick]?.disabled) {
        active = quick
        draw()
        finish(choices[quick]!.value)
        return
      }
      switch (keyAction(key)) {
        case 'up':
          active = moveIndex(active, -1, choices.length, (i) => choices[i]?.disabled === true)
          draw()
          break
        case 'down':
          active = moveIndex(active, 1, choices.length, (i) => choices[i]?.disabled === true)
          draw()
          break
        case 'select':
          finish(choices[active]?.value)
          break
        case 'cancel':
          finish(undefined)
          break
      }
    }
    stdin.on('keypress', onKey)
  })
}
