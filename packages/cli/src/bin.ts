#!/usr/bin/env node
/**
 * trainctl — coach treningowy w terminalu.
 * Cienki adapter: handlery zwracają bloki, tu zamieniamy je na kolorowy tekst.
 * MCP używa tych samych handlerów i dostaje wersję bez ANSI (ui/blocks.ts).
 */
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { Command, InvalidArgumentError, type Option } from 'commander'
import { resolveLocale, setLocale } from 'trainctl-core'
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
  cmdRules,
  cmdShift,
  cmdShorten,
  cmdStatus,
  cmdToday,
  cmdWeek,
  cmdWhy,
  completionScript,
  fetchInferredProfile,
  hasApiKey,
  localToday,
  resolveDateInput,
  simulationNotice,
  SHELLS,
  type CmdResult,
  type CompletionSpec,
  type DateDirection,
  type Shell,
} from './commands.ts'
import { runExportPicker, runLogPrompt, runShiftPicker, runWeekBrowser } from './interactive.ts'
import { b, renderAnsi, renderPlain } from './ui/blocks.ts'
import { Theme } from './ui/theme.ts'
import { withSpinner } from './ui/spinner.ts'
import { runWizard, toYaml } from './ui/wizard.ts'
import { select } from './ui/select.ts'
import { packageVersion } from './version.ts'

/** Wartość globalnej opcji czytana z argv PRZED zbudowaniem drzewa komend. */
function argValue(names: string[]): string | undefined {
  const argv = process.argv
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!
    for (const name of names) {
      if (arg === name) return argv[i + 1]
      if (name.startsWith('--') && arg.startsWith(`${name}=`)) return arg.slice(name.length + 1)
    }
  }
  return undefined
}

// Katalog treningowy: -C/--dir > TRAINCTL_DIR > bieżący katalog. Ustalany przed
// `.env` i językiem, bo oba czytamy z katalogu treningowego, nie z procesu.
const cwd = resolve(process.cwd(), argValue(['-C', '--dir']) ?? process.env['TRAINCTL_DIR'] ?? '.')
const jsonMode = process.argv.includes('--json')

// `.env` PRZED wszystkim innym: ma działać nie tylko dla klucza API, ale też
// dla TRAINCTL_LANG, a język ustalamy zaraz niżej. `loadEnvFile` nie nadpisuje
// zmiennych już obecnych w środowisku — jawny export wygrywa nad plikiem.
const envFile = loadEnvFile(cwd)

// Język ustalamy PRZED zbudowaniem drzewa komend: opisy w `--help` też są
// tłumaczone, a commander czyta je w momencie definiowania komendy.
// Kolejność źródeł: --lang > TRAINCTL_LANG > language w trainctl.yaml > angielski.
setLocale(
  resolveLocale({
    flag: argValue(['--lang']),
    env: process.env['TRAINCTL_LANG'],
    config: readConfigLanguage(cwd),
  }),
)

const theme = new Theme()
const program = new Command()
/** Tryby interaktywne tylko w terminalu i nigdy przy --json (wyjście ma być danymi). */
const tty = process.stdin.isTTY === true && !jsonMode

// Ostrzeżenie na stderr, nie na stdout: wyjście komend bywa przekierowywane
// do pliku albo potoku, a to jest komunikat dla człowieka, nie dane.
if (envFile.unprotected) {
  console.error(
    `${theme.color(theme.sym.warn, 'warn')} ${ui().envFile.unprotected(ENV_FILE, '.gitignore')}`,
  )
}

function print(result: CmdResult): void {
  // Symulowana data nigdy nie jest cicha (ADR-034): pierwszy wiersz każdego wyjścia.
  const notice = simulationNotice()
  if (jsonMode) {
    console.log(JSON.stringify({
      code: result.code,
      ...(notice ? { notice } : {}),
      data: result.data ?? {},
      output: result.blocks ? renderPlain(result.blocks) : result.output,
    }, null, 2))
  } else if (result.blocks) {
    console.log(renderAnsi(notice ? [b.warn(notice), ...result.blocks] : result.blocks, theme))
  } else {
    // gotowy tekst (bywa wielowierszowy i już pokolorowany) — bez ponownego zawijania
    if (notice) console.log(renderAnsi([b.warn(notice)], theme))
    console.log(result.output)
  }
  process.exitCode = result.code
}

