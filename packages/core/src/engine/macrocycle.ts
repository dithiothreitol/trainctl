/**
 * Planer makrocyklu: kalendarz → szkielety tygodni (fazy, objętość, TID, taper).
 * Implementuje reguły FOUNDATIONS §10.2 (I-*), §10.3 (P-*), §10.5 (T-*).
 * Wartości oznaczone „inż." to parametry inżynierskie zgodne z kierunkiem reguły,
 * ale bez liczby w źródle — do kalibracji backtestem na korpusie.
 */
import type {
  AthleteProfile,
  ReturnBlock,
  IntensityModel,
  MacroPhase,
  MacrocyclePlan,
  RaceGoal,
  TuneUpRace,
  WeekSkeleton,
} from '../domain/types.ts'
import { addDays, diffDays, mondayOf } from '../util/dates.ts'
import { messages } from '../i18n/index.ts'
import { COACH_STYLE } from './house-style.ts'
import { SESSION_SHARE_MAX, weekCapacityKm } from './microcycle.ts'
import { goalClass, type GoalClass } from '../domain/goal-class.ts'

/** P-2: tydzień odciążenia po 3 tygodniach ładowania. Współczynnik 0,7 — inż. */
const DELOAD_EVERY = 4
const DELOAD_FACTOR = 0.7
/** P-3: ramp rate jako narzędzie planowania — domyślnie ≤10%/tydz. */
const RAMP_PER_LOAD_WEEK = 1.08 // inż., mieści się w P-3
/** P-9/kontekst amatorski: sufit bezpieczeństwa planera. */
const SANITY_CAP_KM = 120

/** T-5: mnożniki taperu względem ostatniego tygodnia ładowania (monotoniczne, T-4). */
const TAPER_MULTIPLIERS: Record<number, number[]> = {
  1: [0.55],
  2: [0.7, 0.5],
  3: [0.75, 0.6, 0.45],
}

export function taperWeeksFor(goal: RaceGoal): { weeks: number; flags: string[] } {
  switch (goalClass(goal)) {
    case 'base': return { weeks: 0, flags: [] } // P-11: plan bez zawodów nie ma taperu
    case 'ultra': return { weeks: 3, flags: [messages().macro.ultraTaperExtrapolated] }
    case 'marathon': return { weeks: 3, flags: [] } // maraton: 14–21 dni
    case 'half': return { weeks: 2, flags: [] } // HM: 10–14 dni
    case 'short': return { weeks: 1, flags: [] } // 5–10 km: 7–10 dni
  }
}

/** T-9: mini-taper przed startem B — objętość tygodnia w dół o ~20%, makrocykl bez zmian. */
const TUNE_UP_B_FACTOR = 0.8
/**
 * W-12: rytm kalibracji co ~4 tygodnie (mediana odstępu startów w korpusie: 28 dni).
 * Sprawdzian wstawiamy rzadziej — to fallback (W-13), a nie metoda pierwszego wyboru:
 * dopiero gdy przez 6 tygodni nie ma ani startu kontrolnego, ani świeżego wyniku.
 */
const CALIBRATION_GAP_WEEKS = 6
/** Sprawdzian nie ma sensu tuż przed celem — tam kalibruje sam start (T-1…T-5). */
const TEST_MIN_WEEKS_TO_GOAL = 3
/**
 * Ani na starcie planu: przed upływem kilku tygodni nowego bodźca nie ma czego
 * mierzyć — plan właśnie został skalibrowany z wyniku, który ma. Wartość inż.
 */
const TEST_MIN_WEEK_INDEX = 4

/** W-11: dystans sprawdzianu — krótszy niż cel, żeby był ostry, ale mierzalny. */
export function testDistanceKm(goal: RaceGoal): number {
  return goal.distanceKm <= 10 ? 3 : 5
}

/** P-7/P-8: rekomendowana objętość szczytowa dla dystansu docelowego. */
export function recommendedPeakKm(goal: RaceGoal): number {
  switch (goalClass(goal)) {
    case 'base': return 0 // bez dystansu docelowego nie ma progu P-7/P-8
    case 'ultra': return 70 // inż. — brak źródła dla ultra (T-8)
    case 'marathon': return 65 // P-8: >65 km/tydz. → −14 min
    case 'half': return 42 // P-7: >32 km/tydz. + długi >21 km; inż. margines
    case 'short': return 35 // inż. dla 5–10 km
  }
}

export interface MacrocycleInput {
  today: string
  goal: RaceGoal
  athlete: AthleteProfile
  /**
   * B7: sufit szczytu spoza profilu — tyle km tygodnia ładowania mieści budżet czasu
   * (E-2). Odciążenie i taper liczą się od szczytu pod tym sufitem, więc budżet nie
   * odwraca kształtu makrocyklu.
   */
  peakCapKm?: number
}

