# Publikacja OSS — stan przygotowania i decyzje do podjęcia

Stan na 2026-08-06. Repo jest **gotowe technicznie** do upublicznienia; zostały
decyzje, które podejmuje właściciel, nie kod.

## Co jest zrobione

- **Historia gita czysta** (zweryfikowane 2026-08-06): żaden commit nie zawiera
  plików korpusu (`corpus/` w .gitignore z kotwicą od początku). Upublicznienie
  nie wymaga przepisywania historii.
- **LICENSE**: MIT, copyright Dariusz Tyszka — domyślny wybór dla narzędzi CLI;
  łatwy do zmiany, dopóki nic nie opublikowano.
- **Metadane pakietów**: `license`, `description`, `engines` w package.json.
- **Sekrety**: klucz API wyłącznie env/`.trainctl-secret` (ADR-009), zweryfikowane
  grepem po całej historii.

## Decyzje do podjęcia (właściciel)

| # | Decyzja | Kontekst |
|---|---|---|
| 1 | ~~**Nazwa na npm**~~ | **Rozstrzygnięte 2026-08-06.** Pierwotne `tren` było zajęte (martwy silnik szablonów, 2021, v1.0.0), więc projekt przemianowano na **`trainctl`** — wolne na npm i na GitHubie. Nazwa obejmuje komendę, scope `@trainctl/*`, plik `trainctl.yaml`, zmienne `TRAINCTL_*` i prefiks `external_id` |
| 2 | **Licencja** | MIT wpisane jako default; jeśli wolisz AGPL (utrudnia komercyjne forki typu icusync) — zmień PRZED publikacją |
| 3 | **Hosting repo** | konto osobiste vs organizacja; wpływa na pole `repository` w package.json |
| 4 | **Czy publikować na npm w ogóle** | alternatywa minimalna: publiczne repo GitHub + instrukcja `git clone && pnpm install` — zero utrzymania wersji npm |
| 5 | **Utrzymanie** | publiczne repo = issues od obcych ludzi; realny koszt czasu |

## Jak opublikować (gdy decyzje zapadną)

1. Uzupełnij `repository`/`homepage`/`bugs` w package.json (root + pakiety).
2. Jeśli npm: zmień nazwy publikowanych pakietów wg decyzji #1 (wewnętrzne
   `@trainctl/*` mogą zostać, jeśli publikujesz tylko CLI jako bundel — wtedy
   trzeba dodać krok budowania, patrz niżej).
3. **Dystrybucja bez kroku budowania** działa tylko dla Node ≥ 22.18 / ≥ 23.6
   (natywny type-stripping; wersje 23.0–23.5 wymagają flagi). `engines` to
   wymusza. Jeśli zasięg ma być większy — dopiero wtedy dodaj build (esbuild
   do ESM+d.ts), zgodnie z ADR-007 („build dojdzie przy publikacji").
4. `pnpm publish -r --dry-run` i przegląd zawartości paczek (pole `files`!).
5. Tag `v0.1.0`, GitHub Release z linkiem do SPEC i FOUNDATIONS.

## Czego NIE publikować nigdy

- `corpus/` w jakiejkolwiek postaci (PII trenera i zawodnika).
- `corpus/parsed/BACKTEST.md` — generowany lokalnie, zawiera daty startów
  użytkownika; jest w .gitignore razem z resztą korpusu.
- Wyników `trainctl init --from-intervals` z realnego konta w przykładach docs.
