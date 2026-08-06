/**
 * Polski katalog tekstów interfejsu. Typ pochodzi z `cli-en.ts`.
 *
 * Dbałość o język, nie tylko o tłumaczenie:
 *  - liczebniki odmieniane (`pluralPl`), nie „plik(ów)",
 *  - liczby dziesiętne z przecinkiem (`formatNumber('pl', …)`),
 *  - cudzysłowy drukarskie „…", półpauza — w zdaniu, dywiz w złożeniach,
 *  - tryb rozkazujący w podpowiedziach („uruchom", „dopisz"), bo tak mówi trener.
 */
import { formatNumber, pluralPl } from '@tren/core'
import type { CliMessages } from './cli-en.ts'

const n = (value: number) => formatNumber('pl', value)
const plik = (count: number) =>
  `${count} ${pluralPl(count, { one: 'plik', few: 'pliki', other: 'plików' })}`
const dni = (count: number) =>
  `${count} ${pluralPl(count, { one: 'dzień', few: 'dni', other: 'dni' })}`
const tygodnie = (count: number) =>
  `${count} ${pluralPl(count, { one: 'tydzień', few: 'tygodnie', other: 'tygodni' })}`
const przerwy = (count: number) =>
  `${count} ${pluralPl(count, { one: 'przerwa', few: 'przerwy', other: 'przerw' })}`

