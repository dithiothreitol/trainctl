# tren

Coach treningowy dla ludzi żyjących w terminalu: silnik planów biegowych
(docelowo multi-sport) z interfejsem **CLI + MCP** — trener staje się narzędziem
Twojego agenta (Claude Code, Codex), a plan jest kodem w repo.

**Status:** Faza 0 — fundament. Zobacz [SPEC.md](SPEC.md) (wizja, architektura,
fazy, decyzje).

## Struktura

- `packages/` — monorepo TypeScript (core, sport-running, cli, mcp, sync, storage)
- `tools/corpus/` — jednorazowe ETL korpusu planów trenerskich (Python)
- `corpus/` — dane źródłowe (gitignore — PII)
- `docs/science/` — fundament naukowy z cytowaniami
- `docs/adr/` — decyzje architektoniczne

## Użycie (CLI)

```
mkdir moj-trening && cd moj-trening && git init   # plan-as-code: katalog w gicie
pnpm tren init        # interaktywny kreator profilu (--template = sam szablon)
pnpm tren init --from-intervals   # profil z 16 tygodni historii intervals.icu
pnpm tren plan        # generuje plan/plan.yaml + plan/PLAN.md (+ predykcja celu)
pnpm tren today       # co dziś wybiegać (--date YYYY-MM-DD dla innego dnia)
pnpm tren why         # dlaczego ten trening — cel jednostki + reguły z badań
pnpm tren log --time 58:30 --note "dobre czucie"
pnpm tren reschedule --block 2026-08-06   # „w czwartek release" → solver przestawia
pnpm tren reschedule --block 2026-08-06 --apply   # i zapisuje
pnpm tren shift       # wybór treningu i nowego dnia z listy (strzałki/cyfry)
pnpm tren shift --from 2026-08-06 --to 2026-08-07   # albo wprost, bez pytań
pnpm tren week -i     # przeglądanie tygodni: ←/→, t = dziś, s = przesuń, q = wyjście
pnpm tren diff        # co zmieniłaby regeneracja z aktualnego tren.yaml
pnpm tren export      # zapyta: rozpiska do druku / plan na zegarek / jeden trening / kalendarz
pnpm tren export --what print     # albo wprost, bez pytań
pnpm tren review      # rytuał tygodnia: co było, sygnały, co przed nami, co zrobić
pnpm tren adapt       # analiza wykonania → propozycje korekt (nie zmienia planu)
pnpm tren desk --heavy   # dzień przy biurku: okna, przerwy, reguła tempa po pracy
```

Starty kontrolne w sezonie wpisujesz w `tren.yaml` (`athlete.tuneUpRaces`) —
silnik robi z nich to samo, co trener z korpusu: mini-taper przed startem B,
wolny dzień przed, długie wybieganie nazajutrz, żadnego dokładania akcentu do
tygodnia startowego. Gdy kalendarz startów jest pusty, plan sam wstawia
sprawdzian na czas, żeby było z czego przeliczyć strefy — ale prawdziwy start
zawsze ma pierwszeństwo.

Profil z prawdziwych danych zamiast samooceny: gdy klucz intervals.icu jest
dostępny, kreator proponuje objętość, dni treningowe i dzień długiego wybiegania
z ostatnich 16 tygodni — Enter przyjmuje propozycję, wpisanie własnej wartości ją
nadpisuje. Kandydatów na starty (do kalibracji stref) tylko pokazujemy: wynik
wpisany błędnie przesuwa wszystkie tempa, więc tę decyzję zostawiamy człowiekowi.

Synchronizacja z zegarkiem (intervals.icu jako hub → Garmin/Coros/Wahoo):

```
# klucz: intervals.icu → Settings → Developer Settings
export TREN_INTERVALS_API_KEY=...        # albo plik .tren-secret (w .gitignore)
pnpm tren push --days 14   # plan → kalendarz intervals.icu → zegarek
pnpm tren pull --days 28   # wykonanie + wellness → sync.json, porównanie z planem
```

