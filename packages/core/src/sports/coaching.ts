import { getLocale } from '../i18n/index.ts'
import { sportMessages } from './messages.ts'
import type { EffortGuide, SessionContext, Sport, StepTarget, TrainingSession } from './types.ts'

export const coachText = (pl: string, en: string): string => getLocale() === 'pl' ? pl : en
export function effortGuide(min: number, max: number, swim = false): EffortGuide {
  const cue = max <= 3 ? coachText('Bardzo lekko; spokojny, swobodny oddech.', 'Very easy; relaxed, unhurried breathing.')
    : max <= 4 ? coachText(swim ? 'Swobodny wydech do wody; technika bez napięcia.' : 'Swobodna rozmowa pełnymi zdaniami.', swim ? 'Relaxed exhalation into the water; unforced technique.' : 'Comfortable conversation in full sentences.')
    : max <= 6 ? coachText(swim ? 'Równy rytm; bez pogarszania chwytu wody.' : 'Wyraźny wysiłek; możliwe krótkie zdania.', swim ? 'Steady rhythm; maintain the catch.' : 'Purposeful effort; short sentences possible.')
    : coachText(swim ? 'Mocno, ale z kontrolą ruchu i oddechu; bez wstrzymywania oddechu.' : 'Mocno, ale bez sprintu; pozostaw zapas na ostatni odcinek.', swim ? 'Hard but controlled stroke and breathing; no breath holding.' : 'Hard, not a sprint; keep enough in reserve for the last repetition.')
  return { min, max, cue }
}
export function targetText(target: StepTarget): string {
  if (target.kind === 'power') return `${target.watts} W${target.ftpPercent !== undefined ? ` (${target.ftpPercent}% FTP)` : ''}`
  if (target.kind === 'pace') {
    const seconds=Math.round(target.seconds)
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}/${target.perM === 1000 ? 'km' : '100 m'}`
  }
  return coachText('według odczucia', 'by feel')
}
export const effortText = (e: EffortGuide): string => `RPE ${e.min}–${e.max}/10 · ${e.cue}`
export function sessionStepLines(s: TrainingSession, detail = true): string[] {
  if (s.legacyWorkout) return s.legacyWorkout.segments.map(x => x.description)
  const t = sportMessages()
  return s.steps.map((x, i) => {
    const dose = x.distanceM ? `${x.distanceM} m` : `${Number((x.durationSec / 60).toFixed(2))} min`
    const recovery = x.restSec ? `; ${t.role.rest} ${x.restSec}s${x.recovery ? ` @ ${targetText(x.recovery.target)}${detail && x.recovery.effort ? ` · ${effortText(x.recovery.effort)}` : ''}${detail ? ` · ${x.recovery.instruction}` : ''}` : ''}` : ''
    return `${i + 1}. ${x.name ?? t.role[x.role]}: ${x.repeat ? `${x.repeat} × ` : ''}${dose} @ ${targetText(x.target)}${x.effort ? ` · ${detail ? effortText(x.effort) : `RPE ${x.effort.min}–${x.effort.max}/10`}` : ''}${recovery}${x.sendoffSec ? ` / ${x.sendoffSec}s` : ''}${x.stroke ? ` (${x.stroke})` : ''}${detail && x.instruction ? ` — ${x.instruction}` : ''}`
  })
}
export function coachingLines(s: TrainingSession, detail = true): string[] {
  if (!s.coaching) return []
  const c = s.coaching
  return [`${coachText('Cel', 'Objective')}: ${c.objective}`, ...(detail ? [
    `${coachText('Dlaczego', 'Why')}: ${c.rationale}`,
    ...c.successCriteria.map(x => `${coachText('Wykonanie', 'Success')}: ${x}`),
    ...c.adjustments.map(x => `${coachText('Dostosowanie', 'Adjustment')}: ${x}`),
  ] : [])]
}
export function contextRationale(context: SessionContext, sport: Sport): string {
  const phase = context.phase ?? 'base', t = sportMessages()
  const goal = context.goal
  const distance = goal?.sport === sport ? goal.distanceM : goal?.legs?.filter(x => x.sport === sport).reduce((n,x) => n + x.distanceM,0)
  return [
    context.phase ? `${coachText('Faza', 'Phase')}: ${t.phases[phase]}.` : coachText('Jednostka samodzielna, bez wskazanej fazy planu.', 'Standalone session without a specified plan phase.'),
    context.weekIndex !== undefined ? `${coachText('Tydzień cyklu', 'Cycle week')}: ${context.weekIndex + 1}.` : '',
    goal ? `${coachText('Cel planu', 'Plan goal')}: ${goal.name}${distance ? ` (${distance} m)` : ''}.` : '',
    phase === 'deload' || phase === 'recovery' ? coachText('Zmniejszona dawka pozwala odpocząć między blokami obciążenia.', 'Reduced work allows recovery between loading blocks.')
      : phase === 'taper' ? coachText('Krótki bodziec podtrzymuje rytm przy mniejszej objętości przed startem.', 'A short stimulus maintains rhythm with less volume before the event.')
      : coachText('Dawkę ograniczają poziom doświadczenia i dostępny czas; progresja nie wymaga zwiększania intensywności.', 'Experience and available time limit the dose; progression does not require increasing intensity.'),
    context.brick ? coachText('Zakładka: ćwicz spokojne przejście z roweru do biegu i kontrolę tempa po zmianie dyscypliny.', 'Brick: practise a calm bike-to-run transition and controlled pacing after the change of sport.') : '',
  ].filter(Boolean).join(' ')
}
export function attachRunningCoaching(s: TrainingSession, context: SessionContext = {}): TrainingSession {
  if (!s.legacyWorkout) return s
  const kind = s.legacyWorkout.kind
  const objective = kind === 'test' ? coachText('Zmierz aktualną dyspozycję biegową, zachowując protokół sprawdzianu.', 'Measure current running fitness while preserving the test protocol.')
    : s.purpose === 'race' ? coachText('Zrealizuj cel startowy i kontroluj początkowe tempo.', 'Execute the race goal with a controlled opening pace.')
    : s.purpose === 'long' ? coachText('Rozwijaj wytrzymałość długotrwałą i utrzymanie techniki przy narastającym zmęczeniu.', 'Develop durability and maintain form as fatigue builds.')
    : s.legacyWorkout.segments.some(x => x.type === 'hills') ? coachText('Ćwicz rytm i siłę biegową na podbiegu, kontrolując technikę.', 'Practise uphill rhythm and running strength with controlled form.')
    : s.legacyWorkout.segments.some(x=>x.type==='progression') ? coachText('Rozwijaj kontrolę tempa narastającego bez gwałtownego przyspieszania.', 'Develop control of progressive pacing without sudden acceleration.')
    : s.purpose === 'intervals' ? coachText('Rozwijaj zdolność utrzymania tempa wskazanego w odcinkach; zachowaj zaplanowane przerwy.', 'Develop the ability to sustain the prescribed segment pace; keep the planned recoveries.')
    : coachText('Buduj wytrzymałość tlenową przy swobodnym oddechu.', 'Build aerobic endurance with comfortable breathing.')
  return { ...s, ...(context.phase?{phase:context.phase}:{}), coaching: { version:1, recipeId:`run-legacy-${kind}`, title:sportMessages().purpose[s.purpose], objective,
    rationale: contextRationale(context, 'run'), successCriteria:[coachText('Utrzymaj zakresy tempa i równą technikę do końca; zapisz czas oraz RPE po treningu.', 'Keep the prescribed pace ranges and consistent form through the finish; log duration and RPE afterwards.')],
    adjustments:[coachText('Przy utracie techniki zwolnij; skracaj jednostkę narzędziem planu, zachowując rozgrzewkę i schłodzenie.', 'Slow down if form deteriorates; use the plan tool to shorten the session while preserving warm-up and cool-down.')] } }
}
