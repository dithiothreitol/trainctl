# Plan rozwoju po 0.6.0: treść planu biegowego, jedna warstwa prezentacji, ocena wykonania

Samowystarczalny plan dla sesji Claude Code, w konwencji
[PLAN-v0.4.md](PLAN-v0.4.md). Kontekst produktu: [SPEC.md](../SPEC.md).
Warstwa naukowa: [docs/science/FOUNDATIONS.md](science/FOUNDATIONS.md)
i [docs/science/MULTISPORT.md](science/MULTISPORT.md). Granice potwierdzenia
wydania 0.6.0: [COACHING-VALIDATION.md](COACHING-VALIDATION.md).

**Stan wyjściowy (2026-11-11):** `main` na `e6c922e`, wydanie 0.6.0 w sześciu
paczkach npm, 1076 testów w 75 plikach, typecheck czysty, 22 narzędzia MCP.
Etapy A–E z PLAN-v0.4 wyszły w 0.4.0. Wydanie 0.5.0 dodało rower, pływanie
i schemat sesji v2, wydanie 0.6.0 karty jednostek ze strukturą i skalą RPE.

**Źródła planu:**

- przegląd z 2026-11-11: cztery profile uruchomione prawdziwym CLI z
  `TRAINCTL_TODAY`, opisane w §1 (ten dokument jest zapisem przeglądu);
- lektura `engine/macrocycle.ts`, `engine/microcycle.ts`, `engine/house-style.ts`,
  `planfile.ts`, `commands.ts`, `sports-commands.ts`, `ui/blocks.ts`,
  `ui/training.ts`, `execution.ts`, `ports/sync.ts`;
- PLAN-v0.4 §8: pozycja „repertuar zależny od celu i doświadczenia" odłożona
  do czasu pomiaru w korpusie. Pomiar jest częścią etapu 1;
- COACHING-VALIDATION „Granice potwierdzenia": brak przeglądu trenerskiego
  i próby na pełnym sezonie.

**Zasada doboru zakresu.** Największe braki dotyczą treści planu biegowego,
dlatego silnik idzie przed wyglądem. Każda zmiana silnika zaczyna się od pomiaru
w korpusie albo od reguły w FOUNDATIONS. Prezentacja dostaje jedną notację
i jeden model wiersza dla biegu i multisportu. Ocena wykonania pozostaje opisem
faktów, bez automatycznych wniosków (ADR-011, ADR-027).

**Decyzje właściciela** z §9 zostały przyjęte 2026-11-11 zgodnie
z rekomendacjami. **Realizacja** ma cztery etapy (§2). Praca jest opisana
w pakietach A–F (§3–§8). Po każdym etapie są testy i `/code-review` w zakresie
etapu (§0).

---

## 0. Reguły wykonania

Obowiązuje w całości [PLAN-v0.4 §0](PLAN-v0.4.md): higiena sesji (`pnpm check`,
`pnpm build`, próba instalacji z tarballi, CHANGELOG na bieżąco, SPEC i oba
README razem, jeden commit na punkt pakietu) oraz twarde ograniczenia kodu (importy
`.ts`, bloki zamiast kolorów, oba języki, stałe z ID reguły, adaptacja
proponuje, sekrety i dane osobowe poza repo).

Dodatkowo w tym planie:

- **Najpierw nauka, potem kod.** Każdy punkt silnika zaczyna się od skryptu
  w `tools/corpus/` i wpisu w FOUNDATIONS §10. Do repo trafiają wyłącznie
  agregaty, tak jak w `house-style.ts`. Katalog `corpus/` jest lokalny i zostaje
  poza repo.
- **Kształt planu jest testowany.** Od B0 każda zmiana silnika przechodzi przez
  macierz profili syntetycznych i migawkę kształtu sezonu. Licznik testów
  rośnie (dziś 1076).
- **Zmiana silnika podnosi wersję silnika** i jest widoczna przez
  `compatibilityNotes`. Pierwsza regeneracja po aktualizacji zmienia przyszłe
  dni. Dni przeszłe, zalogowane, przypięte i edytowane ręcznie zostają
  (ADR-033). Wpis „Changed" w CHANGELOG jest obowiązkowy.
- **Backtest** (`backtest.test.ts`, lokalny korpus) zostaje w progach albo progi
  są zmieniane jawnie, z uzasadnieniem w commicie.
- `docs/karuzela/` pozostaje nieśledzony.

**Gałęzie.** Każdy etap ma własną gałąź od aktualnego `main`:
`plan-0.7/etap-1` do `plan-0.7/etap-4`. Commity po polsku, jeden na punkt
pakietu albo na spójną grupę punktów. Następny etap startuje po scaleniu
poprzedniego.

**Zamknięcie każdego etapu**, w tej kolejności:

1. `pnpm check` zielone. Licznik testów nie maleje.
2. `pnpm build` i próba instalacji z tarballi poza repo.
3. Testy własne etapu z tabeli w §2.
4. `/code-review high` z celem ustawionym na gałąź etapu, czyli na różnicę
   względem `main`. Zakres przeglądu to zakres etapu.
5. Każde potwierdzone znalezisko w zakresie etapu dostaje poprawkę i test,
   który bez poprawki zawodzi. Po poprawkach wracają kroki 1–4. Przegląd
   powtarza się do braku potwierdzonych znalezisk w zakresie etapu.
6. Znalezisko spoza zakresu etapu trafia do rejestru w §13 i nie jest naprawiane
   w tym etapie.
7. CHANGELOG, SPEC z nowymi ADR-ami, oba README.
8. Scalenie gałęzi i wydanie to działania właściciela.

---

## 1. Dowody z przeglądu

Profile P1–P3: start `Półmaraton` 2027-03-28, wynik 10 km 43:00
z 2026-09-27, dni `tue, wed, thu, sat, sun`, plan wygenerowany 2026-10-22,
25 tygodni. P4 to osobny katalog w schemacie v2. Zapis tygodnia: I interwały,
T akcent ciągły, E spokojne, L długie, TT sprawdzian, liczba to kilometry.

| Profil | Różnica | Wynik |
|---|---|---|
| P1 | 45 km/tydz., siła | tydz. 1: 49 km, tyg. 2–21: 52 km, odciążenia 36 km |
| P2 | 12 km/tydz., `peakWeeklyKm: 50`, siła | wzrost z 13 do 38 km, trzy biegi w tygodniu, cztery tylko w tygodniach sprawdzianu |
| P2b | 12 km/tydz. bez `peakWeeklyKm` | szczyt 17 km, długie 6 km, jedno ostrzeżenie |
| P3 | jak P1 + `time.weeklyMinutes: 240` | tydzień ładowania 16 km, odciążenie 24 km, taper 29 km |
| P4 | v2: bieg, rower, pływanie po 2×45 min, cel bazowy | `week` 173 wiersze, `today` 69, `plan` 3 |

