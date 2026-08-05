/**
 * Interaktywny kreator `tren init` — zbiera profil w rozmowie zamiast kazać
 * edytować YAML na ślepo. Poza TTY (potok, agent, CI) kreator się nie włącza:
 * wtedy zapisujemy szablon jak dotąd.
 */
import { createInterface, type Interface } from 'node:readline/promises'
import type { InferenceOutcome, InferredProfile } from '@tren/core'
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
const DAY_CODES = ['pn', 'wt', 'sr', 'cz', 'pt', 'sb', 'nd']
const DAY_MAP: Record<string, string> = {
  pn: 'mon', wt: 'tue', sr: 'wed', cz: 'thu', pt: 'fri', sb: 'sat', nd: 'sun',
}
const DAY_MAP_BACK: Record<string, string> = {
  mon: 'pn', tue: 'wt', wed: 'sr', thu: 'cz', fri: 'pt', sat: 'sb', sun: 'nd',
}

export function parseTimeInput(text: string): number {
  const parts = text.trim().split(':').map(Number)
  if (parts.some(Number.isNaN) || parts.length < 2 || parts.length > 3) {
    throw new Error('Czas w formacie MM:SS albo HH:MM:SS')
  }
  return parts.reduce((acc, p) => acc * 60 + p, 0)
}

export function parseDistanceInput(text: string): number {
  const key = text.trim().toLowerCase()
  if (DISTANCES[key]) return DISTANCES[key]!
  const num = Number(key.replace(',', '.'))
  if (Number.isFinite(num) && num > 0) return num
  throw new Error('Podaj dystans: 5, 10, hm, m albo liczbę kilometrów')
}

export function parseDaysInput(text: string): string[] {
  const tokens = text.toLowerCase().split(/[\s,]+/).filter(Boolean)
  const days = tokens.map((t) => {
    const key = t.replace('ś', 's')
    if (!DAY_CODES.includes(key)) throw new Error(`Nieznany dzień "${t}" — użyj: ${DAY_CODES.join(' ')}`)
    return DAY_MAP[key]!
  })
  if (days.length === 0) throw new Error('Podaj co najmniej jeden dzień')
  return [...new Set(days)]
}

export function parseDateInput(text: string): string {
  const t = text.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) throw new Error('Data w formacie RRRR-MM-DD')
  if (Number.isNaN(Date.parse(t))) throw new Error('Nieprawidłowa data')
  return t
}

