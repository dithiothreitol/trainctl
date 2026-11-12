/**
 * PLAN-v0.7 §7, test etapu 4: macierz B0 daje ten sam kształt sezonu dla profilu
 * biegowego w planie biegowym (v1) i w planie v2 — te same dni, jednostki, kilometry
 * i sesje siły. Cała macierz przez silnik biegowy profilu v2 (E3), próbka przez pełne
 * `trainctl plan` na plikach (składanie z silnikiem v2 i kalendarzem).
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parse, stringify } from 'yaml'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { setLocale, type TrainingSession } from 'trainctl-core'
import { cmdPlan } from './commands.ts'
import { shownKm } from './format.ts'
import { fullMatrix, matrixConfig, matrixPlan, MATRIX_TODAY, REVIEW_PROFILES, type MatrixProfile } from './plan-shape.fixture.ts'
import type { StoredPlan } from './planfile.ts'
import { initialRunning, sportsProfilePaths } from './sports-running.ts'
import { isSportsWorkspace, loadSportsPlan, sportsConfigFromRunning } from './sports-store.ts'

setLocale('en')

type Row = (string | number)[]
const v1Shape = (plan: StoredPlan): Row[] => plan.weeks.flatMap((w) => w.days).flatMap((d): Row[] => [
  ...(d.workout ? [[d.date, 'run', d.workout.kind, shownKm(d.workout)]] : []),
  ...(d.strength ? [[d.date, 'strength', d.strength.durationMin]] : []),
])
const v2Shape = (sessions: TrainingSession[]): Row[] => [...sessions]
  .sort((a, z) => a.date.localeCompare(z.date) || (a.sport === 'run' ? -1 : 1))
  .flatMap((s): Row[] => s.sport === 'run' ? [[s.date, 'run', s.legacyWorkout!.kind, s.distanceM! / 1000]]
    : s.sport === 'strength' ? [[s.date, 'strength', s.durationSec / 60]] : [])

/** Profil v2 z profilu macierzy — ta sama droga co kreator `init` (E3). */
const sportsConfig = (p: MatrixProfile) => {
  const c = matrixConfig(p)
  return sportsConfigFromRunning(c, { weeklyMinutes: p.baseKm * 6, language: c.language })
}

describe('B0: ten sam kształt sezonu w planie biegowym i w planie v2', () => {
  it('pełna macierz: silnik biegowy profilu v2 daje te same dni co plan biegowy', () => {
    const differ = fullMatrix().filter((p) => {
      const v2 = initialRunning(sportsConfig(p), MATRIX_TODAY, 'c-b0')!
      return JSON.stringify(v2Shape(v2.sessions)) !== JSON.stringify(v1Shape(matrixPlan(p)))
    }).map((p) => p.id)
    expect(differ).toEqual([])
  })

  describe('pełne `plan` na plikach', () => {
    const today = process.env['TRAINCTL_TODAY']
    beforeAll(() => { process.env['TRAINCTL_TODAY'] = MATRIX_TODAY })
    afterAll(() => {
      if (today === undefined) delete process.env['TRAINCTL_TODAY']
      else process.env['TRAINCTL_TODAY'] = today
    })
    // profile z przeglądu i co dwunasty profil macierzy (cele, dni, budżety, horyzonty)
    const sample = [...REVIEW_PROFILES, ...fullMatrix().filter((_, i) => i % 12 === 0)]
    it(`${sample.length} profili: plan v2 ma ten sam kształt co plan biegowy`, () => {
      const differ: string[] = []
      for (const p of sample) {
        const dir = mkdtempSync(join(tmpdir(), 'trainctl-b0-'))
        try {
          writeFileSync(join(dir, 'trainctl.yaml'), stringify(sportsConfig(p)))
          const r = cmdPlan(dir)
          if (r.code !== 0) { differ.push(`${p.id}: ${r.output}`); continue }
          const v1 = matrixPlan(p), v2 = loadSportsPlan(dir)
          if (JSON.stringify(v2Shape(v2.sessions)) !== JSON.stringify(v1Shape(v1))) differ.push(p.id)
          // ostrzeżenia wykonalności planu biegowego są w planie v2, ze ścieżkami pól profilu v2
          if (v1.feasibilityWarnings.some((w) => !v2.warnings.includes(sportsProfilePaths(w)))) differ.push(`${p.id}: warnings`)
        } finally {
          rmSync(dir, { recursive: true, force: true, maxRetries: 3 })
        }
      }
      expect(differ).toEqual([])
    }, 120_000)

    it('zapis bez aliasów YAML; plik sprzed E3 z aliasami ponad limit parsera daje się wczytać', () => {
      const dir = mkdtempSync(join(tmpdir(), 'trainctl-alias-'))
      try {
        const profile = REVIEW_PROFILES[0]!
        writeFileSync(join(dir, 'trainctl.yaml'), stringify(sportsConfig(profile)))
        expect(cmdPlan(dir).code).toBe(0)
        // zapis od E3: bez kotwic i aliasów
        expect(readFileSync(join(dir, 'plan/plan.yaml'), 'utf8')).not.toMatch(/[&*]a\d+\b/)
        const plan = loadSportsPlan(dir)
        // zapis sprzed E3: sesje i plan generatora prosto z silnika, ze wspólnymi obiektami
        // (zakresy tempa, jednostki dni, `legacy.plan` jako ten sam obiekt co `generatorPlan`)
        const initial = initialRunning(sportsConfig(profile), MATRIX_TODAY, plan.cycleId)!
        const old = { ...plan, sessions: plan.sessions.map((s) => initial.sessions.find((x) => x.id === s.id) ?? s), legacy: initial.legacy }
        const text = stringify(old)
        expect(() => parse(text)).toThrow(/alias/)
        writeFileSync(join(dir, 'plan/plan.yaml'), text)
        expect(loadSportsPlan(dir).sessions).toHaveLength(plan.sessions.length)
        expect(isSportsWorkspace(dir)).toBe(true)
      } finally {
        rmSync(dir, { recursive: true, force: true, maxRetries: 3 })
      }
    })
  })
})
