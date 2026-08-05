/**
 * Rozpiska do wydruku (HTML → Ctrl+P → PDF/papier).
 * Układ pod A4 w pionie: tydzień = tabela, podział stron między tygodniami,
 * czarno-biały (druk laserowy), bez zależności zewnętrznych.
 */

export interface PrintWeek {
  index: number
  weekStart: string
  phase: string
  targetKm: number
  totalKm: number
  deload: boolean
  days: { weekday: string; date: string; km: string; text: string }[]
}

export interface PrintOptions {
  title: string
  subtitle: string
  weeks: PrintWeek[]
  footer?: string
}

const escapeHtml = (text: string): string =>
  text.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  )

export function toPrintableHtml(opts: PrintOptions): string {
  const rows = (week: PrintWeek) =>
    week.days
      .map(
        (d) => `      <tr${d.text === '—' ? ' class="rest"' : ''}>
        <td class="day">${escapeHtml(d.weekday)}</td>
        <td class="date">${escapeHtml(d.date)}</td>
        <td class="km">${escapeHtml(d.km)}</td>
        <td class="what">${escapeHtml(d.text)}</td>
        <td class="check"></td>
      </tr>`,
      )
      .join('\n')

  const weeks = opts.weeks
    .map(
      (w) => `  <section class="week">
    <h2>Tydzień ${w.index + 1} <span class="meta">od ${escapeHtml(w.weekStart)} · ${escapeHtml(w.phase)}${
      w.deload ? ' · odciążenie' : ''
    } · ${w.totalKm} km</span></h2>
    <table>
      <thead>
        <tr><th>Dzień</th><th>Data</th><th>Km</th><th>Trening</th><th>✓</th></tr>
      </thead>
      <tbody>
${rows(w)}
      </tbody>
    </table>
  </section>`,
    )
    .join('\n')

  return `<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8">
<title>${escapeHtml(opts.title)}</title>
<style>
  @page { size: A4 portrait; margin: 14mm 12mm; }
  * { box-sizing: border-box; }
  body { font: 11pt/1.35 "Segoe UI", system-ui, sans-serif; color: #111; margin: 0; }
  h1 { font-size: 16pt; margin: 0 0 2mm; }
  .sub { color: #555; font-size: 9.5pt; margin: 0 0 6mm; }
  .week { break-inside: avoid; page-break-inside: avoid; margin-bottom: 6mm; }
  h2 { font-size: 11.5pt; margin: 0 0 1.5mm; border-bottom: 1px solid #111; padding-bottom: 1mm; }
  h2 .meta { font-weight: 400; color: #555; font-size: 9pt; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 8pt; text-transform: uppercase; letter-spacing: .04em;
       color: #666; padding: 1mm 1.5mm; border-bottom: 1px solid #ccc; }
  td { padding: 1.4mm 1.5mm; vertical-align: top; border-bottom: 1px solid #eee; }
  .day { width: 11mm; font-weight: 600; }
  .date { width: 15mm; color: #555; }
  .km { width: 14mm; white-space: nowrap; }
  .check { width: 8mm; border: 1px solid #bbb; border-width: 0 0 1px 1px; }
  .rest td { color: #999; }
  .rest .check { border-left-color: transparent; }
  footer { margin-top: 8mm; font-size: 8pt; color: #777; border-top: 1px solid #ddd; padding-top: 2mm; }
  @media screen { body { max-width: 190mm; margin: 8mm auto; padding: 0 6mm; } }
  @media print { .no-print { display: none; } }
</style>
</head>
<body>
<h1>${escapeHtml(opts.title)}</h1>
<p class="sub">${escapeHtml(opts.subtitle)}</p>
${weeks}
${opts.footer ? `<footer>${escapeHtml(opts.footer)}</footer>` : ''}
</body>
</html>
`
}
