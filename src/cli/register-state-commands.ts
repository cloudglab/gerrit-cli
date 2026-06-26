import type { Command } from 'commander'
import { Effect } from 'effect'
import { GerritApiServiceLive } from '@/api/gerrit'
import { ConfigServiceLive } from '@/services/config'
import { executeEffect } from './command-helpers'
import { abandonCommand } from './commands/abandon'
import { restoreCommand } from './commands/restore'
import { setReadyCommand } from './commands/set-ready'
import { setWipCommand } from './commands/set-wip'

export function registerStateCommands(program: Command): void {
  program
    .command('abandon [change-id]')
    .description(
      'Abandon a change (interactive mode if no change-id provided; accepts change number or Change-ID)',
    )
    .option('-m, --message <message>', 'Abandon message')
    .option('--confirm', 'Confirm and execute this write operation')
    .option('--xml', 'XML output for LLM consumption')
    .option('--json', 'JSON output for programmatic consumption')
    .action(async (changeId, options) => {
      await executeEffect(
        abandonCommand(changeId, options).pipe(
          Effect.provide(GerritApiServiceLive),
          Effect.provide(ConfigServiceLive),
        ),
        options,
        'abandon_result',
      )
    })

  program
    .command('restore <change-id>')
    .description('Restore an abandoned change (accepts change number or Change-ID)')
    .option('-m, --message <message>', 'Restoration message')
    .option('--confirm', 'Confirm and execute this write operation')
    .option('--xml', 'XML output for LLM consumption')
    .option('--json', 'JSON output for programmatic consumption')
    .action(async (changeId, options) => {
      await executeEffect(
        restoreCommand(changeId, options).pipe(
          Effect.provide(GerritApiServiceLive),
          Effect.provide(ConfigServiceLive),
        ),
        options,
        'restore_result',
      )
    })

  program
    .command('set-ready <change-id>')
    .description('Mark a WIP change as ready for review (accepts change number or Change-ID)')
    .option('-m, --message <message>', 'Message to include with the status change')
    .option('--confirm', 'Confirm and execute this write operation')
    .option('--xml', 'XML output for LLM consumption')
    .option('--json', 'JSON output for programmatic consumption')
    .action(async (changeId, options) => {
      await executeEffect(
        setReadyCommand(changeId, options).pipe(
          Effect.provide(GerritApiServiceLive),
          Effect.provide(ConfigServiceLive),
        ),
        options,
        'set_ready_result',
      )
    })

  program
    .command('set-wip <change-id>')
    .description('Mark a change as work-in-progress (accepts change number or Change-ID)')
    .option('-m, --message <message>', 'Message to include with the status change')
    .option('--confirm', 'Confirm and execute this write operation')
    .option('--xml', 'XML output for LLM consumption')
    .option('--json', 'JSON output for programmatic consumption')
    .action(async (changeId, options) => {
      await executeEffect(
        setWipCommand(changeId, options).pipe(
          Effect.provide(GerritApiServiceLive),
          Effect.provide(ConfigServiceLive),
        ),
        options,
        'set_wip_result',
      )
    })
}
