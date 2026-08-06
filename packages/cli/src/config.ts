/** Konfiguracja atlety i celu: tren.yaml w bieżącym katalogu (plan-as-code). */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'yaml'
import type { AthleteProfile, InferredProfile, RaceGoal, Weekday } from '@tren/core'

export const CONFIG_FILE = 'tren.yaml'

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

export interface TrenConfig {
  athlete: AthleteProfile
  goal: RaceGoal
  desk?: DeskConfig
  strength?: StrengthConfig
}

export const CONFIG_TEMPLATE = `# tren — profil atlety i cel treningowy.
# Uzupełnij i uruchom: tren plan
athlete:
  sex: unspecified          # male | female | unspecified
  recentWeeklyKm: 45        # średnia z ostatnich ~4 tygodni
  peakWeeklyKm: 65          # historycznie utrzymywalne maksimum (opcjonalne)
  daysAvailable: [tue, wed, thu, sat, sun]
  longRunDay: sat
  results:                  # wyniki startów do kalibracji stref (Z-6: nie z zegarka!)
    - { date: "2026-03-29", distanceKm: 10, timeSec: 2580, name: "przykładowa dycha" }
  tuneUpRaces:              # starty kontrolne w drodze do celu (B = mini-taper, C = wbiegany)
    []                      # - { date: "2026-09-19", distanceKm: 10, name: "Bieg jesienny", priority: B }
goal:
  name: "Półmaraton"
  date: "2026-11-29"
  distanceKm: 21.0975
  priority: A
  # targetTimeSec: 5700     # opcjonalny cel czasowy — tren plan oceni realność
desk:                       # tryb biurkowy (tren desk) — opcjonalny
  workStart: "09:00"
  workEnd: "17:00"
  lunchMinutes: 45
  prefer: evening           # morning | lunch | evening
# strength:                 # siła 2×/tydz. obok biegania (opt-in; wymaga ciężarów)
#   enabled: true           # cel: ekonomia biegu (F-8) — NIE "ochrona przed urazami" (F-9)
#   days: [mon, fri]        # opcjonalnie: preferowane dni
`

const WEEKDAYS: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const ISO_RE = /^\d{4}-\d{2}-\d{2}$/

