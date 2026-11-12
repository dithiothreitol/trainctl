/**
 * PLAN-v0.7 C8: tętno jako druga miara celu. Tempo zostaje celem głównym (Z-3:
 * prędkość dokładniejsza od tętna jako kotwica), a bieg spokojny i długi dostaje
 * pułap tętna na progu LT1 z Z-2 — osobno dla kobiet i mężczyzn (N-13: wspólny
 * %HRmax dla obu płci to błąd). Bez płci w profilu pułapu nie ma.
 * Akcenty zostają przy tempie; `review` i `adapt` tętna nie oceniają (D3).
 */
import type { AthleteProfile, WorkoutKind } from '../domain/types.ts'

/**
 * E-3 (inż.): granice wiarygodności HRmax u dorosłego biegacza — wpis w profilu
 * spoza nich to literówka, a szczyt z zegarka spoza nich to artefakt czujnika.
 * To nie norma fizjologiczna.
 */
export const HR_MAX_BPM = [120, 230] as const

/** Z-2 (Nuuttila 2025): LT1 jako udział HRmax — 78,9% u mężczyzn, 83,6% u kobiet. */
export const LT1_SHARE_OF_HRMAX = { male: 0.789, female: 0.836 } as const

/** Rodzaje jednostek z pułapem tętna: bieg spokojny i długi (C8, pkt 2). */
export const HR_CEILING_KINDS: ReadonlySet<WorkoutKind> = new Set<WorkoutKind>(['easy', 'long'])

export interface HrCeiling {
  /** Pułap w uderzeniach na minutę, zaokrąglony w dół: nie wchodzi ponad LT1. */
  bpm: number
  /** Udział HRmax z Z-2 dla płci profilu. */
  share: number
  sex: 'male' | 'female'
  /** HRmax zmierzone; `false` = szacunek, widok ostrzega raz (Z-5). */
  measured: boolean
}

/** Pułap tętna biegu spokojnego i długiego albo `undefined` bez HRmax lub bez płci (N-13). */
export function easyHrCeiling(athlete: Pick<AthleteProfile, 'sex' | 'hrMax'>): HrCeiling | undefined {
  const sex = athlete.sex
  if (!athlete.hrMax || (sex !== 'male' && sex !== 'female')) return undefined
  const share = LT1_SHARE_OF_HRMAX[sex]
  return { bpm: Math.floor(athlete.hrMax.bpm * share), share, sex, measured: athlete.hrMax.measured }
}
