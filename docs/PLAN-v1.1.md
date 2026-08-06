# Plan implementacji v1.1 — fazy 6–8

Samowystarczalny plan dla sesji Claude Code. Kontekst produktu: [SPEC.md](../SPEC.md)
(wizja, architektura, ADR-y), warstwa naukowa: [docs/science/FOUNDATIONS.md](science/FOUNDATIONS.md).
Stan wyjściowy: fazy 0–5 zakończone, 255 testów, 14 narzędzi MCP, typecheck czysty.

Zakres v1.1 wynika z analizy przewagi konkurencyjnej (2026-08-05): nie dokładamy
feature'ów treningowych, tylko domykamy pętle, które czynią „trenera w agencie"
wiarygodnym: **profil z prawdziwych danych** (F6), **kalibracja wymuszana przez
plan** (F7), **rytuał tygodniowego przeglądu** (F8). Odrzucone po dyskusji:
„Coach as CI" jako rdzeń produktu (dubluje kanał agentowy gorszym medium, kłóci
się z local-first, kadencja tygodniowa generuje szum) — zostaje wyłącznie jako
przykład w docs.

---

## 0. Reguły wykonania (obowiązują w każdej fazie)

**Higiena sesji** — każda faza kończy się, w tej kolejności:
1. `pnpm test` — wszystkie pakiety zielone (licznik testów rośnie, nigdy nie maleje),
2. `pnpm typecheck` — czysto w 5 pakietach,
3. aktualizacja SPEC.md (tabela faz §8 + nowe ADR-y w §10) i README,
4. aktualizacja pamięci (`project_tren.md`),
5. jeden commit na fazę (konwencja repo; identyfikacja gitowa per `feedback_git_identity` nie dotyczy — to repo prywatne na koncie osobistym),
6. czyste zamknięcie sesji.

**Twarde ograniczenia kodu:**
- Node ≥23.6, natywny type-stripping: importy z rozszerzeniem `.ts`, **zakaz
  parameter properties** w klasach, zero kroku budowania. `bin.test.ts` odpala
  prawdziwe binarki i pilnuje regresji — ma przechodzić po każdej fazie.
- `exactOptionalPropertyTypes` + `noUncheckedIndexedAccess`: opcjonalne wejścia
  handlerów typować `x?: T | undefined`.
- Warstwa prezentacji (ADR-013): handlery zwracają **bloki semantyczne**
  (`packages/cli/src/ui/blocks.ts`); ANSI dokłada tylko renderer CLI; istniejący
  test gwarantuje brak `\x1b[` w wyjściu MCP — nowe komendy muszą go respektować.
- Każda stała silnika cytuje ID reguły z FOUNDATIONS §10 albo jest jawnie
  oznaczona komentarzem jako wartość inżynierska.
- Adaptacja **proponuje, nie przepisuje** (ADR-011) — nic w v1.1 tego nie zmienia.
- Sekrety (ADR-009): klucz intervals.icu wyłącznie z env `TRAINCTL_INTERVALS_API_KEY`
  albo `.trainctl-secret`; **nigdy w repo, testach ani fixture'ach**. Testy e2e na
  żywym koncie: tylko lokalnie, po teście posprzątać konto (wzorzec z fazy 4),
  na końcu sprawdzić, że 0 plików w repo zawiera klucz.
- Kasowanie zdalne tylko z prefiksem `trainctl-` (ADR-016) — bez zmian.

**Kolejność faz:** 6 → 7 → 8. Fazy 6 i 7 są niezależne (można odwrócić), ale 8
konsumuje wyniki obu (review raportuje sprawdziany i korzysta z fabryki providera).

---

## Faza 6 — `trainctl init --from-intervals`: profil z historii, nie z deklaracji

**Cel.** Największe źródło błędu planu to dziś samoocena (`recentWeeklyKm`
wpisywane z pamięci). Prawdziwy trener zaczyna od „pokaż mi ostatnie 3 miesiące" —
kreator ma robić to samo: pobrać historię z intervals.icu i **zaproponować**
profil, który użytkownik potwierdza.

**Bez zmian w porcie.** `SyncProvider.listActivities(oldest, newest)` już
istnieje (`packages/core/src/ports/sync.ts:62`), a `SyncedActivity` niesie
`date/type/name/distanceKm/movingTimeSec` — wystarcza. Adapter intervals.icu
bez zmian.

