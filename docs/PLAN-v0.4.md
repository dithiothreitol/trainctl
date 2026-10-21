# Plan rozwoju 0.3.1 → 0.6.0 — naprawy i uzupełnienia

Samowystarczalny plan dla sesji Claude Code, w konwencji [PLAN-v1.1.md](PLAN-v1.1.md).
Kontekst produktu: [SPEC.md](../SPEC.md) (wizja, architektura, ADR-y). Warstwa
naukowa: [docs/science/FOUNDATIONS.md](science/FOUNDATIONS.md). Granice adaptacji
i budżetów czasu: [REVIEWED-ADAPTATION.md](REVIEWED-ADAPTATION.md).

**Stan wyjściowy (2026-10-21):** wydanie 0.3.0 we wszystkich pięciu paczkach
(npm `latest` = 0.3.0), 641 testów w 46 plikach, typecheck czysty, 17 komend CLI,
17 narzędzi MCP. Wszystkie komendy uruchomione na świeżym katalogu z
`trainctl init --template` (NO_COLOR, Windows, Node 24): żadna nie wywaliła
wyjątku, ale ujawniły usterki opisane w etapie A.

**Źródła planu:**

- przegląd kodu i uruchomień z 2026-10-21 (ten dokument jest jego zapisem);
- audyt [2026-09-05](audits/2026-09-05-code-audit.md) — tabela „Funkcje, które
  warto rozważyć po naprawach": punkty 3–7 nadal otwarte (powrót po przerwie
  i po starcie, repertuar zależny od celu, aktualność kalibracji, tryb bez
  zawodów, dziennik siły i kontekst regeneracji);
- SPEC §8 „znane uproszczenia silnika v1" i §9 „ryzyka" (import FIT/GPX jako
  mitygacja zależności od intervals.icu — zapowiedziany, nie zrobiony);
- weryfikacja dokumentacji pluginów Claude Code i Codex z 2026-10-21 (linki
  w etapie C).

**Zasada doboru zakresu.** Nie dokładamy „inteligencji planu". Domykamy to, co
czyni „plan jako kod" i „trenera w agencie" wiarygodnymi, w tej kolejności:
stan planu, który nie przepada (B1); CLI, które da się skryptować (B2–B5);
agent, który instaluje się jednym poleceniem (C); dane wykonania bez
pojedynczego punktu zależności (D); a dopiero na końcu silnik — wyłącznie
z dowodem w FOUNDATIONS albo jawną etykietą wartości inżynierskiej (E).

---

## 0. Reguły wykonania (obowiązują w każdym etapie)

**Higiena sesji** — każdy etap kończy się, w tej kolejności:

1. `pnpm test` — zielone we wszystkich paczkach; licznik testów rośnie, nigdy
   nie maleje (dziś 641).
2. `pnpm typecheck` — czysto w pięciu paczkach.
3. `pnpm build` + lokalna próba instalacji z tarballi (wzorzec joba `dist`
   w `.github/workflows/ci.yml`): `npx trainctl --version` w pustym katalogu
   jest częścią wydania, nie sprzątaniem po nim (lekcja 0.1.0, ADR-026).
4. `CHANGELOG.md` — sekcja `[Unreleased]` uzupełniona na bieżąco, nie przed
   tagiem.
5. `SPEC.md` — tabela etapów §8 i nowe ADR-y w §10/§11; `README.md`
   i `README.pl.md` razem (jeden PR, oba pliki).
6. Jeden commit na etap albo na spójny podetap (Conventional Commits,
   po polsku, jak w historii repo).

**Twarde ograniczenia kodu (bez zmian wobec PLAN-v1.1, zaktualizowane progi):**

- Node ≥ 22.18, natywny type-stripping: importy z rozszerzeniem `.ts`,
  **zakaz parameter properties** w klasach, zero kroku budowania w repo;
  build (`dist/`) wyłącznie do publikacji (ADR-026). `bin.test.ts` odpala
  prawdziwe binarki i ma przechodzić po każdym podetapie.
- `exactOptionalPropertyTypes` + `noUncheckedIndexedAccess`: opcjonalne wejścia
  handlerów typować `x?: T | undefined`.
- Warstwa prezentacji (ADR-013): handlery w `packages/cli/src/commands.ts`
  zwracają **bloki semantyczne** (`ui/blocks.ts`) i **dane** (`CmdResult.data`);
  ANSI dokłada wyłącznie `bin.ts` przez `renderAnsi`. Test braku `\x1b[`
  w wyjściu MCP obowiązuje nowe komendy.
- **Oba języki zawsze** (faza 12): każdy nowy tekst trafia do katalogów
  `packages/cli/src/i18n/cli-en.ts` (źródło typu) i `cli-pl.ts`, teksty
  domenowe do `packages/core/src/i18n/`. Strażnicy: `cli-i18n.test.ts`
  (komplet kluczy i arność), `no-leaks.test.ts` (polskie słowa w angielskim
  wyjściu), `i18n.test.ts`.
- Każda stała silnika cytuje ID reguły z FOUNDATIONS §10 albo jest jawnie
  oznaczona komentarzem jako wartość inżynierska.
- Adaptacja **proponuje, nie przepisuje** (ADR-011); propozycje przez
  `prepare` → `apply <id>` (ADR-029). Nic w tym planie tego nie zmienia —
  B1 rozszerza tę ochronę na `plan`.
- Sekrety (ADR-009/009a): klucz wyłącznie z env `TRAINCTL_INTERVALS_API_KEY`,
  `.env` albo `.trainctl-secret`; **nigdy w repo, testach ani fixture'ach**.
  Testy e2e na żywym koncie tylko lokalnie, z posprzątaniem konta.
- Kasowanie zdalne tylko z prefiksem `trainctl-` (ADR-016).
- Dane osobowe: żadnych realnych plików aktywności, wyników `--from-intervals`
  ani fragmentów korpusu w fixture'ach (D1 używa wyłącznie syntetycznych FIT/TCX).

**Kolejność etapów:** A → B → C → D → E. B1 (chroniona regeneracja) blokuje
E2/E3, bo bez niej każda zmiana celu kasuje historię. C zależy od B2 (`--json`)
tylko w hookach — można je zrównoleglić. D i E są od siebie niezależne.

---

## 1. Mapa etapów

| Etap | Wydanie | Zakres | Rozmiar |
|---|---|---|---|
| **A** | 0.3.1 (patch) | usterki zaobserwowane na żywo, dokumentacja odjechana od kodu, higiena wydań | S–M, jedna sesja |
| **B** | 0.4.0 | chroniona regeneracja planu; `--json`, `-C`, `TRAINCTL_TODAY`, daty względne, interaktywny `log`, `status`, `--commit`, drobiazgi UX | L, dwie–trzy sesje |
| **C** | 0.4.0 | plugin Claude Code + Codex z jednego katalogu; MCP: zasoby, prompty, narzędzie reguł; `init --agent` | M, jedna–dwie sesje |
| **D** | 0.5.0 | import plików aktywności (FIT/TCX/GPX) jako drugi adapter; intervals.icu głębiej; wellness i RPE z huba cytowane w przeglądzie | L, dwie–trzy sesje |
| **E** | 0.6.0 | budżet czasu tygodnia w generatorze; blok po starcie; plan bez zawodów; siła: dziennik i warianty; `terrain` w kalibracji | XL, każdy podetap z krokiem „najpierw nauka" |

Rozmiar jest orientacyjny (S = pół sesji, M = sesja, L = dwie–trzy, XL = etap
dzielony na niezależne wydania 0.6.x).

---

## 2. Etap A — naprawy i dokumentacja (0.3.1)

Każdy punkt: objaw → miejsce → zmiana → test. Żaden nie zmienia zachowania
silnika; wszystkie dotyczą prezentacji, komunikatów i dokumentów.

### A1. `review` — „przed nami" miesza objętość tygodnia z liczbą pozostałych sesji

- **Objaw:** `trainctl review --date <niedziela>` pokazuje „Volume 52 km across
  1 sessions": km z całego tygodnia, sesje tylko pozostałe.
- **Miejsce:** `cmdReview` w `commands.ts`, wywołanie
  `ui().review.volumeAhead(week.totalKm, upcoming.length)` (okolice linii 1210).
- **Zmiana:** policzyć `remainingKm` z `upcoming` (suma `workout.distanceKm`,
  dla startu `raceDistanceKm`) i pokazać „pozostało X z Y km w N sesjach";
  gdy `upcoming` jest puste, przełączyć się na następny tydzień (ta gałąź już
  istnieje — `hasFuture`). Klucz `volumeAhead` dostaje trzeci argument w obu
  językach.
