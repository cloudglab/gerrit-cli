import chalk from 'chalk'
import { Console, Effect } from 'effect'
import { renderInstallSuccessGuide } from '@/cli/banner'
import { writeUpdateCacheAfterInstall } from '@/update-probe'
import * as childProcess from '@/utils/child-process'

const PACKAGE_NAME = '@cloudglab/gerrit-cli'

export interface InstallOptions {
  skipConfigCheck?: boolean
}

class InstallError extends Error {
  readonly _tag = 'InstallError' as const
  constructor(message: string) {
    super(message)
    this.name = 'InstallError'
  }
}

/**
 * Detect the best available package manager for global install.
 * Prefer npm (most universal), fall back to bun.
 */
const detectPackageManager = (): { command: string; args: string[] } => {
  try {
    childProcess.execSync('npm --version', { stdio: 'ignore', timeout: 5000 })
    return { command: 'npm', args: ['install', '-g', `${PACKAGE_NAME}@latest`] }
  } catch {
    // npm not available, try bun
    return { command: 'bun', args: ['install', '-g', `${PACKAGE_NAME}@latest`] }
  }
}

/**
 * Check if an error indicates npm directory not empty (ENOTEMPTY) residue.
 */
const isDirectoryNotEmptyError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('ENOTEMPTY') || message.toLowerCase().includes('directory not empty')
}

export const installCommand = (options: InstallOptions): Effect.Effect<void, InstallError, never> =>
  Effect.gen(function* () {
    const pm = detectPackageManager()
    yield* Console.log(chalk.dim(`Installing ${PACKAGE_NAME}@latest via ${pm.command}...`))

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
        new InstallError(`Install failed: ${e instanceof Error ? e.message : String(e)}`),
    })

    const status = options.skipConfigCheck
      ? '已跳过 Gerrit 配置校验。'
      : '接下来请运行 gerrit setup 完成配置。'
    yield* Console.log('')
    yield* Console.log(chalk.green(renderInstallSuccessGuide('安装', status)))
  })
