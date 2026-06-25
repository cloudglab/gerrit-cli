import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { Schema } from '@effect/schema'
import { Context, Effect, Layer } from 'effect'
import { AppConfig, migrateFromNestedConfig } from '@/schemas/config'
import { GerritCredentials } from '@/schemas/gerrit'

export type ConfigSource = 'file' | 'env' | 'file+env' | 'unknown'

export interface MaskedAppConfig {
  readonly host: string
  readonly username: string
  readonly hasPassword: boolean
  readonly retriggerComment?: string
  readonly source: ConfigSource
  readonly configPath: string
}

export interface ConfigServiceImpl {
  readonly getCredentials: Effect.Effect<GerritCredentials, ConfigError>
  readonly saveCredentials: (credentials: GerritCredentials) => Effect.Effect<void, ConfigError>
  readonly deleteCredentials: Effect.Effect<void, ConfigError>
  readonly getFullConfig: Effect.Effect<AppConfig, ConfigError>
  readonly saveFullConfig: (config: AppConfig) => Effect.Effect<void, ConfigError>
  readonly getMaskedConfig: Effect.Effect<MaskedAppConfig, ConfigError>
  readonly getRetriggerComment: Effect.Effect<string | undefined, ConfigError>
  readonly saveRetriggerComment: (comment: string) => Effect.Effect<void, ConfigError>
}

// Export both the tag value and the type for use in Effect requirements
export const ConfigService: Context.Tag<ConfigServiceImpl, ConfigServiceImpl> =
  Context.GenericTag<ConfigServiceImpl>('ConfigService')
export type ConfigService = Context.Tag.Identifier<typeof ConfigService>

// Export ConfigError fields interface explicitly
export interface ConfigErrorFields {
  readonly message: string
}

// Define error schema (not exported, so type can be implicit)
const ConfigErrorSchema = Schema.TaggedError<ConfigErrorFields>()('ConfigError', {
  message: Schema.String,
} as const) as unknown

// Export the error class with explicit constructor signature for isolatedDeclarations
export class ConfigError
  extends (ConfigErrorSchema as new (
    args: ConfigErrorFields,
  ) => ConfigErrorFields & Error & { readonly _tag: 'ConfigError' })
  implements Error
{
  readonly name = 'ConfigError'
}

// File-based storage
const CONFIG_DIR = path.join(os.homedir(), '.gerrit-cli')
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json')

type EnvConfigValues = {
  host?: string
  username?: string
  password?: string
  retriggerComment?: string
}

const readEnvConfig = (): EnvConfigValues | null => {
  const { GERRIT_HOST, GERRIT_USERNAME, GERRIT_PASSWORD, GERRIT_RETRIGGER_COMMENT } = process.env
  const partial: EnvConfigValues = {}

  if (GERRIT_HOST) partial.host = GERRIT_HOST
  if (GERRIT_USERNAME) partial.username = GERRIT_USERNAME
  if (GERRIT_PASSWORD) partial.password = GERRIT_PASSWORD
  if (GERRIT_RETRIGGER_COMMENT) partial.retriggerComment = GERRIT_RETRIGGER_COMMENT

  return Object.keys(partial).length > 0 ? partial : null
}

const readFileConfig = (): unknown | null => {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const content = fs.readFileSync(CONFIG_FILE, 'utf8')
      const parsed = JSON.parse(content)

      // Check if this is the old nested format and migrate if needed
      if (parsed && typeof parsed === 'object' && 'credentials' in parsed) {
        // Migrate from nested format to flat format with validation
        const migrated = migrateFromNestedConfig(parsed)

        // Save the migrated config immediately
        try {
          writeFileConfig(migrated)
        } catch (error) {
          // Log migration write failure but continue to return migrated config
          console.warn('Warning: Failed to save migrated config to disk:', error)
          // Config migration succeeded in memory, user can still proceed
        }

        return migrated
      }

      return parsed
    }
  } catch {
    // Ignore errors
  }
  return null
}

const writeFileConfig = (config: AppConfig): void => {
  // Ensure config directory exists
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 })
  }

  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8')
  // Set restrictive permissions
  fs.chmodSync(CONFIG_FILE, 0o600)
}

const deleteFileConfig = (): void => {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      fs.unlinkSync(CONFIG_FILE)
    }
  } catch {
    // Ignore errors
  }
}

const fileConfigExists = (): boolean => fs.existsSync(CONFIG_FILE)

const buildConfigSource = (hasFile: boolean, hasEnv: boolean): ConfigSource => {
  if (hasFile && hasEnv) return 'file+env'
  if (hasFile) return 'file'
  if (hasEnv) return 'env'
  return 'unknown'
}

