/**
 * Persona trenera dla agenta pracującego w katalogu treningowym (faza 8).
 * Plik trafia do katalogu użytkownika przy `trainctl init` i jest czytany przez
 * Claude Code / Codex jako instrukcja projektu — bez niego agent zna narzędzia,
 * ale nie wie, jak być trenerem.
 *
 * Treść mieszka w katalogu tłumaczeń (`i18n/cli-*.ts`): agent ma mówić w tym
 * samym języku, co `plan/PLAN.md` i wyjście komend.
 */
import { ui } from './i18n/index.ts'

export const AGENTS_FILE = 'AGENTS.md'

export const agentsTemplate = (): string => ui().agentsMd()
