/** Moduł siły: F-1…F-4, F-13 oraz ochrona jakości biegania (S-5). */
import { describe, expect, it } from 'vitest'
import type { AthleteProfile, MacroPhase, WeekSkeleton } from '../domain/types.ts'
import { paceZones } from '../zones/daniels.ts'
import { generateMicrocycle } from './microcycle.ts'
import { planStrengthWeek, strengthSession } from './strength.ts'

const zones = paceZones(50)
const athlete: AthleteProfile = {
  recentWeeklyKm: 55,
  daysAvailable: ['tue', 'wed', 'thu', 'sat', 'sun'],
  results: [],
}

function week(phase: MacroPhase = 'build', deload = false) {
  const skeleton: WeekSkeleton = {
    weekStart: '2026-08-03',
    index: 3,
    phase,
    intensityModel: 'pyramidal',
    targetKm: 60,
    deload,
    keepIntensity: phase === 'taper',
    keepFrequency: phase === 'taper',
    qualitySessions: 2,
    flags: [],
    ruleRefs: [],
  }
  return generateMicrocycle({ skeleton, athlete, zones })
}

const dates = (a: ReturnType<typeof planStrengthWeek>) => [...a.byDate.keys()].sort()

describe('dawka (F-1/F-12)', () => {
  it('2 sesje w tygodniu ładowania', () => {
    expect(dates(planStrengthWeek({ week: week(), phase: 'build', deload: false }))).toHaveLength(2)
  })

  it('1 sesja w tygodniu odciążeniowym', () => {
    expect(dates(planStrengthWeek({ week: week('build', true), phase: 'build', deload: true }))).toHaveLength(1)
  })

  it('sesja opisuje ciężką pracę wielostawową, nie „obwód na macie"', () => {
    const s = strengthSession()
    expect(s.description).toMatch(/80% 1RM/)
    expect(s.description).toMatch(/przysiad|martwy/)
    expect(s.ruleRefs).toContain('F-4')
  })

  it('każdy dzień dostaje WŁASNY obiekt sesji (plan-as-code: bez aliasów YAML)', () => {
    const a = planStrengthWeek({ week: week(), phase: 'build', deload: false })
    const sessions = [...a.byDate.values()]
    expect(sessions.length).toBeGreaterThanOrEqual(2)
    expect(sessions[0]).not.toBe(sessions[1]) // różne referencje
    sessions[0]!.durationMin = 99
    expect(sessions[1]!.durationMin).toBe(35) // edycja jednego dnia nie zmienia reszty
  })

  it('odstęp 48 h obowiązuje też przez granicę tygodnia', () => {
    const w = week()
    const sunday = w.days.at(-1)!.date
    const a = planStrengthWeek({
      week: w,
      phase: 'build',
      deload: false,
      lastSessionDate: sunday, // „ostatnia sesja poprzedniego tygodnia"
    })
    for (const date of dates(a)) {
      expect(Math.abs(Date.parse(date) - Date.parse(sunday)) / 86_400_000).toBeGreaterThanOrEqual(2)
    }
  })
})

describe('taper (F-13)', () => {
  for (const phase of ['taper', 'race'] as MacroPhase[]) {
    it(`faza ${phase}: zero siły, z wyjaśnieniem`, () => {
      const a = planStrengthWeek({ week: week(phase), phase, deload: false })
      expect(a.byDate.size).toBe(0)
      expect(a.notes.join(' ')).toContain('F-13')
    })
  }
})

describe('ochrona jakości biegania (S-5)', () => {
  const w = week()
  const a = planStrengthWeek({ week: w, phase: 'build', deload: false })
  const kindOn = (date: string) => w.days.find((d) => d.date === date)?.workout?.kind

  it('nigdy w dniu akcentu, długiego, podbiegów ani startu', () => {
    for (const date of dates(a)) {
      expect([
        'quality_intervals', 'quality_continuous', 'long', 'easy_hills', 'race', 'test',
      ]).not.toContain(kindOn(date))
    }
  })

  it('nigdy dzień przed akcentem (S-5), ale dzień przed długim wolno', () => {
    for (const date of dates(a)) {
      const next = new Date(Date.parse(date) + 86_400_000).toISOString().slice(0, 10)
      expect(['quality_intervals', 'quality_continuous', 'race', 'test']).not.toContain(kindOn(next))
    }
    // piątek przed sobotnim długim ma być dozwolony — inaczej moduł nie ma gdzie usiąść
    const beforeLong = dates(a).some((date) => {
      const next = new Date(Date.parse(date) + 86_400_000).toISOString().slice(0, 10)
      return kindOn(next) === 'long'
    })
    expect(beforeLong).toBe(true)
  })

  it('≥48 h między sesjami siły', () => {
    const d = dates(a).map((x) => Date.parse(x))
    for (let i = 1; i < d.length; i++) {
      expect((d[i]! - d[i - 1]!) / 86_400_000).toBeGreaterThanOrEqual(2)
    }
  })

  it('preferuje dni bez biegania', () => {
    const restDays = dates(a).filter((date) => !kindOn(date))
    expect(restDays.length).toBeGreaterThanOrEqual(1)
  })
})

describe('preferencje użytkownika i uczciwość', () => {
  it('respektuje wskazane dni', () => {
    const a = planStrengthWeek({
      week: week(),
      phase: 'build',
      deload: false,
      daysPreference: ['mon', 'fri'],
    })
    for (const date of dates(a)) {
      expect(['2026-08-03', '2026-08-07']).toContain(date)
    }
  })

  it('gdy winne są ZAWĘŻONE DNI, komunikat mówi o nich — nie zwala na akcenty', () => {
    const a = planStrengthWeek({
      week: week(),
      phase: 'build',
      deload: false,
      daysPreference: ['tue'], // jeden dzień, a potrzebne dwie sesje
    })
    expect(a.byDate.size).toBeLessThan(2)
    const note = a.notes.join(' ')
    expect(note).toContain('strength.days')
    expect(note).not.toContain('pierwszeństwo') // to byłaby zmyślona przyczyna
  })

  it('gdy winny jest ciasny tydzień biegowy, komunikat wskazuje akcenty', () => {
    // wszystkie dni dostępne → jedyną przyczyną braku miejsca mogą być akcenty
    const dense = week()
    for (const d of dense.days) {
      d.workout = { kind: 'quality_intervals', segments: [], distanceKm: 10, ruleRefs: [] }
    }
    const a = planStrengthWeek({ week: dense, phase: 'build', deload: false })
    expect(a.byDate.size).toBe(0)
    expect(a.notes.join(' ')).toContain('pierwszeństwo')
  })

  it('nie zmienia ani jednego kilometra planu biegowego', () => {
    const w = week()
    const before = JSON.stringify(w.days)
    planStrengthWeek({ week: w, phase: 'build', deload: false })
    expect(JSON.stringify(w.days)).toBe(before)
  })
})