export const maskConfig = (config: AppConfig, source: ConfigSource): MaskedAppConfig => ({
  host: config.host,
  username: config.username,
  hasPassword: config.password.length > 0,
  retriggerComment: config.retriggerComment,
  source,
  configPath: CONFIG_FILE,
})

export const ConfigServiceLive: Layer.Layer<ConfigService, never, never> = Layer.effect(
  ConfigService,
  Effect.sync(() => {
    const decodeConfig = (input: unknown, sourceLabel: string) =>
      Schema.decodeUnknown(AppConfig)(input).pipe(
        Effect.mapError((cause) => {
          const detail = cause instanceof Error ? cause.message : String(cause)
          return new ConfigError({
            message: `配置文件损坏，请检查 ${CONFIG_FILE}：${detail} (${sourceLabel})`,
          })
        }),
      )

    const getFullConfig = Effect.gen(function* () {
      const fileRaw = readFileConfig()
      const envValues = readEnvConfig()
      const hasFile = fileRaw !== null
      const hasEnv = envValues !== null

      if (!hasFile && !hasEnv) {
        return yield* Effect.fail(
          new ConfigError({
            message:
              '未找到 Gerrit 配置。请运行 `gerrit-cli setup` 写入凭据，或设置 GERRIT_HOST、GERRIT_USERNAME、GERRIT_PASSWORD 环境变量。',
          }),
        )
      }

      let merged: Partial<AppConfig> = {}
      if (fileRaw !== null) {
        const fileConfig = yield* decodeConfig(fileRaw, 'file')
        merged = fileConfig
      }
      if (envValues !== null) {
        merged = { ...merged, ...envValues }
      }

      return yield* decodeConfig(merged, 'merged')
    })

    const getConfigSource = Effect.sync(() =>
      buildConfigSource(fileConfigExists(), readEnvConfig() !== null),
    )

    const getMaskedConfig = Effect.gen(function* () {
      const config = yield* getFullConfig
      const source = yield* getConfigSource
      return maskConfig(config, source)
    })

    const saveFullConfig = (config: AppConfig) =>
      Effect.gen(function* () {
        // Validate config using schema
        const validatedConfig = yield* Schema.decodeUnknown(AppConfig)(config).pipe(
          Effect.mapError(
            (cause) => new ConfigError({ message: `配置格式无效：${String(cause)}` }),
          ),
        )

        try {
          writeFileConfig(validatedConfig)
        } catch {
          yield* Effect.fail(new ConfigError({ message: '保存配置到文件失败' }))
        }
      })

    const getCredentials = Effect.gen(function* () {
      const config = yield* getFullConfig
      return {
        host: config.host,
        username: config.username,
        password: config.password,
      }
    })

    const saveCredentials = (credentials: GerritCredentials) =>
      Effect.gen(function* () {
        // Validate credentials using schema
        const validatedCredentials = yield* Schema.decodeUnknown(GerritCredentials)(
          credentials,
        ).pipe(
          Effect.mapError(
            (cause) => new ConfigError({ message: `凭据格式无效：${String(cause)}` }),
          ),
        )

        // Get existing config or create new one
        const existingConfig = yield* getFullConfig.pipe(
          Effect.orElseSucceed(() => {
            const defaultConfig = {
              host: validatedCredentials.host,
              username: validatedCredentials.username,
              password: validatedCredentials.password,
            }
            return Schema.decodeUnknownSync(AppConfig)(defaultConfig)
          }),
        )

        // Update credentials in flat config
        const updatedConfig: AppConfig = {
          ...existingConfig,
          host: validatedCredentials.host,
          username: validatedCredentials.username,
          password: validatedCredentials.password,
        }

        yield* saveFullConfig(updatedConfig)
      })

    const deleteCredentials = Effect.gen(function* () {
      try {
        deleteFileConfig()
        yield* Effect.void
      } catch {
        // Ignore errors
        yield* Effect.void
      }
    })

    const getRetriggerComment = Effect.gen(function* () {
      const config = yield* getFullConfig.pipe(Effect.orElseSucceed(() => null))
      return config?.retriggerComment
    })

    const saveRetriggerComment = (comment: string) =>
      Effect.gen(function* () {
        const existingConfig = yield* getFullConfig
        yield* saveFullConfig({ ...existingConfig, retriggerComment: comment })
      })

    return {
      getCredentials,
      saveCredentials,
      deleteCredentials,
      getFullConfig,
      saveFullConfig,
      getMaskedConfig,
      getRetriggerComment,
      saveRetriggerComment,
    }
  }),
)
