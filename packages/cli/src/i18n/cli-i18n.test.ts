/**
 * Kontrola jakości katalogów CLI — odpowiednik `core/src/i18n/i18n.test.ts`,
 * ale dla warstwy interfejsu: nagłówków, kreatora, szablonu trainctl.yaml,
 * instrukcji dla agenta i opisów narzędzi MCP.
 *
 * Kompilator pilnuje kompletu kluczy. Tutaj sprawdzamy to, czego typ nie
 * złapie: czy polski nie jest kalką, czy diakrytyki przeżyły, czy przetłumaczone
 * KOMENTARZE nie zepsuły składni YAML i czy nazwy narzędzi przetrwały tłumaczenie.
 */
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { setLocale, withLocale, type Locale } from 'trainctl-core'
import { cmdDiff, cmdPlan } from '../commands.ts'
import { configTemplate, inferredConfigYaml, inferredSportsYaml, sportsConfigTemplate } from '../config.ts'
import { validateSportsConfig } from 'trainctl-core'
import { cliEn, type CliMessages } from './cli-en.ts'
import { cliPl } from './cli-pl.ts'
import { ui } from './index.ts'

const CATALOGS: Record<Locale, CliMessages> = { en: cliEn, pl: cliPl }

function keyPaths(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const path = prefix ? `${prefix}.${k}` : k
    return v !== null && typeof v === 'object' && !Array.isArray(v)
      ? keyPaths(v as object, path)
      : [path]
  })
}

const get = (catalog: object, path: string): unknown =>
  path.split('.').reduce<any>((o, k) => o[k], catalog)

describe('kompletność katalogów CLI', () => {
  it('polski ma dokładnie te same klucze co angielski', () => {
    expect(keyPaths(cliPl).sort()).toEqual(keyPaths(cliEn).sort())
  })

  it('każdy klucz jest wypełniony — brak pustych stringów', () => {
    for (const [locale, catalog] of Object.entries(CATALOGS)) {
      for (const path of keyPaths(catalog)) {
        const value = get(catalog, path)
        expect(typeof value, `${locale}.${path}`).toMatch(/string|function|object/)
        if (typeof value === 'string') expect(value.trim(), `${locale}.${path}`).not.toBe('')
      }
    }
  })

  it('funkcje przyjmują tyle samo argumentów w obu językach', () => {
    for (const path of keyPaths(cliEn)) {
      const en = get(cliEn, path)
      if (typeof en === 'function') {
        expect((get(cliPl, path) as Function).length, path).toBe(en.length)
      }
    }
  })

  it('skróty dni pokrywają cały tydzień i są unikalne', () => {
    for (const [locale, catalog] of Object.entries(CATALOGS)) {
      const codes = catalog.wizard.dayCodes
      expect(codes.length, locale).toBe(7)
      expect(new Set(codes).size, locale).toBe(7)
    }
  })
})

describe('polski nie jest kalką', () => {
  it('identyczne napisy to wyłącznie świadoma lista', () => {
    const identical = keyPaths(cliEn).filter((p) => {
      const en = get(cliEn, p)
      return typeof en === 'string' && en === get(cliPl, p)
    })
    // Symbole, formaty i listy wartości enum — tłumaczenie ich byłoby błędem.
    expect(identical.sort()).toEqual(
      [
        'display.sport', // Sport — ten sam rzeczownik w obu językach.
        'cmd.optStatus',
        'cmd.optExportWhat',
        'common.labelOk',
        'common.labelWarn',
        'plan.vdot',
        'pull.columns.status',
        'desk.columns.status',
        'reschedule.none',
        'wizard.hintDistance',
        'wizard.hintTime',
        'wizard.hintHour',
        'print.columns.done',
        'racePack.km',
        'planMd.rest',
        'configFile.templateAthlete.sex',
        'configFile.templateDeskPrefer',
        'log.prompt.status',
        'log.prompt.statusHint',
        'status.columns.id',
        'status.git',
        'status.plan',
        'review.columns.planned',
        'review.columns.status',
        // C8: skrót płci w kreatorze — „m" to mężczyzna i male
        'wizard.sexCodes.male',
        // C9: symbole jednostek dystansu są te same w obu językach
        'wizard.unitCodes.metric',
        'wizard.unitCodes.imperial',
        'wizard.hintUnits',
        // C2: kolumny wiersza jednostki i siatki sezonu; „taper" to termin w obu językach
        'rows.columns.sport',
        'rows.season.phase.taper',
      ].sort(),
    )
  })

  it('polskie teksty mają diakrytyki, nie ich okaleczone wersje', () => {
    const joined = keyPaths(cliPl)
      .map((p) => get(cliPl, p))
      .filter((v): v is string => typeof v === 'string')
      .join(' ')
    expect(joined).toMatch(/[ąćęłńóśźż]/)
    expect(joined).not.toMatch(/[ĹĂÂ]|â€|Ã³/)
  })

  it('polska proza używa cudzysłowów „…”, nie prostych', () => {
    // pomijamy klucze, w których cudzysłów prosty jest częścią składni
    // YAML/JSON, a nie interpunkcją zdania
    const skip = /^configFile\.|^planMd\.|^agentsMd$|^desk\.missingSection$|^adapt\.|^review\.todoWriteResult$/
    for (const path of keyPaths(cliPl)) {
      if (skip.test(path)) continue
      const value = get(cliPl, path)
      if (typeof value === 'string' && value.includes('"')) {
        expect.fail(`${path}: prosty cudzysłów w polskim tekście — użyj „…”`)
      }
    }
  })
})

