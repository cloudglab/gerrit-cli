import chalk from 'chalk'
import { Console, Effect } from 'effect'
import { renderInstallSuccessGuide } from '@/cli/banner'
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

export const installCommand = (options: InstallOptions): Effect.Effect<void, InstallError, never> =>
  Effect.gen(function* () {
    yield* Console.log(chalk.dim(`Installing ${PACKAGE_NAME}@latest...`))

    yield* Effect.try({
      try: () => {
        childProcess.execSync(`bun install -g ${PACKAGE_NAME}@latest`, {
          stdio: 'inherit',
          timeout: 60000,
        })
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
