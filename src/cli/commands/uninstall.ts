import chalk from 'chalk'
import { Console, Effect } from 'effect'
import * as childProcess from '@/utils/child-process'

const PACKAGE_NAME = '@cloudglab/gerrit-cli'

export interface UninstallOptions {
  confirm?: boolean
  keepConfig?: boolean
}

class UninstallError extends Error {
  readonly _tag = 'UninstallError' as const
  constructor(message: string) {
    super(message)
    this.name = 'UninstallError'
  }
}

function renderUninstallPreview(options: UninstallOptions): string {
  const configStep = options.keepConfig
    ? '保留 ~/.gerrit-cli 配置目录'
    : '保留 ~/.gerrit-cli 配置目录（当前实现默认不自动删除）'

  return `卸载预览：
  - 卸载全局 CLI 包 ${PACKAGE_NAME}
  - ${configStep}

真实执行请运行：
  gerrit uninstall --confirm
  bunx ${PACKAGE_NAME}@latest uninstall --confirm

可选参数：
  --keep-config    保留配置说明并跳过后续清理提示`
}

export const uninstallCommand = (
  options: UninstallOptions,
): Effect.Effect<void, UninstallError, never> =>
  Effect.gen(function* () {
    if (!options.confirm) {
      yield* Console.log(renderUninstallPreview(options))
      return
    }

    yield* Effect.try({
      try: () => {
        childProcess.execSync(`bun remove -g ${PACKAGE_NAME}`, {
          stdio: 'inherit',
          timeout: 60000,
        })
      },
      catch: (e) =>
        new UninstallError(`Uninstall failed: ${e instanceof Error ? e.message : String(e)}`),
    })

    yield* Console.log('')
    yield* Console.log(chalk.green('卸载完成。'))
    if (!options.keepConfig) {
      yield* Console.log(chalk.dim('提示：~/.gerrit-cli 配置目录仍保留，如需删除请手动清理。'))
    }
  })
