/**
 * Kontrola jakości tłumaczeń. Nie sprawdzamy „czy string istnieje" (to robi
 * kompilator), tylko rzeczy, których typ nie złapie: odmianę, formaty liczb,
 * diakrytyki i to, czy polski nie jest kalką angielskiego.
 */
import { describe, expect, it } from 'vitest'
import { coreEn } from './core-en.ts'
import { corePl } from './core-pl.ts'
import {
  formatDate,
  formatNumber,
  LOCALES,
  messages,
  pluralEn,
  pluralPl,
  resolveLocale,
  setLocale,
  withLocale,
  type Locale,
} from './index.ts'

const CATALOGS: Record<Locale, typeof coreEn> = { en: coreEn, pl: corePl }

/** Rekurencyjnie zbiera ścieżki kluczy katalogu. */
function keyPaths(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const path = prefix ? `${prefix}.${k}` : k
    return v !== null && typeof v === 'object' ? keyPaths(v as object, path) : [path]
  })
}

describe('kompletność katalogów', () => {
  it('polski ma dokładnie te same klucze co angielski', () => {
    expect(keyPaths(corePl).sort()).toEqual(keyPaths(coreEn).sort())
  })

  it('każdy klucz jest stringiem albo funkcją — brak pustych miejsc', () => {
    for (const [locale, catalog] of Object.entries(CATALOGS)) {
      for (const path of keyPaths(catalog)) {
        const value = path.split('.').reduce<any>((o, k) => o[k], catalog)
        expect(typeof value, `${locale}.${path}`).toMatch(/string|function/)
        if (typeof value === 'string') expect(value.trim(), `${locale}.${path}`).not.toBe('')
      }
    }
  })

  it('funkcje przyjmują tyle samo argumentów w obu językach', () => {
    for (const path of keyPaths(coreEn)) {
      const en = path.split('.').reduce<any>((o, k) => o[k], coreEn)
      const pl = path.split('.').reduce<any>((o, k) => o[k], corePl)
      if (typeof en === 'function') expect(pl.length, path).toBe(en.length)
    }
  })
})

