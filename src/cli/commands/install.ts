import { execFileSync } from 'node:child_process'
import { access, mkdtemp, readdir, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import chalk from 'chalk'
import { Console, Effect } from 'effect'
import { renderInstallSuccessGuide } from '@/cli/banner'
import { writeUpdateCacheAfterInstall } from '@/update-probe'

const PACKAGE_NAME = '@cloudglab/gerrit-cli'
const SKILL_NAME = 'gerrit-cli'
const GIT_SKILL_SOURCE = 'cloudglab/gerrit-cli'

type SkillSource = 'local' | 'git' | 'npm'

export interface InstallOptions {
  skipConfigCheck?: boolean
  skillSource?: SkillSource
  skillLocalPath?: string
  cliOnly?: boolean
  skillOnly?: boolean
}

class InstallError extends Error {
  readonly _tag = 'InstallError' as const
  constructor(message: string) {
    super(message)
    this.name = 'InstallError'
  }
}

const isDirectoryNotEmptyError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('ENOTEMPTY') || message.toLowerCase().includes('directory not empty')
}

const runCommand = (command: string, args: readonly string[]): void => {
  execFileSync(command, [...args], { stdio: 'inherit', timeout: 60000 })
}

const runCommandOutput = (command: string, args: readonly string[]): string =>
  execFileSync(command, [...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 60000,
  })

const runStep = (title: string, command: string, args: readonly string[]): void => {
  process.stdout.write(`\n${title}...\n`)
  runCommand(command, args)
}

const cleanupNpxResidues = async (): Promise<void> => {
  const npxCacheDir = path.join(os.homedir(), '.npm', '_npx')
  let entries: string[] = []
  try {
    entries = await readdir(npxCacheDir)
  } catch {
    return
  }

  await Promise.all(
    entries.map(async (entry) => {
      const hashDir = path.join(npxCacheDir, entry)
      const cloudglabDir = path.join(hashDir, 'node_modules', '@cloudglab')
      let cloudglabEntries: string[] = []
      try {
        cloudglabEntries = await readdir(cloudglabDir)
      } catch {
        return
      }

      const hasGerritCli = cloudglabEntries.some(
        (item) => item === SKILL_NAME || item.startsWith(`.${SKILL_NAME}-`),
      )
      if (hasGerritCli) {
        await rm(hashDir, { recursive: true, force: true })
      }
    }),
  )
}

const cleanupGlobalPackageResidues = async (): Promise<void> => {
  const globalNodeModules = runCommandOutput('npm', ['root', '-g']).trim()
  if (globalNodeModules) {
    await rm(path.join(globalNodeModules, PACKAGE_NAME), { recursive: true, force: true })
    const scopeDir = path.join(globalNodeModules, '@cloudglab')
    let entries: string[] = []
    try {
      entries = await readdir(scopeDir)
    } catch {
      // scope 目录不存在时忽略
    }
    await Promise.all(
      entries
        .filter((entry) => entry.startsWith(`.${SKILL_NAME}-`))
        .map((entry) => rm(path.join(scopeDir, entry), { recursive: true, force: true })),
    )
  }

  await cleanupNpxResidues()
}

const runNpxStepWithRetry = async (title: string, args: readonly string[]): Promise<void> => {
  try {
    runStep(title, 'npx', args)
  } catch (error) {
    if (!isDirectoryNotEmptyError(error)) throw error
    process.stdout.write(`\n检测到 npx 缓存目录残留，正在清理后重试 ${title}...\n`)
    await cleanupNpxResidues()
    runStep(title, 'npx', args)
  }
}

const createSkillAddArgs = (source: string): string[] => [
  '-y',
  'skills',
  'add',
  source,
  '--yes',
  '--global',
]

const installGlobalCli = async (action: '安装' | '更新'): Promise<void> => {
  const args = ['install', '-g', `${PACKAGE_NAME}@latest`]
  try {
    await cleanupGlobalPackageResidues()
    runStep(`${action} Gerrit CLI`, 'npm', args)
  } catch (error) {
    if (!isDirectoryNotEmptyError(error)) throw error
    process.stdout.write('\n检测到 npm 全局安装目录残留，正在清理后重试...\n')
    await cleanupGlobalPackageResidues()
    runStep(`${action} Gerrit CLI`, 'npm', args)
  }
}

