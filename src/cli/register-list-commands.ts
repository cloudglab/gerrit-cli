import type { Command } from 'commander'
import { Effect } from 'effect'
import { GerritApiServiceLive } from '@/api/gerrit'
import { ConfigServiceLive } from '@/services/config'
import { listCommand } from './commands/list'
import { type ReportPeriod, reportCommand } from './commands/report'

const REPORT_PERIODS = ['daily', 'weekly', 'monthly', 'quarterly'] as const
const isReportPeriod = (v: string): v is ReportPeriod =>
  (REPORT_PERIODS as readonly string[]).includes(v)

function executeEffect<E>(
  effect: Effect.Effect<void, E, never>,
  options: { xml?: boolean; json?: boolean },
  resultTag: string,
): Promise<void> {
  if (options.xml && options.json) {
    console.error('✗ Error: --xml and --json are mutually exclusive')
    process.exit(1)
  }
  return Effect.runPromise(effect).catch((error: unknown) => {
    const msg = error instanceof Error ? error.message : String(error)
    if (options.json) {
      console.log(JSON.stringify({ status: 'error', error: msg }, null, 2))
    } else if (options.xml) {
      console.log(`<?xml version="1.0" encoding="UTF-8"?>`)
      console.log(`<${resultTag}>`)
      console.log(`  <status>error</status>`)
      console.log(`  <error><![CDATA[${msg}]]></error>`)
      console.log(`</${resultTag}>`)
    } else {
      console.error('✗ Error:', msg)
    }
    process.exit(1)
  })
}

