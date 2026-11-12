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

**Decyzje właściciela** z §10 zostały przyjęte 2026-11-11 zgodnie
z rekomendacjami. Po etapie 1, tego samego dnia, plan dostał pięć dodatków:
przerwę w trakcie planu (B11), tętno jako drugą miarę celu (C8), mile (C9),
skróty klubowe jako opcję (C10) i pakiet terenowy (G). **Realizacja** ma cztery
etapy (§2), pakiet G startuje po nich. Praca jest opisana w pakietach A–G
(§3–§9). Po każdym etapie są testy i `/code-review` w zakresie etapu (§0).

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
   kończy się na pierwszej rundzie bez błędu, który użytkownik może spotkać.
   Błąd to zły wynik, awaria albo utrata danych w komendzie, w MCP albo przy
   pliku, który użytkownik edytuje. Sugestie porządkowe (nazwy, powtórzony
   kod, komentarze, styl) trafiają do rejestru w §14. Mogą wejść razem
   z poprawkami błędów, ale same nie otwierają kolejnej rundy. Warunek
   obowiązuje od etapu 2. Etap 1 miał warunek „zero potwierdzonych znalezisk"
   i nie zbiegł po 24 rundach.
6. Znalezisko spoza zakresu etapu trafia do rejestru w §14 i nie jest naprawiane
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
| **2. Silnik biegowy** | 0.7.0 | B1–B8, B10, B11; pola segmentu i poprawki zapisu z C1; linty kształtu podpięte do `check` | macierz bez pięciu lintów kształtu; DoD pakietu B na P1–P3; `regenerate.test.ts`, `cycle.test.ts`, `engine-060.test.ts`, `time-budgets.test.ts`; przerwa w trakcie planu w `adapt.test.ts` i `adapt-desk.test.ts`; backtest lokalnie; `pnpm simulate:coaching`, `pnpm simulate:multisport` |
| **3. Widoki i wykonanie** | 0.8.0 | C1–C10, D1–D5, F3 | migawki przy 60, 80, 100, 120 kolumnach w PL, EN i ASCII, także w milach; budżety wierszy z C2; pułap tętna według Z-2; MCP bez ANSI; syntetyczne FIT i TCX; `pnpm plugin:build` i `scripts/verify-plugin.mjs` |
| **4. Jeden model danych** | 0.9.0 | pakiet E | ten sam kształt sezonu w v1 i v2 na macierzy; lista parytetu; migracja; `pnpm simulate:multisport --artifacts`; weryfikacja pluginu |

**Stan (2026-11-11):** etap 1 zrealizowany na gałęzi `plan-0.7/etap-1`,
scalenie zatwierdzone przez właściciela. Bramka: `pnpm check` 1204 testy,
`pnpm build`, `verify:distribution` PASS, testy korpusu. Przegląd
`/code-review high`: 24 rundy, każde przyjęte znalezisko z testem sprawdzonym
mutacją. Rundy nie zbiegły do zera. Późne rundy dawały pojedyncze przypadki
brzegowe (głównie odczyt ręcznie edytowanego `log.jsonl`) i sugestie
porządkowe. Odrzucone sugestie są w §14. Po etapie 1 zmienił się warunek końca
przeglądu (§0, krok 5) i doszły punkty B11, C8–C10 oraz pakiet G.

**Stan etapu 2 (2026-11-11):** punkty B1–B8, B10 i B11 zrealizowane na gałęzi
`plan-0.7/etap-2` w kolejności z planu, razem z polami segmentu i poprawkami
zapisu z C1. Bramka po B10: `pnpm check` 1287 testów. Macierz B0:
`longNotLongest`, `deloadNotLighter`, `sessionShareHigh` i
`postRaceAccentHeavy` nie odpalają się na żadnym profilu.
`staleProgression` zostaje na 8 profilach (maraton, 24 tygodnie, baza 45 albo
70 km, budżet 240 min), a każdy z nich ma ostrzeżenie budżetu i werdykt
wykonalności. `longBelowGoal` na 212 profilach to werdykt wykonalności z B8,
zgodnie z B0. Odstępstwa od tekstu punktów opisuje „Realizacja w etapie 2”
pod DoD pakietu B.

**Etap 1** nie zmienia żadnej liczby w silniku ani zapisanych planów. Pierwszy
commit tworzy migawkę macierzy na silniku z 0.6.0. Linty kształtu działają
w tym etapie tylko w teście macierzy. Do `check` trafiają w etapie 2, żeby
`check --strict` w CI użytkowników nie zaczął zawodzić w wydaniu poprawkowym.
Wynik etapu to lista odpaleń lintów na macierzy i tabela pomiarów
w FOUNDATIONS. Jeśli pomiar przeczy propozycji z pakietu B, punkt jest
korygowany w tym dokumencie przed startem etapu 2.

**Etap 2**, kolejność commitów: B1 z B2, B3, B4, B5, B6, B8, B11, B7, B10.
B11 idzie po B8, bo korzysta z tego samego protokołu powrotu. B7 jest na końcu,
bo budżet przycina gotowy kształt. Etap ma jedną zmianę wersji
silnika i jedną zmianę przyszłych dni przy regeneracji, dlatego obejmuje też
nowe pola segmentu i poprawki zapisu opisów (decyzja 4).

**Etap 3**, kolejność commitów: C1, C2, C3 z C4, C5 z C6, C8, C9, D1, D2 z D3,
D4 z D5, C10, C7 z F3. C8 rozszerza notację z C1 i karty z C5. C9 idzie przed
pakietem D, żeby tabela `review` od razu znała mile. C10 jest ostatni przed
dokumentacją. Jeśli etap urośnie, C10 przechodzi do następnego planu jako
pierwszy.

**Etap 4**: kroki 1–4 pakietu E w podanej kolejności.