export function loadConfig(cwd: string): TrenConfig {
  const path = join(cwd, CONFIG_FILE)
  if (!existsSync(path)) {
    throw new Error(`Brak ${CONFIG_FILE} — uruchom najpierw: tren init`)
  }
  const raw = parse(readFileSync(path, 'utf-8')) as Partial<TrenConfig> | null
  const errors: string[] = []
  const a = raw?.athlete
  const g = raw?.goal

  if (!a) errors.push('athlete: brak sekcji')
  else {
    if (typeof a.recentWeeklyKm !== 'number' || a.recentWeeklyKm <= 0)
      errors.push('athlete.recentWeeklyKm: wymagana liczba > 0')
    if (!Array.isArray(a.daysAvailable) || a.daysAvailable.length === 0)
      errors.push('athlete.daysAvailable: wymagana niepusta lista dni')
    else
      for (const d of a.daysAvailable)
        if (!WEEKDAYS.includes(d)) errors.push(`athlete.daysAvailable: nieznany dzień "${d}"`)
    if (!Array.isArray(a.results)) errors.push('athlete.results: wymagana lista (może być pusta)')
    else
      a.results.forEach((r, i) => {
        if (!ISO_RE.test(String(r?.date))) errors.push(`athlete.results[${i}].date: format YYYY-MM-DD`)
        if (typeof r?.distanceKm !== 'number' || r.distanceKm <= 0)
          errors.push(`athlete.results[${i}].distanceKm: liczba > 0`)
        if (typeof r?.timeSec !== 'number' || r.timeSec <= 0)
          errors.push(`athlete.results[${i}].timeSec: liczba sekund > 0`)
      })
    if (a.tuneUpRaces !== undefined) {
      if (!Array.isArray(a.tuneUpRaces)) errors.push('athlete.tuneUpRaces: wymagana lista')
      else
        a.tuneUpRaces.forEach((r, i) => {
          if (!ISO_RE.test(String(r?.date)))
            errors.push(`athlete.tuneUpRaces[${i}].date: format YYYY-MM-DD`)
          if (typeof r?.distanceKm !== 'number' || r.distanceKm <= 0)
            errors.push(`athlete.tuneUpRaces[${i}].distanceKm: liczba > 0`)
          if (r?.priority !== undefined && !['B', 'C'].includes(String(r.priority)))
            errors.push(`athlete.tuneUpRaces[${i}].priority: B albo C (A to cel w sekcji goal)`)
        })
    }
  }
  if (!g) errors.push('goal: brak sekcji')
  else {
    if (!g.name) errors.push('goal.name: wymagane')
    if (!ISO_RE.test(String(g.date))) errors.push('goal.date: format YYYY-MM-DD')
    if (typeof g.distanceKm !== 'number' || g.distanceKm <= 0)
      errors.push('goal.distanceKm: liczba > 0')
  }
  if (errors.length) {
    throw new Error(`Błędy w ${CONFIG_FILE}:\n  - ${errors.join('\n  - ')}`)
  }
  const goal = g as RaceGoal
  const desk = raw?.desk
  if (desk && !(/^\d{1,2}:\d{2}$/.test(String(desk.workStart)) && /^\d{1,2}:\d{2}$/.test(String(desk.workEnd)))) {
    throw new Error(`Błędy w ${CONFIG_FILE}:\n  - desk.workStart/workEnd: format HH:MM`)
  }
  const strength = raw?.strength
  if (strength) {
    const errs: string[] = []
    if (typeof strength.enabled !== 'boolean') errs.push('strength.enabled: true albo false')
    if (strength.days !== undefined) {
      if (!Array.isArray(strength.days)) errs.push('strength.days: lista dni')
      else
        for (const d of strength.days)
          if (!WEEKDAYS.includes(d)) errs.push(`strength.days: nieznany dzień "${d}"`)
    }
    if (errs.length) throw new Error(`Błędy w ${CONFIG_FILE}:\n  - ${errs.join('\n  - ')}`)
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
 * tren.yaml z profilu wywnioskowanego z intervals.icu (ADR-019): każda wartość
 * z komentarzem proweniencji, cel jako jawne placeholdery — walidacja loadConfig
 * nie przepuści pliku, dopóki użytkownik nie wpisze prawdziwego celu.
 */
export function inferredConfigYaml(p: InferredProfile): string {
  return [
    '# tren — profil atlety i cel treningowy.',
    `# Profil zaproponowany z historii intervals.icu (pełne tygodnie ${p.window.oldest} → ${p.window.newest}).`,
    '# To propozycje — popraw wszystko, co nie zgadza się z rzeczywistością.',
    'athlete:',
    `  recentWeeklyKm: ${p.recentWeeklyKm}  # ${p.recentBasis}`,
    ...(p.peakWeeklyKm !== undefined
      ? [`  peakWeeklyKm: ${p.peakWeeklyKm}    # najwyższy pełny tydzień okna`]
      : []),
    `  daysAvailable: [${p.daysAvailable.join(', ')}]  # dni z ≥10% biegów okna`,
    ...(p.longRunDay ? [`  longRunDay: ${p.longRunDay}       # dominujący dzień najdłuższych biegów`] : []),
    '  results:            # dopisz wynik startu po potwierdzeniu kandydatów z wyjścia komendy',
    '    []                # (strefy kalibrujemy z wyników startów, nie z odczytów zegarka — Z-6)',
    'goal:                 # UZUPEŁNIJ — bez celu `tren plan` odmówi (celowo)',
    '  name: "Bieg docelowy"',
    '  date: "RRRR-MM-DD"  # data startu',
    '  distanceKm: 0       # 5 / 10 / 21.0975 / 42.195',
    '  priority: A',
    '',
  ].join('\n')
}

export function writeConfigTemplate(cwd: string, content?: string): void {
  const path = join(cwd, CONFIG_FILE)
  if (existsSync(path)) {
    throw new Error(`${CONFIG_FILE} już istnieje — edytuj go albo usuń przed ponownym init.`)
  }
  writeFileSync(path, content ?? CONFIG_TEMPLATE, 'utf-8')
}
