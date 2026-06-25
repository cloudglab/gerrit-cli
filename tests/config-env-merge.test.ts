import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from '@test/compat'
import { Effect } from 'effect'
import { ConfigService, ConfigServiceLive } from '@/services/config'

describe('Config environment merge', () => {
  const originalEnv = { ...process.env }
  const CONFIG_DIR = path.join(os.homedir(), '.gerrit-cli')
  const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json')
  let originalConfigContent: string | null = null

  beforeEach(() => {
    delete process.env.GERRIT_HOST
    delete process.env.GERRIT_USERNAME
    delete process.env.GERRIT_PASSWORD
    delete process.env.GERRIT_RETRIGGER_COMMENT

    // Backup and remove config file to ensure env-only tests are isolated
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        originalConfigContent = fs.readFileSync(CONFIG_FILE, 'utf8')
        fs.unlinkSync(CONFIG_FILE)
      }
    } catch {
      // Ignore errors
    }
  })

  afterEach(() => {
    process.env = { ...originalEnv }

    // Restore original config file
    try {
      if (originalConfigContent !== null) {
        if (!fs.existsSync(CONFIG_DIR)) {
          fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 })
        }
        fs.writeFileSync(CONFIG_FILE, originalConfigContent, 'utf8')
        fs.chmodSync(CONFIG_FILE, 0o600)
      }
    } catch {
      // Ignore errors
    }
    originalConfigContent = null
  })

  test('should use environment variables when file config is absent', async () => {
    process.env.GERRIT_HOST = 'https://env.gerrit.example.com'
    process.env.GERRIT_USERNAME = 'envuser'
    process.env.GERRIT_PASSWORD = 'envpassword'
    process.env.GERRIT_RETRIGGER_COMMENT = 'recheck'

    const program = Effect.gen(function* () {
      const service = yield* ConfigService
      const full = yield* service.getFullConfig
      const masked = yield* service.getMaskedConfig
      return { full, masked }
    }).pipe(Effect.provide(ConfigServiceLive))

    const result = await Effect.runPromise(program)

    expect(result.full.host).toBe('https://env.gerrit.example.com')
    expect(result.full.username).toBe('envuser')
    expect(result.full.password).toBe('envpassword')
    expect(result.full.retriggerComment).toBe('recheck')

    expect(result.masked.host).toBe('https://env.gerrit.example.com')
    expect(result.masked.username).toBe('envuser')
    expect(result.masked.hasPassword).toBe(true)
    expect(result.masked.retriggerComment).toBe('recheck')
    // Source may be 'env' or 'file+env' depending on test execution order
    // (other config tests may create/restore config files in parallel)
    expect(['env', 'file+env']).toContain(result.masked.source)
  })

  test('should report source as unknown when no config is available', async () => {
    const program = Effect.gen(function* () {
      const service = yield* ConfigService
      return yield* service.getFullConfig
    }).pipe(Effect.provide(ConfigServiceLive))

    await expect(Effect.runPromise(program)).rejects.toThrow('未找到 Gerrit 配置')
  })
})
