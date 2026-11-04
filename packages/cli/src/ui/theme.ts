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

export type ColorMode = 'auto' | 'always' | 'never'

export function detectCapabilities(
  stream: { isTTY?: boolean; columns?: number } = process.stdout,
  env: NodeJS.ProcessEnv = process.env,
  mode: ColorMode = 'auto',
): Capabilities {
  const forced = env['FORCE_COLOR']
  const disabled = Boolean(env['NO_COLOR'] || env['TRAINCTL_NO_COLOR'])
  const color = mode === 'always' || (mode !== 'never' && !disabled && env['TERM'] !== 'dumb' &&
    (forced !== undefined ? forced !== '0' : Boolean(stream.isTTY)))
  const unicode =
    env['TERM'] !== 'dumb' &&
    env['TRAINCTL_ASCII'] === undefined &&
    (process.platform !== 'win32' || Boolean(env['WT_SESSION'] || env['TERM_PROGRAM'] || env['TERM']))
  const columns = stream.columns ?? Number(env['COLUMNS'])
  return {
    color,
    unicode,
    width: Number.isFinite(columns) && columns > 0 ? Math.max(1, Math.min(Math.floor(columns), 120)) : 80,
  }
}

const CODES = {
  reset: 0,
  bold: 1,
  dim: 2,
  italic: 3,
  underline: 4,
} as const

/** Kolory palety terminala: użytkownik zachowuje kontrolę nad kontrastem i tłem. */
const FG = {
  brand: 36,
  accent: 34,
  quality: 35,
  long: 34,
  easy: 32,
  race: 33,
  warn: 33,
  error: 31,
  success: 32,
  muted: 90,
  run: 32,
  bike: 33,
  swim: 36,
  strength: 35,
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
    return this.wrap(text, `[${FG[name]}m`)
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

  /** Plakietka bez narzucania koloru tła terminala. */
  badge(text: string, name: ColorName): string {
    return this.bold(this.color(`[${text}]`, name))
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
  return graphemes(stripAnsi(text)).reduce((width, part) => width + graphemeWidth(part), 0)
}

const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
export function graphemes(text: string): string[] {
  return Array.from(segmenter.segment(text), part => part.segment)
}

function graphemeWidth(part: string): number {
  if (/^[\p{Mark}\p{Control}\p{Format}]*$/u.test(part)) return 0
  if (/\p{Emoji_Presentation}|\uFE0F|\u20E3/u.test(part)) return 2
  const cp = part.codePointAt(0) ?? 0
  // CJK/fullwidth characters occupy two terminal cells; combining marks stay with their base.
  return cp >= 0x1100 && (cp <= 0x115f || cp === 0x2329 || cp === 0x232a ||
    (cp >= 0x2e80 && cp <= 0xa4cf && cp !== 0x303f) || (cp >= 0xac00 && cp <= 0xd7a3) ||
    (cp >= 0xf900 && cp <= 0xfaff) || (cp >= 0xfe10 && cp <= 0xfe19) ||
    (cp >= 0xfe30 && cp <= 0xfe6f) || (cp >= 0xff00 && cp <= 0xff60) ||
    (cp >= 0xffe0 && cp <= 0xffe6) || (cp >= 0x20000 && cp <= 0x3fffd)) ? 2 : 1
}

export function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\[[0-9;]*m/g, '')
}

export function padVisible(text: string, width: number): string {
  const pad = width - visibleLength(text)
  return pad > 0 ? text + ' '.repeat(pad) : text
}
