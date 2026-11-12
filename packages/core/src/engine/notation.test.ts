import { describe, expect, it } from 'vitest'
import type { PlannedSegment, PlannedWorkout } from '../domain/types.ts'
import type { SessionStep, TrainingSession } from '../sports/types.ts'
import { accentLine, getNotation, isNotationStyle, notationLegend, sessionLine, sessionStructure, setNotation, workoutLine, workoutStructure } from './notation.ts'

const easyPace = { loSecPerKm: 305, hiSecPerKm: 365 }
const intervalPace = { loSecPerKm: 265, hiSecPerKm: 279 } // środek 4:32
const workout = (kind: PlannedWorkout['kind'], segments: PlannedSegment[], extra: Partial<PlannedWorkout> = {}): PlannedWorkout => ({
  kind, segments, ruleRefs: [], distanceKm: segments.reduce((s, x) => s + (x.distanceKm ?? 0), 0), ...extra,
})
const seg = (type: PlannedSegment['type'], over: Partial<PlannedSegment> = {}): PlannedSegment => ({ type, description: 'opis słowny', ...over })
const frame = (main: PlannedSegment) => [seg('warmup', { distanceKm: 3 }), main, seg('cooldown', { distanceKm: 1 })]
const session = (sport: TrainingSession['sport'], steps: SessionStep[], extra: Partial<TrainingSession> = {}): TrainingSession => ({
  id: 's1', date: '2026-11-10', sport, purpose: 'intervals', steps, durationSec: 3600, preparationSec: 900, ruleRefs: [], ...extra,
})
const pl = { locale: 'pl' as const }
const en = { locale: 'en' as const }
const ascii = { locale: 'pl' as const, ascii: true }

