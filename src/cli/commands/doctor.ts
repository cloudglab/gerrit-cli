import chalk from 'chalk'
import { Effect } from 'effect'
import { GerritApiService } from '@/api/gerrit'
import { CommitHookService } from '@/services/commit-hook'
import { ConfigService, type MaskedAppConfig } from '@/services/config'
import * as childProcess from '@/utils/child-process'

interface DoctorOptions {
  json?: boolean
  xml?: boolean
}

type DoctorCheckStatus = 'pass' | 'fail' | 'warn'

interface DoctorCheck {
  readonly name: string
  readonly label: string
  readonly status: DoctorCheckStatus
  readonly message: string
}

export interface DoctorReport {
  readonly ok: boolean
  readonly host?: string
  readonly username?: string
  readonly configSource?: string
  readonly checks: readonly DoctorCheck[]
}

interface DoctorDependencies {
  readonly getMaskedConfig: Effect.Effect<MaskedAppConfig, Error>
  readonly testConnection: Effect.Effect<boolean, Error>
  readonly hasHook: () => Effect.Effect<boolean, Error>
  readonly hasChangeId: (commit?: string) => Effect.Effect<boolean, Error>
  readonly gitProbe: {
    readonly isGitRepo: () => boolean
    readonly listRemotes: () => readonly string[]
  }
}

const createCheck = (
  name: string,
  label: string,
  status: DoctorCheckStatus,
  message: string,
): DoctorCheck => ({ name, label, status, message })

const normalizeHost = (host: string): string => host.replace(/\/$/, '')

const createGitProbe = (): DoctorDependencies['gitProbe'] => ({
  isGitRepo: () => {
    try {
      const output = childProcess.execSync('git rev-parse --is-inside-work-tree', {
        encoding: 'utf8',
        timeout: 3000,
      })
      return output.trim() === 'true'
    } catch {
      return false
    }
  },
  listRemotes: () => {
    try {
      const output = childProcess.execSync('git remote -v', { encoding: 'utf8', timeout: 3000 })
      return output
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
    } catch {
      return []
    }
  },
})

export const collectDoctorReport = (deps: DoctorDependencies): Effect.Effect<DoctorReport, never> =>
  Effect.gen(function* () {
    const checks: DoctorCheck[] = []
    let host: string | undefined
    let username: string | undefined
    let configSource: string | undefined
    let hasConfig = false

    const maskedConfig = yield* deps.getMaskedConfig.pipe(Effect.either)
    if (maskedConfig._tag === 'Right') {
      hasConfig = true
      host = maskedConfig.right.host
      username = maskedConfig.right.username
      configSource = maskedConfig.right.source
      checks.push(
        createCheck(
          'config',
          'Config',
          'pass',
          `Loaded config for ${maskedConfig.right.username} from ${maskedConfig.right.source}`,
        ),
      )
    } else {
      const message =
        maskedConfig.left instanceof Error ? maskedConfig.left.message : 'Config not available'
      checks.push(createCheck('config', 'Config', 'fail', message))
    }

    if (hasConfig) {
      const connected = yield* deps.testConnection.pipe(Effect.orElseSucceed(() => false))
      checks.push(
        createCheck(
          'connection',
          'Connection',
          connected ? 'pass' : 'fail',
          connected
            ? 'Authenticated with Gerrit successfully'
            : 'Failed to authenticate with Gerrit',
        ),
      )
    } else {
      checks.push(
        createCheck(
          'connection',
          'Connection',
          'warn',
          'Skipped because configuration is unavailable',
        ),
      )
    }

    const isGitRepo = deps.gitProbe.isGitRepo()
    checks.push(
      createCheck(
        'git-repo',
        'Git repository',
        isGitRepo ? 'pass' : 'warn',
        isGitRepo ? 'Inside a git repository' : 'Not in a git repository; local git checks skipped',
      ),
    )

    if (!isGitRepo) {
      checks.push(
        createCheck(
          'git-remote',
          'Git remote',
          'warn',
          'Skipped because current directory is not a git repository',
        ),
      )
      checks.push(
        createCheck(
          'commit-msg-hook',
          'commit-msg hook',
          'warn',
          'Skipped because current directory is not a git repository',
        ),
      )
      checks.push(
        createCheck(
          'head-change-id',
          'HEAD Change-Id',
          'warn',
          'Skipped because current directory is not a git repository',
        ),
      )
    } else {
      if (hasConfig && host) {
        const remoteMatchesHost = deps.gitProbe
          .listRemotes()
          .some((line) => line.includes(normalizeHost(host)))
        checks.push(
          createCheck(
            'git-remote',
            'Git remote',
            remoteMatchesHost ? 'pass' : 'fail',
            remoteMatchesHost
              ? `Found a git remote matching ${normalizeHost(host)}`
              : `No git remote found matching ${normalizeHost(host)}`,
          ),
        )
      } else {
        checks.push(
          createCheck(
            'git-remote',
            'Git remote',
            'warn',
            'Skipped because Gerrit host is not configured',
          ),
        )
      }

      const hasHook = yield* deps.hasHook().pipe(Effect.either)
      if (hasHook._tag === 'Right') {
        checks.push(
          createCheck(
            'commit-msg-hook',
            'commit-msg hook',
            hasHook.right ? 'pass' : 'warn',
            hasHook.right
              ? 'commit-msg hook is installed'
              : 'commit-msg hook is missing; run `gerrit install-hook`',
          ),
        )
      } else {
        checks.push(
          createCheck(
            'commit-msg-hook',
            'commit-msg hook',
            'warn',
            'Unable to inspect commit-msg hook',
          ),
        )
      }

      const hasChangeId = yield* deps.hasChangeId('HEAD').pipe(Effect.either)
      if (hasChangeId._tag === 'Right') {
        checks.push(
          createCheck(
            'head-change-id',
            'HEAD Change-Id',
            hasChangeId.right ? 'pass' : 'warn',
            hasChangeId.right
              ? 'HEAD commit already has a Change-Id footer'
              : 'HEAD commit is missing Change-Id; install hook and amend before pushing',
          ),
        )
      } else {
        checks.push(
          createCheck(
            'head-change-id',
            'HEAD Change-Id',
            'warn',
            'Unable to inspect HEAD commit message',
          ),
        )
      }
    }

    return {
      ok: !checks.some((check) => check.status === 'fail'),
      host,
      username,
      configSource,
      checks,
    }
  })

