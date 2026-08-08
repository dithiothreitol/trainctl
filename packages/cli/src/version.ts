/**
 * Wersja własnej paczki, czytana z jej `package.json`.
 *
 * Nie w rdzeniu, bo `core` nie dotyka dysku (ADR-001) — i tak każda paczka ma
 * raportować SWOJĄ wersję, a nie cudzą. Ścieżka `../package.json` trafia
 * w oba układy: `src/bin.ts` w repozytorium i `dist/bin.js` po instalacji,
 * bo w obu ten moduł leży jeden poziom pod korzeniem paczki.
 */
import { readFileSync } from 'node:fs'

export function packageVersion(): string {
  const manifest = JSON.parse(
    readFileSync(new URL('../package.json', import.meta.url), 'utf-8'),
  ) as { version?: string }
  return manifest.version ?? '0.0.0'
}
