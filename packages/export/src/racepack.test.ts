import { describe, expect, it } from 'vitest'
import {
  bandPoints,
  buildSplits,
  fmtClock,
  fmtPace,
  splitPoints,
  toRacePackHtml,
} from './racepack.ts'

describe('formatowanie', () => {
  it('zegar: godziny tylko gdy są', () => {
    expect(fmtClock(3599)).toBe('59:59')
    expect(fmtClock(3600)).toBe('1:00:00')
    expect(fmtClock(12600)).toBe('3:30:00')
  })

  it('tempo per km', () => {
    expect(fmtPace(300)).toBe('5:00/km')
    expect(fmtPace(255.5)).toBe('4:16/km') // zaokrąglenie sekund w górę od .5
  })
})

describe('punkty splitów', () => {
  it('każdy pełny kilometr + meta na dystansie ułamkowym', () => {
    const pts = splitPoints(21.0975)
    expect(pts[0]).toBe(1)
    expect(pts).toHaveLength(21 + 1)
    expect(pts.at(-1)).toBe(21.0975)
  })

  it('opaska: rzadziej niż tabela, zawsze z połówką i metą', () => {
    const marathon = bandPoints(42.195)
    expect(marathon).toContain(21) // połówka
    expect(marathon.at(-1)).toBe(42.195)
    expect(marathon.length).toBeLessThan(12) // co 5 km — mieści się na nadgarstku
    const tenK = bandPoints(10)
    expect(tenK).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  })
})

describe('splity narastająco', () => {
  it('równe tempo: meta = czas scenariusza, połówka = połowa czasu', () => {
    const rows = buildSplits(42.195, [{ label: 'cel', totalSec: 12600 }]) // 3:30
    expect(rows.at(-1)!.cumulative[0]).toBe('3:30:00')
    const atHalf = rows.find((r) => r.km === 21)!
    // 21/42.195 × 12600 s ≈ 6271 s ≈ 1:44:31
    expect(atHalf.cumulative[0]).toBe('1:44:31')
  })

  it('scenariusze idą w kolejności wejścia', () => {
    const rows = buildSplits(10, [
      { label: 'a', totalSec: 2400 },
      { label: 'b', totalSec: 3000 },
    ])
    expect(rows.find((r) => r.km === 5)!.cumulative).toEqual(['20:00', '25:00'])
  })
})

/** Etykiety jak w polskim katalogu CLI — renderer dostaje je z zewnątrz. */
const LABELS = {
  lang: 'pl',
  title: (raceName: string) => `${raceName} — pakiet startowy`,
  subtitle: (date: string, distanceKm: number) => `${date} · ${distanceKm} km`,
  splits: 'Splity narastająco',
  band: (scenario: string) => `Opaska — ${scenario}`,
  finish: 'META',
  km: 'km',
  cutHint: '✂ wytnij wzdłuż przerywanej linii, owiń wokół nadgarstka, sklej taśmą',
  conditions: 'Korekta na warunki',
}

describe('HTML pakietu', () => {
  const html = toRacePackHtml({
    raceName: 'Maraton <Testowy>',
    raceDate: '2026-11-29',
    distanceKm: 42.195,
    scenarios: [
      { label: 'śmiało', totalSec: 12000 },
      { label: 'cel', totalSec: 12600 },
      { label: 'ostrożnie', totalSec: 13500 },
    ],
    bandScenario: 1,
    provenance: 'Przedział z predykcji (hm-x2.28, W-1).',
    labels: LABELS,
  })

  it('A4, trzy kolumny scenariuszy, opaska z celem', () => {
    expect(html).toContain('@page { size: A4 portrait')
    expect(html).toContain('śmiało')
    expect(html).toContain('ostrożnie')
    expect(html).toContain('3:30:00')
    expect(html).toContain('wytnij')
  })

  it('escapuje HTML w nazwie biegu', () => {
    expect(html).toContain('Maraton &lt;Testowy&gt;')
    expect(html).not.toContain('<Testowy>')
  })

  it('proweniencja liczb w stopce (skąd wziął się przedział)', () => {
    expect(html).toContain('W-1')
  })

  it('bez tabeli pogodowej, dopóki nie ma reguł ze źródłami', () => {
    expect(html).not.toContain('Korekta na warunki')
  })

  it('zły indeks opaski = błąd, nie cichy fallback', () => {
    expect(() =>
      toRacePackHtml({
        raceName: 'X',
        raceDate: '2026-01-01',
        distanceKm: 10,
        scenarios: [{ label: 'cel', totalSec: 2400 }],
        bandScenario: 3,
        provenance: '',
        labels: LABELS,
      }),
    ).toThrow(/bandScenario/)
  })
})