describe('C1: notacja jednostki biegowej ze struktury', () => {
  it('interwały z ramą i przerwą w marszu (spec C1)', () => {
    const w = workout('quality_intervals', frame(seg('intervals', { reps: 4, repM: 1000, distanceKm: 4, pace: intervalPace, recoverySec: 120, recoveryMode: 'walk' })))
    expect(workoutLine(w, pl)).toBe("RG 3 km · 4×1 km @4:32 p. 2' marsz · SCH 1 km")
    expect(workoutLine(w, en)).toBe("WU 3 km · 4×1 km @4:32 r. 2' walk · CD 1 km")
    expect(workoutLine(w, ascii)).toBe("RG 3 km | 4x1 km @4:32 p. 2' marsz | SCH 1 km")
  })

  it('odcinki @I z przerwą w truchcie i przerwą w połowie serii', () => {
    const w = workout('quality_intervals', [seg('intervals', { reps: 6, repM: 1000, distanceKm: 6, pace: { loSecPerKm: 240, hiSecPerKm: 248 }, recoverySec: 180, recoveryMode: 'jog', setBreak: { afterRep: 3, sec: 240, mode: 'walk' } })])
    expect(workoutLine(w, pl)).toBe("6×1 km @4:04 p. 3' trucht, po 3. odcinku 4' marsz")
    expect(workoutLine(w, en)).toBe("6×1 km @4:04 r. 3' jog, after rep 3 4' walk")
  })

  it('plan sprzed C1 bez rodzaju przerwy: notacja go pomija', () => {
    const w = workout('quality_intervals', [seg('intervals', { reps: 4, repM: 1000, distanceKm: 4, pace: intervalPace, recoverySec: 120 })])
    expect(workoutLine(w, pl)).toBe("4×1 km @4:32 p. 2'")
  })

  it('krótkie odcinki w metrach, długie w kilometrach, przerwa z sekundami', () => {
    expect(workoutLine(workout('sharpener', [seg('intervals', { reps: 5, repM: 400, distanceKm: 2, pace: intervalPace, recoverySec: 90, recoveryMode: 'jog' })]), pl)).toBe('5×400 m @4:32 p. 1\'30" trucht')
    expect(workoutLine(workout('quality_intervals', [seg('intervals', { reps: 2, repM: 3000, distanceKm: 6, pace: intervalPace, recoverySec: 45 })]), en)).toBe('2×3 km @4:32 r. 45"')
  })

  it('bieg spokojny, długie i przebieżki z zakresem tempa', () => {
    expect(workoutLine(workout('easy', [seg('easy', { distanceKm: 17, pace: easyPace })]), pl)).toBe('17 km @5:05–6:05')
    expect(workoutLine(workout('long', [seg('easy', { distanceKm: 19, pace: { loSecPerKm: 365, hiSecPerKm: 395 } })]), ascii)).toBe('19 km @6:05-6:35')
    const strides = workout('easy', [seg('easy', { distanceKm: 8.5, pace: easyPace, strides: { count: 6, meters: 80 } })])
    expect(workoutLine(strides, pl)).toBe('8,5 km @5:05–6:05 + 6×80 m przebieżki')
    expect(workoutLine(strides, en)).toBe('8.5 km @5:05–6:05 + 6×80 m strides')
  })

  it('podbiegi, narastanie, zmienny i bieg w równym tempie', () => {
    const hills = workout('easy_hills', [seg('easy', { distanceKm: 5, pace: easyPace }), seg('hills', { reps: 6, repM: 150, distanceKm: 1.8 }), seg('cooldown', { distanceKm: 1 })])
    expect(workoutLine(hills, pl)).toBe('5 km @5:05–6:05 · podbiegi 6×150 m · SCH 1 km')
    expect(workoutLine(hills, en)).toBe('5 km @5:05–6:05 · hills 6×150 m · CD 1 km')
    const progression = workout('quality_continuous', frame(seg('progression', { distanceKm: 4, pace: { loSecPerKm: 272, hiSecPerKm: 301 } })))
    expect(workoutLine(progression, pl)).toBe('RG 3 km · 4 km 5:01→4:32 · SCH 1 km')
    expect(workoutLine(progression, ascii)).toBe('RG 3 km | 4 km 5:01->4:32 | SCH 1 km')
    const alternating = workout('quality_continuous', [seg('alternating', { distanceKm: 4, pace: { loSecPerKm: 265, hiSecPerKm: 305 } })])
    expect(workoutLine(alternating, pl)).toBe('4 km: 1 km @4:25 / 1 km @5:05')
    expect(workoutLine(workout('easy', [seg('steady', { distanceKm: 6, pace: intervalPace })]), en)).toBe('6 km @4:32')
  })

  it('sprawdzian i start', () => {
    const test = workout('test', frame(seg('race', { distanceKm: 5 })))
    expect(workoutLine(test, pl)).toBe('RG 3 km · 5 km na czas · SCH 1 km')
    expect(workoutLine(test, en)).toBe('WU 3 km · 5 km time trial · CD 1 km')
    const race = workout('race', [seg('race', { distanceKm: 21.0975 })], { distanceKm: 0, raceDistanceKm: 21.0975 })
    expect(workoutLine(race, pl)).toBe('START 21,1 km')
    expect(workoutLine(race, en)).toBe('RACE 21.1 km')
  })

  it('tempo zaokrąglane do pełnej sekundy, bez „4:60”', () => {
    expect(workoutLine(workout('easy', [seg('steady', { distanceKm: 5, pace: { loSecPerKm: 299.6, hiSecPerKm: 299.6 } })]), pl)).toBe('5 km @5:00')
  })
})

