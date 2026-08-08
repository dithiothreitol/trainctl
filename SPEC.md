# trainctl — coach treningowy dla ludzi żyjących w terminalu

> Plan treningowy jako kod, trener jako narzędzie agenta.

**Status:** **Fazy 0–13 ZAKOŃCZONE** (2026-08-07). Pięć pakietów: silnik (`trainctl-core`) + CLI (`trainctl`, 16 komend, kolorowy TUI, dwujęzyczny) + serwer MCP (`trainctl-mcp`, 16 narzędzi) + sync intervals.icu (`trainctl-sync-intervalsicu`) + eksport (`trainctl-export`: FIT/ICS/wydruk/pakiet startowy); **552 testy**, w tym smoke prawdziwych binarek pod natywnym Node i backtest na korpusie (7 testów, pomijają się bez korpusu). Wydanie 0.1.0 przygotowane: nazwy npm bez scope'u, README każdego pakietu, CI na GitHub Actions (Linux + Windows, Node 22.18 i 24), pliki społecznościowe; **repozytorium publiczne od 2026-08-07 (MIT, tag v0.1.0); paczki npm czekają na `npm login` + `pnpm publish -r`** — stan i decyzje: `docs/PUBLISHING.md`.

**Sync zweryfikowany e2e na żywym koncie 2026-08-05** (szczegóły: `docs/integrations/intervalsicu.md` §2a) — składnia treningów parsowana poprawnie, cele tempa zapisane, idempotencja działa. Otwarte: dostarczenie na fizyczny zegarek — wymaga zegarka spiętego z intervals.icu **bezpośrednio**, nie przez Stravę (§1.8.1). Dalej: kolejne sporty (`SportModule`), REST API/hosting.

**Nazwa:** `trainctl` — zdecydowana przy rename całego projektu (2026-08-06); wolna na npm i GitHubie w chwili sprawdzenia.

## 1. Wizja

Aplikacja generująca i adaptująca plany treningowe (v1: bieganie), której interfejsem
jest CLI oraz serwer MCP — a nie appka mobilna. Grupa docelowa: ludzie spędzający
wiele godzin dziennie z agentami kodującymi (Claude Code, Codex). Rozmowa z trenerem
odbywa się tam, gdzie użytkownik i tak siedzi: w terminalu i w agencie.

Nie konkurujemy z Runną/Garminem na „inteligencję planu" — konkurujemy na **miejsce
w workflow** i **przejrzystość**: plan jest plikiem w repo, adaptacja jest diffem
z uzasadnieniem, a renegocjacja tygodnia to jedna komenda/jedno zdanie do agenta.

## 2. Filary produktu

1. **MCP-first, nie chat-first.** Silnik + serwer MCP + CLI. Nie budujemy UI czatu —
   konwersację zapewnia agent użytkownika. Przykładowe interakcje: „co mam dziś
   wybiegać?", „przesuń interwały, w czwartek release", „czemu ten trening?".
