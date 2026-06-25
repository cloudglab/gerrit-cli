import '@test/undici-mock'

import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  mock,
} from '@test/compat'
import { Effect, Layer } from 'effect'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { GerritApiServiceLive } from '@/api/gerrit'
import { whoamiCommand } from '@/cli/commands/whoami'
import { ConfigService } from '@/services/config'
import { createMockConfigService } from './helpers/config-mock'

const server = setupServer(
  http.get('*/a/accounts/self', ({ request }) => {
    const auth = request.headers.get('Authorization')
    if (!auth || !auth.startsWith('Basic ')) {
      return HttpResponse.text('Unauthorized', { status: 401 })
    }
    return HttpResponse.json({
      _account_id: 1000,
      name: 'Test User',
      email: 'test@example.com',
    })
  }),
)

describe('whoami command', () => {
  let mockConsoleLog: ReturnType<typeof mock>
  let mockConsoleError: ReturnType<typeof mock>

  beforeAll(() => {
    server.listen({ onUnhandledRequest: 'bypass' })
  })

  afterAll(() => {
    server.close()
  })

  beforeEach(() => {
    mockConsoleLog = mock(() => {})
    mockConsoleError = mock(() => {})
    console.log = mockConsoleLog
    console.error = mockConsoleError
  })

  afterEach(() => {
    server.resetHandlers()
  })

  it('should show identity when authenticated', async () => {
    const mockConfigLayer = Layer.succeed(ConfigService, createMockConfigService())
    const program = whoamiCommand({}).pipe(
      Effect.provide(GerritApiServiceLive),
      Effect.provide(mockConfigLayer),
    )

    await Effect.runPromise(program)

    const output = mockConsoleLog.mock.calls.map((call) => call[0]).join('\n')
    expect(output).toContain('Gerrit CLI Identity')
    expect(output).toContain('https://test.gerrit-clirit.com')
    expect(output).toContain('testuser')
    expect(output).toContain('authenticated')
  })

  it('should output JSON when --json is used', async () => {
    const mockConfigLayer = Layer.succeed(
      ConfigService,
      createMockConfigService({
        host: 'https://json.gerrit.example.com',
        username: 'jsonuser',
        password: 'jsonpass',
      }),
    )
    const program = whoamiCommand({ json: true }).pipe(
      Effect.provide(GerritApiServiceLive),
      Effect.provide(mockConfigLayer),
    )

    await Effect.runPromise(program)

    const output = mockConsoleLog.mock.calls.map((call) => call[0]).join('\n')
    const parsed = JSON.parse(output)
    expect(parsed.host).toBe('https://json.gerrit.example.com')
    expect(parsed.username).toBe('jsonuser')
    expect(parsed.connected).toBe(true)
    expect(parsed.config_source).toBe('file')
    expect(parsed.has_password).toBe(true)
  })

  it('should fail when authentication fails', async () => {
    server.use(
      http.get('*/a/accounts/self', () => {
        return HttpResponse.text('Unauthorized', { status: 401 })
      }),
    )

    const mockConfigLayer = Layer.succeed(ConfigService, createMockConfigService())
    const program = whoamiCommand({}).pipe(
      Effect.provide(GerritApiServiceLive),
      Effect.provide(mockConfigLayer),
    )

    await expect(Effect.runPromise(program)).rejects.toThrow()
  })
})