- **Test:** `review.test.ts` — data niedzieli z wykonaną częścią tygodnia:
  liczba km w sekcji „Ahead" równa sumie pozostałych sesji; data poniedziałku
  bez zmian wobec dziś.

### A2. Katalog bez `trainctl.yaml` odsyła do `plan` zamiast do `init`

- **Objaw:** w pustym katalogu `today`, `push` itd. mówią „No plan yet — run:
  trainctl plan"; `plan` dopiero odpowie „No trainctl.yaml — run: trainctl init".
- **Miejsce:** `loadPlan`/`readPlanDocument` w `planfile.ts` rzuca
  `common.noPlan` nie sprawdzając configu.
- **Zmiana:** wspólny `requireWorkspace(cwd)` (nowa funkcja w `planfile.ts`
  albo `config.ts`): brak `trainctl.yaml` → `common.missingConfig`; jest config,
  brak planu → `common.noPlan`. Wołany z `loadPlan`.
- **Test:** `bin.test.ts` smoke w pustym katalogu (`today`, `week`, `push`)
  → komunikat o `init`, kod 1, bez stack trace; `commands.test.ts` dla
  katalogu z configiem bez planu → komunikat o `plan`.

### A3. `why` — dzień wolny „About 0 minutes" i zdublowany cel sesji

- **Objaw:** dla dnia bez treningu linia „About 0 minutes, including
  preparation"; dla treningu zdanie o celu jednostki pojawia się w sekcji
  „How this session fits your plan" i ponownie w panelu pod „Origin of the
  decision".