**P1, tygodnie ładowania 2–21 (bez odciążeń i sprawdzianów):**

```
wt I8   3 km + 4×1 km @4:32, przerwy 2 min marsz + 1 km      (tyg. 2–17)
        3 km + 4×1 km @4:04, przerwy 3 min trucht + 1 km     (tyg. 18–21)
cz E17
sb L19
nd T8   3 km + 4 km narastająco 5:01 do 4:32 + 1 km          (tyg. 2–17)
        3 km + 4 km zmiennie 4:25 / 5:05 + 1 km              (tyg. 18–21)
```

Pozostałe tygodnie P1: odciążenie `wt I8, sb L13, nd E15`; tydzień sprawdzianu
(5, 11, 17) `wt E6, śr E6, cz podbiegi 12, sb TT9, nd L19`; taper
`wt I8, śr E10, cz E10, nd T8`; drugi tydzień po starcie `wt I10` z 6×1 km @4:32.

**Obserwacje i mechanizm:**

1. **Brak progresji.** Dawka akcentu to funkcja kilometrażu tygodnia
   (`microcycle.ts:462`), a kilometraż osiąga szczyt w drugim tygodniu
   (`macrocycle.ts:155–165`, `:240`). W tygodniach 2–21 plan ma trzy szablony:
   ładowanie, odciążenie i sprawdzian. Tydzień ładowania powtarza się 12 razy
   bez zmiany dawki. Baza i budowanie są identyczne, szczyt zmienia tempo
   interwałów i typ drugiego akcentu.
2. **Długie nie rośnie i nie osiąga progu.** `longKm = min(round(0,356 × cel), 35)`
   (`microcycle.ts:461`) daje 19 km. J-2 i P-7 podają dla półmaratonu >21 km.
3. **Brak pracy w tempie startowym.** `zones.marathon` służy tylko jako początek
   biegu narastającego.
4. **Liczba biegów nie idzie za dostępnymi dniami.**
   `ceil(km / typicalKmPerSession)` z `typicalKmPerSession: 14`
   (`microcycle.ts:411–414`) daje 4 biegi przy 52 km i 3 biegi do 42 km. Stała
   pochodzi z korpusu o medianie 64 km/tydz.
5. **Dzień podbiegów znika po cichu.** Gdy tydzień nie ma wolnego slotu
   spokojnego, kod zamienia ostatni akcent ciągły albo podbiegi na bieg spokojny
   i dokłada do niego całą resztę kilometrów (`microcycle.ts:531–535`). Stąd
   czwartek 17 km w P1 i niedziela 16 km przy długim 14 km w P2.
6. **Długie nie jest najdłuższym biegiem tygodnia** w każdym odciążeniu P1
   (L13, E15) i w tygodniach 17, 18, 19 i 21 P2 (L12–L14, E13–E16).
7. **Liczba akcentów zależy od liczby dostępnych dni, a nie od liczby biegów.**
   `qualityPerWeek` (`macrocycle.ts:177`) daje 2 akcenty przy ≥4 dniach, także
   gdy tydzień ma 3 biegi. Pomiar z etapu 1 (S-12) pokazał, że trener robi tak
   samo, więc to zostaje.
8. **Stała rama 3 km + 1 km i minimum 4 powtórzeń** (`microcycle.ts:168`) dają
   sesję 8 km przy każdej objętości. W P2 to połowa tygodnia 16 km, a obok
   powstaje bieg 2 km.
9. **Największa sesja interwałowa planu wypada 9 dni po starcie** (6×1 km wobec
   4×1 km w całym przygotowaniu). W tygodniu przejściowym nie ma drugiego
   akcentu ani podbiegów, więc pętla I-5 nie przycina dawki.
10. **Pętla I-5 liczy udział spokojnego biegania przed rozdaniem reszty
    kilometrów** (`microcycle.ts:489–504`), więc przycina akcenty mocniej, niż
    wymaga reguła. Tydzień ładowania P1 kończy z 85% spokojnego biegania przy
    progu 75%.
11. **Akcent wypada w niedzielę, dzień po długim.** Pomiar z etapu 1 pokazał,
    że w korpusie to równie częsty układ jak odwrotny (S-9b). To nie jest
    usterka, brakuje tylko wyjaśnienia w `why`.
12. **Budżet czasu odwraca strukturę.** `fitTimeBudget` (`planfile.ts:270–324`)
    przycina każdy tydzień osobno do limitu minut, a minuty siły są stałe:
    2 sesje w tygodniu ładowania, 1 w odciążeniu, 0 w taperze. Im mniej siły,
    tym więcej kilometrów. `check` zgłasza taper (T-4), odciążenia nie zgłasza.
13. **Mała baza kończy się ostrzeżeniem.** Bez `peakWeeklyKm` sufit to
    `start × 1,4` (`macrocycle.ts:156`). Plan do półmaratonu rośnie z 12 do
    17 km z długim 6 km. FOUNDATIONS nie ma reguły powrotu po przerwie, a R-5
    się na nią powołuje.
14. **Dwa style widoków.** Plan biegowy: tabela z opisem słownym, który zawija
    się do trzech wierszy, tempo biegu spokojnego dopiero w `why`. Plan v2:
    pełna karta na sesję także w widoku tygodnia.
15. **Wykonanie porównywane tylko po dystansie** (`execution.ts:20–41`).
    `SyncedActivity` nie ma okrążeń.

---

## 2. Etapy realizacji

Cztery etapy to minimum. Etap 1 musi być osobny, bo pomiar w korpusie
rozstrzyga, co zmienia się w silniku. Etap 4 musi być osobny, bo zmiana modelu
danych w jednym przeglądzie ze zmianą silnika nie dałaby się ocenić.

| Etap | Wydanie | Zakres | Testy własne etapu |
|---|---|---|---|
| **1. Fundament** | 0.6.1 | pakiet A; B0; B9; wszystkie pomiary (`tools/corpus/season_profile.py`) i wpisy FOUNDATIONS z punktów „Nauka" w B1–B8; wskaźnik bieżącego planu w `CLAUDE.md` | migawka macierzy utworzona na niezmienionym silniku i bez różnic na końcu etapu; `tools/corpus/test_parse_plans.py` |
| **2. Silnik biegowy** | 0.7.0 | B1–B8, B10; pola segmentu i poprawki zapisu z C1; linty kształtu podpięte do `check` | macierz bez pięciu lintów kształtu; DoD pakietu B na P1–P3; `regenerate.test.ts`, `cycle.test.ts`, `engine-060.test.ts`, `time-budgets.test.ts`; backtest lokalnie; `pnpm simulate:coaching`, `pnpm simulate:multisport` |
| **3. Widoki i wykonanie** | 0.8.0 | C1–C7, D1–D5, F3 | migawki przy 60, 80, 100, 120 kolumnach w PL, EN i ASCII; budżety wierszy z C2; MCP bez ANSI; syntetyczne FIT i TCX; `pnpm plugin:build` i `scripts/verify-plugin.mjs` |
| **4. Jeden model danych** | 0.9.0 | pakiet E | ten sam kształt sezonu w v1 i v2 na macierzy; lista parytetu; migracja; `pnpm simulate:multisport --artifacts`; weryfikacja pluginu |

