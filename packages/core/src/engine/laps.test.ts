/**
 * PLAN-v0.7 D2, D3: macierz scenariuszy dopasowania okrążeń do planu — najbardziej
 * ryzykowna część pakietu D, pokryta od startu (PLAN-v0.7 §0, krok 5). Wszystkie
 * okrążenia są wymyślone; kształty jak z zegarka (FIT), z huba (WORK/RECOVERY)
 * i z ręcznego przycisku.
 */
import { describe, expect, it } from 'vitest'
import type { PaceRange, PlannedWorkout } from '../domain/types.ts'
import type { ActivityLap } from '../ports/sync.ts'
import { PACE_TOLERANCE_SEC, easyBand, easyPace, matchReps, paceVerdict, plannedReps, type RepTarget } from './laps.ts'

/** Strefa spokojna 5:30–6:10/km, cel odcinków 4:00–4:08/km. */
const EASY: PaceRange = { loSecPerKm: 330, hiSecPerKm: 370 }
const TARGET: PaceRange = { loSecPerKm: 240, hiSecPerKm: 248 }
const reps = (count: number, repM = 1000, pace: PaceRange | null = TARGET): RepTarget[] =>
  Array.from({ length: count }, () => (pace ? { repM, pace } : { repM }))

const lap = (km: number, secPerKm: number, extra: Partial<ActivityLap> = {}): ActivityLap => ({
  distanceKm: km,
  movingTimeSec: Math.round(km * secPerKm),
  ...extra,
})
const work = (km: number, secPerKm: number) => lap(km, secPerKm, { intensity: 'work' })
const rest = (km = 0.2) => lap(km, 600, { intensity: 'rest' })
const warmup = (km = 2) => lap(km, 360, { intensity: 'warmup' })
const cooldown = (km = 1.5) => lap(km, 370, { intensity: 'cooldown' })

/** Akcent z zegarka z treningiem strukturalnym: rozgrzewka, odcinki z przerwami, schłodzenie. */
const structured = (paces: number[], km = 1) => [
  warmup(),
  ...paces.flatMap((p, i) => (i < paces.length - 1 ? [work(km, p), rest()] : [work(km, p)])),
  cooldown(),
]

/** Ręczne okrążenia bez roli: wolna rozgrzewka, odcinki, trucht 200 m, schłodzenie. */
const manual = (paces: number[], km = 1) => [
  lap(2, 360),
  ...paces.flatMap((p, i) => (i < paces.length - 1 ? [lap(km, p), lap(0.2, 420)] : [lap(km, p)])),
  lap(1.5, 370),
]

