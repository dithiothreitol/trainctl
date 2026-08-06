/**
 * Regresje z code-review (2026-08-06). Każdy test odpowiada defektowi, który
 * przeszedł całą zieloną suitę — dopisane po naprawie, żeby nie wróciły.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cmdExport, cmdPlan, cmdReschedule, cmdShift, cmdToday, cmdWeek } from './commands.ts'
import { fmtTime, loadPlan } from './planfile.ts'
import { setLocale } from '@tren/core'

// Ten plik weryfikuje ZACHOWANIE komend, a asercje czyta się najłatwiej
// po polsku. Kompletność i jakość tłumaczeń pilnują testy i18n.
setLocale('pl')


const CONFIG = (extra = '') => `athlete:
  recentWeeklyKm: 55
  daysAvailable: [tue, wed, thu, sat, sun]
  results:
    - { date: "2026-03-30", distanceKm: 21.0975, timeSec: 5400 }
goal:
  name: "Maraton testowy"
  date: "2026-11-29"
  distanceKm: 42.195
  priority: A
${extra}strength:
  enabled: true
`

let dir: string
const setup = (extra = '') => {
  writeFileSync(join(dir, 'tren.yaml'), CONFIG(extra), 'utf-8')
  cmdPlan(dir, { date: '2026-08-05' })
}
const strengthDays = () =>
  loadPlan(dir)
    .weeks.flatMap((w) => w.days)
    .filter((d) => d.strength)

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'tren-reg-'))
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

describe('reschedule nie kasuje sesji siłowych', () => {
  it('po --apply siła nadal jest w planie, a zmiany są zaraportowane', () => {
    setup()
    const before = strengthDays().length
    expect(before).toBeGreaterThan(15)
    const r = cmdReschedule(dir, { date: '2026-08-05', block: ['2026-08-06'], apply: true })
    expect(r.code).toBe(0)
    const after = strengthDays().length
    // sesje przetrwały; jeśli któraś nie mieści się po przetasowaniu, komenda mówi o tym wprost
    expect(after).toBeGreaterThanOrEqual(before - 1)
    if (after < before) expect(r.output).toMatch(/sesji siły/)
  })

  it('podgląd (bez --apply) niczego nie usuwa', () => {
    setup()
    const before = strengthDays().length
    cmdReschedule(dir, { date: '2026-08-05', block: ['2026-08-06'] })
    expect(strengthDays()).toHaveLength(before)
  })
})

describe('shift ostrzega, gdy akcent wyląduje przy sile', () => {
  it('przesunięcie akcentu na dzień siłowy daje ostrzeżenie S-5', () => {
    setup()
    const plan = loadPlan(dir)
    const week = plan.weeks.find((w) =>
      w.days.some((d) => d.strength) &&
      w.days.some((d) => ['quality_intervals', 'quality_continuous'].includes(d.workout?.kind ?? '')),
    )!
    const strengthDay = week.days.find((d) => d.strength && !d.workout) ?? week.days.find((d) => d.strength)!
    const qualityDay = week.days.find((d) =>
      ['quality_intervals', 'quality_continuous'].includes(d.workout?.kind ?? ''),
    )!
    const r = cmdShift(dir, { from: qualityDay.date, to: strengthDay.date })
    expect(r.code).toBe(0)
    expect(r.output).toMatch(/S-5|siłow/)
  })
})

describe('odstęp 48 h między sesjami siły — także przez granicę tygodnia', () => {
  it('w całym planie nie ma dwóch sesji dzień po dniu', () => {
    setup()
    const dates = strengthDays()
      .map((d) => Date.parse(d.date))
      .sort((a, b) => a - b)
    for (let i = 1; i < dates.length; i++) {
      expect((dates[i]! - dates[i - 1]!) / 86_400_000).toBeGreaterThanOrEqual(2)
    }
  })
})

describe('plan.yaml jest czytelny dla człowieka (plan-as-code)', () => {
  it('bez aliasów YAML — żadnego `*a1`', () => {
    setup()
    const yaml = readFileSync(join(dir, 'plan', 'plan.yaml'), 'utf-8')
    expect(yaml).not.toMatch(/:\s*\*a\d+/)
  })

  it('każda sesja siłowa zapisana w całości, nie jako referencja', () => {
    setup()
    const yaml = readFileSync(join(dir, 'plan', 'plan.yaml'), 'utf-8')
    const full = (yaml.match(/kind: heavy/g) ?? []).length
    expect(full).toBe(strengthDays().length)
  })
})

describe('porada o sile zależy od tego, co jest tego dnia', () => {
  it('nie twierdzi „bieg spokojny obok siły" przy jednostce, która spokojna nie jest', () => {
    setup()
    for (const day of strengthDays()) {
      const out = cmdToday(dir, { date: day.date }).output
      const kind = day.workout?.kind
      if (kind && !['easy', 'long'].includes(kind)) {
        expect(out).not.toContain('Bieg spokojny obok siły jest OK')
      }
    }
  })
})

describe('week pokazuje prawdziwy czas trwania siły', () => {
  it('czas pochodzi z danych, nie z zaszytej stałej', () => {
    setup()
    const day = strengthDays()[0]!
    const out = cmdWeek(dir, { date: day.date }).output
    expect(out).toContain(`SIŁA ~${day.strength!.durationMin} min`)
  })
})

describe('kalendarz zawiera siłę', () => {
  it('dni z samą siłą (bez biegania) też mają wpis w .ics', () => {
    setup()
    cmdExport(dir, { what: 'calendar' })
    const ics = readFileSync(join(dir, 'export', 'maraton-testowy.ics'), 'utf-8')
    const restWithStrength = strengthDays().filter((d) => !d.workout)
    expect(restWithStrength.length).toBeGreaterThan(0)
    for (const day of restWithStrength) {
      expect(ics).toContain(day.date.replace(/-/g, ''))
    }
    expect(ics).toMatch(/SUMMARY:[^\r\n]*siła/)
  })
})

describe('formatowanie czasu nie produkuje „:60"', () => {
  it('fmtTime zaokrągla całość, nie same sekundy', () => {
    expect(fmtTime(3599.7)).toBe('1:00:00')
    expect(fmtTime(59.6)).toBe('1:00')
  })

  it('pakiet startowy z celem 3:30:50 nie pokazuje tempa „4:60/km"', () => {
    setup('  targetTimeSec: 12650\n')
    const r = cmdExport(dir, { what: 'race' })
    expect(r.code).toBe(0)
    const html = readFileSync(
      join(dir, 'export', 'maraton-testowy-pakiet-startowy.html'),
      'utf-8',
    )
    expect(html).not.toMatch(/:60\/km/)
  })
})

describe('pakiet startowy: jedna połówka, jawny scenariusz, gęsta drabinka', () => {
  beforeEach(() => setup('  targetTimeSec: 12650\n'))

  it('dokładnie jeden wiersz oznaczony jako połowa dystansu', () => {
    cmdExport(dir, { what: 'race' })
    const html = readFileSync(join(dir, 'export', 'maraton-testowy-pakiet-startowy.html'), 'utf-8')
    expect((html.match(/class="half"/g) ?? []).length).toBe(1)
  })

  it('tabela cieplna mówi, którego scenariusza dotyczy', () => {
    cmdExport(dir, { what: 'race' })
    const html = readFileSync(join(dir, 'export', 'maraton-testowy-pakiet-startowy.html'), 'utf-8')
    expect(html).toMatch(/scenariusz „cel”/)
  })

  it('drabinka zaczyna się przy optimum, nie na sztywnych 10 °C', () => {
    cmdExport(dir, { what: 'race' })
    const html = readFileSync(join(dir, 'export', 'maraton-testowy-pakiet-startowy.html'), 'utf-8')
    const temps = [...html.matchAll(/<td>(\d+) °C<\/td>/g)].map((m) => Number(m[1]))
    expect(temps.length).toBeGreaterThan(6) // gęsto: co 2 °C, nie co 5 °C
    expect(temps[0]).toBeLessThan(10)
  })
})
