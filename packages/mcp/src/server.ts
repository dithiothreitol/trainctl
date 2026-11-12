/**
 * Serwer MCP „trainctl" — te same use-case'y co CLI, jako narzędzia agenta.
 * Cienki adapter: handlery z trainctl są warstwą use-case'ów (ADR-008);
 * tu tylko schematy wejść i mapowanie CmdResult → wynik narzędzia MCP.
 */
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { isAbsolute, join, relative, sep } from 'node:path'
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { packageVersion } from './version.ts'
import { ui } from 'trainctl'
import {
  BREAK_REASONS,
  cmdAdapt,
  cmdReplace,
  cmdMigrate,
  sportMessages,
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
  cmdRules,
  cmdSeason,
  cmdShift,
  cmdShorten,
  cmdStatus,
  cmdToday,
  cmdWeek,
  cmdWhy,
  AGENTS,
  defaultProviderFactory,
  simulationNotice,
  type CmdResult,
  type ProviderFactory,
} from 'trainctl'

const isoDate = () => z.string().regex(/^\d{4}-\d{2}-\d{2}$/, ui().mcp.isoDate)

const toolOutputSchema = { code: z.number(), output: z.string(), data: z.record(z.string(), z.unknown()) }
/** `commit` na narzędziach, które zapisują plan albo dziennik (ADR-040). */
const commitParam = () => z.boolean().optional().describe(ui().mcp.commit)

function toTool(r: CmdResult) {
  // Symulowana data (TRAINCTL_TODAY) nigdy nie jest cicha — także dla agenta (ADR-034).
  const notice = simulationNotice()
  const output = notice ? `${notice}\n\n${r.output}` : r.output
  return {
    content: [{ type: 'text' as const, text: output }, { type: 'text' as const, text: JSON.stringify(r.data ?? {}) }],
    structuredContent: { code: r.code, output, data: r.data ?? {} },
    ...(r.code !== 0 ? { isError: true } : {}),
  }
}

