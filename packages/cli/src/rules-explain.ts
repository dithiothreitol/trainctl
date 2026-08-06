/**
 * Wyjaśnienia „why" — reguły z docs/science/FOUNDATIONS.md §10, po ludzku.
 * Same teksty siedzą w katalogu tłumaczeń; tutaj zostaje wyłącznie dostęp
 * po ID reguły i po rodzaju jednostki.
 */
import type { WorkoutKind } from '@tren/core'
import { ui } from './i18n/index.ts'

/** Objaśnienie reguły po jej ID (np. `I-7`); undefined, gdy reguły nie opisano. */
export const ruleExplain = (id: string): string | undefined =>
  (ui().rules as Record<string, string>)[id]

/** Po co jest ta jednostka — jedno zdanie o celu fizjologicznym. */
export const kindPurpose = (kind: WorkoutKind): string => ui().kindPurpose[kind]
