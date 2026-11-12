import { sportMessages, targetText, type SessionStep, type TrainingSession } from 'trainctl-core'
import { ui } from '../i18n/index.ts'
import { b, rpeColor, type Block } from './blocks.ts'
import type { ColorName } from './theme.ts'

/** Teksty karty z katalogu CLI (C6): `ui().display.card`. */
const card = () => ui().display.card
const effort = (e: NonNullable<SessionStep['effort']>): string => 'RPE ' + e.min + '–' + e.max + '/10'
export function trainingDuration(seconds: number): string {
  const total = Math.round(seconds), minutes = Math.floor(total / 60), rest = total % 60
  return minutes ? minutes + ' min' + (rest ? ' ' + rest + ' s' : '') : rest + ' s'
}
function strokeName(stroke: NonNullable<SessionStep['stroke']>): string {
  return card().strokes[stroke]
}
function dose(step: SessionStep): string {
  return (step.repeat ? step.repeat + ' × ' : '') + (step.distanceM ? step.distanceM + ' m' : trainingDuration(step.durationSec))
}
function stepColor(step: SessionStep): ColorName {
  return step.effort ? rpeColor(step.effort.max) : step.role === 'work' ? 'accent' : 'brand'
}
function stepBlocks(step: SessionStep, index: number): Block[] {
  const t = sportMessages(), c = card()
  const fields: [string, string][] = [[c.stepTarget, targetText(step.target)]]
  if (step.effort) fields.push(['RPE', step.effort.min + '–' + step.effort.max + '/10'])
  if (step.stroke) fields.push([c.stroke, strokeName(step.stroke)])
  if (step.sendoffSec) fields.push([c.sendoff, trainingDuration(step.sendoffSec)])
  const out = [b.section((index + 1) + '. ' + (step.name ?? t.role[step.role]) + ' · ' + dose(step), stepColor(step)), b.kv(fields)]
  if (step.effort) out.push(b.text(step.effort.cue, 'muted'))
  if (step.instruction) out.push(b.text(step.instruction))
  if (step.restSec) {
    const rest = step.recovery
    out.push(b.blank(), b.kv([[c.recoveryAfter, trainingDuration(step.restSec) + (rest ? ' @ ' + targetText(rest.target) : '') + (rest?.effort ? ' · ' + effort(rest.effort) : '')]]))
    if (rest?.effort) out.push(b.text(rest.effort.cue, 'muted'))
    if (rest) out.push(b.text(rest.instruction))
  }
  return out
}
function compactSteps(s: TrainingSession): Block {
  const c = card()
  const rows: string[][] = [], accents: ColorName[] = []
  s.steps.forEach((step, index) => {
    rows.push([(index + 1) + '. ' + (step.name ?? sportMessages().role[step.role]), dose(step), [targetText(step.target), step.effort ? effort(step.effort) : '', step.stroke ? strokeName(step.stroke) : '', step.sendoffSec ? c.sendoff + ' ' + trainingDuration(step.sendoffSec) : ''].filter(Boolean).join(' · ')])
    accents.push(stepColor(step))
    if (step.restSec) {
      rows.push([c.recoveryAfterStep(index + 1), trainingDuration(step.restSec), [step.recovery ? targetText(step.recovery.target) : '', step.recovery?.effort ? effort(step.recovery.effort) : ''].filter(Boolean).join(' · ')])
      accents.push('brand')
    }
  })
  return b.table([c.columns.step, c.columns.dose, c.columns.target], rows, accents)
}

/** Objaśnienie skali RPE: w widoku z kartami drukowane raz, pod kartami (C2). */
export const rpeScaleLegend = (): string => card().rpeScale

/** Karta ma skalę RPE, gdy któryś krok ma zaplanowany wysiłek. */
export const hasEffortScale = (s: TrainingSession): boolean => s.steps.some(step => step.effort)

/**
 * Presentation only: RPE comes from the step stored in the plan (a running session
 * from the running plan carries the MS-6 hint by segment type, C5); the view never
 * infers it from pace, watts or the session's purpose.
 * `scale: false`: objaśnienie skali drukuje widok raz dla wszystkich kart.
 */
export function trainingCard(s: TrainingSession, detail = false, label?: string, scale = detail): Block {
  const t = sportMessages(), c = s.coaching, k = card()
  const heading = (label ? label + ' · ' : '') + s.date + (s.start ? ' ' + s.start : '') + ' · ' + t.sport[s.sport]
  const body: Block[] = [b.text(t.purpose[s.purpose] + ' · ' + trainingDuration(s.durationSec) + (s.distanceM ? ' · ' + s.distanceM + ' m' : ''))]
  if (c) body.push(b.text(c.title), b.section(k.objective, 'brand'), b.text(c.objective))
  // Use the hardest prescribed step, not an average or a physiological zone.
  const efforts = s.steps.flatMap(step => step.effort ? [step.effort] : [])
  const highest = efforts.length ? Math.max(...efforts.map(e => e.max)) : undefined
  body.push(b.section(k.intensity, 'quality'))
  if (highest !== undefined) {
    const min = Math.min(...efforts.filter(e => e.max === highest).map(e => e.min))
    body.push(b.rpe(k.hardest, min, highest, scale ? rpeScaleLegend() : ''))
  } else body.push(b.text(k.noRpe, 'muted'))
  body.push(b.section(k.structure, 'accent'))
  if (s.legacyWorkout) {
    s.legacyWorkout.segments.forEach((segment, index) => {
      if (detail) body.push(b.section(k.step(index + 1), 'brand'))
      body.push(b.text(segment.description))
    })
  } else if (detail) s.steps.forEach((step, index) => body.push(...stepBlocks(step, index)))
  else body.push(compactSteps(s))
  if (detail && c) {
    body.push(b.section(k.why, 'brand'), b.text(c.rationale))
    if (c.successCriteria.length) body.push(b.section(k.guidance, 'easy'), b.bullets(c.successCriteria))
    if (c.adjustments.length) body.push(b.section(k.adjustments, 'warn'), b.bullets(c.adjustments))
  }
  return b.card(heading, body, s.sport, [
    'ID: ' + s.id,
    ...(s.replacesSessionId ? [t.replaced + ': ' + s.replacesSessionId] : []),
    ...(s.groupId ? [t.group + ': ' + s.groupId] : []),
  ])
}
