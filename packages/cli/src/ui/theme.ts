/**
 * Motyw terminala: kolory, symbole, szerokość. Zero zależności —
 * własne ANSI zamiast chalk/ink, żeby CLI dalej działało pod natywnym
 * type-strippingiem Node i bez kroku budowania.
 *
 * Wykrywanie możliwości terminala (kolejność ma znaczenie):
 *  NO_COLOR / TRAINCTL_NO_COLOR   → wyłącz kolory (standard no-color.org)
 *  FORCE_COLOR                → wymuś (CI, pipe do less -R)
 *  !isTTY                     → wyłącz (przekierowanie do pliku, |, agent)
 */

export interface Capabilities {
  color: boolean
  unicode: boolean
  width: number
}

export function detectCapabilities(
  stream: { isTTY?: boolean; columns?: number } = process.stdout,
  env: NodeJS.ProcessEnv = process.env,
): Capabilities {
  const forced = env['FORCE_COLOR']
  const disabled = env['NO_COLOR'] !== undefined || env['TRAINCTL_NO_COLOR'] !== undefined
  const color = disabled ? false : forced ? forced !== '0' : Boolean(stream.isTTY)
  const unicode =
    env['TRAINCTL_ASCII'] === undefined &&
    (process.platform !== 'win32' || Boolean(env['WT_SESSION'] || env['TERM_PROGRAM'] || env['TERM']))
  return {
    color,
    unicode,
    width: Math.max(40, Math.min(stream.columns ?? 80, 110)),
  }
}

const CODES = {
  reset: 0,
  bold: 1,
  dim: 2,
  italic: 3,
  underline: 4,
} as const

/** Kolory 256 — czytelne i na jasnym, i na ciemnym tle. */
const FG = {
  brand: 39, // cyan
  accent: 75, // niebieski
  quality: 170, // fiolet — akcenty treningowe
  long: 33, // granat — długie wybieganie
  easy: 78, // zieleń — spokojne
  race: 214, // pomarańcz — start
  warn: 179,
  error: 203,
  success: 71,
  muted: 245,
} as const

export type ColorName = keyof typeof FG

export class Theme {
  readonly caps: Capabilities

  constructor(caps: Capabilities = detectCapabilities()) {
    this.caps = caps
  }

  private wrap(text: string, open: string, close = '[0m'): string {
    return this.caps.color ? `${open}${text}${close}` : text
  }

  color(text: string, name: ColorName): string {
    return this.wrap(text, `[38;5;${FG[name]}m`)
  }

  bold(text: string): string {
    return this.wrap(text, `[${CODES.bold}m`)
  }

  dim(text: string): string {
    return this.wrap(text, `[${CODES.dim}m`)
  }

  underline(text: string): string {
    return this.wrap(text, `[${CODES.underline}m`)
  }

  /** Tło dla plakietek (badge). */
  badge(text: string, name: ColorName): string {
    return this.wrap(` ${text} `, `[48;5;${FG[name]}m[38;5;255m[1m`)
  }

  get sym() {
    const u = this.caps.unicode
    return {
      ok: u ? '✓' : 'OK',
      fail: u ? '✗' : 'X',
      warn: u ? '⚠' : '!',
      bullet: u ? '•' : '-',
      arrow: u ? '→' : '->',
      swap: u ? '↔' : '<->',
      topLeft: u ? '╭' : '+',
      topRight: u ? '╮' : '+',
      bottomLeft: u ? '╰' : '+',
      bottomRight: u ? '╯' : '+',
      horizontal: u ? '─' : '-',
      vertical: u ? '│' : '|',
      teeLeft: u ? '├' : '+',
      teeRight: u ? '┤' : '+',
      dot: u ? '·' : '.',
      rest: u ? '—' : '--',
    }
  }
}

const SPARK_UNICODE = '▁▂▃▄▅▆▇█'
const SPARK_ASCII = '_.-:=+*#'

/** Mini-wykres słupkowy w jednej linii (kreator: tygodniowa objętość z historii). */
export function sparkline(values: number[], unicode = true): string {
  if (values.length === 0) return ''
  const bars = unicode ? SPARK_UNICODE : SPARK_ASCII
  const max = Math.max(...values)
  if (max <= 0) return bars[0]!.repeat(values.length)
  return values
    .map((v) => bars[Math.min(bars.length - 1, Math.round((v / max) * (bars.length - 1)))]!)
    .join('')
}

/** Długość widoczna — bez sekwencji ANSI (do wyrównywania kolumn). */
export function visibleLength(text: string): number {
  return stripAnsi(text).length
}

export function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\[[0-9;]*m/g, '')
}

export function padVisible(text: string, width: number): string {
  const pad = width - visibleLength(text)
  return pad > 0 ? text + ' '.repeat(pad) : text
}