describe('reguły i cele jednostek', () => {
  it('oba języki opisują dokładnie te same ID reguł', () => {
    expect(Object.keys(cliPl.rules).sort()).toEqual(Object.keys(cliEn.rules).sort())
  })

  it('każde ID ma format z FOUNDATIONS §10 (litera-cyfra)', () => {
    // FOUNDATIONS §10 ma też ID z literą (S-9a, S-9b)
    for (const id of Object.keys(cliEn.rules)) expect(id).toMatch(/^[A-Z]-\d{1,2}[a-z]?$/)
  })

  it('każde objaśnienie cytuje źródło albo korpus', () => {
    // Reguły inżynierskie bez bezpośredniego źródła — wymienione jawnie, żeby
    // dopisanie kolejnej wymagało świadomej decyzji, nie przeoczenia.
    const withoutSource = ['T-9', 'T-12', 'W-13', 'F-18', 'Z-10', 'E-2', 'E-3', 'E-5', 'R-9', 'R-10', 'P-11', 'J-6', 'R-5']
    // rok publikacji, odwołanie do korpusu albo nazwisko (Daniels & Gilbert, bez roku)
    const cites = /(19|20)\d{2}|korpus|corpus|Daniels/
    for (const catalog of [cliEn.rules, cliPl.rules]) {
      for (const [id, text] of Object.entries(catalog)) {
        if (withoutSource.includes(id)) {
          expect(text, id).not.toMatch(cites)
        } else {
          expect(text, id).toMatch(cites)
        }
      }
    }
  })

  it('cel jednostki opisany dla każdego rodzaju treningu', () => {
    const kinds = Object.keys(cliEn.kindPurpose)
    expect(Object.keys(cliPl.kindPurpose).sort()).toEqual(kinds.sort())
    expect(kinds).toContain('quality_intervals')
  })
})

