import '@test/undici-mock'

import { afterAll, afterEach, beforeAll, describe, expect, test } from '@test/compat'
import { Effect } from 'effect'
import { vi } from 'vitest'
import { GerritApiServiceLive } from '@/api/gerrit'
import { buildStatusCommand } from '@/cli/commands/build-status'
import type { MessageInfo } from '@/schemas/gerrit'
import * as httpClient from '@/api/http-client'
import {
  capturedErrors,
  capturedStdout,
  createMockConfigLayer,
  mockProcessExit,
  resetBuildStatusMocks,
  setupBuildStatusTests,
  teardownBuildStatusTests,
} from './helpers/build-status-test-setup'

beforeAll(() => {
  setupBuildStatusTests()
})

afterAll(() => {
  teardownBuildStatusTests()
})

afterEach(() => {
  resetBuildStatusMocks()
  vi.restoreAllMocks()
})

/**
 * 为 build-status 的 watch 模式构建按调用次数返回不同 messages 的 send mock。
 *
 * 原因: src/api/http-client 的 GET 响应缓存 15 秒,会让 MSW 的轮询 handler
 * 只在第一次调用时被命中,后续请求都返回缓存的第一次响应(例如空 messages),
 * 导致 watch 永远停留在 pending 状态直到 timeout。直接 spy send 函数可以
 * 完全绕过 MSW 与 GET 缓存,让每个轮询拿到独立的响应。
 */
const setupMessagesSpy = (
  responses: ReadonlyArray<readonly MessageInfo[]>,
): ReturnType<typeof vi.spyOn> => {
  let idx = 0
  return vi.spyOn(httpClient, 'send').mockImplementation(async (_url, _options = {}) => {
    const messages = responses[Math.min(idx, responses.length - 1)] ?? []
    idx++
    return {
      status: 200,
      raw: JSON.stringify({ messages: [...messages] }),
      body: { messages: [...messages] },
      cacheHit: false,
    }
  })
}

const buildStarted: MessageInfo = {
  id: 'msg1',
  message: 'Build Started',
  date: '2024-01-15 10:00:00.000000000',
  author: { _account_id: 9999, name: 'CI Bot' },
}
const verifiedPlus1: MessageInfo = {
  id: 'msg2',
  message: 'Patch Set 1: Verified+1',
  date: '2024-01-15 10:05:00.000000000',
  author: { _account_id: 9999, name: 'CI Bot' },
}
const verifiedMinus1: MessageInfo = {
  id: 'msg2',
  message: 'Patch Set 1: Verified-1',
  date: '2024-01-15 10:05:00.000000000',
  author: { _account_id: 9999, name: 'CI Bot' },
}

