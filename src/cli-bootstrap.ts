import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Command } from 'commander'
import { registerCommands } from './cli/register-commands'
import { runDailyUpdateProbe } from './update-probe'

function getVersion(): string {
  try {
    const __filename = fileURLToPath(import.meta.url)
    const __dirname = dirname(__filename)
    const packageJsonPath = join(__dirname, '..', 'package.json')
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
    return packageJson.version || '0.0.0'
  } catch {
    return '0.0.0'
  }
}

function createProgram(): Command {
  const program = new Command()

  program.name('gerrit-cli').description('Gerrit CLI tool').version(getVersion())

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

  return program
}

// Bun version guard — checked only when running as CLI (not on SDK import)
declare const Bun: { version: string } | undefined

function ensureBunVersion(): void {
  const MIN_BUN_VERSION = '1.2.0'
  if (typeof Bun === 'undefined') return // running under Node, skip check
  const bunVersion = Bun.version
  const parseVersion = (v: string) => v.split('.').map((n) => parseInt(n, 10))
  const [aMajor, aMinor = 0, aPatch = 0] = parseVersion(bunVersion)
  const [bMajor, bMinor = 0, bPatch = 0] = parseVersion(MIN_BUN_VERSION)

  if (
    aMajor < bMajor ||
    (aMajor === bMajor && aMinor < bMinor) ||
    (aMajor === bMajor && aMinor === bMinor && aPatch < bPatch)
  ) {
    console.error(`✗ Error: Bun version ${MIN_BUN_VERSION} or higher is required`)
    console.error(`  Current version: ${bunVersion}`)
    console.error(`  Please upgrade Bun: bun upgrade`)
    process.exit(1)
  }
}

/**
 * Bootstrap the Gerrit CLI.
 * Architecture aligned with zentao-cli: separate SDK exports from CLI bootstrap.
 */
export async function runCli(argv: string[]): Promise<void> {
  ensureBunVersion()

  // Non-blocking daily update probe — silently checks npm for newer versions
  if (process.env.GERRIT_SKIP_UPDATE_CHECK !== 'true') {
    runDailyUpdateProbe().catch(() => {})
  }

  const program = createProgram()
  await program.parseAsync(argv)
}