/**
 * R-8 (korpus, n=3: 2 starty maratońskie i dłuższe, 1 półmaraton): po starcie
 * ≥HM trener rozpisywał ~50% objętości sprzed startu w pierwszym tygodniu
 * (2–3 sesje, pierwszy akcent 7–8 dni po starcie) i wracał do ~100% w drugim.
 * R-10 (inż., bez danych w korpusie): po krótszym celu jeden tydzień ~70%.
 */
const TRANSITION_FACTORS_LONG = [0.5, 1.0]
const TRANSITION_FACTORS_SHORT = [0.7]
/** R-1: 48 h ciszy po maratonie → pierwszy bieg 3. dnia; po HM 2. dnia, po krótszym nazajutrz (inż.). */
const firstRunOffset = (cls: GoalClass) => (cls === 'marathon' || cls === 'ultra' ? 3 : cls === 'half' ? 2 : 1)
/**
 * P-11 (inż.): plan bez zawodów rośnie do udokumentowanego szczytu
 * (`peakWeeklyKm`) albo +15% bieżącej objętości i tam się wypłaszcza.
 */
const BASE_GROWTH = 1.15
/** R-11 (inż.): powrót po przerwie liczy się do 6 tygodni od `since`; później bieżąca objętość mówi sama. */
export const RETURN_WINDOW_DAYS = 42
/** R-11 (inż.): plan po przerwie startuje z 50–60% objętości sprzed niej. */
const RETURN_START_SHARE = { min: 0.5, max: 0.6 }

/**
 * Objętość, od której plan startuje, i poziom formy, od którego liczy szczyt. Po
 * przerwie (R-11) start leży w paśmie 50–60% objętości sprzed niej, a cel szczytu
 * liczy się od tej objętości — bieżąca średnia z przerwą w środku jej nie mówi.
 */
export function volumeBase(athlete: AthleteProfile, today: string): { start: number; level: number; returning: boolean } {
  const ret = athlete.returning
  if (!ret || !returnActive(athlete, ret.since, today)) return { start: athlete.recentWeeklyKm, level: athlete.recentWeeklyKm, returning: false }
  const lo = RETURN_START_SHARE.min * ret.previousWeeklyKm
  // górna granica rośnie od `since` w tempie P-3: biegacz, który w oknie powrotu już
  // odbudował objętość, nie wraca do 60% (R-11, inż.)
  const weeksBack = Math.floor(diffDays(ret.since, today) / 7)
  const hi = Math.min(ret.previousWeeklyKm, RETURN_START_SHARE.max * ret.previousWeeklyKm * Math.pow(RAMP_PER_LOAD_WEEK, weeksBack))
  return {
    start: Math.round(Math.min(hi, Math.max(lo, athlete.recentWeeklyKm))),
    // aktywny powrót ma bieżącą objętość nie wyższą niż sprzed przerwy
    level: ret.previousWeeklyKm,
    returning: true,
  }
}

/**
 * Czy powrót z profilu obowiązuje w dniu `today`: zaczął się (data nie w przyszłości),
 * nie dawniej niż RETURN_WINDOW_DAYS i bieżąca objętość nie przekroczyła tej sprzed
 * przerwy. Równa objętość to zwykle objętość sprzed przerwy wpisana jako bieżąca (profil
 * z historii, kreator), więc powrót trwa.
 */
function returnActive(athlete: AthleteProfile, since: string, today: string): boolean {
  const daysBack = diffDays(since, today)
  return daysBack >= 0 && daysBack <= RETURN_WINDOW_DAYS && athlete.recentWeeklyKm <= athlete.returning!.previousWeeklyKm
}

/**
 * B8 + B11: powrót z profilu, który zaczął się po starcie planu (pole dopisane w trakcie
 * planu), działa jak blok powrotu od `since` (R-11). Na starcie planu liczy go volumeBase.
 * Bez okna RETURN_WINDOW_DAYS: blok obowiązuje w całym cyklu tak jak zatwierdzony powrót
 * (`returnState`) — krzywa i tak dogania plan, a regeneracja po 6 tygodniach nie może
 * podnieść przyszłych tygodni skokiem (P-3). Kończy go objętość ponad tę sprzed przerwy.
 */
export function profileReturnBlock(athlete: AthleteProfile, planStart: string, today: string): ReturnBlock | undefined {
  const ret = athlete.returning
  if (!ret || ret.since <= planStart || ret.since > today || athlete.recentWeeklyKm > ret.previousWeeklyKm) return undefined
  return { since: ret.since, previousWeeklyKm: ret.previousWeeklyKm, illness: false }
}

