# Publikacja OSS — stan przygotowania i decyzje

Stan na 2026-08-07 (aktualizacja wieczorna: nazwy paczek, CI, pliki repozytorium).

**Decyzja zapadła:** repozytorium **publiczne + npm, MIT — ale dopiero po
sezonie na sobie.** Rozumowanie w skrócie: projekt nie ma kroku budowania
(ADR-007), więc `npm publish` publikuje źródło — prywatne repo przy publicznej
paczce ukryłoby wyłącznie historię i issues, dając koszty zamknięcia bez jego
korzyści. Nisza jest gęsto obsadzona open source (kilka niezależnych serwerów
MCP nad intervals.icu na MIT), więc warstwa integracyjna jest towarem, a
zamknięcie kodu nie ochroniłoby niczego — usunęłoby tylko zaufanie w jedynej
grupie, która daje narzędziu klucz do własnych danych treningowych. Fosą jest
korpus (nie jest dystrybuowany) i metoda wyprowadzania reguł, nie kod.

Publikacja czeka na **przejście pełnego cyklu treningowego na sobie** —
sprzężenie zwrotne z jednego przepracowanego sezonu jest warte więcej niż
wcześniejsza data wydania.

## Co jest zrobione

- **Historia gita czysta** (weryfikowane wielokrotnie, ostatnio 2026-08-07):
  `git ls-files` i `git log --all` nie pokazują ani plików korpusu, ani `.env`,
  ani `.trainctl-secret`. Upublicznienie nie wymaga przepisywania historii.
- **LICENSE**: MIT, copyright Dariusz Tyszka — **decyzja zatwierdzona
  2026-08-07**, nie wymaga już zmiany przed publikacją.
- **Nazwa**: `trainctl`, wolna na npm i GitHubie (sprawdzone 2026-08-06).
- **Metadane pakietów** (2026-08-07): `version 0.1.0`, `license`, `author`,
  `repository` z polem `directory`, `homepage`, `bugs`, `keywords`, `engines`
  we wszystkich pięciu pakietach i w korzeniu.
- **Pole `files`**: do paczki idzie wyłącznie źródło produkcyjne. Przed tą
  zmianą tarball CLI miał 38 plików i 315 kB rozpakowane — z testami włącznie;
  po niej 21 plików i 216 kB.
- **Nazwy paczek — decyzja zapadła (2026-08-07): wszystkie bez scope'u.**
  `trainctl` (CLI), `trainctl-core`, `trainctl-export`, `trainctl-mcp`,
  `trainctl-sync-intervalsicu`; wszystkie sprawdzone jako wolne na npm.
  Powód: README od początku obiecuje `npx trainctl` i `npx -y trainctl-mcp`,
  a scope wymagałby zakładania organizacji, żeby te dwa zdania stały się
  prawdą. Korzeń monorepo nazywa się `trainctl-monorepo` — inaczej filtry
  pnpm miałyby dwa projekty o tej samej nazwie.
- **`publishConfig.access: public`** w każdym pakiecie (zostaje po zmianie
  nazw — kosztuje nic, a chroni przed publikacją jako prywatna).
- **CI** (`.github/workflows/ci.yml`): typecheck + testy na Linuksie i Windowsie,
  Node 22.18 (minimum z `engines`) i 24. Korpusu na runnerze nie ma, więc
  siedem testów backtestu pomija się samo — tak jest zamierzone.
- **Pliki repozytorium**: `CONTRIBUTING.md` (jak działa repo, czego wymaga
  zmiana reguły silnika), `SECURITY.md` (prywatne zgłoszenie przez GitHub
  Security Advisories, powierzchnia: jeden host wyjściowy, klucz API, cztery
  zależności runtime), `CODE_OF_CONDUCT.md`, szablony issue/PR.
- **README każdego pakietu** + kopia `LICENSE` w każdym pakiecie — pole `files`
  wymieniało oba, a nie istniały: strona paczki na npm byłaby pusta.
- **README po angielsku** dla obcego czytelnika: co narzędzie robi, wymagania,
  ograniczenie Stravy postawione wprost, skąd biorą się decyzje silnika i gdzie
  odmawia liczby zamiast ją zmyślić. Polska wersja jako `README.pl.md`.
  **Bez akapitów uprzedzającego tłumaczenia się** — wersja `0.1.0` mówi o
  dojrzałości tyle, ile trzeba, a zdania w rodzaju „issues mogą zostać bez
  odpowiedzi" tylko odpychają czytelnika, którego nikt o nic nie pytał.
- **CHANGELOG.md** w formacie Keep a Changelog, z jawną sekcją znanych
  ograniczeń.
- **`private: true` ZOSTAJE** we wszystkich pakietach — to bezpiecznik przed
  przypadkowym `pnpm publish -r`. Zdjęcie flagi jest krokiem 1 publikacji.

## Co zostaje do zrobienia w dniu publikacji

1. **Sezon na sobie** — warunek wstępny, nie formalność.
2. Zdjąć `private: true` z pięciu pakietów (jedyna zmiana w kodzie, jakiej
   wymaga publikacja).
3. `pnpm release:dry` i **przeczytać listę plików każdej paczki**, nie tylko
   podsumowanie. Zanim flaga zniknie, tę samą listę pokazuje
   `pnpm -r exec npm pack --dry-run` — `npm pack` działa też na prywatnych.
4. `pnpm publish -r` (kolejność zależności ustawia pnpm samo).
5. Repo z prywatnego na publiczne; w ustawieniach włączyć **private vulnerability
   reporting** (SECURITY.md i szablony issue kierują do tej ścieżki) i rozważyć
   wyłączenie Discussions.
6. Tag `v0.1.0`, GitHub Release z linkiem do SPEC i FOUNDATIONS.
7. Po pierwszym zielonym CI: sprawdzić, czy badge w obu README świeci — link
   wskazuje na `workflows/ci.yml` w gałęzi `main`.

**Dystrybucja bez kroku budowania** działa tylko dla Node ≥ 22.18 (natywny
type-stripping; wersje 23.0–23.5 wymagają flagi). `engines` to wymusza. Jeśli
zasięg ma być większy — dopiero wtedy dodać build (esbuild do ESM + d.ts),
zgodnie z ADR-007 („build dojdzie przy publikacji").

## Czego NIE publikować nigdy

- `corpus/` w jakiejkolwiek postaci (PII trenera i zawodnika).
- `corpus/parsed/BACKTEST.md` i `long-run-profile.json` — generowane lokalnie,
  zawierają daty startów użytkownika; są w .gitignore razem z resztą korpusu.
- Wyników `trainctl init --from-intervals` z realnego konta w przykładach docs.
- `.env`, `.trainctl-secret` — w .gitignore, weryfikowane przy każdym
  uruchomieniu CLI (ostrzeżenie, gdy sekret leży w repo bez ochrony).
