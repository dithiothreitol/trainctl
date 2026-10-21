/**
 * Daty względne w linii poleceń: `yesterday`, `+2`, `thu`, `wczoraj`, `śr`.
 *
 * Tylko CLI. Narzędzia MCP przyjmują wyłącznie ISO — agent liczy daty sam,
 * a „czwartek" w narzędziu byłby dwuznaczny dokładnie tam, gdzie nikt nie
 * patrzy na wynik przed zapisem.
 *
 * Kierunek dla nazw dni: komendy, które patrzą wstecz (`log`, `review`, `adapt`,
 * `pull`), biorą najbliższy taki dzień nie później niż dziś; pozostałe —
 * najbliższy nie wcześniej niż dziś. Dziś pasuje w obu kierunkach.
 */
import { addDays, parseIso } from 'trainctl-core'
import { ui } from './i18n/index.ts'

export type DateDirection = 'forward' | 'back'

const WEEKDAY_ALIASES: Record<string, number> = {
  mon: 0, monday: 0, pn: 0, pon: 0, poniedzialek: 0,
  tue: 1, tuesday: 1, wt: 1, wto: 1, wtorek: 1,
  wed: 2, wednesday: 2, sr: 2, sro: 2, sroda: 2,
  thu: 3, thursday: 3, czw: 3, czwartek: 3,
  fri: 4, friday: 4, pt: 4, pia: 4, piatek: 4,
  sat: 5, saturday: 5, sob: 5, sobota: 5,
  sun: 6, sunday: 6, nd: 6, ndz: 6, nie: 6, niedziela: 6,
}
const OFFSETS: Record<string, number> = {
  today: 0, dzis: 0, dzisiaj: 0,
  tomorrow: 1, jutro: 1,
  yesterday: -1, wczoraj: -1,
}

/** „Śr", „ŚRODA", „sroda" — jedno i to samo. */
const normalize = (text: string) =>
  text.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l')

export function resolveDateInput(input: string, today: string, direction: DateDirection = 'forward'): string {
  const raw = input.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    parseIso(raw)
    return raw
  }
  const key = normalize(raw)
  if (key in OFFSETS) return addDays(today, OFFSETS[key]!)
  const offset = /^([+-])(\d{1,3})$/.exec(key)
  if (offset) return addDays(today, (offset[1] === '-' ? -1 : 1) * Number(offset[2]))
  const target = WEEKDAY_ALIASES[key]
  if (target !== undefined) {
    const current = (parseIso(today).getUTCDay() + 6) % 7
    const delta = direction === 'forward' ? (target - current + 7) % 7 : -((current - target + 7) % 7)
    return addDays(today, delta)
  }
  throw new Error(ui().dates.badInput(input))
}
