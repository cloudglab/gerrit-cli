import { Command } from 'commander'
import { applyMetaHelp, applyRoleFilter } from './cli/command-meta'
import { registerCommands } from './cli/register-commands'
import { CLI_ROLES, type CliRole, parseCliRole } from './cli/roles'
import { runDailyUpdateProbe } from './update-probe'
import { getCliVersion } from './version'

export interface RunCliOptions {
  readonly role?: CliRole
}

function createProgram(role: CliRole): Command {
  const program = new Command()

  program
    .name('gerrit-cli')
    .description('Gerrit CLI tool')
    .version(getCliVersion())
    .option('-r, --role <role>', `Filter commands by role (${CLI_ROLES.join(', ')})`)

  program.addHelpText(
    'after',
    `
CHANGE-ID FORMATS
  Accepts numeric change numbers (12345) or full Change-IDs (I1234abc...).
  Many commands auto-detect from HEAD commit's Change-Id footer when the
  argument is omitted.

OUTPUT FORMATS
  --json    Structured JSON output for programmatic consumption
  --xml     XML with CDATA-wrapped content, optimized for LLM consumption
  (default) Plain text for human reading
  Most commands support both --json and --xml.

PIPING / STDIN
  comment           Reads message from stdin if no -m flag is provided
  comment --batch   Reads a JSON array from stdin for bulk commenting

AUTO-DETECTION
  These commands auto-detect the change from HEAD's Change-Id footer when
  the change-id argument is omitted:
    show, build-status, topic, rebase, extract-url, diff, comments, vote

COMMON LLM WORKFLOWS
  Review a change:    gerrit-cli show <id> → gerrit-cli diff <id> → gerrit-cli comments <id>
  Post a review:      gerrit-cli comment <id> -m "..." → gerrit-cli vote <id> <label> <score>
  Manage changes:     gerrit-cli push, gerrit-cli checkout <id>, gerrit-cli abandon <id>, gerrit-cli submit <id>
  WIP toggle:         gerrit-cli set-wip <id>, gerrit-cli set-ready <id> [-m "message"]
  Check CI:           gerrit-cli build-status <id> --exit-status

EXIT CODES
  build-status --exit-status returns non-zero on build failure (useful for scripting).

SUBCOMMAND HELP
  Run gerrit-cli <command> --help for detailed usage and examples.
`,
  )

  registerCommands(program)
  applyMetaHelp(program)
  applyRoleFilter(program, role)

  return program
}

function extractRole(argv: readonly string[], defaultRole: CliRole): CliRole {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--role' || arg === '-r') {
      const role = argv[index + 1]
      if (!role) throw new Error(`${arg} requires a role (${CLI_ROLES.join(', ')})`)
      return parseCliRole(role)
    }
    if (arg.startsWith('--role=')) {
      return parseCliRole(arg.slice('--role='.length))
    }
  }
  return defaultRole
}

/**
 * Bootstrap the Gerrit CLI.
 * Architecture aligned with zentao-cli: separate SDK exports from CLI bootstrap.
 */
function extractCommandName(argv: readonly string[]): string | undefined {
  for (const arg of argv) {
    if (arg.startsWith('-')) continue
    return arg
  }
  return undefined
}

export async function runCli(argv: string[], options: RunCliOptions = {}): Promise<void> {
  // Non-blocking daily update probe — spawns detached background subprocess
  runDailyUpdateProbe(extractCommandName(argv))

  const role = extractRole(argv, options.role ?? 'full')
  const program = createProgram(role)
  await program.parseAsync(argv, { from: 'user' })
}
