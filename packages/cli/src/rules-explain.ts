/**
 * Wyjaśnienia „why" — reguły z docs/science/FOUNDATIONS.md §10, po ludzku.
 * Same teksty siedzą w katalogu tłumaczeń; tutaj zostaje wyłącznie dostęp
 * po ID reguły i po rodzaju jednostki.
 */
import { coachText, sportMessages, type WorkoutKind } from 'trainctl-core'
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
export const ruleSourceUrl = (id: string): string => id.startsWith('MS-')
  ? `https://github.com/dithiothreitol/trainctl/blob/v${packageVersion()}/docs/science/MULTISPORT.md`
  : foundationsUrl()

/** Objaśnienie reguły po jej ID (np. `I-7`); undefined, gdy reguły nie opisano. */
export const ruleExplain = (id: string): string | undefined =>
  id === 'MS-6' ? coachText('Jednostka ma cel, uzasadnienie, rozgrzewkę, część główną, odpoczynek i schłodzenie. Biblioteka dobiera ograniczoną dawkę do dyscypliny, fazy, doświadczenia i celu. Bez aktualnej kalibracji stosuje RPE 1–10. Dokładne parametry są wyborami inżynierskimi, bez walidacji trenerskiej całej biblioteki.', 'Each session includes an objective, rationale, warm-up, main set, recovery and cool-down. Bounded recipes depend on sport, phase, experience and goal. Without current calibration, use RPE 1–10. Exact parameters are engineering choices; the complete library has not been coach-validated.') : id === 'MS-1' ? sportMessages().engineering : id === 'MS-2' ? sportMessages().substitution : id === 'MS-4' ? sportMessages().progression : id === 'MS-5' ? sportMessages().intentPolicy : id === 'MS-3' ? sportMessages().adaptation : id === 'E-1' ? ui().coach.heuristic : (ui().rules as Record<string, string>)[id]

/** Po co jest ta jednostka — jedno zdanie o celu fizjologicznym. */
export const kindPurpose = (kind: WorkoutKind): string => ui().kindPurpose[kind]

/** Labels describe provenance, never numerical certainty or evidence grades. */
export function ruleEvidence(id: string): 'research' | 'corpus' | 'engineering' | 'unclassified' {
  if (['MS-1', 'MS-2', 'MS-3', 'MS-4', 'MS-5', 'MS-6', 'E-1', 'T-9', 'T-12', 'W-13', 'R-5', 'P-3', 'F-18', 'Z-10', 'E-2', 'E-3', 'R-9', 'R-10', 'P-11', 'J-6', 'R-11'].includes(id)) return 'engineering'
  if (['T-10', 'T-11', 'W-12', 'S-9a', 'S-9b', 'S-10', 'S-11', 'S-12', 'P-12', 'J-4', 'J-8', 'J-9', 'J-10', 'R-8'].includes(id)) return 'corpus'
  return ruleExplain(id) ? 'research' : 'unclassified'
}
