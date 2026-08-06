/**
 * Interaktywny kreator `trainctl init` — zbiera profil w rozmowie zamiast kazać
 * edytować YAML na ślepo. Poza TTY (potok, agent, CI) kreator się nie włącza:
 * wtedy zapisujemy szablon jak dotąd.
 */
import { createInterface, type Interface } from 'node:readline/promises'
import type { InferenceOutcome, InferredProfile } from '@trainctl/core'
import { ui } from '../i18n/index.ts'
import { sparkline, Theme } from './theme.ts'

export interface WizardAnswers {
  goalName: string
  goalDate: string
  goalDistanceKm: number
  targetTimeSec?: number
  recentWeeklyKm: number
  peakWeeklyKm?: number
  daysAvailable: string[]
  longRunDay?: string
  resultDate?: string
  resultDistanceKm?: number
  resultTimeSec?: number
  desk?: { workStart: string; workEnd: string }
}

/** Historia z intervals.icu jako źródło domyślnych odpowiedzi kreatora. */
export interface WizardIntervals {
  /** Klucz API jest osiągalny — warto zapytać o pobranie historii. */
  available: boolean
  /** `--from-intervals` z linii poleceń: pobierz bez pytania. */
  force: boolean
  fetch: () => Promise<InferenceOutcome>
}

const DISTANCES: Record<string, number> = {
  '5': 5,
  '10': 10,
  hm: 21.0975,
  m: 42.195,
}
/** Kanoniczne kody dni — tak zapisuje je trainctl.yaml, niezależnie od języka. */
const CANONICAL_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

/**
 * Skróty dni w bieżącym języku (np. `pn wt sr…`). Kanoniczne kody angielskie
 * przyjmujemy ZAWSZE — kto przepisuje dni z trainctl.yaml, nie powinien dostać błędu.
 */
function dayInputMap(): Record<string, string> {
  const map: Record<string, string> = {}
  CANONICAL_DAYS.forEach((canonical, i) => {
    map[canonical] = canonical
    const localized = ui().wizard.dayCodes[i]
    if (localized) map[localized] = canonical
  })
  return map
}

/** Kanoniczny kod → skrót w języku interfejsu (podpowiedź domyślnej wartości). */
function toLocalDay(canonical: string): string {
  const i = CANONICAL_DAYS.indexOf(canonical)
  return i === -1 ? canonical : (ui().wizard.dayCodes[i] ?? canonical)
}

export function parseTimeInput(text: string): number {
  const parts = text.trim().split(':').map(Number)
  if (parts.some(Number.isNaN) || parts.length < 2 || parts.length > 3) {
    throw new Error(ui().wizard.errTime)
  }
  return parts.reduce((acc, p) => acc * 60 + p, 0)
}

export function parseDistanceInput(text: string): number {
  const key = text.trim().toLowerCase()
  if (DISTANCES[key]) return DISTANCES[key]!
  const num = Number(key.replace(',', '.'))
  if (Number.isFinite(num) && num > 0) return num
  throw new Error(ui().wizard.errDistance)
}

export function parseDaysInput(text: string): string[] {
  const map = dayInputMap()
  const allowed = ui().wizard.dayCodes.join(' ')
  const tokens = text.toLowerCase().split(/[\s,]+/).filter(Boolean)
  const days = tokens.map((t) => {
    // „śr” wpisane z diakrytykiem to ta sama środa co „sr”
    const key = t.normalize('NFD').replace(/[̀-ͯ]/g, '')
    const canonical = map[key]
    if (!canonical) throw new Error(ui().wizard.errUnknownDay(t, allowed))
    return canonical
  })
  if (days.length === 0) throw new Error(ui().wizard.errNoDays)
  return [...new Set(days)]
}

export function parseDateInput(text: string): string {
  const t = text.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) throw new Error(ui().wizard.errDate)
  if (Number.isNaN(Date.parse(t))) throw new Error(ui().wizard.errBadDate)
  return t
}

