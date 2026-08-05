/**
 * Konwersja zaplanowanego treningu na natywną składnię „steps" intervals.icu.
 * Źródło składni: Workout Builder Syntax Quick Guide (docs/integrations/intervalsicu.md §1.3).
 *
 * Zasady formatu (potwierdzone):
 *  - krok: `- <czas|dystans> <cel> [Warmup|Cooldown]`
 *  - czas: `10m`, `30s`, `5m30s`; dystans: `500mtr`, `2km` (uwaga: `m` = MINUTY)
 *  - cel tempa biegowego: `4:15/km Pace` (bezwzględny), `Z2 Pace`, `78-82% Pace`
 *  - powtórzenia: `Nx` w osobnej linii, blok otoczony pustymi liniami
 *
 * Świadome ograniczenie: używamy JEDNEJ wartości tempa na krok (środek zakresu).
 * Zakresy bezwzględne (`4:10-4:20/km Pace`) NIE są potwierdzone w dokumentacji
 * — trzymamy się formy pewnej, żeby nie wygenerować treningu, którego serwis
 * nie sparsuje.
 */
import type { PaceRange, PlannedDay, PlannedSegment, PushableWorkout } from '@tren/core'

/** s/km → `M:SS/km Pace`. */
export function paceTarget(pace: PaceRange): string {
  const secPerKm = Math.round((pace.loSecPerKm + pace.hiSecPerKm) / 2)
  const m = Math.floor(secPerKm / 60)
  const s = secPerKm % 60
  return `${m}:${String(s).padStart(2, '0')}/km Pace`
}

/** Sekundy → `1h2m30s` / `5m30s` / `45s` (`m` = minuty!). */
export function duration(totalSec: number): string {
  const sec = Math.round(totalSec)
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  return [h ? `${h}h` : '', m ? `${m}m` : '', s ? `${s}s` : ''].join('') || '0s'
}

/** Kilometry → `2km` albo `500mtr` dla dystansów poniżej kilometra. */
export function distance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)}mtr`
  return Number.isInteger(km) ? `${km}km` : `${km}km`
}

const RECOVERY_PACE: PaceRange = { loSecPerKm: 390, hiSecPerKm: 390 } // ~6:30/km trucht

function segmentSteps(seg: PlannedSegment, easyPace?: PaceRange): string[] {
  const target = seg.pace ? paceTarget(seg.pace) : easyPace ? paceTarget(easyPace) : 'Z1 Pace'

  switch (seg.type) {
    case 'warmup':
      return [`- ${distance(seg.distanceKm ?? 2)} ${target} Warmup`]

    case 'cooldown':
      return [`- ${distance(seg.distanceKm ?? 1)} ${paceTarget(RECOVERY_PACE)} Cooldown`]

    case 'intervals': {
      const reps = seg.reps ?? 1
      const work = seg.repM ? distance(seg.repM / 1000) : duration(180)
      const lines = ['', `${reps}x`, `- ${work} ${target}`]
      if (seg.recoverySec) {
        lines.push(`- ${duration(seg.recoverySec)} ${paceTarget(RECOVERY_PACE)}`)
      }
      lines.push('')
      return lines
    }

    case 'hills': {
      // Podbiegi BEZ celu tempa: pod górę żadne tempo płaskie nie jest osiągalne,
      // a cel na zegarku alarmowałby przez całe powtórzenie. Wysiłek reguluje
      // nachylenie. (Opcjonalność celu w kroku — pytanie otwarte do weryfikacji
      // na realnym koncie, patrz docs/integrations/intervalsicu.md §3.)
      const reps = seg.reps ?? 1
      const work = distance((seg.repM ?? 200) / 1000)
      return ['', `${reps}x`, `- ${work}`, `- ${work}`, '']
    }

    case 'alternating': {
      // bieg zmienny: naprzemiennie 1 km szybko / 1 km wolno
      const totalKm = Math.round(seg.distanceKm ?? 0)
      const fast = seg.pace ? { loSecPerKm: seg.pace.loSecPerKm, hiSecPerKm: seg.pace.loSecPerKm } : undefined
      const slow = seg.pace ? { loSecPerKm: seg.pace.hiSecPerKm, hiSecPerKm: seg.pace.hiSecPerKm } : undefined
      const pairs = Math.floor(totalKm / 2)
      if (!fast || !slow || pairs < 1) return [`- ${distance(totalKm)} ${target}`]
      return ['', `${pairs}x`, `- 1km ${paceTarget(fast)}`, `- 1km ${paceTarget(slow)}`, '']
    }

    case 'progression': {
      // tempo narastające: trzy równe tercje od wolniejszego do szybszego końca
      const totalKm = seg.distanceKm ?? 0
      if (!seg.pace || totalKm < 3) return [`- ${distance(totalKm)} ${target}`]
      const third = Math.round((totalKm / 3) * 10) / 10
      const from = seg.pace.hiSecPerKm
      const to = seg.pace.loSecPerKm
      const stepPace = (i: number): PaceRange => {
        const v = Math.round(from + ((to - from) * i) / 2)
        return { loSecPerKm: v, hiSecPerKm: v }
      }
      return [0, 1, 2].map((i) => `- ${distance(third)} ${paceTarget(stepPace(i))}`)
    }

    case 'easy':
    case 'steady':
      return [`- ${distance(seg.distanceKm ?? 0)} ${target}`]

    case 'race':
      // Sprawdzian: krok BEZ celu tempa (ADR-020) — to pomiar, a nie realizacja
      // zadanego tempa; cel na zegarku sterowałby wynikiem, który ma dopiero powstać.
      // Sam start (bez dystansu w planie) nie jest wypychany jako trening.
      return seg.distanceKm ? [`- ${distance(seg.distanceKm)}`] : []
  }
}

/** Cały trening → tekst w składni intervals.icu (pole `description` eventu). */
export function toWorkoutSyntax(segments: PlannedSegment[]): string {
  const easyPace = segments.find((s) => s.type === 'easy' || s.type === 'warmup')?.pace
  const lines = segments.flatMap((s) => segmentSteps(s, easyPace))
  // składnia wymaga pustej linii przed/po bloku Nx, ale nie tolerauje duplikatów
  const out: string[] = []
  for (const line of lines) {
    if (line === '' && (out.length === 0 || out.at(-1) === '')) continue
    out.push(line)
  }
  while (out.at(-1) === '') out.pop()
  return out.join('\n')
}

const KIND_NAME: Record<string, string> = {
  easy: 'Spokojne',
  long: 'Długie wybieganie',
  easy_hills: 'Podbiegi',
  quality_intervals: 'Interwały',
  quality_continuous: 'Akcent ciągły',
  sharpener: 'Rozruch przedstartowy',
  test: 'Sprawdzian na czas',
  race: 'START',
}

/** Dzień planu → event do wypchnięcia. Dni wolne i starty pomijamy (undefined). */
export function toPushableWorkout(day: PlannedDay, goalName: string): PushableWorkout | undefined {
  const w = day.workout
  if (!w || w.kind === 'race') return undefined
  const description = toWorkoutSyntax(w.segments)
  if (!description) return undefined
  return {
    externalId: `tren-${day.date}`,
    date: day.date,
    name: `${KIND_NAME[w.kind] ?? w.kind} — ${goalName}`,
    description,
    sport: 'run',
    distanceKm: w.distanceKm,
  }
}
