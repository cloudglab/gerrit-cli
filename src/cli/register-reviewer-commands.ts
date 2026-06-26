import type { Command } from 'commander'
import { Effect } from 'effect'
import { GerritApiServiceLive } from '@/api/gerrit'
import { ConfigServiceLive } from '@/services/config'
import { executeEffect } from './command-helpers'
import { addReviewerCommand } from './commands/add-reviewer'
import { removeReviewerCommand } from './commands/remove-reviewer'
import { reviewCommand } from './commands/review'

/**
 * Register all reviewer-related commands (add-reviewer, remove-reviewer, review)
 */
export function registerReviewerCommands(program: Command): void {
  // add-reviewer command
  program
    .command('add-reviewer <reviewers...>')
    .description('Add reviewers or groups to a change')
    .option('-c, --change <change-id>', 'Change ID (required until auto-detection is implemented)')
    .option('--cc', 'Add as CC instead of reviewer')
    .option('--group', 'Add as group instead of individual reviewer')
    .option('--confirm', 'Confirm and execute this write operation')
    .option(
      '--notify <level>',
      'Notification level: none, owner, owner_reviewers, all (default: all)',
    )
    .option('--xml', 'XML output for LLM consumption')
    .option('--json', 'JSON output for programmatic consumption')
    .addHelpText(
      'after',
      `
Examples:
  $ gerrit-cli add-reviewer user@example.com -c 12345          # Add a reviewer
  $ gerrit-cli add-reviewer user1@example.com user2@example.com -c 12345  # Multiple
  $ gerrit-cli add-reviewer --cc user@example.com -c 12345     # Add as CC
  $ gerrit-cli add-reviewer --group project-reviewers -c 12345 # Add a group
  $ gerrit-cli add-reviewer --group admins --cc -c 12345       # Add group as CC
  $ gerrit-cli add-reviewer --notify none user@example.com -c 12345  # No email`,
    )
    .action(async (reviewers, options) => {
      await executeEffect(
        addReviewerCommand(reviewers, options).pipe(
          Effect.provide(GerritApiServiceLive),
          Effect.provide(ConfigServiceLive),
        ),
        options,
        'add_reviewer_result',
      )
    })

  // remove-reviewer command
  program
    .command('remove-reviewer <reviewers...>')
    .description('Remove reviewers from a change')
    .option('-c, --change <change-id>', 'Change ID (required until auto-detection is implemented)')
    .option(
      '--notify <level>',
      'Notification level: none, owner, owner_reviewers, all (default: all)',
    )
    .option('--confirm', 'Confirm and execute this write operation')
    .option('--xml', 'XML output for LLM consumption')
    .option('--json', 'JSON output for programmatic consumption')
    .addHelpText(
      'after',
      `
Examples:
  $ gerrit-cli remove-reviewer user@example.com -c 12345          # Remove a reviewer
  $ gerrit-cli remove-reviewer user1@example.com user2@example.com -c 12345  # Multiple
  $ gerrit-cli remove-reviewer --notify none user@example.com -c 12345  # No email`,
    )
    .action(async (reviewers, options) => {
      await executeEffect(
        removeReviewerCommand(reviewers, options).pipe(
          Effect.provide(GerritApiServiceLive),
          Effect.provide(ConfigServiceLive),
        ),
        options,
        'remove_reviewer_result',
      )
    })

  // review command: end-to-end "无问题 / 严重问题" 双路径入口
  program
    .command('review <change-id>')
    .description(
      'End-to-end review: vote + comment + submit (default), or post a line-level reject comment (--reject)',
    )
    .option('--reject', '走"严重问题"路径：仅在 <file>:<line> 留行级 comment，不 vote / 不 submit')
    .option(
      '-m, --message <msg>',
      '整体 review 描述（无问题路径用作整体 comment；--reject 路径用作行级 comment 内容）',
    )
    .option('--file <path>', '（仅 --reject）目标文件路径')
    .option('--line <n>', '（仅 --reject）目标行号（指 new 版本行号）', parseInt)
    .option('--no-submit', '无问题路径：投票 + 评论但跳过 submit')
    .option('--no-verified', '无问题路径：跳过 Verified +1（即便项目定义了该 label）')
    .option('--confirm', '真正执行写操作')
    .option('--xml', 'XML output for LLM consumption')
    .option('--json', 'JSON output for programmatic consumption')
    .addHelpText(
      'after',
      `
Examples:
  # 无问题路径：Code-Review+2、Verified+1、整体 comment、submit
  $ gerrit-cli review 12345 -m "LGTM" --confirm

  # 整体评论 + submit
  $ gerrit-cli review 12345 -m "Looks good, ship it" --confirm

  # 仅投票 + 评论，不 submit
  $ gerrit-cli review 12345 -m "OK after one more iteration" --no-submit --confirm

  # 跳过 Verified 投票
  $ gerrit-cli review 12345 --no-verified -m "LGTM" --confirm

  # 严重问题：留行级 comment，不 vote 不 submit
  $ gerrit-cli review 12345 --reject --file src/main.ts --line 42 -m "Fix this race" --confirm

  # 不加 --confirm 时仅打印 preview + 完整计划
  $ gerrit-cli review 12345 -m "LGTM"`,
    )
    .action(async (changeId, options) => {
      await executeEffect(
        reviewCommand(changeId, options).pipe(
          Effect.provide(GerritApiServiceLive),
          Effect.provide(ConfigServiceLive),
        ),
        options,
        'review_result',
      )
    })
}