export function toYaml(a: WizardAnswers): string {
  const results = a.resultDate
    ? `    - { date: "${a.resultDate}", distanceKm: ${a.resultDistanceKm}, timeSec: ${a.resultTimeSec} }`
    : `    []  # ${ui().configFile.inferredResultHint}`
  return [
    ...ui().configFile.templateHeader.slice(0, 1),
    ui().configFile.generatedByWizard,
    'athlete:',
    `  recentWeeklyKm: ${a.recentWeeklyKm}`,
    ...(a.peakWeeklyKm ? [`  peakWeeklyKm: ${a.peakWeeklyKm}`] : []),
    `  daysAvailable: [${a.daysAvailable.join(', ')}]`,
    ...(a.longRunDay ? [`  longRunDay: ${a.longRunDay}`] : []),
    '  results:',
    results,
    'goal:',
    `  name: "${a.goalName}"`,
    `  date: "${a.goalDate}"`,
    `  distanceKm: ${a.goalDistanceKm}`,
    '  priority: A',
    ...(a.targetTimeSec ? [`  targetTimeSec: ${a.targetTimeSec}`] : []),
    ...(a.desk
      ? [
          'desk:',
          `  workStart: "${a.desk.workStart}"`,
          `  workEnd: "${a.desk.workEnd}"`,
          '  lunchMinutes: 45',
          '  prefer: evening',
        ]
      : []),
    '',
  ].join('\n')
}

async function ask<T>(
  rl: Interface,
  theme: Theme,
  question: string,
  parse: (text: string) => T,
  opts: { hint?: string; optional?: boolean; default?: string } = {},
): Promise<T | undefined> {
  for (;;) {
    const parts = [
      ...(opts.hint ? [opts.hint] : []),
      ...(opts.default !== undefined ? [ui().wizard.enterAccepts(opts.default)] : []),
    ]
    const hint = parts.length ? theme.dim(` (${parts.join(', ')})`) : ''
    const answer = (await rl.question(`${theme.color(theme.sym.arrow, 'brand')} ${question}${hint}: `)).trim()
    if (!answer && opts.default !== undefined) return parse(opts.default)
    if (!answer && opts.optional) return undefined
    try {
      return parse(answer)
    } catch (e) {
      console.log(`  ${theme.color(theme.sym.fail, 'error')} ${e instanceof Error ? e.message : e}`)
    }
  }
}

async function askYesNo(rl: Interface, theme: Theme, question: string): Promise<boolean> {
  const answer = (
    await rl.question(
      `${theme.color(theme.sym.arrow, 'brand')} ${question} ${theme.dim(ui().wizard.yesNoHint)}: `,
    )
  ).trim()
  return !/^n/i.test(answer)
}