/** Wynik trybu interaktywnego (gotowy tekst z kolorami) — z tym samym ostrzeżeniem. */
function printInteractive(result: { output: string; code: number }): void {
  const notice = simulationNotice()
  if (notice) console.log(renderAnsi([b.warn(notice)], theme))
  console.log(result.output)
  process.exitCode = result.code
}

const spin = <T,>(label: string, fn: () => Promise<T>): Promise<T> => (jsonMode ? fn() : withSpinner(label, fn, theme))

// --- daty względne (ADR: tylko CLI; MCP przyjmuje ISO) -----------------------
const dateArg = (direction: DateDirection) => (value: string): string => {
  try {
    return resolveDateInput(value, localToday(), direction)
  } catch (e) {
    throw new InvalidArgumentError(e instanceof Error ? e.message : String(e))
  }
}
const datesArg = (direction: DateDirection) => (value: string, previous?: string[]): string[] =>
  [...(previous ?? []), dateArg(direction)(value)]
/** `--time thu=40` → `2026-08-06=40`: data może być względna, minuty bez zmian. */
const budgetArg = (value: string, previous?: string[]): string[] => {
  const at = value.lastIndexOf('=')
  const date = at === -1 ? value : value.slice(0, at)
  return [...(previous ?? []), at === -1 ? value : `${dateArg('forward')(date)}${value.slice(at)}`]
}
const ahead = dateArg('forward')
const back = dateArg('back')

const s = theme.sym
const banner =
  theme.bold(theme.color('trainctl', 'brand')) +
  theme.dim(` ${s.dot} ${ui().cmd.banner}`)

program
  .name('trainctl')
  .description(banner)
  .version(packageVersion(), '-V, --version', ui().cmd.version)
  .option('--lang <code>', ui().cmd.lang)
  .option('-C, --dir <path>', ui().cmd.optDir)
  .option('--json', ui().cmd.optJson)
  .configureHelp({
    styleTitle: (str) => theme.bold(theme.color(str, 'accent')),
    styleCommandText: (str) => theme.color(str, 'brand'),
    styleOptionText: (str) => theme.dim(str),
    styleDescriptionText: (str) => str,
  })
  .configureOutput({
    outputError: (str, write) => write(`${theme.color(s.fail, 'error')} ${str}`),
  })
  // Błąd użycia (nieznana komenda albo flaga, zła data) to kod 2 — skrypt i hook
  // odróżnią go od błędu danych albo odmowy (kod 1).
  .exitOverride((err) => {
    process.exit(err.exitCode === 0 ? 0 : 2)
  })

/** Przykłady pod `trainctl help <komenda>` — z katalogu, w języku katalogu treningowego. */
function withExamples(command: Command, name: keyof ReturnType<typeof ui>['examples']): Command {
  const lines = ui().examples[name]
  return command.addHelpText('after', `\n${theme.dim(ui().cmd.examples)}\n${lines.map((l) => `  ${l}`).join('\n')}`)
}

const commitOption = (command: Command) => command.option('--commit [message]', ui().cmd.optCommit)

if (!existsSync(cwd)) {
  console.error(`${theme.color(s.fail, 'error')} ${ui().cmd.dirMissing(cwd)}`)
  process.exit(1)
}

commitOption(
  program
    .command('init')
    .description(ui().cmd.init)
    .option('--template', ui().cmd.initTemplate)
    .option('--from-intervals', ui().cmd.initFromIntervals)
    .option('--agent <name>', ui().cmd.optAgent),
).action(async (opts) => {
  const interactive = opts.template !== true && tty
  if (!interactive) {
    if (opts.fromIntervals === true) {
      return print(await spin(ui().cmd.spinnerInit, () => cmdInitFromIntervals(cwd)))
    }
    return print(cmdInit(cwd, undefined, { commit: opts.commit, agent: opts.agent }))
  }
  try {
    const answers = await runWizard(theme, {
      available: hasApiKey(cwd),
      force: opts.fromIntervals === true,
      fetch: () => fetchInferredProfile(cwd, localToday()),
    })
    // Pliki agenta tylko na wyraźną odpowiedź — „żadnego" to pełnoprawny wybór.
    const agent = opts.agent ?? await select(ui().init.agentQuestion, [
      { label: 'Claude Code', value: 'claude' },
      { label: 'Codex', value: 'codex' },
      { label: 'Claude Code + Codex', value: 'all' },
      { label: ui().init.agentNone, value: 'none' },
    ], theme)
    print(cmdInit(cwd, toYaml(answers), { commit: opts.commit, agent: agent === 'none' ? undefined : agent }))
  } catch (e) {
    // Ctrl+C w kreatorze nie powinno zostawiać stack trace'u
    console.log(theme.dim(`\n${ui().common.interrupted}`))
    process.exitCode = 1
    void e
  }
})

