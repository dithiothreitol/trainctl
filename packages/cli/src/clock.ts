/**
 * Zegar CLI: lokalna data kalendarzowa albo jawna symulacja (ADR-034).
 *
 * Ochrona przeszłości (A05) idzie po prawdziwym zegarze, nie po `--date` —
 * i słusznie. Bez sankcjonowanej symulacji nie dało się jednak odtworzyć
 * przykładów z dokumentacji ani ręcznie sprawdzić scenariusza „za trzy
 * tygodnie" na katalogu z planem w przeszłości. `TRAINCTL_TODAY` przesuwa
 * zegar w całości — ochrona przeszłości obowiązuje względem daty symulowanej —
 * i nigdy nie jest cicha: CLI i MCP mówią o niej w każdym wyjściu.
 */
import { parseIso } from 'trainctl-core'
import { ui } from './i18n/index.ts'

export const SIMULATED_TODAY_ENV = 'TRAINCTL_TODAY'

/** Data symulowana albo undefined; zły format to błąd, nie cichy powrót do zegara. */
export function simulatedToday(): string | undefined {
  const raw = process.env[SIMULATED_TODAY_ENV]?.trim()
  if (!raw) return undefined
  try {
    parseIso(raw)
  } catch {
    throw new Error(ui().clock.badSimulatedDate(SIMULATED_TODAY_ENV, raw))
  }
  return raw
}

/** „Dziś" dla wszystkich komend: symulacja, a bez niej lokalna data kalendarzowa. */
export function clockToday(): string {
  const simulated = simulatedToday()
  if (simulated) return simulated
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** Ostrzeżenie do dołożenia przed każdym wyjściem; undefined, gdy zegar jest prawdziwy. */
export function simulationNotice(): string | undefined {
  try {
    const simulated = simulatedToday()
    return simulated ? ui().clock.simulated(SIMULATED_TODAY_ENV, simulated) : undefined
  } catch (e) {
    return e instanceof Error ? e.message : String(e)
  }
}
