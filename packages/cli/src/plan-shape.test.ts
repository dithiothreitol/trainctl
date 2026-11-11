/**
 * Kształt sezonu jako kontrakt (docs/PLAN-v0.7.md, B0, kandydat ADR-047).
 *
 * Migawka `__snapshots__/plan-shape-*.txt` zapisuje sezon profili z przeglądu
 * i podsumowanie lintów kształtu dla pełnej macierzy 576 profili. Zmiana
 * silnika zmienia migawkę — to zamierzone: różnica idzie do przeglądu kodu
 * razem ze zmianą, zamiast przejść niezauważona przez testy reguł tygodnia.
 */
import { describe, expect, it } from 'vitest'
import { setLocale, validatePlan, type ShapeCode } from 'trainctl-core'
import { REVIEW_PROFILES, fullMatrix, matrixPlan, shapeReport, type MatrixProfile } from './plan-shape-matrix.ts'

setLocale('en')

const CODES: ShapeCode[] = ['longNotLongest', 'deloadNotLighter', 'sessionShareHigh', 'postRaceAccentHeavy', 'staleProgression', 'longBelowGoal']

function summary(p: MatrixProfile): string {
  const plan = matrixPlan(p)
  const { issues } = shapeReport(p, plan)
  const errors = validatePlan(plan).filter((i) => i.severity === 'error').length
  const counts = CODES.map((c) => issues.filter((i) => i.code === c).length)
  const longest = Math.max(0, ...plan.weeks.flatMap((w) => w.days.map((d) => (d.workout?.kind === 'long' ? d.workout.distanceKm : 0))))
  return [p.id.padEnd(26), `peak ${plan.peakKmPlanned}`.padEnd(8), `long ${longest}`.padEnd(8), `err ${errors}`, counts.join(' ')].join(' | ')
}

describe('kształt sezonu', () => {
  it('profile z przeglądu 2026-11-11', async () => {
    const text = REVIEW_PROFILES.map((p) => {
      const { lines, issues } = shapeReport(p)
      return [`## ${p.id}`, ...lines, '', ...issues.map((i) => `${i.code} ${i.date} ${i.values.join('/')} [${i.ruleRefs.join(',')}]`)].join('\n')
    }).join('\n\n')
    await expect(text + '\n').toMatchFileSnapshot('./__snapshots__/plan-shape-review.txt')
  })

  it('pełna macierz: każdy profil generuje plan bez błędów, podsumowanie lintów', async () => {
    const lines = fullMatrix().map(summary)
    expect(lines).toHaveLength(576)
    expect(lines.filter((l) => !l.includes('| err 0 |'))).toEqual([])
    const header = `# id | peak | longest long | validate errors | ${CODES.join(' ')}`
    await expect([header, ...lines].join('\n') + '\n').toMatchFileSnapshot('./__snapshots__/plan-shape-matrix.txt')
  })
})

describe('linty kształtu wykrywają usterki opisane w §1', () => {
  const codes = (id: string) => new Set(shapeReport(REVIEW_PROFILES.find((p) => p.id === id)!).issues.map((i) => i.code))
  it('P1: długie krótsze od spokojnego w odciążeniu, brak progresji, ciężki akcent po starcie, długie poniżej progu', () => {
    expect([...codes('P1')]).toEqual(expect.arrayContaining(['longNotLongest', 'staleProgression', 'postRaceAccentHeavy', 'longBelowGoal']))
  })
  it('P2b: akcent dźwiga tydzień przy małej objętości', () => {
    expect(codes('P2b').has('sessionShareHigh')).toBe(true)
  })
  it('P3: budżet czasu robi odciążenie cięższym od ładowania', () => {
    expect(codes('P3').has('deloadNotLighter')).toBe(true)
  })
  it('cel bazowy i 10 km nie mają progu długiego', () => {
    for (const goal of ['base', '10k'] as const) {
      const p: MatrixProfile = { id: goal, baseKm: 45, days: 5, goal, weeks: 16 }
      expect(shapeReport(p).issues.some((i) => i.code === 'longBelowGoal')).toBe(false)
    }
  })
})
