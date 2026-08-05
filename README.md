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

## Korpus — odtworzenie lokalne

```
# źródła: 50 planów .doc/.docx (2020–2025)
# .doc → .docx: LibreOffice headless
soffice --headless --convert-to docx --outdir corpus/source corpus/source/*.doc
python tools/corpus/extract_text.py   # → corpus/raw-text/*.txt
```
