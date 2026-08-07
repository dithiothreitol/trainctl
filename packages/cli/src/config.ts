/** Konfiguracja atlety i celu: trainctl.yaml w bieżącym katalogu (plan-as-code). */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'yaml'
import { DEFAULT_LOCALE, getLocale } from 'trainctl-core'
import type { AthleteProfile, InferredProfile, RaceGoal, Weekday } from 'trainctl-core'
import { ui } from './i18n/index.ts'

export const CONFIG_FILE = 'trainctl.yaml'

export interface DeskConfig {
  workStart: string
  workEnd: string
  lunchMinutes?: number
  breakEveryMin?: number
  breakMinutes?: number
  prefer?: 'morning' | 'lunch' | 'evening'
}

/** Siła obok biegania (F-1…F-4) — opt-in, bo wymaga dostępu do ciężarów. */
export interface StrengthConfig {
  enabled: boolean
  /** Preferowane dni; puste = silnik wybiera dni wolne/spokojne. */
  days?: Weekday[]
}

export interface TrainctlConfig {
  athlete: AthleteProfile
  goal: RaceGoal
  desk?: DeskConfig
  strength?: StrengthConfig
  /** Język interfejsu i opisów planu: 'en' (domyślny) albo 'pl'. */
  language?: string
}

/**
 * Język z pliku konfiguracyjnego, czytany BEZ pełnej walidacji profilu:
 * `trainctl init` i komunikaty błędów muszą znać język, zanim ktokolwiek sprawdzi,
 * czy `athlete.recentWeeklyKm` jest liczbą.
 */
export function readConfigLanguage(cwd: string): string | undefined {
  const path = join(cwd, CONFIG_FILE)
  if (!existsSync(path)) return undefined
  try {
    const raw = parse(readFileSync(path, 'utf-8')) as { language?: unknown } | null
    return typeof raw?.language === 'string' ? raw.language : undefined
  } catch {
    return undefined // uszkodzony YAML zgłosi loadConfig, tu tylko nie przeszkadzamy
  }
}

/**
 * Komentarz YAML dorównany do kolumny — szablon ma się czytać jak tabela.
 * Spacja przed `#` jest DOKLEJONA, nie wyrównana: dłuższa linia kodu zjadłaby
 * dopełnienie i dała `[tue, thu]# …`, czego parser YAML nie przyjmuje.
 */
const pad = (code: string, comment: string): string =>
  comment ? `${code.padEnd(25)} # ${comment}` : code

/**
 * Szablon trainctl.yaml w bieżącym języku. Wiersz `language:` jest ODKOMENTOWANY,
 * gdy pracujemy w języku innym niż domyślny — dzięki temu `trainctl init --lang pl`
 * zostawia katalog, który przy następnym uruchomieniu nadal mówi po polsku.
 */
export function configTemplate(): string {
  const t = ui().configFile
  const locale = getLocale()
  const languageLine =
    locale === DEFAULT_LOCALE
      ? pad(`# language: pl`, t.templateLanguage)
      : pad(`language: ${locale}`, t.templateLanguage)
  return [
    ...t.templateHeader,
    languageLine,
    'athlete:',
    pad('  sex: unspecified', t.templateAthlete.sex),
    pad('  recentWeeklyKm: 45', t.templateAthlete.recentWeeklyKm),
    pad('  peakWeeklyKm: 65', t.templateAthlete.peakWeeklyKm),
    '  daysAvailable: [tue, wed, thu, sat, sun]',
    '  longRunDay: sat',
    pad('  results:', t.templateAthlete.results),
    `    - { date: "2026-03-29", distanceKm: 10, timeSec: 2580, name: "${t.templateAthlete.exampleResultName}" }`,
    pad('  tuneUpRaces:', t.templateAthlete.tuneUpRaces),
    `    []                    # - { date: "2026-09-19", distanceKm: 10, name: "${t.templateAthlete.tuneUpExampleName}", priority: B }`,
    'goal:',
    `  name: "${t.templateGoal.name}"`,
    '  date: "2026-11-29"',
    '  distanceKm: 21.0975',
    '  priority: A',
    pad('  # targetTimeSec: 5700', t.templateGoal.targetTime),
    pad('desk:', t.templateDesk),
    '  workStart: "09:00"',
    '  workEnd: "17:00"',
    '  lunchMinutes: 45',
    pad('  prefer: evening', t.templateDeskPrefer),
    pad('# strength:', t.templateStrength.section),
    pad('#   enabled: true', t.templateStrength.enabled),
    pad('#   days: [mon, fri]', t.templateStrength.days),
    '',
  ].join('\n')
}

const WEEKDAYS: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const ISO_RE = /^\d{4}-\d{2}-\d{2}$/