**Etap 1** nie zmienia żadnej liczby w silniku ani zapisanych planów. Pierwszy
commit tworzy migawkę macierzy na silniku z 0.6.0. Linty kształtu działają
w tym etapie tylko w teście macierzy. Do `check` trafiają w etapie 2, żeby
`check --strict` w CI użytkowników nie zaczął zawodzić w wydaniu poprawkowym.
Wynik etapu to lista odpaleń lintów na macierzy i tabela pomiarów
w FOUNDATIONS. Jeśli pomiar przeczy propozycji z pakietu B, punkt jest
korygowany w tym dokumencie przed startem etapu 2.

**Etap 2**, kolejność commitów: B1 z B2, B3, B4, B5, B6, B8, B7, B10. B7 jest
na końcu, bo budżet przycina gotowy kształt. Etap ma jedną zmianę wersji
silnika i jedną zmianę przyszłych dni przy regeneracji, dlatego obejmuje też
nowe pola segmentu i poprawki zapisu opisów (decyzja 4).

**Etap 3**, kolejność commitów: C1, C2, C3 z C4, C5 z C6, D1, D2 z D3, D4 z D5,
C7 z F3.

**Etap 4**: kroki 1–4 pakietu E w podanej kolejności.

**Poza etapami**, działania właściciela: wydanie po każdym etapie; F1 po
etapie 2, z wynikiem przed startem etapu 4; F2 przez cały sezon.

---

## 3. Pakiet A: poprawki tekstu i etykiet (etap 1)

Każdy punkt: objaw, miejsce, zmiana, test. Żaden nie zmienia zapisanego planu.

### A1. `review`: tabela wykonania ma nagłówki z tabeli zmian

- **Objaw:** „Wykonanie dzień po dniu" ma kolumny „Przed zmianą", „Po zmianie",
  „Dane wykonania" dla planu, wykonania i statusu.
- **Miejsce:** `commands.ts:1455` używa `ui().improve.before/after/data`
  (`improve-pl.ts:29`, `:45`).
