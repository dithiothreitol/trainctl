#!/usr/bin/env node
/** tren — coach treningowy w terminalu. Cienki adapter nad handlerami. */
import { Command } from 'commander'
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
} from './commands.ts'

const program = new Command()
const cwd = process.cwd()

function print(result: CmdResult): void {
  console.log(result.output)
  process.exitCode = result.code
}

program
  .name('tren')
  .description('Plan treningowy jako kod — trener w terminalu i w agencie (CLI + MCP).')

program
  .command('init')
  .description('utwórz szablon tren.yaml w bieżącym katalogu')
  .action(() => print(cmdInit(cwd)))

program
  .command('plan')
  .description('wygeneruj plan z tren.yaml → plan/plan.yaml + plan/PLAN.md')
  .option('--date <iso>', 'data „dzisiaj" (domyślnie: dziś)')
  .action((opts) => print(cmdPlan(cwd, opts)))

program
  .command('today')
  .description('co mam dziś wybiegać')
  .option('--date <iso>', 'inna data niż dziś')
  .action((opts) => print(cmdToday(cwd, opts)))

program
  .command('week')
  .description('podgląd bieżącego tygodnia (albo tygodnia z --date)')
  .option('--date <iso>', 'data w interesującym tygodniu')
  .action((opts) => print(cmdWeek(cwd, opts)))

program
  .command('log')
  .description('zaloguj wykonanie treningu')
  .option('--date <iso>', 'data (domyślnie: dziś)')
  .option('--status <s>', 'done|skipped|modified', 'done')
  .option('--km <n>', 'przebiegnięte km')
  .option('--time <t>', 'czas MM:SS albo HH:MM:SS')
  .option('--note <text>', 'notatka (samopoczucie, warunki)')
  .action((opts) => print(cmdLog(cwd, opts)))

program
  .command('shift')
  .description('zamień treningi między dwiema datami w tym samym tygodniu')
  .requiredOption('--from <iso>', 'data źródłowa')
  .requiredOption('--to <iso>', 'data docelowa')
  .action((opts) => print(cmdShift(cwd, opts)))

program
  .command('why')
  .description('dlaczego ten trening — cel jednostki i reguły z badań')
  .option('--date <iso>', 'inna data niż dziś')
  .action((opts) => print(cmdWhy(cwd, opts)))

program
  .command('push')
  .description('wypchnij zaplanowane treningi do intervals.icu (→ zegarek)')
  .option('--from <iso>', 'początek zakresu (domyślnie: dziś)')
  .option('--to <iso>', 'koniec zakresu')
  .option('--days <n>', 'ile dni do przodu (domyślnie 14)')
  .action(async (opts) => print(await cmdPush(cwd, opts)))

program
  .command('pull')
  .description('pobierz wykonane aktywności i wellness; porównaj z planem')
  .option('--days <n>', 'ile dni wstecz (domyślnie 28)')
  .action(async (opts) => print(await cmdPull(cwd, opts)))

program
  .command('diff')
  .description('co by się zmieniło po regeneracji planu z aktualnego tren.yaml')
  .action(() => print(cmdDiff(cwd)))

program.parse()