describe('C1: notacja sesji planu v2', () => {
  it('pływanie: rozgrzewka, technika, powtórzenia z tempem na 100 m i przerwą, schłodzenie', () => {
    const swim = session('swim', [
      { role: 'warmup', durationSec: 240, distanceM: 200, target: { kind: 'open' } },
      { role: 'drill', durationSec: 60, distanceM: 50, repeat: 4, restSec: 15, target: { kind: 'open' } },
      { role: 'work', durationSec: 105, distanceM: 100, repeat: 10, restSec: 20, target: { kind: 'pace', seconds: 105, perM: 100 } },
      { role: 'cooldown', durationSec: 120, distanceM: 100, target: { kind: 'open' } },
    ])
    expect(sessionLine(swim, pl)).toBe('RG 200 m · technika 4×50 m p. 15" · 10×100 m @1:45/100 m p. 20" · SCH 100 m')
    expect(sessionLine(swim, en)).toBe('WU 200 m · drill 4×50 m r. 15" · 10×100 m @1:45/100 m r. 20" · CD 100 m')
  })

  it('rower: moc w watach, czas w minutach, odpoczynek jako osobny krok; rama bez celu (C2)', () => {
    const bike = session('bike', [
      { role: 'warmup', durationSec: 600, target: { kind: 'power', watts: 150 } },
      { role: 'work', durationSec: 240, repeat: 5, restSec: 120, target: { kind: 'power', watts: 250, ftpPercent: 105 } },
      { role: 'rest', durationSec: 300, target: { kind: 'open' } },
      { role: 'cooldown', durationSec: 600, target: { kind: 'open' } },
    ])
    expect(sessionLine(bike, pl)).toBe("RG 10' · 5×4' @250 W p. 2' · p. 5' · SCH 10'")
    expect(sessionLine(bike, { ...en, ascii: true })).toBe("WU 10' | 5x4' @250 W r. 2' | r. 5' | CD 10'")
    expect(sessionStructure(bike, pl)[0]).toEqual({ part: 'rozgrzewka', dose: "10'", target: '150 W', recovery: '' })
  })

  it('bieg v2: z krokami tempo na km; z migracji czyta segmenty', () => {
    expect(sessionLine(session('run', [{ role: 'work', durationSec: 2700, target: { kind: 'pace', seconds: 330, perM: 1000 } }]), pl)).toBe("45' @5:30")
    const legacy = workout('easy', [seg('easy', { distanceKm: 10, pace: easyPace })])
    expect(sessionLine(session('run', [{ role: 'work', durationSec: 3600, target: { kind: 'open' } }], { legacyWorkout: legacy }), pl)).toBe('10 km @5:05–6:05')
    expect(sessionLine(legacy, en)).toBe('10 km @5:05–6:05')
  })

  it('siła: sama nazwa w języku wyjścia', () => {
    expect(sessionLine(session('strength', [], { purpose: 'strength' }), pl)).toBe('siła')
    expect(sessionLine(session('strength', [], { purpose: 'strength' }), en)).toBe('strength')
  })

  it('bez ANSI; w trybie ASCII symbole notacji bez Unicode (słowa zostają w języku wyjścia)', () => {
    const w = workout('quality_continuous', frame(seg('progression', { distanceKm: 4, pace: { loSecPerKm: 272, hiSecPerKm: 301 } })))
    for (const line of [workoutLine(w, pl), workoutLine(w, en), workoutLine(w, ascii)]) expect(line).not.toContain('\x1b[')
    expect(workoutLine(w, ascii)).toMatch(/^[\x20-\x7e]+$/)
  })
})

describe('C9: notacja w milach', () => {
  const mi = { locale: 'pl' as const, units: 'imperial' as const }
  it('dystans ciągły w milach, tempo na milę, odcinki w metrach (bez „km")', () => {
    const w = workout('quality_intervals', frame(seg('intervals', { reps: 4, repM: 1000, distanceKm: 4, pace: intervalPace, recoverySec: 120, recoveryMode: 'walk' })))
    expect(workoutLine(w, mi)).toBe("RG 1,9 mi · 4×1000 m @7:18 p. 2' marsz · SCH 0,6 mi")
    expect(workoutLine(workout('easy', [seg('easy', { distanceKm: 17, pace: easyPace })]), { ...mi, locale: 'en' })).toBe('10.6 mi @8:11–9:47')
    expect(workoutLine(workout('quality_continuous', [seg('alternating', { distanceKm: 4, pace: { loSecPerKm: 265, hiSecPerKm: 305 } })]), mi)).toBe('2,5 mi: 1000 m @7:06 / 1000 m @8:11')
    const race = workout('race', [seg('race', { distanceKm: 21.0975 })], { raceDistanceKm: 21.0975 })
    expect(workoutLine(race, mi)).toBe('START 13,1 mi')
    // 265 i 279 s/km × 1,609344 = 426,5 i 449,0 s/mi
    expect(workoutStructure(w, mi)[1]).toEqual({ part: 'główna', dose: '4×1000 m', target: '7:06–7:29', recovery: "2' marsz" })
    expect(accentLine(w, mi)).toBe('4×1000 m @7:18')
    for (const line of [workoutLine(w, mi), accentLine(w, mi)]) expect(line).not.toContain('km')
  })

  it('pływanie zostaje na 100 m, moc w watach', () => {
    const swim = session('swim', [{ role: 'work', durationSec: 105, distanceM: 100, repeat: 10, restSec: 20, target: { kind: 'pace', seconds: 105, perM: 100 } }])
    expect(sessionLine(swim, mi)).toBe('10×100 m @1:45/100 m p. 20"')
  })
})

