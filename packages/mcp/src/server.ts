/**
 * Serwer MCP „trainctl" — te same use-case'y co CLI, jako narzędzia agenta.
 * Cienki adapter: handlery z trainctl są warstwą use-case'ów (ADR-008);
 * tu tylko schematy wejść i mapowanie CmdResult → wynik narzędzia MCP.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { packageVersion } from './version.ts'
import { ui } from 'trainctl'
import {
  cmdAdapt,
  cmdCheck,
  cmdDesk,
  cmdDiff,
  cmdExport,
  cmdInit,
  cmdInitFromIntervals,
  cmdLog,
  cmdPlan,
  cmdPull,
  cmdPush,
  cmdReschedule,
  cmdReview,
  cmdShift,
  cmdShorten,
  cmdToday,
  cmdWeek,
  cmdWhy,
  defaultProviderFactory,
  type CmdResult,
  type ProviderFactory,
} from 'trainctl'

const isoDate = () => z.string().regex(/^\d{4}-\d{2}-\d{2}$/, ui().mcp.isoDate)

const toolOutputSchema = { code: z.number(), output: z.string(), data: z.record(z.string(), z.unknown()) }

function toTool(r: CmdResult) {
  return {
    content: [{ type: 'text' as const, text: r.output }, { type: 'text' as const, text: JSON.stringify(r.data ?? {}) }],
    structuredContent: { code: r.code, output: r.output, data: r.data ?? {} },
    ...(r.code !== 0 ? { isError: true } : {}),
  }
}

export function createTrainctlServer(
  dir: string,
  factory: ProviderFactory = defaultProviderFactory,
): McpServer {
  const t = ui().mcp
  const server = new McpServer({ name: 'trainctl', version: packageVersion() })

  server.registerTool(
    'trainctl_init',
    {
      description: t.init,
      outputSchema: toolOutputSchema,
      annotations: { readOnlyHint: false, openWorldHint: true },
      inputSchema: {
        fromIntervals: z.boolean().optional().describe(t.initFromIntervals),
      },
    },
    async (args) =>
      toTool(args?.fromIntervals === true ? await cmdInitFromIntervals(dir, {}, factory) : cmdInit(dir)),
  )

  server.registerTool(
    'trainctl_plan',
    {
      description: t.plan,
      outputSchema: toolOutputSchema,
      annotations: { readOnlyHint: false, openWorldHint: false },
      inputSchema: { date: isoDate().optional().describe(t.planDate) },
    },
    async (args) => toTool(cmdPlan(dir, args)),
  )

  server.registerTool(
    'trainctl_today',
    {
      description: t.today,
      outputSchema: toolOutputSchema,
      annotations: { readOnlyHint: true, openWorldHint: false },
      inputSchema: { date: isoDate().optional() },
    },
    async (args) => toTool(cmdToday(dir, args)),
  )

  server.registerTool(
    'trainctl_week',
    {
      description: t.week,
      outputSchema: toolOutputSchema,
      annotations: { readOnlyHint: true, openWorldHint: false },
      inputSchema: { date: isoDate().optional().describe(t.weekDate) },
    },
    async (args) => toTool(cmdWeek(dir, args)),
  )

  server.registerTool(
    'trainctl_log',
    {
      description: t.log,
      outputSchema: toolOutputSchema,
      annotations: { readOnlyHint: false, openWorldHint: false },
      inputSchema: {
        date: isoDate().optional(),
        status: z.enum(['done', 'skipped', 'modified']).optional().describe(t.logStatus),
        km: z.string().optional().describe(t.logKm),
        time: z.string().optional().describe(t.logTime),
        testTime: z.string().optional().describe(ui().improve.testTime),
        rpe: z.string().optional().describe(t.logRpe),
        note: z.string().optional().describe(t.logNote),
      },
    },
    async (args) => toTool(cmdLog(dir, args)),
  )

  server.registerTool(
    'trainctl_shift',
    {
      description: t.shift,
      outputSchema: toolOutputSchema,
      annotations: { readOnlyHint: false, openWorldHint: false },
      inputSchema: {
        from: isoDate().describe(t.shiftFrom),
        to: isoDate().describe(t.shiftTo),
      },
    },
    async (args) => toTool(cmdShift(dir, args)),
  )

  server.registerTool(
    'trainctl_why',
    {
      description: t.why,
      outputSchema: toolOutputSchema,
      annotations: { readOnlyHint: true, openWorldHint: false },
      inputSchema: { date: isoDate().optional() },
    },
    async (args) => toTool(cmdWhy(dir, args)),
  )

  server.registerTool(
    'trainctl_adapt',
    {
      description: t.adapt,
      outputSchema: toolOutputSchema,
      annotations: { readOnlyHint: false, openWorldHint: false },
      inputSchema: {
        date: isoDate().optional().describe(t.adaptDate),
        prepare: z.boolean().optional().describe(ui().improve.prepare),
        apply: z.string().optional().describe(ui().improve.apply),
      },
    },
    async (args) => toTool(cmdAdapt(dir, args)),
  )

  server.registerTool(
    'trainctl_desk',
    {
      description: t.desk,
      outputSchema: toolOutputSchema,
      annotations: { readOnlyHint: true, openWorldHint: false },
      inputSchema: {
        date: isoDate().optional(),
        heavy: z.boolean().optional().describe(t.deskHeavy),
      },
    },
    async (args) => toTool(cmdDesk(dir, args)),
  )

  server.registerTool(
    'trainctl_shorten',
    {
      description: ui().coach.shortenMcp,
      outputSchema: toolOutputSchema,
      annotations: { readOnlyHint: false, openWorldHint: false },
      inputSchema: {
        date: isoDate().optional(),
        minutes: z.number().int().min(0).max(1440).optional().describe(ui().coach.minutes),
        apply: z.string().optional().describe(ui().improve.apply),
      },
    },
    async (args) => toTool(cmdShorten(dir, args)),
  )

  server.registerTool(
    'trainctl_export',
    {
      description: t.export,
      outputSchema: toolOutputSchema,
      annotations: { readOnlyHint: false, openWorldHint: false },
      inputSchema: {
        what: z.enum(['plan', 'workout', 'calendar', 'print', 'race', 'mobile']),
        date: isoDate().optional().describe(t.exportDate),
      },
    },
    async (args) => toTool(cmdExport(dir, args)),
  )

  server.registerTool(
    'trainctl_reschedule',
    {
      description: t.reschedule,
      outputSchema: toolOutputSchema,
      annotations: { readOnlyHint: false, openWorldHint: false },
      inputSchema: {
        block: z.array(isoDate()).optional().describe(t.rescheduleBlock),
        time: z.array(z.string()).optional().describe(ui().improve.time),
        pin: z.array(isoDate()).optional().describe(ui().improve.pin),
        preparation: z.string().optional().describe(ui().improve.preparation),
        strategy: z.enum(['long', 'quality']).optional().describe(ui().improve.strategy),
        date: isoDate().optional().describe(t.rescheduleDate),
        apply: z.boolean().optional().describe(t.rescheduleApply),
      },
    },
    async (args) => toTool(cmdReschedule(dir, args)),
  )

  server.registerTool(
    'trainctl_push',
    {
      description: t.push,
      outputSchema: toolOutputSchema,
      annotations: { readOnlyHint: false, openWorldHint: true },
      inputSchema: {
        from: isoDate().optional().describe(t.pushFrom),
        to: isoDate().optional().describe(t.pushTo),
        days: z.string().optional().describe(t.pushDays),
      },
    },
    async (args) => toTool(await cmdPush(dir, args, factory)),
  )

  server.registerTool(
    'trainctl_pull',
    {
      description: t.pull,
      outputSchema: toolOutputSchema,
      annotations: { readOnlyHint: false, openWorldHint: true },
      inputSchema: { days: z.string().optional().describe(t.pullDays), date: isoDate().optional() },
    },
    async (args) => toTool(await cmdPull(dir, args, factory)),
  )

  server.registerTool(
    'trainctl_review',
    {
      description: t.review,
      outputSchema: toolOutputSchema,
      annotations: { readOnlyHint: false, openWorldHint: true },
      inputSchema: {
        days: z.string().optional().describe(t.reviewDays),
        date: isoDate().optional().describe(t.reviewDate),
        prepare: z.boolean().optional().describe(ui().coach.reviewPrepare),
      },
    },
    async (args) => toTool(await cmdReview(dir, args, factory)),
  )

  server.registerTool(
    'trainctl_diff',
    {
      description: t.diff,
      outputSchema: toolOutputSchema,
      annotations: { readOnlyHint: true, openWorldHint: false },
      inputSchema: {
        plan: z.string().optional().describe(t.diffPlan),
      },
    },
    async (args) => toTool(cmdDiff(dir, args)),
  )

  server.registerTool(
    'trainctl_check',
    {
      description: t.check,
      outputSchema: toolOutputSchema,
      annotations: { readOnlyHint: true, openWorldHint: false },
      inputSchema: {
        strict: z.boolean().optional().describe(t.checkStrict),
      },
    },
    async (args) => toTool(cmdCheck(dir, args)),
  )

  return server
}
