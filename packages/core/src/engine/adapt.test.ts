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

  const layoff = () => history(21, 1).map((e) => (e.date > '2026-08-16' ? omitActual(e) : e))
  it('B11: rano po przerwie dzisiejsza sesja bez wpisu nie robi z danych niepełnych — powrót zostaje', () => {
    const today: ExecutionRecord = { date: TODAY, plannedKm: 12, status: 'unknown', kind: 'easy' }
    const p = analyzeExecution({ today: TODAY, execution: [...layoff(), today], currentWeeklyKm: 60, breakLog: [{ date: '2026-08-20', reason: 'illness' }] })
    expect(p.dataStatus).toBe('complete')
    expect(p.actions.find((a) => a.type === 'conservative-restart')?.ruleRefs).toEqual(['R-5', 'P-3'])
  })
  it('B11: przerwa zakończona jednym biegiem w ostatnim tygodniu nadal daje blok powrotu (R-5)', () => {
    // choroba 2026-08-17…08-29, pierwszy bieg po niej 2026-08-30
    const back = layoff().map((e) => (e.date === '2026-08-30' ? { ...e, actualKm: 5, status: 'done' as const } : e))
    const breakLog = ['2026-08-17', '2026-08-20', '2026-08-25', '2026-08-29'].map((date) => ({ date, reason: 'illness' as const }))
    const p = analyzeExecution({ today: TODAY, execution: back, currentWeeklyKm: 60, breakLog })
    expect(p.layoff).toMatchObject({ days: 14, reason: 'illness' })
    expect(p.actions.find((a) => a.type === 'conservative-restart')?.ruleRefs).toEqual(['R-5', 'P-3'])
    // po tygodniu biegania powrót już się nie proponuje
    const later = analyzeExecution({ today: '2026-09-07', execution: [...back, ...history(8, 1, { from: '2026-09-07' }).filter((e) => e.date > '2026-08-30')], currentWeeklyKm: 60, breakLog })
    expect(later.actions.some((a) => a.type === 'conservative-restart')).toBe(false)
  })
  it('B11: przerwa zakończona przy trwającym bloku powrotu nie daje drugiego restartu', () => {
    const back = layoff().map((e) => (e.date === '2026-08-30' ? { ...e, actualKm: 5, status: 'done' as const } : e))
    const p = analyzeExecution({ today: TODAY, execution: back, currentWeeklyKm: 33, returnInProgress: true, breakLog: [{ date: '2026-08-20', reason: 'illness' }] })
    expect(p.actions.some((a) => a.type === 'conservative-restart')).toBe(false)
  })
  it('B11: dzień przerwy z biegiem (wyjazd z góry, a biegacz pobiegł) liczy się do zgodności', () => {
    // cztery dni wyjazdu, w które biegacz przebiegł po 30 km zamiast 12
    const trip = ['2026-08-25', '2026-08-26', '2026-08-27', '2026-08-29']
    const exec = history(21, 1).map((e) => (trip.includes(e.date) ? { ...e, actualKm: 30 } : e))
    const p = analyzeExecution({ today: TODAY, execution: exec, currentWeeklyKm: 60, breakLog: trip.map((date) => ({ date, reason: 'travel' as const })) })
    expect(p.complianceKm).toBeGreaterThan(1.2)
  })
  it('B11: przerwa zapisana z góry bez przyczyny też przesuwa koniec przerwy', () => {
    const p = analyzeExecution({ today: TODAY, execution: layoff(), currentWeeklyKm: 60, breakLog: [{ date: '2026-08-20', reason: 'illness' }], skippedAhead: ['2026-09-01', '2026-09-02'] })
    expect(p.layoff?.until).toBe('2026-09-02')
  })
  it('B11: przerwa zapisana także na kolejne dni — powrót po jej końcu', () => {
    const ahead = ['2026-09-01', '2026-09-02', '2026-09-03'].map((date) => ({ date, reason: 'illness' as const }))
    const p = analyzeExecution({ today: TODAY, execution: layoff(), currentWeeklyKm: 60, breakLog: [{ date: '2026-08-20', reason: 'illness' }, ...ahead, { date: '2026-09-20', reason: 'travel' }] })
    // wyjazd za trzy tygodnie to inna przerwa — nie przedłuża tej
    expect(p.layoff?.until).toBe('2026-09-03')
  })
  it('B11: przerwa bez przyczyny → blok powrotu R-11 do przyjęcia, z objętością sprzed przerwy', () => {
    const restart = analyzeExecution({ today: TODAY, execution: layoff(), currentWeeklyKm: 60 }).actions.find((a) => a.type === 'conservative-restart')!
    expect(restart.ruleRefs).toEqual(['R-11', 'P-3'])
    expect(restart.returnBlock).toEqual({ previousWeeklyKm: 60, illness: false })
  })
  it('B11: choroba → powrót według R-5, pierwszy tydzień spokojnie', () => {
    const restart = analyzeExecution({ today: TODAY, execution: layoff(), currentWeeklyKm: 60, breakLog: [{ date: '2026-08-20', reason: 'illness' }] }).actions.find((a) => a.type === 'conservative-restart')!
    expect(restart.ruleRefs).toEqual(['R-5', 'P-3'])
    expect(restart.returnBlock).toEqual({ previousWeeklyKm: 60, illness: true })
    expect(restart.detail).toContain('co najmniej 7 dni wyłącznie spokojnie')
  })
  it('B11: tekst propozycji po innej przerwie mówi o spokojnym bloku, tak jak blok, który się przyjmie (R-11)', () => {
    const restart = analyzeExecution({ today: TODAY, execution: layoff(), currentWeeklyKm: 60 }).actions.find((a) => a.type === 'conservative-restart')!
    expect(restart.detail).toContain('pierwszy blok do najbliższego odciążenia wyłącznie spokojnie (R-11)')
    expect(restart.detail).not.toContain('5–7 dni')
  })
  it('B11: choroba i kontuzja w tej samej przerwie — decyduje kontuzja (R-6, R-7)', () => {
    const p = analyzeExecution({ today: TODAY, execution: layoff(), currentWeeklyKm: 60, breakLog: [{ date: '2026-08-20', reason: 'injury' }, { date: '2026-08-24', reason: 'illness' }] })
    expect(p.layoff?.reason).toBe('injury')
    expect(p.actions.some((a) => a.type === 'conservative-restart')).toBe(false)
  })
  it('B11: kontuzja przy przerwie krótszej niż 10 dni też bez propozycji objętości (R-6, R-7)', () => {
    // bieganie do 2026-08-25, potem 6 dni przerwy z kontuzją i niska zgodność w oknie
    const short = history(21, 0.5).map((e) => (e.date > '2026-08-25' ? omitActual(e) : e))
    const p = analyzeExecution({ today: TODAY, execution: short, currentWeeklyKm: 60, breakLog: [{ date: '2026-08-27', reason: 'injury' }] })
    expect(p.layoff?.reason).toBe('injury')
    expect(p.actions.some((a) => a.suggestedWeeklyKm !== undefined)).toBe(false)
    expect(p.warnings.join(' ')).toMatch(/specjalist.*R-6, R-7/)
  })
  it('B11: kontuzja → bez propozycji objętości, powrót ustala specjalista (R-6, R-7)', () => {
    const p = analyzeExecution({ today: TODAY, execution: layoff(), currentWeeklyKm: 60, breakLog: [{ date: '2026-08-20', reason: 'injury' }] })
    expect(p.actions.some((a) => a.type === 'conservative-restart' || a.suggestedWeeklyKm !== undefined)).toBe(false)
    expect(p.warnings.join(' ')).toMatch(/specjalist.*R-6, R-7/)
  })
  it('B11: o przerwie mówi wpis po ostatnim biegu — wcześniejsza kontuzja, po której biegacz biegał, nie', () => {
    // bieganie do 2026-08-16, potem przerwa bez przyczyny; kontuzja zapisana 2026-08-13
    const old = analyzeExecution({ today: TODAY, execution: layoff(), currentWeeklyKm: 60, breakLog: [{ date: '2026-08-13', reason: 'injury' }] })
    expect(old.actions.find((a) => a.type === 'conservative-restart')?.ruleRefs).toEqual(['R-11', 'P-3'])
    const current = analyzeExecution({ today: TODAY, execution: layoff(), currentWeeklyKm: 60, breakLog: [{ date: '2026-08-13', reason: 'travel' }, { date: '2026-08-20', reason: 'injury' }] })
    expect(current.actions.some((a) => a.type === 'conservative-restart')).toBe(false)
  })
  it('B11: kontuzja z początku przerwy dłuższej niż okno nadal decyduje (R-6, R-7)', () => {
    // bieganie do 2026-08-06, potem 25 dni przerwy; kontuzja zapisana przed oknem analizy
    const long = history(30, 1).map((e) => (e.date > '2026-08-06' ? omitActual(e) : e))
    const injuryBefore = ['2026-08-07', '2026-08-08', '2026-08-09', '2026-08-10'].map((date) => ({ date, reason: 'injury' as const }))
    const p = analyzeExecution({ today: TODAY, execution: long, currentWeeklyKm: 60, breakLog: injuryBefore })
    expect(p.layoff?.reason).toBe('injury')
    expect(p.actions.some((a) => a.type === 'conservative-restart')).toBe(false)
  })
  it('B11: krótka przerwa z przyczyną (choroba 6 dni) nie obniża bazy przez zgodność (R-5)', () => {
    // plan wykonany w całości poza sześcioma dniami choroby zapisanymi z przyczyną
    const sick = ['2026-08-18', '2026-08-19', '2026-08-20', '2026-08-21', '2026-08-22', '2026-08-23']
    const exec = history(21, 1).map((e) => (sick.includes(e.date) ? omitActual(e) : e))
    const breakLog = sick.map((date) => ({ date, reason: 'illness' as const }))
    const p = analyzeExecution({ today: TODAY, execution: exec, currentWeeklyKm: 60, breakLog })
    expect(p.actions.map((a) => a.type)).not.toContain('reduce-volume')
    expect(p.actions.map((a) => a.type)).toContain('hold-course')
    // te same dni bez przyczyny to nadal niezgodność, która obniża bazę
    const unexplained = analyzeExecution({ today: TODAY, execution: exec, currentWeeklyKm: 60 })
    expect(unexplained.actions.map((a) => a.type)).toContain('reduce-volume')
  })
  it('B11: kontuzja zapisana w dniu ostatniego biegu (bieg z synchronizacji) zaczyna przerwę (R-6, R-7)', () => {
    // ostatni bieg 2026-08-16, kontuzja tego samego dnia, potem 15 dni bez biegania
    const injured = history(30, 1).map((e) => (e.date > '2026-08-16' ? omitActual(e) : e))
    const p = analyzeExecution({ today: TODAY, execution: injured, currentWeeklyKm: 60, breakLog: [{ date: '2026-08-16', reason: 'injury' }] })
    expect(p.layoff?.reason).toBe('injury')
    expect(p.actions.some((a) => a.suggestedWeeklyKm !== undefined)).toBe(false)
  })
  it('B11: kontuzja, a potem wyjazd w tej samej przerwie — decyduje kontuzja', () => {
    const p = analyzeExecution({ today: TODAY, execution: layoff(), currentWeeklyKm: 60, breakLog: [{ date: '2026-08-20', reason: 'injury' }, { date: '2026-08-25', reason: 'travel' }] })
    expect(p.layoff?.reason).toBe('injury')
    expect(p.actions.some((a) => a.type === 'conservative-restart')).toBe(false)
  })
  it('B11: blok powrotu liczy się od objętości sprzed przerwy, nie od bieżącego tygodnia (odciążenie)', () => {
    const restart = analyzeExecution({ today: TODAY, execution: layoff(), currentWeeklyKm: 42, preBreakWeeklyKm: 60 }).actions.find((a) => a.type === 'conservative-restart')!
    expect(restart.returnBlock).toEqual({ previousWeeklyKm: 60, illness: false })
    expect(restart.suggestedWeeklyKm).toBe(33)
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
    expect(p.warnings.some((w) => w.includes('trainctl shift'))).toBe(true)
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
    expect(p.actions).toEqual([])
    expect(p.dataStatus).toBe('empty')
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