export function loadConfig(cwd: string): TrainctlConfig {
  const path = join(cwd, CONFIG_FILE)
  const t = ui()
  const v = t.configFile.validate
  const fail = (errs: string[]): never => {
    throw new Error(t.common.configErrors(CONFIG_FILE, errs.join('\n  - ')))
  }
  if (!existsSync(path)) {
    throw new Error(t.common.missingConfig(CONFIG_FILE))
  }
  const raw = parse(readFileSync(path, 'utf-8')) as Partial<TrainctlConfig> | null
  const errors: string[] = []
  const a = raw?.athlete
  const g = raw?.goal

  if (!a) errors.push(v.missingSection('athlete'))
  else {
    if (typeof a.recentWeeklyKm !== 'number' || a.recentWeeklyKm <= 0)
      errors.push(v.numberGtZero('athlete.recentWeeklyKm'))
    if (!Array.isArray(a.daysAvailable) || a.daysAvailable.length === 0)
      errors.push(v.nonEmptyDays('athlete.daysAvailable'))
    else
      for (const d of a.daysAvailable)
        if (!WEEKDAYS.includes(d)) errors.push(v.unknownDay('athlete.daysAvailable', String(d)))
    if (!Array.isArray(a.results)) errors.push(v.listOptional('athlete.results'))
    else
      a.results.forEach((r, i) => {
        if (!ISO_RE.test(String(r?.date))) errors.push(v.isoDate(`athlete.results[${i}].date`))
        if (typeof r?.distanceKm !== 'number' || r.distanceKm <= 0)
          errors.push(v.numberGtZero(`athlete.results[${i}].distanceKm`))
        if (typeof r?.timeSec !== 'number' || r.timeSec <= 0)
          errors.push(v.seconds(`athlete.results[${i}].timeSec`))
      })
    if (a.tuneUpRaces !== undefined) {
      if (!Array.isArray(a.tuneUpRaces)) errors.push(v.listRequired('athlete.tuneUpRaces'))
      else
        a.tuneUpRaces.forEach((r, i) => {
          if (!ISO_RE.test(String(r?.date)))
            errors.push(v.isoDate(`athlete.tuneUpRaces[${i}].date`))
          if (typeof r?.distanceKm !== 'number' || r.distanceKm <= 0)
            errors.push(v.numberGtZero(`athlete.tuneUpRaces[${i}].distanceKm`))
          if (r?.priority !== undefined && !['B', 'C'].includes(String(r.priority)))
            errors.push(v.priorityBc(`athlete.tuneUpRaces[${i}].priority`))
        })
    }
  }
  if (!g) errors.push(v.missingSection('goal'))
  else {
    if (!g.name) errors.push(v.required('goal.name'))
    if (!ISO_RE.test(String(g.date))) errors.push(v.isoDate('goal.date'))
    if (typeof g.distanceKm !== 'number' || g.distanceKm <= 0)
      errors.push(v.numberGtZero('goal.distanceKm'))
  }
  if (errors.length) fail(errors)
  const goal = g as RaceGoal
  const desk = raw?.desk
  if (desk && !(/^\d{1,2}:\d{2}$/.test(String(desk.workStart)) && /^\d{1,2}:\d{2}$/.test(String(desk.workEnd)))) {
    fail([v.hourFormat('desk.workStart/workEnd')])
  }
  const strength = raw?.strength
  if (strength) {
    const errs: string[] = []
    if (typeof strength.enabled !== 'boolean') errs.push(v.boolean('strength.enabled'))
    if (strength.days !== undefined) {
      if (!Array.isArray(strength.days)) errs.push(v.listRequired('strength.days'))
      else
        for (const d of strength.days)
          if (!WEEKDAYS.includes(d)) errs.push(v.unknownDay('strength.days', String(d)))
    }
    if (errs.length) fail(errs)
  }
  const athlete = a as AthleteProfile
  return {
    athlete: {
      ...athlete,
      // brak priority w YAML czytamy jako B: użytkownik wpisał ten bieg świadomie
      ...(athlete.tuneUpRaces
        ? { tuneUpRaces: athlete.tuneUpRaces.map((r) => ({ ...r, priority: r.priority ?? 'B' })) }
        : {}),
    },
    goal: { ...goal, priority: goal.priority ?? 'A' },
    ...(desk ? { desk } : {}),
    ...(strength ? { strength } : {}),
  }
}

/**
 * trainctl.yaml z profilu wywnioskowanego z intervals.icu (ADR-019): każda wartość
 * z komentarzem proweniencji, cel jako jawne placeholdery — walidacja loadConfig
 * nie przepuści pliku, dopóki użytkownik nie wpisze prawdziwego celu.
 */
export function inferredConfigYaml(p: InferredProfile): string {
  const t = ui().configFile
  const locale = getLocale()
  const datePlaceholder = ui().wizard.hintDate
  return [
    ...t.inferredHeader(p.window.oldest, p.window.newest),
    ...(locale === DEFAULT_LOCALE ? [] : [`language: ${locale}`]),
    'athlete:',
    pad(`  recentWeeklyKm: ${p.recentWeeklyKm}`, p.recentBasis),
    ...(p.peakWeeklyKm !== undefined
      ? [pad(`  peakWeeklyKm: ${p.peakWeeklyKm}`, t.inferredPeak)]
      : []),
    pad(`  daysAvailable: [${p.daysAvailable.join(', ')}]`, t.inferredDays),
    ...(p.longRunDay ? [pad(`  longRunDay: ${p.longRunDay}`, t.inferredLongRun)] : []),
    pad('  results:', t.inferredResults),
    pad('    []', t.inferredResultsWhy),
    pad('goal:', t.inferredGoal),
    `  name: "${t.inferredGoalName}"`,
    pad(`  date: "${datePlaceholder}"`, t.inferredGoalDate),
    pad('  distanceKm: 0', '5 / 10 / 21.0975 / 42.195'),
    '  priority: A',
    '',
  ].join('\n')
}

export function writeConfigTemplate(cwd: string, content?: string): void {
  const path = join(cwd, CONFIG_FILE)
  if (existsSync(path)) {
    throw new Error(ui().init.exists(CONFIG_FILE))
  }
  writeFileSync(path, content ?? configTemplate(), 'utf-8')
}