**Poza etapami**, działania właściciela: wydanie po każdym etapie; F1 po
etapie 2, z wynikiem przed startem etapu 4; F2 przez cały sezon. Pakiet G (§9)
startuje po etapie 4, od pomiaru.

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

B0, B9 i pomiary z punktów „Nauka" należą do etapu 1. B1–B8, B10 i B11 to etap 2,
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
  - `postRaceAccentHeavy`: akcent w bloku przejściowym większy niż mediana
    akcentów ostatniego bloku budowania (R-8);
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
  „akcent→długie" 53 razy; dzień po długim to wolne 82 razy i akcent 72 razy
  (na 160).
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
ADR-y z §11 tego planu, „znane uproszczenia silnika"; oba README (pole
`athlete.returning`, zapis przerwy w `log`); CHANGELOG „Changed" z opisem, co zmieni pierwsza
regeneracja; `backtest` uruchomiony lokalnie, wynik w opisie PR.

### B11. Przerwa w trakcie planu

Punkt dopisany po etapie 1 (decyzja 9 z §10).

- **Objaw:** choroba albo wyjazd w środku planu nie mają ścieżki. `adapt`
  rozpoznaje przerwę od 10 dni (`adapt.ts:74`) i podaje objętość restartu
  ×0,55 (R-5), ale tej propozycji nie da się przyjąć (`proposals.ts:126`,
  `manualRecovery`). Przerwy nie da się zapisać z przyczyną ani z góry. Plan po
  powrocie pokazuje tygodnie sprzed przerwy.
- **Nauka:** R-5 (po chorobie objętość ×0,5–0,6 i zero Z3 przez 5–7 dni),
  R-11 z B8 (przerwa bez choroby), R-6 i R-7 (objawy do lekarza, bez porad
  medycznych). R-5 to ekstrapolacja, R-11 wartość inżynierska. Propozycja
  zachowuje dzisiejsze ostrzeżenie `restartExtrapolated`.
- **Zmiana:**
  1. zapis przerwy w dzienniku: `log` przyjmuje zakres dni (`--date` z `--to`)
     i przyczynę (`--reason illness|injury|travel|other`). Każdy dzień dostaje
     wpis `skipped` z przyczyną. Zapis z góry, np. przed wyjazdem, działa tak
     samo. Te same pola przyjmują kreator dziennika i `trainctl_log` w MCP;
  2. `adapt` po zapisanej albo wykrytej przerwie proponuje blok powrotu do
     przyjęcia. Choroba: R-5. Inna przyczyna: R-11. Wzrost w granicach P-3 do
     objętości sprzed przerwy, potem plan wraca do swojego kształtu;
  3. przyczyna `injury` nie dostaje propozycji objętości. `adapt` podaje R-6
     i R-7: powrót ustala specjalista;
  4. po przyjęciu regeneracja przebudowuje dni od powrotu. Dni przeszłe,
     zalogowane, przypięte i edytowane ręcznie zostają (ADR-033). Silnik
     niczego nie zmienia bez zgody (ADR-011, ADR-029);
  5. gdy blok powrotu spycha szczyt poniżej progu dystansu, `plan` pokazuje
     werdykt wykonalności z B8 liczony od dnia powrotu.
- **Test:** `adapt.test.ts`: przerwa z chorobą i bez, `injury` bez objętości;
  `adapt-desk.test.ts`: przyjęcie propozycji, dni przeszłe bez zmian, pierwszy
  tydzień bez Z3 po chorobie; `log` z zakresem i przyczyną, także w MCP;
  macierz B0 bez nowych odpaleń lintów po bloku powrotu.

**DoD pakietu B (etap 2):** macierz B0 bez `longNotLongest`, `deloadNotLighter`,
`sessionShareHigh`, `postRaceAccentHeavy`, `staleProgression`; P1 osiąga
długie >21 km; P3 zachowuje kształt; P2b dostaje werdykt wykonalności
z wyjściami; przerwa zapisana w środku planu daje propozycję `adapt`, którą
można przyjąć, a bez zgody plan się nie zmienia; każda nowa i stara stała ma
ID albo etykietę.

**Realizacja w etapie 2: odstępstwa od tekstu punktów.** Każde ma uzasadnienie
w commicie punktu.

- **B1.** Sufit biegu spokojnego to 0,9 długiego (S-10) i 35% tygodnia
  z długim (E-3). Resztę najpierw bierze długie do P90 udziału z §10.15,
  interpolowanego między pasmami, a dopiero potem wolny dzień dostaje bieg
  (S-11). Punkt 3 działa wcześniej, na poziomie makrocyklu: szczyt nie
  przekracza pojemności dni (`weekCapacityKm`) i `plan` mówi o tym limicie.
  Tydzień, którego nie da się rozpisać, zapisuje `layoutKm` i uwagę dla `why`.
  Przy dwóch biegach w tygodniu sufitu 35% nie ma, bo żaden układ go nie
  spełnia, a długie ma sufit z pasma dwóch biegów (P90 0,80, §10.15) i zostawia
  drugiemu biegowi co najmniej 3 km. Taper trzyma liczbę biegów (T-2).
- **B2.** Akcent traci najpierw powtórzenie (4 → 3), potem rozgrzewkę
  (3 → 2 km), a na końcu staje się biegiem z przebieżkami. Przy jednym akcencie
  w tygodniu sprawdzian go zastępuje (T-12, W-13). Reszta krótsza niż 3 km idzie
  do długiego.
- **B3.** Biegacz już na szczycie nie zaczyna od 0,7 szczytu, tylko dostaje
  falę wokół plateau. Pomiar P-12 ma n = 3, a cięcie objętości bez przyczyny
  w profilu byłoby nową regułą bez źródła. Zatwierdzona baza (`adapt --apply`)
  zastępuje poziom bloku w tygodniu decyzji, a kolejne tygodnie skalują się
  w proporcji planu, więc wzrost bloków zostaje. Podniesiona baza nie wychodzi
  ponad szczyt planu. Pierwsza wersja z etapu 2 ustawiała na bazie każdy blok;
  przegląd (runda 2) pokazał, że podniesienie bazy obniżało wtedy szczyt.
