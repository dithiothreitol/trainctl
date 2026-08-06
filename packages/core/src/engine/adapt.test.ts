import { describe, expect, it } from 'vitest'
import { setLocale } from '../i18n/index.ts'
import { analyzeExecution, type ExecutionRecord } from './adapt.ts'

// Testy sprawdzają SENS propozycji; komunikaty czytamy po polsku dla
// czytelności asercji (kompletność tłumaczeń pilnuje i18n/i18n.test.ts).
setLocale('pl')

const TODAY = '2026-08-31'

/** Dzień bez wykonania — usuwa actualKm zamiast ustawiać undefined. */
function omitActual(e: ExecutionRecord): ExecutionRecord {
  const { actualKm, ...rest } = e
  void actualKm
  return { ...rest, status: 'missed' }
}

/** Generator wykonania: n dni wstecz, z zadanym stopniem realizacji. */
function history(days: number, ratio: number, opts: { from?: string } = {}): ExecutionRecord[] {
  const end = Date.parse(opts.from ?? TODAY)
  const out: ExecutionRecord[] = []
  for (let i = days; i > 0; i--) {
    const date = new Date(end - i * 86_400_000).toISOString().slice(0, 10)
    const dow = new Date(date).getUTCDay()
    if (dow === 1 || dow === 5) {
      out.push({ date, plannedKm: 0, status: 'rest' })
      continue
    }
    const plannedKm = 12
    const actualKm = plannedKm * ratio
    out.push({
      date,
      plannedKm,
      ...(actualKm > 0 ? { actualKm } : {}),
      status: actualKm > 0 ? 'done' : 'missed',
      kind: dow === 2 ? 'quality_intervals' : 'easy',
    })
  }
  return out
}

describe('zgodność objętości', () => {
  it('wykonanie zgodne → trzymamy kurs', () => {
    const p = analyzeExecution({ today: TODAY, execution: history(21, 1), currentWeeklyKm: 60 })
    expect(p.actions.map((a) => a.type)).toContain('hold-course')
    expect(p.complianceKm).toBeCloseTo(1, 1)
  })

  it('poniżej 70% → urealnienie bazy, nie nadrabianie', () => {
    const p = analyzeExecution({ today: TODAY, execution: history(21, 0.5), currentWeeklyKm: 60 })
    const action = p.actions.find((a) => a.type === 'reduce-volume')!
    expect(action).toBeDefined()
    expect(action.suggestedWeeklyKm).toBeLessThan(60)
    expect(action.detail).toContain('Plan wykonywany w 100%')
    expect(action.ruleRefs).toContain('P-3')
  })

  it('regularne przekraczanie → podniesienie bazy z limitem 10%', () => {
    const p = analyzeExecution({ today: TODAY, execution: history(21, 1.3), currentWeeklyKm: 60 })
    const action = p.actions.find((a) => a.type === 'raise-baseline')!
    expect(action.suggestedWeeklyKm).toBe(66)
  })
})

describe('przerwa w treningu', () => {
  it('≥10 dni bez biegania → konserwatywny restart z ostrzeżeniem o braku źródła', () => {
    const old = history(21, 1).map((e) =>
      e.date > '2026-08-16' ? omitActual(e) : e,
    )
    const p = analyzeExecution({ today: TODAY, execution: old, currentWeeklyKm: 60 })
    const restart = p.actions.find((a) => a.type === 'conservative-restart')!
    expect(restart.suggestedWeeklyKm).toBe(33)
    expect(restart.detail).toContain('Nie nadrabiamy')
    expect(p.warnings.some((w) => w.includes('ekstrapolacja'))).toBe(true)
    // po przerwie nie doradzamy jednocześnie redukcji objętości z innego tytułu
    expect(p.actions.some((a) => a.type === 'reduce-volume')).toBe(false)
  })
})

describe('protokół po starcie', () => {
  it('maraton, 1 dzień po: 48 h ciszy i powrót co drugi dzień (R-1/R-2)', () => {
    const p = analyzeExecution({
      today: TODAY,
      execution: history(21, 1),
      currentWeeklyKm: 60,
      lastRace: { date: '2026-08-30', distanceKm: 42.195 },
    })
    const rec = p.actions.find((a) => a.type === 'post-race-recovery')!
    expect(rec.detail).toContain('48 h')
    expect(rec.ruleRefs).toEqual(['R-1', 'R-2'])
  })

  it('ultra: brak protokołu, jawne ostrzeżenie zamiast ekstrapolacji (R-3)', () => {
    const p = analyzeExecution({
      today: TODAY,
      execution: history(21, 1),
      currentWeeklyKm: 60,
      lastRace: { date: '2026-08-29', distanceKm: 100 },
    })
    const rec = p.actions.find((a) => a.type === 'post-race-recovery')!
    expect(rec.ruleRefs).toEqual(['R-3'])
    expect(p.warnings.some((w) => w.includes('NIE ekstrapolujemy'))).toBe(true)
  })

  it('start dawno temu → brak protokołu powrotu', () => {
    const p = analyzeExecution({
      today: TODAY,
      execution: history(21, 1),
      currentWeeklyKm: 60,
      lastRace: { date: '2026-07-01', distanceKm: 42.195 },
    })
    expect(p.actions.some((a) => a.type === 'post-race-recovery')).toBe(false)
  })
})

describe('rekalibracja i akcenty', () => {
  it('nowy wynik → rekalibracja stref z wyniku, nie z zegarka', () => {
    const p = analyzeExecution({
      today: TODAY,
      execution: history(21, 1),
      currentWeeklyKm: 60,
      newResults: [{ date: '2026-08-23', distanceKm: 10, timeSec: 2400 }],
    })
    const a = p.actions.find((x) => x.type === 'recalibrate-zones')!
    expect(a.ruleRefs).toContain('Z-6')
    expect(a.detail).toContain('nie z odczytów zegarka')
  })

  it('pominięte akcenty są sygnalizowane osobno od kilometrów', () => {
    const exec = history(21, 1).map((e) =>
      e.kind === 'quality_intervals' ? omitActual(e) : e,
    )
    const p = analyzeExecution({ today: TODAY, execution: exec, currentWeeklyKm: 60 })
    expect(p.diagnosis.some((d) => d.includes('Pominięte akcenty'))).toBe(true)
    expect(p.warnings.some((w) => w.includes('tren shift'))).toBe(true)
  })

  it('nigdy nie używa ACWR ani języka ryzyka urazu (P-4)', () => {
    const p = analyzeExecution({ today: TODAY, execution: history(21, 0.4), currentWeeklyKm: 60 })
    const text = JSON.stringify(p).toLowerCase()
    expect(text).not.toContain('acwr')
    expect(text).not.toContain('ryzyko urazu')
  })
})

describe('przypadki brzegowe', () => {
  it('pusta historia nie wywraca analizy', () => {
    const p = analyzeExecution({ today: TODAY, execution: [], currentWeeklyKm: 50 })
    expect(p.actions.some((a) => a.type === 'conservative-restart')).toBe(true)
  })

  it('same dni wolne (tydzień odciążenia) → brak fałszywej diagnozy niedowykonania', () => {
    const rest: ExecutionRecord[] = history(21, 1).map((e) => ({
      date: e.date,
      plannedKm: 0,
      status: 'rest',
    }))
    const p = analyzeExecution({ today: TODAY, execution: rest, currentWeeklyKm: 60 })
    expect(p.actions.some((a) => a.type === 'reduce-volume')).toBe(false)
  })
})
