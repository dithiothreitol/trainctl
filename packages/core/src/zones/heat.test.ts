/** Korekta na temperaturę — H-1…H-6 (El Helou 2012, tab. S3). */
import { describe, expect, it } from 'vitest'
import { adjustForHeat, heatLadder, marathonEquivalentSec, HEAT_MODEL_MAX_C } from './heat.ts'

const MARATHON = 42.195
const SUB4 = 4 * 3600

describe('kształt modelu (H-1)', () => {
  it('poniżej i w optimum: zero straty', () => {
    const cold = adjustForHeat(MARATHON, SUB4, 3)
    expect(cold.ok && cold.adjustment.timePenaltyPct).toBe(0)
    expect(cold.ok && cold.adjustment.adjustedSec).toBe(SUB4)
  })

  it('kwadratowo, nie liniowo: ~2× większe ΔT daje ~4× stratę', () => {
    const a = adjustForHeat(MARATHON, SUB4, 12)
    const b = adjustForHeat(MARATHON, SUB4, 18)
    expect(a.ok && b.ok).toBe(true)
    if (!a.ok || !b.ok) return
    // krzywa „średnia stawki": T_opt 6,2 → ΔT 5,8 vs 11,8; (11,8/5,8)² ≈ 4,14
    const ratio = b.adjustment.speedLossPct / a.adjustment.speedLossPct
    expect(ratio).toBeGreaterThan(3.9) // model liniowy dałby ~2,03
    expect(ratio).toBeLessThan(4.4)
  })
})

describe('strata prędkości ≠ kara czasowa (H-4)', () => {
  it('kara czasu jest ZAWSZE większa niż strata prędkości', () => {
    for (const t of [12, 16, 20, 25]) {
      const r = adjustForHeat(MARATHON, SUB4, t)
      expect(r.ok).toBe(true)
      if (!r.ok) continue
      expect(r.adjustment.timePenaltyPct).toBeGreaterThan(r.adjustment.speedLossPct)
    }
  })

  it('wzór s/(100−s): 21,4% straty prędkości → ~27,3% kary czasu', () => {
    // odtworzenie przykładu z tabeli S3 (Q3, +20 °C nad optimum)
    const s = 21.42
    expect(Math.round((s / (100 - s)) * 100 * 10) / 10).toBe(27.3)
  })
})

describe('poziom biegacza (H-2/H-3)', () => {
  it('wolniejszy traci istotnie więcej w tym samym biegu', () => {
    const elite = adjustForHeat(MARATHON, 2.5 * 3600, 20)
    const slow = adjustForHeat(MARATHON, 4.5 * 3600, 20)
    expect(elite.ok && slow.ok).toBe(true)
    if (!elite.ok || !slow.ok) return
    expect(slow.adjustment.speedLossPct / elite.adjustment.speedLossPct).toBeGreaterThan(1.8)
  })

  it('przy tej samej TEMPERATURZE różnica jest mniejsza niż 3–4,6× z tabeli S3', () => {
    // Tabela podaje straty przy tym samym ΔT NAD OPTIMUM (tam iloraz k to 3,3×).
    // W realnym biegu obaj mają tę samą temperaturę bezwzględną, a czołówka ma
    // niższe optimum — większe ΔT częściowo kompensuje jej łagodniejszą krzywą.
    const sameDelta = {
      elite: adjustForHeat(MARATHON, 2.5 * 3600, 3.8 + 10),
      slow: adjustForHeat(MARATHON, 4.5 * 3600, 7.4 + 10),
    }
    if (!sameDelta.elite.ok || !sameDelta.slow.ok) return
    const byDelta = sameDelta.slow.adjustment.speedLossPct / sameDelta.elite.adjustment.speedLossPct
    expect(byDelta).toBeGreaterThan(3) // zgodnie z Tab. S3: 1,44% vs 4,61%

    const same20 = {
      elite: adjustForHeat(MARATHON, 2.5 * 3600, 20),
      slow: adjustForHeat(MARATHON, 4.5 * 3600, 20),
    }
    if (!same20.elite.ok || !same20.slow.ok) return
    const byTemp = same20.slow.adjustment.speedLossPct / same20.elite.adjustment.speedLossPct
    expect(byTemp).toBeLessThan(byDelta)
  })

  it('czołówka ma niższą temperaturę optymalną niż druga połowa stawki', () => {
    const elite = adjustForHeat(MARATHON, 2.5 * 3600, 10)
    const slow = adjustForHeat(MARATHON, 4.5 * 3600, 10)
    if (!elite.ok || !slow.ok) return
    expect(elite.adjustment.tOptC).toBeLessThan(slow.adjustment.tOptC)
    expect(elite.adjustment.curveLabel).toBe('czołówka')
  })

  it('krzywą wybieramy po ekwiwalencie maratońskim, nie po czasie na dystansie', () => {
    // dycha w 40 min to poziom czołowy, mimo że 2400 s < 3 h
    expect(marathonEquivalentSec(10, 2400)).toBeGreaterThan(3 * 3600)
    const r = adjustForHeat(10, 2400, 20)
    expect(r.ok && r.adjustment.curveLabel).toBe('szybki amator')
  })
})

describe('granice modelu (H-5)', () => {
  it('powyżej 25 °C odmawia liczby zamiast ekstrapolować', () => {
    const r = adjustForHeat(MARATHON, SUB4, 28)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.reason).toContain('poza dane')
    expect(r.reason).toContain('odczuciu')
  })

  it('dokładnie na granicy jeszcze liczy', () => {
    expect(adjustForHeat(MARATHON, SUB4, HEAT_MODEL_MAX_C).ok).toBe(true)
  })

  it('NaN nie przechodzi', () => {
    expect(adjustForHeat(MARATHON, SUB4, Number.NaN).ok).toBe(false)
  })
})

describe('sanity check wobec innych badań', () => {
  it('biegacz 4 h przy 20 °C traci kilkanaście–dwadzieścia kilka minut', () => {
    const r = adjustForHeat(MARATHON, SUB4, 20)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const lostMin = (r.adjustment.adjustedSec - SUB4) / 60
    // Vihma: ~9,6% przy 10→25 °C; El Helou ekstrapoluje ostrzej — pasmo, nie punkt
    expect(lostMin).toBeGreaterThan(10)
    expect(lostMin).toBeLessThan(35)
  })

  it('drabinka do pakietu startowego rośnie monotonicznie i kończy się na 25 °C', () => {
    const ladder = heatLadder(MARATHON, SUB4)
    expect(ladder.at(-1)!.tempC).toBe(25)
    for (let i = 1; i < ladder.length; i++) {
      expect(ladder[i]!.adjustedSec).toBeGreaterThan(ladder[i - 1]!.adjustedSec)
    }
  })
})
