import { afterEach, describe, expect, it } from 'bun:test'
import { Effect, Exit } from 'effect'
import { assertWriteAllowed } from '@/utils/write-guard'

describe('write guard', () => {
  afterEach(() => {
    delete process.env.GERRIT_DISABLE_WRITE
  })

  it('blocks write operations without --confirm', async () => {
    const exit = await Effect.runPromiseExit(
      assertWriteAllowed({ confirm: false, operation: 'post comment', target: '12345' }),
    )

    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      expect(String(exit.cause)).toContain('Preview: post comment on 12345')
      expect(String(exit.cause)).toContain('--confirm')
    }
  })

  it('allows confirmed write operations', async () => {
    const exit = await Effect.runPromiseExit(
      assertWriteAllowed({ confirm: true, operation: 'post comment', target: '12345' }),
    )

    expect(Exit.isSuccess(exit)).toBe(true)
  })

  it('blocks writes when GERRIT_DISABLE_WRITE is set', async () => {
    process.env.GERRIT_DISABLE_WRITE = '1'

    const exit = await Effect.runPromiseExit(
      assertWriteAllowed({ confirm: true, operation: 'submit change', target: '12345' }),
    )

    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      expect(String(exit.cause)).toContain('GERRIT_DISABLE_WRITE')
      expect(String(exit.cause)).toContain('was not executed')
    }
  })
})
