# Publikacja OSS — stan przygotowania i decyzje

**Repozytorium jest publiczne od 2026-08-07**:
<https://github.com/dithiothreitol/trainctl>, MIT, Discussions wyłączone,
prywatne zgłaszanie podatności włączone. Warunek „sezon na sobie" został
świadomie odpuszczony — decyzja właściciela, nie przeoczenie.
**Paczki są na npm od 2026-08-08 w wersji 0.1.1** (0.1.0 zdeprecjonowane —
patrz sekcja o npm niżej); wydania: tagi `v0.1.0` i `v0.1.1`.

Poniżej zapis rozumowania, które do tego doprowadziło — zostaje, bo tłumaczy,
czemu projekt jest otwarty, a korpus nie.

**Decyzja:** repozytorium **publiczne + npm, MIT**. Rozumowanie w skrócie: projekt nie ma kroku budowania
(ADR-007), więc `npm publish` publikuje źródło — prywatne repo przy publicznej
paczce ukryłoby wyłącznie historię i issues, dając koszty zamknięcia bez jego
korzyści. Nisza jest gęsto obsadzona open source (kilka niezależnych serwerów
MCP nad intervals.icu na MIT), więc warstwa integracyjna jest towarem, a
zamknięcie kodu nie ochroniłoby niczego — usunęłoby tylko zaufanie w jedynej
grupie, która daje narzędziu klucz do własnych danych treningowych. Fosą jest
korpus (nie jest dystrybuowany) i metoda wyprowadzania reguł, nie kod.

Pierwotnie publikacja miała czekać na przejście pełnego cyklu treningowego na
sobie. Sezon nadal jest najlepszym źródłem sprzężenia zwrotnego — teraz po
prostu popłynie z otwartego repozytorium, a nie z szuflady.

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
  Node 22.18 (minimum z `engines`) i 24. Korpusu na runnerze nie ma — i pierwszy
  przebieg to wykrył: `describe.skipIf` wykonuje ciało opisu, więc odczyt
  `corpus.json` wywracał zbiórkę testów. Teraz ciało nie powstaje w ogóle,
  a zostaje po nim jeden jawnie pominięty test.
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
- **`private: true`** stało w pięciu pakietach do dnia publikacji jako
  bezpiecznik przed przypadkowym `pnpm publish -r`; zdjęte 2026-08-07.

## Zrobione w dniu publikacji (2026-08-07)

1. Historia gita zweryfikowana jeszcze raz przed przełączeniem: żaden plik
   korpusu, `.env` ani `.trainctl-secret` nigdy w niej nie był, a jedyne
   wystąpienia `API_KEY=` to placeholdery w dokumentacji.
2. `private: true` zdjęte z pięciu pakietów.
3. Repozytorium publiczne; Discussions wyłączone (kanałem są issues),
   prywatne zgłaszanie podatności włączone, tematy ustawione.
4. Tag `v0.1.0` + GitHub Release.
5. CI zielone na czterech konfiguracjach (Linux/Windows × Node 22.18/24),
   badge w obu README świeci.

## npm — opublikowane 2026-08-07/08

`trainctl`, `trainctl-core`, `trainctl-export`, `trainctl-mcp`,
`trainctl-sync-intervalsicu` — wszystkie w wersji **0.1.1**.

**0.1.0 było zepsute i jest zdeprecjonowane.** Paczki publikowały źródło TS
(`exports`/`bin` → `.ts`), a Node odmawia zdejmowania typów pod `node_modules`,
więc `npx trainctl` wywalało się przy starcie. Żaden test tego nie widział —
wszystkie uruchamiają kod z drzewa źródeł. Korekta: ADR-026, wydanie 0.1.1,
plus dwa strażniki (`packaging.test.ts` i job `dist` w CI, który instaluje
tarballe do czystego katalogu i uruchamia binarki z `node_modules`).

Lekcja na przyszłe wydania: **`npx <paczka>` w czystym katalogu jest częścią
publikacji, nie sprzątaniem po niej.**

Publikacja wymaga tokenu granularnego z „Bypass 2FA" (samo `npm login` nie
wystarcza — npm odrzuca `publish` z 403). Sekwencja:

```bash
npm config set //registry.npmjs.org/:_authToken <token>
pnpm build && pnpm release:dry     # przeczytaj listę plików KAŻDEJ paczki
pnpm publish -r --access public
npx <paczka>@<wersja> --version    # z rejestru, w pustym katalogu
```

**Build jest od 0.1.1 obowiązkowy** (ADR-026): `pnpm build` → `dist/` z JS,
deklaracjami i mapami źródeł; `publishConfig` przestawia wejścia paczki na
`dist/*.js`, a w repozytorium nic się nie zmienia — dalej jedziemy na natywnym
type-strippingu Node ≥ 22.18, którego wymaga `engines`.

## Czego NIE publikować nigdy

- `corpus/` w jakiejkolwiek postaci (PII trenera i zawodnika).
- `corpus/parsed/BACKTEST.md` i `long-run-profile.json` — generowane lokalnie,
  zawierają daty startów użytkownika; są w .gitignore razem z resztą korpusu.
- Wyników `trainctl init --from-intervals` z realnego konta w przykładach docs.
- `.env`, `.trainctl-secret` — w .gitignore, weryfikowane przy każdym
  uruchomieniu CLI (ostrzeżenie, gdy sekret leży w repo bez ochrony).
