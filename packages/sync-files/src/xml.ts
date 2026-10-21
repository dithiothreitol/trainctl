/**
 * Minimalny, tolerancyjny skaner XML dla TCX i GPX — bez zależności.
 *
 * Nie jest parserem XML: wyszukuje elementy po nazwie lokalnej, ignorując
 * prefiks przestrzeni nazw (`<ns3:Lap>` ≡ `<Lap>`). Wystarcza, bo interesujące
 * nas elementy (Lap, Trackpoint, trkpt…) nie zagnieżdżają się w sobie.
 * Eksporty bywają niechlujne (białe znaki przed prologiem, różne prefiksy
 * w jednym pliku), więc skaner niczego nie waliduje.
 */

export interface XmlElement {
  /** Surowy tekst atrybutów (to, co stoi po nazwie w znaczniku otwierającym). */
  attrs: string
  /** Surowa zawartość między znacznikami; pusta dla elementu samozamykającego. */
  inner: string
}

const PREFIX = '(?:[A-Za-z_][\\w.-]*:)?'

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Wzorce budujemy raz na nazwę: plik z 30 tys. punktów to ~100 tys. wyszukiwań.
 * Współdzielenie obiektów RegExp jest bezpieczne — `matchAll` pracuje na kopii,
 * a `replace` z flagą `g` i `exec` bez niej nie zostawiają stanu `lastIndex`.
 */
const patterns = new Map<string, RegExp>()
const pattern = (key: string, build: () => RegExp): RegExp => {
  let re = patterns.get(key)
  if (!re) {
    re = build()
    patterns.set(key, re)
  }
  return re
}

const elementSource = (name: string, capture: boolean): string => {
  const n = escapeRe(name)
  const attrs = capture ? '([^>]*?)' : '[^>]*?'
  const inner = capture ? '([\\s\\S]*?)' : '[\\s\\S]*?'
  return `<${PREFIX}${n}(?=[\\s/>])${attrs}(?:\\/>|>${inner}<\\/${PREFIX}${n}\\s*>)`
}

/** Usuwa komentarze, żeby `<!-- <Lap> -->` nie udawał danych. */
export function stripComments(text: string): string {
  return text.replace(/<!--[\s\S]*?-->/g, '')
}

/** Wszystkie wystąpienia elementu `name` (nazwa lokalna) w kolejności dokumentu. */
export function elements(text: string, name: string): XmlElement[] {
  const re = pattern(`el:${name}`, () => new RegExp(elementSource(name, true), 'g'))
  const out: XmlElement[] = []
  for (const m of text.matchAll(re)) out.push({ attrs: m[1] ?? '', inner: m[2] ?? '' })
  return out
}

/** Pierwszy element `name` albo `undefined`. */
export function element(text: string, name: string): XmlElement | undefined {
  const re = pattern(`first:${name}`, () => new RegExp(elementSource(name, true)))
  const m = re.exec(text)
  return m ? { attrs: m[1] ?? '', inner: m[2] ?? '' } : undefined
}

/** Usuwa całe poddrzewa elementu `name` — np. `Track` z okrążenia TCX. */
export function without(text: string, name: string): string {
  return text.replace(pattern(`without:${name}`, () => new RegExp(elementSource(name, false), 'g')), '')
}

/** Tekst pierwszego elementu `name` (zdekodowany, przycięty). */
export function childText(text: string, name: string): string | undefined {
  const el = element(text, name)
  if (!el) return undefined
  const value = decodeText(el.inner).trim()
  return value === '' ? undefined : value
}

/** Liczba z tekstu pierwszego elementu `name`. */
export function childNumber(text: string, name: string): number | undefined {
  const value = childText(text, name)
  if (value === undefined) return undefined
  const n = Number(value)
  return Number.isFinite(n) ? n : undefined
}

/** Wartość atrybutu (nazwa lokalna, prefiks dowolny; cudzysłów pojedynczy lub podwójny). */
export function attr(attrs: string, name: string): string | undefined {
  const re = pattern(
    `attr:${name}`,
    () => new RegExp(`(?:^|\\s)${PREFIX}${escapeRe(name)}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`),
  )
  const m = re.exec(attrs)
  if (!m) return undefined
  return decodeText(m[1] ?? m[2] ?? '')
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }

/** CDATA i encje XML (nazwane i numeryczne). */
export function decodeText(raw: string): string {
  return raw
    .split(/(<!\[CDATA\[[\s\S]*?\]\]>)/)
    .map((part) =>
      part.startsWith('<![CDATA[')
        ? part.slice(9, -3)
        : part.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, ref: string) => {
            if (ref[0] === '#') {
              const hex = ref[1] === 'x' || ref[1] === 'X'
              const code = hex ? parseInt(ref.slice(2), 16) : parseInt(ref.slice(1), 10)
              return Number.isFinite(code) && code <= 0x10ffff ? String.fromCodePoint(code) : whole
            }
            return ENTITIES[ref.toLowerCase()] ?? whole
          }),
    )
    .join('')
}
