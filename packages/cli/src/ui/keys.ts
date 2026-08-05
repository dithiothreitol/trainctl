/**
 * Czysta warstwa nawigacji klawiaturą: mapowanie klawiszy na akcje i ruch po
 * liście. Bez I/O — dzięki temu testujemy zachowanie interfejsu bez TTY.
 */

export type Action =
  | 'up'
  | 'down'
  | 'prev'
  | 'next'
  | 'select'
  | 'cancel'
  | 'today'
  | 'shift'
  | 'help'

export interface KeyEvent {
  name?: string | undefined
  sequence?: string | undefined
  ctrl?: boolean | undefined
}

/** Klawisze → akcja. Strzałki, vim (hjkl) i litery mnemoniczne. */
export function keyAction(key: KeyEvent): Action | undefined {
  if (key.ctrl && (key.name === 'c' || key.name === 'd')) return 'cancel'
  switch (key.name) {
    case 'up':
    case 'k':
      return 'up'
    case 'down':
    case 'j':
      return 'down'
    case 'left':
    case 'h':
      return 'prev'
    case 'right':
    case 'l':
      return 'next'
    case 'return':
    case 'space':
      return 'select'
    case 'escape':
    case 'q':
      return 'cancel'
    case 't':
      return 'today'
    case 's':
      return 'shift'
    case '?':
      return 'help'
    default:
      return key.sequence === '?' ? 'help' : undefined
  }
}

/** Ruch po liście z pomijaniem pozycji niedostępnych; zawija się na końcach. */
export function moveIndex(
  current: number,
  delta: number,
  length: number,
  isDisabled: (index: number) => boolean = () => false,
): number {
  if (length === 0) return 0
  let index = current
  for (let step = 0; step < length; step++) {
    index = (index + delta + length) % length
    if (!isDisabled(index)) return index
  }
  return current
}

/** Ograniczenie indeksu do zakresu (przeglądarka tygodni nie zawija się). */
export function clampIndex(value: number, length: number): number {
  if (length <= 0) return 0
  return Math.min(Math.max(value, 0), length - 1)
}

/** Cyfra 1–9 jako szybki wybór pozycji z listy. */
export function digitIndex(key: KeyEvent, length: number): number | undefined {
  const digit = Number(key.sequence)
  if (!Number.isInteger(digit) || digit < 1 || digit > 9) return undefined
  const index = digit - 1
  return index < length ? index : undefined
}