CLI działa na bieżącym katalogu i trzyma wszystko w plikach (`tren.yaml`,
`plan/`, `log.jsonl`) — bez konta, bez bazy; historia zmian planu to git.
Uruchamiane natywnym type-strippingiem Node ≥23.6 (bez kroku budowania).

Wyjście jest kolorowe w terminalu i czyste wszędzie indziej: `NO_COLOR=1`
wyłącza barwy, `TREN_ASCII=1` wymusza znaki ASCII, a przekierowanie do pliku
lub potoku automatycznie zdejmuje formatowanie. Serwer MCP dostaje tę samą
treść bez sekwencji ANSI — handlery opisują wyjście blokami
(`src/ui/blocks.ts`), a kolory dokłada dopiero renderer CLI.

## Eksport

Trzy drogi „na zewnątrz", zależnie od tego, co masz pod ręką:

| Co | Format | Do czego |
|---|---|---|
| `--what plan` / `workout` | `.fit` | katalog `GARMIN/Workouts` na zegarku (kabel) lub import w Garmin Connect |
| `--what calendar` | `.ics` | Google Calendar, Outlook, kalendarz telefonu |
| `--what print` | `.html` | rozpiska pod A4 — Ctrl+P, z kratką na odhaczanie |

Bez kabla i bez plików: `tren push` wysyła treningi przez intervals.icu.
Pliki FIT są weryfikowane binarnie w testach, a format potwierdzono, wgrywając
wygenerowany plik do niezależnego parsera intervals.icu (struktura kroków,
pętle powtórzeń i cele tempa odczytane poprawnie).

## Agent (MCP)

Ten sam silnik jako narzędzia dla Claude Code / innych klientów MCP:

```
claude mcp add tren --env TREN_DIR="C:\sciezka\do\mojego-treningu" ^
  -- node "C:\...\tren\packages\mcp\src\bin.ts"
```

Narzędzia: `tren_plan`, `tren_today`, `tren_week`, `tren_log`, `tren_shift`,
`tren_why`, `tren_diff`, `tren_init`, `tren_push`, `tren_pull`, `tren_adapt`,
`tren_desk`, `tren_reschedule`, `tren_export`, `tren_review`. Rozmowa jest
interfejsem: „co mam dziś wybiegać?", „w czwartek release — przesuń interwały",
„jak mi poszło w tym tygodniu?". Agent widzi tydzień (`tren_week`), renegocjuje
(`tren_shift` z ochroną dnia startu i ostrzeżeniem I-7) i tłumaczy plan cytując
badania (`tren_why`).

`tren init` zostawia w katalogu treningowym `AGENTS.md` — instrukcję, która
robi z agenta trenera, a nie wykonawcę komend: poniedziałkowy przegląd, pytanie
o kontekst przy pominiętych sesjach, zakaz regenerowania planu bez pytania.
Kto woli powiadomienie zamiast rozmowy, znajdzie przykład zadania cron/Actions
w [docs/examples/github-actions-review.md](docs/examples/github-actions-review.md)
— z zastrzeżeniami, dlaczego to nie jest domyślna droga.

## Rozwój

```
pnpm install
pnpm test        # vitest (packages/*/src/**/*.test.ts)
pnpm typecheck   # tsc --noEmit
```

Reguły silnika odwołują się do ID z `docs/science/FOUNDATIONS.md` §10
(np. `P-2`, `T-5`, `W-7`) — wartości bez pokrycia w źródłach są oznaczone
w kodzie jako inżynierskie.

## Korpus — odtworzenie lokalne

```
# źródła: 50 planów .doc/.docx (2020–2025)
# .doc → .docx: LibreOffice headless
soffice --headless --convert-to docx --outdir corpus/source corpus/source/*.doc
python tools/corpus/extract_text.py   # → corpus/raw-text/*.txt
```