export const cliPl: CliMessages = {
  cmd: {
    banner: 'plan treningowy jako kod, trener jako narzędzie agenta',
    lang: 'język interfejsu: en | pl (albo TREN_LANG / language w tren.yaml)',
    init: 'utwórz profil (interaktywnie w terminalu)',
    initTemplate: 'zapisz szablon bez pytań',
    initFromIntervals: 'zaproponuj profil z historii intervals.icu (wymaga klucza API)',
    plan: 'wygeneruj plan z tren.yaml → plan/plan.yaml + plan/PLAN.md',
    today: 'co mam dziś wybiegać',
    week: 'podgląd tygodnia; -i włącza przeglądanie strzałkami',
    weekInteractive: 'przeglądaj tygodnie klawiszami (←/→, s, q)',
    log: 'zaloguj wykonanie treningu',
    shift: 'zamień treningi w tygodniu (bez argumentów: wybór z listy)',
    why: 'dlaczego ten trening — cel jednostki i reguły z badań',
    adapt: 'przeanalizuj wykonanie i zaproponuj korekty planu',
    desk: 'dzień przy biurku: okna treningowe, przerwy, reguła tempa po pracy',
    review: 'poniedziałkowy rytuał: co było, co to znaczy, co przed nami',
    push: 'wypchnij zaplanowane treningi do intervals.icu (→ zegarek)',
    pull: 'pobierz wykonane aktywności i wellness; porównaj z planem',
    export: 'plik na zegarek (FIT), kalendarz (ICS), rozpiska albo pakiet startowy',
    reschedule: 'przestaw tydzień wokół zajętych dni (solver: akcenty, 48 h, długie)',
    diff: 'co by się zmieniło po regeneracji planu z aktualnego tren.yaml',
    optDate: 'data (domyślnie: dziś)',
    optDateOther: 'inna data niż dziś',
    optDateWeek: 'data w interesującym tygodniu',
    optStatus: 'done|skipped|modified',
    optKm: 'przebiegnięte km',
    optTime: 'czas MM:SS albo HH:MM:SS',
    optNote: 'notatka (samopoczucie, warunki)',
    optFrom: 'data źródłowa',
    optTo: 'data docelowa',
    optFromRange: 'początek zakresu (domyślnie: dziś)',
    optToRange: 'koniec zakresu',
    optDaysAhead: 'ile dni do przodu (domyślnie 14)',
    optDaysBack: 'ile dni wstecz (domyślnie 28)',
    optReviewDays: 'ile dni wstecz podsumować (domyślnie 7)',
    optHeavy: 'dziś ciężki dzień kognitywny (długie sesje z agentami)',
    optBlock: 'dni, w których nie możesz trenować',
    optWhichWeek: 'który tydzień (domyślnie: bieżący)',
    optApply: 'zapisz zmiany w planie (bez tego tylko podgląd)',
    optExportWhat: 'plan | workout | calendar | print | race',
    optExportDate: 'trening do eksportu (dla --what workout)',
    firstSteps: 'Pierwsze kroki: ',
    interactively: 'Interaktywnie: ',
    pickFromList: ' (wybór z listy) · ',
    browseArrows: ' (przeglądanie strzałkami)',
    colorsHint: 'Kolory: NO_COLOR=1 wyłącza, TREN_ASCII=1 wymusza znaki ASCII.',
    spinnerPush: 'wysyłam treningi do intervals.icu…',
    spinnerPull: 'pobieram dane z intervals.icu…',
    spinnerReview: 'przygotowuję przegląd tygodnia…',
    spinnerInit: 'pobieram historię z intervals.icu…',
  },

  common: {
    nextStep: (command: string) => `następny krok: ${command}`,
    saved: (what: string) => `Zapisano ${what}`,
    outsidePlan: (date: string, from: string, to: string) =>
      `${date}: poza zakresem planu (${from} → ${to}).`,
    noPlan: 'Brak planu — uruchom najpierw: tren plan',
    missingConfig: (file: string) => `Brak ${file} — uruchom najpierw: tren init`,
    configErrors: (file: string, errors: string) => `Błędy w ${file}:\n  - ${errors}`,
    cancelled: 'anulowano',
    interrupted: 'przerwano',
    needsTerminal: (command: string) => `Tryb interaktywny wymaga terminala (użyj: ${command}).`,
  },

  init: {
    created: (file: string) => `Utworzono ${file}`,
    fillProfile:
      'Uzupełnij profil — zwłaszcza results: strefy kalibrujemy z wyników startów, ' +
      'nie z odczytów zegarka.',
    exists: (file: string) => `${file} już istnieje — edytuj go albo usuń przed ponownym init.`,
    fromIntervals: (file: string) => `Utworzono ${file} z profilu intervals.icu`,
    window: 'Okno danych',
    currentVolume: 'Objętość bieżąca',
    windowPeak: 'Szczyt okna',
    trainingDays: 'Dni treningowe',
    longRunDay: 'Długie wybieganie',
    lastFourWeeks: 'Ostatnie cztery tygodnie',
    raceCandidates: 'Możliwe starty do kalibracji stref (potwierdź, zanim dopiszesz!)',
    noRaceCandidates: 'Nie znalazłem kandydatów na starty — wynik do kalibracji dopisz ręcznie.',
    fillGoal: 'uzupełnij sekcję goal w tren.yaml → tren plan',
    unnamed: 'bez nazwy',
  },

  plan: {
    weeksOfPlan: (weeks: number) => `${tygodnie(weeks)} planu`,
    volumePeak: 'Szczyt objętości',
    recommendedForDistance: 'Rekomendacja dla dystansu',
    vdot: 'VDOT',
    vdotFromResult: 'z wyniku startu',
    vdotFromGoal: 'z celu — do rekalibracji',
    prediction: 'Predykcja wyniku',
    predictionMethod: (method: string) => `(metoda: ${method})`,
    predictionAlwaysRange: 'Zawsze przedział, nigdy pojedyncza liczba (W-1).',
    goalAmbitious: (target: string) =>
      `Cel ${target} jest ambitniejszy niż przedział — realny przy idealnym cyklu albo wart korekty.`,
    goalConservative: (target: string) => `Cel ${target} jest zachowawczy względem predykcji.`,
    goalInRange: (target: string) => `Cel ${target} mieści się w przedziale predykcji.`,
    structure: 'Struktura',
    phaseSpan: (phase: string, from: number, to: number) => `${phase}: tyg. ${from}–${to}`,
  },

  today: {
    daysToRace: (days: number) => `do startu: ${dni(days)}`,
    weekOf: (index: number, total: number) => `tydzień ${index}/${total}`,
    deload: 'odciążenie',
    restDayTitle: 'Dzień wolny',
    restDayBody: 'Odpoczynek jest częścią planu — adaptacja zachodzi w regeneracji.',
    logged: (status: string) => `Zalogowano: ${status}`,
    whyHint: (date: string) => `dlaczego ten trening: tren why --date ${date}`,
    strengthTitle: (minutes: number) => `Siła · ~${n(minutes)} min`,
    strengthAloneDay: 'Dzień bez biegania — idealny na siłownię (zero konfliktu z sesjami biegowymi).',
    strengthWithEasy:
      'Osobno od biegania: ≥3 h odstępu (S-4). Bieg spokojny obok siły jest OK — ' +
      'wysiłek submaksymalny 24 h po sile nie wykazuje pogorszenia (S-5).',
    strengthWithLong:
      'Osobno od długiego: ≥3 h odstępu (S-4). Jeśli masz wybór — siłownia PO wybieganiu, ' +
      'nie przed; długie jest dziś ważniejszą jednostką.',
    strengthWithQuality: (kind: string) =>
      `UWAGA: dziś jest też ${kind} — S-5 odradza łączenie ciężkiej siły z jednostką ` +
      'jakościową. Przenieś siłownię na inny dzień (albo odpuść ją w tym tygodniu).',
  },

  week: {
    title: (index: number, total: number, weekStart: string) =>
      `Tydzień ${index}/${total} · od ${weekStart}`,
    subtitle: (phase: string, model: string, targetKm: number, plannedKm: number) =>
      `${phase} (${model}) · cel ${n(targetKm)} km · zaplanowano ${n(plannedKm)} km`,
    deloadUpper: 'ODCIĄŻENIE',
    columns: { day: 'dzień', date: 'data', km: 'km', workout: 'trening' },
    rest: 'wolne',
    strengthTag: (minutes: number) => `+ SIŁA ~${n(minutes)} min`,
    raceThisWeek: (date: string) => `Start w tym tygodniu: ${date}`,
    taperNote: 'Taper: objętość w dół, ale intensywność i liczba sesji zostają (T-1/T-2).',
  },

  log: {
    outsidePlan: (date: string) => `Data ${date} poza zakresem planu.`,
    unknownStatus: (status: string) => `Nieznany status „${status}” — done|skipped|modified.`,
    saved: (date: string, status: string) => `Zalogowano ${date}: ${status}.`,
  },

  shift: {
    swapped: (from: string, to: string) => `Zamieniono treningi ${from} ↔ ${to}`,
    weekHint: (date: string) => `podgląd tygodnia: tren week --date ${date}`,
    bothDates: 'Podaj obie daty (--from i --to) albo żadnej — wtedy wybierzesz z listy.',
    sameWeekOnly: 'shift działa w obrębie jednego tygodnia (pełna renegocjacja — tren reschedule)',
    notRaceDay: 'Dnia startu nie ruszamy.',
    dayBeforeRaceLight: 'Dzień przed startem zostaje lekki — nie wstawiam tam akcentu.',
    outsidePlan: (date: string) => `Data ${date} poza planem`,
    accentsTooClose: (a: string, b: string) =>
      `akcenty ${a} i ${b} są dzień po dniu — reguła I-7 zaleca ≥48 h między sesjami jakościowymi`,
    strengthSameDay: (date: string) =>
      `${date}: akcent wylądował w dniu sesji siłowej — S-5 odradza ciężką siłę ` +
      'przy jednostce jakościowej; przenieś siłownię albo wygeneruj plan ponownie (tren plan)',
    strengthDayBefore: (date: string, next: string) =>
      `${date}: sesja siłowa wypada dzień przed akcentem (${next}) — ` +
      'S-5 zaleca ≥24 h odstępu po ciężkiej sile',
  },

  why: {
    title: (date: string) => `Dlaczego ten trening · ${date}`,
    phaseLine: (phase: string, model: string) => `faza: ${phase} (${model})`,
    deloadWeek: 'tydzień odciążeniowy',
    restDay:
      'Dzień wolny. Adaptacja zachodzi w regeneracji — plan trenera zakładał ' +
      '2–3 dni wolne tygodniowo (korpus: PN 94%, PT 92%).',
    rules: 'Reguły',
    strengthRules: 'Reguły siły',
    strengthPurposeTitle: 'Po co siła biegaczowi',
    strengthPurpose:
      'Cel: ekonomia biegu — mniejszy koszt tlenowy tej samej prędkości (F-8, efekt mały: ' +
      '~2–8% w badaniach 10+ tygodni). To NIE jest „ochrona przed urazami" — jedyna ' +
      'metaanaliza na biegaczach dała wynik nieistotny (F-9). Uczciwie: u biegaczy 34–45 lat ' +
      'efekt na ekonomię też wychodzi nieistotny (F-15), a dowody na wynik kończą się na ' +
      '1,5–10 km w laboratorium (F-17). W taperze siła znika z planu (F-13).',
    sourcesHint: (section: string) => `źródła i parametry: docs/science/FOUNDATIONS.md ${section}`,
  },

  push: {
    pushed: (count: number, provider: string, from: string, to: string) =>
      `Wypchnięto ${count} ${pluralPl(count, { one: 'trening', few: 'treningi', other: 'treningów' })} ` +
      `do ${provider} (${from} → ${to})`,
    removedStale: (count: number, dates: string) =>
      `Usunięto ${count} ${pluralPl(count, { one: 'nieaktualny wpis', few: 'nieaktualne wpisy', other: 'nieaktualnych wpisów' })}: ${dates}`,
    nothingToPush: (from: string, to: string) =>
      `Brak treningów do wypchnięcia w zakresie ${from} → ${to}.`,
    columns: { date: 'data', workout: 'trening' },
    willSync: 'Trafią na zegarek przy najbliższej synchronizacji urządzenia.',
    upsertHint: 'ponowny push tych samych dni nadpisuje wpisy (upsert po external_id)',
  },

  pull: {
    title: (provider: string) => `Pobrano z ${provider}`,
    activities: 'Aktywności',
    activitiesValue: (total: number, runs: number, km: number) =>
      `${total} (biegowych: ${runs}, ${n(km)} km)`,
    wellnessEntries: 'Wpisy wellness',
    savedTo: 'Zapisano',
    mismatches: 'Rozjazdy plan ↔ wykonanie',
    columns: { date: 'data', planned: 'plan', actual: 'wykonano', status: 'status' },
    allMatched: 'Wykonanie zgodne z planem w całym zakresie.',
    adaptHint: 'propozycje korekt: tren adapt',
    noPlanSkipped: 'Brak planu — pominięto porównanie.',
  },

  compare: {
    matched: 'zgodne',
    shorter: 'krótsze',
    longer: 'dłuższe',
    missed: 'brak wykonania',
    unplanned: 'nieplanowane',
  },

  adapt: {
    title: (days: number, today: string) => `Analiza wykonania · ${dni(days)} do ${today}`,
    volumeDone: 'Zrealizowana objętość',
    missedSessions: 'Pominięte sesje',
    noSnapshot: 'Brak sync.json — analiza tylko z dziennika. Pełne dane: tren pull',
    diagnosis: 'Diagnoza',
    proposals: 'Propozycje',
    applyHint: (weeklyKm: number) =>
      `Aby zastosować: athlete.recentWeeklyKm: ${weeklyKm} w tren.yaml → tren diff → tren plan. ` +
      'Silnik nie przepisuje planu sam.',
  },

  desk: {
    title: (date: string) => `Dzień przy biurku · ${date}`,
    subtitle: (from: string, to: string) => `praca ${from}–${to}`,
    heavyDay: 'ciężki dzień kognitywny',
    missingSection:
      'Brak sekcji desk w tren.yaml. Dodaj np.:\n' +
      'desk:\n  workStart: "09:00"\n  workEnd: "17:00"\n  lunchMinutes: 45\n  prefer: evening',
    proposedWindow: (label: string, from: string, to: string) =>
      `Proponowane okno: ${label} (${from}–${to})`,
    noWindowFits: 'Żadne okno dnia pracy nie mieści tej jednostki.',
    windows: 'Okna treningowe',
    columns: { window: 'okno', hours: 'godziny', status: 'status' },
    fits: 'mieści się',
    tooShort: 'za krótkie',
    noRunToday: 'Dziś bez biegania',
    breaksStay: 'Przerwy w siedzeniu zostają — to nie jest trening.',
    breaksCount: (count: number) => `Przerwy w siedzeniu (${przerwy(count)})`,
    notes: 'Uwagi',
    rulesHint: (rules: string) => `reguły: ${rules} — docs/science/FOUNDATIONS.md §10.10`,
  },

  reschedule: {
    title: (weekStart: string) => `Renegocjacja tygodnia · od ${weekStart}`,
    blockedDates: (dates: string) => `zablokowane: ${dates}`,
    noBlocks: 'bez blokad',
    unchanged: 'Plan tygodnia zostaje bez zmian — nic nie wymaga przestawienia.',
    columns: { day: 'dzień', date: 'data', before: 'było', after: 'będzie' },
    whatChanges: 'Co się zmienia',
    applied: (files: string) => `Zastosowano — zapisano ${files}`,
    previewHint: 'to podgląd; zastosuj: tren reschedule --apply (z tymi samymi --block)',
    none: '—',
  },

  diff: {
    title: 'Różnice: plan zapisany → plan z aktualnego tren.yaml',
    upToDate: 'Plan aktualny — brak różnic względem regeneracji z tren.yaml.',
    manualShifts: 'plan zawiera ręczne przesunięcia — pokażą się jako różnice',
    weekGone: (weekStart: string) => `- tydzień ${weekStart}: znika z planu`,
    weekVolume: (weekStart: string, before: number, after: number) =>
      `~ tydzień ${weekStart}: objętość ${n(before)} → ${n(after)} km`,
    dayChanged: (date: string, before: string, after: string) => `~ ${date}: ${before} → ${after}`,
    weekNew: (weekStart: string, km: number) => `+ tydzień ${weekStart}: nowy (${n(km)} km)`,
    applyHint: 'zastosowanie: tren plan (nadpisze plan/ — masz go w gicie)',
    localeChanged: (planLocale: string, current: string) =>
      `plan wygenerowano w języku „${planLocale}”, a pracujesz w „${current}” — ` +
      'uruchom tren plan, żeby przegenerować opisy',
  },

  exportCmd: {
    unknownKind: (what: string) =>
      `Nieznany rodzaj eksportu „${what}” — plan|workout|print|calendar|race.`,
    titles: {
      plan: 'Eksport całego planu na zegarek (FIT)',
      workout: 'Eksport treningu na zegarek (FIT)',
      calendar: 'Eksport do kalendarza (ICS)',
      print: 'Rozpiska do wydruku (HTML)',
      race: 'Pakiet startowy (HTML)',
    },
    summary: (files: number, kb: string) => `${plik(files)} · ${kb} kB`,
    andMore: (count: number, dir: string) =>
      `…oraz ${count} ${pluralPl(count, { one: 'kolejny', few: 'kolejne', other: 'kolejnych' })} w ${dir}/`,
    printHint: 'Otwórz w przeglądarce i wydrukuj (Ctrl+P) — układ jest przygotowany pod A4.',
    calendarHint:
      'Zaimportuj plik .ics w Google Calendar / Outlooku — treningi jako zdarzenia całodniowe.',
    fitHint:
      'Skopiuj pliki .fit do katalogu GARMIN/Workouts na zegarku (tryb pamięci masowej) ' +
      'albo zaimportuj w Garmin Connect. Alternatywa bez kabla: tren push.',
    needDate: 'Podaj datę treningu (--date).',
    raceDayNotWorkout: 'To dzień startu — nie eksportujemy go jako treningu.',
    restDayNothing: (date: string) => `${date} to dzień wolny — nie ma czego eksportować.`,
    noWorkouts: 'Plan nie zawiera treningów do eksportu.',
    needTargetOrPrediction:
      'Pakiet startowy potrzebuje celu czasowego (goal.targetTimeSec) albo predykcji ' +
      '(wynik startu w athlete.results) — nie mam z czego policzyć splitów.',
    pickWhat: 'Podaj rodzaj eksportu: tren export --what plan|workout|calendar|print|race',
    scenarioGoal: 'cel',
    scenarioBold: 'śmiało',
    scenarioSafe: 'ostrożnie',
    provenanceWithPrediction: (method: string, generatedAt: string) =>
      `Przedział z predykcji (${method}, W-1) z wyników w tren.yaml; równe tempo = założenie ` +
      `rozpiski (inż., W-10). Wygenerowano ${generatedAt}.`,
    provenanceGoalOnly: (generatedAt: string) =>
      'Wyłącznie cel czasowy z tren.yaml — bez predykcji z wyniku startu (dodaj wynik do ' +
      `athlete.results). Równe tempo = założenie rozpiski (inż.). Wygenerowano ${generatedAt}.`,
    splitsAndBand: (scenarios: string) => `splity + opaska tempa (${scenarios})`,
    calendarEntries: (count: number) =>
      `${count} ${pluralPl(count, { one: 'trening', few: 'treningi', other: 'treningów' })} w kalendarzu`,
    printedWeeks: (weeks: number) => `rozpiska ${tygodnie(weeks)} do wydruku`,
    heat: {
      columns: { temperature: 'temperatura', pace: 'tempo', loss: 'strata' },
      scenarioColumn: (label: string) => `scenariusz „${label}”`,
      lossValue: (secPerKm: number) => `+${n(secPerKm)} s/km`,
      note: (scenarioLabel: string, curveLabel: string, tOptC: number) =>
        `Korekta dotyczy scenariusza „${scenarioLabel}” (tego z opaski) — pozostałe kolumny ` +
        'tabeli splitów są dla warunków optymalnych. Model: El Helou 2012 ' +
        `(n=1,79 mln finiszerów maratonu), krzywa „${curveLabel}”, optimum ${n(tOptC)} °C. ` +
        'To przesunięcie ŚREDNIEJ populacyjnej, nie prognoza dla Ciebie (pogoda tłumaczy ' +
        '~10–33% wariancji tempa). Powyżej 25 °C model milczy — brak danych. Wilgotności, ' +
        'wiatru i słońca świadomie nie liczymy: w danych obserwacyjnych ich efekt okazał się ' +
        'artefaktem korelacji z temperaturą.',
    },
  },

  review: {
    title: 'Przegląd tygodnia',
    pastWeek: 'Za nami',
    subtitle: (from: string, today: string, goalName: string, goalDate: string) =>
      `${from} → ${today} · ${goalName} (${goalDate})`,
    refreshFailed: (error: string) =>
      `Nie udało się odświeżyć danych (${error}) — przegląd na ostatniej migawce.`,
    noKey:
      'Bez klucza API — przegląd z dziennika i ostatniej migawki (tren pull, gdy będzie klucz).',
    doneSessions: 'Wykonane sesje',
    volume: 'Objętość',
    volumeValue: (actualKm: number, plannedKm: number) =>
      `${n(actualKm)} z ${n(plannedKm)} km planu`,
    signals: 'Sygnały',
    noSignals: 'Bez sygnałów do korekty — plan trzyma się rzeczywistości.',
    seeAdapt: 'są propozycje korekt — szczegóły: tren adapt',
    ahead: (weekStart: string) => `Przed nami · tydzień od ${weekStart}`,
    todo: 'Do zrobienia',
    phase: 'Faza',
    volumeAhead: (km: number, sessions: number) =>
      `${n(km)} km w ${sessions} ${pluralPl(sessions, { one: 'sesji', few: 'sesjach', other: 'sesjach' })}`,
    toRace: 'Do startu',
    toRaceValue: (days: number) =>
      `${days} ${pluralPl(days, { one: 'dzień', few: 'dni', other: 'dni' })}`,
    raceThisWeek: (date: string) =>
      `Start w tym tygodniu: ${date} — dzień przed zostaje wolny (T-10).`,
    timeTrialThisWeek: (date: string) =>
      `Sprawdzian: ${date} — po nim dopisz wynik do tren.yaml, inaczej strefy stoją (W-11).`,
    keySession: 'Kluczowa jednostka',
    todoWriteResult: 'dopisz wynik pomiaru do athlete.results → tren diff → tren plan',
    todoSeeAdapt: 'przejrzyj propozycje: tren adapt (zmiany zatwierdzasz w tren.yaml)',
    todoPush: 'wyślij nadchodzący tydzień na zegarek: tren push --days 7',
    todoPrint: 'rozpiska na lodówkę: tren export --what print',
    todoReschedule:
      'jeśli sesje wypadają przez pracę — przestaw je (tren reschedule), zamiast tracić',
    todoNextRace: (date: string, what: string) => `najbliższy start kontrolny: ${date} (${what})`,
  },

  wizard: {
    header: 'tren — konfiguracja profilu',
    enterSkips: 'Enter pomija pytania opcjonalne.',
    goal: 'Cel',
    goalName: 'Nazwa zawodów',
    goalDate: 'Data startu',
    goalDistance: 'Dystans',
    goalTarget: 'Cel czasowy',
    defaultGoalName: 'Bieg docelowy',
    yourRunning: 'Twoje bieganie',
    recentVolume: 'Objętość z ostatnich tygodni [km]',
    peakVolume: 'Historyczne maksimum tygodniowe [km]',
    trainingDays: 'Dni treningowe',
    resultHeader: 'Wynik startu do kalibracji stref',
    resultWhy:
      'Strefy liczymy z wyniku zawodów — odczyty progów z zegarka zawyżają tempo.',
    resultDistance: 'Dystans ostatniego startu',
    resultTime: 'Czas',
    resultDate: 'Data startu',
    deskHeader: 'Tryb biurkowy',
    workStart: 'Początek pracy',
    workEnd: 'Koniec pracy',
    hintDate: 'RRRR-MM-DD',
    hintDistance: '5 · 10 · hm · m · km',
    hintTime: 'HH:MM:SS',
    hintOptional: 'opcjonalnie',
    hintTimeOptional: 'HH:MM:SS, opcjonalnie',
    hintHour: 'HH:MM',
    hintHourOptional: 'HH:MM, opcjonalnie',
    hintDays: 'np. wt sr cz sb nd',
    enterAccepts: (value: string) => `Enter = ${value}`,
    errTime: 'Czas w formacie MM:SS albo HH:MM:SS',
    errDistance: 'Podaj dystans: 5, 10, hm, m albo liczbę kilometrów',
    errUnknownDay: (day: string, allowed: string) => `Nieznany dzień „${day}” — użyj: ${allowed}`,
    errNoDays: 'Podaj co najmniej jeden dzień',
    errDate: 'Data w formacie RRRR-MM-DD',
    errBadDate: 'Nieprawidłowa data',
    errKm: 'Podaj liczbę kilometrów',
    errHour: 'Godzina w formacie HH:MM',
    intervalsFound: 'Znalazłem klucz intervals.icu — pobrać historię i zaproponować profil?',
    intervalsFetching: 'pobieram ostatnie 16 tygodni…',
    intervalsProposed: 'propozycje z historii — Enter przy pytaniu przyjmuje wartość',
    intervalsRange: (from: string, to: string, maxKm: number) =>
      `${from} → ${to}, maks. ${n(maxKm)} km`,
    raceLooksLike: (label: string, reason: string) =>
      `W historii wygląda na start: ${label} (${reason})`,
    useThisResult: 'Użyć tego wyniku do kalibracji?',
    dayCodes: ['pn', 'wt', 'sr', 'cz', 'pt', 'sb', 'nd'],
  },

  picker: {
    exportWhat: 'Co wyeksportować?',
    exportPrint: 'Rozpiska do wydruku',
    exportPrintHint: 'HTML pod A4 — Ctrl+P',
    exportRace: 'Pakiet startowy',
    exportRaceHint: 'splity + opaska tempa do wycięcia',
    exportPlan: 'Cały plan na zegarek',
    exportPlanHint: 'pliki .fit dla każdego treningu',
    exportWorkout: 'Jeden trening na zegarek',
    exportWorkoutHint: 'pojedynczy .fit',
    exportCalendar: 'Kalendarz',
    exportCalendarHint: '.ics do Google/Outlooka',
    whichWorkout: 'Który trening?',
    whichDay: 'Na który dzień przenieść?',
    whatToMove: 'Który trening przesunąć?',
    keys: 'strzałki/cyfry · Enter zatwierdza · q anuluje',
    weekKeys: '←/→ tygodnie · t dziś · s przesuń trening · q wyjście',
  },

  print: {
    columns: { day: 'Dzień', date: 'Data', km: 'Km', workout: 'Trening', done: '✓' },
    weekTitle: (index: number) => `Tydzień ${index}`,
    weekMeta: (weekStart: string, phase: string, km: number) =>
      `od ${weekStart} · ${phase} · ${n(km)} km`,
    deload: 'odciążenie',
    subtitle: (weeks: number, peakKm: number, vdot: number, generatedAt: string) =>
      `Plan ${weeks}-tygodniowy · szczyt ${n(peakKm)} km/tydz. · VDOT ${n(vdot)} · ` +
      `wygenerowano ${generatedAt}`,
    footer: 'Wygenerowane przez tren. Uzasadnienia jednostek: tren why --date <data>.',
    strengthTag: (minutes: number) => `[+ siła ~${n(minutes)} min]`,
    rest: '—',
  },

  racePack: {
    title: (raceName: string) => `${raceName} — pakiet startowy`,
    subtitle: (date: string, distanceKm: number) => `${date} · ${n(distanceKm)} km`,
    splits: 'Splity narastająco',
    band: (scenario: string) => `Opaska — ${scenario}`,
    finish: 'META',
    km: 'km',
    cutHint: '✂ wytnij wzdłuż przerywanej linii, owiń wokół nadgarstka, sklej taśmą',
    conditions: 'Korekta na warunki',
  },

  calendar: {
    strengthSummary: (minutes: number) => `siła ~${n(minutes)} min`,
  },

  sync: {
    missingKey: (secretFile: string) =>
      'Brak klucza API intervals.icu. Ustaw zmienną TREN_INTERVALS_API_KEY ' +
      `albo zapisz klucz w pliku ${secretFile} (dodaj go do .gitignore!).\n` +
      'Klucz: intervals.icu → Settings → Developer Settings.',
  },
}
