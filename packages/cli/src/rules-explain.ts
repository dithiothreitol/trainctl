/**
 * Wyjaśnienia „why" — reguły z docs/science/FOUNDATIONS.md §10, po ludzku.
 * Same teksty siedzą w katalogu tłumaczeń; tutaj zostaje wyłącznie dostęp
 * po ID reguły i po rodzaju jednostki.
 */
import type { WorkoutKind } from 'trainctl-core'
import { ui } from './i18n/index.ts'
import { packageVersion } from './version.ts'

export const FOUNDATIONS_PATH = 'docs/science/FOUNDATIONS.md'

/**
 * FOUNDATIONS nie jedzie w paczce npm, więc ścieżka względna w podpowiedzi
 * prowadziła donikąd. Link przypięty do tagu wydania nie dryfuje: reguły,
 * które cytuje ten silnik, są tymi z jego własnej wersji.
 */
export const foundationsUrl = (): string =>
  `https://github.com/dithiothreitol/trainctl/blob/v${packageVersion()}/${FOUNDATIONS_PATH}`

/** Objaśnienie reguły po jej ID (np. `I-7`); undefined, gdy reguły nie opisano. */
export const ruleExplain = (id: string): string | undefined =>
  id === 'E-1' ? ui().coach.heuristic : (ui().rules as Record<string, string>)[id]

/** Po co jest ta jednostka — jedno zdanie o celu fizjologicznym. */
export const kindPurpose = (kind: WorkoutKind): string => ui().kindPurpose[kind]

/** Labels describe provenance, never numerical certainty or evidence grades. */
export function ruleEvidence(id: string): 'research' | 'corpus' | 'engineering' | 'unclassified' {
  if (['E-1', 'T-9', 'T-12', 'W-13', 'R-5', 'P-3', 'F-18', 'Z-10', 'E-2', 'R-9', 'R-10', 'P-11'].includes(id)) return 'engineering'
  if (['T-10', 'T-11', 'W-12', 'S-9a', 'R-8'].includes(id)) return 'corpus'
  return ruleExplain(id) ? 'research' : 'unclassified'
}
