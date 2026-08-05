/**
 * Interaktywny kreator `tren init` — zbiera profil w rozmowie zamiast kazać
 * edytować YAML na ślepo. Poza TTY (potok, agent, CI) kreator się nie włącza:
 * wtedy zapisujemy szablon jak dotąd.
 */
import { createInterface, type Interface } from 'node:readline/promises'
import { Theme } from './theme.ts'

export interface WizardAnswers {
  goalName: string
  goalDate: string
  goalDistanceKm: number
  targetTimeSec?: number
  recentWeeklyKm: number
  peakWeeklyKm?: number
  daysAvailable: string[]
  resultDate?: string
  resultDistanceKm?: number
  resultTimeSec?: number
  desk?: { workStart: string; workEnd: string }
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
  opts: { hint?: string; optional?: boolean } = {},
): Promise<T | undefined> {
  for (;;) {
    const hint = opts.hint ? theme.dim(` (${opts.hint})`) : ''
    const answer = (await rl.question(`${theme.color(theme.sym.arrow, 'brand')} ${question}${hint}: `)).trim()
    if (!answer && opts.optional) return undefined
    try {
      return parse(answer)
    } catch (e) {
      console.log(`  ${theme.color(theme.sym.fail, 'error')} ${e instanceof Error ? e.message : e}`)
    }
  }
}

export async function runWizard(theme = new Theme()): Promise<WizardAnswers> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  try {
    console.log(theme.bold(theme.color('\ntren — konfiguracja profilu', 'brand')))
    console.log(theme.dim('Enter pomija pytania opcjonalne.\n'))

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
    const recentWeeklyKm = (await ask(rl, theme, 'Objętość z ostatnich tygodni [km]', (t) => {
      const n = Number(t.replace(',', '.'))
      if (!Number.isFinite(n) || n <= 0) throw new Error('Podaj liczbę kilometrów')
      return n
    }))!
    const peakWeeklyKm = await ask(rl, theme, 'Historyczne maksimum tygodniowe [km]', (t) => {
      const n = Number(t.replace(',', '.'))
      if (!Number.isFinite(n) || n <= 0) throw new Error('Podaj liczbę kilometrów')
      return n
    }, { hint: 'opcjonalnie', optional: true })
    const daysAvailable = (await ask(rl, theme, 'Dni treningowe', parseDaysInput, {
      hint: 'np. wt sr cz sb nd',
    }))!

    console.log(theme.bold('\nWynik startu do kalibracji stref'))
    console.log(theme.dim('  Strefy liczymy z wyniku zawodów — odczyty progów z zegarka zawyżają tempo.'))
    const resultDistanceKm = await ask(rl, theme, 'Dystans ostatniego startu', parseDistanceInput, {
      hint: 'opcjonalnie',
      optional: true,
    })
    let resultDate: string | undefined
    let resultTimeSec: number | undefined
    if (resultDistanceKm) {
      resultTimeSec = await ask(rl, theme, 'Czas', parseTimeInput, { hint: 'HH:MM:SS' })
      resultDate = await ask(rl, theme, 'Data startu', parseDateInput, { hint: 'RRRR-MM-DD' })
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
      ...(resultDate ? { resultDate } : {}),
      ...(resultDistanceKm ? { resultDistanceKm } : {}),
      ...(resultTimeSec ? { resultTimeSec } : {}),
      ...(desk ? { desk } : {}),
    }
  } finally {
    rl.close()
  }
}
