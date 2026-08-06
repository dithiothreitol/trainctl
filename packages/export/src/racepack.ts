/**
 * Pakiet startowy (faza 9): tabela splitów + papierowa opaska tempa pod A4.
 *
 * Uczciwość wobec W-1 (predykcja to zawsze przedział): tabela pokazuje
 * scenariusze obok siebie (ostrożny / cel / śmiały), a opaska — jeden wybrany,
 * z jawną etykietą skąd pochodzi. Równe tempo jako założenie rozpiski to
 * wartość inżynierska: rozkład tempa nie poprawia predykcji wyniku (W-10),
 * a rozpiska ma być prosta do czytania w biegu.
 */

export interface RaceScenario {
  /** Etykieta kolumny, np. „cel", „ostrożnie", „śmiało". */
  label: string
  totalSec: number
}

export interface SplitRow {
  km: number
  /** Czas narastająco per scenariusz, w kolejności wejścia. */
  cumulative: string[]
}

/**
 * Teksty na wydruku. Renderer nie zna katalogu tłumaczeń — dostaje gotowe
 * napisy, żeby `@tren/export` pozostał czystym generatorem HTML.
 */
export interface RacePackLabels {
  /** Kod języka do atrybutu `lang` — czytniki ekranu i dzielenie wyrazów. */
  lang: string
  title: (raceName: string) => string
  subtitle: (date: string, distanceKm: number) => string
  splits: string
  band: (scenario: string) => string
  finish: string
  km: string
  cutHint: string
  conditions: string
}

export interface RacePackInput {
  raceName: string
  raceDate: string
  distanceKm: number
  scenarios: RaceScenario[]
  /** Który scenariusz idzie na opaskę (indeks w `scenarios`). */
  bandScenario: number
  /** Skąd wzięły się liczby — drukowane drobnym drukiem (proweniencja jak w ADR-019). */
  provenance: string
  /** Opcjonalne wiersze korekty pogodowej (dokładane, gdy reguły W-14+ mają źródła). */
  heatTable?: { header: string[]; rows: string[][]; note: string }
  labels: RacePackLabels
}

/** Sekundy → „H:MM:SS" / „MM:SS" — na opasce liczy się zwięzłość. */
export function fmtClock(sec: number): string {
  const s = Math.round(sec)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const rest = s % 60
  const p = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${p(m)}:${p(rest)}` : `${m}:${p(rest)}`
}

/** Tempo w s/km → „M:SS/km". Zaokrąglamy CAŁOŚĆ, inaczej 299,7 s dałoby „4:60". */
export function fmtPace(secPerKm: number): string {
  const total = Math.round(secPerKm)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}/km`
}

/**
 * Punkty pośrednie rozpiski: każdy pełny kilometr + meta.
 * Równe tempo (inż. — patrz nagłówek modułu).
 */
export function splitPoints(distanceKm: number): number[] {
  const points: number[] = []
  for (let km = 1; km < distanceKm; km++) points.push(km)
  points.push(distanceKm)
  return points
}

export function buildSplits(distanceKm: number, scenarios: RaceScenario[]): SplitRow[] {
  return splitPoints(distanceKm).map((km) => ({
    km,
    cumulative: scenarios.map((s) => fmtClock((s.totalSec * km) / distanceKm)),
  }))
}

/** Kilometry „kontrolne" na opaskę — pełna tabela nie mieści się na nadgarstku. */
export function bandPoints(distanceKm: number): number[] {
  const every = distanceKm > 25 ? 5 : distanceKm > 12 ? 2 : 1
  const points: number[] = []
  for (let km = every; km < distanceKm; km += every) points.push(km)
  // połówka dystansu zawsze jest (kontrola tempa w najważniejszym momencie)
  const half = Math.round(distanceKm / 2)
  if (!points.includes(half) && half > 0 && half < distanceKm) {
    points.push(half)
    points.sort((a, b) => a - b)
  }
  points.push(distanceKm)
  return points
}

/** Najbliższy pełny kilometr połowy dystansu — wyróżniany w tabeli splitów. */
export const halfMark = (distanceKm: number): number => Math.round(distanceKm / 2)

const escapeHtml = (text: string): string =>
  text.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  )