- **Miejsce:** `explain-session.ts` (nowe bloki z 0.3.0) + końcówka `cmdWhy`
  (panel `kindPurpose` + sekcja „Rules" z 0.1.0).
- **Zmiana:** linia czasu tylko gdy `day.workout` istnieje; panel celu usunąć
  (zostaje zdanie w sekcji kontekstu), sekcja „Rules" zostaje jako jedyne
  miejsce pełnych treści reguł, a „Origin of the decision" pokazuje tylko
  klasyfikację (research / heurystyka) bez powtarzania ID z „Rules" —
  albo scalić obie w jedną tabelę `ID · klasa · treść`.
- **Test:** `coach-flows.test.ts` — dzień wolny: brak frazy o minutach;
  dzień treningowy: zdanie celu występuje raz (policzyć wystąpienia
  `kindPurpose(kind)` w `renderPlain`).

### A4. `log` jest niemy wobec planu

- **Objaw:** `log --date <dzień wolny> --km 5` → „Logged …: done" i nic więcej;
  `log` dla treningu też nie odbija planu.
- **Miejsce:** `cmdLog` zwraca `ok(ui().log.saved(date, status))` bez bloków
  i bez `data`.
- **Zmiana:** zwracać `okDoc` z blokami: plan (rodzaj, km, szacowany czas) vs
  zapis (km, czas, RPE, notatka); gdy dzień w planie jest wolny —
  `b.info` „w planie odpoczynek; zapis liczy się jako bieg poza planem";
  gdy brak RPE — `b.hint` z podpowiedzią (`--rpe`). `data`: `{ entry, planned }`
  (potrzebne B2 i MCP).
- **Test:** `commands.test.ts` — trzy przypadki (trening, dzień wolny,
  `skipped`); `server.test.ts` — `trainctl_log` zwraca `structuredContent.data.entry`.

### A5. Ścieżki w wyjściu z backslashem na Windows

- **Objaw:** `plan` drukuje `Saved plan\plan.yaml + plan\PLAN.md`; podpowiedzi
  obok mówią `plan/plan.yaml`.
- **Miejsce:** `PLAN_YAML`/`PLAN_MD` w `planfile.ts` (prawdopodobnie `join`)
  używane zarówno do I/O, jak i do wyświetlania.
- **Zmiana:** stałe wyświetlane (`PLAN_YAML_DISPLAY = 'plan/plan.yaml'`) osobno
  od ścieżek I/O; przejrzeć `export.ts` (tam ścieżki bezwzględne są
  zamierzone — zostają).
- **Test:** `bin.test.ts` — wyjście `plan` nie zawiera `\` (CI już biega na
  `windows-latest`, więc test jest realny, nie teoretyczny).

### A6. Plan z innej wersji silnika przechodzi bez słowa

- **Objaw:** `plan.yaml` niesie `engineVersion` i `schemaVersion`, ale nic ich
  nie czyta; CHANGELOG zapowiada zmiany wyjścia między minorami poniżej 1.0.
- **Miejsce:** `StoredPlan.engineVersion?` w `planfile.ts`; zapis w `computePlan`.
- **Zmiana:** `planCompatibility(plan): Block[]` w `planfile.ts`: różny minor
  (`0.2.x` vs `0.3.x`) → `b.info` „plan wygenerowany silnikiem 0.2.0, działa
  0.3.1 — `trainctl diff` pokaże, co zmieniłaby regeneracja"; brak pola →
  „plan sprzed 0.2.0". Dokładane w `today`, `week`, `why`, `review`, a w `check`
  jako ustalenie klasy „file" (warn, bez ID reguły — to nie jest reguła
  metodyczna). `schemaVersion` ≠ 1 → błąd z prośbą o regenerację.
- **Test:** `check.test.ts` i `commands.test.ts` z planem o podmienionym
  `engineVersion`.

### A7. README nie zgadza się z kodem

- Tabela „Commands" bez wiersza `shorten` (flagi: `--minutes`, `--date`,
  `--apply <id>`); sekcja „Agent (MCP)": „Sixteen tools" i lista bez
  `trainctl_shorten` → siedemnaście, pełna lista (jak w `packages/mcp/README.md`).
- Oba README (`README.md`, `README.pl.md`) w jednym commicie; `CONTRIBUTING.md`
  już mówi „17 tools".
- **Test:** rozszerzyć `packaging.test.ts` albo dodać `docs.test.ts`: liczba
  narzędzi zarejestrowanych w `server.ts` (regex `registerTool\(\s*'trainctl_`)
  równa liczbie `trainctl_*` w obu README i w `packages/mcp/README.md`; każda
  komenda z `bin.ts` ma wiersz w tabeli README.

### A8. Przykłady Actions klonują silnik i używają Node 23

- `docs/examples/ci-check.md` i `github-actions-review.md` powstały przed
  publikacją na npm: `actions/checkout` silnika do `.trainctl-engine`,
  `node-version: '23'`, `corepack enable`.
- **Zmiana:** `actions/setup-node@v5` z `node-version: '22.18'`,
  `npx --yes trainctl@0.3.1 check` / `… review --days 7`; usunąć checkout
  silnika; zostawić `NO_COLOR=1` i zastrzeżenia o kluczu w sekretach.
  Wersję pisać jawnie (pin), z komentarzem, że to ta sama zasada co
  „pin the version in your training repo" z README.
- **Test:** `docs.test.ts` — żaden plik w `docs/examples/` nie zawiera
  `.trainctl-engine` ani `node-version: '23'`.

### A9. `why` i `desk` odsyłają do pliku, którego użytkownik npm nie ma

- **Objaw:** podpowiedzi `sources and parameters: docs/science/FOUNDATIONS.md §10`
  (`cli-en.ts` ~213, `rulesHint` ~284, opis narzędzia MCP ~779, `agentsMd`).
  Pole `files` paczek nie zawiera `docs/`.
- **Zmiana:** `FOUNDATIONS_URL = https://github.com/dithiothreitol/trainctl/blob/v${packageVersion()}/docs/science/FOUNDATIONS.md`
  (pin do tagu wydania, więc link nie dryfuje) w `rules-explain.ts`;
  katalogi i18n dostają URL przez argument. Wewnątrz repo (`pnpm trainctl`)
  może zostać ścieżka względna — wykryć po istnieniu pliku obok `bin.ts`?
  Prościej: zawsze URL. `AGENTS.md` (szablon w `agentsMd`) — ta sama zmiana.
- **Test:** `no-leaks.test.ts` bez zmian (URL nie ma polskich słów);
  `bin.test.ts` — `why` zawiera `https://github.com/`.

### A10. Wydania na GitHubie zatrzymały się na 0.1.1 (działanie właściciela)

- Tagi `v0.2.0` i `v0.3.0` istnieją, Release tylko dla `v0.1.0` i `v0.1.1`.
- **Zmiana:** `gh release create v0.2.0 --notes-from-tag` (albo treść z
  CHANGELOG) i to samo dla `v0.3.0`; `docs/PUBLISHING.md` — do sekwencji
  wydania dopisać krok „GitHub Release z sekcji CHANGELOG" zaraz po
  `npx <paczka>@<wersja> --version`.

### A11. `docs/karuzela` — nieskomitowana i z nieaktualnymi liczbami (decyzja właściciela)

- Katalog jest `untracked`, a `FAKTY.md` podaje 557 testów, 16 komend,
  16 narzędzi (dziś 641 / 17 / 17). README karuzeli deklaruje, że źródła są
  w repo, a `out/` nie.
- **Decyzja do podjęcia:** (a) skomitować źródła (`out/` i `node_modules/`
  wyklucza lokalny `.gitignore`) i odświeżyć FAKTY przed każdą publikacją;
  (b) przenieść do osobnego repo materiałów. Rekomendacja: (a), bo README
  karuzeli już tę decyzję opisuje — tylko nie została wykonana.
- Jeśli (a): dodać do `docs.test.ts` kontrolę, że liczby w `FAKTY.md`
  (testy, komendy, narzędzia) zgadzają się z kodem — inaczej plik będzie
  kłamać przy następnym wydaniu tak samo jak dziś.

### A12. `CLAUDE.md` dla repozytorium silnika

- Repo powstaje z agentem, ma `.claude/settings.local.json`, ale nie ma
  `CLAUDE.md`. Krótki plik (≤ 40 linii): wskaźniki do `CONTRIBUTING.md`,
  `SPEC.md` §10, FOUNDATIONS; pięć reguł z §0 tego planu (type-stripping,
  bloki, oba języki, ID reguł, sekrety); `pnpm check` jako bramka.
  Bez powielania treści, które już są w CONTRIBUTING.

### A13. Zamknięcie etapu

`CHANGELOG` sekcja 0.3.1 („Fixed", „Docs"); SPEC — linia statusu i tabela §8
(wiersz „A"); tag `v0.3.1`, publikacja pięciu paczek (wersja wspólna —
`packaging.test.ts` tego pilnuje), Release na GitHubie (A10 obowiązuje od razu).

**DoD etapu A:** wszystkie objawy z A1–A6 mają test, który bez poprawki nie
przechodzi; `docs.test.ts` pilnuje A7, A8 i (jeśli skomitowana) A11; README
w obu językach zgodne z `bin.ts` i `server.ts`; Releases 0.2.0–0.3.1 na GitHubie.

---

## 3. Etap B — CLI, które da się skryptować, i stan, który nie przepada (0.4.0)

### B1. Chroniona regeneracja planu (`plan` na istniejącym planie)

**Problem.** `cmdPlan` liczy `computePlan(config, today)` i woła `writePlan`
bez czytania poprzedniego planu. Przepadają: `loadState` (zatwierdzona baza
objętości po `adapt --apply`), `timeBudgets`, dni `pinned`, `timeAdjustment`
po `shorten --apply`, historia `changes`, a także dni przeszłe i zalogowane.
Dokumentacja każe przy nowym wyniku robić „edycja `trainctl.yaml` → `diff` →
`plan`", czyli dokładnie tę ścieżkę. To jedyny punkt planu, który może kogoś
realnie zaskoczyć — stąd pierwsze miejsce w etapie B.

**Decyzja (kandydat ADR-033).** `trainctl plan` na istniejącym planie wykonuje
**regenerację chronioną**: dni przeszłe (względem zegara, nie `--date`),
zalogowane i przypięte zostają jak były; przyszłość liczy się z `trainctl.yaml`
**i** `loadState` (baza efektywna od `effectiveFrom`), z przeniesieniem
`timeBudgets` i `timeAdjustment` dla dat, które nadal istnieją w planie;
`changes` dostaje wpis `regenerate`. Komenda pokazuje podsumowanie różnic
(wspólny `diffWeeks` z `cmdDiff`) i wynik lintu. Pełne nadpisanie od zera
wymaga jawnego `--fresh` i drukuje, co zostaje porzucone. Nowy katalog bez
planu zachowuje się jak dziś.

**Implementacja.**

- `proposals.ts` ma już budowę planu zakotwiczoną w `loadState` i listę
  `protectedDates` (poprawka A02/A05 z 0.3.0). Wyciągnąć z niej czystą funkcję
  `rebuildPlan(existing: StoredPlan, config, today): { plan, protectedDates, carried, dropped }`
  do `planfile.ts` i użyć w trzech miejscach: `prepareProposal`, `cmdPlan`,
  `cmdDiff` (dry-run ma pokazywać **tę samą** regenerację, którą wykona `plan` —
  inaczej diff i plan się rozjadą).
- `cmdPlan(cwd, { date?, fresh? })`: bez planu → jak dziś; z planem i bez
  `--fresh` → `rebuildPlan`, bloki: sekcja „Co się zmieniło" (diff), `b.info`
  o liczbie dni chronionych i przeniesionych budżetów, lint; `--fresh` →
  `computePlan` + `b.warn` z listą porzuconego stanu.
- MCP `trainctl_plan`: parametr `fresh: z.boolean().optional()`; opis narzędzia
  przestaje mówić „OVERWRITES" — mówi „regeneruje przyszłość, chroni przeszłość
  i zatwierdzone decyzje; `fresh=true` nadpisuje wszystko".
- `AGENTS.md` (szablon): zasada 1 („nie regeneruj bez pytania") zostaje —
  regeneracja dalej zmienia przyszłe tygodnie — ale opis skutków aktualny.

**Testy** (`commands.test.ts`, `audit-fixes.test.ts`):

- sekwencja: redukcja → `adapt --apply` → nowy wynik w configu → `plan` →
  tygodnie przyszłe trzymają zredukowaną bazę, tempa nowe;
- piny i `timeBudgets` przyszłych dat przeżywają; dni przeszłe i zalogowane
  bajt w bajt identyczne;
- `--fresh` kasuje stan i ostrzega; `diff` i `plan` dają ten sam zestaw zmian
  (porównać `changes`);
- `bin.test.ts`: smoke `plan` dwa razy pod rząd → drugi raz „bez zmian".

### B2. `--json` — dane zamiast tekstu

- `bin.ts`: globalna opcja `--json`; `print()` wtedy drukuje
  `JSON.stringify({ code, data, output: renderPlain(blocks) })`, kod wyjścia
  jak dotąd. Bez ANSI, bez spinnera (spinner na stderr już nie przeszkadza,
  ale w trybie `--json` wyłączyć).
- Przegląd handlerów: każdy zwraca `data` (dziś część zwraca `ok(text)` —
  `cmdLog` z A4, `cmdInit`, `cmdShift`). Schemat `data` jest **kontraktem**
  tylko w zakresie pól już używanych przez MCP (`structuredContent.data`);
  resztę oznaczyć w README jako „kształt może się zmienić do 1.0".
- **Test:** `bin.test.ts` — `today --json`, `week --json`, `check --json`
  parsują się, nie zawierają `\x1b[`, `code` zgodny z kodem procesu;
  `no-leaks.test.ts` obejmuje tryb `--json`.

### B3. `-C <katalog>` i `TRAINCTL_DIR` w CLI

- Dziś CLI działa wyłącznie na `process.cwd()`; MCP ma `TRAINCTL_DIR`.
- `bin.ts`: katalog roboczy = `-C`/`--dir` > `TRAINCTL_DIR` > cwd, ustalany
  **przed** `loadEnvFile` i `readConfigLanguage` (tak jak `--lang` jest dziś
  czytany z `argv` przed zbudowaniem drzewa komend). Ścieżki względne w
  `-C` liczone od cwd procesu.
- Przykłady cron/Actions w docs przestają potrzebować `cd`.
- **Test:** `bin.test.ts` — uruchomienie z innego katalogu z `-C`
  i z `TRAINCTL_DIR`; `.env` czytany z katalogu docelowego, nie z cwd.

### B4. Jawny zegar symulacji `TRAINCTL_TODAY` (kandydat ADR-034)

- **Problem.** Po poprawce A05 ochrona przeszłości idzie po prawdziwej dacie
  (`localToday()`), a `--date` jest tylko selektorem. To słuszne — ale na
  katalogu demo z planem w przeszłości `shorten` i `reschedule` odmawiają,
  więc nie da się odtworzyć bloków z `docs/karuzela/FAKTY.md`, screenshotów
  do README ani ręcznie przetestować scenariusza „za trzy tygodnie".
- **Decyzja.** `localToday()` honoruje `TRAINCTL_TODAY=YYYY-MM-DD` (walidacja
  `parseIso`, błąd przy złym formacie). Gdy zmienna jest ustawiona, **każde**
  wyjście zaczyna się blokiem `b.warn` „data symulowana: 2026-08-16"
  (CLI i MCP — w MCP dodatkowo linia na stderr przy starcie). Symulacja nigdy
  nie jest cicha; propozycje zapisane pod symulowaną datą noszą ją w pliku
  (`createdFor`), żeby `apply` pod prawdziwą datą je odrzucił tak samo jak
  dziś odrzuca zmianę dnia.
- Testy mogą od tej pory używać zmiennej zamiast podmieniać zegar — tam,
  gdzie dziś mockują `Date`, zostawić jak jest; nowe testy używają env.
- **Test:** `bin.test.ts` — z `TRAINCTL_TODAY` ustawionym na dzień z planu
  `shorten --minutes 40` przechodzi i drukuje ostrzeżenie o symulacji;
  propozycja przygotowana pod symulacją nie aplikuje się bez tej samej
  wartości zmiennej.

### B5. Daty względne w CLI

- `packages/core/src/util/dates.ts`: `resolveDate(input, today, locale)`:
  ISO; `today|tomorrow|yesterday`; `+N|-N` (dni); nazwy dni `mon…sun`
  (najbliższy w przód dla `--to`/`--block`, w tył dla `log --date`? — nie:
  **zawsze najbliższy w przyszłości**, poza `log`, gdzie najbliższy w
  przeszłości; zasada opisana w `help`); aliasy polskie `dziś|jutro|wczoraj`,
  `pn wt śr czw pt sob nd` (z `wizard.dayCodes`, z normalizacją diakrytyków jak
  w `parseDaysInput`).
- Zastosować w `bin.ts` do wszystkich `--date`, `--from`, `--to`, `--block`,
  `--pin`, `--time YYYY-MM-DD=min`. **MCP zostaje przy ISO** (agent liczy
  daty sam; `isoDate()` bez zmian) — unikamy dwuznaczności w narzędziu.
- **Test:** `dates.test.ts` — macierz wejść × `today`; `bin.test.ts` —
  `log --date yesterday`, `reschedule --block thu`.

### B6. Interaktywny `log` w TTY

- Najczęstsza komenda dnia jest jedyną codzienną bez trybu bez flag
  (ADR-015: interaktywność jako dodatek). `trainctl log` bez argumentów
  w TTY: `select` daty z ostatnich 7 dni (etykieta: data · rodzaj · km ·
  status z dziennika), potem pytania `readline/promises` jak w `ui/wizard.ts`:
  status (done/skipped/modified, Enter = done), km (domyślnie planowane),
  czas (`MM:SS`, Enter = pomiń), RPE 1–10, notatka. Na końcu `cmdLog`
  i jego bloki (A4). Poza TTY — jak dziś (komunikat, jak podać flagi).
- Kod w `interactive.ts` (`runLogPrompt`), parsery współdzielone z wizardem
  (`parseTimeInput`), teksty w `ui().log.prompt*` w obu językach.
- **Test:** `interactive.test.ts` — parsowanie odpowiedzi i domyślne wartości
  bez TTY (wzorzec `renderChoices` z `select.test.ts`); `bin.test.ts` —
  poza TTY `log` bez flag daje czytelną instrukcję, kod 1.

### B7. `trainctl status` — jeden ekran stanu katalogu

- `cmdStatus(cwd)`, read-only, zwraca bloki i `data`:
  - **config:** istnieje? waliduje się? (lista błędów `loadConfig` zamiast
    wyjątku), język;
  - **plan:** `generatedAt`, `engineVersion` vs `packageVersion()` (A6),
    tygodnie/sesje, cel i dni do startu, `loadState` jeśli jest;
  - **kalibracja:** wybrany wynik, wiek w dniach, liczba wykluczonych;
  - **klucz:** źródło (`env` / `.env` / `.trainctl-secret` / brak) i czy `.env`
    jest ignorowany przez gita (wynik `loadEnvFile`);
  - **sync:** `pulledAt`, zakres, liczba aktywności z `dataWithheld`;
  - **dziennik:** liczba wpisów, ostatni wpis, dni bez potwierdzenia
    w bieżącym tygodniu (`buildExecution` → `unknown`);
  - **propozycje:** lista `plan/proposals/*.json` — id, rodzaj (adapt /
    shorten), data utworzenia, **ważna dziś / wygasła** (reguła „następny
    lokalny dzień kalendarzowy"), jedno zdanie zmian; dziś nic tego nie
    listuje i zgubiony ID trzeba szukać w plikach;
  - **git:** w repozytorium? zmiany niezacommitowane w `trainctl.yaml`,
    `plan/`, `log.jsonl` (`spawnSync('git', ['status','--porcelain', …])`,
    cicho pomijane bez gita).
- MCP: `trainctl_status` (readOnlyHint: true) — agent zaczyna od niego
  zamiast od trzech wywołań. Licznik narzędzi: 18 (`server.test.ts`).
- Opcjonalnie `adapt --discard <id>` / `shorten --discard <id>` do sprzątania
  wygasłych propozycji; bez tego `status` tylko je pokazuje.
- **Test:** `commands.test.ts` — katalog pusty, z configiem, z planem
  i propozycją ważną oraz wygasłą (z `TRAINCTL_TODAY`); `bin.test.ts` smoke.

### B8. `--commit` na operacjach piszących (kandydat ADR-040)

- AGENTS.md każe „commit after every change to the plan"; narzędzie może to
  domknąć bez stawania się klientem gita. Flaga `--commit [wiadomość]` na:
  `plan`, `log`, `shift`, `reschedule --apply`, `adapt --apply`,
  `shorten --apply`, `init`. Po udanym zapisie: `git add` **tylko plików,
  które komenda zmieniła** (`trainctl.yaml`, `plan/**`, `log.jsonl`,
  `AGENTS.md`, `.gitignore`), potem `git commit -m` z wiadomością domyślną
  w języku katalogu (np. `trainctl shift: 2026-08-13 ↔ 2026-08-15`).
  Nigdy `.env`, `.trainctl-secret`, `sync.json`.
- Bez gita w katalogu → `b.info` i kod 0 (operacja się udała, commit nie).
  Brak tożsamości gita → komunikat gita przepuszczony, kod 0.
- MCP: parametr `commit: z.boolean().optional()` na tych samych narzędziach;
  opis mówi wprost, że to zapis do historii użytkownika.
- **Test:** `commands.test.ts` z tymczasowym repo (`git init`,
  `-c user.name/email` w `spawnSync`): commit zawiera tylko oczekiwane
  pliki; katalog bez gita → informacja, kod 0; Windows — `EBUSY` retry jak
  w istniejących testach sprzątania.

### B9. `today`: czas i „jutro"

- Panel treningu dostaje linię szacowanego czasu (ten sam
  `estimateWorkoutMinutes` + siła, który już zasila `data.estimatedMinutes`
  i `why`) oraz linię „następna sesja: data · rodzaj · km" (szukana w przód
  przez `findDay`). Dla biegacza zza biurka to dwie najważniejsze liczby dnia.
- **Test:** `commands.test.ts` — obecność linii i poprawność następnej sesji
  przez dzień wolny i przez granicę tygodnia.

### B10. Uzupełnienia powłoki: `completion`

- `trainctl completion bash|zsh|fish|pwsh` — generator statycznych skryptów
  z drzewa `program.commands` (nazwy komend i opcji), zero zależności.
  Instrukcja w `help completion` i README („Install").
- **Test:** snapshot każdej powłoki zawiera wszystkie komendy z `bin.ts`
  (porównanie z listą w czasie testu, nie z zamrożoną).

### B11. Przykłady w `help <komenda>`

- `addHelpText('after', ui().examples.<komenda>)` dla komend z nietrywialnymi
  flagami: `log`, `reschedule`, `shorten`, `adapt`, `review`, `export`,
  `diff`, `push`/`pull`. Dwa–trzy przykłady, oba języki.
- **Test:** `no-leaks.test.ts` obejmuje `help <komenda>` dla każdej komendy.

### B12. Kody wyjścia (opcjonalne, małe)

- Dziś wszystko niezerowe to 1. Rozróżnić: 1 błąd danych/konfiguracji,
  2 błąd użycia (commander `exitOverride`), 3 odmowa ochronna (przeszłość,
  dzień startu, pin, wygasła propozycja). Zmiana widoczna dla skryptów
  i hooków z etapu C (hook `check` może odróżnić „plan niespójny" od „brak
  planu"). Udokumentować w README „Commands". Jeśli nie wejdzie w 0.4.0 —
  nie blokuje nic innego.

### B13. Zamknięcie etapu

CHANGELOG 0.4.0 („Added", „Changed" — B1 to zmiana zachowania, opisać wprost);
SPEC: ADR-033, 034, 040 w §11, tabela §8; README „Commands" (flagi globalne
`--json`, `-C`, `--lang`; `status`; `completion`), sekcja „Plan as code"
(regeneracja chroniona, `--fresh`, `--commit`); `REVIEWED-ADAPTATION.md`
(interakcja `plan` z `loadState`); `AGENTS.md` szablon (zasada 1).

**DoD etapu B:** sekwencja z B1 ma test; `--json` na każdej komendzie bez ANSI;
`TRAINCTL_TODAY` widoczny w wyjściu i respektowany przez propozycje; `status`
listuje propozycje z terminem; 18 narzędzi MCP; `bin.test.ts` zielony na
Windows i Linux.

---

## 4. Etap C — plugin Claude Code i Codex, MCP poza narzędziami (0.4.0)

**Cel.** „Trener w agencie" instaluje się jednym poleceniem zamiast ręcznego
`claude mcp add` i kopiowania AGENTS.md. Jeden katalog pluginu obsługuje oba
agenty: Codex czyta także starsze `.claude-plugin/marketplace.json` i podaje
hookom `CLAUDE_PLUGIN_ROOT` dla zgodności, więc format Claude Code jest
wspólnym mianownikiem.

**Fakty zweryfikowane 2026-10-21** (do ponownego sprawdzenia przed wydaniem —
oba ekosystemy zmieniają się co miesiąc):

| | Claude Code | Codex |
|---|---|---|
| manifest | `.claude-plugin/plugin.json`, opcjonalny, wymagane tylko `name` | `.codex-plugin/plugin.json` (CLI ≥ 0.117, III 2026) albo przenośny `plugin.json` w korzeniu z `extensions.com.openai` |
| skille | `skills/<nazwa>/SKILL.md` → `/trainctl:<nazwa>`; `commands/*.md` to format starszy | `skills/<nazwa>/SKILL.md`, wskazane w manifeście polem `skills` |
| MCP | `.mcp.json` w korzeniu pluginu; podstawianie `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PROJECT_DIR}`, `${VAR}`/`${VAR:-default}`; serwer startuje z każdą sesją z włączonym pluginem | manifest `mcpServers: "./<plik>"`; `.mcp.json` z `command/args/env` i `${VAR}` (opis społeczności — **do weryfikacji**); przenośny `mcp.json` dokumentuje transport HTTP z polem `type` |
| hooki | `hooks/hooks.json` (`SessionStart`, `PostToolUse` …); `CLAUDE.md` z korzenia pluginu **nie** jest ładowany | `hooks/hooks.json` tylko dla ręcznie instalowanych pluginów desktopowych; pluginy z hookami nie wchodzą do publicznego katalogu |
| marketplace | `.claude-plugin/marketplace.json` w repo; repo może być jednocześnie marketplace i pluginem (`"source": "./…"`) | `.agents/plugins/marketplace.json` w repo albo `~/.agents/plugins/`; czyta też `.claude-plugin/marketplace.json` |
| instalacja | `/plugin marketplace add dithiothreitol/trainctl` + `/plugin install trainctl@trainctl`; jednym krokiem `/plugin install trainctl --marketplace dithiothreitol/trainctl`; źródło pluginu może być też `npm` | `codex plugin marketplace add dithiothreitol/trainctl`, potem `/plugins` w sesji |
| włączenie per repo | `.claude/settings.json` z `extraKnownMarketplaces` + `enabledPlugins` | `.codex/config.toml`: `[plugins."trainctl@trainctl"] enabled = true` (tylko zaufane projekty) |
| aktywacja warunkowa „tylko gdy jest trainctl.yaml" | **brak** — plugin jest włączony globalnie albo per scope | brak |
| katalog oficjalny | marketplace Anthropic nie przyjmuje zgłoszeń; katalog claude.ai wymaga płatnego planu; własny marketplace darmowy | portal zgłoszeń; pluginy z hookami wykluczone |

Źródła: dokumentacja Claude Code (plugins: overview, components,
manifest-reference, marketplace-reference, install, loading, publish; mcp;
hooks-guide), dokumentacja Codex (`developers.openai.com/codex/plugins`,
strona „Package your plugin"), opisy społeczności Codex (plugin system,
marketplace) — linki w CHANGELOG przy wydaniu.

### C1. Struktura: `plugin/` w korzeniu repo

```
plugin/
  .claude-plugin/plugin.json      # name, version (= wersja paczek), description, author, homepage, repository, license, keywords
  .codex-plugin/plugin.json       # name, version, description, skills: "./skills/", mcpServers: "./codex.mcp.json"
  .mcp.json                       # Claude Code
  codex.mcp.json                  # Codex (bez ${CLAUDE_PROJECT_DIR}; serwer używa cwd)
  skills/
    coach/SKILL.md                # persona = treść AGENTS.md (EN), opis wyzwalający przy tematach biegowych
    review/SKILL.md               # /trainctl:review — rytuał poniedziałkowy
    debrief/SKILL.md              # /trainctl:debrief — odprawa po treningu (RPE, notatka, jedno pytanie o kontekst)
    shorten/SKILL.md              # /trainctl:shorten — „mam dziś tylko N minut"
    what-if/SKILL.md              # /trainctl:what-if — scenariusz na gałęzi + diff
  hooks/hooks.json
  scripts/
    session-start.mjs             # drukuje AGENTS.md katalogu (albo krótką personę), milczy bez trainctl.yaml
    check-plan.mjs                # PostToolUse Edit|Write: gdy file_path kończy się na plan/plan.yaml → trainctl check
  README.md
```

`.mcp.json` (Claude Code):

```json
{
  "mcpServers": {
    "trainctl": {
      "command": "npx",
      "args": ["-y", "trainctl-mcp@0.4.0"],
      "env": { "TRAINCTL_DIR": "${CLAUDE_PROJECT_DIR}" }
    }
  }
}
```

`codex.mcp.json` — to samo bez `env`: `trainctl-mcp` już dziś używa
`process.cwd()`, gdy `TRAINCTL_DIR` nie jest ustawione (`packages/mcp/src/bin.ts`).
**Do weryfikacji w implementacji:** czy Codex uruchamia serwer MCP pluginu
z katalogu projektu; jeśli nie — udokumentować `codex mcp add` z jawnym
`TRAINCTL_DIR` jako ścieżkę zapasową.

Skrypty hooków w Node, nie w sh — Node jest gwarantowany (wymaganie
`trainctl`), a hooki muszą działać także na Windows:

```json
{
  "hooks": {
    "SessionStart": [{ "hooks": [{ "type": "command", "command": "node \"${CLAUDE_PLUGIN_ROOT}/scripts/session-start.mjs\"" }] }],
    "PostToolUse": [{ "matcher": "Edit|Write", "hooks": [{ "type": "command", "command": "node \"${CLAUDE_PLUGIN_ROOT}/scripts/check-plan.mjs\"" }] }]
  }
}
```

`session-start.mjs`: jeśli w `CLAUDE_PROJECT_DIR` (albo cwd) nie ma
`trainctl.yaml` — `exit 0` bez wyjścia (jedyna dostępna namiastka aktywacji
warunkowej); jeśli jest — drukuje `AGENTS.md` z katalogu (gdy istnieje),
inaczej skróconą personę z pluginu. `check-plan.mjs`: czyta JSON ze stdin,
`tool_input.file_path`; gdy ścieżka kończy się na `plan/plan.yaml` —
`npx -y trainctl@<wersja> check --json` i przekazuje wynik; `code` 1
→ komunikat do agenta („plik niespójny — pokaż ustalenia użytkownikowi"),
ostrzeżenia → relacja z ID reguł. Bez `--json` z B2 hook parsowałby tekst —
stąd zależność C od B2.

### C2. Skille — cienkie, odsyłające do narzędzi, bez własnej logiki treningowej

Każdy `SKILL.md`: frontmatter `name`, `description` (kiedy się włączać),
treść: które narzędzie wywołać, czego **nie** robić (propose-don't-apply,
nie wymyślać liczb, nie regenerować bez pytania), co pokazać użytkownikowi.
Treść pochodzi z rytuałów `agentsMd` (`cli-en.ts`) — **nie kopiować ręcznie**:
skrypt `tools/plugin/render-skills.mjs` generuje `skills/*/SKILL.md` z katalogu
i18n, a test porównuje wynik z plikami w repo (dryf = czerwony test). Język
skilli: angielski; wyjście narzędzi i tak idzie w języku katalogu
treningowego, więc polski użytkownik dostaje polskie treści z MCP.

### C3. Marketplace: repo jest marketplace'em

`/.claude-plugin/marketplace.json` (korzeń repo):

```json
{
  "name": "trainctl",
  "owner": { "name": "Dariusz Tyszka" },
  "plugins": [{ "name": "trainctl", "source": "./plugin", "description": "Running coach: plan as code, coach as your agent’s tool", "category": "productivity" }]
}
```

`/.agents/plugins/marketplace.json` dla Codex — ten sam wpis w jego schemacie
(`source: { "source": "local", "path": "./plugin" }`, `policy`, `category`).
Publikacja = tag w repo (plugin ciągnie `trainctl-mcp@<wersja>` z npm).
Alternatywa (źródło `npm` w marketplace Claude Code) zostaje w zapasie —
wymagałaby szóstej paczki.

### C4. `trainctl init --agent claude|codex|all` (kandydat ADR-036)

- `init` dopisuje do katalogu treningowego pliki integracji **tylko na jawną
  flagę** (nic po cichu — ta sama zasada co ADR-019):
  - `claude`: `.claude/settings.json` z `extraKnownMarketplaces` (github
    `dithiothreitol/trainctl`) i `enabledPlugins: { "trainctl@trainctl": true }`
    oraz `.mcp.json` katalogu jako ścieżka zapasowa bez pluginu
    (`claude mcp add` w jednym pliku);
  - `codex`: `.codex/config.toml` z `[plugins."trainctl@trainctl"] enabled = true`
    i `[mcp_servers.trainctl]` jako zapas;
  - istniejące pliki nie są nadpisywane (jak `AGENTS.md`); `.gitignore` bez
    zmian — te pliki **mają** być w repo treningowym.
- Kreator (`ui/wizard.ts`) dostaje ostatnie pytanie „Którego agenta używasz?"
  z opcją „żadnego".
- Bez flagi `init` drukuje jedną podpowiedź: `trainctl init --agent claude`.
- **Test:** `init-*.test.ts` — zawartość plików, idempotencja, brak nadpisania;
  `no-leaks.test.ts` — pliki konfiguracyjne agentów bez polskich słów
  (to pliki techniczne).

### C5. MCP: zasoby, prompty, narzędzie reguł

- **Zasoby** (`server.registerResource`): `trainctl://plan/PLAN.md`,
  `trainctl://config` (`trainctl.yaml`), `trainctl://agents` (`AGENTS.md`),
  `trainctl://rules/{id}` (template). Klient pokazuje plan bez wywołania
  narzędzia; zasoby są read-only z definicji.
- **Prompty** (`server.registerPrompt`): `weekly-review` (argument `date?`),
  `debrief` (argument `date?`) — treść z tych samych rytuałów co skille.
- **Narzędzie** `trainctl_rule(id)`: `ruleExplain` + `ruleEvidence`
  z `rules-explain.ts` + URL FOUNDATIONS (A9) + klasyfikacja (research /
  heurystyka). Agent nie ma FOUNDATIONS na dysku — dziś `why` odsyła do pliku,
  którego nie widzi. Licznik narzędzi: 19 (`server.test.ts`).
- **Test:** `server.test.ts` — klient in-memory listuje zasoby i prompty,
  czyta `trainctl://plan/PLAN.md` równy plikowi, `trainctl_rule('I-7')`
  zwraca tekst i URL; brak ANSI (istniejący strażnik obejmuje nowe wyjścia).

### C6. Testy i CI pluginu

- `plugin.test.ts` (w `packages/cli` albo nowy `tests/plugin/`): oba manifesty
  parsują się; `version` równa wersji paczek (rozszerzyć `packaging.test.ts`);
  `.mcp.json`/`codex.mcp.json` wskazują `trainctl-mcp@<ta sama wersja>`;
  każdy `SKILL.md` ma frontmatter `name` i `description`; `hooks.json` wskazuje
  istniejące skrypty; skille zgodne z generatorem (C2); skrypty hooków
  przechodzą próbę z fałszywym stdin (`check-plan.mjs` na pliku spoza planu →
  cisza, kod 0; na `plan/plan.yaml` → wywołanie `check`).
- CI: job `plugin` — `node tools/plugin/render-skills.mjs --check`
  i `plugin.test.ts`; `claude plugin validate ./plugin` jako krok lokalny
  w `CONTRIBUTING.md` (CLI Claude nie ma w runnerze).
- Wersja w `.mcp.json` i manifestach podnoszona razem z paczkami —
  dopisać do sekwencji wydania w `docs/PUBLISHING.md`.

### C7. Dokumentacja

- README (oba): sekcja „Agent (MCP)" zaczyna się od pluginu (dwa polecenia),
  ręczne `claude mcp add` schodzi do akapitu „bez pluginu"; sekcja dla Codex
  (`codex plugin marketplace add`, `/plugins`, AGENTS.md czytany natywnie).
- `docs/integrations/agents.md`: instalacja, co robi hook, jak wyłączyć,
  ograniczenia (brak aktywacji warunkowej, hooki a katalog publiczny OpenAI),
  wersjonowanie.
- `plugin/README.md` dla przeglądających repo marketplace'u.

**DoD etapu C:** `/plugin install trainctl --marketplace dithiothreitol/trainctl`
w czystym katalogu treningowym daje działające narzędzia `trainctl_*`,
skille `/trainctl:*` i hook `check` (próba ręczna, zapisana w
`docs/integrations/agents.md` z datą); Codex: `codex plugin marketplace add`
+ `/plugins` — próba ręczna z datą i listą tego, co nie zadziałało;
`init --agent` z testami; 19 narzędzi MCP, zasoby i prompty z testami;
ADR-036 w SPEC.

---

## 5. Etap D — integracje (0.5.0)

### D1. Import plików aktywności: FIT / TCX / GPX (kandydat ADR-037)

**Cel.** Drugi adapter portu — bez konta w serwisie. SPEC §9 nazywa to
mitygacją zależności od intervals.icu; dodatkowo obchodzi ograniczenie
Stravy (Garmin Connect, Coros i Polar eksportują pliki lokalnie).

**Port.** `SyncProvider` łączy odczyt (`listActivities`, `listWellness`)
z zapisem (`pushWorkouts`, `listPlannedWorkouts`, `deleteWorkout`). Adapter
plikowy jest pull-only. Dwie opcje: (a) rozdzielić port na `ActivitySource`
i `WorkoutSink`, `SyncProvider = oba`; (b) `FileProvider implements SyncProvider`
z metodami zapisu rzucającymi jawny błąd „ten adapter nie wysyła". Rekomendacja:
(a) — `review` i `pull` potrzebują tylko źródła, `push` tylko ujścia; typy
powiedzą kompilatorem, która komenda czego wymaga. Zmiana w
`packages/core/src/ports/sync.ts`, adapter intervals.icu implementuje oba.

**Paczka.** `trainctl-sync-files` (szósta paczka, ten sam szablon manifestu
co `trainctl-sync-intervalsicu`): 

- `fit.ts`: dekoder **plików aktywności** FIT (dziś mamy tylko koder
  treningów w `trainctl-export/fit.ts`): nagłówek, rekordy definicji
  i danych, little/big endian, CRC; interesują nas komunikaty `session`
  (sport, sub_sport, start_time, total_distance, total_timer_time,
  total_elapsed_time, avg_heart_rate, total_ascent) i `file_id`; `record`
  tylko gdy brak `session` (suma z punktów). Bez SDK Garmina (ADR-017 —
  ta sama logika co przy koderze).
- `tcx.ts`: XML bez zależności — minimalny parser elementów `Activity Sport`,
  `Lap StartTime`, `TotalTimeSeconds`, `DistanceMeters`, `AverageHeartRateBpm`.
- `gpx.ts`: `trkpt lat/lon/time`; dystans z haversine, czas z pierwszego
  i ostatniego punktu; sport z `type` albo heurystyka tempa (jawnie oznaczona
  jako wartość inżynierska, bez wpływu na kalibrację).
- `provider.ts`: `FileActivitySource({ dir })` czyta katalog (rekurencyjnie,
  `.fit/.FIT/.tcx/.gpx`), normalizuje do `SyncedActivity` (`externalId` =
  hash zawartości, `source: 'file'`), filtruje po `oldest/newest`.

**CLI/MCP.** `trainctl.yaml`: sekcja `sync: { files: ./activities }`
(opcjonalna). `pull --from <katalog|plik>` jednorazowo; `review` i `adapt`
czytają z `sync.json` jak dotąd — `writeSnapshot` scala po `externalId`,
więc źródła mogą współistnieć (klucz + katalog). `status` (B7) pokazuje
źródła.

**Testy.** Fixture'y **syntetyczne**: generator testowy FIT (session + file_id)
w `fit.test.ts`, ręcznie napisane TCX/GPX; weryfikacja dekodera FIT na
pliku z niezależnego kodera (np. zapisany trening z `trainctl-export` jako
kontrola CRC/nagłówka) — bez realnych aktywności użytkownika w repo.
`execution.ts` bez zmian (`isRunningActivity` po `type`) — test, że FIT z
`sport=running` wpada, `cycling` nie, a plik bez dystansu daje `dataWithheld`.

**Docs.** `docs/integrations/files.md`: skąd wziąć pliki (Garmin Connect
eksport aktywności, Coros, Polar Flow), ograniczenia (brak wellness, brak
RPE), prywatność (pliki zostają lokalnie; `activities/` do `.gitignore`
przez `init`? — **tak**, pliki aktywności zawierają trasy GPS).

### D2. intervals.icu głębiej

- **Starty jako zdarzenia startowe.** Cel A i `tuneUpRaces` wysyłane
  z `category: RACE_A | RACE_B | RACE_C` zamiast `WORKOUT` (intervals.icu
  rozpoznaje je w kalendarzu i wykresie formy). Wymaga weryfikacji na żywym
  koncie: czy `events/bulk?upsert=true` przyjmuje te kategorie i czy
  `external_id` działa tak samo (prefiks `trainctl-` i kasowanie — ADR-016
  bez zmian). Wynik do `docs/integrations/intervalsicu.md` §2c.
- **Siła jako osobne zdarzenie** (`type: WeightTraining`, opis sesji,
  `moving_time` = `durationMin`), nadal nie jako trening biegowy (ADR-023).
  `toPushableWorkout` dostaje drugą funkcję `toPushableStrength`;
  `PushableWorkout.sport` rozszerzony o `'strength'`.
- **Cel czasu** obok `distance_target`: `moving_time` z `estimateWorkoutMinutes`
  (pole do zweryfikowania w Swaggerze).
- **Test:** `provider.test.ts` na nagranych odpowiedziach; `workout-syntax.test.ts`
  dla siły; e2e lokalnie z posprzątaniem konta.

### D3. Wellness i RPE z huba cytowane w przeglądzie (zgodnie z ADR-027)

- `sync.json` ma `wellness` (tętno spoczynkowe, HRV, sen, masa, CTL/ATL)
  i `activities[].rpe` (`icu_rpe`) — nic ich nie pokazuje.
- `review`: sekcja „Kontekst z zegarka" — per dzień okna: tętno spoczynkowe,
  sen (h:mm), masa jeśli jest; **bez progów, średnich i wniosków**, dokładnie
  jak sekcja „Jak się biegało". RPE z huba w „Jak się biegało" tylko gdy
  dziennik nie ma RPE dla tej daty, z etykietą źródła („RPE 6 · intervals.icu").
  CTL/ATL **nie** pokazujemy (P-4: deskryptory, nie guardraile — a pokazane
  obok planu zaczną sterować decyzjami).
- **Test:** `review.test.ts` — snapshot z wellness → sekcja; bez → brak sekcji;
  RPE z dziennika wygrywa nad hubem.

### D4. Zamknięcie etapu

CHANGELOG 0.5.0; SPEC: ADR-037 (port rozdzielony, adapter plikowy), §7
„Integracje" (druga ścieżka), §9 (ryzyko zależności — zmitygowane);
`packaging.test.ts` i job `dist` obejmują szóstą paczkę; `SECURITY.md`
(„jeden host wyjściowy" nadal prawdziwe — pliki nie wychodzą).

**DoD etapu D:** `pull --from ./activities` na syntetycznych FIT/TCX/GPX daje
`sync.json` zgodny z tym z intervals.icu dla tych samych danych; `review`
działa bez klucza na plikach; starty i siła widoczne w kalendarzu intervals.icu
(próba e2e z datą w docs); wellness w przeglądzie wyłącznie cytowane.

---

## 6. Etap E — silnik: najpierw nauka, potem kod (0.6.x)

Każdy podetap zaczyna się od FOUNDATIONS (nowe reguły albo jawne „wartość
inżynierska") i, gdzie to możliwe, od pomiaru w korpusie (`tools/corpus/`).
Podetapy są niezależne — mogą wyjść jako 0.6.0, 0.6.1 … w kolejności
gotowości. Backtest (`backtest.test.ts`) ma zostać Δ0 dla akcentów i sesji.

### E1. Budżet czasu tygodnia w generatorze

- **Dziś:** budżety minut tylko per data w `reschedule --time` i `shorten`;
  generator planuje w km, a biegacz zza biurka ma ograniczenie w minutach.
- **Nauka:** reguła E-1 (odcięcia inżynierskie skracania) już istnieje;
  dodać E-2 „plan mieści się w zadeklarowanym czasie" jako wartość inżynierską
  (konwersja km → min po tempie easy z `estimateWorkoutMinutes`, z zapasem
  przygotowania 15 min jak w `shorten`).
- **Config:** `athlete.time: { weeklyMinutes?, weekday?: minutes, weekend?: minutes }`
  (walidacja w `config.ts`).
- **Silnik:** `macrocycle.ts` — `targetKm` ograniczone przez czas (sufit
  obok `peakWeeklyKm`), z `feasibilityWarnings` gdy rekomendowana objętość
  dla dystansu (P-7/P-8) nie mieści się w czasie; `microcycle.ts` — rozkład
  dni z limitem minut per dzień używa istniejących wariantów z `shorten.ts`
  zamiast nowych konstrukcji.
- **Testy:** `time-budgets.test.ts` — profil 45 km z 4 h tygodniowo → plan
  mieści się w czasie, lint I-5 trzyma ≥ 75 % easy, ostrzeżenie o niewykonalnej
  objętości rekomendowanej; backtest Δ0 bez sekcji `time`.

### E2. Życie po starcie: blok przejściowy i następny cel (kandydat ADR-038)

- **Dziś:** makrocykl kończy się tygodniem celu; dzień po starcie `today`
  mówi „poza planem", `adapt` odmawia propozycji przy `post-race-recovery`.
- **Nauka:** FOUNDATIONS R-1/R-2 (protokół po starcie) istnieją; zmierzyć
  w korpusie, jak trener planował 2–3 tygodnie po startach A (`tools/corpus/`
  — nowy skrypt `post_race_profile.py` w stylu `long_run_profile.py`):
  objętość względem ostatniego tygodnia budowania, liczba sesji, kiedy wraca
  pierwszy akcent. Wynik → reguły R-3…R-5 albo jawnie inżynierskie.
- **Silnik:** `macrocycle.ts` dokłada `transition` (nowa `MacroPhase`) —
  2–3 tygodnie po starcie: tylko easy, objętość wg korpusu/R-x, zero akcentów,
  siła wraca od drugiego tygodnia (F-13 analogicznie do taperu). Kompilator
  wskaże wszystkie switche po `MacroPhase` (lint, PLAN.md, eksport, i18n).
- **CLI:** `today` w bloku przejściowym pokazuje cel bloku i podpowiedź
  „następny cel: edytuj `goal` w trainctl.yaml → `trainctl plan`" (B1
  zachowa historię); `plan` z nowym celem i datą startu w przeszłości
  zaczyna progresję od `loadState`/ostatnich tygodni, nie od `recentWeeklyKm`
  z configu (jawny wybór w `why`).
- **Testy:** `macrocycle.test.ts` (długość i kształt bloku, brak akcentów),
  `validate.test.ts` (nowe stany dozwolone), `commands.test.ts` (sekwencja
  start → log → `plan` z nowym celem → historia nietknięta), backtest Δ0.

### E3. Plan bez zawodów: tryb bazowy (kandydat ADR-039)

- **Dziś:** `loadConfig` wymaga `goal` z datą i dystansem; predykcja, pakiet
  startowy, taper i „dni do startu" zakładają start.
- **Config:** `goal: { kind: base, weeks: 12 }` albo `{ kind: base, until: "2027-03-01" }`
  (jedno z dwóch); `distanceKm` i `date` niewymagane; `tuneUpRaces` dozwolone.
- **Silnik:** `macrocycle.ts` — wyłącznie faza `base` z deloadem co czwarty
  tydzień (P-1), bez taperu, bez tygodnia startowego; progresja do
  `peakWeeklyKm` albo plateau po jego osiągnięciu; sprawdzian jako fallback
  kalibracji (W-11…W-13) co ~6 tyg. zostaje, bo bez startów nie ma innego
  źródła VDOT. Reguły T-* nieaktywne — lint musi to wiedzieć
  (`validate.ts`: zestaw kontroli zależny od `goal.kind`).
- **Interfejsy:** `plan` bez sekcji „Predicted finish"; `today`/`week`/`review`
  bez „dni do startu" (w zamian „tydzień N z M bazy"); `export --what race`
  odmawia z czytelnym komunikatem; `PLAN.md` i oba README z przykładem.
- **Testy:** macierz w `macrocycle.test.ts`; `check.test.ts` (brak fałszywych
  ostrzeżeń T-*); `export.test.ts` (odmowa pakietu startowego);
  `no-leaks.test.ts`.

### E4. Siła: dziennik i warianty

- **Dziś:** `strengthSession()` zwraca stałe 35 min i jeden opis; brak
  logowania; `review` nie liczy wykonania siły.
- **Nauka:** F-1…F-4 (dawkowanie 2×/tydz., ciężko, niska liczba powtórzeń)
  wystarczają na 2–3 warianty treści per faza (base: nauka wzorców; build/peak:
  ciężko 3–5 powtórzeń; bez taperu — F-13). Warianty to **house choice**
  oznaczony jako inżynierski — korpus nie zawiera siły.
- **Dziennik:** `LogEntry.strength?: { status: 'done'|'skipped', minutes?, note? }`;
  `log --strength done --minutes 30` (CLI), `strength: {...}` (MCP).
  `buildExecution` zostaje biegowe; `review` dostaje linię „siła: 1/2 sesji"
  — liczba, bez wniosków.
- **Testy:** `strength.test.ts` (warianty per faza, S-5/F-13 nienaruszone),
  `commands.test.ts` (log siły w dzień bez biegu i w dzień z biegiem),
  `review.test.ts`.

### E5. `terrain` w kalibracji

- **Dziś:** `RaceResult.terrain` i `RaceGoal.terrain` istnieją, `inspectCalibration`
  ich nie widzi; wynik z trailu podnosi/zaniża VDOT do stref szosowych.
- **Decyzja minimalna i uczciwa:** wyniki `terrain: trail` **nie kalibrują**
  stref szosowych (polityka `best-vdot-540-days` dostaje powód `terrain`),
  chyba że nie ma innych — wtedy używane z ostrzeżeniem w `why`. Bez
  przeliczników (brak dowodu w FOUNDATIONS — dopisać do §11 „unverified").
- **Testy:** `daniels.test.ts`/`calibration` — wybór wyniku z mieszanej listy;
  `coach-flows.test.ts` — `why` pokazuje powód.

### E6. Zamknięcie etapu

CHANGELOG per wydanie 0.6.x; FOUNDATIONS §10 (nowe reguły E-2, R-3…R-5,
oznaczenia inżynierskie), §11; SPEC: ADR-038, 039, tabela §8, „znane
uproszczenia" (skreślić: brak życia po starcie, brak trybu bez zawodów);
README „Configuration" (sekcje `time`, `goal.kind`, `log --strength`).

**DoD etapu E (całości):** profil bez startu generuje plan bazowy, który
przechodzi `check`; plan z celem kończy się blokiem przejściowym, a zmiana
celu zachowuje historię (B1); budżet czasu ogranicza objętość z jawnym
ostrzeżeniem; siła ma dziennik; backtest Δ0; każda nowa stała ma ID albo
etykietę inżynierską.

---

## 7. Kandydaci ADR (następny wolny numer: 033)

| # | Decyzja (skrót) | Sedno uzasadnienia |
|---|---|---|
| 033 | `plan` na istniejącym planie = **regeneracja chroniona**: przeszłość, dziennik, piny i `loadState` zostają; pełne nadpisanie tylko z `--fresh`; `diff` pokazuje tę samą regenerację | dokumentowana ścieżka „nowy wynik → plan" kasowała zatwierdzone decyzje; ochrona z ADR-029 obowiązywała propozycje, nie regenerację — to była luka, nie wybór |
| 034 | Zegar symulacji `TRAINCTL_TODAY` jest **jawny i widoczny** w każdym wyjściu; propozycje noszą datę, pod którą powstały | A05 słusznie oddzielił selekcję tygodnia od zegara, ale bez sankcjonowanej symulacji dokumentacja i próby ręczne stały się niemożliwe; cicha symulacja byłaby powtórką problemu A05 |
| 035 | `--json` zwraca `CmdResult.data` — ten sam kształt, który dostaje MCP (`structuredContent.data`); stabilność kontraktu ograniczona do pól używanych przez MCP do 1.0 | jedno źródło danych dla agenta i skryptów; drugi format wyjścia bez drugiej logiki (ADR-013) |
| 036 | Plugin Claude Code/Codex jest **kanałem dystrybucji**, nie nową logiką: skille generowane z tych samych rytuałów co `AGENTS.md`; `init` zapisuje pliki agenta tylko na jawną flagę | dryf między AGENTS.md a skillami zrobiłby dwie persony; cicha konfiguracja agenta w repo użytkownika łamie zasadę „nic bez pytania" (ADR-019) |
| 037 | Port sync rozdzielony na źródło aktywności i ujście treningów; adapter plikowy FIT/TCX/GPX jako druga implementacja źródła | zapowiedziana mitygacja ryzyka §9; pull-only adapter w porcie z metodami push to kłamstwo typów |
| 038 | Makrocykl kończy się **blokiem przejściowym**, nie tygodniem startu; kształt bloku z korpusu albo jawnie inżynierski | narzędzie, które milczy dzień po starcie, zostawia biegacza w najgorszym momencie; R-1/R-2 już opisują protokół — brakowało miejsca w planie |
| 039 | `goal.kind: base` — plan bez zawodów na N tygodni; reguły T-* nieaktywne, sprawdzian jako jedyne źródło kalibracji | większość tygodni roku nie ma celu; wymuszanie fikcyjnego startu produkowałoby fikcyjny taper |
| 040 | `--commit` to opcjonalne domknięcie historii gita po udanym zapisie; narzędzie nigdy nie commituje samo i nigdy sekretów | AGENTS.md każe commitować po każdej zmianie — flaga robi to, co i tak jest zalecane, bez stawania się klientem gita |

---

## 8. Backlog — świadomie POZA zakresem (nie zaczynać bez decyzji)

- **Repertuar zależny od celu i doświadczenia** (5 km vs maraton poza
  objętością i taperem; długie z członami tempa — korpus: 29 % to **krótszy**
  wzorzec, nie „długie z dodatkiem"). Warunek wstępny: pomiar w korpusie
  i reguły w FOUNDATIONS; bez tego to dokładanie konstrukcji „bo tak się robi".
- **Kalibracja VDOT w backteście** z wyników użytkownika zamiast wartości
  inżynierskiej 51 (znane uproszczenie).
- **Subskrybowany kalendarz** (ICS pod URL-em) — wymaga hostingu, sprzeczne
  z local-first; zostaje eksport pliku, ewentualnie regeneracja `export/`
  po każdym `--apply`.
- **Szósta paczka pluginu na npm** jako alternatywne źródło marketplace —
  tylko jeśli marketplace z repo okaże się niewystarczający.
- **REST API / hosting / inne sporty** — jak w SPEC §8 „dalej".
- **Odrzucone na stałe** (analiza 2026-08-05, bez zmian): autopilot HRV /
  gotowość (H-1, §11), streaki i gamifikacja, pogoda z sieci (ręczne
  `--temp` dla pakietu startowego już jest), przebieg butów, metryki
  ryzyka urazu (N-1…N-3), zamiana odczuć na liczby (ADR-027).

---

## 9. Ryzyka tego planu

- **Ekosystemy pluginów zmieniają się szybko.** Fakty z etapu C są z
  2026-10-21; przed implementacją powtórzyć weryfikację (szczególnie Codex:
  format `.mcp.json` ze stdio i cwd serwera). Mitygacja: testy pluginu
  sprawdzają strukturę plików, nie zachowanie agentów; próby ręczne
  zapisane z datą.
- **B1 zmienia zachowanie komendy, którą użytkownicy znają.** Mitygacja:
  wpis „Changed" w CHANGELOG, komunikat w wyjściu `plan` przez jedno wydanie
  („od 0.4.0 `plan` chroni przeszłość; `--fresh` przywraca stare zachowanie").
- **Dekoder FIT to nowa powierzchnia błędów** na plikach z dziesiątek
  urządzeń. Mitygacja: `session` jako jedyne źródło prawdy, `record` tylko
  jako fallback; plik niezrozumiały → `dataWithheld` z nazwą pliku, nigdy
  zgadywanie dystansu.
- **Etap E rośnie.** Każdy podetap ma własne DoD i może wyjść osobno;
  żaden nie blokuje A–D.
- **Dokumentacja znów odjedzie.** Mitygacja: `docs.test.ts` (A7/A8/A11)
  i generator skilli (C2) zamieniają uzgodnienie w test, nie w pamięć.