withExamples(
  commitOption(
    program
      .command('plan')
      .description(ui().cmd.plan)
      .option('--date <iso>', ui().cmd.optDate, ahead)
      .option('--fresh', ui().cmd.optFresh),
  ),
  'plan',
).action((opts) => print(cmdPlan(cwd, opts)))

program
  .command('today')
  .description(ui().cmd.today)
  .option('--date <iso>', ui().cmd.optDateOther, ahead)
  .action((opts) => print(cmdToday(cwd, opts)))

program
  .command('week')
  .description(ui().cmd.week)
  .option('--date <iso>', ui().cmd.optDateWeek, ahead)
  .option('-i, --interactive', ui().cmd.weekInteractive)
  .action(async (opts) => {
    if (opts.interactive !== true || !tty) return print(cmdWeek(cwd, opts))
    printInteractive(await runWeekBrowser(cwd, opts.date ?? localToday(), theme))
  })

withExamples(
  commitOption(
    program
      .command('log')
      .description(ui().cmd.log)
      .option('--date <iso>', ui().cmd.optDate, back)
      .option('--status <s>', ui().cmd.optStatus, 'done')
      .option('--km <n>', ui().cmd.optKm)
      .option('--time <t>', ui().cmd.optTime)
      .option('--test-time <t>', ui().improve.testTime)
      .option('--rpe <n>', ui().cmd.optRpe)
      .option('--note <text>', ui().cmd.optNote),
  ),
  'log',
).action(async (opts, command: Command) => {
  // Bez żadnej flagi w terminalu: pytania zamiast cichego „dziś: done".
  // Poza terminalem (skrypt, agent) zachowanie bez zmian.
  const flags = ['date', 'km', 'time', 'testTime', 'rpe', 'note', 'commit'].some((k) => opts[k] !== undefined) ||
    command.getOptionValueSource('status') !== 'default'
  if (!flags && tty) return printInteractive(await runLogPrompt(cwd, localToday(), theme))
  print(cmdLog(cwd, opts))
})

commitOption(
  program
    .command('shift')
    .description(ui().cmd.shift)
    .option('--from <iso>', ui().cmd.optFrom, ahead)
    .option('--to <iso>', ui().cmd.optTo, ahead),
).action(async (opts) => {
  if (opts.from && opts.to) return print(cmdShift(cwd, opts))
  if (opts.from || opts.to || !tty) {
    return print({ code: 1, output: ui().shift.bothDates })
  }
  printInteractive(await runShiftPicker(cwd, localToday(), theme))
})

program
  .command('why')
  .description(ui().cmd.why)
  .option('--date <iso>', ui().cmd.optDateOther, ahead)
  .action((opts) => print(cmdWhy(cwd, opts)))

withExamples(
  commitOption(
    program
      .command('adapt')
      .description(ui().cmd.adapt)
      .option('--prepare', ui().improve.prepare)
      .option('--apply <id>', ui().improve.apply)
      .option('--date <iso>', ui().cmd.optDate, back),
  ),
  'adapt',
).action((opts) => print(cmdAdapt(cwd, opts)))

withExamples(
  commitOption(
    program
      .command('shorten')
      .description(ui().coach.shorten)
      .option('--minutes <n>', ui().coach.minutes)
      .option('--date <iso>', ui().cmd.optDateOther, ahead)
      .option('--apply <id>', ui().improve.apply),
  ),
  'shorten',
).action((opts) => print(cmdShorten(cwd, opts)))

program
  .command('desk')
  .description(ui().cmd.desk)
  .option('--date <iso>', ui().cmd.optDateOther, ahead)
  .option('--heavy', ui().cmd.optHeavy)
  .action((opts) => print(cmdDesk(cwd, opts)))

