/**
 * Semantyczne bloki wyjścia. Handlery komend NIE budują stringów z kolorami —
 * opisują treść, a renderery zamieniają ją na kolorowy terminal (CLI) albo
 * czysty tekst (MCP/pipe). Dzięki temu agent nigdy nie dostaje kodów ANSI,
 * a wygląd CLI można zmieniać bez dotykania logiki.
 */
import { Theme, padVisible, visibleLength, type ColorName } from './theme.ts'

export type Block =
  | { t: 'title'; text: string; sub?: string }
  | { t: 'section'; text: string }
  | { t: 'text'; text: string; tone?: 'normal' | 'muted' }
  | { t: 'kv'; pairs: [string, string][] }
  | { t: 'bullets'; items: string[]; tone?: 'normal' | 'muted' }
  | { t: 'table'; head: string[]; rows: string[][]; accent?: (ColorName | undefined)[] }
  | { t: 'note'; text: string; kind: 'warn' | 'success' | 'error' | 'info' }
  | { t: 'panel'; title: string; lines: string[]; accent?: ColorName }
  | { t: 'blank' }
  | { t: 'hint'; text: string }

export const b = {
  title: (text: string, sub?: string): Block => ({ t: 'title', text, ...(sub ? { sub } : {}) }),
  section: (text: string): Block => ({ t: 'section', text }),
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
  panel: (title: string, lines: string[], accent?: ColorName): Block => ({
    t: 'panel',
    title,
    lines,
    ...(accent ? { accent } : {}),
  }),
  blank: (): Block => ({ t: 'blank' }),
  hint: (text: string): Block => ({ t: 'hint', text }),
}

/** Zawijanie tekstu do szerokości, po słowach. */
export function wrap(text: string, width: number, indent = ''): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (visibleLength(candidate) + indent.length > width && line) {
      lines.push(indent + line)
      line = word
    } else {
      line = candidate
    }
  }
  if (line) lines.push(indent + line)
  return lines.length ? lines : [indent]
}

// ------------------------------------------------------------------ renderers

export function renderAnsi(blocks: Block[], theme = new Theme()): string {
  const { width } = theme.caps
  const s = theme.sym
  const out: string[] = []

  for (const block of blocks) {
    switch (block.t) {
      case 'title': {
        out.push(theme.bold(theme.color(block.text, 'brand')))
        if (block.sub) out.push(theme.dim(block.sub))
        out.push(theme.dim(s.horizontal.repeat(Math.min(width, visibleLength(block.text) + 8))))
        break
      }
      case 'section':
        out.push('', theme.bold(theme.color(block.text, 'accent')))
        break
      case 'text':
        out.push(...wrap(block.text, width).map((l) => (block.tone === 'muted' ? theme.dim(l) : l)))
        break
      case 'kv': {
        const keyWidth = Math.max(...block.pairs.map(([k]) => k.length))
        for (const [k, v] of block.pairs) {
          out.push(`${theme.dim(padVisible(k, keyWidth))}  ${theme.bold(v)}`)
        }
        break
      }
      case 'bullets':
        for (const item of block.items) {
          const lines = wrap(item, width - 2, '')
          const first = `${theme.color(s.bullet, 'accent')} ${lines[0]}`
          out.push(block.tone === 'muted' ? theme.dim(first) : first)
          for (const rest of lines.slice(1)) {
            out.push(block.tone === 'muted' ? theme.dim(`  ${rest}`) : `  ${rest}`)
          }
        }
        break
      case 'table': {
        const cols = block.head.length
        const widths = Array.from({ length: cols }, (_, i) =>
          Math.max(visibleLength(block.head[i] ?? ''), ...block.rows.map((r) => visibleLength(r[i] ?? ''))),
        )
        // ostatnia kolumna dostaje resztę szerokości (opis treningu)
        const fixed = widths.slice(0, -1).reduce((a, w) => a + w + 2, 0)
        widths[cols - 1] = Math.max(10, width - fixed - 2)
        out.push(
          theme.dim(block.head.map((h, i) => padVisible(h.toUpperCase(), widths[i]!)).join('  ')),
        )
        for (const row of block.rows) {
          const cells = row.map((cell, i) => {
            const color = block.accent?.[block.rows.indexOf(row)]
            const value = i === cols - 1 ? cell : padVisible(cell, widths[i]!)
            if (i === 0 && color) return theme.color(padVisible(cell, widths[i]!), color)
            return value
          })
          const last = cells[cols - 1] ?? ''
          const head = cells.slice(0, -1).join('  ')
          const lines = wrap(last, widths[cols - 1]!)
          out.push(`${head}  ${lines[0] ?? ''}`)
          const indent = ' '.repeat(visibleLength(head) + 2)
          for (const extra of lines.slice(1)) out.push(indent + extra)
        }
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
        const lines = wrap(block.text, width - 2)
        out.push(`${theme.color(symbol, color)} ${lines[0]}`)
        for (const rest of lines.slice(1)) out.push(`  ${rest}`)
        break
      }
      case 'panel': {
        const inner = width - 4
        const lines = block.lines.flatMap((l) => wrap(l, inner))
        const accent = block.accent ?? 'accent'
        const top = `${s.topLeft}${s.horizontal} ${theme.bold(theme.color(block.title, accent))} `
        const topPad = Math.max(0, width - visibleLength(top) - 1)
        out.push(theme.dim(s.topLeft + s.horizontal) + ` ${theme.bold(theme.color(block.title, accent))} ` + theme.dim(s.horizontal.repeat(topPad)))
        for (const line of lines) out.push(`${theme.dim(s.vertical)} ${line}`)
        out.push(theme.dim(s.bottomLeft + s.horizontal.repeat(width - 1)))
        break
      }
      case 'hint':
        out.push(theme.dim(`${s.arrow} ${block.text}`))
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
        for (const row of block.rows) out.push(row.filter(Boolean).join(' | '))
        break
      case 'note': {
        const prefix = { warn: '!', success: 'OK', error: 'BŁĄD', info: '' }[block.kind]
        out.push(prefix ? `${prefix} ${block.text}` : block.text)
        break
      }
      case 'panel':
        out.push(`${block.title}:`, ...block.lines)
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