export function createTrainctlServer(
  dir: string,
  factory: ProviderFactory = defaultProviderFactory,
  options: { selectWorkspace?: boolean; requireWorkspaceSelection?: boolean; pluginRoot?: string; onWorkspaceSelected?: (directory: string) => void } = {},
): McpServer {
  const t = ui().mcp
  const server = new McpServer({ name: 'trainctl', version: packageVersion() })
  let selected = !options.requireWorkspaceSelection
  const trainingDir = () => {
    if (!selected) throw new Error(ui().mcp.workspaceRequired)
    return dir
  }
  if (options.selectWorkspace) server.registerTool('trainctl_workspace', {
    description: t.workspace,
    outputSchema: toolOutputSchema,
    annotations: {readOnlyHint:false,openWorldHint:false,destructiveHint:false,idempotentHint:true},
    inputSchema: {directory:z.string().optional().describe(t.workspaceDirectory)},
  }, async ({directory}) => {
    try {
      if (directory !== undefined) {
        if (!isAbsolute(directory) || !statSync(directory).isDirectory()) throw new Error(ui().mcp.workspaceInvalid)
        const target=realpathSync(directory)
        if (options.pluginRoot) {
          const inside=relative(realpathSync(options.pluginRoot),target)
          if (inside==='' || (inside!=='..' && !inside.startsWith('..'+sep) && !isAbsolute(inside))) throw new Error(ui().mcp.workspaceInvalid)
        }
        // Jedno powiązanie na proces zapobiega przeniesieniu klucza .env między kontami.
        if (selected && relative(realpathSync(dir),target)!=='') throw new Error(ui().mcp.workspaceLocked)
        if (!selected) { options.onWorkspaceSelected?.(target);dir=target;selected=true }
      }
      return toTool({code:0,output:selected?dir:ui().mcp.workspaceRequired,data:{directory:selected?dir:null,selected,initialized:selected&&existsSync(join(dir,'trainctl.yaml'))}})
    } catch (error) {
      return toTool({code:1,output:error instanceof Error?error.message:String(error)})
    }
  })

  server.registerTool(
    'trainctl_init',
    {
      description: t.init,
      outputSchema: toolOutputSchema,
      annotations: { readOnlyHint: false, openWorldHint: true },
      inputSchema: {
        sports: z.string().optional().describe(sportMessages().sports),
        fromIntervals: z.boolean().optional().describe(t.initFromIntervals),
        agent: z.enum(AGENTS).optional().describe(t.initAgent),
        commit: commitParam(),
      },
    },
    async (args) =>
      toTool(args?.fromIntervals === true ? await cmdInitFromIntervals(trainingDir(), { sports: args.sports, agent: args.agent, commit: args.commit }, factory) : cmdInit(trainingDir(), undefined, { commit: args?.commit, agent: args?.agent, sports: args?.sports })),
  )

  server.registerTool(
    'trainctl_plan',
    {
      description: t.plan,
      outputSchema: toolOutputSchema,
      annotations: { readOnlyHint: false, openWorldHint: false },
      inputSchema: { date: isoDate().optional().describe(t.planDate), fresh: z.boolean().optional().describe(t.planFresh), commit: commitParam() },
    },
    async (args) => toTool(cmdPlan(trainingDir(), args)),
  )

  server.registerTool(
    'trainctl_today',
    {
      description: t.today,
      outputSchema: toolOutputSchema,
      annotations: { readOnlyHint: true, openWorldHint: false },
      inputSchema: { session: z.string().optional().describe(sportMessages().session), sport: z.enum(['run','bike','swim','strength']).optional(), date: isoDate().optional(), full: z.boolean().optional().describe(t.full) },
    },
    async (args) => toTool(cmdToday(trainingDir(), args)),
  )

  server.registerTool(
    'trainctl_week',
    {
      description: t.week,
      outputSchema: toolOutputSchema,
      annotations: { readOnlyHint: true, openWorldHint: false },
      inputSchema: { session: z.string().optional().describe(sportMessages().session), sport: z.enum(['run','bike','swim','strength']).optional(), date: isoDate().optional().describe(t.weekDate), full: z.boolean().optional().describe(t.full) },
    },
    async (args) => toTool(cmdWeek(trainingDir(), args)),
  )

  server.registerTool(
    'trainctl_season',
    {
      description: t.season,
      outputSchema: toolOutputSchema,
      annotations: { readOnlyHint: true, openWorldHint: false },
      inputSchema: { date: isoDate().optional().describe(t.weekDate) },
    },
    async (args) => toTool(cmdSeason(trainingDir(), args)),
  )

  server.registerTool(
    'trainctl_log',
    {
      description: t.log,
      outputSchema: toolOutputSchema,
      annotations: { readOnlyHint: false, openWorldHint: false },
      inputSchema: { session: z.string().optional().describe(sportMessages().session), sport: z.enum(['run','bike','swim','strength']).optional(),
        date: isoDate().optional(),
        status: z.enum(['done', 'skipped', 'modified']).optional().describe(t.logStatus),
        to: isoDate().optional().describe(t.logTo),
        reason: z.enum(BREAK_REASONS).optional().describe(t.logReason),
        meters: z.string().optional().describe(sportMessages().meters),
        actualSport: z.enum(['run','bike','swim']).optional().describe(sportMessages().actualSport),
        sets: z.string().optional().describe(sportMessages().sets),
        activity: z.string().optional().describe(sportMessages().source),
        km: z.string().optional().describe(t.logKm),
        time: z.string().optional().describe(t.logTime),
        testTime: z.string().optional().describe(ui().improve.testTime),
        rpe: z.string().optional().describe(t.logRpe),
        note: z.string().optional().describe(t.logNote),
        strength: z.enum(['done', 'skipped']).optional().describe(t.logStrength),
        minutes: z.number().min(0).max(3000).optional().describe(t.logMinutes),
        commit: commitParam(),
      },
    },
    // C9: dystans w km, jak dane w structuredContent — bez przeliczania z jednostki profilu
    async (args) => toTool(cmdLog(trainingDir(), { ...args, metricKm: true })),
  )

  server.registerTool(
    'trainctl_shift',
    {
      description: t.shift,
      outputSchema: toolOutputSchema,
      annotations: { readOnlyHint: false, openWorldHint: false },
      inputSchema: { session: z.string().optional().describe(sportMessages().session), sport: z.enum(['run','bike','swim','strength']).optional(),
        from: isoDate().optional().describe(t.shiftFrom),
        to: isoDate().describe(t.shiftTo),
        commit: commitParam(),
      },
    },
    async (args) => toTool(cmdShift(trainingDir(), { ...args, from: args.from ?? '' })),
  )

  server.registerTool(
    'trainctl_why',
    {
      description: t.why,
      outputSchema: toolOutputSchema,
      annotations: { readOnlyHint: true, openWorldHint: false },
      inputSchema: { session: z.string().optional().describe(sportMessages().session), sport: z.enum(['run','bike','swim','strength']).optional(), date: isoDate().optional() },
    },
    async (args) => toTool(cmdWhy(trainingDir(), args)),
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
        commit: commitParam(),
      },
    },
    async (args) => toTool(cmdAdapt(trainingDir(), args)),
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
    async (args) => toTool(cmdDesk(trainingDir(), args)),
  )

  server.registerTool(
    'trainctl_shorten',
    {
      description: ui().coach.shortenMcp,
      outputSchema: toolOutputSchema,
      annotations: { readOnlyHint: false, openWorldHint: false },
      inputSchema: { session: z.string().optional().describe(sportMessages().session), sport: z.enum(['run','bike','swim','strength']).optional(),
        date: isoDate().optional(),
        minutes: z.number().int().min(0).max(1440).optional().describe(ui().coach.minutes),
        apply: z.string().optional().describe(ui().improve.apply),
        commit: commitParam(),
      },
    },
    async (args) => toTool(cmdShorten(trainingDir(), args)),
  )

  server.registerTool(
    'trainctl_export',
    {
      description: t.export,
      outputSchema: toolOutputSchema,
      annotations: { readOnlyHint: false, openWorldHint: false },
      inputSchema: { session: z.string().optional().describe(sportMessages().session), sport: z.enum(['run','bike','swim','strength']).optional(),
        what: z.enum(['plan', 'workout', 'calendar', 'print', 'race', 'mobile', 'all', 'fit', 'ics', 'html', 'racepack']),
        date: isoDate().optional().describe(t.exportDate),
      },
    },
    async (args) => toTool(cmdExport(trainingDir(), args)),
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
        pin: z.array(z.string()).optional().describe(ui().improve.pin),
        preparation: z.string().optional().describe(ui().improve.preparation),
        sport: z.enum(['run','bike','swim']).optional(),
        strategy: z.enum(['long', 'quality']).optional().describe(ui().improve.strategy),
        date: isoDate().optional().describe(t.rescheduleDate),
        apply: z.union([z.boolean(),z.string()]).optional().describe(t.rescheduleApply),
        commit: commitParam(),
      },
    },
    async (args) => toTool(cmdReschedule(trainingDir(), args)),
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
    async (args) => toTool(await cmdPush(trainingDir(), args, factory)),
  )

  server.registerTool(
    'trainctl_pull',
    {
      description: t.pull,
      outputSchema: toolOutputSchema,
      annotations: { readOnlyHint: false, openWorldHint: true },
      inputSchema: { days: z.string().optional().describe(t.pullDays), date: isoDate().optional(), from: z.string().optional().describe(t.pullFrom) },
    },
    async (args) => toTool(await cmdPull(trainingDir(), args, factory)),
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
    async (args) => toTool(await cmdReview(trainingDir(), args, factory)),
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
    async (args) => toTool(cmdDiff(trainingDir(), args)),
  )

  server.registerTool(
    'trainctl_rule',
    {
      description: t.rule,
      outputSchema: toolOutputSchema,
      annotations: { readOnlyHint: true, openWorldHint: false },
      inputSchema: { id: z.string().optional().describe(t.ruleId) },
    },
    async (args) => toTool(cmdRules({ id: args?.id })),
  )

  // --- zasoby: pliki katalogu treningowego do czytania bez wywoływania narzędzia
  const fileResource = (name: string, file: string, description: string, mimeType: string) =>
    server.registerResource(name, `trainctl://${name}`, { title: file, description, mimeType }, async (uri) => {
      const path = join(trainingDir(), file)
      if (!existsSync(path)) throw new Error(t.resourceMissing(file))
      return { contents: [{ uri: uri.href, mimeType, text: readFileSync(path, 'utf-8') }] }
    })
  fileResource('plan', 'plan/PLAN.md', t.resourcePlan, 'text/markdown')
  fileResource('config', 'trainctl.yaml', t.resourceConfig, 'application/yaml')
  fileResource('agents', 'AGENTS.md', t.resourceAgents, 'text/markdown')
  server.registerResource(
    'rule',
    new ResourceTemplate('trainctl://rules/{id}', {
      list: async () => ({
        resources: ((cmdRules().data?.['rules'] as { id: string }[] | undefined) ?? [])
          .map((r) => ({ uri: `trainctl://rules/${r.id}`, name: r.id })),
      }),
    }),
    { description: t.resourceRule, mimeType: 'text/plain' },
    async (uri, variables) => {
      const r = cmdRules({ id: String(variables['id'] ?? '') })
      if (r.code !== 0) throw new Error(r.output)
      return { contents: [{ uri: uri.href, mimeType: 'text/plain', text: r.output }] }
    },
  )

  // --- prompty: rytuały trenera jako gotowe polecenia dla klienta
  server.registerPrompt(
    'weekly-review',
    { title: 'trainctl · weekly review', description: t.promptReview, argsSchema: { date: z.string().optional().describe(t.promptDate) } },
    (args) => ({ messages: [{ role: 'user' as const, content: { type: 'text' as const, text: t.promptReviewText(args.date ?? '') } }] }),
  )
  server.registerPrompt(
    'debrief',
    { title: 'trainctl · debrief', description: t.promptDebrief, argsSchema: { date: z.string().optional().describe(t.promptDate) } },
    (args) => ({ messages: [{ role: 'user' as const, content: { type: 'text' as const, text: t.promptDebriefText(args.date ?? '') } }] }),
  )

  server.registerTool(
    'trainctl_status',
    {
      description: t.status,
      outputSchema: toolOutputSchema,
      annotations: { readOnlyHint: true, openWorldHint: false },
      inputSchema: {},
    },
    async () => toTool(cmdStatus(trainingDir())),
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
    async (args) => toTool(cmdCheck(trainingDir(), args)),
  )


  server.registerTool('trainctl_replace', { description: sportMessages().replace, outputSchema: toolOutputSchema,
    annotations: {readOnlyHint:false, openWorldHint:false}, inputSchema: {
      session:z.string().optional(),date:isoDate().optional(),sport:z.enum(['run','bike','swim']).optional(),
      restore:z.boolean().optional().describe(sportMessages().restore),
      variant:z.enum(['endurance','quality']).optional(),toSport:z.enum(['run','bike','swim']).optional(),minutes:z.number().min(5).max(1440).optional(),
      reason:z.string().optional(),prepare:z.boolean().optional(),apply:z.string().optional(),commit:commitParam()
    }}, async args => toTool(cmdReplace(trainingDir(),args)))
  server.registerTool('trainctl_migrate', { description:sportMessages().migration,outputSchema:toolOutputSchema,
    annotations:{readOnlyHint:false,openWorldHint:false},inputSchema:{recover:z.enum(['resume','rollback']).optional(),prepare:z.boolean().optional(),apply:z.string().optional(),commit:commitParam()}
  },async args => toTool(cmdMigrate(trainingDir(),args)))

  return server
}
