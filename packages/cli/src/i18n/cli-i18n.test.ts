/**
 * Kontrola jakości katalogów CLI — odpowiednik `core/src/i18n/i18n.test.ts`,
 * ale dla warstwy interfejsu: nagłówków, kreatora, szablonu trainctl.yaml,
 * instrukcji dla agenta i opisów narzędzi MCP.
 *
 * Kompilator pilnuje kompletu kluczy. Tutaj sprawdzamy to, czego typ nie
 * złapie: czy polski nie jest kalką, czy diakrytyki przeżyły, czy przetłumaczone
 * KOMENTARZE nie zepsuły składni YAML i czy nazwy narzędzi przetrwały tłumaczenie.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { setLocale, withLocale, type Locale } from 'trainctl-core'
import { cmdDiff, cmdPlan } from '../commands.ts'
import { configTemplate, inferredConfigYaml } from '../config.ts'
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
        'cmd.optStatus',
        'cmd.optExportWhat',
        'common.labelOk',
        'common.labelWarn',
        'plan.vdot',
        'week.columns.km',
        'pull.columns.status',
        'desk.columns.status',
        'reschedule.none',
        'wizard.hintDistance',
        'wizard.hintTime',
        'wizard.hintHour',
        'print.columns.km',
        'print.columns.done',
        'print.rest',
        'racePack.km',
        'planMd.rest',
        'configFile.templateAthlete.sex',
        'configFile.templateDeskPrefer',
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
    for (const id of Object.keys(cliEn.rules)) expect(id).toMatch(/^[A-Z]-\d{1,2}$/)
  })

  it('każde objaśnienie cytuje źródło albo korpus', () => {
    // Reguły inżynierskie bez bezpośredniego źródła — wymienione jawnie, żeby
    // dopisanie kolejnej wymagało świadomej decyzji, nie przeoczenia.
    const withoutSource = ['T-9', 'T-12', 'W-13']
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
  const en = cliEn.agentsMd()
  const pl = cliPl.agentsMd()

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