export function toRacePackHtml(input: RacePackInput): string {
  const L = input.labels
  const splits = buildSplits(input.distanceKm, input.scenarios)
  const band = input.scenarios[input.bandScenario]
  if (!band) throw new Error('bandScenario poza zakresem scenariuszy')
  const bandRows = bandPoints(input.distanceKm)
    .map((km) => {
      const isFinish = km === input.distanceKm
      const label = isFinish ? L.finish : `${km}`
      return `      <tr${isFinish ? ' class="finish"' : ''}>
        <td class="bkm">${label}</td>
        <td class="btime">${fmtClock((band.totalSec * km) / input.distanceKm)}</td>
      </tr>`
    })
    .join('\n')

  const halfMarkKm = halfMark(input.distanceKm)
  const headCols = input.scenarios
    .map((s) => `<th>${escapeHtml(s.label)}<br><span class="pace">${fmtPace(s.totalSec / input.distanceKm)}</span></th>`)
    .join('')
  const splitRows = splits
    .map((r) => {
      const isFinish = r.km === input.distanceKm
      // dokładnie JEDEN wiersz „połówka": najbliższy pełny kilometr połowy dystansu
      const half = r.km === halfMarkKm
      return `      <tr${isFinish ? ' class="finish"' : half ? ' class="half"' : ''}>
        <td class="km">${isFinish ? escapeHtml(L.finish) : r.km}</td>
        ${r.cumulative.map((c) => `<td>${c}</td>`).join('')}
      </tr>`
    })
    .join('\n')

  const heat = input.heatTable
    ? `  <section class="heat">
    <h2>${escapeHtml(L.conditions)}</h2>
    <table>
      <thead><tr>${input.heatTable.header.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
      <tbody>
${input.heatTable.rows.map((r) => `      <tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`).join('\n')}
      </tbody>
    </table>
    <p class="note">${escapeHtml(input.heatTable.note)}</p>
  </section>`
    : ''

  return `<!doctype html>
<html lang="${escapeHtml(L.lang)}">
<head>
<meta charset="utf-8">
<title>${escapeHtml(L.title(input.raceName))}</title>
<style>
  @page { size: A4 portrait; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font: 10.5pt/1.3 "Segoe UI", system-ui, sans-serif; color: #111; margin: 0; }
  h1 { font-size: 15pt; margin: 0 0 1mm; }
  .sub { color: #555; font-size: 9pt; margin: 0 0 5mm; }
  .cols { display: flex; gap: 8mm; align-items: flex-start; }
  section { break-inside: avoid; }
  h2 { font-size: 11pt; margin: 0 0 1.5mm; border-bottom: 1px solid #111; padding-bottom: 1mm; }
  table { border-collapse: collapse; }
  th { font-size: 7.5pt; text-transform: uppercase; letter-spacing: .04em; color: #666;
       padding: 1mm 2mm; border-bottom: 1px solid #ccc; text-align: right; }
  th .pace { font-weight: 400; text-transform: none; letter-spacing: 0; }
  td { padding: .9mm 2mm; text-align: right; border-bottom: 1px solid #eee;
       font-variant-numeric: tabular-nums; }
  .km, .bkm { font-weight: 600; }
  tr.half td { border-top: 1.5px solid #111; }
  tr.finish td { font-weight: 700; border-top: 2px solid #111; }
  /* wrist band: a narrow strip to cut out and wrap around the wrist */
  .band { border: 1.2px dashed #444; padding: 2mm 3mm; width: 46mm; }
  .band h2 { border: 0; font-size: 9pt; margin-bottom: 0; }
  .band .goal { font-size: 13pt; font-weight: 700; margin: 0 0 1mm; }
  .band table { width: 100%; }
  .band td { padding: .6mm 1mm; font-size: 9.5pt; }
  .band .cut { color: #888; font-size: 7pt; margin: 1.5mm 0 0; }
  footer { margin-top: 6mm; font-size: 7.5pt; color: #777; border-top: 1px solid #ddd; padding-top: 1.5mm; }
  .note { font-size: 8pt; color: #555; margin-top: 1mm; }
  @media screen { body { max-width: 190mm; margin: 8mm auto; padding: 0 6mm; } }
</style>
</head>
<body>
<h1>${escapeHtml(L.title(input.raceName))}</h1>
<p class="sub">${escapeHtml(L.subtitle(input.raceDate, input.distanceKm))}</p>
<div class="cols">
  <section class="splits">
    <h2>${escapeHtml(L.splits)}</h2>
    <table>
      <thead><tr><th>${escapeHtml(L.km)}</th>${headCols}</tr></thead>
      <tbody>
${splitRows}
      </tbody>
    </table>
  </section>
  <section class="band">
    <h2>${escapeHtml(L.band(band.label))}</h2>
    <p class="goal">${fmtClock(band.totalSec)} · ${fmtPace(band.totalSec / input.distanceKm)}</p>
    <table>
      <tbody>
${bandRows}
      </tbody>
    </table>
    <p class="cut">${escapeHtml(L.cutHint)}</p>
  </section>
</div>
${heat}
<footer>${escapeHtml(input.provenance)}</footer>
</body>
</html>
`
}