function fmtClock(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  const p = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${p(m)}:${p(s)}` : `${m}:${p(s)}`
}

/** Pobranie historii w kreatorze + podsumowanie propozycji. Zwraca profil albo undefined. */
async function offerHistory(
  rl: Interface,
  theme: Theme,
  intervals: WizardIntervals,
): Promise<InferredProfile | undefined> {
  if (!intervals.force) {
    const yes = await askYesNo(rl, theme, ui().wizard.intervalsFound)
    if (!yes) return undefined
  }
  console.log(theme.dim(`  ${ui().wizard.intervalsFetching}`))
  let outcome: InferenceOutcome
  try {
    outcome = await intervals.fetch()
  } catch (e) {
    outcome = { ok: false, reason: e instanceof Error ? e.message : String(e) }
  }
  if (!outcome.ok) {
    console.log(`  ${theme.color(theme.sym.warn, 'warn')} ${outcome.reason}`)
    return undefined
  }
  const p = outcome.profile
  const kms = p.weeklyKm.map((w) => w.km)
  console.log(
    `  ${theme.color(sparkline(kms, theme.caps.unicode), 'brand')} ` +
      theme.dim(ui().wizard.intervalsRange(p.window.oldest, p.window.newest, Math.max(...kms))),
  )
  console.log(
    `  ${theme.color(theme.sym.ok, 'success')} ${ui().wizard.intervalsProposed}`,
  )
  for (const c of p.caveats) console.log(`  ${theme.color(theme.sym.warn, 'warn')} ${c}`)
  console.log('')
  return p
}

export async function runWizard(
  theme = new Theme(),
  intervals?: WizardIntervals,
): Promise<WizardAnswers> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const w = ui().wizard
  try {
    console.log(theme.bold(theme.color(`\n${w.header}`, 'brand')))
    console.log(theme.dim(`${w.enterSkips}\n`))

    const inferred =
      intervals && (intervals.available || intervals.force)
        ? await offerHistory(rl, theme, intervals)
        : undefined

    console.log(theme.bold(w.goal))
    const goalName = (await ask(rl, theme, w.goalName, (t) => t.trim() || w.defaultGoalName))!
    const goalDate = (await ask(rl, theme, w.goalDate, parseDateInput, { hint: w.hintDate }))!
    const goalDistanceKm = (await ask(rl, theme, w.goalDistance, parseDistanceInput, {
      hint: w.hintDistance,
    }))!
    const targetTimeSec = await ask(rl, theme, w.goalTarget, parseTimeInput, {
      hint: w.hintTimeOptional,
      optional: true,
    })

    console.log(theme.bold(`\n${w.yourRunning}`))
    const parseKm = (t: string) => {
      const n = Number(t.replace(',', '.'))
      if (!Number.isFinite(n) || n <= 0) throw new Error(w.errKm)
      return n
    }
    const recentWeeklyKm = (await ask(rl, theme, w.recentVolume, parseKm, {
      ...(inferred ? { default: String(inferred.recentWeeklyKm) } : {}),
    }))!
    const peakWeeklyKm = await ask(rl, theme, w.peakVolume, parseKm, {
      hint: w.hintOptional,
      optional: true,
      ...(inferred?.peakWeeklyKm !== undefined ? { default: String(inferred.peakWeeklyKm) } : {}),
    })
    const daysAvailable = (await ask(rl, theme, w.trainingDays, parseDaysInput, {
      hint: w.hintDays,
      ...(inferred
        ? { default: inferred.daysAvailable.map(toLocalDay).join(' ') }
        : {}),
    }))!

    console.log(theme.bold(`\n${w.resultHeader}`))
    console.log(theme.dim(`  ${w.resultWhy}`))
    let resultDate: string | undefined
    let resultDistanceKm: number | undefined
    let resultTimeSec: number | undefined
    const candidate = inferred?.raceCandidates[0]
    if (candidate) {
      const label =
        `${candidate.date} · ${candidate.name ?? ui().init.unnamed} · ` +
        `${candidate.distanceKm} km — ${fmtClock(candidate.timeSec)}`
      console.log(theme.dim(`  ${w.raceLooksLike(label, candidate.reason)}`))
      if (await askYesNo(rl, theme, w.useThisResult)) {
        resultDate = candidate.date
        resultDistanceKm = candidate.distanceKm
        resultTimeSec = candidate.timeSec
      }
    }
    if (!resultDate) {
      resultDistanceKm = await ask(rl, theme, w.resultDistance, parseDistanceInput, {
        hint: w.hintOptional,
        optional: true,
      })
      if (resultDistanceKm) {
        resultTimeSec = await ask(rl, theme, w.resultTime, parseTimeInput, { hint: w.hintTime })
        resultDate = await ask(rl, theme, w.resultDate, parseDateInput, { hint: w.hintDate })
      }
    }

    console.log(theme.bold(`\n${w.deskHeader}`))
    const parseHour = (t: string) => {
      if (!/^\d{1,2}:\d{2}$/.test(t.trim())) throw new Error(w.errHour)
      return t.trim()
    }
    const workStart = await ask(rl, theme, w.workStart, parseHour, {
      hint: w.hintHourOptional,
      optional: true,
    })
    let desk: WizardAnswers['desk']
    if (workStart) {
      const workEnd = await ask(rl, theme, w.workEnd, parseHour, { hint: w.hintHour })
      if (workEnd) desk = { workStart, workEnd }
    }

    return {
      goalName,
      goalDate,
      goalDistanceKm,
      ...(targetTimeSec ? { targetTimeSec } : {}),
      recentWeeklyKm,
      ...(peakWeeklyKm ? { peakWeeklyKm } : {}),
      daysAvailable,
      ...(inferred?.longRunDay ? { longRunDay: inferred.longRunDay } : {}),
      ...(resultDate ? { resultDate } : {}),
      ...(resultDistanceKm ? { resultDistanceKm } : {}),
      ...(resultTimeSec ? { resultTimeSec } : {}),
      ...(desk ? { desk } : {}),
    }
  } finally {
    rl.close()
  }
}
