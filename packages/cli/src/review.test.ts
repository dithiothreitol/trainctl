/** Przegląd tygodnia (faza 8): kompozycja istniejących use-case'ów, read-only. */
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ActivityLap, ExecutionRecord, SyncProvider, SyncedActivity } from 'trainctl-core'
import { cmdInit, cmdLog, cmdPlan, cmdReview } from './commands.ts'
import { AGENTS_FILE } from './agents-md.ts'
import { SECRET_FILE } from './sync.ts'
import { loadPlan, writePlan } from './planfile.ts'
import { setLocale, setUnits } from 'trainctl-core'

// Ten plik weryfikuje ZACHOWANIE komend, a asercje czyta się najłatwiej
// po polsku. Kompletność i jakość tłumaczeń pilnują testy i18n.
setLocale('pl')


const CONFIG = `athlete:
  recentWeeklyKm: 55
  daysAvailable: [tue, wed, thu, sat, sun]
  results:
    - { date: "2026-03-30", distanceKm: 21.0975, timeSec: 5400 }
  tuneUpRaces:
    - { date: "2026-09-05", distanceKm: 10, name: "Bieg Falenicki", priority: B }
goal:
  name: "Maraton testowy"
  date: "2026-11-29"
  distanceKm: 42.195
  priority: A
`

const TODAY = '2026-08-17'

const activities: SyncedActivity[] = [
  { externalId: 'r1', date: '2026-08-11', type: 'Run', distanceKm: 12 },
  { externalId: 'r2', date: '2026-08-13', type: 'Run', distanceKm: 10 },
  { externalId: 'r3', date: '2026-08-15', type: 'Run', distanceKm: 22 },
]

const provider: SyncProvider = {
  name: 'intervals.icu (test)',
  verify: async () => ({ athleteId: 'i0' }),
  listActivities: async (oldest, newest) =>
    activities.filter((a) => a.date >= oldest && a.date <= newest),
  listWellness: async () => [{ date: TODAY, restingHr: 46 }],
  pushWorkouts: async () => ({ pushed: 0, externalIds: [] }),
  listPlannedWorkouts: async () => [],
  deleteWorkout: async () => {},
}
const factory = () => provider

let dir: string
const withKey = () => writeFileSync(join(dir, SECRET_FILE), 'klucz-testowy', 'utf-8')

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'trainctl-rev-'))
  writeFileSync(join(dir, 'trainctl.yaml'), CONFIG, 'utf-8')
  cmdPlan(dir, { date: '2026-08-05' })
})
afterEach(() => rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }))

describe('trainctl review — z kluczem API', () => {
  it('fetches the full adaptation window but summarizes only the selected week', async () => {
    withKey()
    const listActivities = vi.fn(provider.listActivities)
    const r = await cmdReview(dir, { date: TODAY, prepare: true }, () => ({ ...provider, listActivities }))
    // D1: z okrążeniami, jak pull — odświeżenie nie może ich zgubić z migawki
    expect(listActivities).toHaveBeenCalledWith('2026-07-28', TODAY, { laps: true })
    expect(r.data!.period).toEqual({ from: '2026-08-11', to: TODAY, days: 7 })
  })
  it('odświeża dane i pokazuje wszystkie cztery sekcje', async () => {
    withKey()
    const r = await cmdReview(dir, { date: TODAY }, factory)
    expect(r.code).toBe(0)
    expect(r.output).toContain('Za nami')
    expect(r.output).toContain('Przed nami')
    expect(r.output).toContain('Do zrobienia')
    expect(existsSync(join(dir, 'sync.json'))).toBe(true)
  })

  it('liczy objętość z pobranych aktywności', async () => {
    withKey()
    const r = await cmdReview(dir, { date: TODAY }, factory)
    expect(r.output).toMatch(/4[0-9] z \d+ km/) // 12+10+22 = 44 km
  })

  it('proponuje wysyłkę na zegarek, gdy klucz jest', async () => {
    withKey()
    const r = await cmdReview(dir, { date: TODAY }, factory)
    expect(r.output).toContain('trainctl push')
  })

  it('błąd sieci nie wywraca przeglądu — praca na migawce', async () => {
    withKey()
    const breaking = () => ({
      ...provider,
      listActivities: async () => {
        throw new Error('ETIMEDOUT')
      },
    })
    const r = await cmdReview(dir, { date: TODAY }, breaking)
    expect(r.code).toBe(0)
    expect(r.output).toContain('Nie udało się odświeżyć')
    expect(r.output).toContain('Przed nami')
  })
})

