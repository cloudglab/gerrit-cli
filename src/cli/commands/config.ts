import chalk from 'chalk'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { Console, Effect, pipe } from 'effect'
import { GerritApiService } from '@/api/gerrit'
import type { AppConfig } from '@/schemas/config'
import { ConfigService } from '@/services/config'

interface ConfigShowOptions {
  json?: boolean
  xml?: boolean
}

interface ConfigTestOptions {
  json?: boolean
  xml?: boolean
}

const readConfigSafe = (): Effect.Effect<AppConfig, Error, ConfigService> =>
  pipe(
    ConfigService,
    Effect.flatMap((s) => s.getFullConfig),
    Effect.catchTag('ConfigError', (e) => Effect.fail(new Error(e.message))),
  )

const obscureTokens = (secret: string): string =>
  secret.length > 8
    ? `${secret.slice(0, 4)}${'*'.repeat(secret.length - 8)}${secret.slice(-4)}`
    : '****'

const header = (text: string): void => {
  console.log('')
  console.log(chalk.bold(text))
  console.log(chalk.dim('─'.repeat(50)))
}

const footer = (): void => {
  console.log(chalk.dim('─'.repeat(50)))
  console.log('')
}

const printRow = (label: string, value: string, source?: string): void => {
  const sourceTag = source ? chalk.dim(` (${source})`) : ''
  console.log(`  ${chalk.bold(label.padEnd(18))} ${chalk.cyan(value)}${sourceTag}`)
}

const detectSource = (): string => {
  const configFile = join(homedir(), '.gerrit-cli', 'config.json')
  const hasFile = existsSync(configFile)
  const hasEnv =
    process.env.GERRIT_HOST !== undefined ||
    process.env.GERRIT_USERNAME !== undefined ||
    process.env.GERRIT_PASSWORD !== undefined

  if (hasFile && hasEnv) return 'file (env overrides available)'
  if (hasFile) return 'file'
  if (hasEnv) return 'environment'
  return 'unknown'
}

export const configShowCommand = (
  options: ConfigShowOptions,
): Effect.Effect<void, Error, ConfigService> =>
  Effect.gen(function* () {
    const config = yield* readConfigSafe()

    if (options.json) {
      const source = detectSource()
      const output: Record<string, unknown> = {
        status: 'success',
        config_path: `${homedir()}/.gerrit-cli/config.json`,
        config_source: source,
        host: config.host,
        username: config.username,
        has_password: config.password.length > 0,
        has_env_override:
          process.env.GERRIT_HOST !== undefined ||
          process.env.GERRIT_USERNAME !== undefined ||
          process.env.GERRIT_PASSWORD !== undefined,
      }
      console.log(JSON.stringify(output, null, 2))
      return
    }

    if (options.xml) {
      console.log('<?xml version="1.0" encoding="UTF-8"?>')
      console.log('<config>')
      console.log(`  <host>${config.host}</host>`)
      console.log(`  <username>${config.username}</username>`)
      console.log(`  <has_password>${config.password.length > 0}</has_password>`)
      if (config.retriggerComment !== undefined) {
        console.log(`  <retrigger_comment>${config.retriggerComment}</retrigger_comment>`)
      }
      console.log('</config>')
      return
    }

    // Pretty output
    header('Gerrit CLI Configuration')
    const source = detectSource()
    printRow('Host', config.host, source)
    printRow('Username', config.username, source)
    printRow('Password', obscureTokens(config.password), source)
    if (config.retriggerComment !== undefined) {
      printRow('CI comment', config.retriggerComment)
    }
    footer()
    console.log(chalk.dim(`Config path: ${homedir()}/.gerrit-cli/config.json`))
    console.log(chalk.dim(`Config source: ${source}`))
    console.log(chalk.dim('Run gerrit-cli config test to verify your connection'))
    console.log('')
  })

export const configTestCommand = (
  options: ConfigTestOptions,
): Effect.Effect<void, Error, ConfigService | GerritApiService> =>
  Effect.gen(function* () {
    const config = yield* readConfigSafe()

    yield* Console.log(chalk.dim(`Testing connection to ${config.host} as ${config.username}...`))

    const gerritApi = yield* GerritApiService

    const connected = yield* pipe(
      gerritApi.testConnection,
      Effect.catchTag('ApiError', (e) => Effect.fail(new Error(e.message))),
    )

    if (options.json) {
      const output: Record<string, unknown> = {
        status: 'success',
        host: config.host,
        username: config.username,
        connected,
      }
      console.log(JSON.stringify(output, null, 2))
      return
    }

    if (options.xml) {
      console.log('<?xml version="1.0" encoding="UTF-8"?>')
      console.log('<connection_test>')
      console.log(`  <host>${config.host}</host>`)
      console.log(`  <username>${config.username}</username>`)
      console.log(`  <connected>${connected}</connected>`)
      console.log('</connection_test>')
      return
    }

    if (connected) {
      console.log('')
      console.log(chalk.green(`✓ Connected to ${config.host} as ${config.username}`))
      console.log('')
    } else {
      console.log('')
      console.log(chalk.red('✗ Connection failed'))
      console.log(chalk.dim(`  Host: ${config.host}`))
      console.log(chalk.dim(`  User: ${config.username}`))
      console.log(chalk.dim('  Run gerrit-cli setup to reconfigure'))
      console.log('')
    }
  })
