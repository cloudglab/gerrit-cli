import { describe, expect, test } from '@test/compat'
import {
  classifyError,
  classifyMessage,
  classifyStatus,
  type ErrorCode,
  toStructuredError,
} from '@/core/error-codes'

describe('classifyStatus', () => {
  test('maps 401 to NOT_AUTHENTICATED with recoverable hint', () => {
    const result = classifyStatus(401)
    expect(result.code).toBe('NOT_AUTHENTICATED')
    expect(result.recoverable).toBe(true)
    expect(result.hint).toBeTruthy()
  })

  test('maps 403 to PERMISSION_DENIED', () => {
    const result = classifyStatus(403)
    expect(result.code).toBe('PERMISSION_DENIED')
    expect(result.recoverable).toBe(false)
  })

  test('maps 404 to NOT_FOUND', () => {
    const result = classifyStatus(404)
    expect(result.code).toBe('NOT_FOUND')
    expect(result.recoverable).toBe(false)
  })

  test('maps 409 to CONFLICT', () => {
    const result = classifyStatus(409)
    expect(result.code).toBe('CONFLICT')
    expect(result.recoverable).toBe(false)
  })

  test('maps 422 to INVALID_QUERY', () => {
    const result = classifyStatus(422)
    expect(result.code).toBe('INVALID_QUERY')
    expect(result.recoverable).toBe(false)
  })

  test('maps 429 to RATE_LIMITED with recoverable', () => {
    const result = classifyStatus(429)
    expect(result.code).toBe('RATE_LIMITED')
    expect(result.recoverable).toBe(true)
  })

  test('maps 500/502/503/504 to SERVER_ERROR with recoverable', () => {
    for (const status of [500, 502, 503, 504]) {
      const result = classifyStatus(status)
      expect(result.code).toBe('SERVER_ERROR')
      expect(result.recoverable).toBe(true)
    }
  })

  test('maps unknown 4xx to INVALID_QUERY', () => {
    expect(classifyStatus(418).code).toBe('INVALID_QUERY')
  })

  test('maps unknown 5xx to SERVER_ERROR', () => {
    expect(classifyStatus(599).code).toBe('SERVER_ERROR')
  })

  test('returns UNKNOWN for undefined status', () => {
    expect(classifyStatus(undefined).code).toBe('UNKNOWN')
  })
})

describe('classifyMessage', () => {
  test('detects timeout patterns', () => {
    expect(classifyMessage('Request timeout').code).toBe('TIMEOUT')
    expect(classifyMessage('Connection timed out').code).toBe('TIMEOUT')
    expect(classifyMessage('Request was aborted').code).toBe('TIMEOUT')
  })

  test('detects network patterns', () => {
    expect(classifyMessage('ECONNRESET').code).toBe('NETWORK_ERROR')
    expect(classifyMessage('socket hang up').code).toBe('NETWORK_ERROR')
    expect(classifyMessage('fetch failed').code).toBe('NETWORK_ERROR')
    expect(classifyMessage('network unreachable').code).toBe('NETWORK_ERROR')
  })

  test('returns UNKNOWN for non-matching message', () => {
    expect(classifyMessage('something else').code).toBe('UNKNOWN')
  })
})

describe('classifyError', () => {
  test('prefers status code over message', () => {
    const err = Object.assign(new Error('network failure'), { status: 404 })
    const result = classifyError(err)
    expect(result.code).toBe('NOT_FOUND')
  })

  test('detects write preview requirement', () => {
    const result = classifyError(new Error('Operation requires --confirm flag'))
    expect(result.code).toBe('WRITE_PREVIEW_REQUIRED')
    expect(result.recoverable).toBe(true)
  })

  test('detects write disabled', () => {
    const result = classifyError(new Error('GERRIT_DISABLE_WRITE=true'))
    expect(result.code).toBe('WRITE_DISABLED')
    expect(result.recoverable).toBe(false)
  })

  test('detects config error', () => {
    const result = classifyError(new Error('No config found'))
    expect(result.code).toBe('CONFIG_ERROR')
    expect(result.recoverable).toBe(true)
  })

  test('handles string error', () => {
    const result = classifyError('fetch failed')
    expect(result.code).toBe('NETWORK_ERROR')
  })

  test('handles null/undefined', () => {
    expect(classifyError(null).code).toBe('UNKNOWN')
    expect(classifyError(undefined).code).toBe('UNKNOWN')
  })

  test('handles non-Error object', () => {
    expect(classifyError({ message: 'weird thing' }).code).toBe('UNKNOWN')
  })
})

describe('toStructuredError', () => {
  test('produces complete structured output for ApiError-like object', () => {
    const err = Object.assign(new Error('Not found'), { status: 404 })
    const structured = toStructuredError(err)
    expect(structured.code).toBe<ErrorCode>('NOT_FOUND')
    expect(structured.statusCode).toBe(404)
    expect(structured.recoverable).toBe(false)
    expect(structured.message).toBe('Not found')
    expect(structured.hint).toBeTruthy()
  })

  test('omits statusCode when not present', () => {
    const structured = toStructuredError(new Error('unknown'))
    expect(structured.statusCode).toBeUndefined()
  })

  test('omits hint when not applicable', () => {
    const structured = toStructuredError(new Error('weird thing'))
    expect(structured.hint).toBeUndefined()
  })

  test('handles string errors', () => {
    const structured = toStructuredError('plain string')
    expect(structured.message).toBe('plain string')
  })
})
