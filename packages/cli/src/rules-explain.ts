/** Wyjaśnienia „why" — reguły z docs/science/FOUNDATIONS.md §10, po ludzku. */
import type { WorkoutKind } from '@tren/core'

export const RULE_EXPLAIN: Record<string, string> = {
  'I-1': 'faza bazy/budowania: rozkład piramidalny — dużo spokojnego biegania, akcenty okołoprogowe (Casado 2022; Knopp 2024)',
  'I-2': 'okres przedstartowy: przejście na polaryzację — sekwencja piramida→polaryzacja wygrała w RCT (Filipas 2022)',
  'I-5': '≥75% objętości tygodnia w strefie spokojnej, niezależnie od modelu (Haugen 2022; Knopp 2024)',
  'I-7': '≥48 h między sesjami jakościowymi — zasada hard day / easy day (Casado 2022)',
  'I-8': 'dwa akcenty tygodniowo przy ≥4 sesjach, jeden przy 3 (Casado 2022)',
  'P-1': 'obciążenie faluje, nie rośnie liniowo — progresja falująca dała +22% VO₂max vs +11% liniowej (RCT Costa 2019)',
  'P-2': 'co czwarty tydzień odciążeniowy (Costa 2019)',
  'P-3': 'wzrost objętości ≤10%/tydz. jako narzędzie planowania — to NIE jest próg urazowy (Damsted 2018)',
  'P-7': 'półmaraton: >32 km/tydz. i długie >21 km wiążą się z lepszym wynikiem (Fokkema 2020)',
  'P-8': 'maraton: >65 km/tydz. wiąże się z wynikiem lepszym o ~14 min (Fokkema 2020)',
  'T-1': 'taper: intensywność ZOSTAJE — jej utrzymanie ma niezależny efekt (Wang 2023, SMD −0,55)',
  'T-2': 'taper: liczba sesji ZOSTAJE (Wang 2023, SMD −0,53)',
  'T-3': 'taper: redukujemy wyłącznie objętość, o 41–60% (Wang 2023)',
  'T-4': 'taper ściśle malejący tydzień do tygodnia — „strict" dał medianę −5:32 na maratonie (Smyth 2021, n=158 117)',
  'T-5': 'długość taperu zależy od dystansu: 5–10 km ~tydzień, HM ~2 tyg., maraton 2–3 tyg. (Wang 2023; Knopp 2024)',
}

export const KIND_PURPOSE: Record<WorkoutKind, string> = {
  easy: 'Objętość tlenowa w strefie spokojnej — fundament adaptacji bez kosztu regeneracyjnego.',
  long: 'Długie wybieganie: wytrzymałość podstawowa, ekonomia biegu i odporność na zmęczenie (durability).',
  easy_hills: 'Bieg spokojny + podbiegi: siła specyficzna i ekonomia przy minimalnym koszcie (house style trenera).',
  quality_intervals: 'Sesja interwałowa — bodziec zależny od fazy: okołoprogowy (piramida) albo VO₂max (polaryzacja).',
  quality_continuous: 'Akcent ciągły — tempo narastające lub bieg zmienny; kontrola tempa i praca okołoprogowa.',
  sharpener: 'Krótki akcent przedstartowy: podtrzymuje intensywność w taperze (T-1) bez kosztu objętości.',
  race: 'Start — cel tego cyklu.',
}
