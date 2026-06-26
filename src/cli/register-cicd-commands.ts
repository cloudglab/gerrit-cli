import type { Command } from 'commander'
import { Effect } from 'effect'
import { GerritApiServiceLive } from '@/api/gerrit'
import { CommitHookServiceLive } from '@/services/commit-hook'
import { ConfigServiceLive } from '@/services/config'
import { executeEffect } from './command-helpers'
import { BUILD_STATUS_HELP_TEXT, buildStatusCommand } from './commands/build-status'
import { extractUrlCommand } from './commands/extract-url'
import { installHookCommand } from './commands/install-hook'
import { RETRIGGER_HELP_TEXT, retriggerCommand } from './commands/retrigger'

export function registerCicdCommands(program: Command): void {
  program
    .command('retrigger [change-id]')
    .description(
      'Post the CI retrigger comment on a change (auto-detects from HEAD if no change-id given)',
    )
    .option('--confirm', 'Confirm and execute this write operation')
    .option('--xml', 'XML output for LLM consumption')
    .option('--json', 'JSON output for programmatic consumption')
    .addHelpText('after', RETRIGGER_HELP_TEXT)
    .action(async (changeId, options) => {
      await executeEffect(
        retriggerCommand(changeId as unknown as string | undefined, options).pipe(
          Effect.provide(GerritApiServiceLive),
          Effect.provide(ConfigServiceLive),
        ),
        options,
        'retrigger_result',
      )
    })

  program
    .command('build-status [change-id]')
    .description(
      'Check build status from Gerrit messages (auto-detects from HEAD commit if not specified)',
    )
    .option('--watch', 'Watch build status until completion (mimics gh run watch)')
    .option('-i, --interval <seconds>', 'Refresh interval in seconds (default: 10)', '10')
    .option('--timeout <seconds>', 'Maximum wait time in seconds (default: 1800 / 30min)', '1800')
    .option('--exit-status', 'Exit with non-zero status if build fails')
    .option('--xml', 'XML output for LLM consumption')
    .option('--json', 'JSON output for programmatic consumption')
    .addHelpText('after', BUILD_STATUS_HELP_TEXT)
    .action(async (changeId, cmdOptions) => {
      await executeEffect(
        buildStatusCommand(changeId as unknown as string | undefined, {
          watch: cmdOptions.watch,
          interval: Number.parseInt(cmdOptions.interval as string, 10),
          timeout: Number.parseInt(cmdOptions.timeout as string, 10),
          exitStatus: cmdOptions.exitStatus,
          xml: cmdOptions.xml,
          json: cmdOptions.json,
        }).pipe(Effect.provide(GerritApiServiceLive), Effect.provide(ConfigServiceLive)),
        cmdOptions,
        'build_status_result',
      )
    })

  program
    .command('extract-url <pattern> [change-id]')
    .description(
      'Extract URLs from change messages and comments (auto-detects from HEAD commit if not specified)',
    )
    .option('--xml', 'XML output for LLM consumption')
    .option('--json', 'JSON output for programmatic consumption')
    .action(async (pattern, changeId, options) => {
      await executeEffect(
        extractUrlCommand(
          pattern as unknown as string,
          changeId as unknown as string | undefined,
          options,
        ).pipe(Effect.provide(GerritApiServiceLive), Effect.provide(ConfigServiceLive)),
        options,
        'extract_url_result',
      )
    })

  program
    .command('install-hook')
    .description('Install the Gerrit commit-msg hook for automatic Change-Id generation')
    .option('--force', 'Overwrite existing hook')
    .option('--confirm', 'Confirm and execute this write operation')
    .option('--xml', 'XML output for LLM consumption')
    .option('--json', 'JSON output for programmatic consumption')
    .addHelpText(
      'after',
      `
Examples:
  # Install the commit-msg hook
  $ gerrit-cli install-hook --confirm

  # Force reinstall (overwrite existing)
  $ gerrit-cli install-hook --force --confirm

Note:
  - Downloads hook from your configured Gerrit server
  - Installs to .git/hooks/commit-msg
  - Makes hook executable (chmod +x)
  - Required for commits to have Change-Id footers`,
    )
    .action(async (options) => {
      await executeEffect(
        installHookCommand(
          options as unknown as {
            force?: boolean
            xml?: boolean
            json?: boolean
            confirm?: boolean
          },
        ).pipe(Effect.provide(CommitHookServiceLive), Effect.provide(ConfigServiceLive)),
        options,
        'install_hook_result',
      )
    })
}
