/** Testy trybów interaktywnych: czyste części + zachowanie poza TTY. */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { setLocale } from '@tren/core'
import { cmdPlan } from './commands.ts'
import { ui } from './i18n/index.ts'
import { dayChoices, runShiftPicker, runWeekBrowser } from './interactive.ts'
import { loadPlan } from './planfile.ts'
import { clampIndex, digitIndex, keyAction, moveIndex } from './ui/keys.ts'
import { renderChoices } from './ui/select.ts'
import { Theme } from './ui/theme.ts'

// Plan powstaje w ciele `describe`, więc język musi być ustawiony na poziomie
// modułu — `beforeAll` wykonuje się już po zbudowaniu list wyboru.
setLocale('pl')

const CONFIG = `athlete:
  recentWeeklyKm: 55
  daysAvailable: [tue, wed, thu, sat, sun]
  results:
    - { date: "2026-03-30", distanceKm: 21.0975, timeSec: 5400 }
goal:
  name: "Maraton testowy"
  date: "2026-11-29"
  distanceKm: 42.195
  priority: A
`

let dir: string
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'tren-int-'))
  writeFileSync(join(dir, 'tren.yaml'), CONFIG, 'utf-8')
  cmdPlan(dir, { date: '2026-08-05' })
})
afterAll(() => rmSync(dir, { recursive: true, force: true }))

describe('mapowanie klawiszy', () => {
  it('strzałki i vim dają te same akcje', () => {
    expect(keyAction({ name: 'up' })).toBe('up')
    expect(keyAction({ name: 'k' })).toBe('up')
    expect(keyAction({ name: 'down' })).toBe('down')
    expect(keyAction({ name: 'j' })).toBe('down')
    expect(keyAction({ name: 'left' })).toBe('prev')
    expect(keyAction({ name: 'right' })).toBe('next')
  })

  it('Enter/spacja zatwierdza, Esc/q anuluje, Ctrl+C przerywa', () => {
    expect(keyAction({ name: 'return' })).toBe('select')
    expect(keyAction({ name: 'space' })).toBe('select')
    expect(keyAction({ name: 'escape' })).toBe('cancel')
    expect(keyAction({ name: 'q' })).toBe('cancel')
    expect(keyAction({ name: 'c', ctrl: true })).toBe('cancel')
  })

  it('skróty przeglądarki: t (dziś), s (przesuń)', () => {
    expect(keyAction({ name: 't' })).toBe('today')
    expect(keyAction({ name: 's' })).toBe('shift')
  })

  it('nieznany klawisz nie wywołuje akcji', () => {
    expect(keyAction({ name: 'z' })).toBeUndefined()
  })
})

describe('nawigacja po liście', () => {
  const disabled = (i: number) => i === 2

  it('zawija się na końcach', () => {
    expect(moveIndex(0, -1, 5)).toBe(4)
    expect(moveIndex(4, 1, 5)).toBe(0)
  })

  it('pomija pozycje zablokowane (np. dzień startu)', () => {
    expect(moveIndex(1, 1, 5, disabled)).toBe(3)
    expect(moveIndex(3, -1, 5, disabled)).toBe(1)
  })

  it('gdy wszystko zablokowane — zostaje na miejscu', () => {
    expect(moveIndex(1, 1, 3, () => true)).toBe(1)
  })

  it('clampIndex nie wychodzi poza zakres (przeglądarka tygodni)', () => {
    expect(clampIndex(-1, 17)).toBe(0)
    expect(clampIndex(20, 17)).toBe(16)
    expect(clampIndex(5, 0)).toBe(0)
  })

  it('cyfry 1–9 wybierają pozycję, poza zakresem ignorowane', () => {
    expect(digitIndex({ sequence: '3' }, 5)).toBe(2)
    expect(digitIndex({ sequence: '9' }, 5)).toBeUndefined()
    expect(digitIndex({ sequence: 'a' }, 5)).toBeUndefined()
    expect(digitIndex({ sequence: '0' }, 5)).toBeUndefined()
  })
})

describe('lista dni do przesunięcia', () => {
  it('pokazuje wszystkie dni tygodnia z opisem i kilometrami', () => {
    const week = loadPlan(dir).weeks[0]!
    const choices = dayChoices(week)
    expect(choices).toHaveLength(7)
    expect(choices[0]!.label).toBe('PN 08-03')
    expect(choices[0]!.hint).toBe('wolne')
    const tuesday = choices[1]!
    expect(tuesday.value).toBe('2026-08-04')
    expect(tuesday.hint).toMatch(/km ·/)
  })

  it('opis jest skracany, żeby lista się nie rozjechała', () => {
    const week = loadPlan(dir).weeks[0]!
    for (const c of dayChoices(week)) expect(c.hint!.length).toBeLessThanOrEqual(60)
  })

  it('dzień startu jest zablokowany', () => {
    const plan = loadPlan(dir)
    const raceWeek = plan.weeks.at(-1)!
    const race = dayChoices(raceWeek).find((c) => c.value === plan.goal.date)!
    expect(race.disabled).toBe(true)
    expect(race.hint).toContain('nie do przesunięcia')
  })

  it('wykluczenie źródła nie pokazuje go jako celu', () => {
    const week = loadPlan(dir).weeks[0]!
    const choices = dayChoices(week, '2026-08-04')
    expect(choices).toHaveLength(6)
    expect(choices.some((c) => c.value === '2026-08-04')).toBe(false)
  })
})

describe('render listy wyboru', () => {
  const theme = new Theme({ color: false, unicode: true, width: 80 })
  const choices = [
    { label: 'WT 08-04', value: 'a', hint: 'interwały' },
    { label: 'ŚR 08-05', value: 'b', hint: 'spokojne' },
    { label: 'ND 08-09', value: 'c', hint: 'START', disabled: true },
  ]

  it('zaznacza aktywną pozycję i numeruje wszystkie', () => {
    const lines = renderChoices(choices, 1, theme)
    expect(lines[1]).toContain('→')
    expect(lines[0]).not.toContain('→')
    expect(lines[0]).toContain('1')
    expect(lines[2]).toContain('3')
  })

  it('pokazuje podpowiedzi obok etykiet', () => {
    expect(renderChoices(choices, 0, theme)[0]).toContain('interwały')
  })
})

describe('poza terminalem', () => {
  it('shift bez TTY tłumaczy, jak podać daty wprost', async () => {
    const r = await runShiftPicker(dir, '2026-08-05')
    expect(r.code).toBe(1)
    expect(r.output).toContain('--from')
    expect(r.output).toContain('--to')
  })

  it('przeglądarka tygodni bez TTY nie próbuje rysować', async () => {
    const r = await runWeekBrowser(dir, '2026-08-05')
    expect(r.code).toBe(1)
    expect(r.output).toContain('terminala')
  })

  it('brak planu — komunikat zamiast wyjątku', async () => {
    const empty = mkdtempSync(join(tmpdir(), 'tren-noplan-'))
    const r = await runShiftPicker(empty, '2026-08-05')
    expect(r.code).toBe(1)
    rmSync(empty, { recursive: true, force: true })
  })
})
