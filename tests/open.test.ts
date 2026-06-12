import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test'
import { Effect, Layer } from 'effect'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { GerritApiServiceLive } from '@/api/gerrit'
import { openCommand } from '@/cli/commands/open'
import { ConfigService } from '@/services/config'

import { createMockConfigService } from './helpers/config-mock'

const mockExec = mock()
const mockExecSync = mock()
const mockSpawn = mock()
const mockSpawnSync = mock()

const mockGitLogWithoutChangeId = () => ({
  stdout: {
    on: (event: string, callback: (data: Buffer) => void) => {
      if (event === 'data') callback(Buffer.from('feat: no change id'))
    },
  },
  stderr: {
    on: () => {},
  },
  on: (event: string, callback: (code: number) => void) => {
    if (event === 'close') callback(0)
  },
})

const mockExecImplementation = (
  implementation: (cmd: string, callback: (error: Error | null) => void) => void,
) => {
  mockExec.mockImplementation((command, options, callback) => {
    const execCallback = typeof options === 'function' ? options : callback
    implementation(command, (error) => execCallback?.(error, '', ''))
  })
}

mock.module('@/utils/child-process', () => ({
  exec: mockExec,
  execSync: mockExecSync,
  spawn: mockSpawn,
  spawnSync: mockSpawnSync,
}))

const server = setupServer()

beforeAll(() => {
  server.listen()
})

beforeEach(() => {
  mockExec.mockReset()
  mockExecSync.mockReset()
  mockSpawn.mockReset()
  mockSpawnSync.mockReset()
  mockSpawn.mockImplementation(mockGitLogWithoutChangeId)
})

afterAll(() => {
  server.close()
})

describe('open command', () => {
  test('should open change URL in browser', async () => {
    // Mock the exec function to simulate successful browser opening
    mockExecImplementation((cmd: string, callback: (error: Error | null) => void) => {
      expect(cmd).toMatch(
        /^(open|start|xdg-open) "https:\/\/gerrit\.example\.com\/c\/test-project\/\+\/12345"$/,
      )
      callback(null)
    })

    server.use(
      http.get('*/a/changes/12345', () => {
        return HttpResponse.text(
          `)]}'\n${JSON.stringify({
            id: 'test-project~main~I1234567890abcdef',
            project: 'test-project',
            branch: 'main',
            change_id: 'I1234567890abcdef',
            subject: 'Test change',
            status: 'NEW',
            _number: 12345,
            owner: {
              _account_id: 1000000,
              name: 'Test User',
              email: 'test@example.com',
            },
          })}`,
        )
      }),
    )

    const mockConfigLayer = Layer.succeed(
      ConfigService,
      createMockConfigService({
        host: 'https://gerrit.example.com',
        username: 'testuser',
        password: 'testpass',
      }),
    )

    const consoleSpy = mock(() => {})
    const originalLog = console.log
    console.log = consoleSpy

    const program = openCommand('12345').pipe(
      Effect.provide(GerritApiServiceLive),
      Effect.provide(mockConfigLayer),
    )

    await Effect.runPromise(program)

    console.log = originalLog

    expect(mockExec).toHaveBeenCalledTimes(1)
    expect(consoleSpy).toHaveBeenCalledWith(
      'Opened: https://gerrit.example.com/c/test-project/+/12345',
    )
  })

  test('should handle URLs and extract change number', async () => {
    mockExecImplementation((cmd: string, callback: (error: Error | null) => void) => {
      expect(cmd).toMatch(
        /^(open|start|xdg-open) "https:\/\/gerrit\.example\.com\/c\/test-project\/\+\/12345"$/,
      )
      callback(null)
    })

    server.use(
      http.get('*/a/changes/12345', () => {
        return HttpResponse.text(
          `)]}'\n${JSON.stringify({
            id: 'test-project~main~I1234567890abcdef',
            project: 'test-project',
            branch: 'main',
            change_id: 'I1234567890abcdef',
            subject: 'Test change',
            status: 'NEW',
            _number: 12345,
            owner: {
              _account_id: 1000000,
              name: 'Test User',
            },
          })}`,
        )
      }),
    )

    const mockConfigLayer = Layer.succeed(
      ConfigService,
      createMockConfigService({
        host: 'https://gerrit.example.com',
        username: 'testuser',
        password: 'testpass',
      }),
    )

    const consoleSpy = mock(() => {})
    const originalLog = console.log
    console.log = consoleSpy

    // Test with a full Gerrit URL
    const program = openCommand('https://gerrit.example.com/c/test-project/+/12345').pipe(
      Effect.provide(GerritApiServiceLive),
      Effect.provide(mockConfigLayer),
    )

    await Effect.runPromise(program)

    console.log = originalLog

    expect(mockExec).toHaveBeenCalledTimes(1)
    expect(consoleSpy).toHaveBeenCalledWith(
      'Opened: https://gerrit.example.com/c/test-project/+/12345',
    )
  })

  test('should handle invalid change ID', async () => {
    const mockConfigLayer = Layer.succeed(
      ConfigService,
      createMockConfigService({
        host: 'https://gerrit.example.com',
        username: 'testuser',
        password: 'testpass',
      }),
    )

    // Use an empty string which is truly invalid according to isValidChangeId
    const program = openCommand('').pipe(
      Effect.provide(GerritApiServiceLive),
      Effect.provide(mockConfigLayer),
    )

    await expect(Effect.runPromise(program)).rejects.toThrow('Invalid change ID: ')
  })

  test('should handle API errors gracefully', async () => {
    server.use(
      http.get('*/a/changes/12345', () => {
        return HttpResponse.json({ error: 'Change not found' }, { status: 404 })
      }),
    )

    const mockConfigLayer = Layer.succeed(
      ConfigService,
      createMockConfigService({
        host: 'https://gerrit.example.com',
        username: 'testuser',
        password: 'testpass',
      }),
    )

    const program = openCommand('12345').pipe(
      Effect.provide(GerritApiServiceLive),
      Effect.provide(mockConfigLayer),
    )

    await expect(Effect.runPromise(program)).rejects.toThrow()
  })

  test('should handle browser opening errors', async () => {
    mockExecImplementation((cmd: string, callback: (error: Error | null) => void) => {
      callback(new Error('Browser not found'))
    })

    server.use(
      http.get('*/a/changes/12345', () => {
        return HttpResponse.text(
          `)]}'\n${JSON.stringify({
            id: 'test-project~main~I1234567890abcdef',
            project: 'test-project',
            branch: 'main',
            change_id: 'I1234567890abcdef',
            subject: 'Test change',
            status: 'NEW',
            _number: 12345,
            owner: {
              _account_id: 1000000,
              name: 'Test User',
            },
          })}`,
        )
      }),
    )

    const mockConfigLayer = Layer.succeed(
      ConfigService,
      createMockConfigService({
        host: 'https://gerrit.example.com',
        username: 'testuser',
        password: 'testpass',
      }),
    )

    const program = openCommand('12345').pipe(
      Effect.provide(GerritApiServiceLive),
      Effect.provide(mockConfigLayer),
    )

    await expect(Effect.runPromise(program)).rejects.toThrow(
      'Failed to open URL: Browser not found',
    )
  })
})
