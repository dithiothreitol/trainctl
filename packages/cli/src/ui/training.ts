import { getLocale, sportMessages, targetText, type SessionStep, type TrainingSession } from 'trainctl-core'
import { b, rpeColor, type Block } from './blocks.ts'
import type { ColorName } from './theme.ts'

const text = (pl: string, en: string): string => getLocale() === 'pl' ? pl : en
const effort = (e: NonNullable<SessionStep['effort']>): string => 'RPE ' + e.min + '–' + e.max + '/10'
export function trainingDuration(seconds: number): string {
  const total = Math.round(seconds), minutes = Math.floor(total / 60), rest = total % 60
  return minutes ? minutes + ' min' + (rest ? ' ' + rest + ' s' : '') : rest + ' s'
}
function strokeName(stroke: NonNullable<SessionStep['stroke']>): string {
  return ({ freestyle: text('kraul', 'freestyle'), backstroke: text('grzbietowy', 'backstroke'), breaststroke: text('klasyczny', 'breaststroke'), butterfly: text('motylkowy', 'butterfly'), drill: text('ćwiczenie techniczne', 'drill') })[stroke]
}
function dose(step: SessionStep): string {
  return (step.repeat ? step.repeat + ' × ' : '') + (step.distanceM ? step.distanceM + ' m' : trainingDuration(step.durationSec))
}
function stepColor(step: SessionStep): ColorName {
  return step.effort ? rpeColor(step.effort.max) : step.role === 'work' ? 'accent' : 'brand'
}
function stepBlocks(step: SessionStep, index: number): Block[] {
  const t = sportMessages()
  const fields: [string, string][] = [[text('Cel etapu', 'Step target'), targetText(step.target)]]
  if (step.effort) fields.push(['RPE', step.effort.min + '–' + step.effort.max + '/10'])
  if (step.stroke) fields.push([text('Styl', 'Stroke'), strokeName(step.stroke)])
  if (step.sendoffSec) fields.push([text('Start co', 'Send-off every'), trainingDuration(step.sendoffSec)])
  const out = [b.section((index + 1) + '. ' + (step.name ?? t.role[step.role]) + ' · ' + dose(step), stepColor(step)), b.kv(fields)]
  if (step.effort) out.push(b.text(step.effort.cue, 'muted'))
  if (step.instruction) out.push(b.text(step.instruction))
  if (step.restSec) {
    const rest = step.recovery
    out.push(b.blank(), b.kv([[text('Przerwa po odcinku', 'Recovery after repeat'), trainingDuration(step.restSec) + (rest ? ' @ ' + targetText(rest.target) : '') + (rest?.effort ? ' · ' + effort(rest.effort) : '')]]))
    if (rest?.effort) out.push(b.text(rest.effort.cue, 'muted'))
    if (rest) out.push(b.text(rest.instruction))
  }
  return out
}
function compactSteps(s: TrainingSession): Block {
  const rows: string[][] = [], accents: ColorName[] = []
  s.steps.forEach((step, index) => {
    rows.push([(index + 1) + '. ' + (step.name ?? sportMessages().role[step.role]), dose(step), [targetText(step.target), step.effort ? effort(step.effort) : '', step.stroke ? strokeName(step.stroke) : '', step.sendoffSec ? text('Start co ', 'Send-off every ') + trainingDuration(step.sendoffSec) : ''].filter(Boolean).join(' · ')])
    accents.push(stepColor(step))
    if (step.restSec) {
      rows.push([text('Przerwa po ', 'Recovery after ') + (index + 1), trainingDuration(step.restSec), [step.recovery ? targetText(step.recovery.target) : '', step.recovery?.effort ? effort(step.recovery.effort) : ''].filter(Boolean).join(' · ')])
      accents.push('brand')
    }
  })
  return b.table([text('Etap', 'Step'), text('Dawka', 'Dose'), text('Cel / wysiłek', 'Target / effort')], rows, accents)
}

/** Objaśnienie skali RPE: w widoku z kartami drukowane raz, pod kartami (C2). */
export const rpeScaleLegend = (): string =>
  text('1–2 bardzo lekko · 3–4 lekko · 5–6 umiarkowanie · 7–8 mocno · 9–10 bardzo mocno. Nawiasy [ ] wskazują zaplanowany zakres.', '1–2 very easy · 3–4 easy · 5–6 moderate · 7–8 hard · 9–10 very hard. Brackets [ ] mark the planned range.')

/** Karta ma skalę RPE, gdy któryś krok ma zaplanowany wysiłek (bieg z migracji go nie ma). */
export const hasEffortScale = (s: TrainingSession): boolean => !s.legacyWorkout && s.steps.some(step => step.effort)

/**
 * Presentation only: never infer RPE from pace, watts or a legacy session's purpose.
 * `scale: false`: objaśnienie skali drukuje widok raz dla wszystkich kart.
 */
export function trainingCard(s: TrainingSession, detail = false, label?: string, scale = detail): Block {
  const t = sportMessages(), c = s.coaching
  const heading = (label ? label + ' · ' : '') + s.date + (s.start ? ' ' + s.start : '') + ' · ' + t.sport[s.sport]
  const body: Block[] = [b.text(t.purpose[s.purpose] + ' · ' + trainingDuration(s.durationSec) + (s.distanceM ? ' · ' + s.distanceM + ' m' : ''))]
  if (c) body.push(b.text(c.title), b.section(text('Cel', 'Objective'), 'brand'), b.text(c.objective))
  // Use the hardest prescribed step, not an average or a physiological zone.
  const efforts = s.legacyWorkout ? [] : s.steps.flatMap(step => step.effort ? [step.effort] : [])
  const highest = efforts.length ? Math.max(...efforts.map(e => e.max)) : undefined
  body.push(b.section(text('Intensywność', 'Intensity'), 'quality'))
  if (highest !== undefined) {
    const min = Math.min(...efforts.filter(e => e.max === highest).map(e => e.min))
    body.push(b.rpe(text('Najmocniejszy etap (plan)', 'Hardest step (planned)'), min, highest, scale ? rpeScaleLegend() : ''))
  } else body.push(b.text(text('Nie określono zakresu RPE. Korzystaj z celów podanych w etapach treningu.', 'No RPE range prescribed. Follow the targets in the workout steps.'), 'muted'))
  body.push(b.section(text('Przebieg treningu', 'Workout structure'), 'accent'))
  if (s.legacyWorkout) {
    s.legacyWorkout.segments.forEach((segment, index) => {
      if (detail) body.push(b.section(text('Etap ', 'Step ') + (index + 1), 'brand'))
      body.push(b.text(segment.description))
    })
  } else if (detail) s.steps.forEach((step, index) => body.push(...stepBlocks(step, index)))
  else body.push(compactSteps(s))
  if (detail && c) {
    body.push(b.section(text('Dlaczego ten trening', 'Why this workout'), 'brand'), b.text(c.rationale))
    if (c.successCriteria.length) body.push(b.section(text('Wskazówki wykonania', 'Execution guidance'), 'easy'), b.bullets(c.successCriteria))
    if (c.adjustments.length) body.push(b.section(text('Dostosowanie', 'Adjustments'), 'warn'), b.bullets(c.adjustments))
  }
  return b.card(heading, body, s.sport, [
    'ID: ' + s.id,
    ...(s.replacesSessionId ? [t.replaced + ': ' + s.replacesSessionId] : []),
    ...(s.groupId ? [t.group + ': ' + s.groupId] : []),
  ])
}