/**
 * B3 (inż.): fala w bloku — tygodnie ładowania rosną 0,94 → 0,97 → 1,00 poziomu bloku,
 * po nich odciążenie (P-1: mikrocykl falujący, P-2). Fala działa, gdy trend objętości
 * rośnie w bloku wolniej niż ona sama: plateau albo biegacz blisko szczytu. Szybszy
 * wzrost (do 8% na tydzień, P-3) sam daje rosnące tygodnie.
 */
const BLOCK_WAVE = [0.94, 0.97, 1.0]

/**
 * Liczba tygodni ładowania w `loadWeeks` tygodniach przed taperem: co DELOAD_EVERY-ty
 * tydzień to odciążenie (P-1, P-2), ale nie ostatni — taper sam odciąża. Ten sam wzorzec
 * co w `volumeSchedule`; z niego liczą się szczyt osiągalny i najwcześniejsza data startu.
 */
function loadingWeeksIn(loadWeeks: number): number {
  return Math.max(0, loadWeeks - Math.floor(Math.max(0, loadWeeks - 1) / DELOAD_EVERY))
}

interface VolumeWeek { deload: boolean; km: number; longKm?: number; accentProgress: number }

/**
 * B4: cel długiego wybiegania w ostatnim bloku ładowania. J-2: półmaraton ponad 21 km,
 * J-10 (korpus, n = 3): 23–25 km na 2–7 tygodni przed startem — 22 km to dolna,
 * ostrożna wartość (inż.). J-1: maraton 30–35 km, P-8 karze najdłuższy poniżej 25 km.
 * Ultra: N-19 — nie ponad 35 km bez dodatkowej korzyści, 32 km inż. Krótszy cel
 * i plan bez startu nie mają toru: długie wynika z udziału w tygodniu.
 */
export function longGoalKm(goal: RaceGoal): number | undefined {
  switch (goalClass(goal)) {
    case 'half': return 22
    case 'marathon': return 30
    case 'ultra': return 32
    default: return undefined
  }
}
/** E-3 (inż.): długie rośnie najwyżej 2 km na tydzień ładowania. */
const LONG_STEP_KM = 2

/**
 * B3: trajektoria objętości tygodni przed taperem. Trend tygodni ładowania rośnie od
 * `start` geometrycznie tak, żeby szczyt wypadł w ostatnim tygodniu ładowania przed
 * taperem (T-7, P-12), nie szybciej niż RAMP_PER_LOAD_WEEK (P-3). Plan bez startu rośnie
 * w tempie P-3 do szczytu i tam się wypłaszcza (P-11). Odciążenie to DELOAD_FACTOR
 * poziomu bloku przed nim (P-2). Zwraca też poziom ostatniego bloku — od niego taper.
 */
function volumeSchedule(loadWeeks: number, start: number, peak: number, baseOnly: boolean, longGoal: number | undefined): { weeks: VolumeWeek[]; peakLevel: number } {
  const deloads: boolean[] = []
  let since = 0
  for (let i = 0; i < loadWeeks; i++) {
    since++
    // ostatni tydzień przed taperem nie jest odciążeniem — taper sam odciąża
    const deload = since >= DELOAD_EVERY && i !== loadWeeks - 1
    if (deload) since = 0
    deloads.push(deload)
  }
  const loading = deloads.filter((d) => !d).length
  const s0 = Math.min(start, peak)
  const growth = baseOnly
    ? RAMP_PER_LOAD_WEEK
    : Math.min(RAMP_PER_LOAD_WEEK, Math.max(1, Math.pow(peak / Math.max(1, s0), 1 / Math.max(1, loading - 1))))
  const trend = (k: number) => Math.min(peak, s0 * Math.pow(growth, k))

  // B4: tor długiego — od długiego z udziału w pierwszym tygodniu do celu w pierwszym
  // tygodniu ostatniego bloku ładowania, liniowo po tygodniach ładowania, najwyżej
  // LONG_STEP_KM na tydzień; odciążenie skraca długie tak jak objętość (P-2)
  const lastBlock = loadWeeks - 1 - deloads.lastIndexOf(true)
  const goalAt = Math.max(1, loading - Math.max(1, Math.min(lastBlock, loading)))
  const startLong = Math.round(COACH_STYLE.longRunShare * s0 * BLOCK_WAVE[0]!)
  const longAt = (k: number): number | undefined => {
    if (longGoal === undefined) return undefined
    const linear = startLong + ((longGoal - startLong) * Math.min(1, k / goalAt))
    return Math.round(Math.min(longGoal, linear, startLong + LONG_STEP_KM * k))
  }

  // B5: krok dawki akcentu — tydzień w bloku dodaje krok, a blok po odciążeniu startuje
  // z poziomu drugiego tygodnia poprzedniego (inż.); znormalizowany do 0…1 na końcu
  const steps: number[] = []
  let block = 0
  const weeks: VolumeWeek[] = []
  let k = 0
  let level = s0
  let lastLong: number | undefined
  for (let i = 0; i < loadWeeks;) {
    if (deloads[i]) {
      // odciążenie: dawka z początku bloku, który właśnie się skończył
      steps.push(Math.max(0, block - 1))
      weeks.push({ deload: true, km: Math.round(level * DELOAD_FACTOR), ...(lastLong !== undefined ? { longKm: Math.round(lastLong * DELOAD_FACTOR) } : {}), accentProgress: 0 })
      i++
      continue
    }
    block++
    // blok: kolejne tygodnie ładowania do najbliższego odciążenia
    let end = i
    while (end < loadWeeks && !deloads[end]) end++
    const size = end - i
    const first = trend(k)
    level = trend(k + size - 1)
    const wave = level / first < 1 / BLOCK_WAVE[0]!
    for (let j = 0; j < size; j++) {
      const fromEnd = size - 1 - j
      const longKm = longAt(k + j)
      if (longKm !== undefined) lastLong = longKm
      steps.push(block - 1 + j)
      weeks.push({
        deload: false,
        km: Math.round(wave ? level * BLOCK_WAVE[Math.max(0, BLOCK_WAVE.length - 1 - fromEnd)]! : trend(k + j)),
        ...(longKm !== undefined ? { longKm } : {}),
        accentProgress: 0,
      })
    }
    k += size
    i = end
  }
  // Pełna dawka w ostatnim tygodniu ładowania: krótki ostatni blok (jeden tydzień po
  // odciążeniu) ma niższy krok niż koniec bloku przedostatniego — tamte tygodnie też
  // dostają pełną dawkę, nie więcej.
  const lastStep = Math.max(0, steps[deloads.lastIndexOf(false)] ?? 0)
  weeks.forEach((w, i) => { w.accentProgress = lastStep > 0 ? Math.min(1, Math.round((steps[i]! / lastStep) * 100) / 100) : 1 })
  return { weeks, peakLevel: level }
}

