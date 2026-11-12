/** Konfiguracja atlety i celu: trainctl.yaml w bieżącym katalogu (plan-as-code). */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'yaml'
import { DEFAULT_LOCALE, getLocale, HR_MAX_BPM, isNotationStyle, isUnits, parseIso, withNotation, withUnits } from 'trainctl-core'
import type { AthleteProfile, InferredProfile, NotationStyle, RaceGoal, Units, Weekday } from 'trainctl-core'
import { ui } from './i18n/index.ts'
import { activeView } from './view-context.ts'

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

/**
 * Czas na trening (E-2): ile minut realnie masz — razem z przygotowaniem i siłą.
 * Bez tej sekcji plan liczy się w kilometrach, jak dotąd.
 */
export interface TimeConfig {
  weeklyMinutes?: number
  weekdayMinutes?: number
  weekendMinutes?: number
}

/** Źródła wykonania inne niż hub (ADR-037). */
export interface SyncConfig {
  /** Katalog (albo plik) z eksportem FIT/TCX/GPX — względem katalogu treningowego. */
  files?: string
}

export interface TrainctlConfig {
  athlete: AthleteProfile
  goal: RaceGoal
  desk?: DeskConfig
  strength?: StrengthConfig
  sync?: SyncConfig
  time?: TimeConfig
  /** Język interfejsu i opisów planu: 'en' (domyślny) albo 'pl'. */
  language?: string
  /** C9: jednostka widoku — metric (domyślnie) albo imperial; dane zostają w km. */
  units?: Units
  /** C10: zapis notacji — neutral (domyślnie) albo club (kody klubowe po polsku); dane bez zmian. */
  notation?: NotationStyle
}

/**
 * Język z pliku konfiguracyjnego, czytany BEZ pełnej walidacji profilu:
 * `trainctl init` i komunikaty błędów muszą znać język, zanim ktokolwiek sprawdzi,
 * czy `athlete.recentWeeklyKm` jest liczbą.
 */
/** C9: jednostka widoku z trainctl.yaml, czytana jak język — bez pełnej walidacji profilu. */
export function readConfigUnits(cwd: string): Units | undefined {
  const path = join(cwd, CONFIG_FILE)
  if (!existsSync(path)) return undefined
  try {
    const raw = parse(readFileSync(path, 'utf-8')) as { units?: unknown } | null
    return isUnits(raw?.units) ? raw.units : undefined
  } catch {
    return undefined
  }
}

/**
 * C9, C10: plik widoku (PLAN.md) w jednostce i zapisie z profilu, nie z flagi jednego
 * wywołania — `trainctl --units imperial plan` na podgląd nie przestawia trwałego pliku.
 */
export const inProfileView = <T>(cwd: string, fn: () => T): T =>
  withUnits(readConfigUnits(cwd) ?? 'metric', () => withNotation(readConfigNotation(cwd) ?? 'neutral', fn))

/** C10: zapis notacji z trainctl.yaml, czytany jak jednostka — bez pełnej walidacji profilu. */
export function readConfigNotation(cwd: string): NotationStyle | undefined {
  const path = join(cwd, CONFIG_FILE)
  if (!existsSync(path)) return undefined
  try {
    const raw = parse(readFileSync(path, 'utf-8')) as { notation?: unknown } | null
    return isNotationStyle(raw?.notation) ? raw.notation : undefined
  } catch {
    return undefined
  }
}

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
    pad('# units: metric', t.templateUnits),
    pad('# notation: neutral', t.templateNotation),
    'athlete:',
    pad('  sex: unspecified', t.templateAthlete.sex),
    pad('  # hrMax: { bpm: 190, measured: true }', t.templateAthlete.hrMax),
    pad('  recentWeeklyKm: 45', t.templateAthlete.recentWeeklyKm),
    pad('  peakWeeklyKm: 65', t.templateAthlete.peakWeeklyKm),
    pad('  # returning: { since: "2026-10-01", previousWeeklyKm: 45 }', t.templateAthlete.returning),
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
    pad('# time:', t.templateTime.section),
    pad('#   weeklyMinutes: 300', t.templateTime.weekly),
    pad('#   weekdayMinutes: 60', t.templateTime.weekday),
    pad('#   weekendMinutes: 120', t.templateTime.weekend),
    pad('# sync:', t.templateSync.section),
    pad('#   files: ./activities', t.templateSync.files),
    '',
  ].join('\n')
}

