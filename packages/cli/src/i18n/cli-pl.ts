/**
 * Polski katalog tekstów interfejsu. Typ pochodzi z `cli-en.ts`.
 *
 * Dbałość o język, nie tylko o tłumaczenie:
 *  - liczebniki odmieniane (`pluralPl`), nie „plik(ów)",
 *  - liczby dziesiętne z przecinkiem (`formatNumber('pl', …)`),
 *  - cudzysłowy drukarskie „…", półpauza — w zdaniu, dywiz w złożeniach,
 *  - tryb rozkazujący w podpowiedziach („uruchom", „dopisz"), bo tak mówi trener.
 */
import { formatNumber, pluralPl } from 'trainctl-core'
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
const sesje = (count: number) =>
  `${count} ${pluralPl(count, { one: 'sesja', few: 'sesje', other: 'sesji' })}`

import { improvePl } from './improve-pl.ts'
import { coachPl } from './coach-pl.ts'

export const cliPl: CliMessages = {
  coach: coachPl,
  improve: improvePl,
  cmd: {
    banner: 'plan treningowy jako kod, trener jako narzędzie agenta',
    lang: 'język interfejsu: en | pl (albo TRAINCTL_LANG / language w trainctl.yaml)',
    version: 'wypisz zainstalowaną wersję',
    init: 'utwórz profil (interaktywnie w terminalu)',
    initTemplate: 'zapisz szablon bez pytań',
    initFromIntervals: 'zaproponuj profil z historii intervals.icu (wymaga klucza API)',
    plan: 'wygeneruj plan z trainctl.yaml → plan/plan.yaml + plan/PLAN.md',
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
    diff: 'co by się zmieniło po regeneracji planu z aktualnego trainctl.yaml',
    check: 'sprawdź plan: inwarianty silnika + integralność pliku; błędy psują kod wyjścia (CI)',
    optStrict: 'ostrzeżenia też psują kod wyjścia (do CI)',
    optDiffPlan: 'porównaj z innym plikiem planu (gałąź scenariusza albo worktree)',
    optAgent: 'dopisz też pliki integracji agenta: claude | codex | all',
    rules: 'reguły silnika po ID, z klasą źródła; jedna reguła w całości',
    optFresh: 'regeneracja od zera: porzuca chronione dni, zatwierdzenia, przypięcia i budżety (zostają w gicie)',
    optDate: 'data (domyślnie: dziś)',
    optDateOther: 'inna data niż dziś',
    optDateWeek: 'data w interesującym tygodniu',
    optStatus: 'done|skipped|modified',
    optKm: 'przebiegnięte km',
    optTime: 'czas MM:SS albo HH:MM:SS',
    optRpe: 'wysiłek sesji jako liczba całkowita 1–10 (CR-10)',
    optStrength: 'zaloguj sesję siły zamiast biegu: done | skipped',
    optMinutes: 'minuty sesji siłowej',
    optNote: 'notatka (samopoczucie, warunki)',
    optFrom: 'data źródłowa',
    optTo: 'data docelowa',
    optFromRange: 'początek zakresu (domyślnie: dziś)',
    optToRange: 'koniec zakresu',
    optDaysAhead: 'ile dni do przodu (domyślnie 14)',
    optDaysBack: 'ile dni wstecz (domyślnie 28)',
    optPullFrom: 'czytaj eksport plików FIT/TCX/GPX z tego katalogu (albo pliku) zamiast z intervals.icu',
    optReviewDays: 'ile dni wstecz podsumować (domyślnie 7)',
    optHeavy: 'dziś ciężki dzień kognitywny (długie sesje z agentami)',
    optBlock: 'dni, w których nie możesz trenować',
    optWhichWeek: 'który tydzień (domyślnie: bieżący)',
    optApply: 'zapisz zmiany w planie (bez tego tylko podgląd)',
    optExportWhat: 'plan | workout | calendar | print | race | mobile',
    optExportDate: 'trening do eksportu (dla --what workout)',
    firstSteps: 'Pierwsze kroki: ',
    interactively: 'Interaktywnie: ',
    pickFromList: ' (wybór z listy) · ',
    browseArrows: ' (przeglądanie strzałkami)',
    colorsHint: 'Kolory: NO_COLOR=1 wyłącza, TRAINCTL_ASCII=1 wymusza znaki ASCII.',
    datesHint:
      'Daty: RRRR-MM-DD, dziś/jutro/wczoraj (także today/tomorrow/yesterday), +N/-N dni albo dzień tygodnia ' +
      '(pn…nd, mon…sun). log, review, adapt i pull patrzą wstecz; pozostałe komendy — w przód.',
    dirHint: 'Katalog: -C <ścieżka> albo TRAINCTL_DIR; TRAINCTL_TODAY=RRRR-MM-DD symuluje datę (zawsze ogłoszoną).',
    optJson: 'wypisz JSON ({ code, data, output }) zamiast sformatowanego tekstu',
    optDir: 'katalog treningowy (domyślnie TRAINCTL_DIR, potem bieżący katalog)',
    optCommit: 'zacommituj pliki zmienione przez komendę (opcjonalnie z własną wiadomością)',
    status: 'stan katalogu treningowego: profil, plan, dane, propozycje, git',
    completion: 'wypisz skrypt uzupełniania dla powłoki: bash | zsh | fish | pwsh',
    completionShell: (shells: string) => `Nieznana powłoka — użyj jednej z: ${shells}`,
    dirMissing: (dir: string) => `Katalog ${dir} nie istnieje.`,
    examples: 'Przykłady:',
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
    noPlan: 'Brak planu — uruchom najpierw: trainctl plan',
    planMalformed: (file: string) =>
      `${file} to nie jest kompletny plan (brak goal/weeks) — uruchom trainctl check, ` +
      'żeby zobaczyć co jest połamane, albo trainctl plan, żeby przegenerować',
    missingConfig: (file: string) => `Brak ${file} — uruchom najpierw: trainctl init`,
    planFromOldEngine: (current: string) =>
      `Plan powstał silnikiem sprzed 0.2.0, działa ${current}. trainctl diff pokaże, co zmieniłaby regeneracja.`,
    planFromOtherEngine: (planVersion: string, current: string) =>
      `Plan wygenerował silnik ${planVersion}, działa ${current}. Przed 1.0 regeneracja może dać inne ` +
      'tygodnie — trainctl diff pokaże różnice.',
    planSchemaNewer: (file: string, version: number) =>
      `${file} ma schemat planu ${version}, nowszy niż obsługiwany przez tę wersję (1) — zaktualizuj trainctl.`,
    configErrors: (file: string, errors: string) => `Błędy w ${file}:\n  - ${errors}`,
    cancelled: 'anulowano',
    interrupted: 'przerwano',
    needsTerminal: (command: string) => `Tryb interaktywny wymaga terminala (użyj: ${command}).`,
    labelOk: 'OK',
    labelWarn: '!',
    labelError: 'BŁĄD',
    badTime: (text: string) => `Nieprawidłowy czas „${text}” — użyj MM:SS albo HH:MM:SS`,
  },

  init: {
    created: (file: string) => `Utworzono ${file}`,
    createdAgents: (file: string) =>
      `Utworzono ${file} — instrukcja trenerska dla Twojego agenta (Claude Code, Codex)`,
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
    fillGoal: 'uzupełnij sekcję goal w trainctl.yaml → trainctl plan',
    gitignoreHeader: 'trainctl — sekrety i ślady GPS, nigdy ich nie commituj',
    gitignoreUpdated: (patterns: string) =>
      `Dopisano do .gitignore: ${patterns} — klucz do intervals.icu i eksportowane ślady GPS nie trafią do gita`,
    unnamed: 'bez nazwy',
    agentUnknown: (agent: string, allowed: string) => `Nieznany agent „${agent}” — użyj jednego z: ${allowed}.`,
    agentHint: 'używasz Claude Code albo Codex? trainctl init --agent claude|codex dodaje pliki integracji',
    agentCreated: (file: string) => `Utworzono ${file} — integracja agenta w tym katalogu`,
    agentExists: (file: string) => `${file} już istnieje — bez zmian. Dopisz do niego:`,
    agentClaudeNext:
      'Claude Code: zaufaj temu katalogowi, potem raz uruchom /plugin install trainctl@trainctl ' +
      '(plugin daje narzędzia MCP, skille trenera i kontrolę po edycji planu).',
    agentCodexNext: 'Codex: zaufaj projektowi; Codex czyta AGENTS.md i uruchamia serwer MCP trainctl z .codex/config.toml.',
    agentQuestion: 'Którego agenta tu używasz?',
    agentNone: 'żadnego / później',
    gitignoreNotCommitted: '.gitignore miał Twoje niezacommitowane zmiany, więc nie trafił do commita — przejrzyj go i zacommituj sam.',
  },

  plan: {
    baseUntil: (date: string) => `budowanie bazy do ${date}`,
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
    regenSection: 'Co zmienia regeneracja',
    sameCycle: (start: string) =>
      `Ten sam cykl treningowy: fazy zostają zakotwiczone w ${start}; przyszłe dni idą za trainctl.yaml.`,
    newCycleVolume: (km: number) =>
      `Nowy cykl startuje od ${n(km)} km/tydz. (athlete.recentWeeklyKm albo zatwierdzona baza) — zaktualizuj profil, jeśli trening się zmienił.`,
    newCycle: (weekStart: string) =>
      `Nowy cykl treningowy od ${weekStart} (inny dystans celu albo poprzedni start już za Tobą); ` +
      'wcześniejsze tygodnie zostają jako historia.',
    changedDays: 'Zmienione dni',
    keptDays: 'Dni bez zmian',
    reasons: {
      past: 'przeszłe',
      recorded: 'zalogowane',
      pinned: 'przypięte',
      baseline: 'dzień zatwierdzenia bazy',
      approved: 'zatwierdzony wyjątek czasowy',
      edited: 'ręczna edycja',
      budget: 'ponad budżet czasu',
    },
    loadKept: (km: number, date: string) =>
      `Zostaje zatwierdzona baza ${n(km)} km/tydz. z ${date} (adapt). ` +
      'Zmiana athlete.recentWeeklyKm w trainctl.yaml ją nadpisze.',
    loadCleared: (km: number) =>
      `athlete.recentWeeklyKm zmieniło się od zatwierdzonej bazy ${n(km)} km/tydz. — wygrywa profil.`,
    droppedWeeks: (weeks: string) => `Tygodnie, których nie ma już w planie: ${weeks} (poprzednia wersja jest w gicie).`,
    moreLines: (count: number) => `… i ${count} więcej — trainctl diff wypisze wszystkie różnice.`,
    upToDate: 'Plan aktualny — trainctl.yaml daje te same przyszłe dni; nic nie zapisano.',
    unreadable: (file: string, reason: string) =>
      `Nie da się użyć ${file} (${reason}) — popraw go (konflikt merge'a?) albo uruchom trainctl plan --fresh, żeby zacząć od zera; poprzednia wersja jest w gicie.`,
    unreadableReason: { parse: 'to nie jest poprawny YAML', shape: 'brak celu albo tygodni' },
    overwroteUnreadable: (file: string) => `Poprzedni ${file} był nieużyteczny i został zastąpiony — jest w gicie, gdyby był potrzebny.`,
    freshDropped: (items: string) => `Regeneracja od zera (--fresh); porzucono: ${items}. Poprzedni plan jest w gicie.`,
    freshItems: {
      loadState: (km: number) => `zatwierdzoną bazę (${n(km)} km/tydz.)`,
      pinned: (count: number) => `${count} ${pluralPl(count, { one: 'przypięty dzień', few: 'przypięte dni', other: 'przypiętych dni' })}`,
      budgets: (count: number) => `${count} ${pluralPl(count, { one: 'budżet czasu', few: 'budżety czasu', other: 'budżetów czasu' })}`,
      approved: (count: number) => `${count} ${pluralPl(count, { one: 'zatwierdzony wyjątek czasowy', few: 'zatwierdzone wyjątki czasowe', other: 'zatwierdzonych wyjątków czasowych' })}`,
      edited: (count: number) => `${count} ${pluralPl(count, { one: 'ręcznie edytowany dzień', few: 'ręcznie edytowane dni', other: 'ręcznie edytowanych dni' })}`,
      history: (count: number) => `${count} ${pluralPl(count, { one: 'wpis historii zmian', few: 'wpisy historii zmian', other: 'wpisów historii zmian' })}`,
    },
  },

  today: {
    daysToRace: (days: number) => `do startu: ${dni(days)}`,
    daysAfterRace: (days: number) => `${dni(days)} po starcie`,
    weekOf: (index: number, total: number) => `tydzień ${index}/${total}`,
    deload: 'odciążenie',
    restDayTitle: 'Dzień wolny',
    restDayBody: 'Odpoczynek jest częścią planu — adaptacja zachodzi w regeneracji.',
    logged: (status: string) => `Zalogowano: ${status}`,
    whyHint: (date: string) => `dlaczego ten trening: trainctl why --date ${date}`,
    strengthLogged: (status: string) => `Siła zalogowana: ${status}`,
    estimate: (minutes: number) => `około ${minutes} min razem z przygotowaniem`,
    next: (date: string, weekday: string, kind: string, km: number) => `następny: ${weekday} ${date} · ${kind} · ${n(km)} km`,
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
    badRpe: (rpe: string) =>
      `RPE „${rpe}” wypada poza skalę — podaj liczbę całkowitą 1–10 (10 = wysiłek maksymalny).`,
    saved: (date: string, status: string) => `Zalogowano ${date}: ${status}.`,
    planned: 'W planie',
    recorded: 'Zapis',
    testTime: (time: string) => `odcinek pomiarowy ${time}`,
    unplanned: 'W planie był tu dzień wolny — wpis liczy się jako bieg poza planem.',
    strengthSaved: (date: string, status: string) => `Zalogowano siłę ${date}: ${status}.`,
    strengthStatus: (value: string) => `Status siły „${value}” — użyj done albo skipped.`,
    strengthOnly: 'Wpis siły przyjmuje tylko --minutes i --note; bieg zaloguj osobno.',
    strengthMinutes: 'Minuty siły: liczba całkowita 1–300.',
    strengthUnplanned: 'Tego dnia nie było siły w planie — wpis zostaje jako sesja dodatkowa.',
    prompt: {
      which: 'Który trening?',
      status: 'Status',
      statusHint: 'done / skipped / modified',
      km: 'Kilometry',
      time: 'Czas',
      timeHint: 'MM:SS albo G:MM:SS, Enter pomija',
      testTime: 'Czas samego odcinka pomiarowego',
      rpe: 'Wysiłek 1–10 (RPE)',
      rpeHint: 'Enter pomija',
      note: 'Notatka',
      noteHint: 'jak poszło, warunki — Enter pomija',
      badStatus: 'Wpisz done, skipped albo modified (d / s / m).',
      logged: 'zalogowany',
    },
  },

  shift: {
    swapped: (from: string, to: string) => `Zamieniono treningi ${from} ↔ ${to}`,
    weekHint: (date: string) => `podgląd tygodnia: trainctl week --date ${date}`,
    bothDates: 'Podaj obie daty (--from i --to) albo żadnej — wtedy wybierzesz z listy.',
    sameWeekOnly: 'shift działa w obrębie jednego tygodnia (pełna renegocjacja — trainctl reschedule)',
    notRaceDay: 'Dnia startu nie ruszamy.',
    dayBeforeRaceLight: 'Dzień przed startem zostaje lekki — nie wstawiam tam akcentu.',
    outsidePlan: (date: string) => `Data ${date} poza planem`,
    accentsTooClose: (a: string, b: string) =>
      `akcenty ${a} i ${b} są dzień po dniu — reguła I-7 zaleca ≥48 h między sesjami jakościowymi`,
    strengthSameDay: (date: string) =>
      `${date}: akcent wylądował w dniu sesji siłowej — S-5 odradza ciężką siłę ` +
      'przy jednostce jakościowej; przenieś siłownię albo wygeneruj plan ponownie (trainctl plan)',
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
    ruleLine: (id: string, text: string | undefined, origin: string) =>
      text ? `${id} — ${text} · ${origin}` : `${id} · ${origin}`,
    strengthPurposeTitle: 'Po co siła biegaczowi',
    strengthPurpose:
      'Cel: ekonomia biegu — mniejszy koszt tlenowy tej samej prędkości (F-8, efekt mały: ' +
      '~2–8% w badaniach 10+ tygodni). To NIE jest „ochrona przed urazami” — jedyna ' +
      'metaanaliza na biegaczach dała wynik nieistotny (F-9). Uczciwie: u biegaczy 34–45 lat ' +
      'efekt na ekonomię też wychodzi nieistotny (F-15), a dowody na wynik kończą się na ' +
      '1,5–10 km w laboratorium (F-17). W taperze siła znika z planu (F-13).',
    sourcesHint: (url: string, section: string) => `źródła i parametry: ${url} ${section}`,
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
    filesLabel: (path: string) => `plików aktywności (${path})`,
    filesMissing: (path: string) => `Brak eksportu aktywności w ${path} — wskaż przez --from (albo sync.files w trainctl.yaml) katalog z plikami FIT, TCX lub GPX.`,
    filesSkipped: (count: number, sample: string) =>
      `Pominięto ${count} ${pluralPl(count, { one: 'plik', few: 'pliki', other: 'plików' })} (duplikat, to nie aktywność, nieczytelny albo nieobsługiwany): ${sample}`,
    activities: 'Aktywności',
    activitiesValue: (total: number, runs: number, km: number) =>
      `${total} (biegowych: ${runs}, ${n(km)} km)`,
    wellnessEntries: 'Wpisy wellness',
    savedTo: 'Zapisano',
    mismatches: 'Rozjazdy plan ↔ wykonanie',
    columns: { date: 'data', planned: 'plan', actual: 'wykonano', status: 'status' },
    allMatched: 'Wykonanie zgodne z planem w całym zakresie.',
    adaptHint: 'propozycje korekt: trainctl adapt',
    noPlanSkipped: 'Brak planu — pominięto porównanie.',
    dataWithheld: (count: number, sources: string) =>
      `${count} z tych aktywności pochodzi z ${sources}, a intervals.icu nie przepuszcza ich ` +
      'danych przez API (Strava zabrania re-eksportu). Nie mają dystansu ani typu, więc nie da ' +
      'się ich porównać z planem. Podepnij zegarek do intervals.icu bezpośrednio.',
  },

  compare: {
    unknown: 'Brak danych wykonania',
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
    noSnapshot: 'Brak sync.json — analiza tylko z dziennika. Pełne dane: trainctl pull',
    diagnosis: 'Diagnoza',
    proposals: 'Propozycje',
    applyHint: (weeklyKm: number) =>
      `Aby zastosować: athlete.recentWeeklyKm: ${weeklyKm} w trainctl.yaml → trainctl diff → trainctl plan. ` +
      'Silnik nie przepisuje planu sam.',
  },

  desk: {
    title: (date: string) => `Dzień przy biurku · ${date}`,
    subtitle: (from: string, to: string) => `praca ${from}–${to}`,
    heavyDay: 'ciężki dzień kognitywny',
    missingSection:
      'Brak sekcji desk w trainctl.yaml. Dodaj np.:\n' +
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
    rulesHint: (rules: string, url: string) => `reguły: ${rules} — ${url} §10.10`,
  },

  reschedule: {
    title: (weekStart: string) => `Renegocjacja tygodnia · od ${weekStart}`,
    blockedDates: (dates: string) => `zablokowane: ${dates}`,
    noBlocks: 'bez blokad',
    unchanged: 'Plan tygodnia zostaje bez zmian — nic nie wymaga przestawienia.',
    columns: { day: 'dzień', date: 'data', before: 'było', after: 'będzie' },
    whatChanges: 'Co się zmienia',
    applied: (files: string) => `Zastosowano — zapisano ${files}`,
    previewHint: 'to podgląd; zastosuj: trainctl reschedule --apply (z tymi samymi --block)',
    none: '—',
  },

  diff: {
    title: 'Różnice: plan zapisany → plan z aktualnego trainctl.yaml',
    upToDate: 'Plan aktualny — brak różnic względem regeneracji z trainctl.yaml.',
    manualShifts: 'plan zawiera ręczne przesunięcia — regeneracja zostawi te dni bez zmian',
    metadataOnly: 'bez zmian w dniach; odświeżyłyby się metadane planu (wersja silnika, kalibracja, zatwierdzona baza)',
    weekGone: (weekStart: string) => `- tydzień ${weekStart}: znika z planu`,
    weekVolume: (weekStart: string, before: number, after: number) =>
      `~ tydzień ${weekStart}: objętość ${n(before)} → ${n(after)} km`,
    weekTotalKm: (weekStart: string, before: number, after: number) =>
      `~ tydzień ${weekStart}: suma dni ${n(before)} → ${n(after)} km`,
    dayChanged: (date: string, before: string, after: string) => `~ ${date}: ${before} → ${after}`,
    dayDistance: (date: string, kind: string, before: number, after: number) =>
      `~ ${date}: ${kind} ${n(before)} → ${n(after)} km`,
    daySegments: (date: string, kind: string) =>
      `~ ${date}: ${kind} — ta sama objętość, inny układ członów`,
    strengthAdded: (date: string, durationMin: number) =>
      `+ ${date}: dochodzi siła (${durationMin} min)`,
    strengthGone: (date: string) => `- ${date}: znika siła`,
    strengthDuration: (date: string, before: number, after: number) =>
      `~ ${date}: siła ${before} → ${after} min`,
    weekNew: (weekStart: string, km: number) => `+ tydzień ${weekStart}: nowy (${n(km)} km)`,
    applyHint: 'zastosowanie: trainctl plan — dni przeszłe, zalogowane, przypięte i zatwierdzone zostają; --fresh zaczyna od zera',
    localeChanged: (planLocale: string, current: string) =>
      `plan wygenerowano w języku „${planLocale}”, a pracujesz w „${current}” — ` +
      'uruchom trainctl plan, żeby przegenerować opisy',
    titleFile: (path: string) => `Różnice: bieżący plan → ${path}`,
    identical: (path: string) => `Bieżący plan i ${path} są identyczne.`,
    otherPlanMissing: (path: string) =>
      `Brak pliku planu w ${path} — z gałęzi: git show <gałąź>:plan/plan.yaml > scenariusz.yaml`,
    otherPlanInvalid: (path: string) =>
      `${path} to nie jest plik planu (brak goal/weeks) — z gałęzi: ` +
      'git show <gałąź>:plan/plan.yaml > scenariusz.yaml',
    goalDesc: (name: string, distanceKm: number, date: string, time: string) =>
      `${name}, ${n(distanceKm)} km, ${date}${time ? ` (${time})` : ''}`,
    goalChanged: (before: string, after: string) => `cel: ${before} → ${after}`,
    vdotChanged: (before: number, after: number) => `VDOT: ${n(before)} → ${n(after)}`,
    predictionChanged: (before: string, after: string) => `predykcja: ${before} → ${after}`,
  },

  check: {
    title: 'Lint planu',
    subtitle: (file: string) => `inwarianty i integralność pliku — sprawdzane na ${file}`,
    passed: (weeks: number, sessions: number) =>
      `Bez zastrzeżeń: ${tygodnie(weeks)} i ${sesje(sessions)} trzymają wszystkie inwarianty.`,
    errorsSection: 'Integralność pliku',
    warnsSection: 'Odstępstwa od reguł',
    summary: (errors: number, warns: number) =>
      `${errors} ${pluralPl(errors, { one: 'błąd', few: 'błędy', other: 'błędów' })}, ` +
      `${warns} ${pluralPl(warns, { one: 'ostrzeżenie', few: 'ostrzeżenia', other: 'ostrzeżeń' })}`,
    strictHint: 'ostrzeżenia nie zmieniają kodu wyjścia — w CI dodaj --strict, żeby zawodziły',
    strictNote: 'tryb ścisły: ostrzeżenia liczą się jak błędy',
    weeksMissing: (file: string) =>
      `${file}: brak listy tygodni (weeks:) — plik jest pusty albo obcięty; przegeneruj: trainctl plan`,
    goalMissing: (file: string) =>
      `${file}: brak celu z datą (goal.date) — popraw YAML albo przegeneruj plan`,
    malformed: (where: string) =>
      `wpis ${where}: brak wymaganych pól (weekStart/days albo date) — popraw YAML albo przegeneruj plan`,
    weekLength: (weekStart: string, days: number) =>
      `tydzień ${weekStart}: ma ${dni(days)} zamiast 7`,
    weekStartNotMonday: (weekStart: string) =>
      `tydzień ${weekStart}: weekStart nie jest poniedziałkiem`,
    weeksNotContiguous: (weekStart: string, prev: string) =>
      `tydzień ${weekStart}: nie zaczyna się równo 7 dni po poprzednim (${prev})`,
    dayOutOfPlace: (date: string, shouldBe: string) =>
      `${date}: nie na swoim miejscu — ta pozycja w tygodniu należy do ${shouldBe}`,
    weekdayMismatch: (date: string, stored: string, real: string) =>
      `${date}: pole „weekday” mówi ${stored}, a kalendarz — ${real}`,
    totalKmDesync: (weekStart: string, fromDays: number, stored: number) =>
      `tydzień ${weekStart}: totalKm mówi ${n(stored)} km, a dni sumują się do ${n(fromDays)} km`,
    easyShareDesync: (weekStart: string, fromDaysPct: number, storedPct: number) =>
      `tydzień ${weekStart}: easyShare mówi ${storedPct}%, a z dni wychodzi ${fromDaysPct}%`,
    workoutKmDesync: (date: string, kind: string, fromSegments: number, stored: number) =>
      `${date} (${kind}): distanceKm mówi ${n(stored)} km, a segmenty sumują się do ${n(fromSegments)} km`,
    raceDayMissing: (date: string) => `${date}: w dniu celu nie ma startu — plan zgubił swój cel`,
    accentGap: (a: string, b: string, ka: string, kb: string) =>
      `${a} → ${b}: ${ka} i ${kb} bez 48 godzin przerwy`,
    workoutBeforeRace: (date: string, kind: string, raceDate: string) =>
      `${date}: ${kind} w przeddzień startu lub sprawdzianu (${raceDate}) — ten dzień zostaje wolny`,
    longInTaper: (date: string) =>
      `${date}: długie wybieganie w taperze — taper tnie objętość, a długie to jej największy blok`,
    hillsInTaper: (date: string) =>
      `${date}: podbiegi w taperze — silnik nigdy ich tam nie stawia`,
    strengthInTaper: (date: string) =>
      `${date}: siła w taperze albo tygodniu startowym — na taper siłę odstawia się całkiem`,
    strengthOnQualityDay: (date: string, kind: string) =>
      `${date}: siła tego samego dnia co akcent (${kind})`,
    strengthDayBeforeQuality: (date: string, kind: string, next: string) =>
      `${date}: ciężka siła w przeddzień akcentu (${next}: ${kind}) — deficyt siły utrzymuje się do 48 godzin`,
    strengthOnLongDay: (date: string, kind: string) =>
      `${date}: siła tego samego dnia co ${kind} — podwójne obciążenie ekscentryczne tych samych mięśni`,
    strengthGap: (a: string, b: string) => `${a} → ${b}: sesje siłowe bez 48 godzin przerwy`,
    easyShareLow: (weekStart: string, pct: number) =>
      `tydzień ${weekStart}: ${pct}% objętości spokojnie — cel to ≥75%`,
    longOverCap: (date: string, km: number, cap: number) =>
      `${date}: długie ${n(km)} km przekracza sufit ${n(cap)} km — powyżej niego nie ma dowodów na korzyść`,
    qualityWithoutFrame: (date: string, kind: string) =>
      `${date} (${kind}): brak rozgrzewki albo truchtu na koniec — akcent ma jedno i drugie`,
    taperNotMonotonic: (weekStart: string, km: number, prevKm: number) =>
      `tydzień ${weekStart}: ${n(km)} km to więcej niż tydzień wcześniej (${n(prevKm)} km) — objętość taperu spada monotonicznie`,
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
      'albo zaimportuj w Garmin Connect. Alternatywa bez kabla: trainctl push.',
    needDate: 'Podaj datę treningu (--date).',
    raceDayNotWorkout: 'To dzień startu — nie eksportujemy go jako treningu.',
    restDayNothing: (date: string) => `${date} to dzień wolny — nie ma czego eksportować.`,
    noWorkouts: 'Plan nie zawiera treningów do eksportu.',
    needTargetOrPrediction:
      'Pakiet startowy potrzebuje celu czasowego (goal.targetTimeSec) albo predykcji ' +
      '(wynik startu w athlete.results) — nie mam z czego policzyć splitów.',
    pickWhat: 'Podaj rodzaj eksportu: trainctl export --what plan|workout|calendar|print|race',
    scenarioGoal: 'cel',
    scenarioBold: 'śmiało',
    scenarioSafe: 'ostrożnie',
    provenanceWithPrediction: (method: string, generatedAt: string) =>
      `Przedział z predykcji (${method}, W-1) z wyników w trainctl.yaml; równe tempo = założenie ` +
      `rozpiski (inż., W-10). Wygenerowano ${generatedAt}.`,
    provenanceGoalOnly: (generatedAt: string) =>
      'Wyłącznie cel czasowy z trainctl.yaml — bez predykcji z wyniku startu (dodaj wynik do ' +
      `athlete.results). Równe tempo = założenie rozpiski (inż.). Wygenerowano ${generatedAt}.`,
    splitsAndBand: (scenarios: string) => `splity + opaska tempa (${scenarios})`,
    fileRacePack: 'pakiet-startowy',
    filePrintout: 'rozpiska',
    calendarEntries: (count: number) =>
      `${count} ${pluralPl(count, { one: 'trening', few: 'treningi', other: 'treningów' })} w kalendarzu`,
    printedWeeks: (weeks: number) => `rozpiska ${tygodnie(weeks)} do wydruku`,
    noRaceInBase: 'Plan bazowy nie ma startu — pakiet startowy wymaga startu docelowego (goal.kind: race).',
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
      'Bez klucza API — przegląd z dziennika i ostatniej migawki (trainctl pull, gdy będzie klucz, albo trainctl pull --from <katalog eksportu>).',
    fromFiles: (label: string) => `Odświeżono z ${label}.`,
    strength: 'Siła',
    strengthValue: (done: number, planned: number, skipped: number) =>
      `${done} z ${planned} zaplanowanych${skipped ? `, ${skipped} pominięte` : ''}`,
    feelFromHub: (date: string, rpe: number, source: string) => `${date} · RPE ${n(rpe)} · z ${source}`,
    wellness: 'Z zegarka (cytowane, nie interpretowane)',
    wellnessLine: (date: string, restingHr?: number, sleepSec?: number, weightKg?: number) => {
      const parts = [
        ...(restingHr !== undefined ? [`tętno spoczynkowe ${n(restingHr)}`] : []),
        ...(sleepSec !== undefined ? [`sen ${Math.floor(Math.round(sleepSec / 60) / 60)}:${String(Math.round(sleepSec / 60) % 60).padStart(2, '0')}`] : []),
        ...(weightKg !== undefined ? [`${n(weightKg)} kg`] : []),
      ]
      return parts.length ? `${date} · ${parts.join(' · ')}` : undefined
    },
    doneSessions: 'Wykonane sesje',
    volume: 'Objętość',
    volumeValue: (actualKm: number, plannedKm: number) =>
      `${n(actualKm)} z ${n(plannedKm)} km planu`,
    feel: 'Jak się biegało',
    feelLine: (date: string, rpe: number | undefined, note: string | undefined) =>
      [date, ...(rpe !== undefined ? [`RPE ${rpe}`] : []), ...(note ? [`„${note}”`] : [])].join(
        ' · ',
      ),
    signals: 'Sygnały',
    noSignals: 'Bez sygnałów do korekty — plan trzyma się rzeczywistości.',
    seeAdapt: 'są propozycje korekt — szczegóły: trainctl adapt',
    ahead: (weekStart: string) => `Przed nami · tydzień od ${weekStart}`,
    todo: 'Do zrobienia',
    phase: 'Faza',
    volumeAhead: (remainingKm: number, totalKm: number, sessions: number) => {
      const w = `w ${sessions} ${pluralPl(sessions, { one: 'sesji', few: 'sesjach', other: 'sesjach' })}`
      return remainingKm === totalKm ? `${n(totalKm)} km ${w}` : `zostało ${n(remainingKm)} z ${n(totalKm)} km ${w}`
    },
    toRace: 'Do startu',
    baseEnd: 'Plan bazowy do',
    toRaceValue: (days: number) =>
      `${days} ${pluralPl(days, { one: 'dzień', few: 'dni', other: 'dni' })}`,
    raceThisWeek: (date: string) =>
      `Start w tym tygodniu: ${date} — dzień przed zostaje wolny (T-10).`,
    timeTrialThisWeek: (date: string) =>
      `Sprawdzian: ${date} — po nim dopisz wynik do trainctl.yaml, inaczej strefy stoją (W-11).`,
    keySession: 'Kluczowa jednostka',
    todoWriteResult: 'dopisz wynik pomiaru do athlete.results → trainctl diff → trainctl plan',
    todoSeeAdapt: 'przejrzyj propozycje: trainctl adapt --prepare, potem zatwierdź zapisane ID przez --apply',
    todoPush: 'wyślij nadchodzący tydzień na zegarek: trainctl push --days 7',
    todoPrint: 'rozpiska na lodówkę: trainctl export --what print',
    todoReschedule:
      'jeśli sesje wypadają przez pracę — przestaw je (trainctl reschedule), zamiast tracić',
    todoNextRace: (date: string, what: string) => `najbliższy start kontrolny: ${date} (${what})`,
  },

  wizard: {
    header: 'trainctl — konfiguracja profilu',
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
    yesNoHint: '(T/n)',
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
    selectKeys: '  ↑↓ wybór · 1–9 skok · Enter zatwierdź · Esc anuluj',
    raceLocked: 'START — nie do przesunięcia',
    noWeekForToday: 'Nie znalazłem tygodnia obejmującego dzisiejszą datę.',
    previewClosed: 'zamknięto podgląd',
    shiftNeedsTerminal:
      'Tryb interaktywny wymaga terminala. Podaj daty wprost:\n' +
      '  trainctl shift --from 2026-08-04 --to 2026-08-05',
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
    footer: 'Wygenerowane przez trainctl. Uzasadnienia jednostek: trainctl why --date <data>.',
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

  clock: {
    simulated: (env: string, date: string) =>
      `data symulowana ${date} (${env}) — „dziś”, ochrona przeszłości i ważność propozycji idą za nią`,
    badSimulatedDate: (env: string, value: string) => `${env}=„${value}” to nie data — użyj RRRR-MM-DD albo usuń zmienną.`,
  },

  rulesCmd: {
    title: 'Reguły silnika',
    subtitle: (count: number) => `${count} ${pluralPl(count, { one: 'reguła', few: 'reguły', other: 'reguł' })} · ID — co mówi · skąd pochodzi`,
    unknown: (id: string, known: string) => `Nie ma reguły „${id}”. Znane ID: ${known}`,
  },

  dates: {
    badInput: (input: string) =>
      `„${input}” to nie data — użyj RRRR-MM-DD, dziś/jutro/wczoraj, +N/-N albo dnia tygodnia (pn…nd)`,
  },

  commit: {
    done: (sha: string, files: string) => `Commit ${sha}: ${files}`,
    noGit: 'To nie jest repozytorium gita — nic nie zacommitowano (sama zmiana jest zapisana).',
    nothing: 'Nie ma czego commitować — pliki są bez zmian.',
    failed: (detail: string) => `Zmiana jest zapisana, ale git commit się nie powiódł: ${detail}`,
    init: 'trainctl init: profil i instrukcja trenera',
    plan: (goal: string, date: string) => `trainctl plan: ${goal} (${date})`,
    log: (date: string, status: string) => `trainctl log: ${date} ${status}`,
    shift: (from: string, to: string) => `trainctl shift: ${from} ↔ ${to}`,
    reschedule: (weekStart: string) => `trainctl reschedule: tydzień od ${weekStart}`,
    apply: (id: string) => `trainctl: zatwierdzona propozycja ${id}`,
  },

  status: {
    title: 'Katalog treningowy',
    profile: 'Profil',
    language: 'Język',
    ok: 'poprawny',
    missing: 'brak — trainctl init',
    invalid: 'zawiera błędy (niżej)',
    plan: 'Plan',
    goal: 'Cel',
    toRace: 'Do startu',
    daysToRace: (days: number) => (days >= 0 ? dni(days) : `${dni(-days)} temu`),
    weeks: 'Bieżący cykl',
    weeksSessions: (weeks: number, sessions: number) => `${tygodnie(weeks)}, ${sesje(sessions)}`,
    generated: 'Fazy zakotwiczone w',
    engine: 'Silnik',
    engineOther: (planVersion: string, current: string) => `${planVersion} (działa ${current} — zobacz trainctl diff)`,
    engineOld: (current: string) => `sprzed 0.2.0 (działa ${current})`,
    loadState: 'Zatwierdzona baza',
    loadStateValue: (km: number, date: string) => `${n(km)} km/tydz. od ${date}`,
    noPlan: 'Jeszcze nie ma planu.',
    calibration: 'Kalibracja stref',
    calibrationSelected: (date: string, km: number, ageDays: number, vdot: number) =>
      `${date} · ${n(km)} km · sprzed ${dni(ageDays)} · VDOT ${n(vdot)}`,
    calibrationFromGoal: (vdot: number) => `z czasu docelowego (VDOT ${n(vdot)}) — dopisz wynik startu do athlete.results`,
    calibrationNone: 'plan nie zapisuje wyniku kalibracji',
    data: 'Dane',
    key: 'Klucz intervals.icu',
    keyFromEnv: 'zmienna środowiskowa',
    keyNone: 'brak — tryb offline (eksport działa bez niego)',
    envProtected: 'ignorowany przez gita',
    envUnprotected: 'NIE jest ignorowany przez gita',
    never: 'jeszcze nie pobrano',
    syncValue: (pulledAt: string, activities: number, withheld: number) =>
      `pobrano ${pulledAt}, ${activities} ${pluralPl(activities, { one: 'aktywność', few: 'aktywności', other: 'aktywności' })}` +
      (withheld ? `, ${withheld} bez danych (Strava)` : ''),
    empty: 'pusty',
    logValue: (entries: number, date: string, status: string) =>
      `${entries} ${pluralPl(entries, { one: 'wpis', few: 'wpisy', other: 'wpisów' })}, ostatni ${date} (${status})`,
    unconfirmed: (dates: string) => `Niepotwierdzone sesje w tym tygodniu: ${dates} — trainctl log albo trainctl pull.`,
    proposals: 'Propozycje',
    columns: { id: 'id', kind: 'rodzaj', for: 'dla', state: 'stan', changes: 'zmiany' },
    state: {
      valid: 'ważna dziś',
      expired: 'wygasła — przygotuj ponownie',
      stale: 'dane się zmieniły — przygotuj ponownie',
      invalid: 'nieczytelna',
    },
    git: 'Git',
    noGit: 'To nie jest repozytorium gita — historia treningu nigdzie się nie zapisuje. Wystarczy git init.',
    clean: 'Wszystko zacommitowane.',
    dirty: (files: string) => `Niezacommitowane: ${files}`,
    next: (steps: string) => `dalej: ${steps}`,
  },

  examples: {
    plan: [
      'trainctl plan                 # regeneruj przyszłość, zachowaj przeszłość i zatwierdzenia',
      'trainctl diff                 # te same zmiany, bez zapisu',
      'trainctl plan --fresh         # od zera (stary plan zostaje w gicie)',
    ],
    log: [
      'trainctl log                  # w terminalu: wybierz trening i odpowiedz na kilka pytań',
      'trainctl log --km 8 --time 41:20 --rpe 4 --note "dobrze się biegło"',
      'trainctl log --date wczoraj --status skipped --note "praca"',
      'trainctl log --strength done --minutes 30',
    ],
    shorten: [
      'trainctl shorten --minutes 40           # dziś, jako propozycja',
      'trainctl shorten --minutes 30 --date czw',
      'trainctl shorten --apply <id> --commit  # zatwierdź to, co obejrzałeś',
    ],
    adapt: [
      'trainctl adapt                # same propozycje',
      'trainctl adapt --prepare      # konkretna łatka do przejrzenia',
      'trainctl adapt --apply <id>   # zastosuj dokładnie to, co obejrzałeś',
    ],
    review: [
      'trainctl review               # ostatnie siedem dni i tydzień przed nami',
      'trainctl review --date nd     # tydzień zakończony w ostatnią niedzielę',
      'trainctl review --prepare     # z dokładnymi zmianami do zatwierdzenia',
    ],
    reschedule: [
      'trainctl reschedule --block czw sob          # podgląd',
      'trainctl reschedule --time wt=40 --pin nd    # 40 minut we wtorek, niedziela bez zmian',
      'trainctl reschedule --block czw --apply --commit',
    ],
    export: [
      'trainctl export --what plan                  # treningi .fit na zegarek',
      'trainctl export --what workout --date jutro',
      'trainctl export --what calendar              # .ics',
    ],
    diff: [
      'trainctl diff                                # co zmieniłby trainctl plan',
      'git show co-jesli:plan/plan.yaml > /tmp/s.yaml && trainctl diff --plan /tmp/s.yaml',
    ],
    push: ['trainctl push --days 7', 'trainctl push --from pn --to nd'],
    pull: ['trainctl pull --days 28', 'trainctl pull --date -7   # zakres kończący się tydzień temu', 'trainctl pull --from ./activities   # eksport FIT/TCX/GPX, bez konta'],
    status: ['trainctl status', 'trainctl status --json | jq .proposals'],
  },

  envFile: {
    unprotected: (envFile: string, ignoreFile: string) =>
      `Wczytano ${envFile}, a ten katalog jest repozytorium gita i żaden ${ignoreFile} ` +
      `go nie wyklucza. Dopisz linię „${envFile}” do ${ignoreFile}, zanim zrobisz kolejny ` +
      'commit — klucz API, który trafi do historii gita, zostaje tam nawet po skasowaniu pliku.',
  },

  sync: {
    missingKey: (secretFile: string) =>
      'Brak klucza API intervals.icu. Ustaw TRAINCTL_INTERVALS_API_KEY w środowisku, ' +
      `w pliku .env albo zapisz klucz w ${secretFile} — i upewnij się, że git go ignoruje.\n` +
      'Klucz: intervals.icu → Settings → Developer Settings.',
  },

  planMd: {
    headingBase: (goalName: string, date: string) => `Plan: ${goalName} — budowanie bazy do ${date}`,
    heading: (goalName: string, date: string) => `Plan: ${goalName} — ${date}`,
    goalTime: (time: string) => ` · cel: ${time}`,
    meta: (generatedAt: string, vdot: number, source: string, peakKm: number) =>
      `Wygenerowano ${generatedAt} · VDOT ${n(vdot)} (${source}) · szczyt ${n(peakKm)} km/tydz.`,
    vdotFromResult: 'z wyniku startu',
    vdotFromGoal: 'z celu — do rekalibracji!',
    prediction: (distanceKm: number, lo: string, hi: string, method: string) =>
      `Predykcja na ${n(distanceKm)} km: **${lo}–${hi}** (metoda: ${method}; W-1: zawsze przedział).`,
    weekHeading: (index: number, weekStart: string, label: string) =>
      `Tydzień ${index} — od ${weekStart} (${label})`,
    columns: { day: 'Dzień', date: 'Data', workout: 'Trening' },
    strengthTag: (minutes: number) => ` **+ SIŁA** ~${n(minutes)} min`,
    deload: 'odciążenie',
    rest: '—',
    changes: 'Zmiany',
    changeLine: (at: string, action: string, detail: string) => `${at}: ${action} — ${detail}`,
    noCalibration:
      'Brak wyniku startu z ostatnich 18 miesięcy i brak goal.targetTimeSec — ' +
      'nie mam z czego skalibrować stref (Z-6: kalibrujemy z wyników, nie z zegarka).',
    timeCapsVolume: (peak: number, recommended: number) =>
      `Budżet czasu ogranicza plan do ${n(peak)} km/tydz., poniżej ${n(recommended)} km/tydz. rekomendowanych ` +
      'dla tego dystansu (P-7/P-8). Zmieni to więcej minut albo bliższy cel (E-2).',
    timeDayTooShort: (dates: string) =>
      `Te jednostki nie mieszczą się w budżecie dnia nawet po skróceniu (startów i sprawdzianów nie skracamy): ${dates} (E-2).`,
    timeWeekOver: (weeks: string) => `Te tygodnie zostają ponad budżetem tygodnia: ${weeks} (E-2).`,
    trailOnlyCalibration:
      'Strefy pochodzą z wyniku na trailu — teren spowalnia bieg, więc tempa szosowe mogą być za łatwe. Dopisz wynik szosowy (Z-10).',
    zonesFromGoal:
      'strefy skalibrowane z celu czasowego, nie z realnego wyniku — dodaj start do athlete.results',
  },

  configFile: {
    templateHeader: [
      '# trainctl — profil atlety i cel treningowy.',
      '# Uzupełnij i uruchom: trainctl plan',
    ],
    templateLanguage: 'język interfejsu i opisów planu: en | pl (domyślnie: en)',
    templateAthlete: {
      sex: 'male | female | unspecified',
      recentWeeklyKm: 'średnia z ostatnich ~4 tygodni',
      peakWeeklyKm: 'historycznie utrzymywalne maksimum (opcjonalne)',
      results: 'wyniki startów do kalibracji stref (Z-6: nie z zegarka!)',
      exampleResultName: 'przykładowa dycha',
      tuneUpRaces: 'starty kontrolne w drodze do celu (B = mini-taper, C = wbiegany)',
      tuneUpExampleName: 'Bieg jesienny',
    },
    templateGoal: {
      name: 'Półmaraton',
      targetTime: 'opcjonalny cel czasowy — trainctl plan oceni realność',
    },
    templateDesk: 'tryb biurkowy (trainctl desk) — opcjonalny',
    templateDeskPrefer: 'morning | lunch | evening',
    baseGoalName: 'Budowanie bazy',
    templateTime: {
      section: 'czas, który naprawdę masz, z przygotowaniem i siłą (opcjonalnie)',
      weekly: 'minut w tygodniu — objętość wypłaszcza się na tym, co się mieści (E-2)',
      weekday: 'minut od poniedziałku do piątku — dłuższe jednostki są skracane (E-1)',
      weekend: 'minut w sobotę i niedzielę',
    },
    templateSync: {
      section: 'wykonanie bez konta w intervals.icu (opcjonalnie)',
      files: 'katalog z eksportem plików FIT/TCX/GPX — czytają go trainctl pull i review',
    },
    templateStrength: {
      section: 'siła 2×/tydz. obok biegania (opt-in; wymaga ciężarów)',
      enabled: 'cel: ekonomia biegu (F-8) — NIE „ochrona przed urazami” (F-9)',
      days: 'opcjonalnie: preferowane dni',
    },
    inferredHeader: (from: string, to: string) => [
      '# trainctl — profil atlety i cel treningowy.',
      `# Profil zaproponowany z historii intervals.icu (pełne tygodnie ${from} → ${to}).`,
      '# To propozycje — popraw wszystko, co nie zgadza się z rzeczywistością.',
    ],
    inferredPeak: 'najwyższy pełny tydzień okna',
    inferredDays: 'dni z ≥10% biegów okna',
    inferredLongRun: 'dominujący dzień najdłuższych biegów',
    inferredResults: 'dopisz wynik startu po potwierdzeniu kandydatów z wyjścia komendy',
    inferredResultsWhy: '(strefy kalibrujemy z wyników startów, nie z odczytów zegarka — Z-6)',
    inferredGoal: 'UZUPEŁNIJ — bez celu `trainctl plan` odmówi (celowo)',
    inferredGoalName: 'Bieg docelowy',
    inferredGoalDate: 'data startu',
    inferredResultHint: 'dopisz wynik startu — z niego kalibrujemy strefy (nie z zegarka)',
    generatedByWizard: '# Wygenerowane przez `trainctl init`. Śmiało edytuj i uruchom `trainctl plan`.',
    validate: {
      missingSection: (path: string) => `${path}: brak sekcji`,
      numberGtZero: (path: string) => `${path}: wymagana liczba > 0`,
      nonEmptyDays: (path: string) => `${path}: wymagana niepusta lista dni`,
      unknownDay: (path: string, day: string) => `${path}: nieznany dzień „${day}”`,
      listOptional: (path: string) => `${path}: wymagana lista (może być pusta)`,
      listRequired: (path: string) => `${path}: wymagana lista`,
      isoDate: (path: string) => `${path}: format RRRR-MM-DD`,
      seconds: (path: string) => `${path}: liczba sekund > 0`,
      goalKind: (path: string) => `${path}: race (domyślnie) albo base`,
      minutes: (path: string) => `${path}: pełne minuty od 15 do 2000`,
      priorityBc: (path: string) => `${path}: B albo C (A to cel w sekcji goal)`,
      required: (path: string) => `${path}: wymagane`,
      boolean: (path: string) => `${path}: true albo false`,
      hourFormat: (path: string) => `${path}: format HH:MM`,
    },
  },

  rules: {
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
    'T-4': 'taper ściśle malejący tydzień do tygodnia — „strict” dał medianę −5:32 na maratonie (Smyth 2021, n=158 117)',
    'T-5': 'długość taperu zależy od dystansu: 5–10 km ~tydzień, HM ~2 tyg., maraton 2–3 tyg. (Wang 2023; Knopp 2024)',
    'T-9': 'start kontrolny B: mini-taper (objętość tygodnia −20%), ale makrocykl bez zmian — jeden bieg nie cofa progresji',
    'T-10': 'dzień przed startem wolny — tak robił trener w 34 z 45 startów w korpusie',
    'T-11': 'długie wybieganie ZOSTAJE dzień po starcie, spokojnie — wzorzec z korpusu (sobota start → niedziela długie)',
    'T-12': 'start JEST akcentem tygodnia, nie dodatkiem do niego — nie dokładamy do niego drugiej sesji jakościowej',
    'W-11': 'strefy kalibrujemy z biegu maksymalnego: sprawdzian na czas jest tu równoważny startowi (Daniels & Gilbert)',
    'W-12': 'kalibracja co ~4 tygodnie — tyle wynosi mediana odstępu między startami w korpusie trenerskim',
    'W-13': 'prawdziwy start jest lepszy niż sztuczny sprawdzian; sprawdzian pojawia się tylko przy pustym kalendarzu startów',
    'F-1': 'siła 2–3×/tydz. jako dawka bazowa (Blagrove 2018 — opis praktyki badań, nie dose-response)',
    'F-2': 'cel: ≥24 sesje siły łącznie w bloku — poniżej efekt nieistotny (Berryman 2018, SMD 0,63 vs 0,10)',
    'F-3': 'blok siły 10–14 tygodni; 6–8 tyg. nie wystarcza (Eihara 2022)',
    'F-4': 'ciężko: ≥80% 1RM, wielostawowo, wolny ciężar — im ciężej, tym większy efekt na ekonomię (Llanos-Lagos 2024)',
    'F-13': 'taper: siła znika z planu — 4 tyg. detrainingu nie kasuje adaptacji (Berryman 2020, uwaga: n=8)',
    'S-4': 'siła i bieg tego samego dnia: ≥3 h odstępu udokumentowane (Schumann 2022); 6 h to margines inżynierski',
    'F-12': 'siła 2× w tygodniu w bazie, 0–1× w okresie startowym (Haugen 2022)',
    'F-14': 'jedna sesja siły w tygodniu utrzymuje efekt bloku (Rønnestad 2010 — dane z kolarzy, ekstrapolacja)',
    'F-18': 'dwa pierwsze tygodnie bloku siły to nauka ruchu przy ~75% 1RM przed ciężkimi tygodniami — wybór inżynierski, bez źródła',
    'R-1': 'po maratonie 48 h bez biegania, potem lekko — 40 min spokojnie po 48/96/144 h (Martínez-Navarro 2021)',
    'R-2': 'powrót do biegania 48 h po maratonie nie spowalnia regeneracji (Martínez-Navarro 2021)',
    'R-8': 'po starcie na półmaraton i dłużej dwa tygodnie przejściowe: ~50% objętości sprzed startu wyłącznie spokojnie, potem ~100% z jednym akcentem (korpus trenerski, n=3; Martínez-Navarro 2021)',
    'R-9': 'siła wraca w drugim tygodniu po starcie, jedną lżejszą sesją — wybór inżynierski, bez źródła',
    'R-10': 'po krótszym starcie docelowym jeden tydzień przejściowy ~70% — wybór inżynierski; brak danych',
    'P-11': 'plan bez startu rośnie do udokumentowanego szczytu (albo +15%) i tam się wypłaszcza, odciążenie co czwarty tydzień — wybór inżynierski',
    'E-2': 'budżet czasu z trainctl.yaml ogranicza objętość tygodnia i skraca jednostki według zasad E-1 — wybór inżynierski, bez źródła',
    'Z-10': 'wynik z trailu nie kalibruje stref szosowych, dopóki jest wynik szosowy — wybór inżynierski; tabele VDOT pochodzą z szosy i bieżni',
    'S-5': 'ciężka siła nie później niż 24 h przed sesją jakościową — deficyt siły trwa do 48 h (de Carvalho e Silva 2022)',
  },

  kindPurpose: {
    easy: 'Spokojny bieg wnosi kilometry o niskiej intensywności do tygodniowej objętości treningu.',
    long: 'Długie wybieganie: wytrzymałość podstawowa, ekonomia biegu i odporność na zmęczenie (durability).',
    easy_hills:
      'Bieg spokojny + podbiegi: siła specyficzna i ekonomia przy minimalnym koszcie (house style trenera).',
    quality_intervals:
      'Sesja interwałowa — bodziec zależny od fazy: okołoprogowy (piramida) albo VO₂max (polaryzacja).',
    quality_continuous:
      'Akcent ciągły — tempo narastające lub bieg zmienny; kontrola tempa i praca okołoprogowa.',
    sharpener:
      'Krótki akcent przedstartowy: podtrzymuje intensywność w taperze (T-1) bez kosztu objętości.',
    test:
      'Sprawdzian na czas — pomiar, nie trening: z wyniku przeliczamy strefy na kolejne tygodnie (W-11). ' +
      'Pojawia się, bo w kalendarzu nie ma startu, który zrobiłby to samo lepiej (W-13).',
    race: 'Start — cel tego cyklu.',
  },

  mcp: {
    dirLine: (dir: string, locale: string) => `katalog treningowy: ${dir} · język: ${locale}`,
    isoDate: 'data w formacie RRRR-MM-DD',
    init:
      'Utwórz szablon trainctl.yaml (profil atlety i cel) w katalogu treningowym. ' +
      'Nie nadpisuje istniejącego pliku. Z fromIntervals=true proponuje profil ' +
      'z 16 tygodni historii intervals.icu (wymaga klucza API): wartości mają ' +
      'komentarz proweniencji, a kandydatów na wyniki startów zwraca DO POTWIERDZENIA ' +
      'z użytkownikiem — dopisz je do athlete.results dopiero po jego zgodzie.',
    initFromIntervals: 'profil z historii intervals.icu',
    plan:
      'Wygeneruj plan treningowy z trainctl.yaml → plan/plan.yaml + plan/PLAN.md. ' +
      'Zwraca podsumowanie: szczyt objętości, predykcję wyniku (przedział) i ocenę realności celu. ' +
      'Na istniejącym planie regeneruje wyłącznie PRZYSZŁOŚĆ: dni przeszłe, zalogowane, przypięte, ręcznie ' +
      'edytowane i zatwierdzone zostają, a zatwierdzona baza z adapt obowiązuje dalej. fresh=true zaczyna od zera. ' +
      'Zapytaj przed wywołaniem; trainctl_diff pokazuje dokładnie te same zmiany bez zapisu.',
    planFresh: 'true = regeneracja od zera, porzuca chronione dni i zatwierdzenia (najpierw zapytaj użytkownika)',
    planDate: 'data „dzisiaj” (domyślnie: bieżąca)',
    today: 'Trening na dziś (albo wskazaną datę): opis jednostki, kilometraż, status z dziennika.',
    week:
      'Podgląd całego tygodnia treningowego (faza, cel km, dzień po dniu, statusy z dziennika). ' +
      'Użyj PRZED renegocjacją tygodnia (trainctl_shift), żeby zobaczyć kontekst.',
    weekDate: 'dowolna data w interesującym tygodniu',
    log: 'Zapisz wykonanie treningu w dzienniku (log.jsonl).',
    logStatus: 'domyślnie done',
    logKm: 'przebiegnięte km',
    logTime: 'czas MM:SS albo HH:MM:SS',
    logRpe:
      'wysiłek sesji jako liczba całkowita 1–10 (CR-10, 10 = maksymalny). Zapytaj biegacza po sesji — nigdy nie zgaduj.',
    logStrength: 'done | skipped — zapis sesji siłowej zamiast biegu (działają tylko minutes i note).',
    logMinutes: 'czas sesji siłowej w minutach',
    logNote: 'samopoczucie, warunki, uwagi',
    shift:
      'Renegocjacja tygodnia: zamień treningi między dwiema datami TEGO SAMEGO tygodnia ' +
      '(np. „w czwartek release — przesuń interwały”). Chroni dzień startu i dzień przed nim; ' +
      'ostrzega przy złamaniu zasady 48 h między akcentami (I-7).',
    shiftFrom: 'data treningu do przesunięcia',
    shiftTo: 'data docelowa (treningi zostają zamienione)',
    why:
      'Wyjaśnij zapisaną jednostkę: cel, start docelowy, faza, konkretna dawka, sąsiednie wymagające sesje, budżet czasu, wykonanie i ręczne zmiany oraz reguły ' +
      '(ID z docs/science/FOUNDATIONS.md).',
    adapt:
      'Porównaj wykonanie z planem i zaproponuj korekty. Domyślnie nie zapisuje zmian. ' +
      'prepare=true zapisuje konkretny wariant: pokaż zmieniane sesje i ostrzeżenia, zapytaj biegacza o zgodę, ' +
      'następnie wywołaj apply z zatwierdzonym ID. Zmiana danych unieważnia propozycję.',
    adaptDate: 'data odniesienia (domyślnie dziś)',
    desk:
      'Dzień przy biurku: okna treningowe wokół godzin pracy, przerwy w siedzeniu i reguła ' +
      'prowadzenia sesji po dniu ciężkiej pracy umysłowej (wtedy tempo, nie odczucie). ' +
      'Ustaw heavy=true, gdy dzień był kognitywnie ciężki (długie sesje z agentami). ' +
      'Wymaga sekcji desk w trainctl.yaml.',
    deskHeavy: 'ciężki dzień kognitywny',
    export:
      'Zapisz plan do pliku: `plan` = cały plan jako treningi .fit na zegarek, ' +
      '`workout` = jeden trening .fit (wymaga date), `calendar` = .ics do Google/Outlooka, ' +
      '`print` = rozpiska HTML pod wydruk A4, `race` = pakiet startowy (splity + papierowa ' +
      'opaska tempa; wymaga celu czasowego albo predykcji). Pliki lądują w katalogu export/. ' +
      'Gdy użytkownik chce trening „na zegarek” bez kabla — rozważ najpierw trainctl_push.',
    exportDate: 'trening do eksportu przy what=workout',
    reschedule:
      'Przestaw CAŁY tydzień wokół dni, w których użytkownik nie może trenować ' +
      '(„w czwartek mam release”, „wyjazd wt–śr”). Solver trzyma ≥48 h między akcentami, ' +
      'chroni długie wybieganie i liczbę akcentów, a gdy brakuje dni — mówi, którą jednostkę ' +
      'poświęca i dlaczego. Domyślnie tylko podgląd; apply=true zapisuje plan. ' +
      'Do przesunięcia pojedynczego treningu użyj trainctl_shift.',
    rescheduleBlock: 'dni bez możliwości treningu',
    rescheduleDate: 'data wskazująca tydzień (domyślnie bieżący)',
    rescheduleApply: 'true = zapisz zmiany w planie',
    push:
      'Wypchnij zaplanowane treningi do intervals.icu — trafiają na zegarek (Garmin/Coros/Wahoo) ' +
      'jako treningi strukturalne z celami tempa. Wymaga klucza API (env TRAINCTL_INTERVALS_API_KEY ' +
      'albo plik .trainctl-secret). Ponowny push nadpisuje te same dni (upsert).',
    pushFrom: 'początek zakresu (domyślnie dziś)',
    pushTo: 'koniec zakresu',
    pushDays: 'ile dni do przodu, domyślnie 14',
    pull:
      'Pobierz wykonane aktywności i dane wellness z intervals.icu, zapisz migawkę (sync.json) ' +
      'i porównaj wykonanie z planem (rozjazdy: krótsze/dłuższe/brak wykonania/nieplanowane).',
    pullDays: 'ile dni wstecz, domyślnie 28',
    pullFrom: 'ścieżka (względem katalogu treningowego) do katalogu albo pliku z eksportem aktywności FIT/TCX/GPX; czytana zamiast intervals.icu.',
    review:
      'Przegląd tygodnia w jednym wywołaniu: wykonanie minionych dni vs plan, sygnały ' +
      'do korekty, nadchodzący tydzień (faza, objętość, kluczowa jednostka, starty/sprawdziany) ' +
      'i lista konkretnych działań. Używaj TEGO zamiast wołania trainctl_pull + trainctl_adapt + ' +
      'trainctl_week po kolei — np. gdy użytkownik pyta „jak mi poszło?” albo zaczyna tydzień. ' +
      'Działa też bez klucza API (wtedy z dziennika i ostatniej migawki). ' +
      'Gdy użytkownik prosi o konkretne zmiany do zatwierdzenia, użyj prepare=true. Pokaż zapisany diff i ostrzeżenia, a trainctl_adapt(apply=ID) wywołaj po zatwierdzeniu. Sam przegląd nie zmienia planu.',
    reviewDays: 'ile dni wstecz podsumować, domyślnie 7',
    reviewDate: 'data odniesienia (domyślnie dziś)',
    diff:
      'Dry-run: co zmieniłaby regeneracja planu z aktualnego trainctl.yaml (nowe wyniki, ' +
      'zmiana profilu). Nic nie zapisuje. Z plan=<ścieżka> porównuje bieżący plan z innym ' +
      'plan.yaml — workflow „co jeśli”: scenariusz żyje na gałęzi gita albo w skopiowanym ' +
      'katalogu (przesunięta data startu, odpuszczony start kontrolny), a diff pokazuje cel, ' +
      'predykcję i różnice tydzień po tygodniu, zanim użytkownik zdecyduje.',
    diffPlan: 'ścieżka do innego plan.yaml do porównania (gałąź scenariusza, worktree, kopia)',
    check:
      'Lint pliku planu względem inwariantów silnika: ≥48 h między akcentami (I-7), wolny dzień ' +
      'przed startem (T-10), kształt taperu (T-4/T-5, F-13), sąsiedztwo siły (S-5), ≥75% objętości ' +
      'spokojnie (I-5) oraz spójność wewnętrzna pliku (sumy, daty, obecność dnia startu). BŁĘDY ' +
      'znaczą, że plan/plan.yaml jest wewnętrznie niespójny (zwykle po ręcznej edycji); OSTRZEŻENIA ' +
      'to odstępstwa od reguł, które ktoś mógł wybrać świadomie. Uruchamiaj po ręcznej edycji ' +
      'pliku planu. Nic nie zmienia.',
    checkStrict: 'true = ostrzeżenia też liczą się jak błędy',
    rule:
      'Wyjaśnij jedną regułę silnika po ID (tak, jak cytują ją trainctl_why, trainctl_check albo ruleRefs w planie): ' +
      'co mówi, czy pochodzi z opublikowanych badań, korpusu trenerskiego czy z wyboru inżynierskiego, oraz link do ' +
      'FOUNDATIONS.md dla tej wersji silnika. Bez id wypisuje wszystkie reguły. Tylko odczyt.',
    ruleId: 'ID reguły, np. I-7 albo T-10; pomiń, żeby wypisać wszystkie',
    initAgent: 'dopisz też pliki integracji agenta: claude → .claude/settings.json, codex → .codex/config.toml, all → oba.',
    promptReview: 'Przegląd tygodnia z trenerem trainctl: co było, co to znaczy, co przed nami.',
    promptReviewText: (date: string) =>
      `Uruchom trainctl_review${date ? ` z date=${date}` : ''}. Zrelacjonuj po ludzku: dni za nami wobec planu, sygnały ` +
      'warte działania i kluczową jednostkę przed nami. Przytocz RPE i notatki dosłownie, zaproponuj najwyżej dwie rzeczy ' +
      'i zapytaj, zanim uznasz niepotwierdzone sesje za pominięte. Nie zmieniaj planu bez mojego wyraźnego „tak”.',
    promptDebrief: 'Odprawa po treningu: zapisz, jak poszło.',
    promptDebriefText: (date: string) =>
      `Skończyłem trening${date ? ` ${date}` : ' dzisiaj'}. Sprawdź, co było w planie (trainctl_today), zapytaj mnie o dystans, ` +
      'czas, wysiłek 1–10 i jedno zdanie notatki, potem zapisz to przez trainctl_log. Jeśli odczucie kłóci się z rolą ' +
      'jednostki, zadaj jedno pytanie o kontekst zamiast wyciągać wnioski.',
    promptDate: 'RRRR-MM-DD (opcjonalnie)',
    resourcePlan: 'Plan treningowy w wersji do czytania (plan/PLAN.md).',
    resourceConfig: 'Profil zawodnika i cel (trainctl.yaml).',
    resourceAgents: 'Instrukcja trenera dla agenta w tym katalogu (AGENTS.md).',
    resourceRule: 'Jedna reguła silnika po ID, z klasą źródła.',
    resourceMissing: (file: string) => `${file} jeszcze nie istnieje w katalogu treningowym.`,
    status:
      'Stan katalogu treningowego w jednym wywołaniu: czy trainctl.yaml się waliduje, która wersja silnika ' +
      'wygenerowała plan, skąd jest klucz API i czy .env jest chroniony, kiedy ostatnio pobrano dane, dziennik, ' +
      'zapisane propozycje z ich ważnością na dziś i niezacommitowane pliki. Tylko odczyt — zacznij od tego, ' +
      'gdy coś się nie zgadza.',
    commit:
      'true = po udanym zapisie zacommituj w gicie dokładnie pliki zmienione przez narzędzie (nigdy sekretów). ' +
      'To zapis do historii gita użytkownika — używaj wyłącznie, gdy prosił o commity.',
  },

  agentsMd: (foundationsUrl: string): string => `# Trener — instrukcja dla agenta

Ten katalog to plan treningowy jako kod. Masz narzędzia MCP \`trainctl_*\`
(albo CLI \`trainctl\`) i pełnisz rolę trenera, nie tylko wykonawcy komend.

## Rytuały

- **Dziś tylko 40 minut** → \`trainctl_shorten(minutes=40)\`. Budżet obejmuje przygotowanie i siłę. Pokaż dokładne przed/po, utracony cel i ostrzeżenia; zastosuj zwrócone ID po zatwierdzeniu. Nie zastępuj akcentu spokojnym biegiem bez poinformowania użytkownika.
- **Dlaczego ten trening** → \`trainctl_why\`. Zacznij od celu, obecnej fazy i konkretnej dawki, potem wyjaśnij miejsce w tygodniu i źródła. Nie przypisuj ręcznym zmianom wymyślonego uzasadnienia.
- **Przejrzyj tydzień i zaproponuj zmiany** → \`trainctl_review(prepare=true)\`. Pokaż luki w wykonaniu i zapisane zmiany. Zatwierdzenie przez \`trainctl_adapt(apply=ID)\`; nie regeneruj ani nie synchronizuj pomiędzy podglądem a zatwierdzeniem.
- **Początek tygodnia** → \`trainctl_review\`. Jedno wywołanie zamiast pull + adapt +
  week. Zrelacjonuj wynik po ludzku i zaproponuj co najwyżej dwie rzeczy do zrobienia.
- **Coś się nie zgadza** (propozycja nie chce się zastosować, brakuje danych,
  plan wygląda dziwnie) → najpierw \`trainctl_status\`: profil, wersja silnika,
  klucz, ostatni pull, propozycje z ważnością, niezacommitowane pliki.
- **Przed każdą zmianą w tygodniu** → najpierw \`trainctl_week\`, żeby zobaczyć kontekst.
  „Przesuń interwały” bez spojrzenia na tydzień to zgadywanie.
- **Po starcie albo sprawdzianie** → dopytaj o czas i zaproponuj wpis do
  \`athlete.results\`. Pomiar bez wpisanego wyniku niczego nie zmienia — strefy
  dalej liczą się ze starego biegu. Po starcie docelowym plan idzie dalej tygodniami
  przejściowymi (R-8); gdy użytkownik poda następny cel, zmień \`goal\`
  w \`trainctl.yaml\` → \`trainctl_diff\` → \`trainctl_plan\` — nowy cykl zaczyna się
  po bloku przejściowym i zachowuje historię.
- **Po zalogowanym treningu** → krótka odprawa. Zapytaj, jak było, i zapisz to
  w dzienniku (\`trainctl_log\` z rpe 1–10 i notatką) — ślad odczuć wraca potem
  w przeglądzie tygodnia. Gdy odczucie kłóci się z rolą jednostki (spokojny
  bieg opisany „ledwo żywy”), zadaj jedno pytanie o kontekst — sen, praca,
  życie — zamiast wyciągać wnioski z pojedynczego wpisu.
- **Masz pod ręką harmonogram?** Jeśli środowisko, w którym działasz, umie
  uruchamiać zadania cyklicznie, zaproponuj użytkownikowi automatyczną
  poniedziałkową odprawę (\`trainctl_review\`) — raz i za jego zgodą, nie po
  cichu.
- **Po ręcznej edycji \`plan/plan.yaml\`** → \`trainctl_check\`. Błędy znaczą, że
  plik się rozjechał; ostrzeżenia niosą ID reguł z FOUNDATIONS — warto je
  zrelacjonować.

## Zasady

1. **Nie regeneruj planu bez pytania.** \`trainctl_plan\` przepisuje przyszłe tygodnie
   (dni przeszłe, zalogowane, przypięte i zatwierdzone zostają; fresh=true zaczyna od zera).
   Przy wątpliwościach: \`trainctl_diff\` (te same zmiany, nic nie zapisuje).
2. **Adaptacja proponuje, nie przepisuje.** \`trainctl_adapt\` zwraca propozycje;
   użyj prepare=true, aby zapisać konkretną zmianę. Pokaż zmieniane sesje i ostrzeżenia,\n   zapytaj o zgodę, a następnie wywołaj apply z zatwierdzonym ID. Zmienione dane\n   wymagają nowej propozycji. Brak danych nie potwierdza pominięcia treningu.
3. **Pytaj o kontekst, zanim zaczniesz liczyć.** Pominięty tydzień to co innego
   przy chorobie, a co innego przy wale w pracy — pierwszy wymaga ostrożnego
   powrotu, drugi zwykle tylko przestawienia dni.
4. **Dnia startu się nie rusza.** \`trainctl_shift\` odmówi; nie próbuj obchodzić tego
   regeneracją planu z inną datą.
5. **Nie wymyślaj liczb.** Tempa, objętości i reguły pochodzą z silnika; jeśli
   czegoś nie ma w wyniku narzędzia, powiedz „nie wiem”, zamiast oszacować.
6. **Cytuj powody, nie tylko polecenia.** \`trainctl_why\` podaje cel jednostki i
   reguły z badań (ID z [docs/science/FOUNDATIONS.md](${foundationsUrl})) — to jest wartość, którą
   trener wnosi ponad listę treningów.
7. **Pytanie „co jeśli” dostaje scenariusz, nie nadpisanie.** „Co jeśli przełożę
   start o trzy tygodnie?” → gałąź gita albo skopiowany katalog, zmiana
   \`trainctl.yaml\` TAM, regeneracja tam, potem \`trainctl_diff\` z plan=<ścieżka
   do plan.yaml scenariusza> i pokazanie różnic. Prawdziwy plan zostaje
   nietknięty, dopóki użytkownik nie zdecyduje.
8. **Odczucia są materiałem do rozmowy, nie do arytmetyki.** RPE i notatki
   z dziennika wolno cytować i zestawiać („trzeci tydzień z rzędu piszesz
   «ciężko»”), ale nigdy nie przeliczać na strefy, tempa ani objętość (Z-4).
   Powtarzająca się ciężkość to powód do rozmowy i ewentualnie
   \`trainctl_adapt\` — nie do cichej korekty.

## Koreluj to, co widzisz

Narzędzia trainctl to nie jedyne Twoje oczy. Jeśli widzisz też kalendarz
użytkownika, tracker zadań, grafik dyżurów albo robocze repozytoria, wiąż je
z tygodniem treningowym, zamiast czekać, aż ktoś Ci powie:

- Release, deadline albo wyjazd wypadający w dzień treningowy → zaproponuj
  \`trainctl_reschedule\` z blokadą tych dni, **zanim** konflikt się wydarzy
  („w czwartek release — przełożyć interwały na środę?”).
- Dzień ciężki kognitywnie — długie sesje z agentami, gęsta kolejka code
  review, incydent → \`trainctl_desk\` z heavy=true; po takim dniu akcent
  prowadzi się po tempie, nie po czuciu (S-8).

Dwie granice: proponuj, nigdy nie stosuj bez zgody, i nazwij sygnał, z którego
korzystasz („widzę release w kalendarzu”) — błędny domysł musi być łatwy do
sprostowania. Dane o zdrowiu tylko ze źródeł podłączonych dokładnie w tym celu.

## Czego nie robić

- Nie doradzaj medycznie (ból, kontuzja, choroba → lekarz, nie agent).
- Nie „nadrabiaj” opuszczonych kilometrów w kolejnych dniach — to działa
  przeciw progresji.
- Nie oceniaj formy po tętnie z zegarka ani po HRV; kalibracja idzie z wyników
  startów i sprawdzianów.

## Pliki

| plik | co to |
|---|---|
| \`trainctl.yaml\` | profil, cel, starty kontrolne — **jedyne** miejsce, które edytujesz ręcznie |
| \`plan/plan.yaml\` | wygenerowany plan (źródło prawdy dla komend) |
| \`plan/PLAN.md\` | ten sam plan do czytania |
| \`log.jsonl\` | dziennik wykonania |
| \`sync.json\` | migawka danych z intervals.icu |

Historia zmian to git — commituj po każdej zmianie planu, żeby było widać,
co i dlaczego się zmieniło.
`,
}