/**
 * B8: najwcześniejsza niedziela startu, przy której plan dojdzie do szczytu P-7/P-8
 * dla dystansu: wzrost w tempie P-3 od startu (R-11 po przerwie), odciążenie co
 * czwarty tydzień, taper dystansu. Brak — próg nieosiągalny przy tym profilu: sufit
 * z historii albo pojemność dni są niżej (wtedy pomoże `peakWeeklyKm`, nie data).
 */
export function earliestFeasibleRaceDate(athlete: AthleteProfile, goal: RaceGoal, today: string): string | undefined {
  if (goal.kind === 'base') return undefined
  const recommended = recommendedPeakKm(goal)
  const { start, level } = volumeBase(athlete, today)
  const historyCap = Math.min(athlete.peakWeeklyKm ?? level * 1.4, SANITY_CAP_KM)
  const qualityPerWeek = qualitySessionsFor(athlete)
  if (historyCap < recommended || weekCapacityKm(athlete, qualityPerWeek, recommended) < recommended) return undefined
  // szczyt planu jest zaokrąglany do kilometra, więc próg osiąga już trend o 0,5 km niższy
  const loading = Math.max(1, Math.ceil(Math.log((recommended - 0.5) / Math.max(1, start)) / Math.log(RAMP_PER_LOAD_WEEK)) + 1)
  // najmniej tygodni, w których wzorzec odciążeń daje tyle tygodni ładowania (loadingWeeksIn)
  let weeks = loading
  while (loadingWeeksIn(weeks) < loading) weeks++
  weeks += taperWeeksFor(goal).weeks
  return addDays(mondayOf(today), 7 * (weeks - 1) + 6)
}

/**
 * I-8: akcenty w tygodniu ładowania — dwa przy co najmniej czterech dniach, inaczej jeden.
 * Jedno źródło dla makrocyklu, daty osiągalności i skanów pojemności (dni, budżet).
 */
export const qualitySessionsFor = (athlete: Pick<AthleteProfile, 'daysAvailable'>): number => (athlete.daysAvailable.length >= 4 ? 2 : 1)

/** R-5, R-11 (inż.): powrót w trakcie planu startuje z ~55% objętości sprzed przerwy (środek 50–60%). */
export const RETURN_RESTART_SHARE = 0.55

