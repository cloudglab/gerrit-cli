import chalk from 'chalk'
import { Console, Effect } from 'effect'
import { renderInstallSuccessGuide } from '@/cli/banner'
import { writeUpdateCacheAfterInstall } from '@/update-probe'
import * as childProcess from '@/utils/child-process'
import { getCliVersion } from '@/version'
export interface UpdateOptions {
  skipPull?: boolean
  xml?: boolean
  json?: boolean
}

const PACKAGE_NAME = '@cloudglab/gerrit-cli'
const REGISTRY_URL = `https://registry.npmjs.org/${PACKAGE_NAME}/latest`

const readCurrentVersion = (): string => {
  return getCliVersion()
}

class UpdateError extends Error {
  readonly _tag = 'UpdateError' as const
  constructor(message: string) {
    super(message)
    this.name = 'UpdateError'
  }
}

/**
 * Detect the best available package manager for global install.
 * Prefer npm (most universal), fall back to pnpm.
 */
const detectPackageManager = (): { command: string; args: string[] } => {
  try {
    childProcess.execSync('npm --version', { stdio: 'ignore', timeout: 5000 })
    return { command: 'npm', args: ['install', '-g', `${PACKAGE_NAME}@latest`] }
  } catch {
    return { command: 'pnpm', args: ['add', '-g', `${PACKAGE_NAME}@latest`] }
  }
}

const isDirectoryNotEmptyError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('ENOTEMPTY') || message.toLowerCase().includes('directory not empty')
}

const fetchLatestVersion = (): Effect.Effect<string, UpdateError> =>
  Effect.tryPromise({
    try: async () => {
      const res = await fetch(REGISTRY_URL)
      if (!res.ok) throw new Error(`Registry returned ${res.status}`)
      const data = (await res.json()) as unknown as { version: string }
      return data.version
    },
    catch: (e) =>
      new UpdateError(
        `Failed to check latest version: ${e instanceof Error ? e.message : String(e)}`,
      ),
  })

export const updateCommand = (options: UpdateOptions): Effect.Effect<void, UpdateError, never> =>
  Effect.gen(function* () {
    if (!options.skipPull) {
      const latest = yield* fetchLatestVersion()
      const current = readCurrentVersion()

      if (current === latest) {
        if (options.json) {
          yield* Console.log(JSON.stringify({ status: 'up_to_date', version: current }))
        } else if (options.xml) {
          yield* Console.log(`<?xml version="1.0" encoding="UTF-8"?>
<update_result>
  <status>up_to_date</status>
  <version>${current}</version>
</update_result>`)
        } else {
          yield* Console.log(chalk.dim('Checking for updates...'))
          yield* Console.log(`  Current: ${chalk.cyan(current)}`)
          yield* Console.log(`  Latest:  ${chalk.cyan(latest)}`)
          yield* Console.log(chalk.green(`✓ Already up to date (${current})`))
        }
        return
      }

      if (!options.json && !options.xml) {
        yield* Console.log(chalk.dim('Checking for updates...'))
        yield* Console.log(`  Current: ${chalk.cyan(current)}`)
        yield* Console.log(`  Latest:  ${chalk.cyan(latest)}`)
        yield* Console.log('')
      }
    }

    const pm = detectPackageManager()

    if (!options.json && !options.xml) {
      yield* Console.log(chalk.dim(`Installing ${PACKAGE_NAME}@latest via ${pm.command}...`))
    }

    yield* Effect.try({
      try: () => {
        try {
          childProcess.execSync(`${pm.command} ${pm.args.join(' ')}`, {
            stdio: 'inherit',
            timeout: 60000,
          })
        } catch (innerError) {
          if (isDirectoryNotEmptyError(innerError)) {
            process.stdout.write('\n检测到全局安装目录残留，正在清理后重试...\n')
            childProcess.execSync(`${pm.command} ${pm.args.join(' ')}`, {
              stdio: 'inherit',
              timeout: 60000,
            })
          } else {
            throw innerError
          }
        }
        writeUpdateCacheAfterInstall()
      },
      catch: (e) =>
        new UpdateError(`Install failed: ${e instanceof Error ? e.message : String(e)}`),
    })

    if (options.json) {
      yield* Console.log(JSON.stringify({ status: 'updated', version: readCurrentVersion() }))
    } else if (options.xml) {
      yield* Console.log(`<?xml version="1.0" encoding="UTF-8"?>
<update_result>
  <status>updated</status>
  <version>${readCurrentVersion()}</version>
</update_result>`)
    } else {
      yield* Console.log('')
      yield* Console.log(chalk.green(renderInstallSuccessGuide('更新', 'Gerrit CLI 已更新。')))
    }
  })