describe('instrukcja dla agenta (AGENTS.md)', () => {
  const en = cliEn.agentsMd('https://example.test/FOUNDATIONS.md')
  const pl = cliPl.agentsMd('https://example.test/FOUNDATIONS.md')

  it('to dwa różne teksty, nie jeden skopiowany', () => {
    expect(en).not.toBe(pl)
    expect(pl).toMatch(/[ąćęłńóśźż]/)
  })

  it('nazwy narzędzi i plików przeżywają tłumaczenie', () => {
    for (const doc of [en, pl]) {
      for (const token of ['trainctl_review', 'trainctl_plan', 'trainctl_diff', 'trainctl_shift', 'trainctl_why']) {
        expect(doc).toContain(token)
      }
      expect(doc).toContain('trainctl.yaml')
      expect(doc).toContain('plan/plan.yaml')
      expect(doc).toContain('log.jsonl')
      expect(doc).toContain('docs/science/FOUNDATIONS.md')
    }
  })

  it('obie wersje niosą te same zasady — tyle samo punktów i tabela plików', () => {
    const numbered = (doc: string) => doc.match(/^\d+\. \*\*/gm)?.length ?? 0
    expect(numbered(pl)).toBe(numbered(en))
    expect(numbered(en)).toBeGreaterThan(4)
    const rows = (doc: string) => doc.match(/^\| `/gm)?.length ?? 0
    expect(rows(pl)).toBe(rows(en))
  })
})

describe('szablon trainctl.yaml', () => {
  it('przetłumaczone komentarze nie psują YAML-a — obie wersje parsują się tak samo', () => {
    const structure = (locale: Locale) => {
      const parsed = withLocale(locale, () => parse(configTemplate())) as Record<string, unknown>
      return JSON.stringify(parsed)
    }
    const en = JSON.parse(structure('en')) as any
    const pl = JSON.parse(structure('pl')) as any
    // jedyna dopuszczalna różnica struktury: szablon inny niż domyślny język
    // utrwala wybór, żeby katalog dalej mówił tak samo po następnym uruchomieniu
    expect(en.language).toBeUndefined()
    expect(pl.language).toBe('pl')
    expect(Object.keys(pl).filter((k) => k !== 'language').sort()).toEqual(
      Object.keys(en).sort(),
    )
    // nazwy przykładów to treść, liczby i dni muszą się zgadzać co do jednego
    const withoutNames = (a: any) => ({
      ...a,
      results: a.results.map((r: any) => ({ ...r, name: undefined })),
    })
    expect(withoutNames(pl.athlete)).toEqual(withoutNames(en.athlete))
    expect(pl.athlete.results[0].name).not.toBe(en.athlete.results[0].name)
    expect(pl.desk).toEqual(en.desk)
    expect(pl.goal.distanceKm).toBe(en.goal.distanceKm)
    expect(pl.goal.name).not.toBe(en.goal.name)
  })

  it('domyślny język zostaje zakomentowany, wybrany — zapisany na stałe', () => {
    expect(withLocale('en', configTemplate)).toMatch(/^#\s*language:/m)
    expect(withLocale('pl', configTemplate)).toMatch(/^language: pl/m)
  })

  it('kody dni w YAML są kanoniczne (angielskie) niezależnie od języka', () => {
    const pl = parse(withLocale('pl', configTemplate)) as any
    expect(pl.athlete.daysAvailable).toEqual(['tue', 'wed', 'thu', 'sat', 'sun'])
    expect(pl.athlete.longRunDay).toBe('sat')
  })

  it('profil z historii też parsuje się w obu językach', () => {
    const profile = {
      window: { oldest: '2026-04-13', newest: '2026-08-02' },
      recentWeeklyKm: 48,
      peakWeeklyKm: 61,
      recentBasis: 'mediana',
      daysAvailable: ['tue', 'thu', 'sat'] as any,
      longRunDay: 'sat' as any,
      weeklyKm: [],
      raceCandidates: [],
      caveats: [],
    }
    for (const locale of ['en', 'pl'] as Locale[]) {
      const parsed = withLocale(locale, () => parse(inferredConfigYaml(profile as any))) as any
      expect(parsed.athlete.daysAvailable, locale).toEqual(['tue', 'thu', 'sat'])
      expect(parsed.goal.priority, locale).toBe('A')
    }
  })
})

describe('szablony profilu v2 z `init` (E3)', () => {
  it('oba języki parsują się do tego samego, poprawnego profilu v2', () => {
    const parsed = (locale: Locale) => withLocale(locale, () => parse(sportsConfigTemplate())) as any
    const en = parsed('en'), pl = parsed('pl')
    expect(() => validateSportsConfig(en)).not.toThrow()
    expect(() => validateSportsConfig(pl)).not.toThrow()
    expect(en.language).toBeUndefined()
    expect(pl.language).toBe('pl')
    const withoutNames = (c: any) => ({ ...c, language: undefined, goal: { ...c.goal, name: undefined },
      athlete: { sports: { run: { ...c.athlete.sports.run, results: c.athlete.sports.run.results.map((r: any) => ({ ...r, name: undefined })) } } } })
    expect(withoutNames(pl)).toEqual(withoutNames(en))
  })

  it('profil v2 z historii parsuje się w obu językach z tymi samymi wartościami', () => {
    const profile = {
      window: { oldest: '2026-04-13', newest: '2026-08-02' }, recentWeeklyKm: 48, peakWeeklyKm: 61, recentBasis: 'mediana',
      daysAvailable: ['tue', 'thu', 'sat'], longRunDay: 'sat', weeklyKm: [], raceCandidates: [], caveats: [],
    }
    for (const locale of ['en', 'pl'] as Locale[]) {
      const parsed = withLocale(locale, () => parse(inferredSportsYaml(profile as any))) as any
      expect(parsed.athlete.sports.run.daysAvailable, locale).toEqual(['tue', 'thu', 'sat'])
      expect(parsed.athlete.sports.run.running, locale).toMatchObject({ recentWeeklyKm: 48, peakWeeklyKm: 61, longRunDay: 'sat' })
      expect(parsed.goal, locale).toMatchObject({ kind: 'race', sport: 'run', distanceM: 0 })
    }
  })
})

describe('opisy narzędzi MCP', () => {
  it('każdy opis mieści się w rozsądnej długości i nie jest urwany', () => {
    for (const [locale, catalog] of Object.entries(CATALOGS)) {
      for (const [key, value] of Object.entries(catalog.mcp)) {
        if (typeof value !== 'string') continue
        expect(value.length, `${locale}.mcp.${key}`).toBeLessThan(1200)
        expect(value.trimEnd(), `${locale}.mcp.${key}`).toMatch(/[.:)\]]$|^[a-zA-Z].{0,60}$/)
      }
    }
  })

  it('odwołania do innych narzędzi przetrwały tłumaczenie', () => {
    for (const catalog of Object.values(CATALOGS)) {
      expect(catalog.mcp.plan).toContain('trainctl_diff')
      expect(catalog.mcp.week).toContain('trainctl_shift')
      expect(catalog.mcp.reschedule).toContain('trainctl_shift')
      expect(catalog.mcp.review).toContain('trainctl_pull')
    }
  })
})

describe('ui() podąża za językiem', () => {
  it('przełączenie języka zmienia katalog interfejsu', () => {
    const previous = setLocale('en')
    try {
      expect(ui().common.cancelled).toBe(cliEn.common.cancelled)
      setLocale('pl')
      expect(ui().common.cancelled).toBe(cliPl.common.cancelled)
    } finally {
      setLocale(previous)
    }
  })
})

describe('C6: teksty tylko w katalogach', () => {
  // Para „pl, en" wpisana w kod omija strażników katalogów (komplet kluczy, przecieki).
  const ROOT = join(import.meta.dirname, '..', '..', '..')
  // tylko src/ każdej paczki — bez node_modules
  const sources = readdirSync(ROOT).flatMap((pkg) => {
    try {
      return readdirSync(join(ROOT, pkg, 'src'), { recursive: true, encoding: 'utf-8' }).map((f) => join(pkg, 'src', f))
    } catch {
      return []
    }
  }).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts') && !/[\\/]i18n[\\/]/.test(f))

  it('kod poza i18n/ nie wybiera tekstu porównaniem języka ani parą pl/en', () => {
    expect(sources.length).toBeGreaterThan(50)
    const offenders = sources.filter((f) => {
      const src = readFileSync(join(ROOT, f), 'utf-8')
      return /getLocale\(\)\s*===?/.test(src) || /\bcoachText\b/.test(src) || /\(\s*pl\s*:\s*string\s*,\s*en\s*:\s*string\s*\)/.test(src)
    })
    expect(offenders).toEqual([])
  })
})

describe('plan pamięta język, w którym powstał', () => {
  it('trainctl diff mówi, że opisy w PLAN.md są w innym języku niż bieżący', () => {
    const dir = mkdtempSync(join(tmpdir(), 'trainctl-locale-'))
    try {
      writeFileSync(
        join(dir, 'trainctl.yaml'),
        `athlete:
  recentWeeklyKm: 45
  daysAvailable: [tue, thu, sat]
  results:
    - { date: "2026-03-29", distanceKm: 10, timeSec: 2580 }
goal:
  name: "Autumn Half"
  date: "2026-11-29"
  distanceKm: 21.0975
  priority: A
`,
        'utf-8',
      )
      withLocale('pl', () => cmdPlan(dir, { date: '2026-08-06' }))

      // ten sam plan czytany po angielsku: rodzaje jednostek się zgadzają,
      // ale opisy w plan/PLAN.md zostały polskie — i to musi być powiedziane
      const enDiff = withLocale('en', () => cmdDiff(dir))
      expect(enDiff.output).toContain('"pl"')
      expect(enDiff.output).toContain('trainctl plan')

      // bez zmiany języka żadnej uwagi nie ma
      const plDiff = withLocale('pl', () => cmdDiff(dir))
      expect(plDiff.output).not.toContain('„pl”')
    } finally {
      rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
    }
  })
})