describe('matchReps: macierz scenariuszy (D2)', () => {
  const cases: {
    name: string
    reps: RepTarget[]
    laps: ActivityLap[] | undefined
    expect: { matched?: number; inRange?: number; extra?: number; reason?: 'no-laps' | 'no-match'; verdicts?: (string | undefined)[]; repMs?: number[] }
  }[] = [
    {
      name: 'zegarek z treningiem: komplet odcinków w zakresie',
      reps: reps(5),
      laps: structured([242, 244, 241, 246, 243]),
      expect: { matched: 5, inRange: 5, extra: 0 },
    },
    {
      name: 'zegarek z treningiem: trzy odcinki z pięciu, potem schłodzenie',
      reps: reps(5),
      laps: structured([242, 244, 241]),
      expect: { matched: 3, inRange: 3 },
    },
    {
      name: 'tempa poza zakresem: szybciej, na granicy tolerancji, wolniej',
      reps: reps(4),
      laps: structured([230, 237, 251, 255]),
      expect: { matched: 4, inRange: 2, verdicts: ['faster', 'within', 'within', 'slower'] },
    },
    {
      name: 'odcinek z rolą „praca" wolniejszy niż strefa spokojna nadal jest odcinkiem',
      reps: reps(2),
      laps: structured([243, 400]),
      expect: { matched: 2, inRange: 1, verdicts: ['within', 'slower'] },
    },
    {
      name: 'szósty odcinek ponad plan',
      reps: reps(5),
      laps: structured([242, 244, 241, 246, 243, 245]),
      expect: { matched: 5, extra: 1 },
    },
    {
      name: 'okrążenie krótsze o ponad 10% nie jest odcinkiem planu',
      reps: reps(5),
      laps: [warmup(), work(1, 242), rest(), work(0.8, 244), rest(), work(1, 241), rest(), work(1, 246), rest(), work(1, 243), cooldown()],
      expect: { matched: 4 },
    },
    {
      name: 'drabinka 1000/400/200 z opuszczonym jednym 400 m',
      reps: [...reps(2, 1000), ...reps(2, 400), ...reps(2, 200)],
      laps: [warmup(), work(1, 243), rest(), work(1, 244), rest(), work(0.4, 235), rest(), work(0.2, 230), rest(), work(0.2, 229), cooldown()],
      expect: { matched: 5 },
    },
    {
      name: 'remis: okrążenia w odwrotnej kolejności niż plan — zostaje pierwsze powtórzenie planu',
      reps: [...reps(1, 1000), ...reps(1, 400)],
      laps: [warmup(), work(0.4, 235), rest(), work(1, 243), cooldown()],
      expect: { matched: 1, repMs: [1000] },
    },
    {
      name: 'hub: interwały WORK i RECOVERY bez sposobu zamknięcia',
      reps: reps(3),
      // rozgrzewka 1 km oznaczona RECOVERY nie jest odcinkiem, choć ma jego długość
      laps: [lap(1, 360, { intensity: 'rest' }), work(1.003, 243), lap(0, 90, { intensity: 'rest' }), work(0.998, 245), lap(0.25, 480, { intensity: 'rest' }), work(1.01, 244), lap(1.5, 370, { intensity: 'rest' })],
      expect: { matched: 3, inRange: 3 },
    },
    {
      name: 'ręczne okrążenia bez roli: odcinki szybsze niż strefa spokojna, przedzielone truchtem',
      reps: reps(5),
      laps: manual([242, 244, 241, 246, 243]),
      expect: { matched: 5, inRange: 5 },
    },
    {
      name: 'ręczne: rozgrzewka z okrążeniami co kilometr, potem odcinki — rozgrzewka odpada po tempie',
      reps: reps(3),
      laps: [lap(1, 360), lap(1, 355), lap(0.3, 365), lap(1, 242), lap(0.2, 420), lap(1, 244), lap(0.2, 420), lap(1, 243), lap(1.5, 370)],
      expect: { matched: 3, extra: 0 },
    },
    {
      name: 'ręczne bez przerw między odcinkami: sąsiednie okrążenia to nie struktura planu',
      reps: reps(5),
      laps: [lap(2, 360), lap(1, 242), lap(1.02, 244), lap(0.97, 241), lap(1.05, 246), lap(0.95, 243), lap(1.5, 370)],
      expect: { reason: 'no-match', matched: 0 },
    },
    {
      name: 'ręczne okrążenia po kilometrze: kilometr szybko, kilometr truchtu — przycisk, nie autolap',
      reps: reps(3),
      laps: [360, 245, 400, 246, 400, 244, 370].map((p) => lap(1, p, { trigger: 'manual' as const })),
      expect: { matched: 3, inRange: 3 },
    },
    {
      name: 'przerwy w truchcie prawie tak długie jak odcinek (850 m) to jeszcze nie autolap',
      reps: reps(4),
      laps: [lap(2, 360), lap(1, 245), lap(0.85, 420), lap(1, 246), lap(0.85, 420), lap(1, 244), lap(0.85, 420), lap(1, 243), lap(1.5, 370)],
      expect: { matched: 4, inRange: 4 },
    },
    {
      name: 'odcinek 200 m, który GPS zmierzył na 225 m, pasuje (tolerancja co najmniej 30 m)',
      reps: reps(2, 200),
      laps: structured([230, 231], 0.225),
      expect: { matched: 2 },
    },
    {
      name: 'okrążenia automatyczne co kilometr (zamknięte po dystansie)',
      reps: reps(5),
      laps: [...[360, 355, 300, 280, 330, 290, 310, 360, 365].map((p) => lap(1, p, { trigger: 'distance' })), lap(0.4, 370, { trigger: 'manual' })],
      expect: { reason: 'no-match', matched: 0 },
    },
    {
      name: 'okrążenia automatyczne bez sposobu zamknięcia: wszystkie po kilometrze',
      reps: reps(5),
      laps: [...[360, 300, 250, 300, 250, 300, 250, 360].map((p) => lap(1, p)), lap(0.6, 370)],
      expect: { reason: 'no-match', matched: 0 },
    },
    {
      name: 'okrążenia automatyczne bez sposobu zamknięcia, jedno ręczne w środku: szybkie co drugie to nie odcinki',
      reps: reps(4),
      laps: [...[360, 250, 360, 250, 360].map((p) => lap(1, p)), lap(0.45, 360), ...[250, 360, 250].map((p) => lap(1, p)), lap(0.6, 370)],
      expect: { reason: 'no-match', matched: 0 },
    },
    {
      name: 'bieg spokojny z okrążeniami zamiast akcentu: nic nie jest szybsze niż strefa spokojna',
      reps: reps(5),
      laps: [lap(2.5, 350), lap(3.1, 345), lap(2.2, 352)],
      expect: { reason: 'no-match', matched: 0 },
    },
    {
      name: 'dane bez okrążeń (GPX, hub bez interwałów)',
      reps: reps(5),
      laps: undefined,
      expect: { reason: 'no-laps', matched: 0 },
    },
    {
      name: 'pusta lista okrążeń',
      reps: reps(5),
      laps: [],
      expect: { reason: 'no-laps', matched: 0 },
    },
    {
      name: 'plan bez celu tempa: odcinki liczone, zakresu brak',
      reps: reps(2, 1000, null),
      laps: structured([242, 244]),
      expect: { matched: 2, inRange: 0, verdicts: [undefined, undefined] },
    },
    {
      name: 'sharpener 5×300 m z zegarka',
      reps: reps(5, 300),
      laps: structured([230, 228, 231, 229, 230], 0.3),
      expect: { matched: 5, inRange: 0, verdicts: ['faster', 'faster', 'faster', 'faster', 'faster'] },
    },
  ]

  for (const c of cases) {
    it(c.name, () => {
      const result = matchReps(c.reps, c.laps, EASY)
      expect(result.planned).toBe(c.reps.length)
      if (c.expect.matched !== undefined) expect(result.matched).toHaveLength(c.expect.matched)
      if (c.expect.inRange !== undefined) expect(result.inRange).toBe(c.expect.inRange)
      if (c.expect.extra !== undefined) expect(result.extra).toBe(c.expect.extra)
      expect(result.reason).toBe(c.expect.reason)
      if (c.expect.verdicts) expect(result.matched.map((r) => r.vsTarget)).toEqual(c.expect.verdicts)
      if (c.expect.repMs) expect(result.matched.map((r) => r.repM)).toEqual(c.expect.repMs)
    })
  }

  it('dopasowany odcinek niesie dystans, czas i tempo okrążenia', () => {
    const [first] = matchReps(reps(1), [warmup(), work(1.003, 243), cooldown()], EASY).matched
    expect(first).toEqual({ repM: 1000, distanceKm: 1.003, movingTimeSec: 244, paceSecPerKm: 243, vsTarget: 'within' })
  })
})

