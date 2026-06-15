import chalk from 'chalk'
import { Effect } from 'effect'
import { ApiError, GerritApiService } from '@/api/gerrit'
import { ConfigError, ConfigService, type ConfigServiceImpl } from '@/services/config'

interface WhoamiOptions {
  json?: boolean
  xml?: boolean
}

const formatSource = (source: string): string => {
  switch (source) {
    case 'file':
      return 'file'
    case 'env':
      return 'environment variables'
    case 'file+env':
      return 'file (with environment overrides)'
    default:
      return 'unknown'
  }
}

const whoamiEffect = (
  configService: ConfigServiceImpl,
  options: WhoamiOptions,
): Effect.Effect<void, ConfigError | ApiError, GerritApiService> =>
  Effect.gen(function* () {
    const masked = yield* configService.getMaskedConfig
    const gerritApi = yield* GerritApiService
    const connected = yield* gerritApi.testConnection

    if (options.json) {
      console.log(
        JSON.stringify(
          {
            status: connected ? 'success' : 'error',
            host: masked.host,
            username: masked.username,
            connected,
            config_source: masked.source,
            config_path: masked.configPath,
            has_password: masked.hasPassword,
            retrigger_comment: masked.retriggerComment,
          },
          null,
          2,
        ),
      )
      if (!connected) {
        return yield* Effect.fail(new ConfigError({ message: 'Authentication failed' }))
      }
      return
    }

    if (options.xml) {
      console.log('<?xml version="1.0" encoding="UTF-8"?>')
      console.log('<whoami>')
      console.log(`  <host>${masked.host}</host>`)
      console.log(`  <username>${masked.username}</username>`)
      console.log(`  <connected>${connected}</connected>`)
      console.log(`  <config_source>${masked.source}</config_source>`)
      console.log(`  <config_path>${masked.configPath}</config_path>`)
      console.log(`  <has_password>${masked.hasPassword}</has_password>`)
      if (masked.retriggerComment !== undefined) {
        console.log(`  <retrigger_comment>${masked.retriggerComment}</retrigger_comment>`)
      }
      console.log('</whoami>')
      if (!connected) {
        return yield* Effect.fail(new ConfigError({ message: 'Authentication failed' }))
      }
      return
    }

    console.log('')
    console.log(chalk.bold('Gerrit CLI Identity'))
    console.log(chalk.dim('─'.repeat(50)))
    console.log(`  ${chalk.bold('Host'.padEnd(18))} ${chalk.cyan(masked.host)}`)
    console.log(`  ${chalk.bold('Username'.padEnd(18))} ${chalk.cyan(masked.username)}`)
    console.log(
      `  ${chalk.bold('Password'.padEnd(18))} ${masked.hasPassword ? chalk.green('configured') : chalk.red('missing')}`,
    )
    if (masked.retriggerComment !== undefined) {
      console.log(`  ${chalk.bold('CI comment'.padEnd(18))} ${chalk.cyan(masked.retriggerComment)}`)
    }
    console.log(
      `  ${chalk.bold('Config source'.padEnd(18))} ${chalk.dim(formatSource(masked.source))}`,
    )
    console.log(`  ${chalk.bold('Config path'.padEnd(18))} ${chalk.dim(masked.configPath)}`)
    console.log(
      `  ${chalk.bold('Connection'.padEnd(18))} ${connected ? chalk.green('authenticated') : chalk.red('failed')}`,
    )
    console.log(chalk.dim('─'.repeat(50)))
    console.log('')

    if (!connected) {
      return yield* Effect.fail(new ConfigError({ message: 'Authentication failed' }))
    }
  })

export function whoamiCommand(
  options: WhoamiOptions,
): Effect.Effect<void, ConfigError | ApiError, GerritApiService | ConfigService> {
  return Effect.gen(function* () {
    const configService = yield* ConfigService
    yield* whoamiEffect(configService, options)
  })
}