- **B5.** Punkt 4 jest zrealizowany jako najmniejsza rama akcentu po starcie,
  bez porównania z blokiem budowania. Tydzień ponad zamiar zwalnia najpierw
  podbiegi, potem drugi akcent (J-5, I-8).
- **B7.** Sufit szczytu liczy siłę z próbnego tygodnia budowania i szczytu.
  Ostrzeżenie E-2 pojawia się także wtedy, gdy budżet obniża plan, a szczyt
  zostaje powyżej rekomendacji.
- **B8.** Werdykt liczy `computePlan`: szczyt bez budżetu albo szczyt po bloku
  powrotu. Niedobór długiego wchodzi do werdyktu tylko wtedy, gdy szczytu nie
  ogranicza budżet; wtedy odpowiada za to ostrzeżenie budżetu.
- **B10.** `longBelowGoal` nie trafia do `check`, bo to werdykt planu, nie
  lint tygodnia. `sessionShareHigh` dotyczy tygodni z długim i co najmniej
  trzema biegami. `staleProgression` porównuje bloki tydzień do tygodnia od
  końca, pomija tygodnie ze sprawdzianem albo startem i wymaga co najmniej
  dwóch porównanych par.
- **B11.** Decyzja o bloku powrotu jest zapisana w planie (`returnState`)
  i regeneracja w tym samym cyklu liczy ją tą samą funkcją co propozycja.
  Blok powrotu zastępuje zatwierdzoną bazę, a zatwierdzona baza blok powrotu.

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
     To zmienia tekst przyszłych dni przy regeneracji (patrz §13).
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
cytują stare wyjście. ADR dla komendy `season` i notacji. Pola profilu z C8–C10
(`athlete.hrMax`, `units`, `notation`) w obu README.

### C8. Tętno jako druga miara celu

Punkty C8–C10 dopisane po etapie 1 (decyzje 2, 7 i 10 z §10).

- **Dziś:** cele biegowe są w tempie. Profil nie ma tętna maksymalnego. Część
  biegaczy trenuje po tętnie, a tempo zawodzi w terenie i w upale.
- **Nauka:** Z-3 (tempo dokładniejsze od tętna, zostaje celem głównym), Z-2
  (LT1 przy 78,9% HRmax u mężczyzn i 83,6% u kobiet), N-13 (bez wspólnego
  %HRmax dla obu płci), Z-5 (ostrzeżenie przy HRmax szacowanym), Z-6 (bez
  progów z zegarka).
- **Zmiana:**
  1. profil: opcjonalne `athlete.hrMax: { bpm, measured }` z walidacją
     w `config.ts`. Kreator `init` pyta o nie. `init --from-intervals` może
     zaproponować najwyższe tętno z historii jako wartość szacowaną;
  2. biegi spokojne i długie dostają pułap tętna z Z-2 według `athlete.sex`.
     Tempo zostaje celem głównym, pułap jest dopisany do wiersza i karty. Bez
     płci w profilu pułapu nie ma (N-13), a `why` mówi dlaczego;
  3. przy `measured: false` widok z pułapem pokazuje raz ostrzeżenie Z-5;
  4. akcenty zostają przy tempie. `review` i `adapt` nie oceniają tętna (D3);
  5. eksport do intervals.icu: sprawdzić w składni treningu, czy krok przyjmuje
     drugi cel. Jeśli nie, pułap trafia do opisu kroku.
- **Test:** pułap dla obu płci z Z-2; brak pułapu bez płci; ostrzeżenie Z-5;
  akcent bez pułapu; `review` bez oceny tętna; eksport.

### C9. Mile i tempo na milę

- **Dziś:** wyjście zna tylko kilometry i tempo na kilometr, także po
  angielsku.
- **Zmiana:**
  1. `units: metric | imperial` w `trainctl.yaml` i flaga globalna `--units`.
     Domyślnie `metric`. Jednostka nie zależy od języka;
  2. przeliczenie tylko w warstwie widoku: `kmLabel`, tempo, notacja z C1,
     wiersz z C2, `PLAN.md` oraz eksporty `print` i `mobile`;
  3. `plan.yaml`, `log.jsonl`, `--json`, `structuredContent` i synchronizacja
     zostają w kilometrach;
  4. dystans wpisywany w `log` i w kreatorze jest w jednostce z profilu,
     a zapis w kilometrach.
- **Test:** migawki `week`, `today` i `season` w milach po polsku i po
  angielsku; `log` w milach zapisuje kilometry; `--json` bez zmian; brak „km"
  w wyjściu tekstowym przy `imperial`.

### C10. Skróty klubowe jako opcja notacji

- **Dziś:** notacja z C1 używa skrótów neutralnych (`RG`, `SCH`, `p.`),
  zgodnie z decyzją 2.
- **Zmiana:**
  1. `notation: neutral | club` w `trainctl.yaml`, domyślnie `neutral`;
  2. `club` drukuje kody znane z polskich planów klubowych (np. OWB1, BC1–BC3,
     BNP, WT, RT) przypisane do typów jednostek i stref silnika. Szkoły różnią
     się definicjami, więc przypisanie ma etykietę „inż.", wpis w FOUNDATIONS
     i legendę pod widokiem;
  3. kody tylko w wyjściu polskim. Po angielsku `club` daje notację neutralną;
  4. dane się nie zmieniają: `plan.yaml`, `--json` i eksport do intervals.icu
     zostają przy strukturze.
- **Test:** notacja `club` dla każdego typu segmentu; legenda; `neutral` bez
  zmian; angielskie wyjście bez kodów klubowych.