describe('C2: część główna do siatki sezonu', () => {
  it('bez ramy, biegu spokojnego przed akcentem, przerw i przebieżek', () => {
    const intervals = workout('quality_intervals', frame(seg('intervals', { reps: 4, repM: 1000, distanceKm: 4, pace: intervalPace, recoverySec: 120, recoveryMode: 'walk' })))
    expect(accentLine(intervals, pl)).toBe('4×1 km @4:32')
    const hills = workout('easy_hills', [seg('easy', { distanceKm: 5, pace: easyPace }), seg('hills', { reps: 6, repM: 150, distanceKm: 1.8 }), seg('cooldown', { distanceKm: 1 })])
    expect(accentLine(hills, en)).toBe('hills')
    expect(accentLine(workout('test', frame(seg('race', { distanceKm: 5 }))), pl)).toBe('5 km na czas')
    expect(accentLine(workout('easy', [seg('easy', { distanceKm: 8, pace: easyPace, strides: { count: 6, meters: 80 } })]), ascii)).toBe('8 km @5:05-6:05')
    expect(accentLine(workout('quality_continuous', [seg('alternating', { distanceKm: 4.5, pace: { loSecPerKm: 265, hiSecPerKm: 305 } })]), pl)).toBe('zmienny 4,5 km')
  })

  it('serie w tym samym tempie: tempo raz, na końcu; w innym tempie przy każdej', () => {
    const fast = { loSecPerKm: 240, hiSecPerKm: 248 }
    const mixed = workout('quality_intervals', frame(seg('intervals', { reps: 3, repM: 1000, distanceKm: 3, pace: fast, recoverySec: 120 })))
    mixed.segments.splice(2, 0, seg('intervals', { reps: 3, repM: 400, distanceKm: 1.2, pace: fast }), seg('intervals', { reps: 3, repM: 200, distanceKm: 0.6, pace: intervalPace }))
    expect(accentLine(mixed, pl)).toBe('3×1 km + 3×400 m @4:04 + 3×200 m @4:32')
  })

  it('sesja v2: same serie, bez przerw i bez pracy ciągłej po serii; bez serii cała praca', () => {
    const bike = session('bike', [
      { role: 'warmup', durationSec: 600, target: { kind: 'power', watts: 150 } },
      { role: 'work', durationSec: 240, repeat: 5, restSec: 120, target: { kind: 'power', watts: 250 } },
      { role: 'work', durationSec: 720, target: { kind: 'power', watts: 132 } },
      { role: 'cooldown', durationSec: 600, target: { kind: 'open' } },
    ])
    expect(accentLine(bike, pl)).toBe("5×4' @250 W")
    const steady = session('bike', [{ role: 'work', durationSec: 1800, target: { kind: 'power', watts: 200 } }])
    expect(accentLine(steady, en)).toBe("30' @200 W")
  })
})