2. **Plan-as-code.** Plan = pliki YAML/Markdown, wersjonowane gitem, diffowalne.
   Każda adaptacja ma uzasadnienie (np. „obniżam objętość 20%: 3 dni ciszy po starcie
   na 100 km"). Zero czarnej skrzynki.
3. **Renegocjacja jako operacja pierwszej klasy.** ✅ `core/solver/reschedule.ts`
   + `trainctl reschedule --block <dni>` / `trainctl_reschedule`: pełny przegląd układów
   tygodnia z funkcją celu (S-1 ≥48 h między akcentami, S-2 chroń długie,
   S-3 zachowaj liczbę akcentów, S-9 różnicuj obciążenie, house style jako
   preferencja). Twarde: dzień startu stoi, dzień przed startem lekki, dni
   zablokowane puste. Gdy miejsc brakuje — poświęca wg ustalonej kolejności
   (easy → hills → sharpener → akcent ciągły → interwały → długie) i **nazywa
   każdy kompromis**. Domyślnie podgląd; `--apply` zapisuje. Zostawanie na
   miejscu waży więcej niż preferencje dni: to renegocjacja, nie reoptymalizacja.
4. **Świadomość biurka.** Okna treningowe (lunch vs wieczór), przerwy ruchowe między
   sesjami z agentem („exercise snacks") i — najważniejsze — reguła prowadzenia
   akcentu po dniu ciężkiej pracy umysłowej: **po tempie, nie po odczuciu**
   (zmęczenie kognitywne obniża wytrzymałość o ~15% wyłącznie przez percepcję,
   przy niezmienionym tętnie, laktacie i VO₂). To jedyna funkcja w tej kategorii
   z twardym dowodem — reszta „wellness dla programistów" to folklor, który
   świadomie odrzucamy (B-1/B-2/B-6).

## 3. Zakres

**v1 (serce: coach w agencie):** intake → plan biegowy pod zawody/cel → mikrocykle
tygodniowe → „co dziś" → log wykonania → renegocjacja → adaptacja. Local-first,
bez konta, dane wyłącznie w plikach (ADR-007; SQLite rozważane, nie okazało się
potrzebne — migawka sync to `sync.json`).

**Poza v1 (kolejność wg faz):** sync intervals.icu, adaptacja w pętli na danych
z zegarka, tryb biurkowy, kolejne sporty (triathlon — korpus już go zawiera),
REST API / hosting.

## 4. Architektura

Monorepo TypeScript (pnpm workspaces), architektura portów i adapterów:

```
trainctl/
├─ packages/
│  ├─ core/              czysta logika domenowa, ZERO I/O
│  │   ├─ domain/        Athlete, Workout, Microcycle, Macrocycle, Race
│  │   ├─ engine/        generator planu, periodyzacja, adaptacja, siła, walidacja (check)
│  │   ├─ solver/        renegocjacja tygodnia (constraints)
│  │   ├─ zones/         VDOT / critical speed → strefy temp; predykcja; upał
│  │   ├─ i18n/          locale, katalogi domenowe en/pl
│  │   └─ ports/         SyncProvider (interfejsy)
│  ├─ cli/               16 komend: init|plan|today|week|log|shift|why|adapt|desk|
│  │                     push|pull|export|reschedule|review|diff|check (cienki adapter;
│  │                     storage = pliki na cwd: trainctl.yaml, plan/, log.jsonl — ADR-007)
│  ├─ mcp/               serwer MCP, 16 narzędzi — te same handlery co CLI (ADR-008)
│  ├─ sync-intervalsicu/ adapter SyncProvider (hub → Garmin/Coros/Wahoo)
│  └─ export/            FIT (zegarek), ICS (kalendarz), HTML (wydruk, pakiet startowy)
├─ tools/corpus/         ETL korpusu (Python, narzędzia jednorazowe — nie produkt)
├─ corpus/               dane źródłowe i pochodne (PII → gitignore!)
└─ docs/
   ├─ science/           fundament naukowy z cytowaniami (faza 0 + korekty korpusowe)
   ├─ integrations/      intervals.icu: weryfikacje, ograniczenia (Strava §1.8.1)
   ├─ examples/          CI (ci-check), trener-reviewer (coach-review), Actions review
   └─ adr/               decyzje architektoniczne

Docelowo (poza v1): sport-running/ jako plugin portu SportModule — dziś logika
biegowa mieszka w core, port powstanie razem z drugim sportem, nie wcześniej.
```

**Zasady modularności** (uzasadnienie wyboru stacku — patrz ADR-001):

- Nowy sport = nowy pakiet implementujący `SportModule` (model stref, słownik
  jednostek treningowych, metryki obciążenia, predyktory wyniku). `core` nie wie,
  czym jest bieganie.
- Nowa integracja = nowy adapter `SyncProvider`. `core` nie zna intervals.icu.
- CLI i MCP to bliźniacze, cienkie adaptery nad wspólną warstwą use-case'ów —
  każda operacja dostępna z obu.
- LLM wyłącznie na brzegach (parsowanie korpusu, NLG uzasadnień, konwersacja
  przez MCP). Rdzeń deterministyczny, w pełni testowalny.

## 5. Silnik i warstwa naukowa

**Deterministyczny rdzeń + LLM na brzegach.** Generowanie planów czystym LLM-em
łamie ograniczenia fizjologiczne (progresje, regeneracja) — periodyzacja to kod
z testami.

Fundament v1 — **zweryfikowany 2026-08-04**, pełne cytowania i parametry:
`docs/science/FOUNDATIONS.md` (sekcja 10 = reguły → kod, per pakiet; sekcja 10.12 =
anty-wzorce; sekcja 11 = czego nie potwierdzono). Najważniejsze korekty względem
pierwotnych założeń:

- **Rozkład intensywności: piramidalny → polaryzacja przed startem** (RCT Filipas
  2022), nie „80/20 od początku"; u amatorów polaryzacja nie poprawia wyniku
  (meta Silva Oliveira 2024), a „szara strefa" nie jest zakazana (Festa 2020).
- **Progresja: falująca + tydzień odciążenia co 4 tyg.** (Costa 2019, ΔVO₂max
  +22% vs liniowa). **Reguła 10% i ACWR wylatują z guardraili** (Buist 2008;
  Impellizzeri 2020) — zostaje klasyczne przeciążenie progresywne + sufit
  długiego ~35 km (Fokkema 2020).
- **Kalibracja stref: z wyników startów, nie z zegarka** (zegarki zawyżają tempo
  progowe o 1–2 km/h, Lu 2025); progi zależne od płci (Nuuttila 2025); kotwica:
  prędkość, nie HR/RPE.
- **Predykcja: VDOT/Riegel z korektą na wolniejszych biegaczy** (błąd VDOT 10,4%
  przy sub-5:00, Oficial-Casado 2025); durability kalibrowana z historii startów
  (rozrzut indywidualny 1–31%, Hunter 2025).
- **Taper: ciąć objętość, utrzymać intensywność I częstotliwość** (Wang 2023);
  strict 3-tyg. taper ≈ −2,6% na maratonie (Smyth 2021). Po maratonie: powrót
  48 h, 40 min @LT1 (Martínez-Navarro 2021).
- **Tryb biurkowy dostaje twardy fundament**: zmęczenie umysłowe obniża
  wytrzymałość ~15% wyłącznie przez percepcję wysiłku (Marcora 2009) → po dniu
  ciężkiej pracy kognitywnej preskrypcja po tempie, nie po RPE.
- **HRV-guided: zdegradowane poniżej fazy 5** — 3 z 4 meta-analiz nie wykazują
  przewagi; wartość to mniej sesji jakościowych przy tym samym wyniku, nie lepszy
  wynik.

## 6. Korpus (przewaga niekopiowalna)

50 miesięcznych planów od trenera z lat 2020–2025 (Word), dla jednego zawodnika
(Dariusz). Struktura: tygodniowe tabele PN–ND, precyzyjne tempa/km, słownik:
bieg spokojny, tempo narastające, bieg zmienny, interwały (drabinki 1000/400/200 m),
podbiegi 15×100–200 m, „1 km truchtu" na koniec, wplecione starty (Falenica, ZUK,
triathlony, Rzeźnik, 100 km, Łemkowyna), taper i roztrenowanie.

Zastosowania:
1. **Biblioteka jednostek + house style** generatora (wzorce tygodnia, proporcje
   akcentów, progresje, polska frazeologia treningowa).
2. **Backtest generatora**: dla kalendarza startów z sezonu X plan wygenerowany
   ma być strukturalnie zbliżony do trenerskiego (mierzalna ewaluacja).
3. **Baseline atlety**: historia obciążeń użytkownika jako start kalibracji.

**PII:** pliki zawierają imię i nazwisko — katalog `corpus/` jest w `.gitignore`,
nigdy nie trafia do publicznego repo. Ekstrakcja: `tools/corpus/extract_text.py`
(50/50 plików → `corpus/raw-text/`).

## 7. Integracje

**Decyzja: intervals.icu jako hub** (ADR-002, **zweryfikowana 2026-08-04** —
szczegóły i linki: `docs/integrations/intervalsicu.md`). Stan po weryfikacji:

- **Potwierdzone**: API darmowe, self-service API key (Basic auth), limity
  5000/dzień — rzędy wielkości ponad potrzeby CLI jednego atlety; endpointy
  activities/wellness/events; natywny tekstowy format kroków treningu wspiera cele
  tempa biegowego (`5:00/km Pace`, `Z2 Pace`) przez `POST /events/bulk`;
  **push do Garmin Connect jako trening strukturalny na zegarku — potwierdzony
  wprost**. Pętla „plan w CLI → trening na zegarku → wykonanie wraca → adaptacja"
  jest realna.
- **Korekty zakresu**: Strava wypada z listy platform huba — intervals.icu od
  XII 2024 sam nie re-eksportuje danych Stravy przez własne API (restrykcje Stravy
  XI 2024 + kolejna fala VI 2026, wymierzona wprost w „AI przez pośredników").
  Polar: tylko pull aktywności, bez push treningów. Push do Coros/Wahoo/Suunto —
  zgłaszany jako działający, słabiej potwierdzony niż Garmin.
- **Model v1**: BYO API key użytkownika (self-service). OAuth dla wersji multi-user
  wymaga maila do autora serwisu — odkładamy do czasu wyjścia poza BYO-key.

Bezpośrednia integracja Strava — potwierdzona jako pole minowe (od VI 2026
dodatkowo płatny tier deweloperski). Garmin developer program — omijamy hubem.

## 8. Fazy

Każda faza kończy się: testami, aktualizacją SPEC/planu, wpisem do pamięci,
czystym zamknięciem sesji.

| Faza | Zakres | Definition of Done |
|------|--------|--------------------|
| **0** | Scaffold, ETL korpusu, research naukowy, taksonomia jednostek, ADR-y | ✅ KOMPLET: scaffold+ETL · docs/science (60 źródeł) · taksonomia + parser → JSON (100% pokrycia, 39 testów) · weryfikacja API intervals.icu |
| **1** | Model domeny + silnik generacji (intake → makro → mikrocykle) | ✅ KOMPLET (2026-08-05): monorepo TS + `trainctl-core` · strefy (VDOT D-G, CS) · predykcja W-1…W-10 · makrocykl I/P/T · mikrocykle w house style (profil z korpusu: `style_profile.py` → `house-style.ts`; sesje = objętość/14 km) · **backtest HM 2025: objętość 1,04, akcenty Δ0, sesje Δ0** — 64 testy vitest + typecheck |
| **2** | CLI na rdzeniu | ✅ KOMPLET (2026-08-05): `trainctl` — init/plan/today/log/shift/why/diff działają e2e (16 testów na realnych plikach + smoke bin); storage = pliki (`trainctl.yaml`, `plan/plan.yaml`+`PLAN.md` w stylu trenera, `log.jsonl`); shift z ochroną dnia startu i ostrzeżeniem I-7; why cytuje reguły; diff = dry-run regeneracji |
| **3** | Serwer MCP + scenariusze agentowe | ✅ KOMPLET (2026-08-05): `trainctl-mcp` — 8 narzędzi (`trainctl_init/plan/today/week/log/shift/why/diff`) nad wspólnymi handlerami z `trainctl` (ADR-008); katalog treningowy przez env `TRAINCTL_DIR`/cwd; walidacja wejść zod; testy scenariuszy agentowych in-memory (client↔server): generacja, why, renegocjacja week→shift→week, ochrona dnia startu, log |
| **4** | Sync intervals.icu | ✅ KOMPLET + ZWERYFIKOWANY E2E (2026-08-05): `trainctl-sync-intervalsicu` (port `SyncProvider` w core, ADR-002) — Basic auth `API_KEY:<klucz>`, pull aktywności/wellness (oba warianty casingu pól), push przez `events/bulk?upsert=true` z natywną składnią „steps" i celami tempa; CLI `push`/`pull` + narzędzia MCP; `pull` porównuje wykonanie z planem. **E2E potwierdzony na żywym koncie** (§2a docs): type=Run, cele tempa, bloki Nx, idempotencja, DELETE. Zostało: dostarczenie na fizyczny zegarek (konto spięte z Garminem) |
| **5** | Adaptacja w pętli + tryb biurkowy | ✅ KOMPLET (2026-08-05): `engine/adapt.ts` — diagnoza z sync+dziennika (zgodność objętości, pominięte akcenty, przerwa ≥10 dni → restart ×0,55, protokół po starcie R-1/R-2 z jawnym brakiem danych dla ultra, rekalibracja po nowym wyniku); **propozycje, nie automatyczny re-plan** (ADR-011). `engine/desk.ts` — okna treningowe wokół pracy, przerwy z chodzeniem (B-3/B-4/B-5), reguła S-8/B-10 (po ciężkim dniu kognitywnym prowadź akcent po tempie, nie po RPE) + jawne odrzucenie folkloru B-1/B-2. CLI `adapt`/`desk`, MCP `trainctl_adapt`/`trainctl_desk` (razem 12 narzędzi) |
| **6** | Profil z historii: `trainctl init --from-intervals` | ✅ KOMPLET (2026-08-05): `engine/infer-profile.ts` — mediana 4 pełnych tygodni z okna 16 tyg., dni treningowe z rozkładu biegów, dzień długiego wybiegania, kandydaci na starty (dystans standardowy + nazwa/tempo w górnym decylu), caveaty (przerwa ≥10 dni, dziury urlopowe, <4 aktywne tygodnie → jawne „za mało danych"). CLI: flaga + kreator z domyślnymi odpowiedziami i sparkline objętości; MCP: `trainctl_init(fromIntervals)` z wstrzykiwaną fabryką providera. **Wartości mają proweniencję w YAML; kandydaci na wyniki nigdy nie są zapisywani bez potwierdzenia (ADR-019).** 21 nowych testów; e2e na żywym API — konto puste, ścieżka błędu potwierdzona (§2b docs) |
| **7** | Kalibracja formy: starty kontrolne B/C + sprawdzian jako fallback | ✅ KOMPLET (2026-08-05): **korpus obalił hipotezę planu** — trener w 1231 dniach **ani razu** nie zaplanował sprawdzianu; kalibruje prawdziwymi startami (45 startów, mediana odstępu 28 dni, 80% w sobotę, 76% z wolnym dniem przed). Stąd: `athlete.tuneUpRaces` w trainctl.yaml → mini-taper T-9 (−20%, makrocykl bez zmian), wolne przed (T-10), długie nazajutrz (T-11), start = akcent tygodnia (T-12). `WorkoutKind: 'test'` **tylko jako fallback** przy pustym kalendarzu (W-11…W-13), bez celu tempa w eksporcie (ADR-020). Pętla domknięta: wykonany pomiar bez wyniku w `results` → propozycja z gotowym wpisem YAML. **Backtest: 6/6 startów trenera odwzorowanych co do dnia**, objętość 1,04, Δakcentów 0, Δsesji 0. 36 nowych testów (312 łącznie) |
| **8** | Rytuał tygodniowy + onboarding agenta | ✅ KOMPLET (2026-08-05): `trainctl review` / `trainctl_review` (**15 narzędzi MCP**) — wykonanie vs plan, sygnały (tylko gdy są), nadchodzący tydzień z kluczową jednostką i ostrzeżeniem o starcie/sprawdzianie, lista działań. Read-only poza migawką; działa **bez klucza API** (dziennik + ostatnia migawka), błąd sieci nie wywraca przeglądu. Zero nowej logiki treningowej — kompozycja `pull`+`compare`+`adapt`+`week` (ADR-021). `trainctl init` tworzy `AGENTS.md` (persona trenera: rytuały, zasady, czego nie robić), nie nadpisując istniejącego. Przykład GitHub Actions **tylko w docs**, z jawnymi zastrzeżeniami. 14 nowych testów (326 łącznie) |
| **9** | Pakiet startowy: splity, papierowa opaska tempa, korekta na temperaturę | ✅ KOMPLET (2026-08-06): `export/racepack.ts` (splity dla 2–3 scenariuszy z predykcji W-1 + opaska do wycięcia na nadgarstek) i `core/zones/heat.ts` — model kwadratowy El Helou 2012 (**n=1,79 mln**) z krzywymi per poziom biegacza (H-1…H-8). Odmowa liczby powyżej 25 °C zamiast ekstrapolacji; rozróżnienie straty prędkości od kary czasowej (H-4); świadomy brak członów wilgotności/wiatru/słońca (N-27, N-28). `trainctl export --what race` |
| **10** | Siła 2×/tydz. obok biegania | ✅ KOMPLET (2026-08-06): `core/engine/strength.ts` — **opt-in** (`strength:` w trainctl.yaml), osobny tor obok `PlannedDay.workout` (siła nie wnosi km, nie idzie na zegarek, nie podlega solverowi biegowemu). Reguły F-1…F-4, F-13 (taper = zero siły), S-5 (nie <24 h przed akcentem; dzień przed **długim** wolno — bieg submaksymalny 24 h po sile nie cierpi). **Uczciwość w `why`**: uzasadnienie to ekonomia biegu (F-8), NIE prewencja urazów (F-9), z przyznaniem, że u 34–45 lat efekt jest nieistotny (F-15), a dowody kończą się na 1,5–10 km w laboratorium (F-17) |
| **11** | Przygotowanie do publikacji (bez publikowania) | ✅ KOMPLET (2026-08-06): LICENSE (MIT), `license`/`description` we wszystkich pakietach, `engines: >=22.18` (próg natywnego type-strippingu), [docs/PUBLISHING.md](docs/PUBLISHING.md) z decyzjami dla właściciela. Historia gita zweryfikowana: **zero plików korpusu w jakimkolwiek commicie**. Nazwa `trainctl` **wolna na npm** i na GitHubie (sprawdzone 2026-08-06); pierwotne `tren` było zajęte, stąd rename całego projektu |
| **12** | Wielojęzyczność: angielski domyślny, polski jako dodatkowy | ✅ KOMPLET (2026-08-06) — patrz niżej |
| **13** | Plan-as-code na serio: lint planu + scenariusze + współpraca przez git | ✅ KOMPLET (2026-08-07): **(a) `trainctl check`** — `core/engine/validate.ts`, 25 kontroli nad stanami końcowymi, które generator/solver już definiują (bez drugiej implementacji reguł): integralność pliku = **error** (sumy vs dni, daty vs pozycje, brak dnia startu — stany nieosiągalne przez narzędzie), odstępstwa metodyczne = **warn** (I-5, I-7, T-4, T-5, T-10, S-5, F-13 — osiągalne świadomą decyzją, `shift` ostrzega i pozwala); I-5 z podłogą generatora. CLI `check --strict`, MCP `trainctl_check` (16 narzędzi), CI w docs/examples/ci-check.md. **Lint od razu wykrył, że `reschedule --apply` nie przeliczał totalKm/easyShare po odpuszczonej sesji — naprawione wspólnym `weekTotals`.** **(b) `diff --plan <plik>`** — porównanie scenariuszowe dwóch pełnych planów (gałąź „co jeśli”/worktree/kopia): cel (nazwa, dystans, data, cel czasowy), VDOT, predykcja + tygodnie/dni po danych planu — rodzaj jednostki, objętość tygodnia i dnia, układ członów, siła; wspólny `diffWeeks` z trybem regeneracyjnym. Pusty albo obcięty plik planu to zdanie („to nie jest plik planu”), a w `check` — ustalenie lintu (`weeksMissing`/`goalMissing`), nie wyjątek. **(c) AGENTS.md** — sekcja „Koreluj to, co widzisz” (kalendarz/tracker/dyżury → `reschedule` przed konfliktem, `desk --heavy` po ciężkim dniu kognitywnym; zawsze nazwać sygnał, nigdy nie stosować bez zgody) + reguła „co jeśli = scenariusz, nie nadpisanie” + rytuał `check` po ręcznej edycji. **(d) docs**: sekcja „Plan as code” w obu README (gałęzie, CI, trener-reviewer, odtwarzalność), docs/examples/coach-review.md (tydzień przez PR). 48 nowych testów (544 łącznie; 552 po korekcie dystrybucji) |
| dalej | **Sezon na sobie** (weryfikacja w boju), zegarek fizyczny, REST API, kolejne sporty | bez decyzji użytkownika nie zaczynać |

### Faza 12 — wielojęzyczność (2026-08-06)

**Mechanizm gotowy i przetestowany.** `core/src/i18n/`: `resolveLocale`
(flaga `--lang` > `TRAINCTL_LANG` > `language:` w trainctl.yaml > `en`), `pluralPl`
(trzy formy, pułapka nastolatek 12–14, ułamki w dopełniaczu), `pluralEn`,
`formatNumber` (przecinek vs kropka dziesiętna), `formatDate` przez `Intl`.
Katalog **angielski jest źródłem typu** — brak klucza w polskim to błąd `tsc`,
zero bibliotek runtime. Opisy jednostek nie są kalką: polski niesie głos
trenera z korpusu („przerwy 2 minutowe w marszu"), angielski idiom biegowy
(„6 × 1 km @ 4:15/km, 2 min walk recovery").

| Warstwa | Stan |
|---|---|
| `trainctl-core` — silnik, diagnozy, reguły, opisy jednostek | ✅ |
| `cli/commands.ts`, `bin.ts` — handlery, komendy, flagi, `--help` | ✅ |
| `planfile.ts` — **plan/PLAN.md**, dokument, który czyta biegacz | ✅ |
| `config.ts` — szablon `trainctl.yaml` i komunikaty walidacji | ✅ |
| `agents-md.ts` — **AGENTS.md**, persona trenera dla agenta | ✅ |
| `rules-explain.ts` — 29 objaśnień reguł + 8 celów jednostek | ✅ |
| `mcp/server.ts` — opisy narzędzi i parametrów dla agenta | ✅ |
| `interactive.ts`, `ui/wizard.ts`, `ui/select.ts`, `ui/blocks.ts` | ✅ |
| `trainctl-export` — nazwy kroków FIT, rozpiska HTML, pakiet startowy, ICS | ✅ |
| `trainctl-sync-intervalsicu` — tytuły treningów w kalendarzu, błędy API | ✅ |
| wybór języka + dziedziczenie przez MCP | ✅ (sprawdzone na prawdziwej binarce) |

Renderery w `trainctl-export` **nie znają katalogu** — dostają napisy przez
`PrintLabels` / `RacePackLabels`, więc pakiet zostaje czystym generatorem HTML.

`trainctl init --lang pl` zapisuje `language: pl` w `trainctl.yaml` odkomentowane:
katalog treningowy pamięta wybór i mówi tak samo przy następnym uruchomieniu.

**Kontrola jakości** (`cli/src/i18n/cli-i18n.test.ts`, `no-leaks.test.ts`,
`core/src/i18n/i18n.test.ts` — 69 testów):

- komplet kluczy i **zgodna arność funkcji** wymuszone typem, reszta testem;
- **antykalka**: identyczne napisy dopuszczone tylko z jawnej listy (19 pozycji
  — symbole, formaty, wartości enum);
- diakrytyki obecne i nieokaleczone, cudzysłowy drukarskie w polskiej prozie;
- przetłumaczone **komentarze YAML nie psują składni** — szablon parsuje się
  w obu językach do tej samej struktury;
- **strażnik przecieków**: wszystkie komendy uruchomione po angielsku, a ich
  wyjście, `PLAN.md`, `AGENTS.md`, eksporty HTML/ICS i nazwy plików sprawdzone
  pod kątem polskich znaków **oraz polskich słów bez diakrytyków** — bo
  „Predykcja wyniku" nie ma ani jednego polskiego znaku i przeszłoby.

**Uwaga projektowa:** i18n obnażyła sześć miejsc, w których **logika
porównywała się z tekstem interfejsu**: `Comparison.status` (`'zgodne'`),
`TrainingWindow.label` (`'wieczór'`), wykrywanie niedomkniętej kalibracji po
polskim zdaniu w `review`, rozpoznawanie członu schłodzenia po `'Na koniec
treningu…'`, wybór scenariusza na opaskę po `label === 'cel'` i filtrowanie
dni wolnych po podpowiedzi `'wolne'` w pickerze. Wszystkie zamienione na
klucze semantyczne albo na dane z planu; to typowa klasa błędów, którą
tłumaczenie wyciąga na wierzch.

**Znane uproszczenia silnika v1** (świadome, do zdjęcia w kolejnych iteracjach):
~~jeden cel A bez startów B/C~~ (zdjęte w fazie 7: `tuneUpRaces` + T-9…T-12);
~~brak wariantu „długie w niedzielę po sobotnim akcencie"~~ (2026-08-07: to
nie był brak, tylko **kara w solverze wbrew korpusowi** — zdjęta, patrz S-9a);
długie wybieganie zawsze czysto spokojne — **pomiar korpusu potwierdza ten
wybór w 71%** (`tools/corpus/long_run_profile.py`), pozostałe 29% to osobny,
KRÓTSZY wzorzec (mediana 19 km wobec 25 km), nie „długie z dodatkiem tempa";
kalibracja VDOT w backteście inżynierska (51), docelowo z wyników startów
użytkownika.

## 9. Ryzyka (szczerze)

- **Wąska nisza — i już nie całkiem pusta.** Weryfikacja 2026-08-04: istnieje
  **icusync.icu** — komercyjny „AI coach przez MCP nad intervals.icu" (Claude ↔
  Garmin/Coros/Wahoo/Polar/Suunto). Nasza odpowiedź to nie „być pierwszym", tylko
  filary 2–3: silnik generacji planów (icusync to sync/analiza, nie periodyzacja),
  plan-as-code i renegocjacja. Logika projektu bez zmian: najpierw narzędzie dla
  siebie + OSS z charakterem; produkt — jeśli będzie trakcja.
- **Rynek planów jest tłoczny** (Runna→Strava, Garmin DSW, TriDot, JOIN, Athletica,
  intervals.icu). Nie wygrywamy „inteligencją planu", tylko miejscem w workflow.
- **Korpus to n=1** — jeden trener, jeden zawodnik. House style tak; generalizacja
  na innych użytkowników wymaga warstwy opublikowanej metodyki.
- **Zależność od intervals.icu** — projekt jednoosobowy (David Tinker). Mitygacja:
  port SyncProvider + import FIT/GPX jako fallback.

## 10. Log decyzji (ADR-lite)

| # | Data | Decyzja | Uzasadnienie |
|---|------|---------|--------------|
| 001 | 2026-08-04 | Stack: TypeScript monorepo, porty/adaptery; Python tylko w tools/ | ekosystem MCP/CLI (npx), jeden język produktu, wtyczki sportów przez interfejsy; ETL korpusu wygodniejszy w Pythonie, ale to nie produkt |
| 002 | 2026-08-04 | intervals.icu jako hub integracyjny | 1 integracja ≈ wszystkie platformy + push na zegarek; Strava API = ryzyko prawne, Garmin = próg wejścia |
| 003 | 2026-08-04 | Serce v1: coach w agencie (silnik+MCP/CLI); tryb biurkowy → faza 5 | wartość rdzeniowa przed lifestyle'ową |
| 004 | 2026-08-04 | Rdzeń deterministyczny, LLM na brzegach | LLM-only łamie ograniczenia fizjologiczne; testowalne = wiarygodne |
| 005 | 2026-08-04 | Local-first: SQLite + pliki, bez konta | grupa docelowa tego oczekuje; zero backendu w v1 |
| 006 | 2026-08-04 | Korekta ADR-002 po weryfikacji: hub bez danych Stravy; Polar pull-only; v1 = BYO API key | intervals.icu nie re-eksportuje danych Stravy od XII 2024; OAuth wymaga rejestracji mailem — zbędna w modelu BYO-key |
| 007 | 2026-08-05 | Storage v1 = wyłącznie pliki (trainctl.yaml, plan/, log.jsonl) na cwd; SQLite dopiero z sync (faza 4); CLI bez kroku budowania (natywny type-stripping Node) — **skorygowane przez ADR-026 dla dystrybucji** | pliki to dosłowna realizacja filaru plan-as-code (git = historia); zero natywnych zależności; dystrybucja npm z buildem dojdzie przy publikacji |
| 008 | 2026-08-05 | Warstwą use-case'ów są handlery w `packages/cli/src/commands.ts` (pakiet `trainctl`); MCP zależy od `trainctl` | handlery są już czyste (cwd, args)→{output,code}; osobny pakiet `trainctl-usecases` wyekstrahujemy dopiero przy trzecim adapterze (REST) — nie wcześniej |
| 009 | 2026-08-05 | Klucz API poza `trainctl.yaml`: env `TRAINCTL_INTERVALS_API_KEY` albo `.trainctl-secret` (gitignore) | katalog treningowy użytkownika jest repozytorium gita — sekret w wersjonowanym pliku wcześniej czy później trafi do zdalnego repo |
| 009a | 2026-08-07 | Rozszerzenie ADR-009: obsługujemy też `.env` w katalogu treningowym (parsuje `process.loadEnvFile` z Node, bez zależności), ale CLI **sprawdza, czy git go ignoruje**, i głośno ostrzega, gdy nie; `trainctl init` sam dopisuje wzorce sekretów do `.gitignore` | `.env` to konwencja, której ludzie i tak używają — walka z nią kończy się kluczem w `trainctl.yaml`. Bezpieczeństwo daje nie zakaz pliku, tylko pewność, że jest ignorowany. `loadEnvFile` nie nadpisuje zmiennych już obecnych w środowisku, więc jawny `export` dalej wygrywa |
| 010 | 2026-08-05 | Podbiegi eksportowane BEZ celu tempa | pod górę tempo płaskie jest nieosiągalne — cel na zegarku alarmowałby przez całe powtórzenie; wysiłek reguluje nachylenie |
| 011 | 2026-08-05 | Adaptacja **proponuje**, nie przepisuje planu automatycznie | filar plan-as-code: zmiana planu ma być widocznym diffem, który użytkownik zatwierdza (`trainctl.yaml` → `trainctl diff` → `trainctl plan`); cichy re-plan czyni z silnika czarną skrzynkę |
| 012 | 2026-08-05 | Tryb biurkowy nie modyfikuje struktury planu; HRV-guided odłożone | B-1: siedzenie nie jest udokumentowanym czynnikiem ryzyka urazów biegowych — przerwy służą metabolizmowi, nie bieganiu. H-1: HRV nie poprawia wyników (SMD 0,20 n.i.), a wymaga pasa piersiowego i 10-dniowej bazy — koszt wdrożenia przewyższa udowodnioną korzyść |
| 013 | 2026-08-05 | Warstwa prezentacji: handlery zwracają **semantyczne bloki** (`cli/src/ui/blocks.ts`), CLI renderuje ANSI, MCP dostaje `renderPlain` | kolorowanie w handlerach wsypałoby agentowi sekwencje ANSI; rozdział pozwala zmieniać wygląd bez ruszania logiki i testować oba wyjścia osobno |
| 014 | 2026-08-05 | Własne ~200 linii ANSI zamiast chalk/ink/blessed | zero zależności runtime, działa pod natywnym type-strippingiem Node (bez kroku budowania), pełna kontrola nad NO_COLOR/TTY/ASCII |
| 015 | 2026-08-05 | Tryby interaktywne (`trainctl shift` bez dat, `trainctl week -i`) są **dodatkiem, nie zamiennikiem** flag; poza TTY komenda tłumaczy, jak podać argumenty | skrypty, CI i serwer MCP muszą działać bez terminala — interaktywność nie może stać się jedyną drogą |
| 017 | 2026-08-05 | Własny koder FIT (~330 linii) zamiast biblioteki; walidacja przez upload do niezależnego parsera intervals.icu | biblioteki FIT ciągną SDK Garmina i zależności binarne — tu potrzebujemy jednego typu pliku (workout); poprawność sprawdzona nie tylko własnym dekoderem w testach, ale i obcym parserem |
| 018 | 2026-08-05 | Trzy drogi eksportu zamiast jednej: FIT (zegarek), ICS (kalendarz), HTML (wydruk) | „na urządzenie" znaczy co innego dla każdego: kabel do Garmina, kalendarz w telefonie albo kartka w kieszeni; push przez intervals.icu nie zastępuje żadnej z nich |
| 016 | 2026-08-05 | `trainctl push` usuwa nieaktualne wpisy z zakresu, ale **wyłącznie z prefiksem `trainctl-`**; filtr zdublowany w adapterze i w komendzie | upsert zostawiał „duchy" po renegocjacji; jednocześnie skasowanie treningu dodanego ręcznie przez atletę byłoby nieodwracalną szkodą — stąd celowa redundancja zabezpieczenia |
| 024 | 2026-08-06 | Korekta cieplna **odmawia liczby powyżej 25 °C** i nie zawiera członów wilgotności, wiatru ani nasłonecznienia | model El Helou ma dane w 1,7–25,2 °C, a rośnie kwadratowo — ekstrapolacja rośnie kwadratowo także w błędzie. Wilgotność ma udowodniony niezależny efekt tylko przy 36 °C; w danych obserwacyjnych to artefakt korelacji z temperaturą (N-27). Lepiej powiedzieć „biegnij po odczuciu" niż podać wymyśloną liczbę |
| 023 | 2026-08-06 | Siła to **osobny tor** w `PlannedDay.strength`, nie kolejny `WorkoutKind` | siła nie wnosi kilometrów, nie ma tempa, nie jedzie na zegarek jako trening biegowy i nie może trafić do solvera biegowego; wepchnięcie jej w `WorkoutKind` zepsułoby liczenie objętości, `easyShare` (I-5) i eksport FIT |
| 022 | 2026-08-06 | Moduł siły uzasadniamy **ekonomią biegu**, nigdy prewencją urazów — i mówimy wprost, komu może nie zadziałać | wcześniejsza rekomendacja („najlepiej udowodniona interwencja przeciwurazowa") była **sprzeczna z własnym F-9/N-5** w tym repo. Jedyna metaanaliza na biegaczach: wynik nieistotny. Uczciwa wersja: mały efekt na ekonomię, nieistotny u 34–45 lat, zero danych dla maratonu i realnych zawodów |
| 021 | 2026-08-05 | `review` to **read-only kompozycja** istniejących use-case'ów; automatyzacja w CI zostaje **przykładem w docs**, nie funkcją produktu | raport nie może mieć własnej logiki treningowej — inaczej pojawiłaby się druga, rozjeżdżająca się definicja „jak mi poszło". Bot w Actions nie zapyta, czy pominięty tydzień to choroba czy wał w pracy, a wymaga klucza API w cudzych sekretach — dubluje kanał agentowy gorszym medium i łamie local-first; kto chce, włącza to sam |
| 020 | 2026-08-05 | Kalibracja formy **startami, nie sprawdzianami**: `tuneUpRaces` w trainctl.yaml są ścieżką główną, `kind: 'test'` włącza się dopiero przy pustym kalendarzu startów; część główna sprawdzianu eksportowana BEZ celu tempa | plan v1.1 zakładał sprawdzian co ~6 tyg. jako mechanizm domyślny — **korpus to obalił**: 0 sprawdzianów w 1231 dniach, za to 45 startów co ~28 dni. Reguła „korpus wygrywa z hipotezą" zadziałała. Cel tempa na sprawdzianie sterowałby wynikiem, który ma dopiero powstać (analogia do ADR-010) |
| 019 | 2026-08-05 | Profil z historii to **propozycja z proweniencją**, nie cicha automatyka: każda wartość dostaje w YAML komentarz „skąd", kandydaci na wyniki startów są tylko wypisywani (potwierdza użytkownik/agent), a przy <4 aktywnych tygodniach komenda odmawia zamiast zgadywać | samoocena formy jest największym źródłem błędu planu, ale cichy zapis zgadniętych wartości zamieniłby silnik w czarną skrzynkę — sprzeczność z plan-as-code; wynik startu wpisany błędnie przesuwa CAŁE strefy treningowe, więc to miejsce, gdzie automatyzacja musi się zatrzymać |
| 025 | 2026-08-07 | `trainctl check`: **error** wyłącznie dla stanów nieosiągalnych przez narzędzie (niespójność pliku), odstępstwa od reguł metodycznych to **warn** — kod 0 bez `--strict`; kontrola I-5 z podłogą generatora | `shift` celowo pozwala złamać I-7 z ostrzeżeniem — lint czerwieniący się na świadome decyzje stałby się bezużyteczny w CI po pierwszym przesunięciu. Podział robi z `check` bezpieczny domyślny strażnik, `--strict` zostawia pedanterię jako opt-in. Bez podłogi I-5 świeży plan o niskiej objętości ostrzegałby sam na siebie |
| 026 | 2026-08-08 | **Paczki npm publikują build (`dist/`), nie źródło TS** — `publishConfig.exports`/`bin` wskazują na `dist/*.js`, w tarballu leżą też źródła i mapy źródeł; w repozytorium nic się nie zmienia (dalej type-stripping) | korekta ADR-007 wymuszona przez Node, nie przez preferencję: zdejmowanie typów jest **wyłączone dla plików pod `node_modules`** (ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING), więc 0.1.0 zainstalowane z npm nie startowało. Wykryte dopiero testem instalacyjnym, bo cała suita uruchamia kod z drzewa źródeł — stąd `packaging.test.ts` i job `dist` w CI |