**DoD pakietu C:** jeden model wiersza obsługuje plan v1 i v2; budżety wierszy
z C2 spełnione; MCP dostaje krótszy tekst i te same dane; `PLAN.md` i eksporty
w tym samym układzie; mile i skróty klubowe zmieniają tylko tekst, a `--json`
zostaje bez zmian; pułap tętna tylko przy biegach spokojnych i długich.

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
- **Kroki** (decyzja 5 z §10: v2 jedynym modelem po osiągnięciu parytetu):
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
- **F4. Dostęp poza terminalem.** Rozstrzygnięty decyzją 6 z §10. README
  opisuje ścieżkę telefonu w etapie 3. Tętno przeszło do C8 (decyzja 7).

---

## 9. Pakiet G: teren i ultra (po etapie 4)

Pakiet dopisany po etapie 1 (decyzja 11 z §10). Nie jest piątym etapem tego
planu.

- **Dziś:** pole `terrain` wyniku zmienia tylko kalibrację: wynik z terenu nie
  ustala stref dla celu szosowego. Treść planu do startu terenowego i do ultra
  zostaje szosowa: jednostki w tempie i kilometrach, długie z sufitem N-19,
  blok po ultra bez źródła (R-3).
- **Dlaczego po etapie 4:** jednostki terenowe trzeba rozpisywać czasem
  i wysiłkiem, a nie tempem i dystansem. Kroki v2 to potrafią, a po etapie 4
  v2 jest jedynym modelem.