describe('C2: struktura jednostki w widoku dnia', () => {
  const cells = (rows: ReturnType<typeof sessionStructure>) => rows.map((r) => [r.part, r.dose, r.target, r.recovery])

  it('interwały: rama, zakres tempa odcinka, przerwa z rodzajem i przerwą w połowie serii', () => {
    const w = workout('quality_intervals', frame(seg('intervals', { reps: 6, repM: 1000, distanceKm: 6, pace: { loSecPerKm: 265, hiSecPerKm: 278 }, recoverySec: 120, recoveryMode: 'jog', setBreak: { afterRep: 3, sec: 240, mode: 'walk' } })))
    w.segments[0]!.pace = easyPace
    expect(cells(workoutStructure(w, pl))).toEqual([
      ['rozgrzewka', '3 km', '5:05–6:05', ''],
      ['główna', '6×1 km', '4:25–4:38', "2' trucht, po 3. odcinku 4' marsz"],
      ['schłodzenie', '1 km', 'trucht', ''],
    ])
    expect(cells(workoutStructure(w, { locale: 'en', ascii: true }))[1]).toEqual(['main set', '6x1 km', '4:25-4:38', "2' jog, after rep 3 4' walk"])
  })

  it('spokojny z przebieżkami, podbiegi, narastanie, zmienny, sprawdzian i start', () => {
    expect(cells(workoutStructure(workout('easy', [seg('easy', { distanceKm: 8, pace: easyPace, strides: { count: 6, meters: 80 } })]), pl)))
      .toEqual([['spokojnie', '8 km', '5:05–6:05', ''], ['przebieżki', '6×80 m', '', '']])
    expect(cells(workoutStructure(workout('easy_hills', [seg('hills', { reps: 6, repM: 150, distanceKm: 1.8 })]), en))).toEqual([['hills', '6×150 m', 'easy', 'jog down']])
    expect(cells(workoutStructure(workout('quality_continuous', [seg('progression', { distanceKm: 4, pace: { loSecPerKm: 272, hiSecPerKm: 301 } })]), pl))).toEqual([['narastające', '4 km', '5:01→4:32', '']])
    expect(cells(workoutStructure(workout('quality_continuous', [seg('alternating', { distanceKm: 4, pace: { loSecPerKm: 265, hiSecPerKm: 305 } })]), pl))).toEqual([['zmienny', '4 km', '1 km 4:25 / 1 km 5:05', '']])
    expect(cells(workoutStructure(workout('test', [seg('race', { distanceKm: 5 })]), en))).toEqual([['time trial', '5 km', '', '']])
    expect(cells(workoutStructure(workout('race', [seg('race', { distanceKm: 21.0975 })], { raceDistanceKm: 21.0975 }), pl))).toEqual([['start', '21,1 km', '', '']])
  })

  it('sesja v2: cel tempem albo mocą, przy celu otwartym zakres RPE; siła bez struktury', () => {
    const swim = session('swim', [
      { role: 'warmup', durationSec: 240, distanceM: 200, target: { kind: 'open' }, effort: { min: 2, max: 3, cue: '' } },
      { role: 'work', durationSec: 105, distanceM: 100, repeat: 10, restSec: 20, sendoffSec: 125, target: { kind: 'pace', seconds: 105, perM: 100 } },
    ])
    expect(cells(sessionStructure(swim, pl))).toEqual([
      ['rozgrzewka', '200 m', 'RPE 2–3', ''],
      ['praca', '10×100 m', '1:45/100 m', '20", co 2\'05"'],
    ])
    const bike = session('bike', [{ role: 'work', durationSec: 240, repeat: 5, restSec: 120, target: { kind: 'power', watts: 250 } }])
    expect(cells(sessionStructure(bike, en))).toEqual([['work', "5×4'", '250 W', "2'"]])
    expect(sessionStructure(session('strength', [], { purpose: 'strength' }), pl)).toEqual([])
    const legacy = workout('easy', [seg('easy', { distanceKm: 10, pace: easyPace })])
    expect(cells(sessionStructure(session('run', [], { legacyWorkout: legacy }), pl))).toEqual([['spokojnie', '10 km', '5:05–6:05', '']])
  })
})

