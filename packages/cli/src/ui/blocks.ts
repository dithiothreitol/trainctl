/**
 * Semantyczne bloki wyjścia. Handlery komend NIE budują stringów z kolorami —
 * opisują treść, a renderery zamieniają ją na kolorowy terminal (CLI) albo
 * czysty tekst (MCP/pipe). Dzięki temu agent nigdy nie dostaje kodów ANSI,
 * a wygląd CLI można zmieniać bez dotykania logiki.
 */
import { ui } from '../i18n/index.ts'
import { Theme, graphemes, padVisible, visibleLength, type ColorName } from './theme.ts'

export type Block =
  | { t: 'title'; text: string; sub?: string }
  | { t: 'section'; text: string; accent?: ColorName }
  | { t: 'card'; title: string; body: Block[]; accent: ColorName; meta: string[] }
  | { t: 'rpe'; label: string; min: number; max: number; legend: string }
  | { t: 'text'; text: string; tone?: 'normal' | 'muted' }
  | { t: 'kv'; pairs: [string, string][] }
  | { t: 'bullets'; items: string[]; tone?: 'normal' | 'muted' }
  | { t: 'table'; head: string[]; rows: string[][]; accent?: (ColorName | undefined)[] }
  | { t: 'note'; text: string; kind: 'warn' | 'success' | 'error' | 'info' }
  | { t: 'panel'; title: string; lines: string[]; accent?: ColorName; meta?: string[] }
  | { t: 'blank' }
  | { t: 'hint'; text: string }

export const b = {
  title: (text: string, sub?: string): Block => ({ t: 'title', text, ...(sub ? { sub } : {}) }),
  section: (text: string, accent?: ColorName): Block => ({ t: 'section', text, ...(accent ? { accent } : {}) }),
  card: (title: string, body: Block[], accent: ColorName, meta: string[] = []): Block => ({ t: 'card', title, body, accent, meta }),
  rpe: (label: string, min: number, max: number, legend: string): Block => ({ t: 'rpe', label, min, max, legend }),
  text: (text: string, tone?: 'normal' | 'muted'): Block => ({ t: 'text', text, ...(tone ? { tone } : {}) }),
  kv: (pairs: [string, string][]): Block => ({ t: 'kv', pairs }),
  bullets: (items: string[], tone?: 'normal' | 'muted'): Block => ({
    t: 'bullets',
    items,
    ...(tone ? { tone } : {}),
  }),
  table: (head: string[], rows: string[][], accent?: (ColorName | undefined)[]): Block => ({
    t: 'table',
    head,
    rows,
    ...(accent ? { accent } : {}),
  }),
  warn: (text: string): Block => ({ t: 'note', text, kind: 'warn' }),
  success: (text: string): Block => ({ t: 'note', text, kind: 'success' }),
  error: (text: string): Block => ({ t: 'note', text, kind: 'error' }),
  info: (text: string): Block => ({ t: 'note', text, kind: 'info' }),
  panel: (title: string, lines: string[], accent?: ColorName, meta?: string[]): Block => ({
    t: 'panel',
    title,
    lines,
    ...(accent ? { accent } : {}),
    ...(meta?.length ? { meta } : {}),
  }),
  blank: (): Block => ({ t: 'blank' }),
  hint: (text: string): Block => ({ t: 'hint', text }),
}

