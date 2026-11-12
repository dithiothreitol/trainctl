/**
 * Podsumowanie planu biegowego pod nagłówkiem `plan`: szczyt objętości, VDOT i predykcja
 * wyniku z porównaniem z celem. Jedna funkcja dla planu biegowego i dla planu v2
 * z silnikiem biegowym (PLAN-v0.7 E2: predykcja w parytecie obu schematów).
 */
import { formatNumber, getLocale } from 'trainctl-core'
import { perWeekLabel } from './format.ts'
import { ui } from './i18n/index.ts'
import { fmtTime, type StoredPlan } from './planfile.ts'
import { b, type Block } from './ui/blocks.ts'

export function runningPlanSummary(plan: StoredPlan): Block[] {
  const blocks: Block[] = [
    b.kv([
      [ui().plan.volumePeak, perWeekLabel(plan.peakKmPlanned)],
      ...(plan.peakKmRecommended > 0 ? ([[ui().plan.recommendedForDistance, perWeekLabel(plan.peakKmRecommended)]] as [string, string][]) : []),
      [
        ui().plan.vdot,
        `${formatNumber(getLocale(), plan.vdot)} (${plan.vdotSource === 'result' ? ui().plan.vdotFromResult : ui().plan.vdotFromGoal})`,
      ],
    ]),
  ]
  if (!plan.prediction) return blocks
  const range = `${fmtTime(plan.prediction.loSec)} – ${fmtTime(plan.prediction.hiSec)}`
  blocks.push(
    b.blank(),
    b.panel(
      ui().plan.prediction,
      [
        `${range}   ${ui().plan.predictionMethod(plan.prediction.method)}`,
        ui().plan.predictionAlwaysRange,
      ],
      'brand',
    ),
  )
  const target = plan.goal.targetTimeSec
  if (target) {
    if (target < plan.prediction.loSec) blocks.push(b.warn(ui().plan.goalAmbitious(fmtTime(target))))
    else if (target > plan.prediction.hiSec) blocks.push(b.info(ui().plan.goalConservative(fmtTime(target))))
    else blocks.push(b.success(ui().plan.goalInRange(fmtTime(target))))
  }
  return blocks
}