withExamples(
  program
    .command('push')
    .description(ui().cmd.push)
    .option('--from <iso>', ui().cmd.optFromRange, ahead)
    .option('--to <iso>', ui().cmd.optToRange, ahead)
    .option('--days <n>', ui().cmd.optDaysAhead),
  'push',
).action(async (opts) => print(await spin(ui().cmd.spinnerPush, () => cmdPush(cwd, opts))))

withExamples(
  program
    .command('pull')
    .description(ui().cmd.pull)
    .option('--date <iso>', ui().cmd.optDate, back)
    .option('--days <n>', ui().cmd.optDaysBack)
    .option('--from <path>', ui().cmd.optPullFrom),
  'pull',
).action(async (opts) => print(await spin(ui().cmd.spinnerPull, () => cmdPull(cwd, opts))))

withExamples(
  program
    .command('export')
    .description(ui().cmd.export)
    .option('--what <kind>', ui().cmd.optExportWhat)
    .option('--date <iso>', ui().cmd.optExportDate, ahead),
  'export',
).action(async (opts) => {
  if (opts.what) return print(cmdExport(cwd, opts))
  if (!tty) {
    return print({
      code: 1,
      output: ui().exportCmd.pickWhat,
    })
  }
  const answer = await runExportPicker(cwd, localToday(), theme)
  if (!answer) return print({ code: 0, output: theme.dim(ui().common.cancelled) })
  print(cmdExport(cwd, answer))
})

withExamples(
  commitOption(
    program
      .command('reschedule')
      .description(ui().cmd.reschedule)
      .option('--time <budget...>', ui().improve.time, budgetArg)
      .option('--pin <iso...>', ui().improve.pin, datesArg('forward'))
      .option('--preparation <minutes>', ui().improve.preparation)
      .option('--strategy <kind>', ui().improve.strategy)
      .option('--block <iso...>', ui().cmd.optBlock, datesArg('forward'))
      .option('--date <iso>', ui().cmd.optWhichWeek, ahead)
      .option('--apply', ui().cmd.optApply),
  ),
  'reschedule',
).action((opts) => print(cmdReschedule(cwd, opts)))

withExamples(
  program
    .command('review')
    .description(ui().cmd.review)
    .option('--prepare', ui().coach.reviewPrepare)
    .option('--days <n>', ui().cmd.optReviewDays)
    .option('--date <iso>', ui().cmd.optDate, back),
  'review',
).action(async (opts) => print(await spin(ui().cmd.spinnerReview, () => cmdReview(cwd, opts))))

withExamples(
  program
    .command('diff')
    .description(ui().cmd.diff)
    .option('--plan <file>', ui().cmd.optDiffPlan),
  'diff',
).action((opts) => print(cmdDiff(cwd, opts)))

program
  .command('check')
  .description(ui().cmd.check)
  .option('--strict', ui().cmd.optStrict)
  .action((opts) => print(cmdCheck(cwd, opts)))

program
  .command('rules')
  .description(ui().cmd.rules)
  .argument('[id]', 'I-7, T-10, …')
  .action((id?: string) => print(cmdRules({ id })))

withExamples(
  program
    .command('status')
    .description(ui().cmd.status),
  'status',
).action(() => print(cmdStatus(cwd)))

program
  .command('completion')
  .description(ui().cmd.completion)
  .argument('<shell>', SHELLS.join(' | '))
  .action((shell: string) => {
    if (!(SHELLS as readonly string[]).includes(shell)) {
      return print({ code: 2, output: ui().cmd.completionShell(SHELLS.join(', ')) })
    }
    const optionsOf = (options: readonly Option[]) =>
      options.map((o) => ({ long: o.long ?? '', ...(o.short ? { short: o.short } : {}), description: o.description }))
        .filter((o) => o.long)
    const specs: CompletionSpec[] = program.commands
      .filter((c) => c.name() !== 'completion')
      .map((c) => ({ name: c.name(), description: c.description(), options: optionsOf(c.options) }))
    // skrypt to dane dla powłoki — bez ostrzeżeń i bez JSON
    process.stdout.write(completionScript(shell as Shell, specs, optionsOf(program.options)))
  })

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
    theme.dim(ui().cmd.datesHint) +
    '\n' +
    theme.dim(ui().cmd.dirHint) +
    '\n' +
    theme.dim(ui().cmd.colorsHint),
)

await program.parseAsync()
