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
pnpm tren init        # szablon tren.yaml — uzupełnij profil i wyniki startów
pnpm tren plan        # generuje plan/plan.yaml + plan/PLAN.md (+ predykcja celu)
pnpm tren today       # co dziś wybiegać (--date YYYY-MM-DD dla innego dnia)
pnpm tren why         # dlaczego ten trening — cel jednostki + reguły z badań
pnpm tren log --time 58:30 --note "dobre czucie"
pnpm tren shift --from 2026-08-06 --to 2026-08-07   # renegocjacja w obrębie tygodnia
pnpm tren diff        # co zmieniłaby regeneracja z aktualnego tren.yaml
pnpm tren adapt       # analiza wykonania → propozycje korekt (nie zmienia planu)
pnpm tren desk --heavy   # dzień przy biurku: okna, przerwy, reguła tempa po pracy
```

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

## Agent (MCP)

Ten sam silnik jako narzędzia dla Claude Code / innych klientów MCP:

```
claude mcp add tren --env TREN_DIR="C:\sciezka\do\mojego-treningu" ^
  -- node "C:\...\tren\packages\mcp\src\bin.ts"
```

Narzędzia: `tren_plan`, `tren_today`, `tren_week`, `tren_log`, `tren_shift`,
`tren_why`, `tren_diff`, `tren_init`, `tren_push`, `tren_pull`, `tren_adapt`,
`tren_desk`. Rozmowa jest interfejsem: „co mam dziś
wybiegać?", „w czwartek release — przesuń interwały", „czemu ten trening?".
Agent widzi tydzień (`tren_week`), renegocjuje (`tren_shift` z ochroną dnia
startu i ostrzeżeniem I-7) i tłumaczy plan cytując badania (`tren_why`).

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