export function toYaml(a: WizardAnswers): string {
  const results = a.resultDate
    ? `    - { date: "${a.resultDate}", distanceKm: ${a.resultDistanceKm}, timeSec: ${a.resultTimeSec} }`
    : '    []  # dopisz wynik startu — z niego kalibrujemy strefy (nie z zegarka)'
  return [
    '# tren — profil atlety i cel treningowy.',
    '# Wygenerowane przez `tren init`. Śmiało edytuj i uruchom `tren plan`.',
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
      ...(opts.default !== undefined ? [`Enter = ${opts.default}`] : []),
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
    await rl.question(`${theme.color(theme.sym.arrow, 'brand')} ${question} ${theme.dim('(T/n)')}: `)
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
    const yes = await askYesNo(
      rl, theme,
      'Znalazłem klucz intervals.icu — pobrać historię i zaproponować profil?',
    )
    if (!yes) return undefined
  }
  console.log(theme.dim('  pobieram ostatnie 16 tygodni…'))
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
      theme.dim(`${p.window.oldest} → ${p.window.newest}, max ${Math.max(...kms)} km`),
  )
  console.log(
    `  ${theme.color(theme.sym.ok, 'success')} propozycje z historii — Enter przy pytaniu przyjmuje wartość`,
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
  try {
    console.log(theme.bold(theme.color('\ntren — konfiguracja profilu', 'brand')))
    console.log(theme.dim('Enter pomija pytania opcjonalne.\n'))

    const inferred =
      intervals && (intervals.available || intervals.force)
        ? await offerHistory(rl, theme, intervals)
        : undefined

    console.log(theme.bold('Cel'))
    const goalName = (await ask(rl, theme, 'Nazwa zawodów', (t) => t.trim() || 'Bieg docelowy'))!
    const goalDate = (await ask(rl, theme, 'Data startu', parseDateInput, { hint: 'RRRR-MM-DD' }))!
    const goalDistanceKm = (await ask(rl, theme, 'Dystans', parseDistanceInput, {
      hint: '5 · 10 · hm · m · km',
    }))!
    const targetTimeSec = await ask(rl, theme, 'Cel czasowy', parseTimeInput, {
      hint: 'HH:MM:SS, opcjonalnie',
      optional: true,
    })

    console.log(theme.bold('\nTwoje bieganie'))
    const parseKm = (t: string) => {
      const n = Number(t.replace(',', '.'))
      if (!Number.isFinite(n) || n <= 0) throw new Error('Podaj liczbę kilometrów')
      return n
    }
    const recentWeeklyKm = (await ask(rl, theme, 'Objętość z ostatnich tygodni [km]', parseKm, {
      ...(inferred ? { default: String(inferred.recentWeeklyKm) } : {}),
    }))!
    const peakWeeklyKm = await ask(rl, theme, 'Historyczne maksimum tygodniowe [km]', parseKm, {
      hint: 'opcjonalnie',
      optional: true,
      ...(inferred?.peakWeeklyKm !== undefined ? { default: String(inferred.peakWeeklyKm) } : {}),
    })
    const daysAvailable = (await ask(rl, theme, 'Dni treningowe', parseDaysInput, {
      hint: 'np. wt sr cz sb nd',
      ...(inferred
        ? { default: inferred.daysAvailable.map((d) => DAY_MAP_BACK[d] ?? d).join(' ') }
        : {}),
    }))!

    console.log(theme.bold('\nWynik startu do kalibracji stref'))
    console.log(theme.dim('  Strefy liczymy z wyniku zawodów — odczyty progów z zegarka zawyżają tempo.'))
    let resultDate: string | undefined
    let resultDistanceKm: number | undefined
    let resultTimeSec: number | undefined
    const candidate = inferred?.raceCandidates[0]
    if (candidate) {
      const label =
        `${candidate.date} · ${candidate.name ?? 'bez nazwy'} · ` +
        `${candidate.distanceKm} km w ${fmtClock(candidate.timeSec)}`
      console.log(theme.dim(`  W historii wygląda na start: ${label} (${candidate.reason})`))
      if (await askYesNo(rl, theme, 'Użyć tego wyniku do kalibracji?')) {
        resultDate = candidate.date
        resultDistanceKm = candidate.distanceKm
        resultTimeSec = candidate.timeSec
      }
    }
    if (!resultDate) {
      resultDistanceKm = await ask(rl, theme, 'Dystans ostatniego startu', parseDistanceInput, {
        hint: 'opcjonalnie',
        optional: true,
      })
      if (resultDistanceKm) {
        resultTimeSec = await ask(rl, theme, 'Czas', parseTimeInput, { hint: 'HH:MM:SS' })
        resultDate = await ask(rl, theme, 'Data startu', parseDateInput, { hint: 'RRRR-MM-DD' })
      }
    }

    console.log(theme.bold('\nTryb biurkowy'))
    const workStart = await ask(rl, theme, 'Początek pracy', (t) => {
      if (!/^\d{1,2}:\d{2}$/.test(t.trim())) throw new Error('Godzina w formacie HH:MM')
      return t.trim()
    }, { hint: 'HH:MM, opcjonalnie', optional: true })
    let desk: WizardAnswers['desk']
    if (workStart) {
      const workEnd = await ask(rl, theme, 'Koniec pracy', (t) => {
        if (!/^\d{1,2}:\d{2}$/.test(t.trim())) throw new Error('Godzina w formacie HH:MM')
        return t.trim()
      }, { hint: 'HH:MM' })
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
