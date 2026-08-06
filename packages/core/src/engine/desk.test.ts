import { describe, expect, it } from 'vitest'
import type { PlannedWorkout } from '../domain/types.ts'
import { setLocale } from '../i18n/index.ts'
import { planDeskDay } from './desk.ts'

// Sens porad czytamy po polsku; kompletność tłumaczeń pilnuje i18n.test.ts.
setLocale('pl')

const profile = { workStart: '09:00', workEnd: '17:00' }

const easy: PlannedWorkout = {
  kind: 'easy',
  distanceKm: 10,
  ruleRefs: [],
  segments: [{ type: 'easy', distanceKm: 10, pace: { loSecPerKm: 300, hiSecPerKm: 320 }, description: '' }],
}
const intervals: PlannedWorkout = {
  kind: 'quality_intervals',
  distanceKm: 12,
  ruleRefs: [],
  segments: [
    { type: 'warmup', distanceKm: 3, pace: { loSecPerKm: 300, hiSecPerKm: 320 }, description: '' },
    { type: 'intervals', reps: 6, repM: 1000, pace: { loSecPerKm: 250, hiSecPerKm: 250 }, description: '' },
  ],
}
const long: PlannedWorkout = {
  kind: 'long',
  distanceKm: 30,
  ruleRefs: [],
  segments: [{ type: 'easy', distanceKm: 30, pace: { loSecPerKm: 330, hiSecPerKm: 360 }, description: '' }],
}

describe('przerwy w siedzeniu', () => {
  it('co najwyżej 30 min, chodzenie (B-3/B-4)', () => {
    const day = planDeskDay(profile, easy)
    expect(day.breaks.length).toBeGreaterThanOrEqual(7)
    for (const b of day.breaks) expect(b.minutes).toBeGreaterThanOrEqual(3)
    expect(day.breaks[0]!.at).toBe('09:30')
    expect(day.breaks.some((b) => b.what.includes('chodu'))).toBe(true)
  })

  it('jedna przerwa to exercise snack — schody (B-5)', () => {
    const day = planDeskDay(profile, easy)
    expect(day.breaks.filter((b) => b.what.includes('schodów'))).toHaveLength(1)
  })

  it('wymuszony rzadszy rytm jest przycinany do 30 min (B-3)', () => {
    const day = planDeskDay({ ...profile, breakEveryMin: 90 }, easy)
    const first = day.breaks[0]!.at
    expect(first).toBe('09:30')
  })

  it('dzień bez biegania nadal ma przerwy', () => {
    const day = planDeskDay(profile)
    expect(day.breaks.length).toBeGreaterThan(0)
    expect(day.guidance.some((g) => g.includes('dzień wolny'))).toBe(true)
  })
})

describe('okna treningowe', () => {
  it('krótka jednostka mieści się w lunchu, 10 km już nie (≈68 min z przebraniem)', () => {
    const short: PlannedWorkout = {
      kind: 'easy',
      distanceKm: 5,
      ruleRefs: [],
      segments: [{ type: 'easy', distanceKm: 5, pace: { loSecPerKm: 300, hiSecPerKm: 320 }, description: '' }],
    }
    expect(planDeskDay(profile, short).windows.find((w) => w.key === 'lunch')!.fits).toBe(true)
    expect(planDeskDay(profile, easy).windows.find((w) => w.key === 'lunch')!.fits).toBe(false)
    expect(planDeskDay(profile, easy).windows.find((w) => w.key === 'evening')!.fits).toBe(true)
  })

  it('długie wybieganie (≈3 h) nie mieści się w żadnym oknie dnia pracy — moduł mówi to wprost', () => {
    const day = planDeskDay(profile, long)
    expect(day.windows.every((w) => !w.fits)).toBe(true)
    expect(day.guidance.some((g) => g.includes('przesuń ją na inny dzień'))).toBe(true)
  })

  it('preferencja użytkownika wygrywa wśród okien, które pasują', () => {
    const day = planDeskDay({ ...profile, prefer: 'evening' }, easy)
    expect(day.recommended?.key).toBe('evening')
  })
})

describe('reguła kluczowa: akcent po ciężkim dniu kognitywnym (B-10/S-8)', () => {
  it('każe prowadzić sesję po tempie, nie po odczuciu', () => {
    const day = planDeskDay(profile, intervals, { heavyCognitiveDay: true })
    const text = day.guidance.join(' ')
    expect(text).toContain('PO TEMPIE')
    expect(text).toContain('15%')
    expect(day.ruleRefs).toContain('B-10')
    expect(day.ruleRefs).toContain('S-8')
  })

  it('sugeruje przesunięcie akcentu (S-7)', () => {
    const day = planDeskDay(profile, intervals, { heavyCognitiveDay: true })
    expect(day.guidance.some((g) => g.includes('trainctl shift'))).toBe(true)
    expect(day.ruleRefs).toContain('S-7')
  })

  it('bez ciężkiego dnia kognitywnego nie dokłada tej porady', () => {
    const day = planDeskDay(profile, intervals)
    expect(day.guidance.join(' ')).not.toContain('PO TEMPIE')
  })

  it('dla spokojnej jednostki porada jest łagodniejsza', () => {
    const day = planDeskDay(profile, easy, { heavyCognitiveDay: true })
    expect(day.guidance.some((g) => g.includes('Spokojna jednostka'))).toBe(true)
  })
})

describe('czego moduł NIE robi (anty-wzorce)', () => {
  it('nie zmienia struktury planu z powodu siedzenia i mówi to wprost (B-1)', () => {
    const day = planDeskDay(profile, intervals)
    expect(day.guidance.some((g) => g.includes('nie zmieniają struktury planu'))).toBe(true)
    expect(day.ruleRefs).toContain('B-1')
  })

  it('nie powtarza folkloru o zgięciaczach ani nie obiecuje korzyści biegowych (B-2/B-6)', () => {
    const text = JSON.stringify(planDeskDay(profile, intervals, { heavyCognitiveDay: true })).toLowerCase()
    expect(text).not.toContain('zgięciacz')
    expect(text).not.toContain('rozciąga')
  })

  it('uczciwie zakłada niską adherencję (B-8)', () => {
    const day = planDeskDay(profile, easy)
    expect(day.guidance.some((g) => g.includes('niską adherencję'))).toBe(true)
  })
})

describe('walidacja', () => {
  it('zły format godziny i odwrócone godziny pracy', () => {
    expect(() => planDeskDay({ workStart: '9', workEnd: '17:00' })).toThrow(/HH:MM/)
    expect(() => planDeskDay({ workStart: '18:00', workEnd: '09:00' })).toThrow(/późniejsze/)
  })
})
