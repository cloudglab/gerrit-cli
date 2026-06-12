import type { Command } from 'commander'
import { Effect } from 'effect'
import { GerritApiServiceLive } from '@/api/gerrit'
import { CommitHookServiceLive } from '@/services/commit-hook'
import { ConfigServiceLive } from '@/services/config'
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
    .option('--xml', 'XML output for LLM consumption')
    .option('--json', 'JSON output for programmatic consumption')
    .addHelpText('after', RETRIGGER_HELP_TEXT)
    .action(async (changeId, options) => {
      try {
        const effect = retriggerCommand(changeId as unknown as string | undefined, options).pipe(
          Effect.provide(GerritApiServiceLive),
          Effect.provide(ConfigServiceLive),
        )
        await Effect.runPromise(effect)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        if (options.json) {
          console.log(JSON.stringify({ status: 'error', error: errorMessage }, null, 2))
        } else if (options.xml) {
          console.log(`<?xml version="1.0" encoding="UTF-8"?>`)
          console.log(`<retrigger_result>`)
          console.log(`  <status>error</status>`)
          console.log(`  <error><![CDATA[${errorMessage}]]></error>`)
          console.log(`</retrigger_result>`)
        } else {
          console.error('✗ Error:', errorMessage)
        }
        process.exit(1)
      }
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
      try {
        const effect = buildStatusCommand(changeId as unknown as string | undefined, {
          watch: cmdOptions.watch,
          interval: Number.parseInt(cmdOptions.interval as string, 10),
          timeout: Number.parseInt(cmdOptions.timeout as string, 10),
          exitStatus: cmdOptions.exitStatus,
          xml: cmdOptions.xml,
          json: cmdOptions.json,
        }).pipe(Effect.provide(GerritApiServiceLive), Effect.provide(ConfigServiceLive))
        await Effect.runPromise(effect)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        if (cmdOptions.json) {
          console.log(JSON.stringify({ status: 'error', error: errorMessage }, null, 2))
        } else {
          console.error(`Error: ${errorMessage}`)
        }
        process.exit(1)
      }
    })

  program
    .command('extract-url <pattern> [change-id]')
    .description(
      'Extract URLs from change messages and comments (auto-detects from HEAD commit if not specified)',
    )
    .option('--xml', 'XML output for LLM consumption')
    .option('--json', 'JSON output for programmatic consumption')
    .action(async (pattern, changeId, options) => {
      try {
        const effect = extractUrlCommand(
          pattern as unknown as string,
          changeId as unknown as string | undefined,
          options,
        ).pipe(Effect.provide(GerritApiServiceLive), Effect.provide(ConfigServiceLive))
        await Effect.runPromise(effect)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        if (options.json) {
          console.log(JSON.stringify({ status: 'error', error: errorMessage }, null, 2))
        } else if (options.xml) {
          console.log(`<?xml version="1.0" encoding="UTF-8"?>`)
          console.log(`<extract_url_result>`)
          console.log(`  <status>error</status>`)
          console.log(`  <error><![CDATA[${errorMessage}]]></error>`)
          console.log(`</extract_url_result>`)
        } else {
          console.error('✗ Error:', errorMessage)
        }
        process.exit(1)
      }
    })

  program
    .command('install-hook')
    .description('Install the Gerrit commit-msg hook for automatic Change-Id generation')
    .option('--force', 'Overwrite existing hook')
    .option('--xml', 'XML output for LLM consumption')
    .option('--json', 'JSON output for programmatic consumption')
    .addHelpText(
      'after',
      `
Examples:
  # Install the commit-msg hook
  $ gerrit-cli install-hook

  # Force reinstall (overwrite existing)
  $ gerrit-cli install-hook --force

Note:
  - Downloads hook from your configured Gerrit server
  - Installs to .git/hooks/commit-msg
  - Makes hook executable (chmod +x)
  - Required for commits to have Change-Id footers`,
    )
    .action(async (options) => {
      try {
        const effect = installHookCommand(
          options as unknown as { force?: boolean; xml?: boolean; json?: boolean },
        ).pipe(Effect.provide(CommitHookServiceLive), Effect.provide(ConfigServiceLive))
        await Effect.runPromise(effect)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        if (options.json) {
          console.log(JSON.stringify({ status: 'error', error: errorMessage }, null, 2))
        } else if (options.xml) {
          console.log(`<?xml version="1.0" encoding="UTF-8"?>`)
          console.log(`<install_hook_result>`)
          console.log(`  <status>error</status>`)
          console.log(`  <error><![CDATA[${errorMessage}]]></error>`)
          console.log(`</install_hook_result>`)
        } else {
          console.error('✗ Error:', errorMessage)
        }
        process.exit(1)
      }
    })
}
