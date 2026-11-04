import { beforeEach, describe, expect, it } from 'vitest'
import { buildSportSession, setLocale, type TrainingSession } from 'trainctl-core'
import { b, renderAnsi, renderPlain } from './blocks.ts'
import { Theme, stripAnsi, visibleLength } from './theme.ts'
import { trainingCard } from './training.ts'

beforeEach(() => setLocale('pl'))
function bike(): TrainingSession {
  return buildSportSession('bike', { weeklyMinutes: 240, sessionsPerWeek: 3, experience: 'trained', ftpWatts: 250, calibration: { date: '2026-11-01', source: 'test' } }, 68, 'bike-demo', '2026-11-17', 'intervals', '2026-11-02', { phase: 'build', weekIndex: 2, goal: { kind: 'race', name: '40 km', date: '2026-12-27', sport: 'bike', distanceM: 40000 } })
}
function normalize(text: string): string { return stripAnsi(text).replace(/[│╭╰─\s]/g, '') }

describe('structured training descriptions', () => {
  it.each([24, 40, 80, 112])('keeps full coaching and prescription in %i columns', width => {
    const s = bike(), card = trainingCard(s, true), original = structuredClone(s)
    const ansi = renderAnsi([card], new Theme({ color: true, unicode: true, width }))
    for (const line of ansi.split('\n')) expect(visibleLength(line), line).toBeLessThanOrEqual(width)
    const content = normalize(ansi)
    for (const value of [s.coaching!.objective, s.coaching!.rationale, ...s.coaching!.successCriteria, ...s.coaching!.adjustments, ...s.steps.flatMap(step => [step.instruction, step.effort?.cue, step.recovery?.instruction, step.recovery?.effort?.cue].filter((x): x is string => !!x)), '275 W (110% FTP)', '125 W (50% FTP)', '5 × 3 min', 'Przerwa po odcinku', '3 min', s.id]) expect(content).toContain(normalize(value))
    expect(s).toEqual(original)
    expect(ansi).toContain('\x1b[35m')
    expect(content).toContain(normalize('Najmocniejszy etap (plan): RPE 7–8/10'))
    expect(content).toContain('[7]'); expect(content).toContain('[8]'); expect(content).not.toContain('[9]')
  })
  it('separates sections and maintains labels and RPE selection without color', () => {
    const cards = [trainingCard(bike(), true)]
    const output = renderAnsi(cards, new Theme({color:false,unicode:false,width:80}))
    expect(output).not.toContain('\x1b')
    expect(output).not.toMatch(/[╭╰│─▁▂▃▄▅▆▇█]/)
    expect(output).toMatch(/\|\s*\n\| Cel\n\|\s*\n/)
    for (const heading of ['Cel', 'Intensywność', 'Przebieg treningu', 'Dlaczego ten trening', 'Wskazówki wykonania', 'Dostosowanie']) expect(output).toContain(heading)
    expect(output).toContain('[ 7] [ 8]')
    const plain = renderPlain(cards)
    expect(plain).not.toContain('\x1b')
    expect(plain).toContain('Cel:\n')
    expect(plain).toContain('Przerwa po odcinku: 3 min @ 125 W (50% FTP) · RPE 1–2/10')
    expect(plain).toContain('[ 7] [ 8]')
  })
  it('keeps swim stroke, drill, send-off and recovery separate', () => {
    const s = buildSportSession('swim', { weeklyMinutes: 180, sessionsPerWeek: 3, experience: 'trained', poolLengthM:25, cssSecPer100m:120, calibration:{date:'2026-11-01',source:'test'} },55,'swim-demo','2026-11-06','technique')
    s.steps[1]!.sendoffSec = 90
    const detail = renderPlain([trainingCard(s,true)]), compact=renderPlain([trainingCard(s,false)])
    expect(detail).toContain('Styl: ćwiczenie techniczne')
    expect(detail).toContain('Start co: 1 min 30 s')
    expect(detail).toContain('Przerwa po odcinku: 20 s')
    expect(detail).not.toContain('(freestyle)')
    for(const s of ['1 min 30 s','20 s','2:20/100 m','Przerwa po 2']) expect(compact).toContain(s)
  })
  it('does not manufacture RPE for sessions without prescribed effort or for legacy segments', () => {
    const s=bike();s.steps.forEach(step=>{delete step.effort})
    expect(renderPlain([trainingCard(s,true)])).toContain('Nie określono zakresu RPE')
    expect(renderPlain([trainingCard(s,true)])).not.toContain('Najmocniejszy etap')
    const legacy=bike(); legacy.legacyWorkout={kind:'easy',distanceKm:8,segments:[{type:'easy',distanceKm:8,description:'8 km @ 5:30–6:00/km'}]} as NonNullable<TrainingSession['legacyWorkout']>
    const output=renderPlain([trainingCard(legacy,true)])
    expect(output).toContain('8 km @ 5:30–6:00/km');expect(output).not.toContain('275 W');expect(output).not.toContain('Najmocniejszy etap')
  })
  it.each([1,2,3,4,20,40,80])('keeps every value of the RPE scale at width %i', width=>{
    const text=renderAnsi([b.rpe('RPE',9,10,'')],new Theme({color:true,unicode:true,width}))
    for(const line of text.split('\n'))expect(visibleLength(line)).toBeLessThanOrEqual(width)
    expect(normalize(text)).toContain('[10]')
  })
  it('localizes headings and does not confuse the hardest step with average intensity',()=>{
    setLocale('en')
    const output=renderPlain([trainingCard(bike(),true)])
    expect(output).toContain('Hardest step (planned): RPE 7–8/10')
    expect(output).toContain('Workout structure:');expect(output).toContain('Execution guidance:')
    expect(output).not.toContain('Najmocniejszy');expect(output).not.toContain('average')
  })
})
