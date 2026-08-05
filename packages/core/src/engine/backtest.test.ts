/**
 * Backtest generatora na korpusie: sezon HM (Półmaraton Warszawski, 2025-03-30).
 * Porównuje strukturę tygodni wygenerowanych vs realnych planów trenera
 * (STYCZEŃ–MARZEC 2025). Wymaga lokalnego corpus/parsed/corpus.json (PII,
 * poza repo) — w klonach bez korpusu testy są pomijane.
 *
 * Progi asercji są LUŹNE świadomie: to benchmark strukturalny (objętość,
 * liczba sesji/akcentów, długie wybieganie), nie test zgodności co do km.
 * Szczegółowa tabela: corpus/parsed/BACKTEST.md (generowana przy każdym biegu).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { AthleteProfile, RaceGoal } from '../domain/types.ts'
import { paceZones } from '../zones/daniels.ts'
import { mondayOf } from '../util/dates.ts'
import { planMacrocycle } from './macrocycle.ts'
import { generateMicrocycle } from './microcycle.ts'

const HERE = dirname(fileURLToPath(import.meta.url))
const CORPUS = join(HERE, '../../../../corpus/parsed/corpus.json')
const REPORT = join(HERE, '../../../../corpus/parsed/BACKTEST.md')

interface CorpusSegment { type: string; distance_km?: [number, number] }
interface CorpusWorkout {
  segments: CorpusSegment[]
  race?: { raw: string }
  distance_km_est: [number, number]
  distance_complete: boolean
}
interface CorpusDay { weekday: string; date: string | null; workout?: CorpusWorkout }
interface CorpusPlan {
  source_file: string
  flags: string[]
  anchors: { month: number; year: number }[]
  weeks: { days: CorpusDay[] }[]
}

interface CoachWeek {
  km: number
  complete: boolean
  workouts: number
  quality: number
  races: number
  hasLong: boolean
}

function workoutKind(w: CorpusWorkout): string {
  const types = new Set(w.segments.map((s) => s.type))
  if (w.race) return 'race'
  if (['intervals', 'steady_time', 'time_block'].some((t) => types.has(t))) return 'quality_intervals'
  if (['steady', 'progression', 'alternating', 'pickups'].some((t) => types.has(t))) return 'quality_continuous'
  if (['hills', 'hills_drills', 'drills'].some((t) => types.has(t))) return 'easy_hills'
  if (['cross', 'strength_session'].some((t) => types.has(t))) return 'other'
  return (w.distance_km_est[0] + w.distance_km_est[1]) / 2 >= 18 ? 'long' : 'easy'
}

function coachWeeks(plans: CorpusPlan[], fromIso: string, toIso: string): Map<string, CoachWeek> {
  // dedupe nakładających się plików — preferencja jak w tools/corpus/parse_plans.py
  const byDate = new Map<string, { penalty: number; anchorMiss: number; file: string; w: CorpusWorkout }[]>()
  for (const p of plans) {
    const penalty =
      (p.flags.includes('duplicate_suffix') ? 1 : 0) + (p.flags.includes('recovered') ? 1 : 0)
    for (const wk of p.weeks) {
      for (const d of wk.days) {
        if (!d.workout || !d.date || d.date < fromIso || d.date > toIso) continue
        const month = Number(d.date.slice(5, 7))
        const anchorMiss = p.anchors.some((a) => a.month === month) ? 0 : 1
        const list = byDate.get(d.date) ?? []
        list.push({ penalty, anchorMiss, file: p.source_file, w: d.workout })
        byDate.set(d.date, list)
      }
    }
  }
  const weeks = new Map<string, CoachWeek>()
  for (const [date, cands] of byDate) {
    cands.sort(
      (a, b) => a.penalty - b.penalty || a.anchorMiss - b.anchorMiss || a.file.localeCompare(b.file),
    )
    const w = cands[0]!.w
    const key = mondayOf(date)
    const agg = weeks.get(key) ?? { km: 0, complete: true, workouts: 0, quality: 0, races: 0, hasLong: false }
    const kind = workoutKind(w)
    agg.km += (w.distance_km_est[0] + w.distance_km_est[1]) / 2
    agg.complete &&= w.distance_complete
    agg.workouts += 1
    if (kind === 'race') {
      agg.races += 1
      agg.quality += 1 // start liczony jako sesja intensywna
    } else if (kind.startsWith('quality')) agg.quality += 1
    if (kind === 'long') agg.hasLong = true
    weeks.set(key, agg)
  }
  return weeks
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length % 2 ? s[(s.length - 1) / 2]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2
}

describe.skipIf(!existsSync(CORPUS))('backtest: sezon HM wiosna 2025 vs trener', () => {
  const plans: CorpusPlan[] = JSON.parse(readFileSync(CORPUS, 'utf-8'))
  const FROM = '2025-01-06'
  const RACE = '2025-03-30' // Półmaraton Warszawski (w korpusie)
  const coach = coachWeeks(plans, FROM, RACE)

  const completeKms = [...coach.values()].filter((w) => w.complete).map((w) => w.km)
  const recentWeeklyKm = Math.round(median(completeKms.slice(0, 2)))
  const peakWeeklyKm = Math.round(Math.max(...completeKms))

  const athlete: AthleteProfile = {
    recentWeeklyKm,
    peakWeeklyKm,
    daysAvailable: ['tue', 'wed', 'thu', 'sat', 'sun'],
    results: [],
  }
  const goal: RaceGoal = {
    date: RACE,
    distanceKm: 21.0975,
    name: 'Półmaraton Warszawski',
    priority: 'A',
  }
  const zones = paceZones(51) // kalibracja inż. z temp progowych trenera (~4:15/km)

  const macro = planMacrocycle({ today: FROM, goal, athlete })
  const micros = macro.weeks.map((skeleton) =>
    generateMicrocycle({ skeleton, athlete, zones, goal }),
  )

  const rows: string[] = []
  const volumeRatios: number[] = []
  const qualityDiffs: number[] = []
  const workoutDiffs: number[] = []
  let longAgree = 0
  let longComparable = 0

  for (const mc of micros) {
    const c = coach.get(mc.weekStart)
    if (!c) continue
    const genQuality = mc.days.filter((d) =>
      d.workout && ['quality_intervals', 'quality_continuous', 'sharpener', 'race'].includes(d.workout.kind),
    ).length
    const genWorkouts = mc.days.filter((d) => d.workout).length
    const genLong = mc.days.some((d) => d.workout?.kind === 'long')
    if (c.complete && c.km > 0) volumeRatios.push(mc.totalKm / c.km)
    qualityDiffs.push(Math.abs(genQuality - c.quality))
    workoutDiffs.push(Math.abs(genWorkouts - c.workouts))
    if (c.races === 0) {
      longComparable++
      if (genLong === c.hasLong) longAgree++
    }
    rows.push(
      `| ${mc.weekStart} | ${c.complete ? c.km.toFixed(0) : `~${c.km.toFixed(0)}`} | ${mc.totalKm} ` +
        `| ${c.quality} | ${genQuality} | ${c.workouts} | ${genWorkouts} ` +
        `| ${c.hasLong ? '✓' : '—'} | ${genLong ? '✓' : '—'} | ${c.races || ''} |`,
    )
  }

  const summary = [
    '# Backtest: HM wiosna 2025 (generator vs trener)',
    '',
    `Atleta: recent ${recentWeeklyKm} km/tydz., peak ${peakWeeklyKm}; szczyt planu: ${macro.peakKmPlanned} km.`,
    '',
    '| tydzień | km trener | km gen | Q trener | Q gen | sesje trener | sesje gen | długie T | długie G | starty |',
    '|---|---|---|---|---|---|---|---|---|---|',
    ...rows,
    '',
    `- mediana stosunku objętości gen/trener: **${median(volumeRatios).toFixed(2)}**`,
    `- mediana |różnicy akcentów|: **${median(qualityDiffs)}** (start trenera liczony jako akcent)`,
    `- mediana |różnicy liczby sesji|: **${median(workoutDiffs)}**`,
    `- zgodność długiego wybiegania (tygodnie bez startów): **${longAgree}/${longComparable}**`,
    '',
    '_Kontekst: trener wplatał starty kontrolne (Falenica/ZUK), których generator v1',
    'nie modeluje (tylko cel A) — różnice w tych tygodniach są oczekiwane._',
  ].join('\n')
  writeFileSync(REPORT, summary, 'utf-8')

  it('porównuje co najmniej 8 tygodni', () => {
    expect(rows.length).toBeGreaterThanOrEqual(8)
  })

  it('mediana stosunku objętości w [0,65; 1,35]', () => {
    expect(median(volumeRatios)).toBeGreaterThanOrEqual(0.65)
    expect(median(volumeRatios)).toBeLessThanOrEqual(1.35)
  })

  it('mediana różnicy liczby akcentów ≤ 1', () => {
    expect(median(qualityDiffs)).toBeLessThanOrEqual(1)
  })

  it('mediana różnicy liczby sesji ≤ 1', () => {
    expect(median(workoutDiffs)).toBeLessThanOrEqual(1)
  })

  it('długie wybieganie zgodne w ≥50% tygodni bez startów', () => {
    expect(longAgree / longComparable).toBeGreaterThanOrEqual(0.5)
  })
})
