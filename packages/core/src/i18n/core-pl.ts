/**
 * Polski katalog tekstów domenowych. Typ pochodzi z `core-en.ts` — brak klucza
 * albo inna sygnatura to błąd kompilacji, nie cicha dziura w tłumaczeniu.
 *
 * Opisy jednostek są **głosem trenera z korpusu** (50 planów 2020–2025), nie
 * tłumaczeniem angielskiego: „przerwy 2 minutowe w marszu", „na koniec treningu
 * 1 kilometr truchtu". To ta wersja jest oryginałem, angielska jest odpowiednikiem.
 *
 * Odmiana: `pluralPl` obsługuje trzy formy i ułamki (2,5 kilometra), a liczby
 * dziesiętne mają przecinek — patrz `formatNumber`.
 */
import { formatNumber, formatPace, pluralPl } from './locale.ts'
import type { CoreMessages } from './core-en.ts'

const n = (value: number) => formatNumber('pl', value)
/** „1 kilometr / 3 kilometry / 5 kilometrów / 2,5 kilometra" */
const km = (value: number) =>
  `${n(value)} ${pluralPl(value, { one: 'kilometr', few: 'kilometry', other: 'kilometrów' })}`
const minut = (value: number) =>
  `${n(value)} ${pluralPl(value, { one: 'minuta', few: 'minuty', other: 'minut' })}`
/** Forma przymiotnikowa przy przerwach: „przerwy 2 minutowe", „przerwa 1 minutowa". */
const przerwy = (value: number) =>
  value === 1 ? 'przerwa 1 minutowa' : `przerwy ${n(value)} minutowe`

