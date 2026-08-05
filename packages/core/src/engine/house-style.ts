/**
 * „House style" trenera — agregaty wyliczone z korpusu 50 planów 2020–2025
 * skryptem tools/corpus/style_profile.py (2026-08-05). Bez danych osobowych.
 *
 * Kluczowe liczby źródłowe:
 *  - odpoczynek: PN 93,7%, PT 92,1% (ŚR 41,8% — częsty drugi dzień wolny)
 *  - WT: dominują interwały (55) i podbiegi (35); CZ: easy (72)
 *  - SB: długie (45) / starty (37); ND: długie (60) + akcenty (68)
 *  - długie wybieganie: mediana 22 km, P90 29 km, mediana 35,6% objętości tygodnia
 *  - akcenty: mediana 2/tydz.; rozgrzewka 3 km (86,8%), trucht 1 km (89,0%)
 *  - treningi: mediana 4/tydz.
 */
import type { Weekday } from '../domain/types.ts'

export interface HouseStyle {
  restDays: Weekday[]
  qualityDayPreference: Weekday[]
  longRunDayPreference: Weekday[]
  /** Dzień podbiegów / siły biegowej (doklejane do dnia spokojnego). */
  hillsDayPreference: Weekday[]
  longRunShare: number
  /** Sufit długiego: Fokkema 2020 — brak korzyści >35 km (P-8 kontekst). */
  longRunCapKm: number
  warmupKm: number
  cooldownKm: number
  /**
   * Liczba sesji wynika z objętości: sesje ≈ ceil(km_tygodnia / typicalKmPerSession).
   * Korpus: mediana 64 km przy medianie 4 sesji (≈14–16 km/sesję); przy 5 sesjach
   * tydzień ~64+ km. To odtwarza też wzorzec „ŚR czasem wolna" (41,8% odpoczynku).
   */
  typicalKmPerSession: number
  minWorkoutsPerWeek: number
  hillsReps: number
  hillsRepM: number
}

export const COACH_STYLE: HouseStyle = {
  restDays: ['mon', 'fri'],
  qualityDayPreference: ['tue', 'sun', 'wed', 'thu'],
  longRunDayPreference: ['sat', 'sun'],
  hillsDayPreference: ['thu', 'wed', 'tue'],
  longRunShare: 0.356,
  longRunCapKm: 35,
  warmupKm: 3,
  cooldownKm: 1,
  typicalKmPerSession: 14,
  minWorkoutsPerWeek: 3,
  hillsReps: 15,
  hillsRepM: 200,
}