describe('plannedReps', () => {
  const workout = (segments: PlannedWorkout['segments'], kind: PlannedWorkout['kind'] = 'quality_intervals'): PlannedWorkout =>
    ({ kind, distanceKm: 10, ruleRefs: [], segments })

  it('powtórzenia segmentów intervals po kolei, z celem tempa segmentu', () => {
    const w = workout([
      { type: 'warmup', distanceKm: 2, description: '' },
      { type: 'intervals', reps: 2, repM: 1000, pace: TARGET, description: '' },
      { type: 'intervals', reps: 1, repM: 400, description: '' },
      { type: 'cooldown', distanceKm: 1, description: '' },
    ])
    expect(plannedReps(w)).toEqual([{ repM: 1000, pace: TARGET }, { repM: 1000, pace: TARGET }, { repM: 400 }])
  })

  it('podbiegi, bieg ciągły i bieg spokojny nie mają powtórzeń do dopasowania', () => {
    expect(plannedReps(workout([{ type: 'hills', reps: 8, repM: 150, description: '' }], 'easy_hills'))).toEqual([])
    expect(plannedReps(workout([{ type: 'progression', distanceKm: 6, pace: TARGET, description: '' }], 'quality_continuous'))).toEqual([])
    expect(plannedReps(workout([{ type: 'easy', distanceKm: 8, pace: EASY, description: '' }], 'easy'))).toEqual([])
  })
})

describe('tempo biegu spokojnego (D3)', () => {
  it('granice zakresu z tolerancją pomiaru', () => {
    expect(paceVerdict(EASY.loSecPerKm - PACE_TOLERANCE_SEC, EASY)).toBe('within')
    expect(paceVerdict(EASY.loSecPerKm - PACE_TOLERANCE_SEC - 1, EASY)).toBe('faster')
    expect(paceVerdict(EASY.hiSecPerKm + PACE_TOLERANCE_SEC, EASY)).toBe('within')
    expect(paceVerdict(EASY.hiSecPerKm + PACE_TOLERANCE_SEC + 1, EASY)).toBe('slower')
  })

  it('bieg długi: strefa spokojna poszerzona o wolniejszy zakres dnia', () => {
    const long: PlannedWorkout = {
      kind: 'long', distanceKm: 20, ruleRefs: [],
      segments: [{ type: 'easy', distanceKm: 20, pace: { loSecPerKm: 370, hiSecPerKm: 400 }, description: '' }],
    }
    expect(easyBand(long, EASY)).toEqual({ loSecPerKm: 330, hiSecPerKm: 400 })
    // w tempie planu biegu długiego to nie jest „wolniej niż zakres”
    expect(easyPace(395, easyBand(long, EASY)).vsRange).toBe('within')
  })

  it('bieg spokojny bez zapisanego tempa: sama strefa', () => {
    const easy: PlannedWorkout = { kind: 'easy', distanceKm: 8, ruleRefs: [], segments: [{ type: 'easy', distanceKm: 8, description: '' }] }
    expect(easyBand(easy, EASY)).toEqual(EASY)
    expect(easyPace(318.4, EASY)).toEqual({ paceSecPerKm: 318, range: EASY, vsRange: 'faster' })
  })
})
