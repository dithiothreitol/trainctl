/**
 * Polski katalog tekstów domenowych. Typ pochodzi z `core-en.ts` — brak klucza
 * albo inna sygnatura to błąd kompilacji, nie cicha dziura w tłumaczeniu.
 *
 * Opisy jednostek są **głosem trenera z korpusu** (50 planów 2020–2025), nie
 * tłumaczeniem angielskiego: „przerwy 2-minutowe w marszu", „na koniec treningu
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
/** Forma przymiotnikowa przy przerwach: „przerwy 2-minutowe", „przerwa 1-minutowa" (PLAN-v0.7, decyzja 4). */
const przerwy = (value: number) =>
  value === 1 ? 'przerwa 1-minutowa' : `przerwy ${n(value)}-minutowe`

export const corePl: CoreMessages = {
  shorten: {
    badBudget: 'Podaj pełne minuty: budżet i siła 0–1440, przygotowanie 0–120.',
    repeats: (reps: number, meters: number, pace: string, recovery: number) => `${reps} × ${meters} m po ${pace}/km; ${recovery} s przerwy po każdym powtórzeniu`,
    setBreak: (afterRep: number, sec: number, mode: 'walk' | 'jog') => `po ${afterRep}. powtórzeniu dodatkowo ${sec} s ${mode === 'walk' ? 'marszu' : 'truchtu'}`,
  },
  units: {
    km,
    meters: (value: number) =>
      `${n(value)} ${pluralPl(value, { one: 'metr', few: 'metry', other: 'metrów' })}`,
    minutes: minut,
    kmPerWeek: (value: number) => `${n(value)} km/tydz.`,
    pace: formatPace,
  },

  dates: {
    invalidIso: (iso: string) => `Nieprawidłowa data ISO: ${iso}`,
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
    transition: 'okres przejściowy',
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
    easyStrides: (value: number, count: number, meters: number) =>
      `${km(value)} (w tempie spokojnym), na koniec ${count} przebieżek po około ${n(meters)} metrów.`,
    easyBeforeHills: (value: number) => `${km(value)} (w tempie spokojnym)`,
    hills: (reps: number, repM: number) => `podbiegi: ${reps}×${repM} metrów (spokojnie).`,
    intervalsKm: (reps: number, pace: string, recoveryMin: number) =>
      `${reps}×1 km (w tempie ${pace} na km), ${przerwy(recoveryMin)} w marszu.`,
    intervals3Km: (reps: number, pace: string, recoveryMin: number) =>
      `${reps}×3 km (w tempie ${pace} na km), ${przerwy(recoveryMin)} w marszu.`,
    intervalsVo2: (reps: number, pace: string, jogMin: number, halfway: number, walkMin: number) =>
      `${reps}×1 km (w tempie ${pace} na km), ${przerwy(jogMin)} w truchcie, ` +
      `po ${halfway} odcinku przerwa ${n(walkMin)}-minutowa w marszu.`,
    intervalsShort: (reps: number, repM: number, pace: string, jogMin: number) =>
      `${reps}×${repM} metrów (w tempie ${pace} na km), ${przerwy(jogMin)} w truchcie.`,
    alternating: (totalKm: number, fast: string, easyPace: string) =>
      `${n(totalKm)} km biegu zmiennego (na zmianę 1 km w tempie ${fast} na km, ` +
      `1 km w tempie ${easyPace} na km).`,
    progression: (totalKm: number, from: string, to: string) =>
      `${n(totalKm)} km w tempie narastającym (od ${from} do ${to} na km).`,
    timeTrial: (value: number) =>
      `${km(value)} na czas (maksymalnie, na pełnym wypoczynku) — ` +
      'wynik dopisz do trainctl.yaml (athlete.results), z niego kalibrujemy strefy.',
    raceGoal: (name: string) => `START: ${name.toUpperCase()}.`,
    raceOther: (what: string) => `START W ${what}.`,
    restDay: 'dzień wolny',
  },

  notation: {
    warmup: 'RG',
    cooldown: 'SCH',
    recovery: 'p.',
    walk: 'marsz',
    jog: 'trucht',
    hills: 'podbiegi',
    strides: 'przebieżki',
    timeTrial: 'na czas',
    race: 'START',
    drill: 'technika',
    sendoff: 'co',
    strength: 'siła',
    afterRep: (rep: number) => `po ${rep}. odcinku`,
    legend: (unit: string) => `RG rozgrzewka · SCH schłodzenie · p. przerwa · tempo w min/${unit}`,
    clubLegend: (unit: string) =>
      `OWB1 bieg spokojny · BC2 drugi zakres · BC3 odcinki w trzecim zakresie · BNP bieg z narastającą prędkością · BZ bieg zmienny · WT wytrzymałość tempowa · RT rytmy · SB siła biegowa (podbiegi) · RG rozgrzewka · SCH schłodzenie · p. przerwa · tempo w min/${unit}`,
    part: {
      warmup: 'rozgrzewka', cooldown: 'schłodzenie', easy: 'spokojnie', steady: 'tempo', intervals: 'główna',
      hills: 'podbiegi', progression: 'narastające', alternating: 'zmienny', race: 'start',
      timeTrial: 'na czas', strides: 'przebieżki', work: 'praca', drill: 'technika', rest: 'przerwa',
    },
    jogDown: 'zbieg',
    hr: 'tętno',
    hrNote: (bpm: number) => `Tętno ≤${bpm} ud./min (Z-2): pułap biegu spokojnego; celem zostaje tempo.`,
  },

  coaching: {
    cue: {
      veryEasy: 'Bardzo lekko; spokojny, swobodny oddech.',
      easy: 'Swobodna rozmowa pełnymi zdaniami.',
      easySwim: 'Swobodny wydech do wody; technika bez napięcia.',
      moderate: 'Wyraźny wysiłek; możliwe krótkie zdania.',
      moderateSwim: 'Równy rytm; bez pogarszania chwytu wody.',
      hard: 'Mocno, ale bez sprintu; pozostaw zapas na ostatni odcinek.',
      hardSwim: 'Mocno, ale z kontrolą ruchu i oddechu; bez wstrzymywania oddechu.',
    },
    byFeel: 'według odczucia',
    label: {
      objective: 'Cel', why: 'Dlaczego', success: 'Wykonanie', adjustment: 'Dostosowanie',
      phase: 'Faza', cycleWeek: 'Tydzień cyklu', planGoal: 'Cel planu', experience: 'Doświadczenie',
    },
    context: {
      standalone: 'Jednostka samodzielna, bez wskazanej fazy planu.',
      reduced: 'Zmniejszona dawka pozwala odpocząć między blokami obciążenia.',
      taper: 'Krótki bodziec podtrzymuje rytm przy mniejszej objętości przed startem.',
      dose: 'Dawkę ograniczają poziom doświadczenia i dostępny czas; progresja nie wymaga zwiększania intensywności.',
      brick: 'Zakładka: ćwicz spokojne przejście z roweru do biegu i kontrolę tempa po zmianie dyscypliny.',
    },
    running: {
      test: 'Zmierz aktualną dyspozycję biegową, zachowując protokół sprawdzianu.',
      race: 'Zrealizuj cel startowy i kontroluj początkowe tempo.',
      long: 'Rozwijaj wytrzymałość długotrwałą i utrzymanie techniki przy narastającym zmęczeniu.',
      hills: 'Ćwicz rytm i siłę biegową na podbiegu, kontrolując technikę.',
      progression: 'Rozwijaj kontrolę tempa narastającego bez gwałtownego przyspieszania.',
      intervals: 'Rozwijaj zdolność utrzymania tempa wskazanego w odcinkach; zachowaj zaplanowane przerwy.',
      easy: 'Buduj wytrzymałość tlenową przy swobodnym oddechu.',
      success: 'Utrzymaj zakresy tempa i równą technikę do końca; zapisz czas oraz RPE po treningu.',
      adjustment: 'Przy utracie techniki zwolnij; skracaj jednostkę narzędziem planu, zachowując rozgrzewkę i schłodzenie.',
    },
    level: { trained: 'wytrenowany', regular: 'regularnie trenujący', new: 'początkujący lub nieokreślony' },
    reason: {
      race: 'Start pozostaje osobnym wydarzeniem; jego dystans i czas pochodzą z celu, a nie z dawki tygodniowego szablonu.',
      hard: 'Krótszy dystans celu i zadeklarowane wytrenowanie pozwalają wybrać krótką, ograniczoną serię mocniejszych odcinków.',
      sustained: 'Dłuższy cel lub poziom regularny preferuje kontrolowaną pracę podprogową zamiast bardzo mocnych odcinków.',
      technique: 'Ćwiczenie izoluje jedną umiejętność, a następująca po nim część główna przenosi ją do zwykłego ruchu.',
      openers: 'Przed startem liczba odcinków jest mała; dodatkowy czas pozostaje spokojny.',
      tempo: 'Baza lub lżejszy tydzień preferuje umiarkowaną moc i pełne przerwy.',
      swimCss: 'Powtarzane długości z przerwami pozwalają ćwiczyć równe tempo bez wymuszania jednego długiego odcinka.',
      swimTimed: 'Bez aktualnego CSS czas i RPE określają mocniejsze odcinki; przerwy pozwalają odzyskać kontrolę oddechu i techniki.',
      runRepeats: 'Krótkie odcinki z przerwami pozwalają ćwiczyć równy, mocniejszy wysiłek. Tempo wynika z aktualnego wyniku biegowego, a przy jego braku prowadzi RPE.',
      easy: 'Spokojna intensywność pozwala rozwijać regularność i technikę bez dodawania kolejnego akcentu.',
    },
    recipe: {
      race: { title: 'Start', objective: 'Zrealizuj cel startowy według osobnego planu tempa i warunków na trasie.' },
      brickBike: { title: 'Rower przed zakładką', objective: 'Utrzymaj równy wysiłek i zakończ rower z zapasem na bieg.' },
      brickRun: { title: 'Bieg po rowerze', objective: 'Przećwicz przejście do biegu; zacznij spokojnie i ustabilizuj krok.' },
      bikeOpeners: { title: 'Krótkie pobudzenie', objective: 'Podtrzymaj rytm intensywniejszej jazdy przy małej dawce pracy.' },
      bikeTempo: { title: 'Kontrolowane tempo', objective: 'Rozwijaj utrzymanie równomiernego, umiarkowanego wysiłku.' },
      bikeAerobicPower: { title: 'Moc tlenowa: krótkie odcinki', objective: 'Rozwijaj tolerancję powtarzanych mocnych odcinków bez sprintowania.' },
      bikeThreshold: { title: 'Odcinki progowe', objective: 'Ćwicz równą moc blisko FTP, bez spadku jakości kolejnych odcinków.' },
      bikeSustained: { title: 'Dłuższe odcinki podprogowe', objective: 'Rozwijaj zdolność utrzymania mocnej, kontrolowanej jazdy przez dłuższy czas.' },
      swimOpeners: { title: 'Krótkie odcinki przed startem', objective: 'Zachowaj czucie tempa i świeżość przy małej liczbie odcinków.' },
      swimControlledSpeed: { title: 'Szybkość z kontrolą techniki', objective: 'Utrzymuj sprawny chwyt wody i rytm przy krótkich, mocnych odcinkach.' },
      swimCssRepeats: { title: 'Równe odcinki w pobliżu CSS', objective: 'Ćwicz powtarzalne tempo i technikę na kolejnych odcinkach.' },
      swimTimedRepeats: { title: 'Odcinki czasowe według odczucia' },
      technique: {
        title: 'Technika i spokojny rytm',
        objectiveSwim: 'Popraw pozycję ciała, wydech i spokojny powrót ramienia, następnie przenieś je do kraula.',
        objective: 'Ćwicz swobodny, równy ruch bez zwiększania wysiłku.',
      },
      runRepeats: { title: 'Kontrolowane odcinki biegowe', objective: 'Ćwicz utrzymanie równego tempa w odcinkach z pełną kontrolą kroku.' },
      endurance: { title: 'Spokojna wytrzymałość długotrwała', objective: 'Wydłużaj czas utrzymania swobodnego wysiłku i stabilnej techniki.' },
      aerobic: { title: 'Spokojny trening tlenowy', objective: 'Buduj wytrzymałość tlenową bez dużego zmęczenia.' },
    },
    step: {
      recoverySwim: 'Odpocznij przy ścianie po każdym odcinku, również ostatnim.',
      recovery: 'Bardzo lekki ruch po każdym odcinku, również ostatnim.',
      warmup: 'Zacznij bardzo spokojnie; stopniowo ustabilizuj rytm i oddech.',
      cooldown: 'Stopniowo zmniejsz wysiłek i rozluźnij ruch.',
      drillBreathing: 'Spokojny kraul: patrz w dół, wydychaj powietrze do wody, odwróć głowę do naturalnego wdechu. Nie wydłużaj przerw w oddychaniu.',
      drillRecovery: 'Luźny powrót ramienia w kraulu: lekko prowadź opuszki nad powierzchnią wody. Nie wymuszaj ruchu w barku; potem płyń zwykłym kraulem.',
      drillName: 'Ćwiczenie techniczne',
      transfer: 'Przenieś ćwiczoną umiejętność do spokojnego kraula.',
      swimRepeats: 'Utrzymuj równy rytm i jakość ruchu od pierwszego do ostatniego odcinka.',
      swimSpare: 'Dopłyń spokojnie; utrzymaj swobodną sylwetkę.',
      swimFinish: 'Płyń spokojnie; zakończ przy ścianie.',
      lastRep: 'Ostatni odcinek wykonaj równie równo jak pierwszy; nie przyspieszaj ponad cel.',
      drill: 'Równy, swobodny rytm; rozluźnij barki i nie zwiększaj siły ruchu.',
      brick: 'Kontroluj oddech i rytm podczas zmiany dyscypliny; bez przyspieszania na zmęczeniu.',
      even: 'Utrzymuj równy wysiłek i swobodną technikę.',
    },
    adjust: {
      replacedQuality: 'Akcent zastąpiony spokojną jednostką ze względu na doświadczenie lub regenerację.',
      swimNoSet: 'Za mało czasu na pełną serię jakościową; wybrano spokojne pływanie.',
      swimTimed: 'Bez wiarygodnego CSS lub miejsca na pełne długości: odcinki czasowe według RPE, bez zgadywania dystansu. Kończ przy ścianie.',
      noSet: 'Za mało czasu na pełną serię wraz z rozgrzewką i przerwami; wybrano spokojny trening.',
      noDrill: 'Budżet nie mieści ćwiczenia technicznego i części głównej po ćwiczeniu; wykonaj spokojną jednostkę.',
      rpeOnly: 'Intensywność określa RPE 1–10; brak aktualnego pomiaru nie jest zastępowany wynikiem z innej dyscypliny.',
      slowDown: 'Jeśli wysiłek lub technika wykraczają poza wskazówki, zwolnij albo skróć serię. Nie nadrabiaj pominiętych odcinków.',
    },
    success: {
      race: 'Zrealizuj osobny plan startowy; zapisz wynik i obserwacje z przebiegu zawodów.',
      technique: 'Przenieś wskazówkę z ćwiczenia do części głównej: zachowaj spokojny oddech i swobodny ruch.',
      intervals: 'Utrzymaj zadany wysiłek i pełne przerwy; porównaj tempo lub moc pierwszego i ostatniego odcinka.',
      easy: 'Utrzymaj swobodny oddech i stabilną technikę; zakończ z zapasem sił.',
      log: 'Zapisz czas, odczuwany wysiłek RPE i ewentualne zmniejszenie liczby powtórzeń.',
    },
  },

  fitStep: {
    warmup: 'Rozgrzewka',
    cooldown: 'Trucht',
    rep: 'Odcinek',
    recovery: 'Przerwa',
    hillRep: 'Podbieg',
    hillDown: 'Zbieg',
    repeat: (reps: number) => `Powtórz ${reps}x`,
    alternating: 'Bieg zmienny',
    faster: 'Szybciej',
    slower: 'Wolniej',
    progression: 'Narastające',
    progressionPart: (index: number, total: number) => `Narastanie ${index}/${total}`,
    easy: 'Spokojnie',
    steady: 'Tempo',
    timed: 'Na czas',
    walk: 'Marsz',
    jog: 'Trucht',
    stride: 'Przebieżka',
  },

  syncName: {
    easy: 'Spokojne',
    long: 'Długie wybieganie',
    easy_hills: 'Podbiegi',
    quality_intervals: 'Interwały',
    quality_continuous: 'Akcent ciągły',
    sharpener: 'Rozruch przedstartowy',
    test: 'Sprawdzian na czas',
    race: 'START',
    strength: 'Siła',
  },

  syncNotice: {
    raceRejected: (dates: string) => `intervals.icu nie przyjęło startów (${dates}) w żadnej postaci; nie ma ich w kalendarzu.`,
    strengthRejected: (dates: string) => `intervals.icu nie przyjęło sesji siłowych (${dates}); treningi biegowe są wypchnięte.`,
    raceFallback: (dates: string) => `intervals.icu nie przyjęło startów jako zawodów (${dates}); trafiły do kalendarza jako zwykłe wpisy.`,
  },

  syncError: {
    badKey: ' — sprawdź klucz API (Settings → Developer Settings)',
    rateLimit: ' — limit zapytań (5000/dzień, 2500/15 min)',
  },

  strength: {
    transitionNote:
      'Pierwszy tydzień po starcie: jeszcze bez siły — wraca w następnym tygodniu jedną lżejszą sesją (R-9).',
    sessionIntro: () =>
      'Siła na wejście ~35 min: przysiad lub martwy ciąg + wykroki + wspięcia na palce, 3 serie × 6 powtórzeń ciężarem, ' +
      'który podniósłbyś 8–10 razy (~75% 1RM) — nauka ruchu przed ciężkimi tygodniami (F-18). Nie do wyczerpania (S-7).',
    sessionMaintenance: () =>
      'Siła podtrzymująca ~25 min: przysiad lub martwy ciąg + wspięcia na palce, 2 serie × 3–5 powtórzeń CIĘŻKO ' +
      '(≥80% 1RM), przerwy 2–3 min. Jedna sesja w tygodniu utrzymuje to, co zbudował blok (F-12, F-14). Nie do wyczerpania (S-7).',
    peakNote:
      'Szczyt: jedna sesja siły w tygodniu — wystarcza, żeby utrzymać adaptację, gdy bieganie ma pierwszeństwo (F-12, F-14).',
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
      'kolidują z akcentami albo z odstępem 48 h. Poszerz `strength.days` w trainctl.yaml ' +
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
    raceDurationUnknown: 'Czas startu jest nieznany; nie można potwierdzić okna treningowego.',
    raceConflict: (date: string) => `Konflikt kalendarza zawodów ${date}: kilka startów w tygodniu lub start kontrolny w taperze. Jawnie rozstrzygnij konflikt w kalendarzu.`,
    raceDateInPast: 'Data startu w przeszłości — wpisz następny cel w trainctl.yaml',
    baseEndInPast: 'Data końca planu bazowego (goal.until) jest w przeszłości',
    transitionWeek: (week: number, total: number) => `po starcie: tydzień ${week} z ${total} powrotu do treningu (R-8)`,
    ultraTaperExtrapolated: 'T-8: ultra — ekstrapolacja bez źródła',
    returnBlock: (start: number, previous: number) =>
      `powrót po przerwie: pierwszy blok wyłącznie spokojnie, od ${n(start)} km/tydz. (około połowy ${n(previous)} km/tydz. sprzed przerwy), ` +
      'wzrost w granicach P-3 — R-11, wartości inżynierskie bez badań nad parametrami',
    daysCapVolume: (planned: number, wanted: number, days: number) =>
      `${days === 1 ? 'przy 1 dniu biegowym' : `przy ${days} dniach biegowych`} tydzień mieści ${planned} km bez przeciążenia jednej jednostki (S-10, E-3) — ` +
      `plan zatrzymuje szczyt na tej wartości zamiast ${wanted} km/tydz.; resztę da kolejny dzień biegowy`,
    compressedPlan: (weeks: number) =>
      `tylko ${weeks} tyg. do startu — plan skompresowany, bez pełnej progresji`,
    peakBelowRecommended: (planned: number, recommended: number, distanceKm: number) =>
      `szczyt planu ${planned} km/tydz. poniżej rekomendacji ${recommended} km/tydz. ` +
      `dla ${n(distanceKm)} km (P-7/P-8) — cel czasowy obarczony ryzykiem`,
    timeTrialForCalibration: 'sprawdzian: brak startów w kalendarzu — kalibracja stref',
    tuneUpFlag: (priority: string, date: string) => `start kontrolny ${priority}: ${date}`,
  },

  adapt: {
    incompleteData: 'Dane wykonania są niepełne. Brak wpisów nie potwierdza przerwy w treningu; potwierdź pominięte sesje lub odśwież dane przed zmianą objętości.',
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
      `timeSec: ${timeSec} } → trainctl diff → trainctl plan.`,
    timeSecPlaceholder: '<czas w sekundach>',
    restartAfterLayoff: (weeklyKm: number, days: number) =>
      `Restart: objętość ×0,5–0,6 (≈${weeklyKm} km/tydz.) po ${days} ` +
      `${pluralPl(days, { one: 'dniu', few: 'dniach', other: 'dniach' })} przerwy, ` +
      'pierwszy blok do najbliższego odciążenia wyłącznie spokojnie (R-11), potem plan wraca w granicach P-3. ' +
      'Nie nadrabiamy opuszczonych kilometrów.',
    restartExtrapolated:
      'Protokół restartu po przerwie to ekstrapolacja bez bezpośredniego źródła (R-5, R-11) — ' +
      'traktuj jako punkt wyjścia, nie normę.',
    restartAfterIllness: (weeklyKm: number, days: number) =>
      `Powrót po chorobie: objętość ×0,5–0,6 (≈${weeklyKm} km/tydz.) po ${days} ` +
      `${pluralPl(days, { one: 'dniu', few: 'dniach', other: 'dniach' })} przerwy, ` +
      'co najmniej 7 dni wyłącznie spokojnie (do końca tygodnia, w którym mijają, R-5), potem plan wraca w granicach P-3. ' +
      'Nie nadrabiamy opuszczonych kilometrów.',
    injuryReturn:
      'Przerwa z powodu kontuzji: silnik nie proponuje objętości. Kiedy i ile znowu biegać, ustalasz ze ' +
      'specjalistą (R-6, R-7); potem zapisz powrót i uruchom adapt ponownie.',
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
    complianceLimited: (pct: number, km: number) =>
      `Biegasz więcej, niż mieści plan (${pct}% objętości), ale budżet czasu albo dni mieszczą w tym tygodniu ≈${n(km)} km. ` +
      'Nadwyżka mówi o czasie, nie o bazie: żeby plan ją uwzględnił, zwiększ budżet w sekcji `time` albo dodaj dzień w `daysAvailable`.',
    raiseVolume: (raised: number) =>
      `Podnieś bazę w trainctl.yaml do ≈${raised} km/tydz. — ale kolejny cykl i tak ` +
      'ograniczy wzrost do ~10%/tydz.; skoki objętości nie kupują formy szybciej.',
    onTrack: (pct: number, missed: number) =>
      `Wykonanie zgodne z planem (${pct}% objętości, pominiętych sesji: ${missed}).`,
    holdCourse: 'Bez zmian — kontynuuj bieżący mezocykl.',
    returnPlanned: 'Plan ma już przyjęty blok powrotu po tej przerwie; nie ma czego przygotować od nowa (R-5, R-11).',
    returnInProgress: 'Trwa blok powrotu: objętość prowadzi krzywa powrotu, więc zgodność w oknie, w którym jest jeszcze przerwa, nie zmienia bazy (R-5, R-11).',
    missedQuality: (count: number) =>
      `Pominięte akcenty: ${count}. To one, nie kilometry, budują górny zakres formy.`,
    shiftInsteadOfLosing:
      'Jeśli akcenty regularnie wypadają przez pracę — przesuwaj je (trainctl shift), ' +
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
      'Jeśli możesz, przenieś akcent przed blok pracy albo na inny dzień (trainctl shift) — ' +
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
    blockedStrength: (date: string) => `Usunięto siłę z zablokowanego dnia ${date}.`,
    badConstraints: 'Nieprawidłowy budżet czasu lub czas przygotowania.',
    pinnedConflict: (date: string) => `Chroniony dzień ${date} koliduje z dostępnością lub budżetem czasu.`,
    noTime: 'Brak wystarczającego okna czasowego; jednostkę odpuszczono zamiast ścieśniać.',
    longRunOffPreferredDay: (weekday: string) =>
      `długie wybieganie poza preferowanym dniem (${weekday})`,
    dateOutsideWeek: (date: string) => `data ${date} jest poza tym tygodniem — pominięta`,
    cannotBlockRaceDay: 'dnia startu nie da się zablokować — solver go nie rusza',
    droppedEasy: 'zabrakło dnia — spokojna jednostka kosztuje najmniej (objętość, nie bodziec)',
    droppedOther: 'zabrakło dnia po zablokowaniu terminów',
    droppedLine: (kind: string, from: string, reason: string) =>
      `odpuszczone: ${kind} z ${from} — ${reason}`,
    tradeoffLine: (note: string) => `kompromis: ${note}`,
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
    allWithheld: (count: number, sources: string) =>
      `W oknie jest ${count} ${pluralPl(count, { one: 'aktywność', few: 'aktywności', other: 'aktywności' })}, ` +
      `ale ${sources} nie udostępnia ich danych przez API intervals.icu — nie ma z czego ` +
      'wywnioskować profilu. Podepnij zegarek (Garmin, Coros, Wahoo) do intervals.icu ' +
      'bezpośrednio, nie przez Stravę.',
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
