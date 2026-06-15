import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import chalk from 'chalk'
import { Console, Effect } from 'effect'
import * as childProcess from '@/utils/child-process'

const PACKAGE_NAME = '@cloudglab/gerrit-cli'
const CONFIG_DIR = path.join(os.homedir(), '.gerrit-cli')

export interface UninstallOptions {
  confirm?: boolean
  keepConfig?: boolean
  removeConfig?: boolean
}

class UninstallError extends Error {
  readonly _tag = 'UninstallError' as const
  constructor(message: string) {
    super(message)
    this.name = 'UninstallError'
  }
}

function renderUninstallPreview(options: UninstallOptions): string {
  const configStep = options.removeConfig
    ? '删除 ~/.gerrit-cli 配置目录（含凭据）'
    : options.keepConfig
      ? '保留 ~/.gerrit-cli 配置目录'
      : '保留 ~/.gerrit-cli 配置目录（默认不自动删除）'

  return `卸载预览：
  - 卸载全局 CLI 包 ${PACKAGE_NAME}
  - ${configStep}

真实执行请运行：
  gerrit uninstall --confirm
  bunx ${PACKAGE_NAME}@latest uninstall --confirm

可选参数：
  --keep-config      保留配置说明并跳过后续清理提示
  --remove-config    删除 ~/.gerrit-cli 配置目录（含凭据）`
}

const removeConfigDir = (): void => {
  try {
    if (fs.existsSync(CONFIG_DIR)) {
      fs.rmSync(CONFIG_DIR, { recursive: true, force: true })
    }
  } catch {
    // Ignore cleanup errors
  }
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

    if (options.removeConfig) {
      removeConfigDir()
      yield* Console.log(chalk.green(`✓ 已删除配置目录 ${CONFIG_DIR}`))
    } else if (!options.keepConfig) {
      yield* Console.log(
        chalk.dim(`提示：${CONFIG_DIR} 配置目录仍保留，如需删除请使用 --remove-config。`),
      )
    }
  })
