import { describe, expect, it } from 'vitest'
import { b, renderAnsi, renderPlain, wrap } from './blocks.ts'
import { detectCapabilities, Theme, stripAnsi, visibleLength } from './theme.ts'
import { helpItem } from './help.ts'

describe('responsive terminal layout', () => {
  const id = 'c-94935ff6-2026-11-02-swim-1'
  const blocks = [
    b.title('Tydzień biegania, roweru i pływania', '2026-11-02 – 2026-11-08'),
    b.kv([['Z przygotowaniem i przejściami', '330 min'], ['Plan', 'Długi opis celu rozłożony na kilka wierszy']]),
    b.panel('2026-11-02 06:00 · Pływanie', ['Spokojna wytrzymałość · 40 min', 'Rozgrzewka\n6 × 100 m @ 120 s/100 m'], 'swim', [`ID: ${id}`]),
    b.table(['Sport', 'Czas', 'Dystans', 'Intensywność'], [
      ['Bieganie', '90 min', '12000 m', 'Spokojnie 100%'],
      ['Pływanie', '90 min', '3000 m', 'Spokojnie 55.6% · Technika 44.4%'],
    ], ['run', 'swim']),
    b.table(['ID', 'Planowany sport', 'Wykonany sport', 'Data', 'Status', 'RPE', 'Notatka'], [
      [id, 'Pływanie', 'Rower', '2026-11-02', 'Zmieniony', '4', 'Zmiana sportu po zamknięciu basenu'],
    ]),
    b.success('Zapisano wynik treningu.'),
    b.hint(`trainctl today --session ${id}`),
  ]

  it.each([24, 40, 60, 80, 120])('fits %i columns without hiding training data', width => {
    const output = stripAnsi(renderAnsi(blocks, new Theme({ color: true, unicode: true, width })))
    for (const line of output.split('\n')) expect(visibleLength(line), line).toBeLessThanOrEqual(width)
    // Long IDs may wrap, but remain complete; no ellipsis or omitted column.
    const joined = output.replace(/\s/g, '')
    for (const value of [id, 'Wykonany sport', 'Zmieniony', '44.4%', '3000 m', 'zamknięciu basenu']) {
      expect(joined).toContain(value.replace(/\s/g, ''))
    }
  })

  it('plain output keeps table headings, full IDs and no terminal escapes', () => {
    const text = renderPlain(blocks)
    expect(text).toContain('Sport | Czas | Dystans | Intensywność')
    expect(text).toContain(`ID: ${id}`)
    expect(text).toContain(`trainctl today --session ${id}`)
    expect(text).not.toContain('\x1b')
  })

  it('retains explicit line breaks and handles graphemes at terminal cell width', () => {
    expect(wrap('Pierwszy krok\n\nDrugi krok', 40)).toEqual(['Pierwszy krok', '', 'Drugi krok'])
    expect(visibleLength('zażółć')).toBe(6)
    expect(visibleLength('e\u0301')).toBe(1)
    expect(visibleLength('東京')).toBe(4)
    expect(visibleLength('🏊‍♀️')).toBe(2)
    expect(wrap('東京東京 e\u0301e\u0301e\u0301', 4)).toEqual(['東京', '東京', 'e\u0301e\u0301e\u0301'])
  })

  it('uses readable ASCII structure when Unicode is unavailable', () => {
    const text = renderAnsi([b.panel('Bike', ['40 min'], 'bike'), b.success('Saved')], new Theme({color:false,unicode:false,width:40}))
    expect(text).toContain('OK Saved')
    expect(text).not.toMatch(/[╭╰│─✓]/)
  })

  it('stacks help options in a narrow terminal and keeps descriptions intact', () => {
    const text = helpItem('--color <mode>', 22, 'Kolory wyjścia: auto, always albo never.', new Theme({color:true,unicode:true,width:32}))
    for (const line of text.split('\n')) expect(visibleLength(line)).toBeLessThanOrEqual(32)
    expect(stripAnsi(text).replace(/\s+/g,' ')).toContain('Kolory wyjścia: auto, always albo never.')
  })
})

describe('colour preferences and output width', () => {
  it('respects NO_COLOR, explicit flags and dumb terminals', () => {
    expect(detectCapabilities({isTTY:true}, {NO_COLOR:'1', FORCE_COLOR:'1'}).color).toBe(false)
    expect(detectCapabilities({isTTY:true}, {NO_COLOR:''}).color).toBe(true)
    expect(detectCapabilities({isTTY:true}, {TERM:'dumb'}).color).toBe(false)
    expect(detectCapabilities({isTTY:true}, {FORCE_COLOR:'0'}).color).toBe(false)
    expect(detectCapabilities({isTTY:false}, {NO_COLOR:'1'}, 'always').color).toBe(true)
    expect(detectCapabilities({isTTY:true}, {FORCE_COLOR:'1'}, 'never').color).toBe(false)
  })

  it('takes actual terminal width before COLUMNS, with a safe fallback', () => {
    expect(detectCapabilities({columns:48}, {COLUMNS:'90'}).width).toBe(48)
    expect(detectCapabilities({}, {COLUMNS:'60'}).width).toBe(60)
    for (const value of ['', '0', '-10', 'invalid', 'Infinity']) expect(detectCapabilities({}, {COLUMNS:value}).width).toBe(80)
  })
})
