/**
 * Opisy jednostek po angielsku. Sprawdzamy nie „czy przetłumaczone", tylko czy
 * brzmią jak zapis prawdziwego anglojęzycznego planu, a nie kalka z polskiego.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { AthleteProfile, WeekSkeleton } from '../domain/types.ts'
import { setLocale } from '../i18n/index.ts'
import { paceZones } from '../zones/daniels.ts'
import { generateMicrocycle } from './microcycle.ts'

const zones = paceZones(51)
const athlete: AthleteProfile = {
  recentWeeklyKm: 55,
  daysAvailable: ['tue', 'wed', 'thu', 'sat', 'sun'],
  results: [],
}

function skeleton(over: Partial<WeekSkeleton> = {}): WeekSkeleton {
  return {
    weekStart: '2026-08-03',
    index: 4,
    phase: 'build',
    intensityModel: 'pyramidal',
    targetKm: 60,
    deload: false,
    keepIntensity: false,
    keepFrequency: false,
    qualitySessions: 2,
    flags: [],
    ruleRefs: [],
    ...over,
  }
}

beforeAll(() => setLocale('en'))
afterAll(() => setLocale('en'))

const week = () => generateMicrocycle({ skeleton: skeleton(), athlete, zones })
const allText = () =>
  week()
    .days.flatMap((d) => d.workout?.segments.map((s) => s.description) ?? [])
    .join('\n')

describe('angielskie opisy jednostek', () => {
  it('nie zostawiają ani jednego polskiego znaku', () => {
    expect(allText()).not.toMatch(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/)
  })

  it('używają idiomu biegowego, nie tłumaczenia słowo w słowo', () => {
    const text = allText()
    expect(text).toMatch(/warm-up/)
    expect(text).toMatch(/cool-down jog to finish/)
    expect(text).toMatch(/easy\./)
    // „×" i „@" to zapis, którego używają anglojęzyczne plany
    expect(text).toMatch(/\d+ × \d+ (km|m) @ \d+:\d\d\/km/)
    expect(text).toMatch(/recovery/)
    // kalka z polskiego brzmiałaby tak:
    expect(text).not.toMatch(/in the pace of|breaks? \d+ minute|at the end of the training/i)
  })

  it('liczby po angielsku mają kropkę dziesiętną', () => {
    expect(allText()).not.toMatch(/\d,\d/)
  })

  it('rozgrzewka i schłodzenie bez odmiany przez liczebnik', () => {
    const text = allText()
    expect(text).toMatch(/3 km warm-up/)
    expect(text).toMatch(/1 km cool-down/)
  })
})

describe('ten sam plan, dwa języki', () => {
  it('struktura treningowa jest identyczna — różni się tylko tekst', () => {
    const en = week()
    setLocale('pl')
    const pl = week()
    setLocale('en')

    expect(pl.totalKm).toBe(en.totalKm)
    expect(pl.days.map((d) => d.workout?.kind)).toEqual(en.days.map((d) => d.workout?.kind))
    expect(pl.days.map((d) => d.workout?.distanceKm)).toEqual(
      en.days.map((d) => d.workout?.distanceKm),
    )
    // tempa i powtórzenia to dane, nie tekst — muszą być bit w bit te same
    const shape = (w: typeof en) =>
      w.days.flatMap((d) => d.workout?.segments.map((s) => [s.type, s.reps, s.repM, s.pace]) ?? [])
    expect(shape(pl)).toEqual(shape(en))
  })

  it('polski zachowuje głos trenera z korpusu', () => {
    setLocale('pl')
    const text = week()
      .days.flatMap((d) => d.workout?.segments.map((s) => s.description) ?? [])
      .join('\n')
    setLocale('en')
    expect(text).toMatch(/w tempie spokojnym/)
    expect(text).toMatch(/truchtu/)
    expect(text).toMatch(/kilometr(y|ów)?/)
  })
})
