import { describe, expect, it } from 'vitest'
import { addDays, diffDays, mondayOf, parseIso, toIso } from './dates.ts'

describe('daty', () => {
  it('round-trip parse/format', () => {
    expect(toIso(parseIso('2026-08-05'))).toBe('2026-08-05')
  })

  it('addDays przez granice miesiąca i roku', () => {
    expect(addDays('2026-08-30', 3)).toBe('2026-09-02')
    expect(addDays('2025-12-29', 5)).toBe('2026-01-03')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('diffDays', () => {
    expect(diffDays('2026-08-05', '2026-08-05')).toBe(0)
    expect(diffDays('2026-08-05', '2026-09-05')).toBe(31)
    expect(diffDays('2026-09-05', '2026-08-05')).toBe(-31)
  })

  it('mondayOf dla każdego dnia tygodnia', () => {
    // 2026-08-03 to poniedziałek
    expect(mondayOf('2026-08-03')).toBe('2026-08-03')
    expect(mondayOf('2026-08-05')).toBe('2026-08-03')
    expect(mondayOf('2026-08-09')).toBe('2026-08-03') // niedziela → ten sam tydzień
    expect(mondayOf('2026-08-10')).toBe('2026-08-10')
  })

  it('odrzuca zły format', () => {
    expect(() => parseIso('05.08.2026')).toThrow()
  })
})