/** URL albo ścieżka (Windows, POSIX, względna) — tokeny, których nie tniemy. */
const UNBREAKABLE = /^[(\[{"'„«]*(?:[a-z][a-z0-9+.-]*:\/\/|[A-Za-z]:[\\/]|\.{0,2}[\\/]|~[\\/])\S+$/i

/**
 * Akapit: URL-e i ścieżki zostają w całości we własnym wierszu (bywa szerszy niż
 * `width`), żeby link był klikalny i dał się skopiować. Do tekstu, nie do kolumn.
 */
export const wrapText = (text: string, width: number, indent = ''): string[] => wrap(text, width, indent, true)

/**
 * Zawijanie tekstu do szerokości, po słowach. Domyślnie żaden wiersz nie jest
 * szerszy niż `width` (kolumny tabel, pomoc, wybór) — dłuższe słowo dzielimy;
 * akapity wołają wrapText, który zostawia adresy i ścieżki w całości.
 */
export function wrap(text: string, width: number, indent = '', keepTokens = false): string[] {
  const available = Math.max(1, width - visibleLength(indent))
  const lines: string[] = []
  // Preserve explicit line breaks (errors, lists and multi-step workouts).
  for (const paragraph of text.split(/\r?\n/)) {
    let line = ''
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      if (line && visibleLength(`${line} ${word}`) > available) {
        lines.push(indent + line)
        line = ''
      }
      if (keepTokens && visibleLength(word) > available && UNBREAKABLE.test(word)) {
        // Adres albo ścieżka w całości, we własnym wierszu (poprzedni wiersz został
        // już zamknięty wyżej): pocięte po znakach przestają być klikalne.
        line = word
      } else if (visibleLength(word) > available) {
        for (const part of graphemes(word)) {
          if (line && visibleLength(line + part) > available) {
            lines.push(indent + line)
            line = ''
          }
          line += part
        }
      } else {
        line = line ? `${line} ${word}` : word
      }
    }
    lines.push(indent + line)
  }
  return lines.length ? lines : [indent]
}

function keyValues(pairs: [string, string][], theme: Theme, width: number): string[] {
  const keyWidth = Math.min(Math.max(0, ...pairs.map(([key]) => visibleLength(key) + 1)), Math.floor(width / 2))
  return pairs.flatMap(([key, value]) => {
    // Adres albo ścieżka dłuższa niż kolumna wartości: układ piętrowy, pełna szerokość.
    const tokenTooWide = value.split(/\s+/).some((word) => UNBREAKABLE.test(word) && visibleLength(word) > width - keyWidth - 2)
    if (visibleLength(key) + 1 > keyWidth || width - keyWidth < 16 || tokenTooWide) {
      return [...wrap(`${key}:`, width).map(line => theme.dim(line)), ...wrapText(value, width, '  ')]
    }
    const lines = wrap(value, width - keyWidth - 2)
    const numeric = /^\d+(?:[.,]\d+)?(?:\s*(?:%|km|m|min|h|s|W))?$/.test(value)
    return lines.map((line, i) => `${i ? ' '.repeat(keyWidth) : theme.dim(padVisible(`${key}:`, keyWidth))}  ${numeric ? theme.bold(line) : line}`)
  })
}

function table(block: Extract<Block, { t: 'table' }>, theme: Theme): string[] {
  const { width } = theme.caps
  const cols = block.head.length
  if (!cols) return []
  const cells = block.head.map((head, col) => [head, ...block.rows.map(row => row[col] ?? '')])
  const natural = cells.map(values => Math.max(1, ...values.flatMap(value => value.split('\n').map(visibleLength))))
  const minimum = cells.map((values, col) => Math.min(natural[col]!, Math.max(8,
    Math.min(18, Math.max(...values.flatMap(value => value.split(/\s+/).map(visibleLength)))))))
  const gap = 2 * (cols - 1)
  // Too many columns: keep every labelled value in stacked records, never clip data.
  if (cols > Math.max(3, Math.floor(width / 16)) || minimum.reduce((sum, n) => sum + n, gap) > width) {
    return block.rows.flatMap((row, index) => {
      const first = `${block.head[0]}: ${row[0] ?? ''}`
      const heading = wrapText(first, width).map(line => theme.bold(theme.color(line, block.accent?.[index] ?? 'accent')))
      return [ ...(index ? [''] : []), ...heading,
        ...keyValues(block.head.slice(1).map((head, i) => [head, row[i + 1] ?? '']), theme, width) ]
    })
  }
  const widths = [...natural]
  while (widths.reduce((sum, n) => sum + n, gap) > width) {
    let widest = -1
    for (let col = 0; col < cols; col++) {
      if (widths[col]! > minimum[col]! && (widest < 0 || widths[col]! > widths[widest]!)) widest = col
    }
    if (widest < 0) break
    widths[widest]!--
  }
  const numeric = block.head.map((_, col) => col > 0 && block.rows.length > 0 && block.rows.every(row =>
    /^[+−-]?\d+(?:[.,]\d+)?(?:\s*(?:%|km|m|min|h|s|W))?$/.test(row[col] ?? '')))
  const rowLines = (row: string[], heading: boolean, accent?: ColorName): string[] => {
    const wrapped = block.head.map((_, col) => wrap(row[col] ?? '', widths[col]!))
    return Array.from({ length: Math.max(...wrapped.map(lines => lines.length)) }, (_, line) =>
      wrapped.map((lines, col) => {
        const text = lines[line] ?? ''
        const padded = numeric[col] ? ' '.repeat(Math.max(0, widths[col]! - visibleLength(text))) + text : padVisible(text, widths[col]!)
        if (heading) return theme.bold(padded)
        if (col === 0) return theme.color(padded, accent ?? 'accent')
        return numeric[col] ? theme.bold(padded) : padded
      }).join('  ').trimEnd())
  }
  return [
    ...rowLines(block.head, true),
    theme.dim(widths.map(n => theme.sym.horizontal.repeat(n)).join('  ')),
    ...block.rows.flatMap((row, index) => rowLines(row, false, block.accent?.[index])),
  ]
}

/** The palette shows planned subjective effort, never a measured training zone. */
export const rpeColor = (value: number): ColorName => value <= 2 ? 'brand' : value <= 4 ? 'easy' : value <= 6 ? 'warn' : value <= 8 ? 'quality' : 'error'

function effortScale(block: Extract<Block, { t: 'rpe' }>, theme: Theme): string[] {
  const { width } = theme.caps
  const out = wrap(block.label + ': RPE ' + block.min + '–' + block.max + '/10', width)
    .map(line => theme.bold(theme.color(line, rpeColor(block.max))))
  const count = Math.max(1, Math.floor((width + 1) / 5))
  const levels = ['▁', '▂', '▃', '▄', '▅', '▅', '▆', '▇', '█', '█']
  for (let start = 1; start <= 10; start += count) {
    const bars: string[] = [], numbers: string[] = []
    for (let n = start; n < start + count && n <= 10; n++) {
      const active = n >= block.min && n <= block.max
      const cell = (active ? '[' : ' ') + String(n).padStart(2, ' ') + (active ? ']' : ' ')
      if (width < 4) {
        out.push(...wrap(cell.trim(), width).map(line => theme.color(line, rpeColor(n))))
        continue
      }
      const bar = ' ' + (theme.caps.unicode ? levels[n - 1]!.repeat(2) : active ? '##' : '--') + ' '
      bars.push(theme.color(bar, rpeColor(n)))
      numbers.push(theme.color(active ? theme.bold(cell) : cell, rpeColor(n)))
    }
    if (bars.length) out.push(bars.join(' '), numbers.join(' '))
  }
  out.push(...wrap(block.legend, width).map(line => theme.dim(line)))
  return out
}

// ------------------------------------------------------------------ renderers

export function renderAnsi(blocks: Block[], theme = new Theme()): string {
  const { width } = theme.caps
  const s = theme.sym
  const out: string[] = []

  for (const block of blocks) {
    switch (block.t) {
      case 'title': {
        if (out.length) out.push('')
        out.push(...wrapText(block.text, width).map(line => theme.bold(theme.color(line, 'brand'))))
        if (block.sub) out.push(...wrapText(block.sub, width).map(line => theme.dim(line)))
        out.push(theme.dim(s.horizontal.repeat(Math.min(width, 64))), '')
        break
      }
      case 'section':
        out.push('', ...wrapText(block.text, width).map(line => theme.bold(theme.color(line, block.accent ?? 'accent'))), '')
        break
      case 'text':
        out.push(...wrapText(block.text, width).map((l) => (block.tone === 'muted' ? theme.dim(l) : l)))
        break
      case 'kv': {
        out.push(...keyValues(block.pairs, theme, width))
        break
      }
      case 'bullets':
        for (const item of block.items) {
          const lines = wrapText(item, width - 2, '')
          const first = `${theme.color(s.bullet, 'accent')} ${lines[0]}`
          out.push(block.tone === 'muted' ? theme.dim(first) : first)
          for (const rest of lines.slice(1)) {
            out.push(block.tone === 'muted' ? theme.dim(`  ${rest}`) : `  ${rest}`)
          }
        }
        break
      case 'table': {
        out.push(...table(block, theme))
        break
      }
      case 'note': {
        const map = {
          warn: [s.warn, 'warn'],
          success: [s.ok, 'success'],
          error: [s.fail, 'error'],
          info: [s.arrow, 'accent'],
        } as const
        const [symbol, color] = map[block.kind]
        const prefixWidth = visibleLength(symbol) + 1
        const lines = wrapText(block.text, width - prefixWidth)
        out.push(`${theme.color(symbol, color)} ${lines[0]}`)
        for (const rest of lines.slice(1)) out.push(`${' '.repeat(prefixWidth)}${rest}`)
        break
      }
      case 'rpe':
        out.push(...effortScale(block, theme))
        break
      case 'card': {
        const inset = width >= 4 ? 2 : 0
        const inner = Math.max(1, width - inset)
        const nested = new Theme({ ...theme.caps, width: inner })
        out.push('')
        for (const [index, title] of wrapText(block.title, inner).entries()) {
          out.push((inset ? theme.color(index ? s.vertical : s.topLeft, block.accent) + ' ' : '') + theme.bold(theme.color(title, block.accent)))
        }
        const content = renderAnsi(block.body, nested).split('\n')
        if (block.meta.length) content.push('', ...block.meta.flatMap(text => wrapText(text, inner).map(line => theme.dim(line))))
        for (const line of content) out.push((inset ? theme.color(s.vertical, block.accent) + ' ' : '') + line)
        out.push(theme.color(s.bottomLeft + s.horizontal.repeat(Math.max(0, Math.min(width - 1, 63))), block.accent), '')
        break
      }
      case 'panel': {
        const inner = Math.max(1, width - 2)
        const lines = block.lines.flatMap((l) => wrapText(l, inner))
        const accent = block.accent ?? 'accent'
        out.push('')
        for (const [index, title] of wrapText(block.title, inner).entries()) {
          out.push(`${theme.color(index ? s.vertical : s.topLeft, accent)} ${theme.bold(theme.color(title, accent))}`)
        }
        for (const line of lines) out.push(`${theme.color(s.vertical, accent)} ${line}`)
        for (const line of (block.meta ?? []).flatMap(text => wrapText(text, inner))) {
          out.push(`${theme.color(s.vertical, accent)} ${theme.dim(line)}`)
        }
        out.push(theme.color(s.bottomLeft + s.horizontal.repeat(Math.min(width - 1, 23)), accent), '')
        break
      }
      case 'hint':
        out.push('', ...wrapText(block.text, width - visibleLength(s.arrow) - 1).map((line, i) =>
          `${i ? ' '.repeat(visibleLength(s.arrow)) : theme.color(s.arrow, 'accent')} ${theme.color(line, 'brand')}`))
        break
      case 'blank':
        out.push('')
        break
    }
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

/** Wersja bez ozdobników — dla MCP, potoków i plików. */
export function renderPlain(blocks: Block[]): string {
  const out: string[] = []
  for (const block of blocks) {
    switch (block.t) {
      case 'title':
        out.push(block.text)
        if (block.sub) out.push(block.sub)
        break
      case 'section':
        out.push('', `${block.text}:`)
        break
      case 'text':
        out.push(block.text)
        break
      case 'kv':
        for (const [k, v] of block.pairs) out.push(`${k}: ${v}`)
        break
      case 'bullets':
        for (const item of block.items) out.push(`- ${item}`)
        break
      case 'table':
        out.push(block.head.join(' | '))
        for (const row of block.rows) out.push(row.filter(Boolean).join(' | '))
        break
      case 'note': {
        const c = ui().common
        const prefix = { warn: c.labelWarn, success: c.labelOk, error: c.labelError, info: '' }[
          block.kind
        ]
        out.push(prefix ? `${prefix} ${block.text}` : block.text)
        break
      }
      case 'rpe':
        out.push(...effortScale(block, new Theme({ color: false, unicode: false, width: 80 })))
        break
      case 'card':
        out.push('', block.title, renderPlain(block.body), '', ...block.meta, '')
        break
      case 'panel':
        out.push(`${block.title}:`, ...block.lines, ...(block.meta ?? []))
        break
      case 'hint':
        out.push(block.text)
        break
      case 'blank':
        out.push('')
        break
    }
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}