describe('C10: notacja klubowa', () => {
  const club = { locale: 'pl' as const, style: 'club' as const }
  const intervals = (reps: number, repM: number, extra: Partial<PlannedSegment> = {}) =>
    seg('intervals', { reps, repM, distanceKm: (reps * repM) / 1000, pace: intervalPace, recoverySec: 120, recoveryMode: 'walk', ...extra })

  it('odcinki według długości: do 300 m rytmy, od 2 km trzeci zakres, pomiędzy wytrzymałość tempowa', () => {
    expect(workoutLine(workout('quality_intervals', frame(intervals(4, 1000))), club)).toBe("RG 3 km · WT 4×1 km @4:32 p. 2' marsz · SCH 1 km")
    expect(workoutLine(workout('quality_intervals', [intervals(2, 3000)]), club)).toBe("BC3 2×3 km @4:32 p. 2' marsz")
    expect(workoutLine(workout('quality_intervals', [intervals(2, 2000)]), club)).toBe("BC3 2×2 km @4:32 p. 2' marsz")
    expect(workoutLine(workout('sharpener', [intervals(5, 300, { recoverySec: 60, recoveryMode: 'jog' })]), club)).toBe("RT 5×300 m @4:32 p. 1' trucht")
    expect(workoutLine(workout('quality_intervals', [intervals(5, 400)]), club)).toBe("WT 5×400 m @4:32 p. 2' marsz")
  })

  it('bieg spokojny, długie i przebieżki: OWB1 i rytmy', () => {
    expect(workoutLine(workout('easy', [seg('easy', { distanceKm: 17, pace: easyPace })]), club)).toBe('OWB1 17 km @5:05–6:05')
    expect(workoutLine(workout('long', [seg('easy', { distanceKm: 19, pace: { loSecPerKm: 365, hiSecPerKm: 395 } })]), club)).toBe('OWB1 19 km @6:05–6:35')
    const strides = workout('easy', [seg('easy', { distanceKm: 8.5, pace: easyPace, strides: { count: 6, meters: 80 } })])
    expect(workoutLine(strides, club)).toBe('OWB1 8,5 km @5:05–6:05 + RT 6×80 m')
  })

  it('podbiegi, narastanie, zmienny i równe tempo', () => {
    const hills = workout('easy_hills', [seg('easy', { distanceKm: 5, pace: easyPace }), seg('hills', { reps: 6, repM: 150, distanceKm: 1.8 }), seg('cooldown', { distanceKm: 1 })])
    expect(workoutLine(hills, club)).toBe('OWB1 5 km @5:05–6:05 · SB 6×150 m · SCH 1 km')
    expect(workoutLine(workout('quality_continuous', frame(seg('progression', { distanceKm: 4, pace: { loSecPerKm: 272, hiSecPerKm: 301 } }))), club))
      .toBe('RG 3 km · BNP 4 km 5:01→4:32 · SCH 1 km')
    expect(workoutLine(workout('quality_continuous', [seg('alternating', { distanceKm: 4, pace: { loSecPerKm: 265, hiSecPerKm: 305 } })]), club))
      .toBe('BZ 4 km: 1 km @4:25 / 1 km @5:05')
    expect(workoutLine(workout('easy', [seg('steady', { distanceKm: 6, pace: intervalPace })]), club)).toBe('BC2 6 km @4:32')
  })

  it('sprawdzian, start, rama i przerwa zostają jak w notacji neutralnej', () => {
    expect(workoutLine(workout('test', frame(seg('race', { distanceKm: 5 }))), club)).toBe('RG 3 km · 5 km na czas · SCH 1 km')
    expect(workoutLine(workout('race', [seg('race', { distanceKm: 21.0975 })], { distanceKm: 0, raceDistanceKm: 21.0975 }), club)).toBe('START 21,1 km')
  })

  it('siatka sezonu: kod przy części głównej', () => {
    expect(accentLine(workout('quality_intervals', frame(intervals(4, 1000))), club)).toBe('WT 4×1 km @4:32')
    expect(accentLine(workout('easy_hills', [seg('easy', { distanceKm: 5, pace: easyPace }), seg('hills', { reps: 6, repM: 150, distanceKm: 1.8 })]), club)).toBe('SB')
    expect(accentLine(workout('quality_continuous', [seg('alternating', { distanceKm: 4, pace: { loSecPerKm: 265, hiSecPerKm: 305 } })]), club)).toBe('BZ 4 km')
  })

  it('po angielsku `club` daje notację neutralną; ASCII zachowuje kody', () => {
    const w = workout('quality_intervals', frame(intervals(4, 1000)))
    expect(workoutLine(w, { locale: 'en', style: 'club' })).toBe(workoutLine(w, en))
    expect(workoutLine(w, { locale: 'pl', style: 'club', ascii: true })).toBe("RG 3 km | WT 4x1 km @4:32 p. 2' marsz | SCH 1 km")
  })

  it('zapis procesu (setNotation) działa bez opcji; neutralny bez zmian', () => {
    const w = workout('easy', [seg('easy', { distanceKm: 8, pace: easyPace })])
    expect(workoutLine(w, pl)).toBe('8 km @5:05–6:05')
    const previous = setNotation('club')
    try {
      expect(getNotation()).toBe('club')
      expect(workoutLine(w, pl)).toBe('OWB1 8 km @5:05–6:05')
      expect(workoutLine(w, { locale: 'pl', style: 'neutral' })).toBe('8 km @5:05–6:05')
    } finally {
      setNotation(previous)
    }
  })

  it('struktura dnia zostaje słowami; legenda objaśnia kody tylko po polsku', () => {
    const w = workout('quality_intervals', frame(intervals(4, 1000)))
    expect(workoutStructure(w, club)).toEqual(workoutStructure(w, pl))
    expect(notationLegend('km', { locale: 'pl', style: 'club' })).toMatch(/^OWB1 bieg spokojny · .*WT wytrzymałość tempowa · .*tempo w min\/km$/)
    expect(notationLegend('mi', { locale: 'en', style: 'club' })).toBe(notationLegend('mi', { locale: 'en', style: 'neutral' }))
    expect(notationLegend('km', { locale: 'pl', style: 'neutral' })).toBe('RG rozgrzewka · SCH schłodzenie · p. przerwa · tempo w min/km')
  })

  it('isNotationStyle przyjmuje tylko neutral i club', () => {
    expect(['neutral', 'club', 'klub', '', undefined, 1].map(isNotationStyle)).toEqual([true, true, false, false, false, false])
  })
})