### 6.1 Rdzeń: `packages/core/src/engine/infer-profile.ts`

Czysta funkcja `inferProfile(activities: SyncedActivity[], today: string): InferredProfile`:

```
InferredProfile {
  recentWeeklyKm: number          // mediana 4 ostatnich PEŁNYCH tygodni (bez bieżącego)
  peakWeeklyKm?: number           // max pełnego tygodnia w oknie 16 tyg.
  daysAvailable: Weekday[]        // dni pokrywające ~wszystkie biegi (próg udziału, min 3)
  longRunDay?: Weekday            // dzień z najwyższą medianą dystansu
  weeklyKm: { weekStart: string; km: number }[]   // przebieg do pokazania użytkownikowi
  raceCandidates: { date; distanceKm; timeSec; name?; reason: string }[]
  caveats: string[]               // „przerwa 12 dni na końcu okna", „tylko 6 tygodni danych" itd.
}
```

Decyzje projektowe:
- Okno 16 tygodni, tygodnie ISO od poniedziałku (spójnie z generatorem planu).
- Filtr: wyłącznie `type` biegowy (adapter normalizuje casing — sprawdzić i nie
  duplikować logiki).
- Mediana zamiast średniej (odporność na tydzień urlopu); tygodnie zerowe w
  ostatniej 4-tce → cofnij się do ostatniego aktywnego bloku i dodaj caveat.
- Przerwa ≥10 dni na końcu okna → caveat spójny z regułą restartu w
  `engine/adapt.ts` (×0,55) — inferencja **nie** aplikuje restartu, tylko
  raportuje; decyzja należy do generatora po edycji trainctl.yaml.
- `raceCandidates` to **zawsze propozycje**: heurystyka = dystans w ±3% dystansu
  standardowego (5 / 10 / 21,0975 / 42,195) **i** (nazwa łapie
  `/(bieg|maraton|półmaraton|parkrun|race|run)/i` **lub** tempo w górnym decylu
  okna). W trakcie implementacji sprawdzić na żywym koncie, czy payload
  aktywności intervals.icu niesie znacznik startu (np. kategoria) — jeśli tak,
  użyć go jako sygnału pierwotnego, a heurystyki jako zapasu; wynik weryfikacji
  dopisać do `docs/integrations/intervalsicu.md` (§2b).
- <4 pełnych tygodni danych → wynik „za mało danych" z czytelnym komunikatem;
  kreator wraca do pytań ręcznych.

### 6.2 CLI: kreator i flaga

- `trainctl init --from-intervals`: pobiera 16 tygodni przez `ProviderFactory`
  (wzorzec z `cmdPush`/`cmdPull` — `factory: ProviderFactory = defaultProviderFactory`
  jako parametr, wstrzykiwalny w testach).
- W TTY: kreator (`ui/wizard.ts`) — gdy klucz jest osiągalny (env/`.trainctl-secret`),
  pierwsze pytanie brzmi „Znalazłem klucz intervals.icu — pobrać historię i
  zaproponować profil? [T/n]". Wartości wywnioskowane stają się **domyślnymi
  odpowiedziami** kolejnych pytań (Enter = akceptacja), nie cichym zapisem.
  Pokazać mini-wykres `weeklyKm` (sparkline w stylu theme) i caveats.
- Poza TTY (agent, skrypt): flaga zapisuje wartości wprost, każda z komentarzem
  proweniencji w YAML, np.
  `recentWeeklyKm: 52  # z intervals.icu: mediana pełnych tygodni 2026-07-06…2026-08-02`,
  a caveats i kandydaci na wyniki idą do wyjścia komendy (agent relacjonuje
  użytkownikowi i dopisuje wyniki po potwierdzeniu).
