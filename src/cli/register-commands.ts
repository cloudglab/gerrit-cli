import type { Command } from 'commander'
import { Effect } from 'effect'
import { GerritApiServiceLive } from '@/api/gerrit'
import { CommitHookServiceLive } from '@/services/commit-hook'
import { ConfigServiceLive } from '@/services/config'
import { executeEffect } from './command-helpers'
import { changelogCommand } from './commands/changelog'
import { CHECKOUT_HELP_TEXT, checkoutCommand } from './commands/checkout'
import { CHERRY_HELP_TEXT, cherryCommand } from './commands/cherry'
import { cleanCommand, STALE_BRANCHES_HELP } from './commands/clean'
import { COMMENT_HELP_TEXT, commentCommand } from './commands/comment'
import { commentsCommand } from './commands/comments'
import { renderCompletion } from './commands/completion'
import { configShowCommand, configTestCommand } from './commands/config'
import { diffCommand } from './commands/diff'
import { doctorCommand, outputDoctorReport } from './commands/doctor'
import { filesCommand } from './commands/files'
import { installCommand, updateCommand } from './commands/install'
import { openCommand } from './commands/open'
import { projectsCommand } from './commands/projects'
import { PUSH_HELP_TEXT, pushCommand } from './commands/push'
import { rebaseCommand } from './commands/rebase'
// CICD commands: retrigger, build-status, extract-url, install-hook
// now registered via registerCicdCommands
import { reviewersCommand } from './commands/reviewers'
import { SEARCH_HELP_TEXT, searchCommand } from './commands/search'
import { setup } from './commands/setup'
import { SHOW_HELP_TEXT, showCommand } from './commands/show'
import { statusCommand } from './commands/status'
import { submitCommand } from './commands/submit'
import { TOPIC_HELP_TEXT, topicCommand } from './commands/topic'
import { uninstallCommand } from './commands/uninstall'
import { versionCommand } from './commands/version'
import { voteCommand } from './commands/vote'
import { whoamiCommand } from './commands/whoami'
import { workspaceCommand } from './commands/workspace'
import { registerAnalyticsCommands } from './register-analytics-commands'
import { registerCicdCommands } from './register-cicd-commands'
import { registerGroupCommands } from './register-group-commands'
import { registerListCommands } from './register-list-commands'
import { registerReviewerCommands } from './register-reviewer-commands'
import { registerStateCommands } from './register-state-commands'
import { registerTreeCommands } from './register-tree-commands'

