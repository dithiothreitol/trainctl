/**
 * Wielojęzyczność (faza 12). Angielski jest domyślny, polski dokładany.
 *
 * Zasady, których trzymamy się w całym projekcie:
 *  - **komentarze i nazwy w kodzie zostają po polsku** — to język autora repo;
 *    tłumaczymy wyłącznie to, co widzi użytkownik;
 *  - katalog angielski jest ŹRÓDŁEM TYPU: każdy inny język musi mieć komplet
 *    kluczy i zgodne sygnatury, inaczej `tsc` nie przejdzie (zero bibliotek —
 *    kompilator zamiast runtime'owego „missing key");
 *  - liczebniki i formaty liczb są funkcją języka, nie doklejanym „(s)":
 *    polski ma trzy formy (1 kilometr / 3 kilometry / 5 kilometrów) i przecinek
 *    dziesiętny, angielski dwie formy i kropkę.
 */

export const LOCALES = ['en', 'pl'] as const
export type Locale = (typeof LOCALES)[number]
export const DEFAULT_LOCALE: Locale = 'en'

export const isLocale = (value: unknown): value is Locale =>
  typeof value === 'string' && (LOCALES as readonly string[]).includes(value)

/**
 * Wybór języka z pierwszego źródła, które coś mówi. Kolejność jest celowa:
 * jawny wybór użytkownika (flaga) bije środowisko, środowisko bije plik
 * konfiguracyjny, a brak wszystkiego daje angielski.
 */
export function resolveLocale(
  sources: {
    flag?: string | undefined
    env?: string | undefined
    config?: string | undefined
  } = {},
): Locale {
  for (const value of [sources.flag, sources.env, sources.config]) {
    if (value === undefined || value === '') continue
    // akceptujemy „pl-PL", „PL", „pl_PL" — użytkownik nie musi znać naszej notacji
    const tag = value.trim().toLowerCase().replace('_', '-').split('-')[0]
    if (isLocale(tag)) return tag
  }
  return DEFAULT_LOCALE
}

// ------------------------------------------------------------------ liczebniki

/** Formy liczebnika: `one` i `other` wystarczają angielskiemu, polski bierze wszystkie trzy. */
export interface PluralForms {
  one: string
  /** Polski „paucal": 2–4, 22–24… */
  few?: string
  other: string
}

/**
 * Polska odmiana liczebnika. Ułamki idą do formy dopełniaczowej
 * („2,5 kilometra" jest poprawniejsze niż „2,5 kilometry"), a nastolatki
 * (12–14) mają formę mnogą mimo końcówki 2–4.
 */
export function pluralPl(n: number, forms: PluralForms): string {
  if (!Number.isInteger(n)) return forms.other
  const abs = Math.abs(n)
  if (abs === 1) return forms.one
  const lastTwo = abs % 100
  if (lastTwo >= 12 && lastTwo <= 14) return forms.other
  const last = abs % 10
  return last >= 2 && last <= 4 ? (forms.few ?? forms.other) : forms.other
}

export function pluralEn(n: number, forms: PluralForms): string {
  return Math.abs(n) === 1 ? forms.one : forms.other
}

export function pluralize(locale: Locale, n: number, forms: PluralForms): string {
  return locale === 'pl' ? pluralPl(n, forms) : pluralEn(n, forms)
}

// ------------------------------------------------------------------- formaty

/**
 * Liczba w konwencji języka: polski ma przecinek dziesiętny, angielski kropkę.
 * Bez rozdzielania tysięcy — w kontekście treningowym liczby są małe, a spacja
 * nierozdzielająca psuje wyrównanie kolumn w terminalu.
 */
export function formatNumber(locale: Locale, value: number, maxDecimals = 1): string {
  const rounded = Number(value.toFixed(maxDecimals))
  const text = String(rounded)
  return locale === 'pl' ? text.replace('.', ',') : text
}

/** Data słownie: „6 sierpnia 2026" / „6 August 2026". */
export function formatDate(locale: Locale, iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat(locale === 'pl' ? 'pl-PL' : 'en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(d)
}

/** Czas: „3:30:00" / „52:00" — neutralny kulturowo, ten sam w obu językach. */
export function formatClock(sec: number): string {
  const total = Math.round(sec)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const p = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${p(m)}:${p(s)}` : `${m}:${p(s)}`
}

/** Tempo w s/km. Angielski mówi „4:15/km", polski „4:15/km" — jednostka wspólna. */
export function formatPace(secPerKm: number): string {
  const total = Math.round(secPerKm)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}/km`
}
