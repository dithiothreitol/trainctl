#!/usr/bin/env node
/**
 * tren — coach treningowy w terminalu.
 * Cienki adapter: handlery zwracają bloki, tu zamieniamy je na kolorowy tekst.
 * MCP używa tych samych handlerów i dostaje wersję bez ANSI (ui/blocks.ts).
 */
import { Command } from 'commander'
import {
  cmdAdapt,
  cmdDesk,
  cmdDiff,
  cmdExport,
  cmdInit,
  cmdInitFromIntervals,
  cmdLog,
  cmdPlan,
  cmdPull,
  cmdPush,
  cmdReschedule,
  cmdReview,
  cmdShift,
  cmdToday,
  cmdWeek,
  cmdWhy,
  fetchInferredProfile,
  hasApiKey,
  localToday,
  type CmdResult,
} from './commands.ts'
import { runExportPicker, runShiftPicker, runWeekBrowser } from './interactive.ts'
import { renderAnsi } from './ui/blocks.ts'
import { Theme } from './ui/theme.ts'
import { withSpinner } from './ui/spinner.ts'
import { runWizard, toYaml } from './ui/wizard.ts'

const theme = new Theme()
const cwd = process.cwd()
const program = new Command()

function print(result: CmdResult): void {
  console.log(result.blocks ? renderAnsi(result.blocks, theme) : result.output)
  process.exitCode = result.code
}

const s = theme.sym
const banner =
  theme.bold(theme.color('tren', 'brand')) +
  theme.dim(` ${s.dot} plan treningowy jako kod, trener jako narzędzie agenta`)

program
  .name('tren')
  .description(banner)
  .configureHelp({
    styleTitle: (str) => theme.bold(theme.color(str, 'accent')),
    styleCommandText: (str) => theme.color(str, 'brand'),
    styleOptionText: (str) => theme.dim(str),
    styleDescriptionText: (str) => str,
  })
  .configureOutput({
    outputError: (str, write) => write(`${theme.color(s.fail, 'error')} ${str}`),
  })

program
  .command('init')
  .description('utwórz profil (interaktywnie w terminalu)')
  .option('--template', 'zapisz szablon bez pytań')
  .option('--from-intervals', 'zaproponuj profil z historii intervals.icu (wymaga klucza API)')
  .action(async (opts) => {
    const interactive = opts.template !== true && process.stdin.isTTY === true
    if (!interactive) {
      if (opts.fromIntervals === true) {
        return print(
          await withSpinner('pobieram historię z intervals.icu…', () => cmdInitFromIntervals(cwd), theme),
        )
      }
      return print(cmdInit(cwd))
    }
    try {
      const answers = await runWizard(theme, {
        available: hasApiKey(cwd),
        force: opts.fromIntervals === true,
        fetch: () => fetchInferredProfile(cwd, localToday()),
      })
      print(cmdInit(cwd, toYaml(answers)))
    } catch (e) {
      // Ctrl+C w kreatorze nie powinno zostawiać stack trace'u
      console.log(theme.dim('\nprzerwano'))
      process.exitCode = 1
      void e
    }
  })

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
  .description('podgląd tygodnia; -i włącza przeglądanie strzałkami')
  .option('--date <iso>', 'data w interesującym tygodniu')
  .option('-i, --interactive', 'przeglądaj tygodnie klawiszami (←/→, s, q)')
  .action(async (opts) => {
    if (opts.interactive !== true) return print(cmdWeek(cwd, opts))
    const result = await runWeekBrowser(cwd, opts.date ?? localToday(), theme)
    console.log(result.output)
    process.exitCode = result.code
  })

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
  .description('zamień treningi w tygodniu (bez argumentów: wybór z listy)')
  .option('--from <iso>', 'data źródłowa')
  .option('--to <iso>', 'data docelowa')
  .action(async (opts) => {
    if (opts.from && opts.to) return print(cmdShift(cwd, opts))
    if (opts.from || opts.to) {
      return print({
        code: 1,
        output: 'Podaj obie daty (--from i --to) albo żadnej — wtedy wybierzesz z listy.',
      })
    }
    const result = await runShiftPicker(cwd, localToday(), theme)
    console.log(result.output)
    process.exitCode = result.code
  })