export function registerListCommands(program: Command): void {
  // list command (primary)
  program
    .command('list')
    .description('List your changes or changes needing your review')
    .option('--status <status>', 'Filter by status: open, merged, abandoned (default: open)')
    .option('-n, --limit <number>', 'Maximum number of changes to show (default: 25)', parseInt)
    .option('--detailed', 'Show detailed information for each change')
    .option('--reviewer', 'Show changes where you are a reviewer')
    .option('--xml', 'XML output for LLM consumption')
    .option('--json', 'JSON output for programmatic consumption')
    .action(async (options) => {
      await executeEffect(
        listCommand(options).pipe(
          Effect.provide(GerritApiServiceLive),
          Effect.provide(ConfigServiceLive),
        ),
        options,
        'list_result',
      )
    })

  // mine command (alias for list)
  program
    .command('mine')
    .description('Show your open changes (alias for "gerrit-cli list")')
    .option('--xml', 'XML output for LLM consumption')
    .option('--json', 'JSON output for programmatic consumption')
    .action(async (options) => {
      await executeEffect(
        listCommand(options).pipe(
          Effect.provide(GerritApiServiceLive),
          Effect.provide(ConfigServiceLive),
        ),
        options,
        'list_result',
      )
    })

  const registerReviewerListCommand = (name: string, description: string): void => {
    program
      .command(name)
      .description(description)
      .option('--status <status>', 'Filter by status: open, merged, abandoned (default: open)')
      .option('-n, --limit <number>', 'Maximum number of changes to show (default: 25)', parseInt)
      .option('--detailed', 'Show detailed information for each change')
      .option('--all-verified', 'Include all verification states (default: open only)')
      .option('-f, --filter <query>', 'Append custom Gerrit query syntax')
      .option('--xml', 'XML output for LLM consumption')
      .option('--json', 'JSON output for programmatic consumption')
      .action(async (options) => {
        await executeEffect(
          listCommand({
            ...options,
            reviewer: true,
            allVerified: options.allVerified,
            filter: options.filter,
          }).pipe(Effect.provide(GerritApiServiceLive), Effect.provide(ConfigServiceLive)),
          options,
          'list_result',
        )
      })
  }

  registerReviewerListCommand(
    'incoming',
    'Show changes where you are a reviewer or CC\'d (alias for "gerrit-cli list --reviewer")',
  )
  registerReviewerListCommand(
    'team',
    'Show changes where you are a reviewer or CC\'d (alias for "gerrit-cli list --reviewer")',
  )

  // report command — daily / weekly / monthly / quarterly summaries
  const PERIOD_DESC: Record<ReportPeriod, string> = {
    daily: '日报（当天 00:00 ~ 现在）',
    weekly: '周报（本周一 00:00 ~ 现在）',
    monthly: '月报（本月 1 号 ~ 现在）',
    quarterly: '季报（当前季度 ~ 现在）',
  }

  const registerReportAlias = (name: string, period: ReportPeriod): void => {
    program
      .command(name)
      .description(`${PERIOD_DESC[period]}（等价于 "gerrit-cli report --period ${period}"）`)
      .option('--since <date>', '起点日期 (YYYY-MM-DD)，覆盖 period 默认起点')
      .option('--until <date>', '终点日期 (YYYY-MM-DD)，覆盖 period 默认终点')
      .option('--status <status>', '状态过滤：merged | open | abandoned | all（默认 all）')
      .option('--reviewer', '切到评审视角（默认 owner 视角）')
      .option('--user <username>', '查询指定用户（默认当前用户）')
      .option('-n, --limit <number>', '最大变更数（默认 500）', parseInt)
      .option('--md', 'Markdown 输出')
      .option('--xml', 'XML 输出（LLM 消费）')
      .option('--json', 'JSON 输出（脚本消费）')
      .action(async (options) => {
        await executeEffect(
          reportCommand({ ...options, period }).pipe(
            Effect.provide(GerritApiServiceLive),
            Effect.provide(ConfigServiceLive),
          ),
          options,
          'report_result',
        )
      })
  }

  program
    .command('report [period]')
    .description('生成周期报告（日报/周报/月报/季报）。可用 [period] 位置参数或 --period 选项。')
    .option('--period <period>', '周期：daily | weekly | monthly | quarterly（默认 weekly）')
    .option('--since <date>', '起点日期 (YYYY-MM-DD)，覆盖 period 默认起点')
    .option('--until <date>', '终点日期 (YYYY-MM-DD)，覆盖 period 默认终点')
    .option('--status <status>', '状态过滤：merged | open | abandoned | all（默认 all）')
    .option('--reviewer', '切到评审视角（默认 owner 视角）')
    .option('--user <username>', '查询指定用户（默认当前用户）')
    .option('-n, --limit <number>', '最大变更数（默认 500）', parseInt)
    .option('--md', 'Markdown 输出')
    .option('--xml', 'XML 输出（LLM 消费）')
    .option('--json', 'JSON 输出（脚本消费）')
    .addHelpText(
      'after',
      `
PERIODS
  daily      当天 00:00:00 ~ 当前时间
  weekly     本周一 00:00:00 ~ 当前时间
  monthly    当月 1 号 00:00:00 ~ 当前时间
  quarterly  季度初（1/4/7/10 月 1 号）00:00:00 ~ 当前时间

TIME FIELDS
  --status merged  → mergedafter / mergedbefore（按合入时间）
  其他             → after / before（按 updated 时间）

EXAMPLES
  gerrit-cli report weekly
  gerrit-cli report --period monthly --status merged
  gerrit-cli report --since 2026-06-01 --until 2026-06-30 --json
  gerrit-cli report daily --md > daily.md
  gerrit-cli report --period monthly --reviewer --user zhangsan
  gerrit-cli weekly                       # 等价于 "gerrit-cli report --period weekly"
`,
    )
    .action(async (periodArg, options) => {
      const period: ReportPeriod | undefined = options.period
        ? isReportPeriod(options.period)
          ? options.period
          : undefined
        : periodArg && isReportPeriod(periodArg)
          ? periodArg
          : undefined
      await executeEffect(
        reportCommand({ ...options, period }).pipe(
          Effect.provide(GerritApiServiceLive),
          Effect.provide(ConfigServiceLive),
        ),
        options,
        'report_result',
      )
    })

  registerReportAlias('daily', 'daily')
  registerReportAlias('weekly', 'weekly')
  registerReportAlias('monthly', 'monthly')
  registerReportAlias('quarterly', 'quarterly')
}