export const corePl: CoreMessages = {
  units: {
    km,
    meters: (value: number) =>
      `${n(value)} ${pluralPl(value, { one: 'metr', few: 'metry', other: 'metrów' })}`,
    minutes: minut,
    kmPerWeek: (value: number) => `${n(value)} km/tydz.`,
    pace: formatPace,
  },

  weekday: {
    mon: 'poniedziałek', tue: 'wtorek', wed: 'środa', thu: 'czwartek',
    fri: 'piątek', sat: 'sobota', sun: 'niedziela',
  },
  weekdayShort: {
    mon: 'PN', tue: 'WT', wed: 'ŚR', thu: 'CZ', fri: 'PT', sat: 'SB', sun: 'ND',
  },

  kind: {
    easy: 'spokojne',
    long: 'długie',
    easy_hills: 'podbiegi',
    quality_intervals: 'interwały',
    quality_continuous: 'akcent ciągły',
    sharpener: 'rozruch',
    test: 'sprawdzian',
    race: 'START',
  },

  phase: {
    base: 'baza',
    build: 'budowanie',
    peak: 'szczyt',
    taper: 'taper',
    race: 'tydzień startowy',
  },

  intensityModel: {
    pyramidal: 'piramidalnie',
    polarized: 'polaryzacja',
  },

  workout: {
    warmup: (value: number) => `${km(value)} (tempo rozgrzewkowe)`,
    cooldown: (value: number) => `Na koniec treningu ${km(value)} truchtu.`,
    easy: (value: number) => `${km(value)} (w tempie spokojnym).`,
    veryEasy: (value: number) => `${km(value)} (w tempie bardzo spokojnym).`,
    easyBeforeHills: (value: number) => `${km(value)} (w tempie spokojnym)`,
    hills: (reps: number, repM: number) => `podbiegi: ${reps}*${repM} metrów (spokojnie).`,
    intervalsKm: (reps: number, pace: string, recoveryMin: number) =>
      `${reps}*1 km (w tempie ${pace} na km), ${przerwy(recoveryMin)} w marszu.`,
    intervals3Km: (reps: number, pace: string, recoveryMin: number) =>
      `${reps}*3 km (w tempie ${pace} na km), ${przerwy(recoveryMin)} w marszu.`,
    intervalsVo2: (reps: number, pace: string, jogMin: number, halfway: number, walkMin: number) =>
      `${reps}*1 km (w tempie ${pace} na km), ${przerwy(jogMin)} w truchcie, ` +
      `po ${halfway} odcinku przerwa ${n(walkMin)} minutowa w marszu.`,
    intervalsShort: (reps: number, repM: number, pace: string, jogMin: number) =>
      `${reps}*${repM} metrów (w tempie ${pace} na km), ${przerwy(jogMin)} w truchcie.`,
    alternating: (totalKm: number, fast: string, easyPace: string) =>
      `${n(totalKm)} km biegu zmiennego (na zmianę 1 km w tempie ${fast} na km, ` +
      `1 km w tempie ${easyPace} na km).`,
    progression: (totalKm: number, from: string, to: string) =>
      `${n(totalKm)} km w tempie narastającym (od ${from} do ${to} na km).`,
    timeTrial: (value: number) =>
      `${km(value)} na czas (maksymalnie, na pełnym wypoczynku) — ` +
      'wynik dopisz do tren.yaml (athlete.results), z niego kalibrujemy strefy.',
    raceGoal: (name: string) => `START: ${name.toUpperCase()}.`,
    raceOther: (what: string) => `START W ${what}.`,
    restDay: 'dzień wolny',
  },

  strength: {
    session: () =>
      'Siła ciężka ~35 min: przysiad lub martwy ciąg + wykroki + wspięcia na palce, ' +
      '3 serie × 4–6 powtórzeń CIĘŻKO (≥80% 1RM, ostatnie powtórzenie trudne, ale bez upadku ruchu), ' +
      'przerwy 2–3 min. Wielostawowo, wolny ciężar. Nie do wyczerpania (S-7).',
    taperNote:
      'Taper: siła odstawiona — 4 tygodnie bez siłowni nie kasują adaptacji (F-13).',
    shortfallByAccents: (placed: number, target: number) =>
      `W tym tygodniu zmieściły się ${placed} z ${target} sesji siły — akcenty i długie ` +
      'mają pierwszeństwo (S-5); nie upychamy siły kosztem jakości biegania.',
    shortfallByDays: (placed: number, target: number, days: string) =>
      `W tym tygodniu zmieściły się ${placed} z ${target} sesji siły — wybrane dni (${days}) ` +
      'kolidują z akcentami albo z odstępem 48 h. Poszerz `strength.days` w tren.yaml ' +
      'albo zostaw puste, a silnik dobierze dni sam.',
  },

  predict: {
    noResults: 'Brak wyników do kalibracji (W-1)',
    ultraNoModel: 'ultra: brak modelu predykcji o zweryfikowanej trafności — przedział szacunkowy',
    noHalfMarathon:
      'brak wyniku z półmaratonu — predykcja VDOT jest optymistyczna na maratonie (W-4)',
    outOfRiegelRange:
      'wynik źródłowy poza zakresem stosowalności ekstrapolacji 3,5–230 min (W-5)',
  },

  zones: {
    sameDuration: 'Próby muszą mieć różne czasy trwania',
    trialTooShort: 'krótsza próba <2 min — CS zawyżone (Z-7)',
    trialTooLong: 'dłuższa próba >20 min — poza zakresem modelu (Z-7)',
    negativeDPrime: "D' ujemne — próby niespójne, powtórz test",
  },

  macro: {
    raceDateInPast: 'Data startu w przeszłości',
    ultraTaperExtrapolated: 'T-8: ultra — ekstrapolacja bez źródła',
    compressedPlan: (weeks: number) =>
      `tylko ${weeks} tyg. do startu — plan skompresowany, bez pełnej progresji`,
    peakBelowRecommended: (planned: number, recommended: number, distanceKm: number) =>
      `szczyt planu ${planned} km/tydz. poniżej rekomendacji ${recommended} km/tydz. ` +
      `dla ${n(distanceKm)} km (P-7/P-8) — cel czasowy obarczony ryzykiem`,
    timeTrialForCalibration: 'sprawdzian: brak startów w kalendarzu — kalibracja stref',
  },

  adapt: {
    layoffDiagnosis: (days: number) =>
      `${days} ${pluralPl(days, { one: 'dzień', few: 'dni', other: 'dni' })} bez biegania — ` +
      'plan sprzed przerwy jest nieaktualny.',
    postRaceDiagnosis: (days: number, distanceKm: number) =>
      `${days} ${pluralPl(days, { one: 'dzień', few: 'dni', other: 'dni' })} po starcie na ` +
      `${n(distanceKm)} km — okres powrotu.`,
    newResultDiagnosis: (distanceKm: number, date: string) =>
      `Nowy wynik: ${n(distanceKm)} km (${date}) — strefy do przeliczenia.`,
    uncalibratedTestDiagnosis: (date: string, distanceKm: number) =>
      `Wykonany pomiar ${date} (${n(distanceKm)} km) nie ma wyniku w athlete.results — ` +
      'strefy dalej liczą się ze starszego startu.',
    uncalibratedTestAction: (date: string, distanceKm: number, timeSec: string) =>
      `Dopisz wynik do athlete.results: { date: "${date}", distanceKm: ${n(distanceKm)}, ` +
      `timeSec: ${timeSec} } → tren diff → tren plan.`,
    timeSecPlaceholder: '<czas w sekundach>',
    restartAfterLayoff: (weeklyKm: number, days: number) =>
      `Restart: objętość ×0,5–0,6 (≈${weeklyKm} km/tydz.) po ${days} ` +
      `${pluralPl(days, { one: 'dniu', few: 'dniach', other: 'dniach' })} przerwy, ` +
      'bez sesji Z3 przez 5–7 dni, potem normalna progresja. ' +
      'Nie nadrabiamy opuszczonych kilometrów.',
    restartExtrapolated:
      'Protokół restartu po przerwie to ekstrapolacja bez bezpośredniego źródła (R-5) — ' +
      'traktuj jako punkt wyjścia, nie normę.',
    postRaceUltra:
      'Ultra: dłuższa cisza niż po maratonie, powrót wg samopoczucia — brak danych, ' +
      'żeby podać konkretny protokół.',
    postRaceMarathon:
      'Pierwsze 48 h bez biegania. Potem 40 min w tempie okolic LT1 co drugi dzień ' +
      '(48/96/144 h) — powrót w 48 h nie pogarsza regeneracji, poprawia skoczność w 96 h.',
    postRaceShort:
      'Lekkie bieganie ~40 min w tempie spokojnym co drugi dzień; bez akcentów ' +
      'do końca pierwszego tygodnia.',
    noUltraSources:
      'Brak źródeł dla powrotu po ultra — reguły maratońskiej NIE ekstrapolujemy (R-3).',
    recalibrateFromResult:
      'Zrekalibruj strefy z wyników startów, nie z odczytów zegarka.',
    olderResultStillUsed: 'strefy dalej liczą się ze starszego startu.',
    timeTrialWithoutResult:
      'Sprawdzian bez wpisanego wyniku jest treningiem, który niczego nie zmienił.',
    complianceLow: (pct: number, actualKm: number, plannedKm: number) =>
      `Wykonano ${pct}% zaplanowanej objętości (${actualKm} z ${plannedKm} km).`,
    reduceVolume: (realistic: number) =>
      'Plan jest napisany na objętość, której nie realizujesz. Urealnij bazę do ' +
      `≈${realistic} km/tydz. (średnia z ostatnich 3 tyg.) i progresuj od niej. ` +
      'Plan wykonywany w 100% bije ambitniejszy plan wykonywany w 60%.',
    complianceHigh: (pct: number) => `Regularnie przekraczasz plan (${pct}% objętości).`,
    raiseVolume: (raised: number) =>
      `Podnieś bazę w tren.yaml do ≈${raised} km/tydz. — ale kolejny cykl i tak ` +
      'ograniczy wzrost do ~10%/tydz.; skoki objętości nie kupują formy szybciej.',
    onTrack: (pct: number, missed: number) =>
      `Wykonanie zgodne z planem (${pct}% objętości, pominiętych sesji: ${missed}).`,
    holdCourse: 'Bez zmian — kontynuuj bieżący mezocykl.',
    missedQuality: (count: number) =>
      `Pominięte akcenty: ${count}. To one, nie kilometry, budują górny zakres formy.`,
    shiftInsteadOfLosing:
      'Jeśli akcenty regularnie wypadają przez pracę — przesuwaj je (tren shift), ' +
      'zamiast je tracić. Dwie sesje jakościowe w tygodniu to cel (I-8).',
  },

  desk: {
    badTime: (value: string) => `Zła godzina "${value}" — format HH:MM`,
    endBeforeStart: 'workEnd musi być późniejsze niż workStart',
    windowMorning: 'rano',
    windowLunch: 'lunch',
    windowEvening: 'wieczór',
    stairSnack: '3 min schodów (exercise snack)',
    walkBreak: (minutes: number) => `${n(minutes)} min chodu`,
    heavyDayPaceNotFeel:
      'Dziś ciężki dzień kognitywny, a w planie jest akcent: prowadź go PO TEMPIE z zegarka, ' +
      'nie po odczuciu. Zmęczenie umysłowe podnosi odczuwany wysiłek przy niezmienionej ' +
      'fizjologii (tętno, laktat, VO₂ bez różnic) i skraca wytrzymałość o ~15%. ' +
      'Jeśli tempo docelowe „nie idzie" mimo prawidłowego tętna — to percepcja, nie forma.',
    moveAccentEarlier:
      'Jeśli możesz, przenieś akcent przed blok pracy albo na inny dzień (tren shift) — ' +
      'sesja do wyczerpania przed wymagającą pracą umysłową też pogarsza jej jakość.',
    easyIsSafe:
      'Spokojna jednostka po ciężkim dniu umysłowym jest bezpieczna — nie ścigaj się z zegarkiem, ' +
      'trzymaj górną granicę tempa spokojnego.',
    nothingFits: (needMin: number) =>
      `Żadne okno nie mieści ${needMin} min — skróć jednostkę albo przesuń ją na inny dzień. ` +
      'Skrócony trening wykonany bije pełny pominięty.',
    restDayBreaks:
      'Dziś dzień wolny od biegania — przerwy w siedzeniu zostają, one nie są treningiem.',
    lowAdherenceByDesign:
      'Przerwy projektuj pod niską adherencję: lepiej trafić w połowę z nich niż zaplanować idealny ' +
      'rytm i porzucić go po tygodniu (6-miesięczny RCT w biurach nie zmienił zachowań).',
    sittingIsNotInjuryRisk:
      'Godziny przed monitorem nie zmieniają struktury planu treningowego — siedzenie nie jest ' +
      'udokumentowanym czynnikiem ryzyka urazów biegowych. Przerwy robimy dla metabolizmu, nie dla biegania.',
  },

  solver: {
    longRunOffPreferredDay: (weekday: string) =>
      `długie wybieganie poza preferowanym dniem (${weekday})`,
    longRunNextToAccent: (date: string) =>
      `długie wybieganie sąsiaduje z akcentem ${date} — dwa ciężkie dni z rzędu (S-9)`,
    dateOutsideWeek: (date: string) => `data ${date} jest poza tym tygodniem — pominięta`,
    cannotBlockRaceDay: 'dnia startu nie da się zablokować — solver go nie rusza',
    droppedEasy: 'zabrakło dnia — spokojna jednostka kosztuje najmniej (objętość, nie bodziec)',
    droppedOther: 'zabrakło dnia po zablokowaniu terminów',
    noMakeUp:
      'Nie nadrabiamy odpuszczonych kilometrów w kolejnych dniach — dokładanie objętości ' +
      'po wypadniętej sesji działa przeciw progresji (P-1/P-3).',
  },

  heat: {
    invalidTemp: 'Nieprawidłowa temperatura.',
    tooCold: (tempC: number, minC: number) =>
      `${n(tempC)} °C jest poniżej zakresu danych (od ${n(minC)} °C). Model opisuje ` +
      'wyłącznie ciepłą stronę krzywej — mróz ma swój własny koszt (wiatr, nawierzchnia, ' +
      'ubranie), którego tu nie liczymy, więc zwrócenie „zero straty" byłoby wprowadzaniem w błąd.',
    tooHot: (tempC: number, maxC: number) =>
      `${n(tempC)} °C wykracza poza dane modelu (do ${n(maxC)} °C) — powyżej tej granicy ` +
      'biegi masowe bywają odwoływane (WBGT 21 °C to próg rekomendowany), a każda liczba ' +
      'byłaby ekstrapolacją. Biegnij po odczuciu i pilnuj nawodnienia.',
    curveElite: 'czołówka',
    curveFastAmateur: 'szybki amator',
    curveMedian: 'średnia stawki',
    curveBackHalf: 'druga połowa stawki',
  },

  infer: {
    noRuns: 'Brak aktywności biegowych w oknie 16 tygodni — profil uzupełnij ręcznie.',
    tooFewWeeks: (active: number, window: number) =>
      `Tylko ${active} ${pluralPl(active, { one: 'aktywny tydzień', few: 'aktywne tygodnie', other: 'aktywnych tygodni' })} ` +
      `w ostatnich ${window} — za mało na wiarygodną inferencję. Podaj objętość ręcznie.`,
    tooFewInBlock:
      'W ostatnim bloku treningowym mniej niż 2 aktywne tygodnie — podaj objętość ręcznie.',
    layoffAtEnd: (days: number, date: string) =>
      `Ostatni bieg ${days} ${pluralPl(days, { one: 'dzień', few: 'dni', other: 'dni' })} temu (${date}) — ` +
      'generator potraktuje to jako restart po przerwie; objętość poniżej odnosi się do ' +
      'ostatniego aktywnego bloku.',
    zeroWeeksInBlock: (from: string, to: string) =>
      `W bloku odniesienia (${from} → ${to}) są tygodnie zerowe (urlop? choroba?) — ` +
      'mediana liczona z tygodni aktywnych.',
    noFixedLongRunDay: 'Długie wybieganie nie ma stałego dnia w historii — wskaż go sam.',
    recentBasis: (weeks: number, from: string, to: string) =>
      `mediana ${weeks} ${pluralPl(weeks, { one: 'aktywnego tygodnia', few: 'aktywnych tygodni', other: 'aktywnych tygodni' })} ` +
      `${from} → ${to} (intervals.icu)`,
    raceReasonDistance: (label: string) => `dystans ~${label}`,
    raceReasonName: 'nazwa jak start',
    raceReasonPace: 'tempo w górnym decylu okna',
    distanceHalf: 'HM',
    distanceMarathon: 'maraton',
  },
}
