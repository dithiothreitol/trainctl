/**
 * Kształt sezonu jako kontrakt (docs/PLAN-v0.7.md, B0, kandydat ADR-047).
 *
 * Migawka `__snapshots__/plan-shape-*.txt` zapisuje sezon profili z przeglądu
 * i podsumowanie lintów kształtu dla pełnej macierzy 576 profili. Zmiana
 * silnika zmienia migawkę — to zamierzone: różnica idzie do przeglądu kodu
 * razem ze zmianą, zamiast przejść niezauważona przez testy reguł tygodnia.
 * Linty na syntetycznych tygodniach sprawdza `core/src/engine/season.test.ts`.
 */
import { describe, expect, it } from 'vitest'
import { SHAPE_CODES, setLocale, validatePlan, type PlanIssue, type ShapeIssue } from 'trainctl-core'
import { REVIEW_PROFILES, fullMatrix, matrixPlan, shapeReport, type MatrixProfile } from './plan-shape.fixture.ts'
import type { StoredPlan } from './planfile.ts'

setLocale('en')

interface MatrixRow { profile: MatrixProfile; plan: StoredPlan; shape: ShapeIssue[]; lint: PlanIssue[]; longest: number }
let cached: MatrixRow[] | undefined
/** Macierz liczona raz na plik: kilka testów czyta te same plany. */
function matrix(): MatrixRow[] {
  cached ??= fullMatrix().map((profile) => {
    const plan = matrixPlan(profile)
    const { issues, rows } = shapeReport(profile, plan)
    return { profile, plan, shape: issues, lint: validatePlan(plan), longest: Math.max(0, ...rows.map((r) => r.longKm)) }
  })
  return cached
}

function summary(r: MatrixRow): string {
  const errors = r.lint.filter((i) => i.severity === 'error').length
  const counts = SHAPE_CODES.map((c) => r.shape.filter((i) => i.code === c).length)
  return [r.profile.id.padEnd(26), `peak ${r.plan.peakKmPlanned}`.padEnd(8), `long ${r.longest}`.padEnd(8), `err ${errors}`, counts.join(' ')].join(' | ')
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
    const lines = matrix().map(summary)
    expect(lines).toHaveLength(576)
    expect(lines.filter((l) => !l.includes('| err 0 |'))).toEqual([])
    const header = `# id | peak | longest long | validate errors | ${SHAPE_CODES.join(' ')}`
    await expect([header, ...lines].join('\n') + '\n').toMatchFileSnapshot('./__snapshots__/plan-shape-matrix.txt')
  })
})

describe('DoD etapu 2 (PLAN-v0.7 §4): macierz bez lintów kształtu', () => {
  const hit = (code: string) => matrix().filter((r) => r.shape.some((i) => i.code === code) || r.lint.some((i) => i.code === code)).map((r) => r.profile.id)
  // B1: długie najdłuższe (S-10, J-1), żadna jednostka nie dźwiga tygodnia (E-3)
  for (const code of ['longNotLongest', 'sessionShareHigh'] as const) {
    it(`${code}: żaden profil`, () => expect(hit(code)).toEqual([]))
  }
  // B1, B5.1: świeży plan nie łamie I-5 i rozpisuje to, co zapisał jako objętość tygodnia
  for (const code of ['easyShareLow', 'targetKmMismatch'] as const) {
    it(`świeży plan bez ostrzeżenia ${code}`, () => expect(hit(code)).toEqual([]))
  }
  it('B4: P1 dochodzi z długim ponad 21 km przed taperem (J-2), maraton nie ponad 35 km (N-19)', () => {
    const p1 = shapeReport(REVIEW_PROFILES.find((p) => p.id === 'P1')!)
    expect(Math.max(...p1.rows.filter((r) => ['base', 'build', 'peak'].includes(r.phase)).map((r) => r.longKm))).toBeGreaterThan(21)
    for (const r of matrix().filter((x) => x.profile.goal === 'm')) expect(r.longest).toBeLessThanOrEqual(35)
  })
  it('B5: akcent po starcie nie cięższy od bloku budowania (R-8): żaden profil', () => {
    expect(hit('postRaceAccentHeavy')).toEqual([])
  })
  it('B3–B5, B7: bloki rosną (P-1); wyjątek ma jawne ostrzeżenie o tym, co zatrzymuje objętość', () => {
    // szczyt zatrzymany sufitem (historia, pojemność dni, budżet czasu): bloki stoją na nim
    // i plan mówi o tym wprost — tak B0 opisuje zamknięcie lintu ostrzeżeniem wykonalności
    for (const r of matrix().filter((x) => x.shape.some((i) => i.code === 'staleProgression'))) {
      expect(r.plan.feasibilityWarnings.join(' '), r.profile.id).toMatch(/stays below the thresholds|running days? holds? \d+ km\/week|time budget (caps|holds) the plan/)
    }
  })
  it('B7: P3 (240 min z siłą) zachowuje kształt — odciążenia lżejsze, taper nie większy niż ostatni tydzień ładowania', () => {
    const p3 = REVIEW_PROFILES.find((p) => p.id === 'P3')!
    const plan = matrixPlan(p3)
    const { issues, rows } = shapeReport(p3, plan)
    expect(issues.filter((i) => i.code === 'deloadNotLighter')).toEqual([])
    const load = rows.filter((r) => ['base', 'build', 'peak'].includes(r.phase) && !r.deload)
    for (const r of rows.filter((x) => x.phase === 'taper')) expect(r.km).toBeLessThanOrEqual(load.at(-1)!.km)
    expect(validatePlan(plan).filter((i) => i.code === 'taperNotMonotonic')).toEqual([])
    // tygodnie ładowania mieszczą się w budżecie razem z siłą — nikt ich nie przycina osobno
    expect(plan.weeks.filter((w) => ['base', 'build', 'peak'].includes(w.skeleton.phase) && w.skeleton.uncappedKm !== undefined && w.totalKm < w.skeleton.targetKm - 0.5)).toEqual([])
  })
  // B7: budżet czasu ogranicza szczyt, a nie każdy tydzień osobno — kształt zostaje
  for (const code of ['deloadNotLighter', 'taperNotMonotonic'] as const) {
    it(`${code}: żaden profil, także z budżetem czasu (P-2, T-4)`, () => expect(hit(code)).toEqual([]))
  }
  it('B1: uwaga generatora (`why`) tylko przy dniu z biegiem — dzień usunięty przez pętle jest wolny', () => {
    const stale = matrix().flatMap((r) => r.plan.weeks.flatMap((w) => (w.notes ?? [])
      .filter((n) => 'date' in n && !w.days.find((d) => d.date === n.date)?.workout)
      .map((n) => `${r.profile.id} ${w.weekStart} ${n.code}`)))
    expect(stale).toEqual([])
  })
})
