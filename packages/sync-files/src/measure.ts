/**
 * Pomiary z punktów trasy: dystans, czas ruchu, przewyższenie, rozpoznanie biegu.
 *
 * Żadna z tych wartości nie wpływa na kalibrację: strefy tempa liczymy wyłącznie
 * z wyników zawodów (docs/science/FOUNDATIONS.md), nie z plików aktywności. Pliki służą tylko
 * porównaniu wykonania z planem — stąd stałe poniżej są wartościami
 * inżynierskimi, nie fizjologicznymi.
 */

/**
 * Średni promień Ziemi R₁ = 6 371 008,8 m (IUGG; Moritz, „Geodetic Reference
 * System 1980", Bulletin Géodésique 54, 1980). Błąd modelu kulistego względem
 * elipsoidy to ułamki procenta — bez znaczenia przy porównaniu z planem.
 */
export const EARTH_RADIUS_M = 6371008.8

/**
 * Wartość inżynierska, nie fizjologia: odcinek wolniejszy niż 0,5 m/s
 * (~33 min/km) traktujemy jako postój, nie ruch.
 */
export const MIN_MOVING_SPEED_MS = 0.5

/**
 * Wartość inżynierska, nie fizjologia: przerwa dłuższa niż 60 s między
 * punktami to pauza (zatrzymany zegarek, utrata sygnału), nie ruch.
 */
export const MAX_SAMPLE_GAP_SEC = 60

/**
 * Wartość inżynierska: zmiany wysokości poniżej 1 m względem ostatniego
 * przyjętego punktu uznajemy za szum barometru/GPS i nie liczymy do przewyższenia.
 */
export const ELEVATION_NOISE_M = 1

/**
 * Heurystyka inżynierska bez wpływu na kalibrację: plik bez typu sportu uznajemy
 * za bieg, gdy średnie tempo ruchu mieści się w 3:00–9:30 min/km. Szybciej to
 * zwykle rower, wolniej — marsz. Błąd kosztuje najwyżej źle sklasyfikowaną
 * pozycję w przeglądzie; strefy liczymy z wyników zawodów, nigdy z tych plików.
 */
export const RUN_PACE_MIN_SEC_PER_KM = 180
export const RUN_PACE_MAX_SEC_PER_KM = 570

const toRad = (deg: number): number => (deg * Math.PI) / 180

/** Odległość po łuku wielkiego koła (wzór haversine), w metrach. */
export function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)))
}

/** Próbka ciągłego zapisu: czas [s] i dystans narastający [m]. */
export interface MotionSample {
  t: number
  d: number
}

/** Czas ruchu z ciągłej serii próbek (jeden segment, bez przerw w zapisie). */
export function movingTimeSec(samples: MotionSample[]): number {
  let moving = 0
  for (let i = 1; i < samples.length; i++) {
    const prev = samples[i - 1]!
    const cur = samples[i]!
    const dt = cur.t - prev.t
    if (dt <= 0 || dt > MAX_SAMPLE_GAP_SEC) continue
    if ((cur.d - prev.d) / dt >= MIN_MOVING_SPEED_MS) moving += dt
  }
  return moving
}

/**
 * Suma podejść z histerezą: punkt odniesienia przesuwa się dopiero, gdy
 * wysokość odejdzie od niego o co najmniej `ELEVATION_NOISE_M`. Dzięki temu
 * długie łagodne podejście (po 0,3 m na punkt) liczy się w całości, a drganie
 * ±0,5 m na płaskim — wcale.
 */
export function elevationGainM(elevations: number[]): number | undefined {
  if (elevations.length < 2) return undefined
  let ref = elevations[0]!
  let gain = 0
  for (let i = 1; i < elevations.length; i++) {
    const e = elevations[i]!
    if (e - ref >= ELEVATION_NOISE_M) {
      gain += e - ref
      ref = e
    } else if (ref - e >= ELEVATION_NOISE_M) {
      ref = e
    }
  }
  return gain
}

/** Rozpoznanie biegu po tempie — tylko dla plików bez typu sportu. */
export function classifyByPace(distanceM: number | undefined, movingSec: number | undefined): 'Run' | 'Other' {
  if (!distanceM || !movingSec || distanceM <= 0 || movingSec <= 0) return 'Other'
  const pace = movingSec / (distanceM / 1000)
  return pace >= RUN_PACE_MIN_SEC_PER_KM && pace <= RUN_PACE_MAX_SEC_PER_KM ? 'Run' : 'Other'
}
