/**
 * Serwer MCP „tren" — te same use-case'y co CLI, jako narzędzia agenta.
 * Cienki adapter: handlery z @tren/cli są warstwą use-case'ów (ADR-008);
 * tu tylko schematy wejść i mapowanie CmdResult → wynik narzędzia MCP.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import {
  cmdDiff,
  cmdInit,
  cmdLog,
  cmdPlan,
  cmdPull,
  cmdPush,
  cmdShift,
  cmdToday,
  cmdWeek,
  cmdWhy,
  type CmdResult,
} from '@tren/cli'

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'data w formacie YYYY-MM-DD')

function toTool(r: CmdResult) {
  return {
    content: [{ type: 'text' as const, text: r.output }],
    ...(r.code !== 0 ? { isError: true } : {}),
  }
}

export function createTrenServer(dir: string): McpServer {
  const server = new McpServer({ name: 'tren', version: '0.1.0' })

  server.registerTool(
    'tren_init',
    {
      description:
        'Utwórz szablon tren.yaml (profil atlety i cel) w katalogu treningowym. ' +
        'Nie nadpisuje istniejącego pliku.',
      inputSchema: {},
    },
    async () => toTool(cmdInit(dir)),
  )

  server.registerTool(
    'tren_plan',
    {
      description:
        'Wygeneruj plan treningowy z tren.yaml → plan/plan.yaml + plan/PLAN.md. ' +
        'Zwraca podsumowanie: szczyt objętości, predykcję wyniku (przedział) i ocenę realności celu. ' +
        'NADPISUJE istniejący plan — przy wątpliwościach najpierw tren_diff.',
      inputSchema: { date: isoDate.optional().describe('data „dzisiaj" (domyślnie: bieżąca)') },
    },
    async (args) => toTool(cmdPlan(dir, args)),
  )

  server.registerTool(
    'tren_today',
    {
      description: 'Trening na dziś (albo wskazaną datę): opis jednostki, kilometraż, status z dziennika.',
      inputSchema: { date: isoDate.optional() },
    },
    async (args) => toTool(cmdToday(dir, args)),
  )

  server.registerTool(
    'tren_week',
    {
      description:
        'Podgląd całego tygodnia treningowego (faza, cel km, dzień po dniu, statusy z dziennika). ' +
        'Użyj PRZED renegocjacją tygodnia (tren_shift), żeby zobaczyć kontekst.',
      inputSchema: { date: isoDate.optional().describe('dowolna data w interesującym tygodniu') },
    },
    async (args) => toTool(cmdWeek(dir, args)),
  )

  server.registerTool(
    'tren_log',
    {
      description: 'Zapisz wykonanie treningu w dzienniku (log.jsonl).',
      inputSchema: {
        date: isoDate.optional(),
        status: z.enum(['done', 'skipped', 'modified']).optional().describe('domyślnie done'),
        km: z.string().optional().describe('przebiegnięte km'),
        time: z.string().optional().describe('czas MM:SS albo HH:MM:SS'),
        note: z.string().optional().describe('samopoczucie, warunki, uwagi'),
      },
    },
    async (args) => toTool(cmdLog(dir, args)),
  )

  server.registerTool(
    'tren_shift',
    {
      description:
        'Renegocjacja tygodnia: zamień treningi między dwiema datami TEGO SAMEGO tygodnia ' +
        '(np. „w czwartek release — przesuń interwały"). Chroni dzień startu i dzień przed nim; ' +
        'ostrzega przy złamaniu zasady 48 h między akcentami (I-7).',
      inputSchema: {
        from: isoDate.describe('data treningu do przesunięcia'),
        to: isoDate.describe('data docelowa (treningi zostają zamienione)'),
      },
    },
    async (args) => toTool(cmdShift(dir, args)),
  )

  server.registerTool(
    'tren_why',
    {
      description:
        'Wyjaśnij trening: cel fizjologiczny jednostki + reguły z badań (ID z docs/science/FOUNDATIONS.md).',
      inputSchema: { date: isoDate.optional() },
    },
    async (args) => toTool(cmdWhy(dir, args)),
  )

  server.registerTool(
    'tren_push',
    {
      description:
        'Wypchnij zaplanowane treningi do intervals.icu — trafiają na zegarek (Garmin/Coros/Wahoo) ' +
        'jako treningi strukturalne z celami tempa. Wymaga klucza API (env TREN_INTERVALS_API_KEY ' +
        'albo plik .tren-secret). Ponowny push nadpisuje te same dni (upsert).',
      inputSchema: {
        from: isoDate.optional().describe('początek zakresu (domyślnie dziś)'),
        to: isoDate.optional().describe('koniec zakresu'),
        days: z.string().optional().describe('ile dni do przodu, domyślnie 14'),
      },
    },
    async (args) => toTool(await cmdPush(dir, args)),
  )

  server.registerTool(
    'tren_pull',
    {
      description:
        'Pobierz wykonane aktywności i dane wellness z intervals.icu, zapisz migawkę (sync.json) ' +
        'i porównaj wykonanie z planem (rozjazdy: krótsze/dłuższe/brak wykonania/nieplanowane).',
      inputSchema: { days: z.string().optional().describe('ile dni wstecz, domyślnie 28') },
    },
    async (args) => toTool(await cmdPull(dir, args)),
  )

  server.registerTool(
    'tren_diff',
    {
      description:
        'Dry-run: co zmieniłaby regeneracja planu z aktualnego tren.yaml (nowe wyniki, zmiana profilu). ' +
        'Nic nie zapisuje.',
      inputSchema: {},
    },
    async () => toTool(cmdDiff(dir)),
  )

  return server
}
