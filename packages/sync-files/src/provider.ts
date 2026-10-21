/**
 * Źródło wykonania z lokalnych plików aktywności (ADR-037, pull-only).
 *
 * Implementuje tylko `ActivitySource` — nie udaje, że umie wysyłać treningi.
 * Wellness z plików nie wyczytamy (FIT aktywności nie niesie HRV ani snu),
 * więc `listWellness` zwraca pustą listę. Każde wywołanie skanuje na nowo:
 * katalog to stan na dysku, a nie pamięć podręczna.
 */
import type { ActivitySource, SyncedActivity, SyncedWellness } from 'trainctl-core'
import { scanActivityFiles, type SkippedFile } from './files.ts'

export interface FileActivitySourceOptions {
  /** Katalog z eksportem (przeszukiwany rekurencyjnie) albo pojedynczy plik. */
  path: string
}

export class FileActivitySource implements ActivitySource {
  // UWAGA: bez „parameter properties" — natywny type-stripping Node ich nie obsługuje.
  readonly name = 'files'
  readonly path: string
  private skipped: SkippedFile[] = []

  constructor(opts: FileActivitySourceOptions) {
    this.path = opts.path
  }

  /** Pliki pominięte w ostatnim skanie (wszystkie, bez względu na zakres dat). */
  get lastSkipped(): readonly SkippedFile[] {
    return this.skipped
  }

  /** Aktywności z zakresu `oldest`…`newest` włącznie (daty `YYYY-MM-DD`, lokalne). */
  async listActivities(oldest: string, newest: string): Promise<SyncedActivity[]> {
    const { activities, skipped } = scanActivityFiles(this.path)
    this.skipped = skipped
    return activities.filter((a) => a.date >= oldest && a.date <= newest)
  }

  async listWellness(_oldest: string, _newest: string): Promise<SyncedWellness[]> {
    return []
  }
}
