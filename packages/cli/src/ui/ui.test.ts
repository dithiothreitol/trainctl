import { describe, expect, it } from 'vitest'
import { b, renderAnsi, renderPlain, wrap } from './blocks.ts'
import { Theme, detectCapabilities, stripAnsi, visibleLength } from './theme.ts'
import { parseDaysInput, parseDistanceInput, parseTimeInput, toYaml } from './wizard.ts'

const sample = [
  b.title('Tydzień 3/17', 'baza · 62 km'),
  b.kv([['VDOT', '51'], ['Szczyt', '70 km']]),
  b.section('Treningi'),
  b.table(
    ['dzień', 'km', 'trening'],
    [['WT', '12', 'interwały 5x1 km'], ['ŚR', '15', 'spokojne']],
    ['quality', 'easy'],
  ),
  b.warn('objętość poniżej rekomendacji'),
  b.hint('tren why'),
]

describe('detekcja możliwości terminala', () => {
  it('NO_COLOR wyłącza kolory nawet w TTY', () => {
    const caps = detectCapabilities({ isTTY: true, columns: 100 }, { NO_COLOR: '1' })
    expect(caps.color).toBe(false)
  })

  it('brak TTY (potok, agent) wyłącza kolory', () => {
    expect(detectCapabilities({ isTTY: false }, {}).color).toBe(false)
  })

  it('FORCE_COLOR wymusza kolory poza TTY', () => {
    expect(detectCapabilities({ isTTY: false }, { FORCE_COLOR: '1' }).color).toBe(true)
  })

  it('szerokość jest ograniczana do rozsądnego zakresu', () => {
    expect(detectCapabilities({ columns: 300 }, {}).width).toBeLessThanOrEqual(110)
    expect(detectCapabilities({ columns: 20 }, {}).width).toBeGreaterThanOrEqual(40)
  })

  it('TREN_ASCII wymusza znaki ASCII', () => {
    const ascii = new Theme(detectCapabilities({ isTTY: true }, { TREN_ASCII: '1' }))
    expect(ascii.sym.ok).toBe('OK')
    expect(ascii.sym.bullet).toBe('-')
  })
})

describe('render ANSI', () => {
  const colorTheme = new Theme({ color: true, unicode: true, width: 80 })

  it('koloruje, gdy terminal na to pozwala', () => {
    const out = renderAnsi(sample, colorTheme)
    expect(out).toContain('[')
    expect(stripAnsi(out)).not.toContain('[')
  })

  it('bez kolorów nie emituje żadnych sekwencji', () => {
    const out = renderAnsi(sample, new Theme({ color: false, unicode: true, width: 80 }))
    expect(out).not.toContain('[')
  })

  it('zawiera całą treść niezależnie od trybu', () => {
    for (const theme of [colorTheme, new Theme({ color: false, unicode: false, width: 60 })]) {
      const text = stripAnsi(renderAnsi(sample, theme))
      expect(text).toContain('Tydzień 3/17')
      expect(text).toContain('VDOT')
      expect(text).toContain('interwały 5x1 km')
      expect(text).toContain('objętość poniżej rekomendacji')
    }
  })

  it('nie przekracza szerokości terminala (poza długimi tokenami)', () => {
    const narrow = new Theme({ color: false, unicode: true, width: 48 })
    const out = renderAnsi(
      [b.text('Bardzo długi opis treningu, który musi zostać zawinięty do wąskiego terminala bez rozjeżdżania układu.')],
      narrow,
    )
    for (const line of out.split('\n')) {
      expect(visibleLength(line)).toBeLessThanOrEqual(48)
    }
  })
})

describe('render plain (to widzi agent przez MCP)', () => {
  it('nigdy nie zawiera sekwencji ANSI', () => {
    expect(renderPlain(sample)).not.toContain('[')
  })

  it('zachowuje treść i strukturę w czytelnej formie', () => {
    const text = renderPlain(sample)
    expect(text).toContain('Tydzień 3/17')
    expect(text).toContain('VDOT: 51')
    expect(text).toContain('Treningi:')
    expect(text).toContain('WT | 12 | interwały 5x1 km')
    expect(text).toContain('! objętość poniżej rekomendacji')
  })

  it('nie zostawia potrójnych pustych linii', () => {
    const text = renderPlain([b.blank(), b.blank(), b.text('x'), b.blank(), b.blank(), b.text('y')])
    expect(text).not.toMatch(/\n{3,}/)
  })
})

describe('zawijanie tekstu', () => {
  it('łamie po słowach i respektuje szerokość', () => {
    const lines = wrap('jeden dwa trzy cztery pięć sześć', 12)
    for (const l of lines) expect(l.length).toBeLessThanOrEqual(12)
    expect(lines.join(' ')).toBe('jeden dwa trzy cztery pięć sześć')
  })
})

describe('kreator init — parsery', () => {
  it('dystanse skrótami i liczbą', () => {
    expect(parseDistanceInput('hm')).toBeCloseTo(21.0975)
    expect(parseDistanceInput('m')).toBeCloseTo(42.195)
    expect(parseDistanceInput('10')).toBe(10)
    expect(parseDistanceInput('7,5')).toBe(7.5)
    expect(() => parseDistanceInput('maraton')).toThrow()
  })

  it('czas MM:SS i HH:MM:SS', () => {
    expect(parseTimeInput('40:00')).toBe(2400)
    expect(parseTimeInput('3:25:12')).toBe(12312)
    expect(() => parseTimeInput('40')).toThrow()
  })

  it('dni tygodnia po polsku, z deduplikacją', () => {
    expect(parseDaysInput('wt śr cz sb nd')).toEqual(['tue', 'wed', 'thu', 'sat', 'sun'])
    expect(parseDaysInput('wt, wt, pn')).toEqual(['tue', 'mon'])
    expect(() => parseDaysInput('poniedzialek')).toThrow()
  })

  it('generuje YAML, który parser konfiguracji przyjmie', () => {
    const yaml = toYaml({
      goalName: 'Maraton Warszawski',
      goalDate: '2026-11-29',
      goalDistanceKm: 42.195,
      targetTimeSec: 12300,
      recentWeeklyKm: 60,
      peakWeeklyKm: 80,
      daysAvailable: ['tue', 'wed', 'thu', 'sat', 'sun'],
      resultDate: '2026-03-30',
      resultDistanceKm: 21.0975,
      resultTimeSec: 5340,
      desk: { workStart: '09:00', workEnd: '17:30' },
    })
    expect(yaml).toContain('daysAvailable: [tue, wed, thu, sat, sun]')
    expect(yaml).toContain('targetTimeSec: 12300')
    expect(yaml).toContain('- { date: "2026-03-30", distanceKm: 21.0975, timeSec: 5340 }')
    expect(yaml).toContain('workStart: "09:00"')
  })

  it('bez wyniku startu zostawia czytelną podpowiedź zamiast pustej listy', () => {
    const yaml = toYaml({
      goalName: 'Bieg',
      goalDate: '2026-11-29',
      goalDistanceKm: 10,
      recentWeeklyKm: 30,
      daysAvailable: ['tue', 'thu'],
    })
    expect(yaml).toContain('kalibrujemy strefy')
  })
})