describe('polski nie jest kalką', () => {
  it('teksty faktycznie się różnią między językami', () => {
    const strings = keyPaths(coreEn).filter(
      (p) => typeof p.split('.').reduce<any>((o, k) => o[k], coreEn) === 'string',
    )
    const identical = strings.filter((p) => {
      const en = p.split('.').reduce<any>((o, k) => o[k], coreEn)
      const pl = p.split('.').reduce<any>((o, k) => o[k], corePl)
      return en === pl
    })
    // dopuszczamy wyłącznie zapożyczenia, które po polsku brzmią tak samo
    expect(identical.sort()).toEqual(['desk.windowLunch', 'phase.taper'])
  })

  it('polskie teksty używają diakrytyków, nie ich okaleczonych wersji', () => {
    const joined = keyPaths(corePl)
      .map((p) => p.split('.').reduce<any>((o, k) => o[k], corePl))
      .filter((v) => typeof v === 'string')
      .join(' ')
    expect(joined).toMatch(/[ąćęłńóśźż]/)
    // typowe kalectwa po złym kodowaniu
    expect(joined).not.toMatch(/[ĹĂÂ]|â€|Ã³/)
  })

  it('polski używa cudzysłowów „…", nie prostych', () => {
    const withQuotes = keyPaths(corePl)
      .map((p) => p.split('.').reduce<any>((o, k) => o[k], corePl))
      .filter((v): v is string => typeof v === 'string' && v.includes('„'))
    for (const text of withQuotes) expect(text).toMatch(/„[^"]*"/)
  })
})

describe('odmiana liczebnika', () => {
  const forms = { one: 'kilometr', few: 'kilometry', other: 'kilometrów' }

  it('polski: trzy formy, z pułapką nastolatek', () => {
    expect(pluralPl(1, forms)).toBe('kilometr')
    expect(pluralPl(2, forms)).toBe('kilometry')
    expect(pluralPl(4, forms)).toBe('kilometry')
    expect(pluralPl(5, forms)).toBe('kilometrów')
    expect(pluralPl(12, forms)).toBe('kilometrów') // nie „kilometry"!
    expect(pluralPl(13, forms)).toBe('kilometrów')
    expect(pluralPl(22, forms)).toBe('kilometry')
    expect(pluralPl(25, forms)).toBe('kilometrów')
    expect(pluralPl(102, forms)).toBe('kilometry')
    expect(pluralPl(112, forms)).toBe('kilometrów')
  })

  it('polski: ułamek idzie w dopełniacz („2,5 kilometra")', () => {
    expect(pluralPl(2.5, { one: 'kilometr', few: 'kilometry', other: 'kilometra' })).toBe('kilometra')
  })

  it('angielski: tylko liczba pojedyncza i mnoga', () => {
    expect(pluralEn(1, { one: 'km', other: 'km' })).toBe('km')
    expect(pluralEn(0, { one: 'day', other: 'days' })).toBe('days')
    expect(pluralEn(2, { one: 'day', other: 'days' })).toBe('days')
  })

  it('katalogi stosują odmianę w praktyce', () => {
    expect(corePl.units.km(1)).toBe('1 kilometr')
    expect(corePl.units.km(3)).toBe('3 kilometry')
    expect(corePl.units.km(5)).toBe('5 kilometrów')
    expect(corePl.units.km(22)).toBe('22 kilometry')
    expect(coreEn.units.km(1)).toBe('1 km')
    expect(coreEn.units.km(22)).toBe('22 km')
  })

  it('przerwy odmieniają się razem z liczbą', () => {
    expect(corePl.workout.intervalsKm(6, '4:15', 2)).toContain('przerwy 2 minutowe')
    expect(corePl.workout.intervalsKm(6, '4:15', 1)).toContain('przerwa 1 minutowa')
  })
})

describe('formaty liczb i dat', () => {
  it('polski ma przecinek dziesiętny, angielski kropkę', () => {
    expect(formatNumber('pl', 2.5)).toBe('2,5')
    expect(formatNumber('en', 2.5)).toBe('2.5')
    expect(formatNumber('pl', 21)).toBe('21')
  })

  it('data słownie w konwencji języka', () => {
    expect(formatDate('pl', '2026-08-06')).toContain('sierpnia')
    expect(formatDate('en', '2026-08-06')).toContain('August')
    expect(formatDate('pl', 'bzdura')).toBe('bzdura')
  })

  it('polskie km/tydz. vs angielskie km/week', () => {
    expect(corePl.units.kmPerWeek(55)).toBe('55 km/tydz.')
    expect(coreEn.units.kmPerWeek(55)).toBe('55 km/week')
  })
})

describe('wybór języka', () => {
  it('domyślnie angielski', () => {
    expect(resolveLocale()).toBe('en')
    expect(resolveLocale({ flag: undefined, env: '', config: undefined })).toBe('en')
  })

  it('flaga bije env, env bije konfigurację', () => {
    expect(resolveLocale({ flag: 'pl', env: 'en', config: 'en' })).toBe('pl')
    expect(resolveLocale({ env: 'pl', config: 'en' })).toBe('pl')
    expect(resolveLocale({ config: 'pl' })).toBe('pl')
  })

  it('akceptuje warianty zapisu tagu', () => {
    for (const tag of ['pl-PL', 'PL', 'pl_PL', ' pl ', 'pl-pl']) {
      expect(resolveLocale({ flag: tag }), tag).toBe('pl')
    }
  })

  it('nieznany język nie wysypuje — wraca do angielskiego', () => {
    expect(resolveLocale({ flag: 'de' })).toBe('en')
    expect(resolveLocale({ flag: 'klingon', env: 'pl' })).toBe('pl')
  })
})

describe('przełączanie języka w procesie', () => {
  it('withLocale przywraca poprzedni, także po wyjątku', () => {
    setLocale('en')
    withLocale('pl', () => expect(messages().kind.easy).toBe('spokojne'))
    expect(messages().kind.easy).toBe('easy run')
    expect(() => withLocale('pl', () => { throw new Error('bum') })).toThrow('bum')
    expect(messages().kind.easy).toBe('easy run')
  })

  it('każdy zadeklarowany język ma katalog', () => {
    for (const locale of LOCALES) expect(messages(locale).kind.easy).toBeTruthy()
  })
})
