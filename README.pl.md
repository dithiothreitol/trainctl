# trainctl

*English version: [README.md](README.md). Ten dokument jest pełniejszy —
angielski jest skrócony pod pierwszy kontakt obcego czytelnika.*

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
pnpm trainctl init        # interaktywny kreator profilu (--template = sam szablon)
pnpm trainctl init --from-intervals   # profil z 16 tygodni historii intervals.icu
pnpm trainctl plan        # generuje plan/plan.yaml + plan/PLAN.md (+ predykcja celu)
pnpm trainctl today       # co dziś wybiegać (--date YYYY-MM-DD dla innego dnia)
pnpm trainctl why         # dlaczego ten trening — cel jednostki + reguły z badań
pnpm trainctl log --time 58:30 --note "dobre czucie"
pnpm trainctl reschedule --block 2026-08-06   # „w czwartek release" → solver przestawia
pnpm trainctl reschedule --block 2026-08-06 --apply   # i zapisuje
pnpm trainctl shift       # wybór treningu i nowego dnia z listy (strzałki/cyfry)
pnpm trainctl shift --from 2026-08-06 --to 2026-08-07   # albo wprost, bez pytań
pnpm trainctl week -i     # przeglądanie tygodni: ←/→, t = dziś, s = przesuń, q = wyjście
pnpm trainctl diff        # co zmieniłaby regeneracja z aktualnego trainctl.yaml
pnpm trainctl export      # zapyta: rozpiska do druku / plan na zegarek / jeden trening / kalendarz
pnpm trainctl export --what print     # albo wprost, bez pytań
pnpm trainctl review      # rytuał tygodnia: co było, sygnały, co przed nami, co zrobić
pnpm trainctl adapt       # analiza wykonania → propozycje korekt (nie zmienia planu)
pnpm trainctl desk --heavy   # dzień przy biurku: okna, przerwy, reguła tempa po pracy
```

Starty kontrolne w sezonie wpisujesz w `trainctl.yaml` (`athlete.tuneUpRaces`) —
silnik robi z nich to samo, co trener z korpusu: mini-taper przed startem B,
wolny dzień przed, długie wybieganie nazajutrz, żadnego dokładania akcentu do
tygodnia startowego. Gdy kalendarz startów jest pusty, plan sam wstawia
sprawdzian na czas, żeby było z czego przeliczyć strefy — ale prawdziwy start
zawsze ma pierwszeństwo.

Siłownia dwa razy w tygodniu (`strength: {enabled: true}` w `trainctl.yaml`) to
osobny tor obok biegania: nie dokłada kilometrów, znika w taperze i nigdy nie
ląduje dzień przed akcentem. Uzasadnienie jest jedno i mówimy je wprost —
**ekonomia biegu**, nie „ochrona przed urazami": jedyna metaanaliza na samych
biegaczach dała wynik nieistotny. `trainctl why` w dniu siłowni dopowiada resztę
prawdy: efekt jest mały, u biegaczy 34–45 lat statystycznie znika, a badania
kończą się na 10 km w laboratorium.

Profil z prawdziwych danych zamiast samooceny: gdy klucz intervals.icu jest
dostępny, kreator proponuje objętość, dni treningowe i dzień długiego wybiegania
z ostatnich 16 tygodni — Enter przyjmuje propozycję, wpisanie własnej wartości ją
nadpisuje. Kandydatów na starty (do kalibracji stref) tylko pokazujemy: wynik
wpisany błędnie przesuwa wszystkie tempa, więc tę decyzję zostawiamy człowiekowi.

Synchronizacja z zegarkiem (intervals.icu jako hub → Garmin/Coros/Wahoo):

```
# klucz: intervals.icu → Settings → Developer Settings
export TRAINCTL_INTERVALS_API_KEY=...   # zmienna środowiskowa
echo 'TRAINCTL_INTERVALS_API_KEY=...' >> .env   # albo plik .env w katalogu treningowym
pnpm trainctl push --days 14   # plan → kalendarz intervals.icu → zegarek
pnpm trainctl pull --days 28   # wykonanie + wellness → sync.json, porównanie z planem
```

Klucza nigdy nie wpisujesz do `trainctl.yaml` — ten plik jest w gicie. `.env`
i `.trainctl-secret` dopisuje do `.gitignore` samo `trainctl init`, a gdyby
mimo to sekret leżał w repozytorium bez ochrony, CLI powie to przy każdym
uruchomieniu. Zmienna ustawiona jawnie w powłoce wygrywa nad plikiem.

**Zegarek musi być podpięty do intervals.icu bezpośrednio** (Settings →
Connections), nie przez Stravę: od grudnia 2024 hub nie przepuszcza danych
Stravy przez API i `pull` dostaje puste rekordy. `trainctl` mówi wtedy wprost,
ile aktywności zostało zatrzymanych i dlaczego, zamiast raportować „0 biegów".

CLI działa na bieżącym katalogu i trzyma wszystko w plikach (`trainctl.yaml`,
`plan/`, `log.jsonl`) — bez konta, bez bazy; historia zmian planu to git.
Uruchamiane natywnym type-strippingiem Node ≥23.6 (bez kroku budowania).

Wyjście jest kolorowe w terminalu i czyste wszędzie indziej: `NO_COLOR=1`
wyłącza barwy, `TRAINCTL_ASCII=1` wymusza znaki ASCII, a przekierowanie do pliku
lub potoku automatycznie zdejmuje formatowanie. Serwer MCP dostaje tę samą
treść bez sekwencji ANSI — handlery opisują wyjście blokami
(`src/ui/blocks.ts`), a kolory dokłada dopiero renderer CLI.

## Język

Domyślnie angielski; polski jako drugi język:

```
trainctl today --lang pl            # jednorazowo
export TRAINCTL_LANG=pl             # na sesję
echo 'language: pl' >> trainctl.yaml   # na stałe, razem z katalogiem treningowym
```

Kolejność: flaga bije zmienną, zmienna bije `trainctl.yaml`. Serwer MCP dziedziczy
język katalogu, więc agent mówi tak samo jak `plan/PLAN.md`. Polski nie jest
tłumaczeniem angielskiego — opisy jednostek to głos trenera z korpusu
(„6 kilometrów w tempie spokojnym", „przerwy 2 minutowe w marszu"), a angielski
brzmi jak zapis anglojęzycznego planu („6 km easy", „2 min walk recovery").
Liczebniki są odmieniane (1 kilometr / 3 kilometry / 5 kilometrów, z pułapką
12–14), a liczby dziesiętne mają przecinek.

Dwujęzyczne jest wszystko, co widzi człowiek i agent: wyjście komend,
`--help`, `plan/PLAN.md`, szablon `trainctl.yaml` z komentarzami, `AGENTS.md`,
objaśnienia reguł, opisy narzędzi MCP, kroki treningu w pliku FIT, rozpiska
do druku, pakiet startowy i tytuły w kalendarzu intervals.icu.

`trainctl init --lang pl` zostawia w `trainctl.yaml` odkomentowane `language: pl` —
katalog treningowy pamięta wybór, więc kolejne komendy nie potrzebują flagi.

## Eksport

Trzy drogi „na zewnątrz", zależnie od tego, co masz pod ręką:

| Co | Format | Do czego |
|---|---|---|
| `--what plan` / `workout` | `.fit` | katalog `GARMIN/Workouts` na zegarku (kabel) lub import w Garmin Connect |
| `--what calendar` | `.ics` | Google Calendar, Outlook, kalendarz telefonu |
| `--what print` | `.html` | rozpiska pod A4 — Ctrl+P, z kratką na odhaczanie |
| `--what race` | `.html` | pakiet startowy: splity, papierowa opaska tempa na nadgarstek, tabela korekty na temperaturę |

Bez kabla i bez plików: `trainctl push` wysyła treningi przez intervals.icu.
Pliki FIT są weryfikowane binarnie w testach, a format potwierdzono, wgrywając
wygenerowany plik do niezależnego parsera intervals.icu (struktura kroków,
pętle powtórzeń i cele tempa odczytane poprawnie).

## Agent (MCP)

Ten sam silnik jako narzędzia dla Claude Code / innych klientów MCP:

```
claude mcp add trainctl --env TRAINCTL_DIR="C:\sciezka\do\mojego-treningu" ^
  -- node "C:\...\trainctl\packages\mcp\src\bin.ts"
```

Narzędzia: `trainctl_plan`, `trainctl_today`, `trainctl_week`, `trainctl_log`, `trainctl_shift`,
`trainctl_why`, `trainctl_diff`, `trainctl_init`, `trainctl_push`, `trainctl_pull`, `trainctl_adapt`,
`trainctl_desk`, `trainctl_reschedule`, `trainctl_export`, `trainctl_review`. Rozmowa jest
interfejsem: „co mam dziś wybiegać?", „w czwartek release — przesuń interwały",
„jak mi poszło w tym tygodniu?". Agent widzi tydzień (`trainctl_week`), renegocjuje
(`trainctl_shift` z ochroną dnia startu i ostrzeżeniem I-7) i tłumaczy plan cytując
badania (`trainctl_why`).

`trainctl init` zostawia w katalogu treningowym `AGENTS.md` — instrukcję, która
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
