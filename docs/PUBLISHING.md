# Publikacja OSS — stan przygotowania i decyzje

Stan na 2026-08-07.

**Decyzja zapadła:** repozytorium **publiczne + npm, MIT — ale dopiero po
sezonie na sobie.** Rozumowanie w skrócie: projekt nie ma kroku budowania
(ADR-007), więc `npm publish` publikuje źródło — prywatne repo przy publicznej
paczce ukryłoby wyłącznie historię i issues, dając koszty zamknięcia bez jego
korzyści. Nisza jest gęsto obsadzona open source (kilka niezależnych serwerów
MCP nad intervals.icu na MIT), więc warstwa integracyjna jest towarem, a
zamknięcie kodu nie ochroniłoby niczego — usunęłoby tylko zaufanie w jedynej
grupie, która daje narzędziu klucz do własnych danych treningowych. Fosą jest
korpus (nie jest dystrybuowany) i metoda wyprowadzania reguł, nie kod.

Publikacja czeka na **przejście pełnego cyklu treningowego na sobie**: silnik
nigdy nie poprowadził nikogo od bazy do startu, a integracja jest zablokowana
ograniczeniem Stravy. Wypuszczenie teraz kupiłoby issues o rzeczach, których
autor sam jeszcze nie wie.

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
- **`publishConfig.access: public`** w każdym pakiecie (scope `@trainctl/*`
  wymaga tego jawnie, inaczej npm odmawia publikacji scoped jako publiczny).
- **README po angielsku** dla obcego czytelnika: status „narzędzie osobiste,
  bez obietnicy wsparcia", wymagania, ograniczenie Stravy postawione wprost,
  sekcja „czego to świadomie nie robi". Polska wersja jako `README.pl.md`.
- **CHANGELOG.md** w formacie Keep a Changelog, z jawną sekcją znanych
  ograniczeń.
- **`private: true` ZOSTAJE** we wszystkich pakietach — to bezpiecznik przed
  przypadkowym `pnpm publish -r`. Zdjęcie flagi jest krokiem 1 publikacji.

## Co zostaje do zrobienia w dniu publikacji

1. **Sezon na sobie** — warunek wstępny, nie formalność.
2. Zdjąć `private: true` z pięciu pakietów.
3. Zdecydować kształt paczki wejściowej. Dziś publikowalne są cztery pakiety
   scoped plus `@trainctl/cli`; użytkownik chce wpisać `npx trainctl`, więc
   albo:
   - `@trainctl/cli` → przemianować na `trainctl` (nazwa wolna, bez scope'u,
     nie wymaga zakładania organizacji npm), reszta zostaje `@trainctl/*` —
     **wymaga wtedy organizacji `trainctl` na npm** (darmowa dla pakietów
     publicznych); albo
   - wszystkie bez scope'u: `trainctl`, `trainctl-core`, `trainctl-export`,
     `trainctl-sync-intervalsicu`, `trainctl-mcp` — brzydziej, zero setupu.
4. `pnpm publish -r --dry-run` i **przeczytać listę plików każdej paczki**,
   nie tylko podsumowanie.
5. Repo z prywatnego na publiczne; rozważyć wyłączenie Discussions.
6. Tag `v0.1.0`, GitHub Release z linkiem do SPEC i FOUNDATIONS.

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