- **Zmiana:** osobne klucze `review.columns.planned/actual/status`
  („Plan", „Wykonanie", „Status") w obu językach.
- **Test:** `review.test.ts`: nagłówki w PL i EN; `cli-i18n.test.ts`.

### A2. `review`: „Do startu: do startu: 150 dni"

- **Miejsce:** `commands.ts:1531` łączy etykietę `review.toRace` z
  `raceDistanceLine`, które samo zaczyna się od „do startu:" (`cli-pl.ts:238`).
- **Zmiana:** rozdzielić wartość („150 dni") od zdania z etykietą. `today`
  i `status` biorą tę samą wartość.
- **Test:** `review.test.ts`: brak powtórzonej etykiety w obu językach.

### A3. Liczby dziesiętne w jednym formacie na język

- **Objaw:** „21.0975 km" w `plan` i `why`, a „21,1 km" w ostrzeżeniu tego
  samego `plan`; „VDOT 47.7" w `plan` i `why`, „47,7" w `status` i `PLAN.md`.
- **Miejsce:** `commands.ts:396`, `:404`; ręczne interpolacje liczb.
- **Zmiana:** funkcje `fmtKm` i `fmtDecimal` w `core/i18n/locale.ts`: przecinek
  w PL, kropka w EN, dystans startu do jednego miejsca („21,1 km"). Wszystkie
  widoki i `PLAN.md` przechodzą przez nie.
- **Test:** `no-leaks.test.ts`: brak wzorca `\d\.\d` w polskim wyjściu `plan`,
  `why`, `status`, `week`; test jednostkowy formatowania.

### A4. „taper: tyg. 22–22"

- **Miejsce:** `phaseSpan` w `cli-pl.ts:194` i odpowiednik EN.
- **Zmiana:** jeden tydzień drukowany jako „tyg. 22".
- **Test:** `commands.test.ts` dla planu z jednotygodniowym taperem.

### A5. Status z dziennika po angielsku w polskim wyjściu

- **Objaw:** `[done]` w `week` (`commands.ts:615`), „ostatni 2026-10-27 (done)"
  w `status`.
- **Zmiana:** słowo z katalogu („wykonany", „opuszczony", „częściowo").
  `data.status` zostaje surowym enumem dla MCP i `--json`.
- **Test:** `no-leaks.test.ts` w obu kierunkach; `--json` bez zmian.

### A6. Zawijanie rozcina adresy i ścieżki

- **Objaw:** „FOUNDATION / S.md" w `why`, ścieżka katalogu w `status`.
- **Miejsce:** `wrap()` w `ui/blocks.ts:69–76` tnie słowo dłuższe niż wiersz po
  grafemach.
- **Zmiana:** token zaczynający się od `http://`, `https://` albo wyglądający na
  ścieżkę trafia do osobnego wiersza w całości. Terminal zawinie go sam, a link
  zostaje klikalny.
- **Test:** test `wrap` przy szerokościach 40, 60 i 80.

### A7. Wiek wyniku kalibracyjnego liczony od dwóch dat

- **Objaw:** `status` „sprzed 32 dni" (od dziś), `why` „sprzed 25 dni" (od daty
  kalibracji planu) dla tego samego wyniku.
- **Miejsce:** `status.ts:94`, `calibration.ts:16`.
- **Zmiana:** oba widoki podają wiek od dziś. `why` dodaje datę kalibracji
  osobnym polem.
- **Test:** `coach-flows.test.ts` z `TRAINCTL_TODAY` późniejszym niż plan.

### A8. „cel 52 km · zaplanowano 52 km"

- **Zmiana:** gdy obie liczby są równe, `week` drukuje jedną. Różnica zostaje
  widoczna jak dziś.
- **Test:** `commands.test.ts`.

### A9. Zamknięcie pakietu

CHANGELOG „Fixed", bez zmian w silniku i w `plan.yaml`.

---

## 4. Pakiet B: silnik biegowy (etapy 1 i 2)

B0, B9 i pomiary z punktów „Nauka" należą do etapu 1. B1–B8 i B10 to etap 2,
w jednym wydaniu 0.7.0. Wartości oznaczone „inż." to propozycje do potwierdzenia pomiarem. Bez pomiaru
zostają w kodzie z komentarzem „inż." i wpisem w FOUNDATIONS.

### B0. Narzędzie pomiaru: profil sezonu, macierz profili, linty kształtu

- **Nowa funkcja:** `seasonProfile(plan): SeasonRow[]` w
  `packages/core/src/engine/season.ts`. Wiersz tygodnia: indeks, data, faza,
  odciążenie, km, liczba biegów, km długiego, lista akcentów z dawką części
  głównej (powtórzenia, długość, tempo), liczba sesji siły, flagi.
- **Macierz profili syntetycznych** w `plan-shape.test.ts`: baza 12, 25, 45,
  70 km × dni 3, 4, 5, 6 × cel 10 km, półmaraton, maraton, baza × horyzont 8,
  16, 24 tygodnie × budżet brak, 240, 360 min. Migawka tekstowa kształtu sezonu
  w repo. Profile bez danych osobowych.
- **Nowe ostrzeżenia w `validate.ts`** (`warn`, opisy w obu językach przez
  `describeIssue`):
  - `longNotLongest`: bieg spokojny dłuższy niż długie w tym samym tygodniu;
  - `deloadNotLighter`: tydzień odciążenia ≥ lżejszy z sąsiednich tygodni
    ładowania (P-2);
  - `sessionShareHigh`: jednostka inna niż długie, start i sprawdzian ponad
    35% kilometrów tygodnia (inż.);
  - `postRaceAccentHeavy`: akcent w bloku przejściowym większy niż najmniejszy
    akcent ostatniego bloku budowania (R-8);
  - `staleProgression`: dwa kolejne bloki ładowania w fazie budowania albo
    szczytu z identyczną dawką obu akcentów i długiego (P-1, inż.);
  - `longBelowGoal`: najdłuższy bieg planu poniżej progu J-2 albo P-8. To
    ostrzeżenie wykonalności w `plan`, a nie lint tygodnia.
- **Podpięcie:** w etapie 1 linty kształtu działają tylko w teście macierzy.
  Do `check` i `trainctl_check` trafiają w etapie 2.
- **Stan oczekiwany po B0:** ostrzeżenia odpalają się na P1–P3. Lista tych
  odpaleń jest definicją ukończenia B1–B8: na macierzy ma ich nie być albo mają
  być zastąpione jawnym ostrzeżeniem wykonalności.
- **Test:** `validate.test.ts` po jednym przypadku na kod; `check.test.ts`.

### B1. Liczba biegów i układ tygodnia

- **Objaw:** obserwacje 4, 5, 6, 7 z §1.
- **Nauka (wykonana w etapie 1, FOUNDATIONS §10.15):** S-10 — najdłuższy
  inny bieg spokojny to mediana 0,60–0,83 i P90 0,67–0,91 długiego (130
  tygodni). Że długie jest najdłuższe, wynika z definicji jednostki (J-1, S-2). S-11 — liczba biegów rośnie z objętością tak, jak liczy
  `typicalKmPerSession` 14, od 30 km w górę. S-12 — przy trzech biegach trener
  daje dwa akcenty.
- **Zmiana (po pomiarze):**
  1. sufit biegu spokojnego `min(EASY_RUN_CAP_KM, 0,9 × długie)` (S-10, P90). Gdy reszta
     kilometrów go przekracza i jest wolny dostępny dzień, dochodzi bieg (S-11);
  2. liczba akcentów bez zmian. Propozycja ograniczenia akcentów przy trzech
     biegach odpada (S-12);
  3. gałąź `microcycle.ts:531–535` respektuje sufit biegu spokojnego. Reszta
     kilometrów, której nie da się rozdać, obniża `totalKm` i zostawia flagę
     w szkielecie;
  4. usunięcie dnia podbiegów zapisuje flagę widoczną w `why`.
- **Test:** macierz B0 bez `longNotLongest`; `microcycle.test.ts` dla 3, 4, 5
  dni przy 30, 45, 60 km; backtest w progach.

### B2. Rama i minimalna dawka przy małej objętości

- **Objaw:** obserwacja 8. Sprawdzian 9 km w tygodniu 21 km w P2.
- **Zmiana:**
  1. gdy akcent przekroczyłby 35% tygodnia (inż.), rozgrzewka schodzi do 2 km,
     a minimum powtórzeń do 3. Jeśli to nie wystarcza, tydzień dostaje bieg
     spokojny z przebieżkami (J-6, opisane jako praktyka) w miejsce akcentu;
  2. minimalny bieg spokojny 3 km (inż.). Krótsza reszta dolicza się do innego
     biegu;
  3. warunek sprawdzianu (`macrocycle.ts:269`) liczy całą jednostkę z ramą.
- **Test:** macierz B0 bez `sessionShareHigh`; `microcycle.test.ts` dla 12, 16,
  20 km.

### B3. Trajektoria objętości

- **Objaw:** obserwacja 1.
- **Nauka (wykonana, §10.15):** P-12 — szczyt 5–7 tygodni przed startem ≥ HM,
  około 0,6 szczytu 13–15 tygodni przed (n = 3). T-7 podaje około 4 tygodnie.
  Silnik trzyma się T-7 i P-12 razem: szczyt w ostatnim bloku ładowania przed
  taperem.
- **Zmiana:**
  1. wzrost od `recentWeeklyKm` do szczytu rozłożony na bloki ładowania tak, by
     szczyt wypadł w ostatnim bloku przed taperem. Biegacz już na szczycie
     zaczyna od około 0,7 szczytu (P-12, inż. dla dokładnej wartości). Tempo wzrostu to mniejsza z wartości P-3
     i potrzebnej;
  2. fala w bloku: trzy tygodnie ładowania rosną, np. 0,94, 0,97, 1,00 poziomu
     bloku (inż.), czwarty to odciążenie;
  3. biegacz, który jest już na docelowym szczycie, dostaje tę samą falę wokół
     plateau;
  4. `start × 1,4` i `start × 1,15` dostają ID reguły albo etykietę „inż."
     (patrz B9).
- **Test:** `macrocycle.test.ts`: tydzień szczytu względem startu, monotonia
  bloków, taper bez zmian (T-4, T-5); macierz B0 bez `staleProgression` dla
  objętości.

### B4. Długie wybieganie

- **Objaw:** obserwacja 2.
- **Nauka (wykonana, §10.15):** J-10 — długie rośnie z ~15 km 15 tygodni przed
  startem do 23–25 km 2–7 tygodni przed (n = 3). Udział długiego w tygodniu
  0,29–0,41 według objętości.
- **Zmiana:**
  1. osobny tor długiego: cel zależny od dystansu (półmaraton 22 km, maraton
     30–32 km, krócej według udziału), osiągany w bloku szczytowym;
  2. krok do 2 km na tydzień ładowania (inż.), spadek w odciążeniu, sufit
     udziału w tygodniu według P90 z korpusu;
  3. gdy objętość nie uniesie progu, `plan` pokazuje `longBelowGoal`
     z liczbami;
  4. długie z odcinkami w tempie startowym dopiero po pomiarze. PLAN-v0.4 §8
     odnotował, że w korpusie to krótszy wzorzec, a nie długie z dodatkiem.
- **Test:** macierz B0: P1 osiąga >21 km przed taperem; maraton nie przekracza
  35 km (N-19); `validate.test.ts` `longOverCap` bez zmian.

### B5. Progresja akcentów i repertuar

- **Objaw:** obserwacje 1, 3, 9, 10.
- **Nauka (wykonana, §10.15):** J-8 — km poza Z1 na sesję rosną ~3 → 7,5 → 9
  → 10 w kolejnych pasmach czterotygodniowych przed startem. J-9 — praca
  ciągła wydłuża się z 7 do 12–15 km. Tempa startowego korpus nie potwierdza
  (§11.2 p. 12), więc jednostek „w tempie startowym" nie dodajemy. J-4
  (drabinki 1000/400/200 m) jest zapisana, a kod jej nie realizuje.
- **Zmiana:**
  1. pętla I-5 liczy udział po rozdaniu reszty kilometrów;
  2. dawka = dawka bazowa z kilometrażu + krok za tydzień w bloku, ograniczona
     przez I-5, udział mocnych kilometrów 25% i sufit jednostki. Po odciążeniu
     blok startuje z poziomu drugiego tygodnia poprzedniego bloku (inż.);
  3. biblioteka jednostek według fazy: drabinka J-4 w szczycie, wydłużany
     blok ciągły w budowaniu (J-9), bez jednostek w tempie startowym;
  4. akcent w drugim tygodniu po starcie nie większy niż najmniejszy akcent
     ostatniego bloku budowania.
- **Test:** macierz B0 bez `staleProgression` i `postRaceAccentHeavy`;
  `microcycle.test.ts` dla kroku w bloku; `easyShareLow` nie pojawia się na
  świeżym planie; backtest: liczba akcentów bez zmian.

### B6. Kolejność weekendu

- **Objaw:** obserwacja 11. Sprawdzian w sobotę i 19 km w niedzielę.
- **Nauka (wykonana, §10.15):** S-9b — „długie→akcent" 52 razy,
  „akcent→długie" 53 razy; dzień po długim to najczęściej akcent (66 z 97).
  Po sobotnim starcie niedzielny bieg ma medianę 25 km (n = 15, T-11).
- **Zmiana (po pomiarze):** układ zostaje. `why` dla akcentu dzień po długim
  i dla długiego dzień po sprawdzianie cytuje S-9b albo T-11.
- **Test:** `coach-flows.test.ts`: zdanie z S-9b w `why`; `validate.test.ts`
  `accentGap` bez zmian.

### B7. Budżet czasu zachowuje kształt makrocyklu

- **Objaw:** obserwacja 12.
- **Zmiana:**
  1. z budżetu tygodnia wyliczyć sufit kilometrów dla tygodnia ładowania
     (z siłą taką, jaka w nim wypada) i podać go planerowi makrocyklu jako
     ograniczenie szczytu. Odciążenie i taper liczą się od tego szczytu;
  2. przycinanie tydzień po tygodniu w `fitTimeBudget` zostaje jako
     zabezpieczenie i nie może podnieść tygodnia ponad sąsiednie tygodnie
     ładowania;
  3. gdy sufit spycha szczyt poniżej P-7 albo P-8, ostrzeżenie podaje dwie
     jawne możliwości: jedna sesja siły tygodniowo (F-14) albo większy budżet.
     Silnik niczego nie zmienia sam;
  4. opis E-2 w FOUNDATIONS §10.14 zaktualizowany.
- **Uwaga:** ten obszar miał najwięcej regresji w 0.4.0. Zmiany dotykają
  `scaleToBaseline`, `uncappedKm`, `timeCappedKm` i `budgetWarnings`.
- **Test:** P3: odciążenie poniżej ładowania, taper nie większy niż ostatni
  tydzień ładowania, `check` bez T-4; pełne `regenerate.test.ts`,
  `cycle.test.ts`, `engine-060.test.ts`, `time-budgets.test.ts`; nowe przypadki
  weryfikowane mutacją.

### B8. Mała baza i powrót po przerwie

- **Objaw:** obserwacja 13.
- **Nauka (wykonana, §10.15):** R-11 jako wartość inżynierska: start z ~50–60%
  objętości sprzed przerwy, pierwszy blok spokojnie, wzrost w granicach P-3.
  RCT dotyczącego progresji powrotu nie znaleziono (§11.2 p. 11).
- **Zmiana:**
  1. profil: `athlete.returning: { since, previousWeeklyKm }` z walidacją
     w `config.ts`. Kreator `init` pyta o przerwę. `init --from-intervals`
     proponuje wartości z historii (`infer-profile.ts`);
  2. silnik: pierwszy blok wyłącznie spokojny, wzrost w stronę poprzedniej
     objętości w granicach R-11, bez sprawdzianu w pierwszym bloku;
  3. werdykt wykonalności w `plan`: jeden blok z trzema liczbami (szczyt planu,
     próg dla dystansu, najdłuższy bieg) i trzema wyjściami: data, od której
     próg jest osiągalny, podanie `peakWeeklyKm` z historii, cel bazowy
     (`goal.kind: base`).
- **Test:** `macrocycle.test.ts` dla 12 km z przerwą i bez; `commands.test.ts`
  dla werdyktu; `interactive.test.ts` dla kreatora.

### B9. Stałe silnika bez ID reguły i bez etykiety „inż."

Reguła 4 z `CLAUDE.md`. Do oznaczenia albo podparcia regułą:

| Miejsce | Stała |
|---|---|
| `macrocycle.ts:156` | sufit `start × 1,4` bez `peakWeeklyKm` |
| `macrocycle.ts:164` | wzrost `start × 1,15` dla planu ze startem |
| `macrocycle.ts:173–174` | podział faz 0,4 i 0,2 |
| `microcycle.ts:462` | część główna akcentu `0,22 × km` |
| `microcycle.ts:464` | odcinek spokojny przed podbiegami 5–8 km, `0,1 × km` |
| `microcycle.ts:482`, `:526`, `:534`, `:540` | sufit biegu spokojnego 18 km |
| `microcycle.ts:513` | udział mocnych kilometrów 25% |
| `microcycle.ts:150`, `:164`, `:175` | przerwy 120 i 180 s |
| `microcycle.ts:225–226` | przedstartowe 5×300 m |
| `microcycle.ts:393–394` | tydzień startowy: `(sessionCount ?? 4) − 1`, biegi po 5 km |

- **Test:** `cmdRules` pokazuje nowe wpisy; przegląd ręczny z listą w opisie PR.

### B10. Zamknięcie pakietu

FOUNDATIONS §10 (J-8, J-9, R-11, zmiany E-2, etykiety z B9) i §11; SPEC: nowe
ADR-y z §10 tego planu, „znane uproszczenia silnika"; oba README (pole
`athlete.returning`); CHANGELOG „Changed" z opisem, co zmieni pierwsza
regeneracja; `backtest` uruchomiony lokalnie, wynik w opisie PR.

**DoD pakietu B (etap 2):** macierz B0 bez `longNotLongest`, `deloadNotLighter`,
`sessionShareHigh`, `postRaceAccentHeavy`, `staleProgression`; P1 osiąga
długie >21 km; P3 zachowuje kształt; P2b dostaje werdykt wykonalności
z wyjściami; każda nowa i stara stała ma ID albo etykietę.

---

## 5. Pakiet C: jedna warstwa prezentacji (etap 3)

### C1. Notacja jednostki generowana ze struktury

- **Dziś:** widoki drukują `segments[].description`, czyli zdania w stylu
  korpusu (`core-pl.ts:77–98`). Rodzaj przerwy (marsz albo trucht) i przerwa
  w połowie serii istnieją tylko w tekście.
- **Zmiana:**
  1. `PlannedSegment` dostaje opcjonalne pola `recoveryMode: 'walk' | 'jog'`
     i `setBreak: { afterRep, sec, mode }`. Stare plany bez tych pól działają:
     notacja pomija rodzaj przerwy;
  2. czysta funkcja `sessionLine(workout | session, locale)` w core, bez ANSI,
     wspólna dla `PlannedWorkout` i kroków v2;
  3. opis słowny zostaje w `plan.yaml` i w `why`. Dwie poprawki zapisu:
     „2-minutowe" zamiast „2 minutowe" (`core-pl.ts:22–23`) i `×` zamiast `*`.
     To zmienia tekst przyszłych dni przy regeneracji (patrz §12).
  Punkty 1 i 3 wchodzą w etapie 2 razem ze zmianą silnika, żeby przyszłe dni
  zmieniły się raz. Punkt 2 to etap 3.
- **Specyfikacja notacji:**

  | Element | PL | EN | Bez Unicode |
  |---|---|---|---|
  | powtórzenia | `4×1 km` | `4×1 km` | `4x1 km` |
  | tempo | `@4:32`, zakres `@5:05–6:05` | to samo | `@5:05-6:05` |
  | narastanie | `5:01→4:32` | to samo | `5:01->4:32` |
  | zmienny | `1 km @4:25 / 1 km @5:05` | to samo | to samo |
  | przerwa | `p. 2' marsz`, `p. 3' trucht` | `r. 2' walk`, `r. 3' jog` | to samo |
  | rama | `RG 3 km`, `SCH 1 km` | `WU 3 km`, `CD 1 km` | to samo |
  | czas | `2'` minuty, `30"` sekundy | to samo | to samo |

  Jednostka tempa (min/km) i skróty są objaśnione w jednym wierszu legendy pod
  widokiem oraz w `help`.
- **Test:** test jednostkowy na każdy typ segmentu i kroku v2 w obu językach
  i w ASCII; brak `\x1b[`; `no-leaks.test.ts`.

### C2. Trzy poziomy szczegółowości

Wspólny model wiersza `SessionRow { date, weekday, sport, kind, km, minutes,
line, status }` budowany z planu v1 i z planu v2. Handlery zwracają bloki.
Blok `table` dostaje opcjonalny wiersz sumy (`foot`). To jedyna zmiana w
`ui/blocks.ts`.

**Sezon** (`trainctl season`, nowa komenda tylko do odczytu, oraz ta sama
siatka w wyjściu `plan`). Makieta z liczb P1:

```
tydz  od     faza      km  akcenty                        długie
  1   19.10  baza      49  4×1 km @4:32 · 4 km 5:01→4:32      17
  2   26.10  baza      52  4×1 km @4:32 · 4 km 5:01→4:32      19
  4   09.11  baza ↓    36  4×1 km @4:32                       13
  5   16.11  baza      52  podbiegi · sprawdzian 5 km         19
 18   15.02  szczyt    52  4×1 km @4:04 · zmienny 4 km        19
 23   22.03  start     16  5×300 m @4:04                   START
```

**Tydzień** (`week`): jeden wiersz na jednostkę, suma, znacznik dnia.
Makieta z tygodnia 2 P1:

```
Tydzień 2/25 · baza · 26.10–1.11 · 52 km · 4 biegi · 2 siły

   dz  typ          km  czas  rozpiska
   pn  wolne
 ✓ wt  interwały     8  1:06  RG 3 km · 4×1 km @4:32 p. 2' marsz · SCH 1 km
   śr  siła             0:35
 ▸ cz  spokojne     17  1:59  17 km @5:05–6:05
   pt  siła             0:35
   sb  długie       19  2:21  19 km @6:05–6:35
   nd  narastające   8  1:00  RG 3 km · 4 km 5:01→4:32 · SCH 1 km
                    ──  ────
                    52  7:36
```

**Dzień** (`today`): struktura z celami, czas, następna jednostka.

```
wt 27.10 · interwały · 8 km · około 66 min · tydz. 2/25 baza

  rozgrzewka   3 km     5:05–6:05
  główna       4×1 km   4:25–4:38   przerwa 2' marsz
  schłodzenie  1 km     trucht
```

- **Zasady:**
  - stałe kolumny typu, dystansu, czasu i rozpiski we wszystkich widokach;
  - tempo biegu spokojnego i długiego widoczne w `week` i `today`, a nie
    dopiero w `why`;
  - status słowem w wyjściu tekstowym i MCP, symbolem dodatkowo w terminalu;
  - pełne karty (cel, uzasadnienie, wskazówki, skala RPE) w `why` i pod flagą
    `--full`. Skala RPE drukowana raz na widok;
  - plan v2: kilka sesji dziennie to kilka wierszy z jednym oznaczeniem dnia
    i kolumną sportu.
- **Budżety wierszy przy 80 kolumnach (DoD):** `week` biegowy do 14 wierszy,
  `week` v2 do liczby sesji + 9 (dziś 173 dla sześciu sesji), `today` do 18
  (dziś 69 w v2), `season` do liczby tygodni + 10.
- **Miejsce:** `cmdWeek` `commands.ts:599–643`, `cmdToday` `:521–597`, szkic
  faz w `planImpl` `:438–451`, gałąź `today/week/why/status` w
  `sports-commands.ts:129–162`, `trainingCard` w `ui/training.ts`.
- **Test:** migawki przy 60, 80, 100, 120 kolumnach, `NO_COLOR`, ASCII, PL i EN;
  test MCP: te same dane w `structuredContent`; `bin.test.ts`; uzupełnienia
  powłoki i `help season`.

### C3. `PLAN.md` w tym samym układzie

- **Dziś:** `renderMarkdown` (`planfile.ts:570–624`) drukuje 25 tabel z opisem
  słownym.
- **Zmiana:** na górze siatka sezonu, niżej tygodnie w układzie wiersza z C2.
  Eksporty `print` i `mobile` (`packages/export`) korzystają z tej samej
  funkcji wiersza.
- **Test:** `docs.test.ts` i testy eksportu; plan v1 i v2.

### C4. `plan` w katalogu v2

- **Objaw:** P4: `plan` drukuje „Plan jest aktualny" i ostrzeżenie MS-1.
- **Zmiana:** nagłówek jak w planie biegowym (cel, horyzont, czas tygodniowy na
  sport) i siatka sezonu.
- **Test:** test `sportsCommand('plan')` dla planu aktualnego i zmienionego.

### C5. Wskazówka wysiłku dla jednostek biegowych

- **Dziś:** bieg w planie v2 niesie `legacyWorkout` z jednym krokiem
  `target: open` (`sports-running.ts:25`). Karta pisze „Nie określono zakresu
  RPE".
- **Zmiana:** planowana wskazówka RPE dla typu segmentu biegowego, tą samą
  drogą co w rowerze i pływaniu (MS-6, „inż."). To opis zamiaru. Nie służy do
  kalibracji stref (Z-4) ani do oceny wykonania (ADR-027).
- **Test:** karta biegu ma zakres RPE; `adapt` i `review` nie czytają tej
  wartości.

### C6. Teksty poza katalogami

- **Dziś:** `getLocale() === 'pl' ? pl : en` w `ui/training.ts`,
  `sports-transaction.ts`, `core/sports/coaching.ts`. Strażnicy katalogów tych
  tekstów nie widzą.
- **Zmiana:** przenieść do katalogów (`cli-en.ts` jako źródło typu, teksty
  domenowe w `core/i18n`). `cli-i18n.test.ts` i `no-leaks.test.ts` obejmują
  wyjście v2.
- **Test:** strażnicy; brak wzorca `getLocale() ===` poza `i18n/`.

### C7. Dokumentacja

Oba README, `docs/MULTISPORT.md`, `docs/REVIEWED-ADAPTATION.md`, generator
`AGENTS.md` (`agents-md.ts`) i skille pluginu (`plugin-skills.ts`), jeśli
cytują stare wyjście. ADR dla komendy `season` i notacji.

**DoD pakietu C:** jeden model wiersza obsługuje plan v1 i v2; budżety wierszy
z C2 spełnione; MCP dostaje krótszy tekst i te same dane; `PLAN.md` i eksporty
w tym samym układzie.

---

## 6. Pakiet D: wykonanie nie tylko w kilometrach (etap 3)

### D1. Okrążenia w porcie sync

- **Zmiana:** `SyncedActivity.laps?: { distanceKm, movingTimeSec, avgHr? }[]`
  w `ports/sync.ts`. Źródła: komunikaty `lap` w FIT (`sync-files/fit.ts` czyta
  dziś `session` i `record`), elementy `<Lap>` w TCX, interwały aktywności
  w intervals.icu. GPX okrążeń nie ma.
- **Przed kodem:** sprawdzić w dokumentacji API intervals.icu punkt końcowy
  interwałów aktywności i dopisać wynik do `docs/integrations/intervalsicu.md`.
- **Test:** `fit.test.ts`, `tcx.test.ts` na syntetycznych plikach
  (`fit-fixture.ts`); adapter intervals.icu na zapisanych odpowiedziach bez
  danych osobowych.

### D2. Opisowe porównanie akcentu z celem

- **Zmiana:** dla jednostek z powtórzeniami dopasować okrążenia robocze do
  planu (liczba, dystans z tolerancją). `ExecutionRecord.intervals` podaje
  liczbę zaplanowanych i dopasowanych odcinków, tempa i liczbę odcinków
  w zakresie. Automatyczne okrążenia co kilometr nie pasują do struktury i dają
  „brak okrążeń pasujących do planu", bez zgadywania.
- **Granica:** to fakty w `review`. Nie zmieniają objętości ani stref
  (ADR-011, ADR-027).
- **Test:** `review.test.ts`: komplet odcinków, część odcinków, autolap.

### D3. Tempo biegów spokojnych i długich

- **Zmiana:** `review` zestawia średnie tempo (`avgPaceSecPerKm`) z zakresem
  strefy spokojnej. Bez oceny po tętnie (Z-3, Z-6).
- **Test:** `review.test.ts`.

### D4. Tabela `review`

Kolumny „Plan", „Wykonanie", „Status" z A1 w układzie wiersza z C2, z kolumną
tempa tam, gdzie są dane.

### D5. Podpowiedź kalibracji

- **Zmiana:** gdy odcinki w kolejnych akcentach są stale szybsze od górnej
  granicy celu, `review` proponuje dodanie wyniku albo sprawdzian (W-12, W-13).
  To propozycja tekstowa, bez zmiany planu.
- **Test:** `review.test.ts`, `coach-flows.test.ts`.

**DoD pakietu D:** plik FIT z interwałami daje w `review` wiersz z liczbą
odcinków i tempami wobec celu; brak okrążeń jest nazwany wprost.

---

## 7. Pakiet E: jeden model danych (etap 4)

- **Dziś:** plan biegowy v1 ma strefy z wyniku, reguły ze źródłami, solver,
  adaptację, pakiet startowy i backtest. Plan v2 ma trwałe ID sesji, kroki,
  karty i trzy sporty, a bieganie owija przez `legacyWorkout` (ADR-041). Dwie
  ścieżki komend (`commands.ts`, `sports-commands.ts`), dwa walidatory, dwa
  zestawy tekstów.
- **Kroki** (decyzja 5 z §9: v2 jedynym modelem po osiągnięciu parytetu):
  1. segmenty biegowe generują kroki v2 z celem tempa, tak by karty i eksporty
     nie potrzebowały `legacyWorkout`;
  2. lista parytetu v2 wobec v1: `reschedule`, `adapt`, `desk`, `shorten`,
     pakiet startowy, korekta cieplna, predykcja, backtest;
  3. po osiągnięciu parytetu `init` zakłada v2 domyślnie. Czytniki v1 i
     `migrate` zostają;
  4. jedna ścieżka komend nad modelem wiersza z C2.
- **Test:** macierz B0 daje ten sam kształt sezonu dla profilu biegowego w v1
  i w v2.

---

## 8. Pakiet F: walidacja i produkt (poza etapami, F3 w etapie 3)

- **F1. Przegląd trenerski.** Macierz z B0 wydrukowana eksportem `print` dla
  kilku profili i przekazana trenerowi z listą pytań: liczba biegów, kolejność
  weekendu, progresja akcentów, długie, powrót po przerwie. Wynik jako
  `docs/COACH-REVIEW-<data>.md`. Bez kodu. Termin: po etapie 2, wynik przed
  startem etapu 4.
- **F2. Pełny sezon.** Dziennik użycia na własnym planie: co tydzień jedna
  linia, co było zmieniane ręcznie i dlaczego. Ręczne zmiany są wejściem do
  kolejnych pomiarów.
- **F3. Świeżość danych.** Hook pluginu przy starcie sesji dopisuje do
  kontekstu wiek `sync.json` ze `status`. Bez pobierania w tle.
- **F4. Dostęp poza terminalem i tętno.** Rozstrzygnięte decyzjami 6 i 7 z §9.
  README opisuje ścieżkę telefonu w etapie 3.

---

## 9. Decyzje właściciela (przyjęte 2026-11-11)

| # | Decyzja | Skutek w planie |
|---|---|---|
| 1 | Wzorzec korpusu obowiązuje w zakresie objętości, który korpus pokrywa. Poniżej tego zakresu silnik używa wartości „inż." z jawną etykietą | B1, B2, ADR-049 |
| 2 | Notacja używa skrótów neutralnych (`RG`, `SCH`, `p.`). Skróty klubowe (OWB1, BC2, BNP, WT) są poza zakresem | C1, §11 |
| 3 | Widok sezonu to nowa komenda `season`, tylko do odczytu | C2, ADR-052 |
| 4 | Opisy słowne dostają poprawki zapisu („2-minutowe", `×`) razem ze zmianą silnika | etap 2 |
| 5 | Schemat v2 zostaje jedynym modelem po osiągnięciu parytetu z planem biegowym | etap 4, po etapach 2 i 3 |
| 6 | Bez hostingu i zdalnego MCP. Telefon obsługują kalendarz intervals.icu, zegarek i `export --what mobile` | §11, README w etapie 3 |
| 7 | Plan biegowy nie dostaje celów tętna | §11 |
| 8 | Przy ciasnym budżecie ostrzeżenie pyta o wybór między bieganiem a siłą. Silnik nie tnie siły sam | B7 |

---

## 10. Kandydaci ADR (następny wolny numer: 047)

| # | Decyzja (skrót) | Sedno uzasadnienia |
|---|---|---|
| 047 | Kształt sezonu jest kontraktem testowanym na macierzy profili i lintami kształtu | 1076 testów przechodzi przy planie, w którym tydzień ładowania powtarza się 12 razy bez zmiany dawki; testy sprawdzają reguły tygodnia, a nie sezon |
| 048 | Dawka akcentu i długie zależą od pozycji w bloku i fazie, nie tylko od kilometrażu tygodnia | przy stałym kilometrażu funkcja kilometrażu daje stały plan |
| 049 | Wzorzec korpusu obowiązuje w zakresie objętości, który korpus pokrywa; poza nim wartości inżynierskie z etykietą | mediana korpusu to 64 km/tydz.; ta sama rama przy 16 km daje sesję wielkości połowy tygodnia |
| 050 | Budżet czasu ogranicza szczyt, a proporcje makrocyklu zostają | przycinanie tygodni osobno odwraca odciążenie i taper |
| 051 | Notacja jednostki powstaje ze struktury; opis słowny jest dodatkiem | jeden zapis dla terminala, MCP, `PLAN.md` i eksportów; tekstu nie da się parsować między językami |
| 052 | Trzy poziomy szczegółowości i wspólny model wiersza dla v1 i v2; komenda `season` | dwa style widoków i 173 wiersze tygodnia w v2 |
| 053 | Okrążenia w porcie sync; porównanie akcentów jest opisem, nie wnioskiem | dystans nie mówi, czy akcent został wykonany; ADR-011 i ADR-027 zostają |
| 054 | Powrót po przerwie jako pole profilu i reguła R-11 | dziś mała baza kończy się ostrzeżeniem bez wyjścia |

---

## 11. Poza zakresem

- Zdalny serwer MCP, REST API i hosting (PLAN-v0.4 §8, bez zmian).
- Pozycje odrzucone na stałe w PLAN-v0.4 §8: autopilot HRV, gamifikacja, pogoda
  z sieci, metryki ryzyka urazu, zamiana odczuć na liczby.
- Kalibracja stref z okrążeń (D zostaje przy opisie).
- Nowa metodyka roweru i pływania. Pakiet E ujednolica model, a biblioteka
  jednostek v2 czeka na przegląd trenerski (F1).
- Double threshold (J-7, N-16).
- Cele tętna w planie biegowym (decyzja 7).
- Skróty klubowe w notacji (decyzja 2).

---

## 12. Ryzyka

- **Regeneracja po etapie 2 zmienia wszystkie przyszłe dni.** Mitygacja: jedna
  zmiana wersji silnika w całym planie, wpis „Changed", komunikat w `plan` przez
  jedno wydanie, ochrona przeszłości z ADR-033 bez zmian.
- **Pomiar w korpusie może nie potwierdzić propozycji** (kolejność weekendu,
  liczba sesji). Wtedy obecne zachowanie zostaje i dostaje ID reguły oraz
  zdanie w `why`. To też jest wynik.
- **Korpus to jeden trener i biegacze o wyższej objętości.** Wartości dla małej
  objętości są inżynierskie do czasu F1.
- **Budżet czasu ma historię regresji** (dziesięć rund przeglądu w 0.4.0).
  Mitygacja: B7 jako osobny commit na końcu etapu 2, pełny zestaw testów
  regeneracji, nowe testy weryfikowane mutacją.
- **Zmiana widoków łamie skrypty czytające tekst.** Mitygacja: `--json`
  i `structuredContent` bez zmian, flaga `--full` dla starego układu kart,
  wpis w CHANGELOG.
- **Etap 2 jest duży i ma jeden przegląd.** Mitygacja: stała kolejność commitów
  z §2, testy macierzy po każdym commicie, przegląd na całej różnicy gałęzi.
  Poprawka po przeglądzie dostaje test, który bez niej zawodzi, żeby runda
  poprawek nie wprowadzała regresji jak w 0.4.0.
- **Przegląd wychodzi poza zakres etapu.** Mitygacja: rejestr w §13. Znalezisko
  spoza różnicy gałęzi nie blokuje zamknięcia etapu.
- **Backtest działa tylko lokalnie.** Zmiany silnika wymagają uruchomienia na
  maszynie z korpusem przed wydaniem; wynik trafia do opisu PR.

---

## 13. Rejestr znalezisk spoza zakresu etapu

Wypełniany w trakcie realizacji przez krok 6 zamknięcia etapu.

| Data | Etap | Plik | Znalezisko | Decyzja |
|---|---|---|---|---|
