import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import chalk from 'chalk'
import { Console, Effect } from 'effect'
import * as childProcess from '@/utils/child-process'

const PACKAGE_NAME = '@cloudglab/gerrit-cli'
const SKILL_NAME = 'gerrit-cli'
const CONFIG_DIR = path.join(os.homedir(), '.gerrit-cli')

export interface UninstallOptions {
  confirm?: boolean
  keepConfig?: boolean
  removeConfig?: boolean
  cliOnly?: boolean
  skillOnly?: boolean
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
  const steps = [
    ...(!options.cliOnly ? ['卸载 gerrit-cli skill（项目级和全局级）'] : []),
    ...(!options.skillOnly ? [`卸载全局 CLI 包 ${PACKAGE_NAME} 并清理 npm/npx 残留`] : []),
    configStep,
  ]

  return `卸载预览：
${steps.map((step) => `  - ${step}`).join('\n')}

真实执行请运行：
  gerrit uninstall --confirm
  npx -y ${PACKAGE_NAME}@latest uninstall --confirm

可选参数：
  --keep-config      保留配置说明并跳过后续清理提示
  --remove-config    删除 ~/.gerrit-cli 配置目录（含凭据）
  --cli-only         只卸载 CLI
  --skill-only       只卸载 skill`
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

const isDirectoryNotEmptyError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('ENOTEMPTY') || message.toLowerCase().includes('directory not empty')
}

const runCommand = (command: string, args: readonly string[]): void => {
  childProcess.execFileSync(command, [...args], { stdio: 'inherit', timeout: 60000 })
}

const runCommandOutput = (command: string, args: readonly string[]): string =>
  childProcess.execFileSync(command, [...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 60000,
  })

const runStep = (title: string, command: string, args: readonly string[]): void => {
  process.stdout.write(`\n${title}...\n`)
  runCommand(command, args)
}

const cleanupNpxResidues = (): void => {
  const npxCacheDir = path.join(os.homedir(), '.npm', '_npx')
  let entries: string[] = []
  try {
    entries = fs.readdirSync(npxCacheDir)
  } catch {
    return
  }

  for (const entry of entries) {
    const hashDir = path.join(npxCacheDir, entry)
    const cloudglabDir = path.join(hashDir, 'node_modules', '@cloudglab')
    let cloudglabEntries: string[] = []
    try {
      cloudglabEntries = fs.readdirSync(cloudglabDir)
    } catch {
      continue
    }

    const hasGerritCli = cloudglabEntries.some(
      (item) => item === SKILL_NAME || item.startsWith(`.${SKILL_NAME}-`),
    )
    if (hasGerritCli) {
      fs.rmSync(hashDir, { recursive: true, force: true })
    }
  }
}

const cleanupGlobalPackageResidues = (): void => {
  const globalNodeModules = runCommandOutput('npm', ['root', '-g']).trim()
  if (globalNodeModules) {
    fs.rmSync(path.join(globalNodeModules, PACKAGE_NAME), { recursive: true, force: true })
    const scopeDir = path.join(globalNodeModules, '@cloudglab')
    let entries: string[] = []
    try {
      entries = fs.readdirSync(scopeDir)
    } catch {
      // scope 目录不存在时忽略
    }
    for (const entry of entries.filter((item) => item.startsWith(`.${SKILL_NAME}-`))) {
      fs.rmSync(path.join(scopeDir, entry), { recursive: true, force: true })
    }
  }

  cleanupNpxResidues()
}

const runNpxStepWithRetry = (title: string, args: readonly string[]): void => {
  try {
    runStep(title, 'npx', args)
  } catch (error) {
    if (!isDirectoryNotEmptyError(error)) throw error
    process.stdout.write(`\n检测到 npx 缓存目录残留，正在清理后重试 ${title}...\n`)
    cleanupNpxResidues()
    runStep(title, 'npx', args)
  }
}

const createSkillRemoveArgs = (global = false): string[] => [
  '-y',
  'skills',
  'remove',
  SKILL_NAME,
  '--yes',
  ...(global ? ['--global'] : []),
]

const uninstallSkill = (): void => {
  runNpxStepWithRetry('卸载项目级 gerrit-cli skill', createSkillRemoveArgs(false))
  runNpxStepWithRetry('卸载全局级 gerrit-cli skill', createSkillRemoveArgs(true))
}

const uninstallPackage = (): void => {
  runStep('卸载 Gerrit CLI', 'npm', ['uninstall', '-g', PACKAGE_NAME])
  cleanupGlobalPackageResidues()
}

export const uninstallCommand = (
  options: UninstallOptions,
): Effect.Effect<void, UninstallError, never> =>
  Effect.gen(function* () {
    if (options.cliOnly && options.skillOnly) {
      return yield* Effect.fail(new UninstallError('--cli-only 和 --skill-only 不能同时使用'))
    }

    if (!options.confirm) {
      yield* Console.log(renderUninstallPreview(options))
      return
    }

    yield* Effect.try({
      try: () => {
        if (!options.cliOnly) uninstallSkill()
        if (!options.skillOnly) uninstallPackage()
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