const WEEKDAYS: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const ISO_RE = { test: (value: string): boolean => { try { parseIso(value); return true } catch { return false } } }

export function loadConfig(cwd: string): TrainctlConfig {
  // E4: w widoku planu biegowego nad planem v2 profil biegowy pochodzi z profilu v2
  const view = activeView(cwd)
  if (view) return structuredClone(view.config)
  const path = join(cwd, CONFIG_FILE)
  if (!existsSync(path)) {
    throw new Error(ui().common.missingConfig(CONFIG_FILE))
  }
  return validateConfig(parse(readFileSync(path, 'utf-8')))
}

/** Walidacja i normalizacja profilu planu biegowego — z pliku albo z widoku (E4). */
export function validateConfig(input: unknown): TrainctlConfig {
  const t = ui()
  const v = t.configFile.validate
  const fail = (errs: string[]): never => {
    throw new Error(t.common.configErrors(CONFIG_FILE, errs.join('\n  - ')))
  }
  const raw = input as Partial<TrainctlConfig> | null
  const errors: string[] = []
  const a = raw?.athlete
  const g = raw?.goal

  if (!a) errors.push(v.missingSection('athlete'))
  else {
    if (typeof a.recentWeeklyKm !== 'number' || !Number.isFinite(a.recentWeeklyKm) || a.recentWeeklyKm <= 0)
      errors.push(v.numberGtZero('athlete.recentWeeklyKm'))
    if (a.peakWeeklyKm !== undefined && (!Number.isFinite(a.peakWeeklyKm) || a.peakWeeklyKm <= 0)) errors.push(v.numberGtZero('athlete.peakWeeklyKm'))
    // C8: płeć wybiera próg LT1 z Z-2; literówka cicho wyłączałaby pułap tętna
    if (a.sex !== undefined && !['male', 'female', 'unspecified'].includes(String(a.sex))) errors.push(v.sex('athlete.sex'))
    if (a.hrMax !== undefined) {
      const h = a.hrMax as Partial<NonNullable<AthleteProfile['hrMax']>> | null
      if (!h || typeof h !== 'object' || !Number.isInteger(h.bpm) || h.bpm! < HR_MAX_BPM[0] || h.bpm! > HR_MAX_BPM[1] || typeof h.measured !== 'boolean')
        errors.push(v.hrMax('athlete.hrMax', HR_MAX_BPM[0], HR_MAX_BPM[1]))
    }
    if (a.returning !== undefined) {
      const r = a.returning as Partial<NonNullable<AthleteProfile['returning']>> | null
      if (!r || typeof r !== 'object') errors.push(v.required('athlete.returning'))
      else {
        if (!ISO_RE.test(String(r.since))) errors.push(v.isoDate('athlete.returning.since'))
        if (typeof r.previousWeeklyKm !== 'number' || !Number.isFinite(r.previousWeeklyKm) || r.previousWeeklyKm <= 0)
          errors.push(v.numberGtZero('athlete.returning.previousWeeklyKm'))
      }
    }
    if (!Array.isArray(a.daysAvailable) || a.daysAvailable.length === 0)
      errors.push(v.nonEmptyDays('athlete.daysAvailable'))
    else
      for (const d of a.daysAvailable)
        if (!WEEKDAYS.includes(d)) errors.push(v.unknownDay('athlete.daysAvailable', String(d)))
    if (!Array.isArray(a.results)) errors.push(v.listOptional('athlete.results'))
    else
      a.results.forEach((r, i) => {
        if (!r) { errors.push(v.required(`athlete.results[${i}]`)); return }
        if (r.excluded !== undefined && typeof r.excluded !== 'boolean') errors.push(v.boolean(`athlete.results[${i}].excluded`))
        if (r.exclusionReason !== undefined && typeof r.exclusionReason !== 'string') errors.push(v.required(`athlete.results[${i}].exclusionReason`))
        if (!ISO_RE.test(String(r?.date))) errors.push(v.isoDate(`athlete.results[${i}].date`))
        if (typeof r?.distanceKm !== 'number' || !Number.isFinite(r.distanceKm) || r.distanceKm <= 0)
          errors.push(v.numberGtZero(`athlete.results[${i}].distanceKm`))
        if (typeof r?.timeSec !== 'number' || !Number.isFinite(r.timeSec) || r.timeSec <= 0)
          errors.push(v.seconds(`athlete.results[${i}].timeSec`))
      })
    if (a.tuneUpRaces !== undefined) {
      if (!Array.isArray(a.tuneUpRaces)) errors.push(v.listRequired('athlete.tuneUpRaces'))
      else
        a.tuneUpRaces.forEach((r, i) => {
          if (!ISO_RE.test(String(r?.date)))
            errors.push(v.isoDate(`athlete.tuneUpRaces[${i}].date`))
          if (typeof r?.distanceKm !== 'number' || !Number.isFinite(r.distanceKm) || r.distanceKm <= 0)
            errors.push(v.numberGtZero(`athlete.tuneUpRaces[${i}].distanceKm`))
          if (r?.priority !== undefined && !['B', 'C'].includes(String(r.priority)))
            errors.push(v.priorityBc(`athlete.tuneUpRaces[${i}].priority`))
        })
    }
  }
  const base = (g as { kind?: unknown } | undefined)?.kind === 'base'
  if (g && base) {
    // P-11: plan bez zawodów — wystarczy data końca (`until`); dystans i cel czasowy nie istnieją
    const until = (g as { until?: unknown }).until ?? g.date
    if (!ISO_RE.test(String(until))) errors.push(v.isoDate('goal.until'))
    else Object.assign(g, { date: String(until), distanceKm: 0, name: g.name || ui().configFile.baseGoalName })
    delete (g as { until?: unknown }).until
    delete g.targetTimeSec
  } else if ((g as { kind?: unknown } | undefined)?.kind !== undefined && (g as { kind?: unknown }).kind !== 'race') {
    errors.push(v.goalKind('goal.kind'))
  }
  if (raw?.units !== undefined && !isUnits(raw.units)) errors.push(v.units('units'))
  if (raw?.notation !== undefined && !isNotationStyle(raw.notation)) errors.push(v.notation('notation'))
  if (!g) errors.push(v.missingSection('goal'))
  else if (!base) {
    if (g.targetTimeSec !== undefined && (!Number.isFinite(g.targetTimeSec) || g.targetTimeSec <= 0)) errors.push(v.seconds('goal.targetTimeSec'))
    if (!g.name) errors.push(v.required('goal.name'))
    if (!ISO_RE.test(String(g.date))) errors.push(v.isoDate('goal.date'))
    if (typeof g.distanceKm !== 'number' || !Number.isFinite(g.distanceKm) || g.distanceKm <= 0)
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
  const sync = raw?.sync
  if (sync !== undefined && (typeof sync !== 'object' || sync === null || (sync.files !== undefined && (typeof sync.files !== 'string' || !sync.files.trim())))) {
    fail([v.required('sync.files')])
  }
  const time = raw?.time
  if (time !== undefined) {
    const errs: string[] = []
    if (typeof time !== 'object' || time === null) errs.push(v.required('time'))
    else {
      for (const key of ['weeklyMinutes', 'weekdayMinutes', 'weekendMinutes'] as const) {
        const value = time[key]
        if (value !== undefined && (!Number.isInteger(value) || value < 15 || value > 2000)) errs.push(v.minutes(`time.${key}`))
      }
    }
    if (errs.length) fail(errs)
  }
  const athlete = a as AthleteProfile
  return {
    athlete: {
      ...athlete,
      daysAvailable: [...new Set(athlete.daysAvailable)],
      // brak priority w YAML czytamy jako B: użytkownik wpisał ten bieg świadomie
      ...(athlete.tuneUpRaces
        ? { tuneUpRaces: athlete.tuneUpRaces.map((r) => ({ ...r, priority: r.priority ?? 'B' })) }
        : {}),
    },
    goal: { ...goal, priority: goal.priority ?? 'A' },
    ...(desk ? { desk } : {}),
    ...(strength ? { strength } : {}),
    ...(sync?.files ? { sync: { files: sync.files } } : {}),
    ...(time ? { time } : {}),
    ...(isUnits(raw?.units) ? { units: raw.units } : {}),
    ...(isNotationStyle(raw?.notation) ? { notation: raw.notation } : {}),
  }
}

/**
 * `sync.files` bez pełnej walidacji profilu — `review` i `status` mają działać
 * także wtedy, gdy profil ma błąd gdzie indziej.
 */
export function readSyncFiles(cwd: string): string | undefined {
  const path = join(cwd, CONFIG_FILE)
  if (!existsSync(path)) return undefined
  try {
    const raw = parse(readFileSync(path, 'utf-8')) as { sync?: { files?: unknown } } | null
    return typeof raw?.sync?.files === 'string' && raw.sync.files.trim() ? raw.sync.files : undefined
  } catch {
    return undefined
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
    ...(p.returning
      ? [pad(`  returning: { since: "${p.returning.since}", previousWeeklyKm: ${p.returning.previousWeeklyKm} }`, t.inferredReturning)]
      : []),
    pad(`  daysAvailable: [${p.daysAvailable.join(', ')}]`, t.inferredDays),
    ...(p.longRunDay ? [pad(`  longRunDay: ${p.longRunDay}`, t.inferredLongRun)] : []),
    // C8: najwyższe tętno z historii jako szacunek HRmax — pułap wymaga też płci (N-13)
    ...(p.hrMax ? [pad(`  hrMax: { bpm: ${p.hrMax.bpm}, measured: false }`, t.inferredHrMax(p.hrMax.date)), pad('  sex: unspecified', t.templateAthlete.sex)] : []),
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
  // E3: nowy katalog zakłada profil v2; profil planu biegowego czytają dalej czytniki v1 i `migrate`
  writeFileSync(path, content ?? sportsConfigTemplate(), 'utf-8')
}

/**
 * E3: szablon profilu v2 dla biegu z silnikiem biegowym — te same pola i komentarze co
 * profil planu biegowego, w układzie `athlete.sports.run` (pola silnika w `running`).
 */
export function sportsConfigTemplate(): string {
  const t = ui().configFile
  const r = t.templateRun
  const locale = getLocale()
  return [
    ...t.templateHeader,
    'schemaVersion: 2',
    locale === DEFAULT_LOCALE ? pad('# language: pl', t.templateLanguage) : pad(`language: ${locale}`, t.templateLanguage),
    pad('# units: metric', t.templateUnits),
    pad('# notation: neutral', t.templateNotation),
    'athlete:',
    '  sports:',
    '    run:',
    pad('      weeklyMinutes: 270', r.weeklyMinutes),
    pad('      sessionsPerWeek: 5', r.sessionsPerWeek),
    '      daysAvailable: [tue, wed, thu, sat, sun]',
    pad('      preparationMinutes: 15', r.preparation),
    pad('      results:', t.templateAthlete.results),
    `        - { date: "2026-03-29", distanceKm: 10, timeSec: 2580, name: "${t.templateAthlete.exampleResultName}" }`,
    pad('      running:', r.running),
    pad('        sex: unspecified', t.templateAthlete.sex),
    pad('        # hrMax: { bpm: 190, measured: true }', t.templateAthlete.hrMax),
    pad('        recentWeeklyKm: 45', t.templateAthlete.recentWeeklyKm),
    pad('        peakWeeklyKm: 65', t.templateAthlete.peakWeeklyKm),
    pad('        # returning: { since: "2026-10-01", previousWeeklyKm: 45 }', t.templateAthlete.returning),
    '        longRunDay: sat',
    pad('        tuneUpRaces:', t.templateAthlete.tuneUpRaces),
    `          []                # - { date: "2026-09-19", distanceKm: 10, name: "${t.templateAthlete.tuneUpExampleName}", priority: B }`,
    pad('        # strength:', t.templateStrength.section),
    pad('        #   enabled: true', t.templateStrength.enabled),
    pad('        #   days: [mon, fri]', t.templateStrength.days),
    'goal:',
    '  kind: race',
    '  sport: run',
    `  name: "${t.templateGoal.name}"`,
    '  date: "2026-11-29"',
    pad('  distanceM: 21097.5', r.goalDistance),
    pad('  # targetTimeSec: 5700', t.templateGoal.targetTime),
    pad('desk:', t.templateDesk),
    '  workStart: "09:00"',
    '  workEnd: "17:00"',
    '  lunchMinutes: 45',
    pad('  prefer: evening', t.templateDeskPrefer),
    pad('# time:', t.templateTime.section),
    pad('#   weeklyMinutes: 300', t.templateTime.weekly),
    pad('#   weekdayMinutes: 60', t.templateTime.weekday),
    pad('#   weekendMinutes: 120', t.templateTime.weekend),
    pad('# sync:', t.templateSync.section),
    pad('#   files: ./activities', t.templateSync.files),
    '',
  ].join('\n')
}

/**
 * E3: profil v2 z historii intervals.icu (ADR-019) — wartości z komentarzem proweniencji,
 * cel jako jawne placeholdery: walidacja nie przepuści pliku bez prawdziwego celu.
 */
export function inferredSportsYaml(p: InferredProfile): string {
  const t = ui().configFile
  const r = t.templateRun
  const locale = getLocale()
  const days = p.daysAvailable.length
  return [
    ...t.inferredHeader(p.window.oldest, p.window.newest),
    'schemaVersion: 2',
    ...(locale === DEFAULT_LOCALE ? [] : [`language: ${locale}`]),
    'athlete:',
    '  sports:',
    '    run:',
    // minuty tygodnia z objętości przy 6:00/km (E-3, inż.); walidacja v2 wymaga ≥ 5 min na sesję
    pad(`      weeklyMinutes: ${Math.max(10, 5 * days, Math.round(p.recentWeeklyKm * 6))}`, r.weeklyMinutesInferred),
    pad(`      sessionsPerWeek: ${days}`, r.sessionsPerWeek),
    pad(`      daysAvailable: [${p.daysAvailable.join(', ')}]`, t.inferredDays),
    pad('      preparationMinutes: 15', r.preparation),
    pad('      results:', t.inferredResults),
    pad('        []', t.inferredResultsWhy),
    pad('      running:', r.running),
    pad(`        recentWeeklyKm: ${p.recentWeeklyKm}`, p.recentBasis),
    ...(p.peakWeeklyKm !== undefined ? [pad(`        peakWeeklyKm: ${p.peakWeeklyKm}`, t.inferredPeak)] : []),
    ...(p.returning
      ? [pad(`        returning: { since: "${p.returning.since}", previousWeeklyKm: ${p.returning.previousWeeklyKm} }`, t.inferredReturning)]
      : []),
    ...(p.longRunDay ? [pad(`        longRunDay: ${p.longRunDay}`, t.inferredLongRun)] : []),
    // C8: najwyższe tętno z historii jako szacunek HRmax — pułap wymaga też płci (N-13)
    ...(p.hrMax ? [pad(`        hrMax: { bpm: ${p.hrMax.bpm}, measured: false }`, t.inferredHrMax(p.hrMax.date)), pad('        sex: unspecified', t.templateAthlete.sex)] : []),
    pad('goal:', t.inferredGoal),
    '  kind: race',
    '  sport: run',
    `  name: "${t.inferredGoalName}"`,
    pad(`  date: "${ui().wizard.hintDate}"`, t.inferredGoalDate),
    pad('  distanceM: 0', r.goalDistance),
    '',
  ].join('\n')
}