- Brak klucza + flaga → błąd z instrukcją (wzorzec „Developer Settings" z push).

### 6.3 MCP

`trainctl_init` dostaje `fromIntervals: z.boolean().optional()` + aktualizacja
opisu (jawnie: wartości to propozycje z proweniencją; kandydatów na wyniki
agent ma potwierdzić z użytkownikiem przed dopisaniem do `trainctl.yaml`).

### 6.4 Testy

- `infer-profile.test.ts` (fixtures syntetyczne): regularne 16 tygodni →
  mediana/dni/długie wybieganie; przerwa 14 dni na końcu → caveat; dziura
  urlopowa w środku; <4 tygodnie → „za mało danych"; mix Ride/Walk odfiltrowany;
  detekcja kandydata startu (±3% + nazwa) i **brak** detekcji szybkiego treningu
  bez nazwy startowej na dystansie niestandardowym.
- `commands`: `cmdInit` z fałszywą fabryką (jak testy push/pull) — YAML z
  komentarzami proweniencji; bez klucza → kod 1 i instrukcja.
- `bin.test.ts`: smoke `--from-intervals` bez klucza (czytelny błąd, nie stack).
- MCP: scenariusz `trainctl_init` z `fromIntervals` na fałszywym providerze
  (wymaga przewleczenia fabryki do `createTrainctlServer` — analogicznie jak w CLI).
- **E2E na żywym koncie (lokalnie, klucz od użytkownika):** inferencja na
  realnej historii, porównanie z faktycznym stanem wytrenowania; wynik do
  `docs/integrations/intervalsicu.md` §2b. Po teście: 0 plików z kluczem.

### 6.5 DoD fazy 6

`trainctl init --from-intervals` i kreator z propozycjami działają e2e; wartości
w YAML mają proweniencję; kandydaci na wyniki są potwierdzani, nigdy zapisywani
automatycznie; testy jednostkowe + komendowe + MCP + smoke bin zielone;
docs/integrations §2b uzupełnione; ADR-019 wpisany; SPEC/README/pamięć
zaktualizowane; commit.

---

## Faza 7 — sprawdziany wpisane w makrocykl

**Cel.** `trainctl adapt` umie rekalibrować strefy po nowym wyniku, ale nic tego
wyniku nie wymusza — plan ma sam planować biegi kontrolne, domykając pętlę
plan → test → rekalibracja → lepszy plan.

### 7.1 Najpierw nauka, potem kod (kolejność obowiązkowa)

1. **Korpus:** przejrzeć `corpus/raw-text/` pod frazami typu „sprawdzian",
   „start kontrolny", „na czas", „BNP" — jak trener rozmieszczał testy
   (częstotliwość, faza, dystans, co zastępowały). To nasz wyróżnik (n=1, ale
   house style) — wnioski zapisać w FOUNDATIONS.
2. **FOUNDATIONS §10** — nowe reguły (numeracja ciągła w sekcji W):
   - **W-11**: sprawdzian all-out jest pełnoprawnym źródłem VDOT na równi z
     wynikiem zawodów (Daniels — kalibracja z biegu maksymalnego); zasila W-1.
   - **W-12**: częstotliwość co ~4–6 tygodni w bazie/budowaniu — jeśli research
     nie da bezpośredniego wsparcia, jawnie oznaczyć jako wartość inżynierską
     wspartą praktyką korpusu.
   - **W-13**: umiejscowienie — nigdy w taperze (spójne z T-*), nie wcześniej
     niż 10 dni po starcie (spójne z R-1/R-2), sprawdzian **zastępuje** akcent
     tygodnia, nie dokłada obciążenia (I-7 zachowane).
3. Aktualizacja §11 (unverified claims), jeśli research czegoś nie potwierdzi.

### 7.2 Domena i silnik

- `WorkoutKind` (`packages/core/src/domain/types.ts:107`) + wariant `'test'`.
  Kompilator wskaże wszystkie wyczerpujące switche — przejść po kolei, nic nie
  zostawiać na `default`.
- **Dystans sprawdzianu** (stała z W-11/korpusu): cel ≤10 km → TT 3 km;
  HM/maraton → TT 5 km; ultra → TT 5 km (bez predykcji punktowej — W-10 bez zmian).
- **Umiejscowienie** (`engine/macrocycle.ts`): propozycja robocza — końcówka
  tygodnia deloadowego (×0,7 daje świeżość → wiarygodny pomiar), co ~5–6 tygodni
  w bazie/budowaniu, zero w taperze i oknie R-1/R-2. Jeśli korpus pokaże inny
  wzorzec — korpus wygrywa; decyzję zapisać w ADR.
- `engine/microcycle.ts`: opis house-style („sprawdzian 3 km na pełnym
  wypoczynku; wynik dopisz do trainctl.yaml — z niego kalibrujemy strefy") +
  rozgrzewka/schłodzenie wg profilu korpusu.
- `solver/reschedule.ts`: `test` w hierarchii poświęcania tuż przy `long`
  (kasujemy easy zanim ruszymy sprawdzian); ochrona odstępów jak dla akcentu.
- `engine/adapt.ts`: wpis w logu z czasem w dniu `test` → propozycja „dopisz
  wynik do trainctl.yaml (athlete.results) → trainctl plan zrekalibruje strefy"
  (propose-only, ADR-011).
- `why`: cel jednostki = kalibracja + próba generalna nawyków startowych;
  cytuje W-11…W-13.

### 7.3 Eksport i sync

- `workout-syntax.ts` (intervals.icu) i `export/fit.ts`: sprawdzian **bez celu
  tempa** (all-out — cel na zegarku by przeszkadzał; analogia do podbiegów
  ADR-010) → ADR-020. Rozgrzewka/schłodzenie z celami jak dotąd.
- `ics.ts`/`print.ts`: etykieta „Sprawdzian" w SUMMARY/tabeli.

### 7.4 Testy

- `macrocycle`: liczba i pozycje sprawdzianów w planie 17-tygodniowym (żadnego
  w taperze, żadnego poza tygodniem deloadowym, odstęp ≥4 tyg.); plan 8-tygodniowy
  (krótki) → co najwyżej 1; dystans TT zależny od celu.
- `microcycle`: opis jednostki, objętość tygodnia bez podwójnego akcentu.
- `adapt`: log czasu w dniu testu → propozycja rekalibracji.
- `reschedule`: sprawdzian przetrwa blokadę dnia kosztem easy.
- `workout-syntax` + `fit`: brak celu tempa dla kroku głównego TT.
- `backtest`: liczba akcentów per tydzień nadal Δ0 względem trenera (sprawdzian
  liczy się jako akcent, nie dodatek) — to jest test, który wykryje, gdyby TT
  psuł zgodność z korpusem.
- Aktualizacja liczników w testach eksportu/MCP, jeśli plan testowy zawiera TT.

### 7.5 DoD fazy 7

Reguły W-11…W-13 w FOUNDATIONS (z wnioskami z korpusu); plan maratoński zawiera
2–3 sprawdziany w słusznych miejscach; pętla log→adapt→rekalibracja przechodzi
testem; eksport TT bez celu tempa; backtest bez regresji; ADR-020 (+ ewentualny
ADR o umiejscowieniu); SPEC §8 „znane uproszczenia" zaktualizowane (punkt o
startach kontrolnych); commit.

---

## Faza 8 — `trainctl review` + pakiet onboardingowy agenta

**Cel.** Poniedziałkowy rytuał trenera jako jedna komenda: co było, co to
znaczy, co przed nami, co zrobić — czytelne dla człowieka w CLI i dla agenta
przez MCP. Do tego minimalny pakiet, który sprawia, że świeży agent od pierwszej
minuty wie, jak być trenerem.

### 8.1 Handler `cmdReview`

`cmdReview(cwd, opts: { date?, days? }, factory = defaultProviderFactory)` —
**kompozycja istniejących klocków, zero nowej logiki treningowej** (ADR-021):

1. Klucz osiągalny → świeży pull (błąd sieci → caveat i praca na `sync.json`);
   brak klucza → `sync.json` + `log.jsonl` (działa offline).
2. **Minione 7 dni** (albo `--days`): plan vs wykonanie z istniejącego `compare`
   (zrobione / krócej / dłużej / brak / nieplanowane), km plan vs km fakt.
3. **Sygnały adaptacji**: `analyzeExecution` — sekcja pojawia się tylko, gdy są
   propozycje (większość tygodni: „plan bez zmian — tak ma być"; deload i
   progresja są zaplanowane, cisza to nie błąd).
4. **Nadchodzący tydzień**: km, akcenty, sprawdzian jeśli jest, jedno zdanie
   „why" dla kluczowej jednostki.
5. **Do zrobienia**: checklista akcji (dopisz wynik sprawdzianu; po propozycjach
   adapt → edycja `trainctl.yaml` → `trainctl diff` → `trainctl plan`; `trainctl push --days 7`
   gdy klucz jest).

Wyjście w blokach (ADR-013). Komenda jest read-only poza migawką `sync.json`.

### 8.2 CLI + MCP

- `bin.ts`: `trainctl review` (+ `--days`), wpis w helpie.
- MCP: `trainctl_review` — opis: „poniedziałkowy przegląd: wykonanie, sygnały,
  tydzień przed nami, akcje; użyj zamiast wołania pull+adapt+week po kolei".
  Licznik narzędzi: **15** (aktualizacja `server.test.ts`).

### 8.3 Pakiet onboardingowy

- `trainctl init` (i kreator) zapisuje — o ile nie istnieje — **`AGENTS.md`**
  w katalogu treningowym: persona trenera dla dowolnego agenta. Treść:
  rytuały (poniedziałek → `trainctl_review`; przed każdą zmianą → `trainctl_week`),
  zasady (dnia startu nie ruszamy; przy pominięciach pytaj o kontekst — choroba
  ≠ zawał roboty; adapt proponuje — zmiany przez `trainctl.yaml` → `trainctl_diff` →
  `trainctl_plan`), oraz czego nie robić (nie regeneruj planu bez pytania — ADR-011).
- `docs/examples/github-actions-review.md` + `review.yml`: **opcjonalny** wzorzec
  „review co poniedziałek jako komentarz do issue" dla osób trzymających katalog
  na GitHubie. Jawne zastrzeżenia: klucz w sekretach GH i dane wellness płynące
  przez runnery to świadoma decyzja użytkownika; domyślny model pozostaje
  local-first; bot nie zastępuje rozmowy z agentem. To przykład w docs, nie kod
  produktu.

### 8.4 Testy

- `review` z fałszywą fabryką (ścieżka pull) i bez klucza (ścieżka snapshot);
  pusty log przy świeżym planie → sekcje 4–5 nadal się renderują; tydzień bez
  propozycji adapt → komunikat „bez zmian", nie pusta sekcja.
- MCP: scenariusz `trainctl_review` + licznik 15 narzędzi.
- `bin.test.ts`: smoke `trainctl review` poza TTY (czysty plain-text).
- Test blokowy: wyjście MCP bez ANSI (istniejąca gwarancja obejmuje nową komendę).

### 8.5 DoD fazy 8

`trainctl review` działa w CLI (kolor) i MCP (plain, 15 narzędzi); offline bez
klucza; `AGENTS.md` powstaje przy init i jest idempotentny (nie nadpisuje);
przykład Actions w docs z zastrzeżeniami; ADR-021; README (sekcja „rytuał
tygodniowy"); pamięć; commit.

---

## Backlog — świadomie POZA v1.1 (nie zaczynać bez decyzji użytkownika)

- **Sezon ze startami B/C** — mini-taper T-9 (dziś jawne uproszczenie w SPEC §8).
- **Pakiet startowy**: tabela splitów, papierowa opaska tempa (rozszerzenie
  `print.ts`), korekta tempa na upał.
- **Siła 2×/tydz. dla biegacza zza biurka** — najlepiej udowodniona interwencja
  przeciwurazowa (Lauersen 2014); zarazem pierwszy realny test `SportModule`.
- **Dystrybucja**: npm/npx, rejestr MCP — wymaga decyzji o publikacji OSS
  (osobna rozmowa: licencja, nazwa, czyszczenie historii repo z artefaktów).
- Odrzucone na stałe (zapisane w analizie 2026-08-05): autopilot HRV/readiness
  (sprzeczny z H-1 i §11), streaki/gamifikacja/social, pogoda, przebieg butów.

## Kandydaci ADR (numeracja: następny wolny to 019)

| # | Decyzja (skrót) | Sedno uzasadnienia |
|---|---|---|
| 019 | Profil z historii = **propozycja z proweniencją**, nie cicha automatyka | wartości mają komentarz źródła w YAML; kandydaci na wyniki zawsze potwierdzani; plan-as-code = użytkownik widzi i zatwierdza |
| 020 | Sprawdzian eksportowany **bez celu tempa** | all-out — cel na zegarku by przeszkadzał; analogia ADR-010 (podbiegi) |
| 021 | `review` = read-only kompozycja istniejących use-case'ów; szablon Actions to przykład w docs | żadnej nowej logiki treningowej w raporcie; local-first bez zmian; bot nie zastępuje kanału agentowego |

Plus ewentualny ADR o umiejscowieniu sprawdzianu (deload vs wzorzec z korpusu) —
decyzja zapada w fazie 7 po przejrzeniu korpusu.
