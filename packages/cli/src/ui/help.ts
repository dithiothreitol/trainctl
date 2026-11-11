import { wrap } from './blocks.ts'
import { Theme, padVisible, stripAnsi } from './theme.ts'

/** Commander keeps its command tree; only the layout of each help item changes. */
export function helpItem(term: string, termWidth: number, description: string, theme: Theme): string {
  const width = theme.caps.width
  const name = stripAnsi(term)
  const detail = stripAnsi(description)
  if (!detail || width - termWidth - 4 < 26) {
    return [
      ...wrap(name, width, '  ').map(line => theme.color(line, 'brand')),
      ...(detail ? wrap(detail, width, '    ') : []),
    ].join('\n')
  }
  // kolumna opisu trzyma szerokość — adres w opisie dzielimy jak zwykłe słowo
  const lines = wrap(detail, width - termWidth - 4, '', false)
  return lines.map((line, index) => `${index ? ' '.repeat(termWidth + 4) : `  ${theme.color(padVisible(name, termWidth), 'brand')}  `}${line}`).join('\n')
}