/**
 * B11: blok powrotu po przerwie w trakcie planu. Od tygodnia powrotu cel tygodnia to
 * mniejsza z wartości z planu i krzywej powrotu: ~55% objętości sprzed przerwy (R-5
 * po chorobie, R-11 po innej), wzrost w tempie P-3 na tydzień ładowania, odciążenie
 * planu zostaje (×0,7 krzywej, P-2). Po chorobie spokojnie co najmniej 7 dni od powrotu
 * (R-5: zero Z3 przez 5–7 dni; skeleton ma całe tygodnie, więc do końca tygodnia, w którym
 * mija siódmy dzień), po innej przerwie pierwszy blok z odciążeniem (R-11) — gdy powrót
 * wypada w odciążeniu, blok trwa do następnego. Tor długiego (B4) maleje w tej samej
 * proporcji co tydzień. Gdy krzywa dogoni plan, plan idzie dalej swoim kształtem.
 * Sprawdzian w bloku powrotu wypada (kalibracja zaraz po przerwie mierzy przerwę, nie formę).
 */
export function applyReturnBlock(weeks: WeekSkeleton[], ret: ReturnBlock): WeekSkeleton[] {
  const from = mondayOf(ret.since)
  const start = weeks.findIndex((w) => w.weekStart >= from)
  if (start === -1) return weeks
  const firstDeload = weeks.findIndex((w, i) => i > start && w.deload)
  const afterIllness = weeks.findIndex((w) => w.weekStart > addDays(ret.since, 6))
  // R-11 bez odciążenia przed taperem: spokojna połowa pozostałych tygodni ładowania, żeby
  // akcenty wróciły przed taperem (T-1), a nie dopiero w nim (inż., jak w planMacrocycle)
  const loadingAhead = weeks.filter((w, i) => i >= start && !w.deload && ['base', 'build', 'peak'].includes(w.phase)).length
  const easyEnd = ret.illness
    ? (afterIllness === -1 ? weeks.length : afterIllness)
    : firstDeload === -1 ? start + Math.ceil(loadingAhead / 2) : firstDeload + 1
  const rule = ret.illness ? 'R-5' : 'R-11'
  let loading = 0
  // ostatni tydzień ładowania: krzywa i cel planu — od nich taper, start i blok po starcie
  let last: { curve: number; planKm: number } | undefined
  const level = (loadingWeeks: number) => RETURN_RESTART_SHARE * ret.previousWeeklyKm * Math.pow(RAMP_PER_LOAD_WEEK, loadingWeeks)
  return weeks.map((w, i) => {
    if (i < start) return w
    const curve = level(loading)
    // P-2: odciążenie to ułamek poziomu bloku przed nim — ostatniego tygodnia ładowania
    // krzywej, nie następnego (jak w volumeSchedule)
    let cap = w.deload ? level(Math.max(0, loading - 1)) * DELOAD_FACTOR : curve
    if (!w.deload && ['base', 'build', 'peak'].includes(w.phase)) {
      // tydzień startu kontrolnego ma cel obniżony mini-taperem (T-9) — nie jest poziomem,
      // od którego liczy się taper, a na krzywej powrotu jest lżejszy o ten sam ułamek
      if (w.tuneUp?.priority === 'B') cap = curve * TUNE_UP_B_FACTOR
      if (!w.tuneUp) last = { curve, planKm: w.targetKm }
      loading++
    } else if (!w.deload && last && last.planKm > 0) {
      // taper, start i blok po starcie w tej samej proporcji do ostatniego tygodnia ładowania
      // co w planie — krzywa nie rośnie po szczycie, więc taper nie jest cięższy (T-4)
      cap = last.curve * (w.targetKm / last.planKm)
    }
    const capped = Math.round(cap)
    // R-11 (inż.) dotyczy tygodni ładowania: taper trzyma intensywność (T-1), a blok po
    // starcie ma własne reguły (R-8). R-5 po chorobie obowiązuje w każdej fazie (zero Z3).
    const easy = i < easyEnd && !w.raceDate && (ret.illness || ['base', 'build', 'peak'].includes(w.phase))
    if (capped >= w.targetKm && !easy) return w
    // sprawdzian wypada z każdego tygodnia bloku, nie tylko ze spokojnych — razem ze swoją
    // flagą i regułami, żeby `why` nie cytował pomiaru, którego nie ma; akcent, który
    // sprawdzian zastępował (T-12, W-13), wraca
    const { testPlanned, ...rest } = w
    const testRules = new Set(testPlanned ? ['W-11', 'W-12', 'W-13'] : [])
    const targetKm = Math.min(w.targetKm, capped)
    return {
      ...rest,
      ...(testPlanned ? { flags: w.flags.filter((f) => f !== messages().macro.timeTrialForCalibration), qualitySessions: w.qualitySessions + 1 } : {}),
      targetKm,
      // tor długiego sprzed przerwy jest podłogą generatora — maleje razem z tygodniem
      ...(w.longKm !== undefined && w.targetKm > 0 ? { longKm: Math.round((w.longKm * targetKm) / w.targetKm) } : {}),
      ...(easy ? { qualitySessions: 0, easyOnly: true } : {}),
      ruleRefs: [...new Set([...w.ruleRefs.filter((r) => !testRules.has(r)), rule, 'P-3'])],
    }
  })
}