const getInstalledPackageSkillPath = (): string => {
  const globalNodeModules = runCommandOutput('npm', ['root', '-g']).trim()
  if (!globalNodeModules) {
    throw new Error('npm root -g 没有返回全局 node_modules 路径')
  }
  return path.join(globalNodeModules, PACKAGE_NAME, 'skills', SKILL_NAME)
}

const installSkillFromInstalledPackage = async (action: '安装' | '更新'): Promise<void> => {
  const skillPath = getInstalledPackageSkillPath()
  try {
    await access(skillPath)
  } catch {
    throw new Error(
      `未找到已安装包内的 Gerrit skill：${skillPath}。可重试 --skill-source npm 或 --skill-source git。`,
    )
  }

  await runNpxStepWithRetry(`${action} Gerrit skill`, createSkillAddArgs(skillPath))
}

const installSkillFromNpmPackage = async (action: '安装' | '更新'): Promise<void> => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'gerrit-cli-skill-'))
  try {
    const stdout = runCommandOutput('npm', [
      'pack',
      `${PACKAGE_NAME}@latest`,
      '--pack-destination',
      tempDir,
      '--silent',
    ])
    const tarballName = stdout.trim().split('\n').filter(Boolean).at(-1)
    if (!tarballName) throw new Error('npm pack 没有返回包文件名')

    runStep('解压 Gerrit npm 包', 'tar', ['-xzf', path.join(tempDir, tarballName), '-C', tempDir])
    await runNpxStepWithRetry(
      `${action} Gerrit skill`,
      createSkillAddArgs(path.join(tempDir, 'package')),
    )
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}

const installSkill = async (action: '安装' | '更新', options: InstallOptions): Promise<void> => {
  if (options.skillLocalPath) {
    await runNpxStepWithRetry(
      `${action} Gerrit skill`,
      createSkillAddArgs(path.resolve(options.skillLocalPath)),
    )
    return
  }

  if ((options.skillSource ?? 'local') === 'local') {
    await installSkillFromInstalledPackage(action)
    return
  }

  if (options.skillSource === 'git') {
    await runNpxStepWithRetry(`${action} Gerrit skill`, createSkillAddArgs(GIT_SKILL_SOURCE))
    return
  }

  await installSkillFromNpmPackage(action)
}

const installPackageAndSkill = async (
  action: '安装' | '更新',
  options: InstallOptions,
): Promise<void> => {
  if (options.cliOnly && options.skillOnly) {
    throw new Error('--cli-only 和 --skill-only 不能同时使用')
  }
  if (!options.skillOnly) await installGlobalCli(action)
  if (!options.cliOnly) await installSkill(action, options)
  writeUpdateCacheAfterInstall()
}

export const installCommand = (options: InstallOptions): Effect.Effect<void, InstallError, never> =>
  Effect.gen(function* () {
    yield* Effect.tryPromise({
      try: () => installPackageAndSkill('安装', options),
      catch: (e) =>
        new InstallError(`Install failed: ${e instanceof Error ? e.message : String(e)}`),
    })

    const status = options.skipConfigCheck
      ? '已跳过 Gerrit 配置校验。'
      : '接下来请运行 gerrit setup 完成配置。'
    yield* Console.log('')
    yield* Console.log(chalk.green(renderInstallSuccessGuide('安装', status)))
  })

export const updateCommand = (options: InstallOptions): Effect.Effect<void, InstallError, never> =>
  Effect.gen(function* () {
    yield* Effect.tryPromise({
      try: () => installPackageAndSkill('更新', options),
      catch: (e) =>
        new InstallError(`Update failed: ${e instanceof Error ? e.message : String(e)}`),
    })

    const status = options.skipConfigCheck
      ? '已跳过 Gerrit 配置校验。'
      : '如需检查配置，请运行 gerrit doctor 或 gerrit whoami。'
    yield* Console.log('')
    yield* Console.log(chalk.green(renderInstallSuccessGuide('更新', status)))
  })
