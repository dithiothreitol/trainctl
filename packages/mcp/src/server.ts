/**
 * Serwer MCP „tren" — te same use-case'y co CLI, jako narzędzia agenta.
 * Cienki adapter: handlery z @tren/cli są warstwą use-case'ów (ADR-008);
 * tu tylko schematy wejść i mapowanie CmdResult → wynik narzędzia MCP.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import {
  cmdAdapt,
  cmdDesk,
  cmdDiff,
  cmdExport,
  cmdInit,
  cmdLog,
  cmdPlan,
  cmdPull,
  cmdPush,
  cmdReschedule,
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
    'tren_adapt',
    {
      description:
        'Porównaj wykonanie (sync.json + dziennik) z planem i zaproponuj korekty: urealnienie ' +
        'objętości, restart po przerwie, protokół po starcie, rekalibrację stref. ' +
        'ZWRACA PROPOZYCJE — nie zmienia planu. Zastosowanie: edycja tren.yaml + tren_plan.',
      inputSchema: { date: isoDate.optional().describe('data odniesienia (domyślnie dziś)') },
    },
    async (args) => toTool(cmdAdapt(dir, args)),
  )

  server.registerTool(
    'tren_desk',
    {
      description:
        'Dzień przy biurku: okna treningowe wokół godzin pracy, przerwy w siedzeniu i reguła ' +
        'prowadzenia sesji po dniu ciężkiej pracy umysłowej (wtedy tempo, nie odczucie). ' +
        'Ustaw heavy=true, gdy dzień był kognitywnie ciężki (długie sesje z agentami). ' +
        'Wymaga sekcji desk w tren.yaml.',
      inputSchema: {
        date: isoDate.optional(),
        heavy: z.boolean().optional().describe('ciężki dzień kognitywny'),
      },
    },
    async (args) => toTool(cmdDesk(dir, args)),
  )

  server.registerTool(
    'tren_export',
    {
      description:
        'Zapisz plan do pliku: `plan` = cały plan jako treningi .fit na zegarek, ' +
        '`workout` = jeden trening .fit (wymaga date), `calendar` = .ics do Google/Outlooka, ' +
        '`print` = rozpiska HTML pod wydruk A4. Pliki lądują w katalogu export/. ' +
        'Gdy użytkownik chce trening „na zegarek" bez kabla — rozważ najpierw tren_push.',
      inputSchema: {
        what: z.enum(['plan', 'workout', 'calendar', 'print']),
        date: isoDate.optional().describe('trening do eksportu przy what=workout'),
      },
    },
    async (args) => toTool(cmdExport(dir, args)),
  )

  server.registerTool(
    'tren_reschedule',
    {
      description:
        'Przestaw CAŁY tydzień wokół dni, w których użytkownik nie może trenować ' +
        '(„w czwartek mam release", „wyjazd wt–śr"). Solver trzyma ≥48 h między akcentami, ' +
        'chroni długie wybieganie i liczbę akcentów, a gdy brakuje dni — mówi, którą jednostkę ' +
        'poświęca i dlaczego. Domyślnie tylko podgląd; apply=true zapisuje plan. ' +
        'Do przesunięcia pojedynczego treningu użyj tren_shift.',
      inputSchema: {
        block: z.array(isoDate).optional().describe('dni bez możliwości treningu'),
        date: isoDate.optional().describe('data wskazująca tydzień (domyślnie bieżący)'),
        apply: z.boolean().optional().describe('true = zapisz zmiany w planie'),
      },
    },
    async (args) => toTool(cmdReschedule(dir, args)),
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