- **Najpierw pomiar:** własne starty terenowe z F2 i starty górskie z korpusu,
  jeśli są: czas długiego, przewyższenie, udział marszu, taper przed ultra. Bez
  pomiaru pakiet nie zmienia silnika (§0, „Najpierw nauka, potem kod").
- **Zakres wstępny:**
  1. cel z przewyższeniem i terenem;
  2. długie i akcenty rozpisane czasem i wysiłkiem, z podbiegami i zbiegami;
  3. taper i blok po starcie dla ultra;
  4. predykcja wyniku w terenie wyłączona do czasu pomiaru.
- **Realizacja:** po pomiarze pakiet dostaje własną gałąź i tę samą procedurę
  zamknięcia (§0) albo przechodzi do następnego planu.

---

## 10. Decyzje właściciela (przyjęte 2026-11-11)

Decyzje 9–12 i zmiany decyzji 2 i 7 przyjęto po etapie 1, tego samego dnia.

| # | Decyzja | Skutek w planie |
|---|---|---|
| 1 | Wzorzec korpusu obowiązuje w zakresie objętości, który korpus pokrywa. Poniżej tego zakresu silnik używa wartości „inż." z jawną etykietą | B1, B2, ADR-049 |
| 2 | Notacja domyślnie używa skrótów neutralnych (`RG`, `SCH`, `p.`). Skróty klubowe (OWB1, BC2, BNP, WT) są opcją profilu z przypisaniem „inż." i legendą | C1, C10, ADR-057 |
| 3 | Widok sezonu to nowa komenda `season`, tylko do odczytu | C2, ADR-052 |
| 4 | Opisy słowne dostają poprawki zapisu („2-minutowe", `×`) razem ze zmianą silnika | etap 2 |
| 5 | Schemat v2 zostaje jedynym modelem po osiągnięciu parytetu z planem biegowym | etap 4, po etapach 2 i 3 |
| 6 | Bez hostingu i zdalnego MCP. Telefon obsługują kalendarz intervals.icu, zegarek i `export --what mobile` | §12, README w etapie 3 |
| 7 | Tempo zostaje celem głównym (Z-3). Tętno to pułap biegów spokojnych i długich z pola profilu, z ostrzeżeniem Z-5 przy wartości szacowanej | C8, ADR-056 |
| 8 | Przy ciasnym budżecie ostrzeżenie pyta o wybór między bieganiem a siłą. Silnik nie tnie siły sam | B7 |
| 9 | Przerwa w trakcie planu: zapis w dzienniku i blok powrotu jako propozycja `adapt` do przyjęcia | B11, ADR-055 |
| 10 | Mile i tempo na milę jako opcja widoku. Dane zostają w kilometrach | C9, ADR-057 |
| 11 | Teren i ultra jako pakiet po etapie 4, od pomiaru | §9 |
| 12 | Przegląd etapu kończy się na pierwszej rundzie bez błędu, który użytkownik może spotkać. Sugestie porządkowe trafiają do rejestru | §0, krok 5 |

---

## 11. Kandydaci ADR (047 wpisany w etapie 1; 048, 049, 050, 054 i 055 w etapie 2; następny wolny numer: 058)

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
| 055 | Przerwa w trakcie planu to zapis w dzienniku i propozycja `adapt` do przyjęcia (R-5, R-11) | dziś `adapt` widzi przerwę, ale propozycji nie da się przyjąć, a plan po chorobie pokazuje tygodnie sprzed przerwy |
| 056 | Tętno jest pułapem pomocniczym biegów spokojnych i długich, tempo zostaje celem głównym | Z-3: tempo dokładniejsze; Z-2 i N-13: kotwice według płci; Z-5: błąd przy szacowanym HRmax |
| 057 | Mile i skróty klubowe to opcje widoku; dane zostają w kilometrach i w strukturze | MCP, synchronizacja i eksporty czytają jeden model; przeliczenie w widoku nie dotyka planu |

---

## 12. Poza zakresem

- Zdalny serwer MCP, REST API i hosting (PLAN-v0.4 §8, bez zmian).
- Pozycje odrzucone na stałe w PLAN-v0.4 §8: autopilot HRV, gamifikacja, pogoda
  z sieci, metryki ryzyka urazu, zamiana odczuć na liczby.
- Kalibracja stref z okrążeń (D zostaje przy opisie).
- Nowa metodyka roweru i pływania. Pakiet E ujednolica model, a biblioteka
  jednostek v2 czeka na przegląd trenerski (F1).
- Double threshold (J-7, N-16).
- Cele tętna dla akcentów i ocena wykonania po tętnie (C8, Z-3, Z-6).
- Teren i ultra w etapach 1–4 (pakiet G po etapie 4).

---

## 13. Ryzyka

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
- **Przegląd wychodzi poza zakres etapu.** Mitygacja: rejestr w §14. Znalezisko
  spoza różnicy gałęzi nie blokuje zamknięcia etapu.
- **Opcje mnożą warianty planu, których nikt nie ocenił** (tętno, mile, skróty
  klubowe). Mitygacja: opcje zmieniają widok albo dopisują pułap, a kształt
  sezonu zostaje ten sam. Macierz B0 biegnie bez opcji, a migawki widoków
  obejmują każdą opcję osobno.
- **Przerwa w trakcie planu przebudowuje przyszłe dni.** Mitygacja: istniejąca
  ścieżka propozycji z przyjęciem, ochrona dni z ADR-033, testy weryfikowane
  mutacją.
- **Backtest działa tylko lokalnie.** Zmiany silnika wymagają uruchomienia na
  maszynie z korpusem przed wydaniem; wynik trafia do opisu PR.

---

## 14. Rejestr znalezisk spoza zakresu etapu

Wypełniany w trakcie realizacji przez krok 6 zamknięcia etapu.

| Data | Etap | Plik | Znalezisko | Decyzja |
|---|---|---|---|---|
| 2026-11-11 | 1 | `packages/cli/src/sports-calendar.test.ts` | test „updates only changed events … repeats byte-identically" raz zawiódł przy pełnym przebiegu pod obciążeniem, przechodzi osobno i w powtórce | do zbadania osobno (zależność od zegara?), poza zakresem etapu |
| 2026-11-11 | 1 | `packages/cli/src/sports-store.ts:120` | migracja do v2 czyta log.jsonl bez normalizacji z `logfile.ts` | etap 4 (jeden model danych): wspólny odczyt dziennika |
| 2026-11-11 | 1 | `packages/cli/src/status.ts:85` | `status` po starcie pisze „Do startu: 5 dni temu", `review` już „Od startu" | etap 3 (spójne widoki) |
| 2026-11-11 | 1 | `packages/cli/src/commands.ts:684` | `log --km 8,5` odrzucone, a odczyt dziennika i kreator przyjmują przecinek; trzy parsery km | naprawione w etapie 1 (11. runda): `parseDecimal` i `LOG_LIMITS` wspólne dla `log`, kreatora i odczytu log.jsonl |
| 2026-11-11 | 1 | `packages/cli/src/interactive.ts:157` | domyślna wartość km w kreatorze dziennika to surowe `21.0975` | naprawione w etapie 1 (12. runda): `plannedKmDefault` w formacie języka |
| 2026-11-11 | 1 | `packages/core/src/engine/microcycle.ts` | pętla I-5 i `weekTotals` liczą Z1 osobno, obok `hardKmOf` | etap 2: B5 liczy I-5 po rozdaniu reszty, a `hardKmOf` jest wspólne dla generatora i lintów; dwie definicje Z1 zostają (`z1Share` na mapie dni w generatorze, `weekTotals` na dniach planu) jako sugestia porządkowa (zgłoszone ponownie w rundzie 20) |
| 2026-11-11 | 1 | `packages/cli/src/commands.ts` (`raceCountdown`) | sugestia połączenia z `raceDistanceLine` (rundy 13–21) | odrzucone: dwie formy tej samej informacji (etykieta z wartością, zdanie); wspólne jest tylko porównanie znaku |
| 2026-11-11 | 1 | `packages/core/src/engine/season.ts` | definicja bieżącego cyklu w lintach różna od `cycleWeeksOf` w CLI | odrzucone: CLI bez `cycleStart` pokazuje cały plan, linty potrzebują jednego cyklu |
| 2026-11-11 | 1 | `packages/cli/src/plan-shape.test.ts` | pełna macierz 576 profili w bramce | odrzucone: ~1,6 s; do ponownej oceny, gdy silnik zwolni |
| 2026-11-11 | 1 | `season.ts`, `planfile.ts`, `calibration.ts` | trzy zaokrąglenia do 0,1 | odrzucone: różne paczki i znaczenia (km lintów, km planu, VDOT) |
| 2026-11-11 | 1 | `packages/cli/src/bin.test.ts` | testy uruchamiające binarkę przekraczają 30 s przy obciążonej maszynie | do rozważenia: osobny limit czasu dla tych testów |
| 2026-11-11 | 2 | `packages/core/src/engine/microcycle.ts` (`setBreak`) | 4' marszu w połowie serii @I jest tylko w opisie: nie liczy go szacunek minut (budżet dnia), FIT ani składnia intervals.icu, a opis po skróceniu (E-1) go gubi. Stan z 0.6.0; etap 2 dodał tylko pole. Tak samo przebieżki (pole `strides` od rundy 17): eksport na zegarek i szacunek minut ich nie widzą (zgłoszone w rundach 17, 19, 20, 23 i 32; FIT i składnia intervals.icu nie niosą opisu kroku, więc przebieżek nie ma na zegarku; szacunek minut bez 4' marszu zaniża sesję @I o ~4 minuty przy budżecie dnia) | etap 3 (C1 i eksporty czytają pola segmentu) |
| 2026-11-11 | 2 | `packages/core/src/engine/macrocycle.ts` | flaga tygodnia ze startem kontrolnym zapisana po polsku (`start kontrolny B: …`) niezależnie od języka; flag nie pokazuje żaden widok, trafiają do `plan.yaml` i danych MCP. Stan z 0.6.0 | etap 3 (jeden model wiersza) albo etap 4 |
| 2026-11-11 | 2 | `packages/core/src/engine/microcycle.ts` (pętla I-5) | dawka zaokrąglana do 0,5 km schodzi w pętli o 1 km, więc 3,5 km mogłoby spaść do 2,5 km | niepotwierdzone: sonda 428 tys. tygodni nie dała części głównej poniżej 3 km; strażnik `max(3, …)` do rozważenia przy okazji |
| 2026-11-11 | 2 | `packages/cli/src/planfile.ts` (`computePlan`) | ostrzeżenie makrocyklu o szczycie usuwane porównaniem tekstu; lepszy byłby kod ostrzeżenia z `planMacrocycle` | sugestia porządkowa |
| 2026-11-11 | 2 | `planfile.ts` (`weeklyBudgetPeakKm`), `microcycle.ts` (`weekCapacityKm`), `macrocycle.ts` | dwa skany pojemności tym samym próbnym tygodniem; reguła I-8 (`daysAvailable.length >= 4 ? 2 : 1`) w trzech miejscach | reguła I-8 w jednej funkcji `qualitySessionsFor` (runda 19, z cytatem reguły); skan z predykatem zostaje sugestią porządkową (zgłoszone ponownie w rundach 17–20 i 22) |
| 2026-11-11 | 2 | `packages/core/src/engine/microcycle.ts` (`weekCapacityKm`) | skan co 1 km buduje dwa mikrocykle na krok, kilka razy na `plan` | wydajność: pamięć podręczna albo krok zgrubny z dokładnym dobiciem, gdy czas `plan` urośnie (zgłoszone ponownie w rundach 17, 19, 20 i 22; `earliestFeasibleRaceDate` mógłby sprawdzać tylko `recommended`, a `computePlan` z budżetem liczyć sufit raz) |
| 2026-11-11 | 2 | `macrocycle.ts` (`applyReturnBlock`), `planfile.ts` (`scaleToBaseline`) | tor długiego (B4) jest podłogą, więc w bloku powrotu i po redukcji bazy długie stało na suficie udziału tygodnia; przy dwóch dniach biegowych sufit to cały tydzień | w rundzie 3 odłożone do F1, w rundzie 4 naprawione: tor maleje w proporcji tygodnia |
| 2026-11-11 | 2 | `macrocycle.ts` (`applyReturnBlock`) | flaga sprawdzianu usuwana porównaniem tekstu (`timeTrialForCalibration`), jak ostrzeżenie o szczycie w `computePlan` | sugestia porządkowa: kody flag zamiast tekstu |
| 2026-11-11 | 2 | `planfile.ts` (`fitTimeBudget`) | przycięcie tygodnia budżetem zostawia tor długiego (B4) jako podłogę, a blok powrotu i redukcja bazy skalują tor; przy co najmniej trzech biegach długie stoi wtedy na P90 udziału, w zakresie korpusu | sugestia porządkowa: jedno miejsce skalowania toru; przypadek dwóch biegów (cały tydzień jako długie) naprawiony sufitem 0,80 w rundzie 5 |
| 2026-11-11 | 2 | `microcycle.ts` (`weekCapacityKm`), `planfile.ts` (`weeklyBudgetPeakKm`) | próbny tydzień skanów nie ma toru długiego (B4), więc sufit z budżetu liczy się na innym tygodniu niż generowany | niepotwierdzone jako błąd: 768 planów z budżetem (z siłą i bez) bez `taperNotMonotonic` i `deloadNotLighter`; do połączenia ze sugestią o jednym skanie. Skutek przy dwóch dniach (tor długiego wypychał jedyny akcent, runda 19) naprawiony w generatorze: tor ustępuje akcentowi |
| 2026-11-11 | 2 | `commands.ts` (`analyzeAdapt`) | podniesienie bazy liczone od poziomu bloku (zamiar), a przy budżecie dnia albo limicie dni (`layoutKm`) biegacz dostaje mniej; propozycja „≈X km/tydz.” pokazuje zamiar (zgłoszone w rundach 6, 8 i 10) | naprawione w rundzie 13: przy tygodniu przyciętym budżetem albo dniami `adapt` nie proponuje podniesienia bazy (nadwyżka mówi o czasie); do etapu 3 zostaje pokazanie, co mieszczą budżet i dni |
| 2026-11-11 | 2 | `microcycle.ts` (`shares`) | sufit 35% i przebiegi `overShare` zależą od dni, które mogą mieć bieg, a lint od biegów rozpisanych | niepotwierdzone: w macierzy B0 żaden tydzień z dwoma biegami nie wychodzi krótszy; krótsze są tygodnie sprawdzianu przy trzech dniach (T-10, lżejsze z założenia) |
| 2026-11-11 | 2 | `commands.ts` (`returnInProgress`) | blokada podniesienia bazy działa tylko przy przyjętym powrocie (`returnState`), nie przy powrocie z profilu | w rundzie 13 uznane za nie błąd; w rundzie 22 naprawione: zatwierdzona baza skaluje także tygodnie krzywej z profilu, więc podniesienie przesuwało powrót. Blokada działa teraz przy każdym tygodniu bloku powrotu (R-5, R-11), także z profilu |
| 2026-11-11 | 2 | `microcycle.ts` (`buildLadder`) | drabinka J-4 jako bloki 2×1000, 2×400, 2×200, a nie powtarzana seria 1000/400/200 | korpus nie rozstrzyga; opis w E-3 i w kodzie doprecyzowany (runda 12), pytanie do F1 |
| 2026-11-11 | 2 | `microcycle.ts` (przebiegi `overShare`) | po zmniejszeniu udziału nie wraca kontrola I-5 i sufitu mocnych km | niepotwierdzone w rundach 1 i 12: sondy 400 tys. i 80 tys. tygodni oraz macierz B0 bez naruszenia; zgłoszone ponownie w rundzie 31, a fuzz rundy 19 (295 tys. tygodni) też bez naruszenia I-5 |
| 2026-11-11 | 2 | `proposals.ts` (powrót i baza) | jedna decyzja o objętości naraz: przyjęty powrót zastępuje zatwierdzoną niższą bazę, więc po dogonieniu plan wraca do objętości z profilu | decyzja projektowa z B11; propozycja mówi o tym wprost (runda 11); połączenie obu decyzji (skalowanie, potem krzywa) do etapu 4 |
| 2026-11-11 | 2 | `macrocycle.ts` (`volumeBase`, `profileReturnBlock`) | `athlete.returning` ma dwa mechanizmy: na starcie planu pasmo 50–60% z oknem 6 tygodni, w trakcie planu blok powrotu (55%) do końca cyklu | w obrębie cyklu oba są stałe (regeneracja liczy od startu planu); do ujednolicenia, gdy powstanie jeden model danych (etap 4). Runda 20: start 60% na początku planu wobec 55% w trakcie; data osiągalności liczy się zgodnie z mechanizmem, który działa. Runda 24: nowy cykl (zmiana celu) w ciągu 6 tygodni od `since` znów zaczyna od spokojnego bloku, bo blok liczy się od startu planu, a nie od `since` — zachowawczo, nie szkodliwie; do jednego modelu powrotu (etap 4) |
| 2026-11-12 | 2 | `planfile.ts` (`settleMixedWeek`) | tydzień mieszany z `layoutKm` dostaje sumę dni także wtedy, gdy jest ona równa celowi albo wyższa | nie błąd (runda 24): `plannedWeekKm` to objętość, którą biegacz faktycznie ma w tygodniu (dni zachowane i nowe); bez tego lint `targetKmMismatch` zgłaszałby tydzień, którego nie da się zmienić. Nazwa `layoutKm` sugeruje tylko tydzień krótszy — do rozważenia przy jednym modelu tygodnia (etap 4) |
| 2026-11-11 | 2 | `planfile.ts`, `macrocycle.ts`, `commands.ts`, `proposals.ts` | warunek fazy ładowania (`base`, `build`, `peak`) powtórzony w kilku miejscach; w `prepareProposal` gałąź `conservative-restart` bez `returnBlock` już nie występuje | sugestia porządkowa: jedna funkcja `isLoadingPhase` w core (season.ts ma już `LOADING_PHASES`), usunąć martwą gałąź (zgłoszone ponownie w rundach 20 i 22) |
| 2026-11-11 | 2 | `macrocycle.ts` (`loadingWeeksIn`, `volumeSchedule`) | wzorzec odciążeń zapisany dwa razy: wzorem i pętlą | sugestia porządkowa: `volumeSchedule` może brać wzorzec z jednej funkcji (zgłoszone ponownie w rundzie 22) |
| 2026-11-11 | 2 | `microcycle.ts` (`twoRunCeil`) | dwa dni biegowe ze startem kontrolnym: drugim biegiem jest start, a sufit długiego i tak zostawia 3 km na bieg spokojny; tydzień wychodzi krótszy z uwagą `volumeShort` | nie błąd: tydzień startu kontrolnego ma być lżejszy (T-9); do uproszczenia, gdy wróci temat dwóch dni |
| 2026-11-11 | 2 | `commands.ts` (`cmdPlan`), `regenerate.ts` | ostrzeżenia zależne od daty (data osiągalności, miniony start kontrolny) w `plan.yaml` i `PLAN.md` odświeżają się dopiero przy zapisie planu; `plan` pokazuje bieżące, ale plan „aktualny” się nie zapisuje | do rozważenia przy widokach (etap 3): ostrzeżenia liczone przy odczycie albo porównanie ostrzeżeń w `upToDate` |
| 2026-11-12 | 2 | `microcycle.ts` (pętla `fits()`, zdejmowanie dni przebieżek) | akcent zwolniony przez sufit mocnych kilometrów albo objętość tygodnia i dzień przebieżek usunięty w bardzo małym tygodniu nie zostawiają uwagi w `why` | zachowanie z 0.6.0 (akcent minimalny był opcjonalny i znikał bez śladu); B1 i B2 obiecały uwagi dla podbiegów, przebieżek i krótszego tygodnia. Kod uwagi o zwolnionym akcencie do etapu 3 (widoki, `why`). Sonda rundy 19: 100 z 500 planów dwudniowych ma tydzień ładowania bez akcentu i bez uwagi (sufit mocnych km przy 12–25 km), plany 3–5 dni bez budżetu — 0 z 300 |
| 2026-11-12 | 2 | `bin.ts`, `date-input.ts` (`log --date`) | nazwa dnia w `--date` patrzy wstecz, więc przerwa zapisywana z góry nazwami dni (`--date fri --to sun` w środę) trafia w miniony tydzień | nie błąd: kierunek `log` jest udokumentowany, a wynik podaje zapisane daty; README podpowiada datę albo `+N` (runda 17, zgłoszone ponownie w rundach 24, 27 i 32). Kierunek nazw dni przy `--to` do rozważenia w etapie 3 |
| 2026-11-12 | 2 | `microcycle.ts`, `planfile.ts` (profile poza macierzą B0) | dwa dni biegowe i budżet tygodnia 90–210 min: świeże plany mają ostrzeżenia lintów (runda 18, sonda 400 planów dwudniowych i 5120 z budżetem): `staleProgression` 14 i 1660, `easyShareLow` 188 i 828, `frequencyMismatch` 64 i 512, `longBelowGoal` 48 i 2018, `taperNotMonotonic` 3 i 6, `targetKmMismatch` 4 i 0. Przy dwóch dniach tydzień sprawdzianu stawia długie z toru (B4) cztery dni przed sprawdzianem i wychodzi ponad cel | poza domeną macierzy B0 (3–6 dni, budżet bez, 240, 360); na tych samych profilach main ma więcej naruszeń w każdej porównywalnej mierze (np. przy budżecie odciążenie nie lżejsze 980 wobec 2, długie nie najdłuższe 478 wobec 0, I-5 843 wobec 256). W rundzie 18 naprawione: lint odciążenia nie porównuje z tygodniem sprawdzianu (216 i 178 → 0), akcent przy dwóch biegach najwyżej pół tygodnia (`longNotLongest` 8 i 260 → 0). W rundzie 19: tor długiego ustępuje akcentowi i sprawdzianowi przy dwóch biegach (`targetKmMismatch` 4 → 0); `staleProgression` przy budżecie zgłoszone ponownie — budżet trzyma tydzień, a `plan` o tym mówi. Rozszerzenie macierzy o dwa dni i małe budżety do F1 albo etapu 4 |
| 2026-11-12 | 2 | `planfile.ts` (`computePlan`, tydzień startu z budżetem) | tydzień startu z `uncappedKm` dostaje `timeCappedKm` = rozpisane kilometry bez startu, więc `week` pokazuje go z budżetem jako 0–3 km, a bez budżetu jako cel z „zaplanowano” | nie błąd (runda 19): oba widoki pokazują, co jest rozpisane obok startu, a lint pomija fazę startu; spójny opis tygodnia startu do etapu 3 (widoki) |
| 2026-11-12 | 2 | `microcycle.ts` (taper, T-2) | `frequencyMismatch` na świeżych planach 3–5 dni bez budżetu: 72 z 300 (main 66 z 300); taper trzyma liczbę biegów, ale bieg krótszy niż kilometr nie powstaje (E-3) | stan z 0.6.0 z drobnym wzrostem od reguły E-3; pozostałe kody `validatePlan` na tych profilach spadły do zera (main: `targetKmMismatch` 94, `easyShareLow` 21). Do przeglądu reguły T-2 przy małej objętości (F1) |
| 2026-11-12 | 2 | `planfile.ts` (`followNotes`, `mergeWeekNotes`), `explain-session.ts` | uwagi generatora są na tygodniu i po dacie, więc każda operacja przestawiająca dni potrzebuje własnej naprawy uwag | sugestia porządkowa (runda 18): uwaga przy dniu albo jednostce, `volumeShort` liczone przy odczycie (już tak od rundy 17) |
| 2026-11-12 | 2 | `planfile.ts` (`shiftWorkout`) | `structuredClone` dni tygodnia przy każdym `shift`, choć gałąź z jawnymi przesunięciami go nie czyta | sugestia porządkowa (rundy 18, 23, 25 i 30) |
| 2026-11-12 | 2 | `commands.ts` (`rescheduleImpl`), `planfile.ts` (`followNotes`) | `reschedule()` zwraca jawne `moved` i `dropped`, a uwagi idą za jednostką przez dopasowanie treści | sugestia porządkowa (runda 30): przekazać przesunięcia z solvera jak w `shift`, uwagi dni usuniętych odrzucić — bez heurystyki treści |
| 2026-11-12 | 2 | `regenerate.ts` (gałęzie `loadState`) | `returnFrom` przekazywane w gałęziach zatwierdzonej bazy, choć `loadState` i `returnState` nigdy nie występują razem (jedna decyzja o objętości naraz) | sugestia porządkowa (rundy 21 i 25): usunąć martwe przekazanie albo połączyć oba stany w jednym modelu (etap 4) |
| 2026-11-12 | 2 | `adapt.ts` (`lastRunEver`, `recentBreak`) | lista biegów liczona dwa razy (w `recentBreak` i dla `lastRunEver`) z tą samą definicją biegu | sugestia porządkowa (rundy 26 i 27): `recentBreak` może zwracać ostatni bieg i długość przerwy jako jedno źródło |
| 2026-11-12 | 2 | `microcycle.ts` (`weekCapacityKm`) | próbny tydzień pojemności ma pełną dawkę akcentu (`accentProgress` 1), a tygodnie bazy blisko szczytu mają mniejszą — krótsze akcenty zostawiają więcej kilometrów na biegi spokojne pod sufitami, więc taki tydzień wychodzi krótszy (sonda rundy 28: maraton, `tue, thu, sun`, 60 km — tygodnie 56/58/60 rozpisane na 51,3/51,8/53,1 z uwagą `volumeShort`) | nie błąd wyniku: tydzień krótszy ma uwagę w `why`, odciążenie (0,7 zamiaru) zostaje lżejsze; szczyt z pełną dawką mieści się w dniach. Próbny tydzień z najmniejszą dawką (min po `accentProgress`) do rozważenia z przeglądem trenerskim (F1), bo obniża szczyt profili z trzema dniami |
| 2026-11-12 | 2 | `planfile.ts` (`fitTimeBudget`) | tydzień generowany od nowa przez budżet tygodnia dziedziczy `layoutKm` sprzed budżetu obok nowego `timeCappedKm` | sugestia porządkowa (runda 28): bez skutku, bo `plannedWeekKm` czyta najpierw `timeCappedKm`; jedno pole „rozpisano” zamiast dwóch (etap 4) |
| 2026-11-12 | 2 | `macrocycle.ts` (`applyReturnBlock`) | sprawdzian zostaje w tygodniu po spokojnym bloku powrotu, gdy krzywa nie obniża tygodnia (plan niżej niż krzywa) | do przeglądu trenerskiego (F1, runda 29): tydzień nieobniżony to zwykły tydzień planu, a spokojny blok już odsunął pomiar od przerwy; czy pomiar ma czekać dłużej po chorobie (W-11, W-12) |
| 2026-11-12 | 2 | `execution.ts`, `adapt.ts` (pierwszy tydzień planu) | dni pierwszego tygodnia sprzed daty startu planu mają sesje, które `adapt` przez trzy tygodnie liczy jako niezapisane (dane niepełne), dopóki biegacz ich nie zaloguje | zauważone w sondzie rundy 27; układ pierwszego tygodnia bez zmian w etapie 2, więc najpewniej stan z 0.6.0 — do potwierdzenia i rozstrzygnięcia w etapie 3 (dni sprzed startu jako odpoczynek albo poza oknem) |
