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
import { rebaseCommand } from '@/cli/commands/rebase'
import type { ChangeInfo } from '@/schemas/gerrit'
import { ConfigService } from '@/services/config'
import { createMockConfigService } from './helpers/config-mock'

const mockChange: ChangeInfo = {
  id: 'test-project~master~I123',
  _number: 12345,
  change_id: 'I123',
  project: 'test-project',
  branch: 'master',
  subject: 'Test change to rebase',
  status: 'NEW',
  created: '2024-01-01 10:00:00.000000000',
  updated: '2024-01-01 12:00:00.000000000',
  owner: {
    _account_id: 1000,
    name: 'Test User',
    email: 'test@example.com',
  },
  labels: {
    'Code-Review': {
      value: 0,
    },
    Verified: {
      value: 0,
    },
  },
  work_in_progress: false,
  submittable: false,
}

// Create MSW server
const server = setupServer(
  // Default handler for auth check
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

describe('rebase command', () => {
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

  it('should rebase a change without a base', async () => {
    server.use(
      http.post('*/a/changes/12345/revisions/current/rebase', async ({ request }) => {
        const body = (await request.json()) as { base?: string }
        expect(body.base).toBeUndefined()
        return HttpResponse.text(`)]}'\n${JSON.stringify(mockChange)}`)
      }),
    )

    const mockConfigLayer = Layer.succeed(ConfigService, createMockConfigService())
    const program = rebaseCommand('12345', { confirm: true }).pipe(
      Effect.provide(GerritApiServiceLive),
      Effect.provide(mockConfigLayer),
    )

    await Effect.runPromise(program)

    const output = mockConsoleLog.mock.calls.map((call) => call[0]).join('\n')
    expect(output).toContain('Rebased change 12345')
    expect(output).toContain('Test change to rebase')
    expect(output).toContain('Branch: master')
    expect(output).not.toContain('Base:')
  })

  it('should rebase a change with a specified base', async () => {
    server.use(
      http.post('*/a/changes/12345/revisions/current/rebase', async ({ request }) => {
        const body = (await request.json()) as { base?: string }
        expect(body.base).toBe('refs/heads/main')
        return HttpResponse.text(`)]}'\n${JSON.stringify(mockChange)}`)
      }),
    )

    const mockConfigLayer = Layer.succeed(ConfigService, createMockConfigService())
    const program = rebaseCommand('12345', {
      confirm: true,
      base: 'refs/heads/main',
    }).pipe(Effect.provide(GerritApiServiceLive), Effect.provide(mockConfigLayer))

    await Effect.runPromise(program)

    const output = mockConsoleLog.mock.calls.map((call) => call[0]).join('\n')
    expect(output).toContain('Rebased change 12345')
    expect(output).toContain('Test change to rebase')
    expect(output).toContain('Branch: master')
    expect(output).toContain('Base: refs/heads/main')
  })

  it('should output XML format when --xml flag is used', async () => {
    server.use(
      http.post('*/a/changes/12345/revisions/current/rebase', async () => {
        return HttpResponse.text(`)]}'\n${JSON.stringify(mockChange)}`)
      }),
    )

    const mockConfigLayer = Layer.succeed(ConfigService, createMockConfigService())
    const program = rebaseCommand('12345', { confirm: true, xml: true }).pipe(
      Effect.provide(GerritApiServiceLive),
      Effect.provide(mockConfigLayer),
    )

    await Effect.runPromise(program)

    const output = mockConsoleLog.mock.calls.map((call) => call[0]).join('\n')
    expect(output).toContain('<?xml version="1.0" encoding="UTF-8"?>')
    expect(output).toContain('<rebase_result>')
    expect(output).toContain('<status>success</status>')
    expect(output).toContain('<change_number>12345</change_number>')
    expect(output).toContain('<subject><![CDATA[Test change to rebase]]></subject>')
    expect(output).toContain('<branch>master</branch>')
    expect(output).toContain('</rebase_result>')
  })

  it('should output XML format with base when --base is provided', async () => {
    server.use(
      http.post('*/a/changes/12345/revisions/current/rebase', async ({ request }) => {
        const body = (await request.json()) as { base?: string }
        expect(body.base).toBe('refs/heads/develop')
        return HttpResponse.text(`)]}'\n${JSON.stringify(mockChange)}`)
      }),
    )

    const mockConfigLayer = Layer.succeed(ConfigService, createMockConfigService())
    const program = rebaseCommand('12345', {
      confirm: true,
      xml: true,
      base: 'refs/heads/develop',
    }).pipe(Effect.provide(GerritApiServiceLive), Effect.provide(mockConfigLayer))

    await Effect.runPromise(program)

    const output = mockConsoleLog.mock.calls.map((call) => call[0]).join('\n')
    expect(output).toContain('<rebase_result>')
    expect(output).toContain('<status>success</status>')
    expect(output).toContain('<base><![CDATA[refs/heads/develop]]></base>')
    expect(output).toContain('</rebase_result>')
  })

  it('should handle not found errors gracefully with pretty output', async () => {
    server.use(
      http.post('*/a/changes/99999/revisions/current/rebase', () => {
        return HttpResponse.text('Change not found', { status: 404 })
      }),
    )

    const mockConfigLayer = Layer.succeed(ConfigService, createMockConfigService())
    const program = rebaseCommand('99999', { confirm: true }).pipe(
      Effect.provide(GerritApiServiceLive),
      Effect.provide(mockConfigLayer),
    )

    // Errors propagate through the Effect channel (handled by executeEffect's
    // outputError + exit 1 at the CLI boundary); the command no longer swallows them.
    await expect(Effect.runPromise(program)).rejects.toThrow()
  })

  it('should handle not found errors with XML output when --xml flag is used', async () => {
    server.use(
      http.post('*/a/changes/99999/revisions/current/rebase', () => {
        return HttpResponse.text('Change not found', { status: 404 })
      }),
    )

    const mockConfigLayer = Layer.succeed(ConfigService, createMockConfigService())
    const program = rebaseCommand('99999', { confirm: true, xml: true }).pipe(
      Effect.provide(GerritApiServiceLive),
      Effect.provide(mockConfigLayer),
    )

    await expect(Effect.runPromise(program)).rejects.toThrow()
  })

  it('should fail when no change ID and HEAD has no Change-Id', async () => {
    const mockConfigLayer = Layer.succeed(ConfigService, createMockConfigService())
    const program = rebaseCommand(undefined, {}).pipe(
      Effect.provide(GerritApiServiceLive),
      Effect.provide(mockConfigLayer),
    )

    // NoChangeIdError propagates (auto-detection fails outside a git repo)
    await expect(Effect.runPromise(program)).rejects.toThrow(/No Change-ID/i)
  })

  it('should fail when no change ID and HEAD has no Change-Id with --xml flag', async () => {
    const mockConfigLayer = Layer.succeed(ConfigService, createMockConfigService())
    const program = rebaseCommand(undefined, { xml: true }).pipe(
      Effect.provide(GerritApiServiceLive),
      Effect.provide(mockConfigLayer),
    )

    await expect(Effect.runPromise(program)).rejects.toThrow(/No Change-ID/i)
  })

  it('should treat empty string as missing change ID and auto-detect', async () => {
    const mockConfigLayer = Layer.succeed(ConfigService, createMockConfigService())
    const program = rebaseCommand('', {}).pipe(
      Effect.provide(GerritApiServiceLive),
      Effect.provide(mockConfigLayer),
    )

    // Empty string triggers auto-detection, which fails with NoChangeIdError
    await expect(Effect.runPromise(program)).rejects.toThrow(/No Change-ID/i)
  })

  it('should handle rebase conflicts gracefully', async () => {
    server.use(
      http.post('*/a/changes/12345/revisions/current/rebase', () => {
        return HttpResponse.text('Rebase conflict detected', { status: 409 })
      }),
    )

    const mockConfigLayer = Layer.succeed(ConfigService, createMockConfigService())
    const program = rebaseCommand('12345', { confirm: true }).pipe(
      Effect.provide(GerritApiServiceLive),
      Effect.provide(mockConfigLayer),
    )

    await expect(Effect.runPromise(program)).rejects.toThrow()
  })

  it('should handle API errors gracefully', async () => {
    server.use(
      http.post('*/a/changes/12345/revisions/current/rebase', () => {
        return HttpResponse.text('Forbidden', { status: 403 })
      }),
    )

    const mockConfigLayer = Layer.succeed(ConfigService, createMockConfigService())
    const program = rebaseCommand('12345', { confirm: true }).pipe(
      Effect.provide(GerritApiServiceLive),
      Effect.provide(mockConfigLayer),
    )

    await expect(Effect.runPromise(program)).rejects.toThrow()
  })

  it('should handle changes that are already up to date', async () => {
    server.use(
      http.post('*/a/changes/12345/revisions/current/rebase', () => {
        return HttpResponse.text('Change is already up to date', { status: 409 })
      }),
    )

    const mockConfigLayer = Layer.succeed(ConfigService, createMockConfigService())
    const program = rebaseCommand('12345', { confirm: true }).pipe(
      Effect.provide(GerritApiServiceLive),
      Effect.provide(mockConfigLayer),
    )

    await expect(Effect.runPromise(program)).rejects.toThrow()
  })

  it('should handle network errors gracefully', async () => {
    server.use(
      http.post('*/a/changes/12345/revisions/current/rebase', () => {
        return HttpResponse.error()
      }),
    )

    const mockConfigLayer = Layer.succeed(ConfigService, createMockConfigService())
    const program = rebaseCommand('12345', { confirm: true }).pipe(
      Effect.provide(GerritApiServiceLive),
      Effect.provide(mockConfigLayer),
    )

    await expect(Effect.runPromise(program)).rejects.toThrow()
  })

  it('should handle network errors with XML output', async () => {
    server.use(
      http.post('*/a/changes/12345/revisions/current/rebase', () => {
        return HttpResponse.error()
      }),
    )

    const mockConfigLayer = Layer.succeed(ConfigService, createMockConfigService())
    const program = rebaseCommand('12345', { confirm: true, xml: true }).pipe(
      Effect.provide(GerritApiServiceLive),
      Effect.provide(mockConfigLayer),
    )

    await expect(Effect.runPromise(program)).rejects.toThrow()
  })
})