/** Tygodnie po starcie celu A — makrocykl nie kończy się w dniu zawodów. */
function transitionWeeks(goal: RaceGoal, weeks: WeekSkeleton[]): WeekSkeleton[] {
  const raceWeek = weeks.at(-1)
  if (!raceWeek) return []
  const before = weeks.slice(-5, -1)
  const base = before.length ? before.reduce((s, w) => s + w.targetKm, 0) / before.length : raceWeek.targetKm
  const cls = goalClass(goal)
  const long = cls === 'half' || cls === 'marathon' || cls === 'ultra'
  const factors = long ? TRANSITION_FACTORS_LONG : TRANSITION_FACTORS_SHORT
  const earliestRun = addDays(goal.date, firstRunOffset(cls))
  return factors.map((factor, j): WeekSkeleton => {
    const weekStart = addDays(raceWeek.weekStart, 7 * (j + 1))
    return {
      weekStart,
      index: raceWeek.index + 1 + j,
      phase: 'transition',
      intensityModel: 'pyramidal',
      targetKm: Math.round(base * factor),
      deload: false,
      keepIntensity: false,
      keepFrequency: false,
      // pierwszy tydzień wyłącznie spokojnie; akcent wraca w drugim (R-8) od najmniejszej dawki
      qualitySessions: j === 0 ? 0 : 1,
      accentProgress: 0,
      ...(j === 0 && earliestRun > weekStart ? { earliestRun } : {}),
      ...(j === 0 ? { firstAfterRace: true } : {}),
      flags: [messages().macro.transitionWeek(j + 1, factors.length)],
      ruleRefs: long ? (j === 0 ? ['R-1', 'R-2', 'R-8'] : ['R-8', 'R-9']) : ['R-10'],
    }
  })
}

/**
 * Data ostatniego wyniku startowego PRZED początkiem planu — punkt zerowy rytmu
 * kalibracji (W-12). Wyniki z horyzontu planu zerują rytm w swoim tygodniu
 * (pętla w `planMacrocycle`); wcześniej liczył się tylko najświeższy wynik, a jego
 * data spoza początku planu dawała ujemny odstęp przycięty do zera — i sprawdzian
 * lądował tydzień po świeżym wyniku na 10 km (regeneracja liczona od pierwotnej
 * daty startu planu, ADR-033).
 */
function lastResultBefore(athlete: AthleteProfile, firstWeek: string): string | undefined {
  return athlete.results.map((r) => r.date).filter((d) => d < firstWeek).sort().at(-1)
}

