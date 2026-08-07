#!/usr/bin/env node
/**
 * trainctl — coach treningowy w terminalu.
 * Cienki adapter: handlery zwracają bloki, tu zamieniamy je na kolorowy tekst.
 * MCP używa tych samych handlerów i dostaje wersję bez ANSI (ui/blocks.ts).
 */
import { Command } from 'commander'
import { resolveLocale, setLocale } from '@trainctl/core'
import { readConfigLanguage } from './config.ts'
import { loadEnvFile, ENV_FILE } from './env-file.ts'
import { ui } from './i18n/index.ts'
import {
  cmdAdapt,
  cmdCheck,
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

const cwd = process.cwd()

// `.env` PRZED wszystkim innym: ma działać nie tylko dla klucza API, ale też
// dla TRAINCTL_LANG, a język ustalamy zaraz niżej. `loadEnvFile` nie nadpisuje
// zmiennych już obecnych w środowisku — jawny export wygrywa nad plikiem.
const envFile = loadEnvFile(cwd)

// Język ustalamy PRZED zbudowaniem drzewa komend: opisy w `--help` też są
// tłumaczone, a commander czyta je w momencie definiowania komendy.
// Kolejność źródeł: --lang > TRAINCTL_LANG > language w trainctl.yaml > angielski.
const langFlagIndex = process.argv.findIndex((a) => a === '--lang' || a.startsWith('--lang='))
const langFlag =
  langFlagIndex === -1
    ? undefined
    : process.argv[langFlagIndex]!.includes('=')
      ? process.argv[langFlagIndex]!.split('=')[1]
      : process.argv[langFlagIndex + 1]
setLocale(
  resolveLocale({
    flag: langFlag,
    env: process.env['TRAINCTL_LANG'],
    config: readConfigLanguage(cwd),
  }),
)

const theme = new Theme()
const program = new Command()

// Ostrzeżenie na stderr, nie na stdout: wyjście komend bywa przekierowywane
// do pliku albo potoku, a to jest komunikat dla człowieka, nie dane.
if (envFile.unprotected) {
  console.error(
    `${theme.color(theme.sym.warn, 'warn')} ${ui().envFile.unprotected(ENV_FILE, '.gitignore')}`,
  )
}

function print(result: CmdResult): void {
  console.log(result.blocks ? renderAnsi(result.blocks, theme) : result.output)
  process.exitCode = result.code
}

const s = theme.sym
const banner =
  theme.bold(theme.color('trainctl', 'brand')) +
  theme.dim(` ${s.dot} ${ui().cmd.banner}`)

program
  .name('trainctl')
  .description(banner)
  .option('--lang <code>', ui().cmd.lang)
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
  .description(ui().cmd.init)
  .option('--template', ui().cmd.initTemplate)
  .option('--from-intervals', ui().cmd.initFromIntervals)
  .action(async (opts) => {
    const interactive = opts.template !== true && process.stdin.isTTY === true
    if (!interactive) {
      if (opts.fromIntervals === true) {
        return print(
          await withSpinner(ui().cmd.spinnerInit, () => cmdInitFromIntervals(cwd), theme),
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
      console.log(theme.dim(`\n${ui().common.interrupted}`))
      process.exitCode = 1
      void e
    }
  })

program
  .command('plan')
  .description(ui().cmd.plan)
  .option('--date <iso>', ui().cmd.optDate)
  .action((opts) => print(cmdPlan(cwd, opts)))

program
  .command('today')
  .description(ui().cmd.today)
  .option('--date <iso>', ui().cmd.optDateOther)
  .action((opts) => print(cmdToday(cwd, opts)))

program
  .command('week')
  .description(ui().cmd.week)
  .option('--date <iso>', ui().cmd.optDateWeek)
  .option('-i, --interactive', ui().cmd.weekInteractive)
  .action(async (opts) => {
    if (opts.interactive !== true) return print(cmdWeek(cwd, opts))
    const result = await runWeekBrowser(cwd, opts.date ?? localToday(), theme)
    console.log(result.output)
    process.exitCode = result.code
  })

program
  .command('log')
  .description(ui().cmd.log)
  .option('--date <iso>', ui().cmd.optDate)
  .option('--status <s>', ui().cmd.optStatus, 'done')
  .option('--km <n>', ui().cmd.optKm)
  .option('--time <t>', ui().cmd.optTime)
  .option('--note <text>', ui().cmd.optNote)
  .action((opts) => print(cmdLog(cwd, opts)))

program
  .command('shift')
  .description(ui().cmd.shift)
  .option('--from <iso>', ui().cmd.optFrom)
  .option('--to <iso>', ui().cmd.optTo)
  .action(async (opts) => {
    if (opts.from && opts.to) return print(cmdShift(cwd, opts))
    if (opts.from || opts.to) {
      return print({
        code: 1,
        output: ui().shift.bothDates,
      })
    }
    const result = await runShiftPicker(cwd, localToday(), theme)
    console.log(result.output)
    process.exitCode = result.code
  })

program
  .command('why')
  .description(ui().cmd.why)
  .option('--date <iso>', ui().cmd.optDateOther)
  .action((opts) => print(cmdWhy(cwd, opts)))

program
  .command('adapt')
  .description(ui().cmd.adapt)
  .option('--date <iso>', ui().cmd.optDate)
  .action((opts) => print(cmdAdapt(cwd, opts)))

program
  .command('desk')
  .description(ui().cmd.desk)
  .option('--date <iso>', ui().cmd.optDateOther)
  .option('--heavy', ui().cmd.optHeavy)
  .action((opts) => print(cmdDesk(cwd, opts)))

program
  .command('push')
  .description(ui().cmd.push)
  .option('--from <iso>', ui().cmd.optFromRange)
  .option('--to <iso>', ui().cmd.optToRange)
  .option('--days <n>', ui().cmd.optDaysAhead)
  .action(async (opts) =>
    print(await withSpinner(ui().cmd.spinnerPush, () => cmdPush(cwd, opts), theme)),
  )

program
  .command('pull')
  .description(ui().cmd.pull)
  .option('--days <n>', ui().cmd.optDaysBack)
  .action(async (opts) =>
    print(await withSpinner(ui().cmd.spinnerPull, () => cmdPull(cwd, opts), theme)),
  )

program
  .command('export')
  .description(ui().cmd.export)
  .option('--what <kind>', ui().cmd.optExportWhat)
  .option('--date <iso>', ui().cmd.optExportDate)
  .action(async (opts) => {
    if (opts.what) return print(cmdExport(cwd, opts))
    if (process.stdin.isTTY !== true) {
      return print({
        code: 1,
        output: ui().exportCmd.pickWhat,
      })
    }
    const answer = await runExportPicker(cwd, localToday(), theme)
    if (!answer) return print({ code: 0, output: theme.dim(ui().common.cancelled) })
    print(cmdExport(cwd, answer))
  })

program
  .command('reschedule')
  .description(ui().cmd.reschedule)
  .option('--block <iso...>', ui().cmd.optBlock)
  .option('--date <iso>', ui().cmd.optWhichWeek)
  .option('--apply', ui().cmd.optApply)
  .action((opts) => print(cmdReschedule(cwd, opts)))

program
  .command('review')
  .description(ui().cmd.review)
  .option('--days <n>', ui().cmd.optReviewDays)
  .option('--date <iso>', ui().cmd.optDate)
  .action(async (opts) =>
    print(await withSpinner(ui().cmd.spinnerReview, () => cmdReview(cwd, opts), theme)),
  )

program
  .command('diff')
  .description(ui().cmd.diff)
  .option('--plan <file>', ui().cmd.optDiffPlan)
  .action((opts) => print(cmdDiff(cwd, opts)))

program
  .command('check')
  .description(ui().cmd.check)
  .option('--strict', ui().cmd.optStrict)
  .action((opts) => print(cmdCheck(cwd, opts)))

program.addHelpText(
  'after',
  '\n' +
    theme.dim(ui().cmd.firstSteps) +
    theme.color('trainctl init', 'brand') +
    theme.dim(' → ') +
    theme.color('trainctl plan', 'brand') +
    theme.dim(' → ') +
    theme.color('trainctl today', 'brand') +
    '\n' +
    theme.dim(ui().cmd.interactively) +
    theme.color('trainctl shift', 'brand') +
    theme.dim(ui().cmd.pickFromList) +
    theme.color('trainctl week -i', 'brand') +
    theme.dim(ui().cmd.browseArrows) +
    '\n' +
    theme.dim(ui().cmd.colorsHint),
)

program.parse()
