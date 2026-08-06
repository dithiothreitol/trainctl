/**
 * Serwer MCP „tren" — te same use-case'y co CLI, jako narzędzia agenta.
 * Cienki adapter: handlery z @tren/cli są warstwą use-case'ów (ADR-008);
 * tu tylko schematy wejść i mapowanie CmdResult → wynik narzędzia MCP.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { ui } from '@tren/cli'
import {
  cmdAdapt,
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
  cmdToday,
  cmdWeek,
  cmdWhy,
  defaultProviderFactory,
  type CmdResult,
  type ProviderFactory,
} from '@tren/cli'

const isoDate = () => z.string().regex(/^\d{4}-\d{2}-\d{2}$/, ui().mcp.isoDate)

function toTool(r: CmdResult) {
  return {
    content: [{ type: 'text' as const, text: r.output }],
    ...(r.code !== 0 ? { isError: true } : {}),
  }
}

export function createTrenServer(
  dir: string,
  factory: ProviderFactory = defaultProviderFactory,
): McpServer {
  const t = ui().mcp
  const server = new McpServer({ name: 'tren', version: '0.1.0' })

  server.registerTool(
    'tren_init',
    {
      description: t.init,
      inputSchema: {
        fromIntervals: z.boolean().optional().describe(t.initFromIntervals),
      },
    },
    async (args) =>
      toTool(args?.fromIntervals === true ? await cmdInitFromIntervals(dir, {}, factory) : cmdInit(dir)),
  )

  server.registerTool(
    'tren_plan',
    {
      description: t.plan,
      inputSchema: { date: isoDate().optional().describe(t.planDate) },
    },
    async (args) => toTool(cmdPlan(dir, args)),
  )

  server.registerTool(
    'tren_today',
    {
      description: t.today,
      inputSchema: { date: isoDate().optional() },
    },
    async (args) => toTool(cmdToday(dir, args)),
  )

  server.registerTool(
    'tren_week',
    {
      description: t.week,
      inputSchema: { date: isoDate().optional().describe(t.weekDate) },
    },
    async (args) => toTool(cmdWeek(dir, args)),
  )

  server.registerTool(
    'tren_log',
    {
      description: t.log,
      inputSchema: {
        date: isoDate().optional(),
        status: z.enum(['done', 'skipped', 'modified']).optional().describe(t.logStatus),
        km: z.string().optional().describe(t.logKm),
        time: z.string().optional().describe(t.logTime),
        note: z.string().optional().describe(t.logNote),
      },
    },
    async (args) => toTool(cmdLog(dir, args)),
  )

  server.registerTool(
    'tren_shift',
    {
      description: t.shift,
      inputSchema: {
        from: isoDate().describe(t.shiftFrom),
        to: isoDate().describe(t.shiftTo),
      },
    },
    async (args) => toTool(cmdShift(dir, args)),
  )

  server.registerTool(
    'tren_why',
    {
      description: t.why,
      inputSchema: { date: isoDate().optional() },
    },
    async (args) => toTool(cmdWhy(dir, args)),
  )

  server.registerTool(
    'tren_adapt',
    {
      description: t.adapt,
      inputSchema: { date: isoDate().optional().describe(t.adaptDate) },
    },
    async (args) => toTool(cmdAdapt(dir, args)),
  )

  server.registerTool(
    'tren_desk',
    {
      description: t.desk,
      inputSchema: {
        date: isoDate().optional(),
        heavy: z.boolean().optional().describe(t.deskHeavy),
      },
    },
    async (args) => toTool(cmdDesk(dir, args)),
  )

  server.registerTool(
    'tren_export',
    {
      description: t.export,
      inputSchema: {
        what: z.enum(['plan', 'workout', 'calendar', 'print', 'race']),
        date: isoDate().optional().describe(t.exportDate),
      },
    },
    async (args) => toTool(cmdExport(dir, args)),
  )

  server.registerTool(
    'tren_reschedule',
    {
      description: t.reschedule,
      inputSchema: {
        block: z.array(isoDate()).optional().describe(t.rescheduleBlock),
        date: isoDate().optional().describe(t.rescheduleDate),
        apply: z.boolean().optional().describe(t.rescheduleApply),
      },
    },
    async (args) => toTool(cmdReschedule(dir, args)),
  )

  server.registerTool(
    'tren_push',
    {
      description: t.push,
      inputSchema: {
        from: isoDate().optional().describe(t.pushFrom),
        to: isoDate().optional().describe(t.pushTo),
        days: z.string().optional().describe(t.pushDays),
      },
    },
    async (args) => toTool(await cmdPush(dir, args, factory)),
  )

  server.registerTool(
    'tren_pull',
    {
      description: t.pull,
      inputSchema: { days: z.string().optional().describe(t.pullDays) },
    },
    async (args) => toTool(await cmdPull(dir, args, factory)),
  )

  server.registerTool(
    'tren_review',
    {
      description: t.review,
      inputSchema: {
        days: z.string().optional().describe(t.reviewDays),
        date: isoDate().optional().describe(t.reviewDate),
      },
    },
    async (args) => toTool(await cmdReview(dir, args, factory)),
  )

  server.registerTool(
    'tren_diff',
    {
      description: t.diff,
      inputSchema: {},
    },
    async () => toTool(cmdDiff(dir)),
  )

  return server
}