describe('build-status command - watch mode', () => {
  // build-status 命令把 interval Math.max 强制最小为 1 秒,
  // 多个轮询测试需要超过默认 5 秒的 vitest timeout,这里统一放宽到 15 秒。
  test('polls until success state is reached', async () => {
    const spy = setupMessagesSpy([
      [], // 1st poll: pending
      [buildStarted], // 2nd poll: running
      [buildStarted, verifiedPlus1], // 3rd poll: success
    ])

    try {
      const effect = buildStatusCommand('12345', {
        watch: true,
        interval: 0.1, // Fast polling for tests
        timeout: 10,
      }).pipe(Effect.provide(GerritApiServiceLive), Effect.provide(createMockConfigLayer()))

      await Effect.runPromise(effect)

      // Should have multiple outputs (one per poll)
      expect(capturedStdout.length).toBeGreaterThanOrEqual(3)
      expect(JSON.parse(capturedStdout[0])).toEqual({ state: 'pending' })
      expect(JSON.parse(capturedStdout[1])).toEqual({ state: 'running' })
      expect(JSON.parse(capturedStdout[2])).toEqual({ state: 'success' })

      // Minimalistic output: no stderr messages except on timeout/error
      expect(capturedErrors.length).toBe(0)
    } finally {
      spy.mockRestore()
    }
  }, 15000)

  test('polls until failure state is reached', async () => {
    const spy = setupMessagesSpy([
      [buildStarted], // 1st poll: running
      [buildStarted, verifiedMinus1], // 2nd poll: failure
    ])

    try {
      const effect = buildStatusCommand('12345', {
        watch: true,
        interval: 0.1,
        timeout: 10,
      }).pipe(Effect.provide(GerritApiServiceLive), Effect.provide(createMockConfigLayer()))

      await Effect.runPromise(effect)

      expect(capturedStdout.length).toBeGreaterThanOrEqual(2)
      expect(JSON.parse(capturedStdout[capturedStdout.length - 1])).toEqual({ state: 'failure' })

      // Minimalistic output: no stderr messages except on timeout/error
      expect(capturedErrors.length).toBe(0)
    } finally {
      spy.mockRestore()
    }
  }, 15000)

  test('times out after specified duration', async () => {
    // Always return running state
    const spy = setupMessagesSpy([[buildStarted]])

    try {
      const effect = buildStatusCommand('12345', {
        watch: true,
        interval: 0.1,
        timeout: 0.5, // Very short timeout
      }).pipe(Effect.provide(GerritApiServiceLive), Effect.provide(createMockConfigLayer()))

      try {
        await Effect.runPromise(effect)
      } catch {
        // Should exit with code 2 for timeout
        expect(mockProcessExit).toHaveBeenCalledWith(2)
        expect(capturedErrors.some((e: string) => e.includes('Timeout'))).toBe(true)
      }
    } finally {
      spy.mockRestore()
    }
  })

  test('exit-status flag causes exit 1 on failure', async () => {
    const spy = setupMessagesSpy([[buildStarted, verifiedMinus1]])

    try {
      const effect = buildStatusCommand('12345', {
        watch: true,
        interval: 0.1,
        timeout: 10,
        exitStatus: true,
      }).pipe(Effect.provide(GerritApiServiceLive), Effect.provide(createMockConfigLayer()))

      try {
        await Effect.runPromise(effect)
      } catch {
        // Should exit with code 1 for failure when --exit-status is used
        expect(mockProcessExit).toHaveBeenCalledWith(1)
      }
    } finally {
      spy.mockRestore()
    }
  }, 15000)

  test('exit-status flag does not affect success state', async () => {
    const spy = setupMessagesSpy([[buildStarted, verifiedPlus1]])

    try {
      const effect = buildStatusCommand('12345', {
        watch: true,
        interval: 0.1,
        timeout: 10,
        exitStatus: true,
      }).pipe(Effect.provide(GerritApiServiceLive), Effect.provide(createMockConfigLayer()))

      await Effect.runPromise(effect)

      // Should not call process.exit for success state
      expect(mockProcessExit).not.toHaveBeenCalled()
      expect(JSON.parse(capturedStdout[0])).toEqual({ state: 'success' })
    } finally {
      spy.mockRestore()
    }
  })

  test('watch mode handles not_found state', async () => {
    // 404: change not found
    const spy = vi.spyOn(httpClient, 'send').mockImplementation(async (_url, _options = {}) => {
      return {
        status: 404,
        raw: 'Not Found',
        body: 'Not Found',
        cacheHit: false,
      }
    })

    try {
      const effect = buildStatusCommand('99999', {
        watch: true,
        interval: 0.1,
        timeout: 10,
      }).pipe(Effect.provide(GerritApiServiceLive), Effect.provide(createMockConfigLayer()))

      await Effect.runPromise(effect)

      expect(capturedStdout.length).toBe(1)
      expect(JSON.parse(capturedStdout[0])).toEqual({ state: 'not_found' })

      // 404 errors bypass pollBuildStatus and are handled in error handler
      // Minimalistic output: no stderr messages for not_found state
      expect(capturedErrors.length).toBe(0)
    } finally {
      spy.mockRestore()
    }
  })

  test('without watch flag, behaves as single check', async () => {
    const spy = setupMessagesSpy([[buildStarted]])

    try {
      const effect = buildStatusCommand('12345', {
        watch: false,
      }).pipe(Effect.provide(GerritApiServiceLive), Effect.provide(createMockConfigLayer()))

      await Effect.runPromise(effect)

      // Should only have one output (no polling)
      expect(capturedStdout.length).toBe(1)
      expect(JSON.parse(capturedStdout[0])).toEqual({ state: 'running' })

      // Should not have watch mode messages in stderr
      expect(capturedErrors.some((e: string) => e.includes('Watching build status'))).toBe(false)
    } finally {
      spy.mockRestore()
    }
  })
})