const statusIcon = (status: DoctorCheckStatus): string => {
  switch (status) {
    case 'pass':
      return chalk.green('✓')
    case 'fail':
      return chalk.red('✗')
    case 'warn':
      return chalk.yellow('!')
  }
}

export const outputDoctorReport = (report: DoctorReport, options: DoctorOptions): void => {
  if (options.json) {
    console.log(JSON.stringify(report, null, 2))
    return
  }

  if (options.xml) {
    console.log('<?xml version="1.0" encoding="UTF-8"?>')
    console.log('<doctor_result>')
    console.log(`  <ok>${report.ok}</ok>`)
    if (report.host) console.log(`  <host>${report.host}</host>`)
    if (report.username) console.log(`  <username>${report.username}</username>`)
    if (report.configSource) console.log(`  <config_source>${report.configSource}</config_source>`)
    console.log('  <checks>')
    for (const check of report.checks) {
      console.log('    <check>')
      console.log(`      <name>${check.name}</name>`)
      console.log(`      <label>${check.label}</label>`)
      console.log(`      <status>${check.status}</status>`)
      console.log(`      <message><![CDATA[${check.message}]]></message>`)
      console.log('    </check>')
    }
    console.log('  </checks>')
    console.log('</doctor_result>')
    return
  }

  console.log('')
  console.log(chalk.bold('Gerrit CLI Doctor'))
  console.log(chalk.dim('─'.repeat(50)))
  if (report.host) console.log(`  ${chalk.bold('Host'.padEnd(18))} ${chalk.cyan(report.host)}`)
  if (report.username)
    console.log(`  ${chalk.bold('Username'.padEnd(18))} ${chalk.cyan(report.username)}`)
  if (report.configSource) {
    console.log(`  ${chalk.bold('Config source'.padEnd(18))} ${chalk.dim(report.configSource)}`)
  }
  console.log(chalk.dim('─'.repeat(50)))
  for (const check of report.checks) {
    console.log(`${statusIcon(check.status)} ${chalk.bold(check.label)}: ${check.message}`)
  }
  console.log(chalk.dim('─'.repeat(50)))
  console.log(
    report.ok
      ? chalk.green('Doctor finished without blocking issues.')
      : chalk.red('Doctor found blocking issues. Fix the failed checks above.'),
  )
  console.log('')
}

export function doctorCommand(): Effect.Effect<
  DoctorReport,
  never,
  GerritApiService | CommitHookService | ConfigService
> {
  return Effect.gen(function* () {
    const configService = yield* ConfigService
    const gerritApi = yield* GerritApiService
    const commitHookService = yield* CommitHookService

    return yield* collectDoctorReport({
      getMaskedConfig: configService.getMaskedConfig,
      testConnection: gerritApi.testConnection,
      hasHook: () => commitHookService.hasHook(),
      hasChangeId: (commit) => commitHookService.hasChangeId(commit),
      gitProbe: createGitProbe(),
    })
  })
}