export function registerCommands(program: Command): void {
  // setup command (new primary command)
  program
    .command('setup')
    .description('Configure Gerrit credentials and AI tools')
    .action(async () => {
      await setup()
    })

  // init command (kept for backward compatibility, redirects to setup)
  program
    .command('init')
    .description('Initialize Gerrit credentials (alias for setup)')
    .action(async () => {
      await setup()
    })

  const addInstallOptions = (command: Command): Command =>
    command
      .option('--skip-config-check', 'Skip post-install config guidance')
      .option('--skill-source <source>', 'Skill source: local, git, or npm', 'local')
      .option('--skill-local-path <path>', 'Install skill from a local directory')
      .option('--skill-global [boolean]', 'Install skill to global agent directory', true)
      .option('--cli-only', 'Only install/update the global CLI package')
      .option('--skill-only', 'Only install/update the opencode skill')

  addInstallOptions(
    program.command('install').description('Install Gerrit CLI and opencode skill'),
  ).action(async (options) => {
    await executeEffect(installCommand(options), options, 'install_result')
  })

  addInstallOptions(
    program.command('update').description('Update Gerrit CLI and opencode skill'),
  ).action(async (options) => {
    await executeEffect(updateCommand(options), options, 'update_result')
  })

  addInstallOptions(program.command('upgrade').description('Alias for update')).action(
    async (options) => {
      await executeEffect(updateCommand(options), options, 'update_result')
    },
  )

  const addUninstallOptions = (command: Command): Command =>
    command
      .option('--confirm', 'Confirm and execute uninstall')
      .option('--keep-config', 'Keep ~/.gerrit-cli configuration')
      .option('--remove-config', 'Remove ~/.gerrit-cli configuration')
      .option('--cli-only', 'Only uninstall the global CLI package')
      .option('--skill-only', 'Only uninstall the opencode skill')

  addUninstallOptions(
    program.command('uninstall').description('Uninstall Gerrit CLI and opencode skill'),
  ).action(async (options) => {
    await executeEffect(uninstallCommand(options), options, 'uninstall_result')
  })

  addUninstallOptions(program.command('remove').description('Alias for uninstall')).action(
    async (options) => {
      await executeEffect(uninstallCommand(options), options, 'uninstall_result')
    },
  )

  // status command
  program
    .command('status')
    .description('Check connection status')
    .option('--xml', 'XML output for LLM consumption')
    .option('--json', 'JSON output for programmatic consumption')
    .action(async (options) => {
      await executeEffect(
        statusCommand(options).pipe(
          Effect.provide(GerritApiServiceLive),
          Effect.provide(ConfigServiceLive),
        ),
        options,
        'status_result',
      )
    })

  // comment command
  program
    .command('comment <change-id>')
    .description('Post a comment on a change (accepts change number or Change-ID)')
    .option('-m, --message <message>', 'Comment message')
    .option('--file <file>', 'File path for line-specific comment (relative to repo root)')
    .option(
      '--line <line>',
      'Line number in the NEW version of the file (not diff line numbers)',
      parseInt,
    )
    .option(
      '--reply-to <comment-id>',
      'Reply to a comment thread (requires --file and --line; resolves thread by default)',
    )
    .option('--unresolved', 'Mark comment as unresolved (requires human attention)')
    .option('--batch', 'Read batch comments from stdin as JSON (see examples below)')
    .option('--confirm', 'Confirm and execute this write operation')
    .option('--xml', 'XML output for LLM consumption')
    .option('--json', 'JSON output for programmatic consumption')
    .addHelpText('after', COMMENT_HELP_TEXT)
    .action(async (changeId, options) => {
      await executeEffect(
        commentCommand(changeId, options).pipe(
          Effect.provide(GerritApiServiceLive),
          Effect.provide(ConfigServiceLive),
        ),
        options,
        'comment_result',
      )
    })

  // diff command
  program
    .command('diff <change-id>')
    .description('Get diff for a change (accepts change number or Change-ID)')
    .option('--xml', 'XML output for LLM consumption')
    .option('--json', 'JSON output for programmatic consumption')
    .option('--file <file>', 'Specific file to diff')
    .option('--files-only', 'List changed files only')
    .option('--format <format>', 'Output format (unified, json, files)')
    .action(async (changeId, options) => {
      await executeEffect(
        diffCommand(changeId, options).pipe(
          Effect.provide(GerritApiServiceLive),
          Effect.provide(ConfigServiceLive),
        ),
        options,
        'diff_result',
      )
    })

  registerListCommands(program)

  // search command
  program
    .command('search [query]')
    .description('Search changes using Gerrit query syntax')
    .option('--xml', 'XML output for LLM consumption')
    .option('--json', 'JSON output for programmatic consumption')
    .option('-n, --limit <number>', 'Limit results (default: 25)')
    .addHelpText('after', SEARCH_HELP_TEXT)
    .action(async (query, options) => {
      await executeEffect(
        searchCommand(query, options).pipe(
          Effect.provide(GerritApiServiceLive),
          Effect.provide(ConfigServiceLive),
        ),
        options,
        'search_result',
      )
    })

  // workspace command (deprecated — use 'gerrit-cli tree setup' instead)
  program
    .command('workspace <change-id>')
    .description(
      '[deprecated: use "gerrit-cli tree setup"] Create a git worktree for a Gerrit change',
    )
    .option('--xml', 'XML output for LLM consumption')
    .option('--json', 'JSON output for programmatic consumption')
    .action(async (changeId, options) => {
      if (!options.xml && !options.json) {
        console.error(
          'Note: "gerrit-cli workspace" is deprecated. Use "gerrit-cli tree setup" instead.',
        )
      }
      await executeEffect(
        workspaceCommand(changeId, options).pipe(
          Effect.provide(GerritApiServiceLive),
          Effect.provide(ConfigServiceLive),
        ),
        options,
        'workspace_result',
      )
    })

  registerTreeCommands(program)

  // abandon / restore / set-ready / set-wip commands
  registerStateCommands(program)

  // rebase command
  program
    .command('rebase [change-id]')
    .description('Rebase a change onto target branch (auto-detects from HEAD if not provided)')
    .option('--base <ref>', 'Base revision to rebase onto (default: target branch HEAD)')
    .option('--allow-conflicts', 'Allow rebasing even if conflicts exist')
    .option('--confirm', 'Confirm and execute this write operation')
    .option('--xml', 'XML output for LLM consumption')
    .option('--json', 'JSON output for programmatic consumption')
    .action(async (changeId, options) => {
      await executeEffect(
        rebaseCommand(changeId, {
          base: options.base,
          allowConflicts: options.allowConflicts,
          confirm: options.confirm,
          xml: options.xml,
          json: options.json,
        }).pipe(Effect.provide(GerritApiServiceLive), Effect.provide(ConfigServiceLive)),
        options,
        'rebase_result',
      )
    })

  // submit command
  program
    .command('submit <change-id>')
    .description('Submit a change for merging (accepts change number or Change-ID)')
    .option('--confirm', 'Confirm and execute this write operation')
    .option('--xml', 'XML output for LLM consumption')
    .option('--json', 'JSON output for programmatic consumption')
    .action(async (changeId, options) => {
      await executeEffect(
        submitCommand(changeId, options).pipe(
          Effect.provide(GerritApiServiceLive),
          Effect.provide(ConfigServiceLive),
        ),
        options,
        'submit_result',
      )
    })

  // topic command
  program
    .command('topic [change-id] [topic]')
    .description('Get, set, or remove topic for a change (auto-detects from HEAD if not specified)')
    .option('--delete', 'Remove the topic from the change')
    .option('--confirm', 'Confirm and execute this write operation (required to set/delete topic)')
    .option('--xml', 'XML output for LLM consumption')
    .option('--json', 'JSON output for programmatic consumption')
    .addHelpText('after', TOPIC_HELP_TEXT)
    .action(async (changeId, topic, options) => {
      await executeEffect(
        topicCommand(changeId, topic, options).pipe(
          Effect.provide(GerritApiServiceLive),
          Effect.provide(ConfigServiceLive),
        ),
        options,
        'topic_result',
      )
    })

  // vote command
  program
    .command('vote <change-id>')
    .description('Cast votes on a change (accepts change number or Change-ID)')
    .option('--code-review <value>', 'Code-Review vote (-2 to +2)', parseInt)
    .option('--verified <value>', 'Verified vote (-1 to +1)', parseInt)
    .option('--label <name> <value>', 'Custom label vote (can be used multiple times)')
    .option('-m, --message <message>', 'Comment with vote')
    .option('--confirm', 'Confirm and execute this write operation')
    .option('--xml', 'XML output for LLM consumption')
    .option('--json', 'JSON output for programmatic consumption')
    .action(async (changeId, options) => {
      await executeEffect(
        voteCommand(changeId, options).pipe(
          Effect.provide(GerritApiServiceLive),
          Effect.provide(ConfigServiceLive),
        ),
        options,
        'vote_result',
      )
    })

  // Register all reviewer-related commands
  registerReviewerCommands(program)

  // projects command
  program
    .command('projects')
    .description('List Gerrit projects')
    .option('--pattern <regex>', 'Filter projects by name pattern')
    .option('--xml', 'XML output for LLM consumption')
    .option('--json', 'JSON output for programmatic consumption')
    .action(async (options) => {
      await executeEffect(
        projectsCommand(options).pipe(
          Effect.provide(GerritApiServiceLive),
          Effect.provide(ConfigServiceLive),
        ),
        options,
        'projects_result',
      )
    })

  // Register all group-related commands
  registerGroupCommands(program)

  registerCicdCommands(program)

  // comments command
  program
    .command('comments <change-id>')
    .description(
      'Show all comments on a change with diff context (accepts change number or Change-ID)',
    )
    .option('--xml', 'XML output for LLM consumption')
    .option('--json', 'JSON output for programmatic consumption')
    .action(async (changeId, options) => {
      await executeEffect(
        commentsCommand(changeId, options).pipe(
          Effect.provide(GerritApiServiceLive),
          Effect.provide(ConfigServiceLive),
        ),
        options,
        'comments_result',
      )
    })

  // open command
  program
    .command('open <change-id>')
    .description('Open a change in the browser (accepts change number or Change-ID)')
    .action(async (changeId, options) => {
      await executeEffect(
        openCommand(changeId, options).pipe(
          Effect.provide(GerritApiServiceLive),
          Effect.provide(ConfigServiceLive),
        ),
        options,
        'open_result',
      )
    })

  // show command
  program
    .command('show [change-id]')
    .description(
      'Show comprehensive change information (auto-detects from HEAD commit if not specified)',
    )
    .option('--xml', 'XML output for LLM consumption')
    .option('--json', 'JSON output for programmatic consumption')
    .addHelpText('after', SHOW_HELP_TEXT)
    .action(async (changeId, options) => {
      await executeEffect(
        showCommand(changeId, options).pipe(
          Effect.provide(GerritApiServiceLive),
          Effect.provide(ConfigServiceLive),
        ),
        options,
        'show_result',
      )
    })

  // push command
  program
    .command('push')
    .description('Push commits to Gerrit for code review')
    .option('-b, --branch <branch>', 'Target branch (default: auto-detect)')
    .option('-t, --topic <topic>', 'Set change topic')
    .option('-r, --reviewer <email...>', 'Add reviewer(s)')
    .option('--cc <email...>', 'Add CC recipient(s)')
    .option('--wip', 'Mark as work-in-progress')
    .option('--ready', 'Mark as ready for review')
    .option('--hashtag <tag...>', 'Add hashtag(s)')
    .option('--private', 'Mark change as private')
    .option('--draft', 'Alias for --wip')
    .option('--dry-run', 'Show what would be pushed without pushing')
    .option('--confirm', 'Confirm and execute this write operation')
    .addHelpText('after', PUSH_HELP_TEXT)
    .action(async (options) => {
      await executeEffect(
        pushCommand({
          branch: options.branch,
          topic: options.topic,
          reviewer: options.reviewer,
          cc: options.cc,
          wip: options.wip,
          ready: options.ready,
          hashtag: options.hashtag,
          private: options.private,
          draft: options.draft,
          dryRun: options.dryRun,
          confirm: options.confirm,
        }).pipe(Effect.provide(CommitHookServiceLive), Effect.provide(ConfigServiceLive)),
        options,
        'push_result',
      )
    })

  // files command
  program
    .command('files [change-id]')
    .description(
      'List files changed in a Gerrit change (auto-detects from HEAD commit if not specified)',
    )
    .option('--xml', 'XML output for LLM consumption')
    .option('--json', 'JSON output for programmatic consumption')
    .action(async (changeId, options) => {
      await executeEffect(
        filesCommand(changeId, options).pipe(
          Effect.provide(GerritApiServiceLive),
          Effect.provide(ConfigServiceLive),
        ),
        options,
        'files_result',
      )
    })

  // reviewers command
  program
    .command('reviewers [change-id]')
    .description(
      'List reviewers on a Gerrit change (auto-detects from HEAD commit if not specified)',
    )
    .option('--xml', 'XML output for LLM consumption')
    .option('--json', 'JSON output for programmatic consumption')
    .action(async (changeId, options) => {
      await executeEffect(
        reviewersCommand(changeId, options).pipe(
          Effect.provide(GerritApiServiceLive),
          Effect.provide(ConfigServiceLive),
        ),
        options,
        'reviewers_result',
      )
    })

  // checkout command
  program
    .command('checkout <change-id>')
    .description('Fetch and checkout a Gerrit change')
    .option('--detach', 'Checkout as detached HEAD without creating branch')
    .option('--remote <name>', 'Use specific git remote (default: auto-detect)')
    .addHelpText('after', CHECKOUT_HELP_TEXT)
    .action(async (changeId, options) => {
      await executeEffect(
        checkoutCommand(changeId, {
          detach: options.detach,
          remote: options.remote,
        }).pipe(Effect.provide(GerritApiServiceLive), Effect.provide(ConfigServiceLive)),
        options,
        'checkout_result',
      )
    })

  registerAnalyticsCommands(program)

  // cherry command
  program
    .command('cherry <change-id>')
    .description('Fetch and cherry-pick a Gerrit change onto the current branch')
    .option('-n, --no-commit', 'Stage changes without committing')
    .option('--remote <name>', 'Use specific git remote (default: auto-detect)')
    .addHelpText('after', CHERRY_HELP_TEXT)
    .action(async (changeId, options) => {
      await executeEffect(
        cherryCommand(changeId, {
          noCommit: options.noCommit,
          remote: options.remote,
        }).pipe(Effect.provide(GerritApiServiceLive), Effect.provide(ConfigServiceLive)),
        options,
        'cherry_result',
      )
    })

  program
    .command('clean')
    .description('Delete local branches that have been merged into upstream')
    .option('-n, --dry-run', 'Show which branches would be removed without deleting')
    .option('-f, --force', 'Skip confirmation and force-delete branches')
    .option('--xml', 'XML output')
    .option('--json', 'JSON output')
    .addHelpText('after', STALE_BRANCHES_HELP)
    .action(async (options) => {
      await executeEffect(cleanCommand(options), options, 'clean_result')
    })

  program
    .command('completion <shell>')
    .description('Generate shell completion script (bash, zsh, or fish)')
    .addHelpText(
      'after',
      `
Examples:
  $ source <(gerrit-cli completion bash)
  $ gerrit-cli completion zsh > ~/.zsh/completions/_gerrit-cli
  $ gerrit-cli completion fish > ~/.config/fish/completions/gerrit-cli.fish`,
    )
    .action((shell) => {
      try {
        console.log(renderCompletion(program, shell))
      } catch (error) {
        console.error('✗ Error:', error instanceof Error ? error.message : String(error))
        process.exit(1)
      }
    })

  const config = program.command('config').description('View and test Gerrit CLI configuration')

  config
    .command('show')
    .description('Show current configuration (passwords hidden)')
    .option('--json', 'JSON output')
    .option('--xml', 'XML output')
    .action(async (options: { json?: boolean; xml?: boolean }) => {
      await executeEffect(
        configShowCommand(options).pipe(Effect.provide(ConfigServiceLive)),
        options,
        'config_show',
      )
    })

  config
    .command('test')
    .description('Test Gerrit connection with current config')
    .option('--json', 'JSON output')
    .option('--xml', 'XML output')
    .action(async (options: { json?: boolean; xml?: boolean }) => {
      await executeEffect(
        configTestCommand(options).pipe(
          Effect.provide(GerritApiServiceLive),
          Effect.provide(ConfigServiceLive),
        ),
        options,
        'config_test',
      )
    })

  program
    .command('version')
    .description('Show version information')
    .option('--json', 'JSON output')
    .option('--xml', 'XML output')
    .action((options) => {
      versionCommand(options)
    })

  program
    .command('changelog')
    .description('Show recent changes from CHANGELOG.md')
    .option('--version <version>', 'Show a specific version section (e.g. 0.0.18)')
    .option('--json', 'JSON output')
    .option('--xml', 'XML output')
    .action((options) => {
      changelogCommand(options)
    })

  program
    .command('whoami')
    .description('Show current Gerrit identity and connection status')
    .option('--json', 'JSON output')
    .option('--xml', 'XML output')
    .action(async (options: { json?: boolean; xml?: boolean }) => {
      await executeEffect(
        whoamiCommand(options).pipe(
          Effect.provide(GerritApiServiceLive),
          Effect.provide(ConfigServiceLive),
        ),
        options,
        'whoami',
      )
    })

  program
    .command('doctor')
    .description('Run local Gerrit CLI environment diagnostics')
    .option('--json', 'JSON output')
    .option('--xml', 'XML output')
    .action(async (options: { json?: boolean; xml?: boolean }) => {
      if (options.xml && options.json) {
        console.error('✗ Error: --xml and --json are mutually exclusive')
        process.exit(1)
      }

      const report = await Effect.runPromise(
        doctorCommand().pipe(
          Effect.provide(CommitHookServiceLive),
          Effect.provide(GerritApiServiceLive),
          Effect.provide(ConfigServiceLive),
        ),
      )

      outputDoctorReport(report, options)
      if (!report.ok) {
        process.exit(1)
      }
    })
}
