# trainctl

[![CI](https://github.com/dithiothreitol/trainctl/actions/workflows/ci.yml/badge.svg)](https://github.com/dithiothreitol/trainctl/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%E2%89%A5%2022.18-brightgreen.svg)](package.json)

**Trener biegowy, który mieszka w terminalu.** Silnik planów z interfejsem CLI
i serwerem MCP: plan treningowy to plik YAML w repozytorium gita, każda jednostka
cytuje badania, na których stoi, a Twój agent (Claude Code, Codex, dowolny klient
MCP) dostaje trenera jako narzędzie.

```console
$ trainctl today
2026-08-04 · wtorek
tydzień 1/17 · baza · do startu: 117 dni
───────────────────────────
╭─ interwały · 8 km ───────────────────────────────────────────────────────────
│ 3 kilometry (tempo rozgrzewkowe) + 4*1 km (w tempie 4:32 na km), przerwy 2
│ minutowe w marszu. Na koniec treningu 1 kilometr truchtu.
╰──────────────────────────────────────────────────────────────────────────────
→ dlaczego ten trening: trainctl why --date 2026-08-04
```

Bez konta, bez bazy, bez backendu. Wszystko jest plikami w bieżącym katalogu —
`trainctl.yaml`, `plan/`, `log.jsonl` — więc historia Twojego treningu to
historia gita.

*English version: [README.md](README.md).*

---

**Spis treści** · [Instalacja](#instalacja) · [Start](#start) ·
[Codzienna pętla](#codzienna-pętla) · [Komendy](#komendy) ·
[Konfiguracja](#konfiguracja) · [Plan jako kod](#plan-jako-kod) ·
[Agent (MCP)](#agent-mcp) · [Zegarek i eksport](#zegarek-i-eksport) ·
[Język](#język) · [Skąd biorą się decyzje](#skąd-biorą-się-decyzje) ·
[Gdzie silnik odmawia](#gdzie-silnik-odmawia) · [FAQ](#faq) ·
[Rozwój](#rozwój)

---

## Instalacja

```bash
npx trainctl init          # bez instalacji
# albo
npm install -g trainctl    # i potem po prostu: trainctl
```

Jedyny wymóg to **Node ≥ 22.18**. Nie ma kroku budowania — CLI uruchamia
TypeScript natywnym type-strippingiem Node, więc paczka, którą instalujesz, jest
źródłem, które możesz przeczytać.

## Start

**1 · Katalog treningowy i profil.**

```bash
mkdir moj-trening && cd moj-trening && git init
trainctl init --lang pl              # interaktywny kreator
trainctl init --template --lang pl   # albo: zapisz trainctl.yaml i wypełnij ręcznie
```

`init` zostawia w katalogu także `AGENTS.md` (instrukcję trenerską dla agenta)
i dopisuje `.env`, `.env.*` oraz `.trainctl-secret` do `.gitignore` — to jedyne
miejsca, w których wolno leżeć kluczowi API.

**2 · Wypełnij profil.** Minimum to bieżąca objętość, dni treningowe i **jeden
wynik startu** — strefy liczymy ze startów, nigdy z progu odczytanego z zegarka:

```yaml
athlete:
  recentWeeklyKm: 45          # średnia z ostatnich ~4 tygodni
  peakWeeklyKm: 65            # najwyższa objętość, jaką utrzymywałeś (opcjonalne)
  daysAvailable: [tue, wed, thu, sat, sun]
  longRunDay: sat
  results:
    - { date: "2026-03-29", distanceKm: 10, timeSec: 2580, name: "Wiosenna 10-tka" }
goal:
  name: "Półmaraton"
  date: "2026-11-29"
  distanceKm: 21.0975
  priority: A
```

**3 · Wygeneruj plan.**

```console
$ trainctl plan
Półmaraton · 21.0975 km
2026-11-29 · 17 tygodni planu
──────────────────────────────────
Szczyt objętości           52 km/tydz.
Rekomendacja dla dystansu  42 km/tydz.
VDOT                       47.7 (z wyniku startu)

╭─ Predykcja wyniku ───────────────────────────────────────────────────────────
│ 1:32:24 – 1:38:07 (metoda: vdot)
│ Zawsze przedział, nigdy pojedyncza liczba (W-1).
╰──────────────────────────────────────────────────────────────────────────────

Struktura
• baza: tyg. 1–6
• budowanie: tyg. 7–12
• szczyt: tyg. 13–15
• taper: tyg. 16–16
• tydzień startowy: tyg. 17–17

✓ Zapisano plan/plan.yaml + plan/PLAN.md
→ trainctl today · trainctl week · trainctl why
```

`plan/plan.yaml` jest źródłem prawdy — czytelnym dla maszyny i edytowalnym
ręcznie. `plan/PLAN.md` to ten sam plan złożony dla człowieka, więc GitHub
pokazuje na stronie repozytorium gotową tabelę.

**4 · Zacommituj.**

```bash
git add -A && git commit -m "plan treningowy: półmaraton, 29 listopada"
```

Od tej chwili plan zachowuje się jak kod: gałęzie, diffy, review, CI.

## Codzienna pętla

```console
$ trainctl week
Tydzień 1/17 · od 2026-08-03
baza (piramidalnie) · cel 49 km · zaplanowano 41 km
────────────────────────────────────
DZIEŃ  DATA   KM     TRENING
PN     08-03  —      wolne
WT     08-04  8 km   3 kilometry (tempo rozgrzewkowe) + 4*1 km (w tempie 4:32
                     na km), przerwy 2 minutowe w marszu. Na koniec treningu 1
                     kilometr truchtu.
ŚR     08-05  —      wolne
CZ     08-06  9 km   5 kilometrów (w tempie spokojnym) + podbiegi: 15*200
                     metrów (spokojnie). Na koniec treningu 1 kilometr
                     truchtu.
PT     08-07  —      wolne
SB     08-08  17 km  17 kilometrów (w tempie bardzo spokojnym).
ND     08-09  7 km   3 kilometry (tempo rozgrzewkowe) + 3 km w tempie
                     narastającym (od 5:01 do 4:32 na km). Na koniec treningu
                     1 kilometr truchtu.
```

**Zapytaj „dlaczego", zanim uwierzysz.** Każda jednostka niesie swój cel i ID
reguł, na których stoi:

```console
$ trainctl why --date 2026-08-04
Dlaczego ten trening · 2026-08-04
faza: baza (piramidalnie)
─────────────────────────────────────────
╭─ interwały ──────────────────────────────────────────────────────────────────
│ Sesja interwałowa — bodziec zależny od fazy: okołoprogowy (piramida) albo
│ VO₂max (polaryzacja).
╰──────────────────────────────────────────────────────────────────────────────

Reguły
• I-1 — faza bazy/budowania: rozkład piramidalny — dużo spokojnego biegania,
  akcenty okołoprogowe (Casado 2022; Knopp 2024)
• I-7 — ≥48 h między sesjami jakościowymi — zasada hard day / easy day (Casado
  2022)
• I-8 — dwa akcenty tygodniowo przy ≥4 sesjach, jeden przy 3 (Casado 2022)
• P-1 — obciążenie faluje, nie rośnie liniowo — progresja falująca dała +22%
  VO₂max vs +11% liniowej (RCT Costa 2019)

→ źródła i parametry: docs/science/FOUNDATIONS.md §10
```

**Zapisz, co naprawdę się wydarzyło.**

```bash
trainctl log --km 8 --time 41:20 --note "dobre czucie"
trainctl log --date 2026-08-06 --status skipped --note "praca"
```

**Renegocjuj tydzień, gdy życie wchodzi w drogę.** `shift` zamienia dwie
jednostki miejscami; `reschedule` przestawia cały tydzień wokół dni, w których
nie potrenujesz — i mówi wprost, co poświęcił:

```console
$ trainctl reschedule --block 2026-08-06 2026-08-08
Renegocjacja tygodnia · od 2026-08-03
zablokowane: 2026-08-06, 2026-08-08
─────────────────────────────────────────────
DZIEŃ  DATA   BYŁO           BĘDZIE
PN     08-03  —              —
WT     08-04  interwały      interwały
ŚR     08-05  —              długie
CZ     08-06  podbiegi       —
PT     08-07  —              —
SB     08-08  długie         —
ND     08-09  akcent ciągły  akcent ciągły

Co się zmienia
• long: 2026-08-08 → 2026-08-05
• odpuszczone: easy_hills z 2026-08-06 — zabrakło dnia — spokojna jednostka
  kosztuje najmniej (objętość, nie bodziec)
• kompromis: długie wybieganie poza preferowanym dniem (środa)
⚠ Nie nadrabiamy odpuszczonych kilometrów w kolejnych dniach — dokładanie
  objętości po wypadniętej sesji działa przeciw progresji (P-1/P-3).

→ to podgląd; zastosuj: trainctl reschedule --apply (z tymi samymi --block)
```

Nic nie zostaje zapisane bez `--apply` — a wtedy jest to diff, który możesz
przeczytać przed commitem.

**Raz w tygodniu podsumowanie.** `trainctl review` to poniedziałkowy rytuał
w jednym wywołaniu: co było, co to znaczy, co przed nami (najpierw pobierze dane
z intervals.icu, jeśli klucz jest ustawiony). `trainctl adapt` porównuje
wykonanie z planem i **proponuje** korekty — nigdy nie przepisuje planu za
Twoimi plecami.

## Komendy

| komenda | co robi | ważniejsze flagi |
|---|---|---|
| `init` | kreator profilu | `--template`, `--from-intervals` |
| `plan` | generuje plan z `trainctl.yaml` | `--date` |
| `today` | trening na dziś | `--date` |
| `week` | tydzień ze statusem z dziennika | `--date`, `-i` (przeglądanie strzałkami) |
| `why` | cel jednostki + reguły z badań | `--date` |
| `log` | zapis wykonania | `--status`, `--km`, `--time`, `--note` |
| `shift` | zamiana dwóch jednostek w tygodniu | `--from`, `--to` (albo wybór z listy) |
| `reschedule` | przestawia tydzień wokół zajętych dni | `--block <daty…>`, `--apply` |
| `adapt` | analiza wykonania → propozycje korekt | `--date` |
| `review` | pull + adapt + week w jednym | `--days` |
| `desk` | okna treningowe wokół godzin pracy | `--heavy` |
| `push` | wysyła treningi do intervals.icu | `--days`, `--from`, `--to` |
| `pull` | pobiera aktywności i wellness, porównuje | `--days` |
| `export` | `.fit`, `.ics`, rozpiska, pakiet startowy | `--what`, `--date` |
| `diff` | co zmieniłaby regeneracja planu | `--plan <plik>` |
| `check` | lint planu; psuje kod wyjścia | `--strict` |

`--lang en|pl` działa na każdej komendzie. `trainctl help <komenda>` wypisuje
pełną listę flag.

## Konfiguracja

`trainctl.yaml` to cała konfiguracja — jeden plik, w Twoim repozytorium.
`trainctl init --template` zapisuje go z komentarzami; wszystkie klucze:

```yaml
language: pl                # język interfejsu i planu: en | pl (domyślnie: en)
athlete:
  sex: unspecified          # male | female | unspecified
  recentWeeklyKm: 45        # średnia z ostatnich ~4 tygodni
  peakWeeklyKm: 65          # najwyższa utrzymana objętość (opcjonalne)
  daysAvailable: [tue, wed, thu, sat, sun]
  longRunDay: sat
  results:                  # kalibracja stref — ze startów, nie z zegarka
    - { date: "2026-03-29", distanceKm: 10, timeSec: 2580, name: "Wiosenna 10-tka" }
  tuneUpRaces:              # starty po drodze: B = mini-taper, C = przebiegnięte
    - { date: "2026-09-19", distanceKm: 10, name: "Jesienna 10-tka", priority: B }
goal:
  name: "Półmaraton"
  date: "2026-11-29"
  distanceKm: 21.0975
  priority: A
  targetTimeSec: 5700       # opcjonalny cel czasowy — plan oceni, czy realny
desk:                       # dla trainctl desk (opcjonalne)
  workStart: "09:00"
  workEnd: "17:00"
  lunchMinutes: 45
  prefer: evening           # morning | lunch | evening
strength:                   # opcjonalny tor siłowy, 2×/tydz.
  enabled: true
  days: [mon, fri]          # opcjonalna preferencja dni
```

Trzy konsekwencje, o których warto wiedzieć:

- **`results` napędza wszystko.** Bez wyniku startu nie ma VDOT-u ani stref;
  przy samym `targetTimeSec` plan wyliczy strefy z celu i powie wprost, że
  wymagają rekalibracji.
- **`tuneUpRaces` to starty, nie treningi**: mini-taper przed startem B, wolny
  dzień przed, długie wybieganie nazajutrz i żadnego dodatkowego akcentu w tym
  tygodniu. Przy pustym kalendarzu startów plan sam wstawi sprawdzian na czas —
  ale prawdziwy start zawsze ma pierwszeństwo.
- **`strength` to osobny tor**, nie kolejna jednostka biegowa: nie dokłada
  kilometrów, znika w taperze i nigdy nie ląduje dzień przed akcentem.
  Uzasadnieniem jest ekonomia biegu — *nie* prewencja urazów; zob.
  [Gdzie silnik odmawia](#gdzie-silnik-odmawia).

Klucz API do intervals.icu nigdy nie trafia do tego pliku. Użyj
`TRAINCTL_INTERVALS_API_KEY`, pliku `.env` albo `.trainctl-secret`; zmienna
ustawiona jawnie wygrywa z plikiem.

## Plan jako kod

Plan to plik YAML w repozytorium gita — i to zmienia, co plan potrafi, a nie
tylko gdzie leży.

**Gałęzie „co jeśli".** Scenariusz żyje na gałęzi albo w skopiowanym katalogu:
zmieniasz datę startu *tam*, regenerujesz *tam*, a potem porównujesz — zanim
zdecydujesz.

```bash
git switch -c co-jesli-grudzien
sed -i 's/2026-11-29/2026-12-20/' trainctl.yaml && trainctl plan
git switch main
git show co-jesli-grudzien:plan/plan.yaml > /tmp/scenariusz.yaml
trainctl diff --plan /tmp/scenariusz.yaml
```

```console
Różnice: bieżący plan → /tmp/scenariusz.yaml
──────────────────────────────────────────────────────────────────────────────
• cel: Półmaraton, 21,1 km, 2026-11-29 → Półmaraton, 21,1 km, 2026-12-20
• ~ 2026-11-01: quality_continuous — ta sama objętość, inny układ członów
• ~ tydzień 2026-11-23: objętość 26 → 52 km
• ~ tydzień 2026-11-23: suma dni 16 → 52 km
• ~ 2026-11-24: easy → quality_intervals
• ~ 2026-11-29: race → long
• + tydzień 2026-11-30: nowy (52 km)
• + tydzień 2026-12-14: nowy (26 km)
```

Trzy tygodnie budowania więcej, taper przesunięty o trzy tygodnie i dzień
startu, który przestał być startem — wszystko zanim cokolwiek zapadnie.

**CI na własny trening.** `trainctl check` sprawdza plan pod inwarianty silnika
— 48 h między akcentami, kształt taperu, sąsiedztwo siły, ≥75% objętości
spokojnej — oraz wewnętrzną spójność pliku; każde ustalenie z ID reguły:

```console
$ trainctl check
✓ Bez zastrzeżeń: 17 tygodni i 66 sesji trzymają wszystkie inwarianty.

$ trainctl check --strict     # w CI: ostrzeżenia też psują kod wyjścia
Lint planu
inwarianty i integralność pliku — sprawdzane na plan/plan.yaml
──────────────────

Odstępstwa od reguł
⚠ 2026-08-04 → 2026-08-05: interwały i akcent ciągły bez 48 godzin przerwy [I-7]

0 błędów, 1 ostrzeżenie
tryb ścisły: ostrzeżenia liczą się jak błędy
```

Błędy zawsze psują kod wyjścia, ostrzeżenia dopiero pod `--strict`. Gotowy
workflow: [docs/examples/ci-check.md](docs/examples/ci-check.md).

**Trener-człowiek jako reviewer.** Zmiany tygodnia to diffy, więc trener robi
review jak przy kodzie: komentarz przy linii, approve, merge. Przykład:
[docs/examples/coach-review.md](docs/examples/coach-review.md).

**Odtwarzalność.** Ten sam `trainctl.yaml` i ta sama wersja silnika dają ten sam
plan — za pięć lat też. Nic nie dryfuje pod Tobą i żaden backend nie może
zgasnąć; przypnij wersję w repo treningowym, a każda jednostka pozostaje
wytłumaczalna: ID reguły w planie, commit w historii.

## Agent (MCP)

Ten sam silnik jako narzędzia agenta — interfejsem staje się rozmowa: „co mam
dziś wybiegać?", „w czwartek release, przesuń interwały", „jak mi poszedł
tydzień?".

```bash
claude mcp add trainctl --env TRAINCTL_DIR="C:\sciezka\do\mojego-treningu" ^
  -- npx -y trainctl-mcp
```

Dowolny klient MCP — postać ogólna:

```json
{
  "mcpServers": {
    "trainctl": {
      "command": "npx",
      "args": ["-y", "trainctl-mcp"],
      "env": { "TRAINCTL_DIR": "/sciezka/do/mojego-treningu" }
    }
  }
}
```

Szesnaście narzędzi nad tymi samymi handlerami, z których korzysta CLI, więc
agent i terminal nie mogą się rozjechać: `trainctl_plan`, `trainctl_today`,
`trainctl_week`, `trainctl_log`, `trainctl_shift`, `trainctl_why`,
`trainctl_diff`, `trainctl_check`, `trainctl_init`, `trainctl_push`,
`trainctl_pull`, `trainctl_adapt`, `trainctl_desk`, `trainctl_reschedule`,
`trainctl_export`, `trainctl_review`.

`AGENTS.md`, który zostawia `trainctl init`, robi z agenta trenera, a nie
wykonawcę komend: pyta przed regeneracją planu, dopytuje o kontekst przy
pominiętym tygodniu, koreluje to, co widzi (kalendarz, tracker, dyżury)
z tygodniem treningowym — i nigdy nie zmyśla liczb. Kto woli powiadomienie
zamiast rozmowy, znajdzie przykład zadania cron/Actions w
[docs/examples/github-actions-review.md](docs/examples/github-actions-review.md)
— z zastrzeżeniami, dlaczego to nie jest domyślna droga.

## Zegarek i eksport

**Synchronizacja** idzie przez [intervals.icu](https://intervals.icu) jako hub,
który przekazuje dalej do Garmina, Corosa i Wahoo:

```bash
export TRAINCTL_INTERVALS_API_KEY=...   # Settings → Developer Settings
trainctl push --days 14                 # plan → kalendarz intervals.icu → zegarek
trainctl pull --days 28                 # wykonanie + wellness → porównanie z planem
```

`push` rusza wyłącznie wpisy, które sam utworzył (mają prefiks `trainctl-`
w external id), więc Twoje własne wpisy w kalendarzu zostają Twoje.

> **Zegarek musi być podpięty do intervals.icu bezpośrednio** (Settings →
> Connections), nie przez Stravę: od grudnia 2024 hub nie przepuszcza danych ze
> Stravy przez API i `pull` dostaje rekordy bez dystansu i typu. `trainctl` mówi
> to wprost, zamiast raportować „0 biegów" — ale nie umie tego obejść.
> Szczegóły: [docs/integrations/intervalsicu.md](docs/integrations/intervalsicu.md) §1.8.1.

**Eksport** obsługuje drogi offline:

```bash
trainctl export --what plan       # pliki .fit → GARMIN/Workouts przez kabel
trainctl export --what workout --date 2026-08-04
trainctl export --what calendar   # .ics → Google Calendar, Outlook, telefon
trainctl export --what print      # rozpiska A4 z kratką na odhaczanie
trainctl export --what race       # pakiet startowy: splity, opaska tempa, tabela cieplna
```

Koder FIT jest napisany tutaj, a nie dociągnięty jako zależność; pliki są
sprawdzane bajt po bajcie w testach, a format potwierdzono, wgrywając je do
niezależnego parsera.

## Język

Domyślnie angielski, polski jako pełnoprawny drugi język:

```bash
trainctl today --lang pl            # jednorazowo
export TRAINCTL_LANG=pl             # na sesję
trainctl init --lang pl             # wpisuje `language: pl` do trainctl.yaml
```

Flaga bije zmienną, zmienna bije plik. Polski nie jest tłumaczeniem: opisy
jednostek to głos trenera z korpusu („6 kilometrów w tempie spokojnym",
„przerwy 2 minutowe w marszu"), z odmianą liczebników (1 kilometr / 3 kilometry
/ 5 kilometrów) i przecinkiem dziesiętnym, a angielski brzmi jak zapis
anglojęzycznego planu („6 km easy", „2 min walk recovery"). Dwujęzyczne jest
wszystko, co widzi człowiek i agent: wyjście komend, `--help`, `plan/PLAN.md`,
szablon konfiguracji, `AGENTS.md`, objaśnienia reguł, opisy narzędzi MCP, kroki
w pliku FIT, rozpiska do druku i pakiet startowy.

## Skąd biorą się decyzje

Dwa źródła, celowo trzymane osobno.

**Opublikowane badania.** Każda reguła silnika ma ID z
[docs/science/FOUNDATIONS.md](docs/science/FOUNDATIONS.md) (~60 źródeł),
a `trainctl why` cytuje je wprost. Wartości bez pokrycia w źródłach są oznaczone
w kodzie jako decyzje inżynierskie, zamiast udawać naukę — a tam, gdzie dowody
są słabe, `why` to mówi: siłownia jest uzasadniona **ekonomią biegu**, nie
prewencją urazów, bo jedyna metaanaliza na samych biegaczach dała wynik
nieistotny.

**Korpus 50 realnych planów trenerskich** (2020–2025, jeden trener, ~1300 dni).
Ustawia house style — kształty jednostek, długości rozgrzewki i schłodzenia, dni
z akcentami. Nieraz też *obalił* założenia: trener przez 1231 dni ani razu nie
zaplanował sprawdzianu, co zmieniło sposób kalibracji; a zmierzenie długich
wybiegań usunęło karę w solverze, która odpychała plany od tego, co trener robi
naprawdę. Korpus zawiera dane osobowe i **nie jest dystrybuowany**.

## Gdzie silnik odmawia

Trzy rzeczy, których nie policzy, każda z udokumentowanego powodu:

- **Ryzyko urazu.** Metryki obciążenia używane do tego — ACWR, reguła 10%,
  „+30% jest groźne" — nie bronią się w literaturze (FOUNDATIONS N-1…N-3).
  Liczba byłaby zmyślona, więc jej nie ma.
- **Gotowość z HRV.** Przewaga wychodzi na SMD 0,20 z przedziałem przez zero
  (FOUNDATIONS §8). Strefy biorą się z wyników startów.
- **Własny plan, po cichu.** `adapt` zwraca propozycje; zastosowanie ich to
  edycja `trainctl.yaml` i regeneracja, więc zmiana jest diffem, który
  zatwierdziłeś.

Odmawia też zamiast zgadywać: poniżej 4 aktywnych tygodni historii nie wywnioskuje
profilu, powyżej 25 °C nie poda korekty cieplnej, a bez wyniku startu nie
skalibruje stref z odczytów zegarka.

## FAQ

**To generator planów czy trener?** Generator z manierami trenera: tłumaczy,
ostrzega i negocjuje, ale nigdy nie zastosuje zmiany w planie bez Ciebie.

**Mogę edytować `plan/plan.yaml` ręcznie?** Tak — o to chodzi w plan-as-code.
Uruchom potem `trainctl check`: sprawdza inwarianty, które gwarantuje generator,
i mówi, co ręczna edycja zepsuła.

**Czy potrzebuję intervals.icu?** Nie. Wszystko poza `push`/`pull`/`review`
działa offline; eksport obsługuje zegarek, kalendarz i papier.

**Rower, pływanie, triathlon?** Nie. Silnik jest zbudowany pod bieganie; model
domeny projektowano z myślą o innych sportach, ale nic poza bieganiem nie jest
zaimplementowane.

**Czy moje dane treningowe gdzieś wychodzą?** Nie. Jeden host wyjściowy —
intervals.icu — i tylko wtedy, gdy o to poprosisz. Zero telemetrii. Zob.
[SECURITY.md](SECURITY.md).

**Czy to porada medyczna?** Nie. To plan treningowy, który mówi, gdzie dowody są
słabe, zamiast udawać, że nie są.

## Rozwój

```bash
pnpm install
pnpm check       # typecheck + testy — to samo, co robi CI
```

544 testy. Siedem z nich porównuje silnik z korpusem planów trenerskich, który
nie jest dystrybuowany; bez niego ten zestaw zgłasza się jako jeden pominięty
test, zamiast po cichu zniknąć.

Pięć pakietów, publikowanych ze źródła: `trainctl` (CLI), `trainctl-core`
(silnik), `trainctl-mcp`, `trainctl-export`, `trainctl-sync-intervalsicu`.

Architektura, fazy i tabela decyzji (ADR): [SPEC.md](SPEC.md). Jak dołożyć swoje
i co musi nieść ze sobą zmiana reguły silnika:
[CONTRIBUTING.md](CONTRIBUTING.md). Zgłoszenie podatności:
[SECURITY.md](SECURITY.md).

## Korpus — odtworzenie lokalne

```bash
# źródła: 50 planów .doc/.docx (2020–2025), poza repozytorium
soffice --headless --convert-to docx --outdir corpus/source corpus/source/*.doc
python tools/corpus/extract_text.py    # → corpus/raw-text/*.txt
python tools/corpus/parse_plans.py     # → corpus/parsed/corpus.json
```

## Licencja

MIT — zob. [LICENSE](LICENSE).