describe('trainctl review — bez klucza (offline)', () => {
  it('działa z dziennika i mówi, czego brakuje', async () => {
    cmdLog(dir, { date: '2026-08-11', status: 'done', km: '12' })
    const r = await cmdReview(dir, { date: TODAY }, factory)
    expect(r.code).toBe(0)
    expect(r.output).toContain('Bez klucza API')
    expect(r.output).toContain('trainctl export --what print') // zamiast push
  })

  it('świeży plan bez żadnych danych nadal daje sensowny przegląd', async () => {
    const r = await cmdReview(dir, { date: '2026-08-05' }, factory)
    expect(r.code).toBe(0)
    expect(r.output).toContain('Przed nami')
    expect(r.output).toContain('Do zrobienia')
  })
})

describe('trainctl review — ślad subiektywny (ADR-027)', () => {
  it('cytuje wpisy z RPE i notatkami dosłownie, ostatni wpis dnia wygrywa', async () => {
    cmdLog(dir, { date: '2026-08-11', rpe: '8', note: 'po nocce, ledwo żywy' })
    cmdLog(dir, { date: '2026-08-13', rpe: '4' })
    cmdLog(dir, { date: '2026-08-13', rpe: '5', note: 'jednak lepiej' })
    const r = await cmdReview(dir, { date: TODAY }, factory)
    expect(r.code).toBe(0)
    expect(r.output).toContain('Jak się biegało')
    expect(r.output).toContain('2026-08-11 · RPE 8 · „po nocce, ledwo żywy”')
    expect(r.output).toContain('2026-08-13 · RPE 5 · „jednak lepiej”')
    expect(r.output).not.toContain('RPE 4') // nadpisany wpis nie wraca
  })

  it('wpis spoza okna przeglądu nie wchodzi do śladu', async () => {
    cmdLog(dir, { date: '2026-08-06', rpe: '9', note: 'stare dzieje' })
    const r = await cmdReview(dir, { date: TODAY }, factory)
    expect(r.output).not.toContain('stare dzieje')
  })

  it('bez odczuć w oknie sekcja się nie pojawia', async () => {
    cmdLog(dir, { date: '2026-08-11', status: 'done', km: '12' })
    const r = await cmdReview(dir, { date: TODAY }, factory)
    expect(r.output).not.toContain('Jak się biegało')
  })
})

