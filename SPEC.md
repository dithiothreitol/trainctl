# tren — coach treningowy dla ludzi żyjących w terminalu

> Plan treningowy jako kod, trener jako narzędzie agenta.

**Status:** Fazy 0–3 ZAKOŃCZONE (2026-08-05). Silnik v1 (`@tren/core`): strefy, predykcja W-1…W-10, makro+mikrocykle w house style (backtest HM 2025: objętość 1,04, Δakcentów 0). CLI (`@tren/cli`) + serwer MCP (`@tren/mcp`, 8 narzędzi) nad wspólnymi handlerami; 88 testów. „Coach w agencie" działa. Następna: Faza 4 (sync intervals.icu).
**Nazwa robocza:** `tren` (krótka komenda CLI; łatwa do zmiany przed publikacją)

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
3. **Renegocjacja jako operacja pierwszej klasy.** Przesunięcie sesji to constraint
   solver: zachowaj liczbę akcentów, ≥48 h między ciężkimi sesjami, chroń długie
   wybieganie — i pokaż, co poświęcasz.
4. **Świadomość biurka.** Okna treningowe (lunch vs wieczór), przerwy ruchowe między
   sesjami z agentem („exercise snacks"), ochrona okna snu. (Faza 5, nie v1.)

## 3. Zakres

**v1 (serce: coach w agencie):** intake → plan biegowy pod zawody/cel → mikrocykle
tygodniowe → „co dziś" → log wykonania → renegocjacja → adaptacja. Local-first,
bez konta, dane w SQLite + plikach.

**Poza v1 (kolejność wg faz):** sync intervals.icu, adaptacja w pętli na danych
z zegarka, tryb biurkowy, kolejne sporty (triathlon — korpus już go zawiera),
REST API / hosting.

## 4. Architektura

Monorepo TypeScript (pnpm workspaces), architektura portów i adapterów:

```
tren/
├─ packages/
│  ├─ core/              czysta logika domenowa, ZERO I/O
│  │   ├─ domain/        Athlete, Workout, Microcycle, Macrocycle, Race, Load
│  │   ├─ engine/        generator planu, periodyzacja, progresje, guardraile
│  │   ├─ solver/        renegocjacja tygodnia (constraints)
│  │   ├─ zones/         VDOT / critical speed → strefy temp
│  │   └─ ports/         SportModule, SyncProvider, PlanRepository (interfejsy)
│  ├─ sport-running/     pierwszy plugin sportu (implementuje SportModule)
│  ├─ cli/               tren init|plan|today|log|shift|why|diff  (cienki adapter)
│  ├─ mcp/               serwer MCP — te same use-case'y co CLI   (cienki adapter)
│  ├─ sync-intervalsicu/ adapter SyncProvider (hub → Garmin/Strava/Polar/Coros)
│  └─ storage/           SQLite + pliki planu YAML/MD (adapter PlanRepository)
├─ tools/corpus/         ETL korpusu (Python, narzędzia jednorazowe — nie produkt)
├─ corpus/               dane źródłowe i pochodne (PII → gitignore!)
└─ docs/
   ├─ science/           fundament naukowy z cytowaniami (faza 0)
   └─ adr/               decyzje architektoniczne
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
| **1** | Model domeny + silnik generacji (intake → makro → mikrocykle) | ✅ KOMPLET (2026-08-05): monorepo TS + `@tren/core` · strefy (VDOT D-G, CS) · predykcja W-1…W-10 · makrocykl I/P/T · mikrocykle w house style (profil z korpusu: `style_profile.py` → `house-style.ts`; sesje = objętość/14 km) · **backtest HM 2025: objętość 1,04, akcenty Δ0, sesje Δ0** — 64 testy vitest + typecheck |
| **2** | CLI na rdzeniu | ✅ KOMPLET (2026-08-05): `@tren/cli` — init/plan/today/log/shift/why/diff działają e2e (16 testów na realnych plikach + smoke bin); storage = pliki (`tren.yaml`, `plan/plan.yaml`+`PLAN.md` w stylu trenera, `log.jsonl`); shift z ochroną dnia startu i ostrzeżeniem I-7; why cytuje reguły; diff = dry-run regeneracji |
| **3** | Serwer MCP + scenariusze agentowe | ✅ KOMPLET (2026-08-05): `@tren/mcp` — 8 narzędzi (`tren_init/plan/today/week/log/shift/why/diff`) nad wspólnymi handlerami z `@tren/cli` (ADR-008); katalog treningowy przez env `TREN_DIR`/cwd; walidacja wejść zod; testy scenariuszy agentowych in-memory (client↔server): generacja, why, renegocjacja week→shift→week, ochrona dnia startu, log |
| **4** | Sync intervals.icu | pull aktywności/wellness, push workoutów na zegarek |
| **5** | Adaptacja w pętli + tryb biurkowy | re-plan na danych wykonania; przerwy/okna/sen |
| dalej | Kolejne sporty (SportModule), REST API, hosting | — |

**Znane uproszczenia silnika v1** (świadome, do zdjęcia w kolejnych iteracjach):
jeden cel A bez startów B/C (mini-taper T-9 niezaimplementowany — tygodnie ze
startami kontrolnymi dostają pełną objętość); długie wybieganie zawsze czysto
spokojne (trener wplata wstawki tempowe); brak wariantu „długie w niedzielę po
sobotnim akcencie"; kalibracja VDOT w backteście inżynierska (51), docelowo
z wyników startów użytkownika.

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
| 007 | 2026-08-05 | Storage v1 = wyłącznie pliki (tren.yaml, plan/, log.jsonl) na cwd; SQLite dopiero z sync (faza 4); CLI bez kroku budowania (natywny type-stripping Node) | pliki to dosłowna realizacja filaru plan-as-code (git = historia); zero natywnych zależności; dystrybucja npm z buildem dojdzie przy publikacji |
| 008 | 2026-08-05 | Warstwą use-case'ów są handlery w `@tren/cli/src/commands.ts`; MCP zależy od `@tren/cli` | handlery są już czyste (cwd, args)→{output,code}; osobny pakiet `@tren/usecases` wyekstrahujemy dopiero przy trzecim adapterze (REST) — nie wcześniej |