program
  .command('why')
  .description('dlaczego ten trening — cel jednostki i reguły z badań')
  .option('--date <iso>', 'inna data niż dziś')
  .action((opts) => print(cmdWhy(cwd, opts)))

program
  .command('adapt')
  .description('przeanalizuj wykonanie i zaproponuj korekty planu')
  .option('--date <iso>', 'data odniesienia (domyślnie: dziś)')
  .action((opts) => print(cmdAdapt(cwd, opts)))

program
  .command('desk')
  .description('dzień przy biurku: okna treningowe, przerwy, reguła tempa po pracy')
  .option('--date <iso>', 'inna data niż dziś')
  .option('--heavy', 'dziś ciężki dzień kognitywny (długie sesje z agentami)')
  .action((opts) => print(cmdDesk(cwd, opts)))

program
  .command('push')
  .description('wypchnij zaplanowane treningi do intervals.icu (→ zegarek)')
  .option('--from <iso>', 'początek zakresu (domyślnie: dziś)')
  .option('--to <iso>', 'koniec zakresu')
  .option('--days <n>', 'ile dni do przodu (domyślnie 14)')
  .action(async (opts) =>
    print(await withSpinner('wysyłam treningi do intervals.icu…', () => cmdPush(cwd, opts), theme)),
  )

program
  .command('pull')
  .description('pobierz wykonane aktywności i wellness; porównaj z planem')
  .option('--days <n>', 'ile dni wstecz (domyślnie 28)')
  .action(async (opts) =>
    print(await withSpinner('pobieram dane z intervals.icu…', () => cmdPull(cwd, opts), theme)),
  )

program
  .command('export')
  .description('plik na zegarek (FIT), kalendarz (ICS), rozpiska albo pakiet startowy')
  .option('--what <rodzaj>', 'plan | workout | calendar | print | race')
  .option('--date <iso>', 'trening do eksportu (dla --what workout)')
  .action(async (opts) => {
    if (opts.what) return print(cmdExport(cwd, opts))
    if (process.stdin.isTTY !== true) {
      return print({
        code: 1,
        output: 'Podaj rodzaj eksportu: tren export --what plan|workout|calendar|print|race',
      })
    }
    const answer = await runExportPicker(cwd, localToday(), theme)
    if (!answer) return print({ code: 0, output: theme.dim('anulowano') })
    print(cmdExport(cwd, answer))
  })

program
  .command('reschedule')
  .description('przestaw tydzień wokół zajętych dni (solver: akcenty, 48 h, długie)')
  .option('--block <iso...>', 'dni, w których nie możesz trenować')
  .option('--date <iso>', 'który tydzień (domyślnie: bieżący)')
  .option('--apply', 'zapisz zmiany w planie (bez tego tylko podgląd)')
  .action((opts) => print(cmdReschedule(cwd, opts)))

program
  .command('review')
  .description('przegląd tygodnia: co było, sygnały, co przed nami, co zrobić')
  .option('--days <n>', 'ile dni wstecz podsumować (domyślnie 7)')
  .option('--date <iso>', 'data odniesienia (domyślnie: dziś)')
  .action(async (opts) =>
    print(await withSpinner('składam przegląd tygodnia…', () => cmdReview(cwd, opts), theme)),
  )

program
  .command('diff')
  .description('co by się zmieniło po regeneracji planu z aktualnego tren.yaml')
  .action(() => print(cmdDiff(cwd)))

program.addHelpText(
  'after',
  '\n' +
    theme.dim('Pierwsze kroki: ') +
    theme.color('tren init', 'brand') +
    theme.dim(' → ') +
    theme.color('tren plan', 'brand') +
    theme.dim(' → ') +
    theme.color('tren today', 'brand') +
    '\n' +
    theme.dim('Interaktywnie: ') +
    theme.color('tren shift', 'brand') +
    theme.dim(' (wybór z listy) · ') +
    theme.color('tren week -i', 'brand') +
    theme.dim(' (przeglądanie strzałkami)') +
    '\n' +
    theme.dim('Kolory: NO_COLOR=1 wyłącza, TREN_ASCII=1 wymusza znaki ASCII.'),
)

program.parse()