describe('trainctl review — treść merytoryczna', () => {
  it('uprzedza o starcie kontrolnym w nadchodzącym tygodniu', async () => {
    const r = await cmdReview(dir, { date: '2026-08-31' }, factory)
    expect(r.output).toContain('2026-09-05')
    expect(r.output).toContain('T-10')
  })

  it('przypomina o najbliższym starcie w liście do zrobienia', async () => {
    const r = await cmdReview(dir, { date: TODAY }, factory)
    expect(r.output).toContain('Bieg Falenicki')
  })

  it('nie zmienia planu (read-only poza migawką)', async () => {
    const before = readFileSync(join(dir, 'plan/plan.yaml'), 'utf-8')
    await cmdReview(dir, { date: TODAY }, factory)
    expect(readFileSync(join(dir, 'plan/plan.yaml'), 'utf-8')).toBe(before)
  })

  it('bez planu — czytelny błąd zamiast wyjątku', async () => {
    const empty = mkdtempSync(join(tmpdir(), 'trainctl-rev-none-'))
    const r = await cmdReview(empty, { date: TODAY }, factory)
    expect(r.code).toBe(1)
    rmSync(empty, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
  })
})

describe('trainctl review — wykonanie wobec celu (D2, D3)', () => {
  // Plan z beforeEach: 11.08 akcent 4×1000 m @4:11–4:23/km, 12.08 spokojne (4:49–5:47/km),
  // 15.08 długie (zakres dnia 5:47–6:17/km). Okrążenia wymyślone.
  const lap = (km: number, secPerKm: number, extra: Partial<ActivityLap> = {}): ActivityLap =>
    ({ distanceKm: km, movingTimeSec: Math.round(km * secPerKm), ...extra })
  const accent = (paces: number[]): ActivityLap[] => [
    lap(2, 320, { intensity: 'warmup' }),
    ...paces.flatMap((p, i) => [lap(1, p, { intensity: 'work' }), ...(i < paces.length - 1 ? [lap(0.2, 600, { intensity: 'rest' })] : [])]),
    lap(1.5, 330, { intensity: 'cooldown' }),
  ]
  const run = (date: string, km: number, extra: Partial<SyncedActivity> = {}): SyncedActivity =>
    ({ externalId: `run-${date}`, date, type: 'Run', distanceKm: km, ...extra })
  const review = async (runs: SyncedActivity[]) => {
    withKey()
    const r = await cmdReview(dir, { date: TODAY }, () => ({
      ...provider,
      listActivities: async (oldest: string, newest: string) => runs.filter((a) => a.date >= oldest && a.date <= newest),
    }))
    return { ...r, record: (date: string) => (r.data!.execution as ExecutionRecord[]).find((e) => e.date === date)! }
  }

  it('komplet odcinków: liczba, tempa i liczba w zakresie celu', async () => {
    const r = await review([run('2026-08-11', 8, { laps: accent([255, 258, 262, 270]) })])
    expect(r.output).toContain('Wobec celu:')
    expect(r.output).toContain('4 z 4 odcinków, 3 w zakresie 4:11–4:23/km (4:15, 4:18, 4:22, 4:30/km)')
    expect(r.record('2026-08-11').intervals).toMatchObject({ planned: 4, inRange: 3, extra: 0 })
  })

  it('dwa biegi jednego dnia: okrążenia po kolei według startu', async () => {
    const half = (paces: number[]) => paces.flatMap((p) => [lap(1, p, { intensity: 'work' as const }), lap(0.2, 600, { intensity: 'rest' as const })])
    const r = await review([
      run('2026-08-11', 4, { externalId: 'b', startTime: '2026-08-11T07:40:00', laps: half([262, 270]) }),
      run('2026-08-11', 4, { externalId: 'a', startTime: '2026-08-11T07:00:00', laps: half([255, 258]) }),
    ])
    expect(r.output).toContain('4 z 4 odcinków, 3 w zakresie 4:11–4:23/km (4:15, 4:18, 4:22, 4:30/km)')
  })

  it('część odcinków: trzy z czterech', async () => {
    const r = await review([run('2026-08-11', 7, { laps: accent([255, 258, 262]) })])
    expect(r.output).toContain('3 z 4 odcinków, 3 w zakresie 4:11–4:23/km')
  })

  it('okrążenia automatyczne co kilometr: brak okrążeń pasujących do planu, bez zgadywania', async () => {
    const auto = [320, 315, 255, 300, 258, 310, 262, 330].map((p) => lap(1, p, { trigger: 'distance' as const }))
    const r = await review([run('2026-08-11', 8, { laps: auto })])
    expect(r.output).toContain('brak okrążeń pasujących do planu')
    expect(r.record('2026-08-11').intervals).toMatchObject({ planned: 4, matched: [], reason: 'no-match' })
  })

  it('bieg bez okrążeń: brak nazwany wprost', async () => {
    const r = await review([run('2026-08-11', 8)])
    expect(r.output).toContain('brak okrążeń w danych')
  })

  it('tempo biegu spokojnego i długiego wobec zakresu; bez oceny po tętnie', async () => {
    const r = await review([
      run('2026-08-12', 6.5, { movingTimeSec: Math.round(6.5 * 280), avgHr: 171 }),
      run('2026-08-15', 20, { movingTimeSec: 20 * 360, avgHr: 150 }),
    ])
    expect(r.output).toContain('2026-08-12 · spokojne 4:40/km: szybciej niż 4:49–5:47/km')
    expect(r.output).toContain('2026-08-15 · długie 6:00/km: w zakresie 4:49–6:17/km')
    expect(r.record('2026-08-12').easyPace).toEqual({ paceSecPerKm: 280, range: { loSecPerKm: 289, hiSecPerKm: 347 }, vsRange: 'faster' })
    // tętno biegu jest w danych (avgHr), ale sekcja go nie ocenia (Z-3, Z-6)
    const section = r.output.split('Wobec celu:')[1]!.split(/\r?\n\r?\n/)[0]!
    expect(section).not.toMatch(/tętn|171|150/i)
  })

  it('w milach: tempo na milę, dane w km bez zmian', async () => {
    const previous = setUnits('imperial')
    try {
      const r = await review([run('2026-08-12', 6.5, { movingTimeSec: Math.round(6.5 * 280) })])
      expect(r.output).toContain('spokojne 7:31/mi: szybciej niż 7:45–9:18/mi')
      expect(r.record('2026-08-12').easyPace!.paceSecPerKm).toBe(280)
    } finally {
      setUnits(previous)
    }
  })

  it('sam wpis dziennika bez biegu z zegarka: sekcji nie ma', async () => {
    await cmdLog(dir, { date: '2026-08-11', status: 'done', km: '8' })
    const r = await cmdReview(dir, { date: TODAY })
    expect(r.output).not.toContain('Wobec celu')
    expect((r.data!.execution as ExecutionRecord[]).find((e) => e.date === '2026-08-11')).not.toHaveProperty('intervals')
  })

  it('plan się nie zmienia', async () => {
    const before = readFileSync(join(dir, 'plan', 'plan.yaml'), 'utf-8')
    await review([run('2026-08-11', 8, { laps: accent([240, 240, 240, 240]) })])
    expect(readFileSync(join(dir, 'plan', 'plan.yaml'), 'utf-8')).toBe(before)
  })
})

describe('trainctl review — tabela wykonania (D4)', () => {
  const run = (date: string, km: number, sec?: number): SyncedActivity =>
    ({ externalId: `run-${date}`, date, type: 'Run', distanceKm: km, ...(sec ? { movingTimeSec: sec } : {}) })
  const review = async (runs: SyncedActivity[]) => {
    withKey()
    return cmdReview(dir, { date: TODAY }, () => ({
      ...provider,
      listActivities: async (oldest: string, newest: string) => runs.filter((a) => a.date >= oldest && a.date <= newest),
    }))
  }

  it('układ wiersza: dzień z datą, typ, plan, wykonanie, tempo dnia i status', async () => {
    const r = await review([run('2026-08-11', 8.3, 2400), run('2026-08-14', 5, 1700), run('2026-08-15', 20.2)])
    expect(r.output).toContain('Dzień | Typ | Plan | Wykonanie | Tempo | Status')
    expect(r.output).toContain('WT 11.08 | interwały | 8 km | 8,3 km | 4:49/km | wykonany')
    // bieg poza planem: bez typu i planu
    expect(r.output).toContain('PT 14.08 | 5 km | 5:40/km | bieg poza planem')
    // bieg bez czasu ruchu: bez tempa, reszta wiersza zostaje
    expect(r.output).toContain('SB 15.08 | długie | 20 km | 20,2 km | wykonany')
    expect((r.data!.execution as ExecutionRecord[]).find((e) => e.date === '2026-08-11')!.paceSecPerKm).toBe(289)
  })

  it('bez tempa w danych kolumny tempa nie ma', async () => {
    const r = await review([run('2026-08-11', 8.3)])
    expect(r.output).toContain('Dzień | Typ | Plan | Wykonanie | Status')
    expect(r.output).not.toContain('Tempo')
  })

  it('w milach: dystans i tempo w jednostce widoku, dane w km', async () => {
    const previous = setUnits('imperial')
    try {
      const r = await review([run('2026-08-11', 8.3, 2400)])
      expect(r.output).toContain('WT 11.08 | interwały | 4,97 mi | 5,16 mi | 7:45/mi | wykonany')
      expect((r.data!.execution as ExecutionRecord[]).find((e) => e.date === '2026-08-11')!.actualKm).toBe(8.3)
    } finally {
      setUnits(previous)
    }
  })
})

describe('trainctl review — podpowiedź kalibracji (D5)', () => {
  // Akcenty 4.08 i 11.08: 4×1000 m @4:11–4:23/km. Okrążenia wymyślone.
  const lap = (km: number, secPerKm: number, extra: Partial<ActivityLap> = {}): ActivityLap =>
    ({ distanceKm: km, movingTimeSec: Math.round(km * secPerKm), ...extra })
  const accent = (date: string, paces: number[]): SyncedActivity => ({
    externalId: `acc-${date}`, date, type: 'Run', distanceKm: 8,
    laps: [
      lap(2, 320, { intensity: 'warmup' }),
      ...paces.flatMap((p) => [lap(1, p, { intensity: 'work' }), lap(0.2, 600, { intensity: 'rest' })]),
      lap(1.5, 330, { intensity: 'cooldown' }),
    ],
  })
  const review = async (runs: SyncedActivity[]) => {
    withKey()
    return cmdReview(dir, { date: TODAY }, () => ({
      ...provider,
      listActivities: async (oldest: string, newest: string) => runs.filter((a) => a.date >= oldest && a.date <= newest),
    }))
  }
  const FAST = [240, 241, 239, 242]

  it('dwa akcenty z rzędu szybciej od celu: propozycja startu kontrolnego, plan bez zmian', async () => {
    const before = readFileSync(join(dir, 'plan', 'plan.yaml'), 'utf-8')
    const r = await review([accent('2026-08-04', FAST), accent('2026-08-11', FAST)])
    expect(r.output).toContain('Odcinki w ostatnich akcentach (2026-08-04, 2026-08-11) były szybsze od celu.')
    // W-13: prawdziwy start w oknie 28 dni przed sprawdzianem
    expect(r.output).toContain('start kontrolny 2026-09-05 (Bieg Falenicki) da świeży wynik')
    expect(r.data!.calibration).toEqual({ dates: ['2026-08-04', '2026-08-11'], race: '2026-09-05' })
    expect(readFileSync(join(dir, 'plan', 'plan.yaml'), 'utf-8')).toBe(before)
  })

  it('bez startu w oknie: świeży wynik albo sprawdzian', async () => {
    writeFileSync(join(dir, 'trainctl.yaml'), CONFIG.replace(/  tuneUpRaces:\n.*\n/, ''), 'utf-8')
    const r = await review([accent('2026-08-04', FAST), accent('2026-08-11', FAST)])
    expect(r.output).toContain('wpisz świeży wynik startu do athlete.results albo zaplanuj sprawdzian')
  })

  it('jeden szybki akcent to jeszcze nie sygnał', async () => {
    const r = await review([accent('2026-08-04', [255, 258, 260, 262]), accent('2026-08-11', FAST)])
    expect(r.output).not.toContain('szybsze od celu')
    expect(r.data!.calibration).toBeNull()
  })

  it('sprawdzian z planu w oknie, bez startu kontrolnego', async () => {
    writeFileSync(join(dir, 'trainctl.yaml'), CONFIG.replace(/  tuneUpRaces:\n.*\n/, ''), 'utf-8')
    const plan = loadPlan(dir)
    const day = plan.weeks.flatMap((w) => w.days).find((d) => d.workout && d.date > '2026-08-24')!
    day.workout = { ...day.workout!, kind: 'test' }
    writePlan(dir, plan)
    const r = await review([accent('2026-08-04', FAST), accent('2026-08-11', FAST)])
    expect(r.output).toContain(`sprawdzian ${day.date} da świeży wynik`)
    expect(r.data!.calibration).toEqual({ dates: ['2026-08-04', '2026-08-11'], trial: day.date })
  })

  it('start kontrolny ma pierwszeństwo przed sprawdzianem z planu (W-13)', async () => {
    const plan = loadPlan(dir)
    const day = plan.weeks.flatMap((w) => w.days).find((d) => d.workout && d.date > '2026-08-24')!
    day.workout = { ...day.workout!, kind: 'test' }
    writePlan(dir, plan)
    const r = await review([accent('2026-08-04', FAST), accent('2026-08-11', FAST)])
    expect(r.data!.calibration).toEqual({ dates: ['2026-08-04', '2026-08-11'], race: '2026-09-05' })
  })

  it('start kontrolny, który już się odbył, nie jest propozycją', async () => {
    writeFileSync(join(dir, 'trainctl.yaml'), CONFIG.replace('2026-09-05', '2026-08-09'), 'utf-8')
    const r = await review([accent('2026-08-04', FAST), accent('2026-08-11', FAST)])
    expect(r.output).toContain('wpisz świeży wynik startu do athlete.results albo zaplanuj sprawdzian')
    expect(r.data!.calibration).toEqual({ dates: ['2026-08-04', '2026-08-11'] })
  })

  it('akcent spoza okna adaptacji (21 dni) się nie liczy', async () => {
    // pierwszy przegląd zapisuje szybki akcent 4.08 w migawce; tydzień później jest już poza oknem
    await review([accent('2026-08-04', FAST)])
    withKey()
    const r = await cmdReview(dir, { date: '2026-08-25' }, () => ({
      ...provider,
      listActivities: async (oldest: string, newest: string) => [accent('2026-08-18', [240, 241, 239, 242, 240])].filter((a) => a.date >= oldest && a.date <= newest),
    }))
    expect(r.data!.calibration).toBeNull()
  })

  it('akcent sprzed ostatniego wyniku w profilu się nie liczy', async () => {
    writeFileSync(join(dir, 'trainctl.yaml'), CONFIG.replace('  tuneUpRaces:', '    - { date: "2026-08-08", distanceKm: 10, timeSec: 2460 }\n  tuneUpRaces:'), 'utf-8')
    const r = await review([accent('2026-08-04', FAST), accent('2026-08-11', FAST)])
    expect(r.data!.calibration).toBeNull()
  })
})

describe('pakiet onboardingowy agenta', () => {
  it('trainctl init tworzy AGENTS.md z rytuałami i zasadami', () => {
    const fresh = mkdtempSync(join(tmpdir(), 'trainctl-agents-'))
    const r = cmdInit(fresh)
    expect(r.code).toBe(0)
    expect(r.output).toContain(AGENTS_FILE)
    const text = readFileSync(join(fresh, AGENTS_FILE), 'utf-8')
    expect(text).toContain('trainctl_review')
    expect(text).toContain('Nie regeneruj planu bez pytania')
    expect(text).toContain('athlete.results')
    rmSync(fresh, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
  })

  it('istniejącego AGENTS.md nie nadpisuje (użytkownik mógł go zmienić)', () => {
    const fresh = mkdtempSync(join(tmpdir(), 'trainctl-agents2-'))
    writeFileSync(join(fresh, AGENTS_FILE), 'moje zasady', 'utf-8')
    cmdInit(fresh)
    expect(readFileSync(join(fresh, AGENTS_FILE), 'utf-8')).toBe('moje zasady')
    rmSync(fresh, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
  })
})
