/**
 * Wersja własnej paczki, czytana z jej `package.json` — serwer ma mówić
 * klientowi MCP swoją wersję, a nie zaszytą liczbę, która milcząco się
 * rozjeżdża z wydaniem (tak było do 0.1.1: manifest mówił 0.1.1, handshake 0.1.0).
 *
 * Kopia z pakietu CLI, nie import: rdzeń nie dotyka dysku (ADR-001), a wspólny
 * helper w CLI raportowałby wersję CLI, nie tę paczkę. Ścieżka `../package.json`
 * trafia w oba układy — `src/server.ts` w repozytorium i `dist/server.js` po
 * instalacji leżą jeden poziom pod korzeniem paczki.
 */
import { readFileSync } from 'node:fs'

export function packageVersion(): string {
  const manifest = JSON.parse(
    readFileSync(new URL('../package.json', import.meta.url), 'utf-8'),
  ) as { version?: string }
  return manifest.version ?? '0.0.0'
}