export function planMacrocycle(input: MacrocycleInput): MacrocyclePlan {
  const { today, goal, athlete } = input
  const firstWeek = mondayOf(today)
  const raceWeek = mondayOf(goal.date)
  const baseOnly = goal.kind === 'base'
  const totalWeeks = Math.floor(diffDays(firstWeek, raceWeek) / 7) + 1
  if (totalWeeks < 1) throw new Error(baseOnly ? messages().macro.baseEndInPast : messages().macro.raceDateInPast)

  const feasibilityWarnings: string[] = []
  const taper = taperWeeksFor(goal)
  const taperWeeks = baseOnly ? 0 : Math.min(taper.weeks, Math.max(1, totalWeeks - 1))
  const loadWeeks = totalWeeks - taperWeeks
  if (totalWeeks < 6 && !baseOnly) {
    feasibilityWarnings.push(
      messages().macro.compressedPlan(totalWeeks),
    )
  }

  const qualityPerWeek = qualitySessionsFor(athlete)

  // Objętość: ramp od recentWeeklyKm do osiągalnego szczytu (P-3), sufit z historii.
  // Po przerwie start i poziom formy według R-11 (volumeBase).
  const { start, level, returning } = volumeBase(athlete, today)
  // E-3 (inż.): bez `peakWeeklyKm` sufit to bieżąca objętość +40% — brak źródła
  const historyCap = Math.min(athlete.peakWeeklyKm ?? level * 1.4, SANITY_CAP_KM)
  const recommended = recommendedPeakKm(goal)
  const loadOnly = loadingWeeksIn(loadWeeks)
  const reachable = start * Math.pow(RAMP_PER_LOAD_WEEK, Math.max(0, loadOnly - 1))
  // P-7/P-8 to podłoga dla niedotrenowanych, nie sufit: atlecie z bazą powyżej
  // rekomendacji utrzymujemy (lekko rozwijamy) jego wolumen zamiast go ciąć.
  // E-3 (inż.): plan ze startem celuje w bieżącą objętość +15% (sufit z historii), nie niżej niż rekomendacja P-7/P-8
  const targetPeak = baseOnly
    ? Math.min(athlete.peakWeeklyKm ?? level * BASE_GROWTH, historyCap)
    : Math.max(recommended, Math.min(level * 1.15, historyCap))
  // ile szczytu plan miałby bez limitu dni — ostrzeżenie mówi, co daje dodatkowy dzień;
  // sufit z budżetu czasu (B7) ma własne ostrzeżenie po stronie CLI
  const withoutDays = Math.round(Math.min(targetPeak, historyCap, reachable, input.peakCapKm ?? Infinity))
  // B1: szczyt nie wyższy niż to, co dni biegacza mieszczą pod sufitami jednostek
  const peakPlanned = weekCapacityKm(athlete, qualityPerWeek, withoutDays)
  if (peakPlanned < withoutDays) feasibilityWarnings.push(messages().macro.daysCapVolume(peakPlanned, withoutDays, athlete.daysAvailable.length))
  if (!baseOnly && peakPlanned < recommended) {
    feasibilityWarnings.push(
      messages().macro.peakBelowRecommended(peakPlanned, recommended, goal.distanceKm),
    )
  }
  if (returning) feasibilityWarnings.push(messages().macro.returnBlock(start, athlete.returning!.previousWeeklyKm))

  // Fazy przed taperem: base/build piramidalnie (I-1), peak polaryzacja (I-2).
  // Podział 40% bazy i 20% szczytu to E-3 (inż.) — źródła podają kolejność faz, nie proporcje.
  const baseWeeks = Math.max(0, Math.round(loadWeeks * 0.4))
  const peakWeeks = Math.max(loadWeeks >= 3 ? 1 : 0, Math.round(loadWeeks * 0.2))
  const buildWeeks = Math.max(0, loadWeeks - baseWeeks - peakWeeks)

  // Starty kontrolne: tylko te w oknie planu i przed celem A (T-9…T-12)
  const tuneUps = (athlete.tuneUpRaces ?? [])
    .filter((r) => r.date >= firstWeek && r.date < goal.date)
    .sort((a, b) => a.date.localeCompare(b.date))
  const tuneUpByWeek = new Map<string, TuneUpRace>()
  for (const r of tuneUps) {
    const ws = mondayOf(r.date)
    // A race is a calendar commitment; never silently discard one.
    const prev = tuneUpByWeek.get(ws)
    if (prev || diffDays(firstWeek, ws) / 7 >= loadWeeks) throw new Error(messages().macro.raceConflict(r.date))
    tuneUpByWeek.set(ws, r)
  }

  const weeks: WeekSkeleton[] = []
  const volume = volumeSchedule(loadWeeks, start, peakPlanned, baseOnly, baseOnly ? undefined : longGoalKm(goal))
  // R-11: po przerwie pierwszy blok wyłącznie spokojnie — z odciążeniem, które go zamyka.
  // Plan bez odciążenia przed taperem (krótki): spokojna połowa tygodni ładowania, żeby
  // akcenty wróciły przed taperem, który trzyma intensywność (T-1), a nie dopiero w nim (inż.)
  const firstDeload = volume.weeks.findIndex((w) => w.deload)
  const easyBlockEnd = returning ? (firstDeload === -1 ? Math.ceil(loadWeeks / 2) : firstDeload + 1) : 0
  // rytm kalibracji: liczony od ostatniego wyniku, resetowany startem kontrolnym (W-12)
  const lastResult = lastResultBefore(athlete, firstWeek)
  const resultDates = athlete.results.map((r) => r.date)
  let weeksSinceCalibration = lastResult
    ? Math.max(0, Math.floor(diffDays(mondayOf(lastResult), firstWeek) / 7))
    : CALIBRATION_GAP_WEEKS
  for (let i = 0; i < totalWeeks; i++) {
    const weekStart = addDays(firstWeek, i * 7)
    // wynik w tym tygodniu to kalibracja tak samo jak start kontrolny (W-12)
    if (resultDates.some((d) => d >= weekStart && d < addDays(weekStart, 7))) weeksSinceCalibration = 0
    const inTaper = i >= loadWeeks
    let phase: MacroPhase
    let intensityModel: IntensityModel
    if (inTaper) {
      phase = i === totalWeeks - 1 ? 'race' : 'taper'
      intensityModel = 'polarized' // I-2 + T-1: intensywność zostaje
    } else if (baseOnly || i < baseWeeks) {
      phase = 'base'
      intensityModel = 'pyramidal'
    } else if (i < baseWeeks + buildWeeks) {
      phase = 'build'
      intensityModel = 'pyramidal'
    } else {
      phase = 'peak'
      intensityModel = 'polarized'
    }

    let targetKm: number
    let longKm: number | undefined
    // taper trzyma dawkę ostatniego bloku (T-1)
    let accentProgress = 1
    let deload = false
    const flags: string[] = [...(i === 0 ? taper.flags : [])]
    const ruleRefs: string[] = []

    if (inTaper) {
      const multipliers = TAPER_MULTIPLIERS[taperWeeks]!
      const m = multipliers[i - loadWeeks]!
      targetKm = Math.round(volume.peakLevel * m)
      ruleRefs.push('T-1', 'T-2', 'T-3', 'T-4', 'T-5')
    } else {
      const planned = volume.weeks[i]!
      deload = planned.deload
      targetKm = planned.km
      accentProgress = planned.accentProgress
      if (planned.longKm !== undefined) longKm = planned.longKm
      ruleRefs.push(...(deload ? ['P-2'] : ['P-1', 'P-3']), intensityModel === 'pyramidal' ? 'I-1' : 'I-2')
      if (i < easyBlockEnd) ruleRefs.push('R-11')
    }
    const easyOnly = !inTaper && i < easyBlockEnd

    // Start kontrolny B/C: mini-taper bez ruszania makrocyklu (T-9).
    // Trajektoria zostaje nietknięta — obniżamy tylko realizację tego tygodnia,
    // żeby jeden start nie cofał całej progresji objętości.
    const tuneUp = tuneUpByWeek.get(weekStart)
    if (tuneUp && !inTaper) {
      if (tuneUp.priority === 'B') {
        targetKm = Math.round(targetKm * TUNE_UP_B_FACTOR)
        ruleRefs.push('T-9')
      }
      // start JEST akcentem tygodnia — nie dokładamy do niego drugiego (T-12)
      ruleRefs.push('T-10', 'T-11', 'T-12')
      flags.push(`start kontrolny ${tuneUp.priority}: ${tuneUp.date}`)
      weeksSinceCalibration = 0
    } else {
      weeksSinceCalibration++
    }

    // Sprawdzian — wyłącznie jako fallback (W-13): brak startów w rytmie kalibracji,
    // faza ładowania, z dala od celu. Nigdy w taperze ani w tygodniu ze startem.
    const weeksToGoal = totalWeeks - 1 - i
    const wantsTest =
      !tuneUp &&
      !easyOnly && // R-11: w pierwszym bloku po przerwie bez pomiaru
      // cała jednostka z ramą, nie sam dystans pomiaru, mieści się w udziale jednej sesji (B2)
      COACH_STYLE.warmupKm + testDistanceKm(goal) + COACH_STYLE.cooldownKm <= SESSION_SHARE_MAX * targetKm &&
      !inTaper &&
      !deload &&
      !tuneUps.some(r => Math.abs(diffDays(weekStart, r.date)) < CALIBRATION_GAP_WEEKS * 7) &&
      i >= TEST_MIN_WEEK_INDEX &&
      weeksSinceCalibration >= CALIBRATION_GAP_WEEKS &&
      weeksToGoal >= TEST_MIN_WEEKS_TO_GOAL
    if (wantsTest) {
      ruleRefs.push('W-11', 'W-12', 'W-13')
      flags.push(messages().macro.timeTrialForCalibration)
      weeksSinceCalibration = 0
    }

    weeks.push({
      weekStart,
      index: i,
      phase,
      intensityModel,
      targetKm,
      deload,
      keepIntensity: inTaper, // T-1
      keepFrequency: inTaper, // T-2
      ...(inTaper ? { sessionCount: Math.min(new Set(athlete.daysAvailable).size, Math.max(COACH_STYLE.minWorkoutsPerWeek, Math.ceil(volume.peakLevel / COACH_STYLE.typicalKmPerSession))) } : {}),
      // start kontrolny liczy się jako akcent tygodnia (T-12), sprawdzian też (W-13)
      // przy jednym akcencie w tygodniu start albo sprawdzian go zastępuje, a nie dochodzi obok
      qualitySessions:
        phase === 'race' ? 1 : easyOnly ? 0 : tuneUp || wantsTest ? qualityPerWeek - 1 : qualityPerWeek,
      ...(easyOnly ? { easyOnly } : {}),
      ...(longKm !== undefined ? { longKm } : {}),
      accentProgress,
      ...(phase === 'race' ? { raceDate: goal.date } : {}),
      ...(tuneUp && !inTaper ? { tuneUp } : {}),
      ...(wantsTest ? { testPlanned: true } : {}), // dzień wybiera mikrocykl (house style)
      flags,
      ruleRefs,
    })
  }

  if (baseOnly) {
    for (const w of weeks) w.ruleRefs.push('P-11')
    return { goal, weeks, peakKmPlanned: peakPlanned, peakKmRecommended: recommended, feasibilityWarnings }
  }
  return { goal, weeks: [...weeks, ...transitionWeeks(goal, weeks)], peakKmPlanned: peakPlanned, peakKmRecommended: recommended, feasibilityWarnings }
}
