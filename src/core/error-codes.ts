/**
 * Structured error classification for CLI output.
 *
 * Maps low-level signals (HTTP status, network conditions, validation errors)
 * to a stable, machine-readable ErrorCode. AI agents and scripts can switch on
 * `code` + `recoverable` to decide whether to retry, re-auth, or escalate.
 */

export type ErrorCode =
  | 'NOT_AUTHENTICATED'
  | 'PERMISSION_DENIED'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'CONFLICT'
  | 'INVALID_QUERY'
  | 'INVALID_INPUT'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'SERVER_ERROR'
  | 'WRITE_DISABLED'
  | 'WRITE_PREVIEW_REQUIRED'
  | 'CONFIG_ERROR'
  | 'UNKNOWN'

export interface ErrorClassification {
  readonly code: ErrorCode
  readonly recoverable: boolean
  readonly hint?: string
}

const NETWORK_PATTERNS: readonly RegExp[] = [
  /ECONNRESET/i,
  /ETIMEDOUT/i,
  /EAI_AGAIN/i,
  /ENOTFOUND/i,
  /socket hang up/i,
  /fetch failed/i,
  /network/i,
]

const TIMEOUT_PATTERNS: readonly RegExp[] = [/timeout/i, /aborted/i, /timed out/i]

const STATUS_CODE_MAP: Readonly<Record<number, ErrorClassification>> = {
  400: { code: 'INVALID_QUERY', recoverable: false, hint: '检查参数语法或字段名' },
  401: { code: 'NOT_AUTHENTICATED', recoverable: true, hint: '运行 gerrit-cli setup 重新认证' },
  403: { code: 'PERMISSION_DENIED', recoverable: false, hint: '当前账号无权访问该资源' },
  404: { code: 'NOT_FOUND', recoverable: false, hint: '确认 change-id / 资源路径是否正确' },
  409: { code: 'CONFLICT', recoverable: false, hint: '资源状态冲突,刷新后重试' },
  422: { code: 'INVALID_QUERY', recoverable: false, hint: '请求体格式校验失败' },
  429: { code: 'RATE_LIMITED', recoverable: true, hint: '触发限流,稍后重试' },
  500: { code: 'SERVER_ERROR', recoverable: true, hint: '服务端内部错误,可重试' },
  502: { code: 'SERVER_ERROR', recoverable: true, hint: '网关错误,可重试' },
  503: { code: 'SERVER_ERROR', recoverable: true, hint: '服务暂时不可用,可重试' },
  504: { code: 'SERVER_ERROR', recoverable: true, hint: '网关超时,可重试' },
}

export const classifyStatus = (status: number | undefined): ErrorClassification => {
  if (status === undefined) {
    return { code: 'UNKNOWN', recoverable: false }
  }
  const found = STATUS_CODE_MAP[status]
  if (found) return found
  if (status >= 400 && status < 500) {
    return { code: 'INVALID_QUERY', recoverable: false }
  }
  if (status >= 500 && status < 600) {
    return { code: 'SERVER_ERROR', recoverable: true }
  }
  return { code: 'UNKNOWN', recoverable: false }
}

export const classifyMessage = (message: string): ErrorClassification => {
  if (TIMEOUT_PATTERNS.some((re) => re.test(message))) {
    return { code: 'TIMEOUT', recoverable: true, hint: '请求超时,可重试' }
  }
  if (NETWORK_PATTERNS.some((re) => re.test(message))) {
    return { code: 'NETWORK_ERROR', recoverable: true, hint: '检查网络连通性后重试' }
  }
  return { code: 'UNKNOWN', recoverable: false }
}

const WRITE_DISABLED_MARKERS = ['GERRIT_DISABLE_WRITE', 'write disabled', 'writes are disabled']

const WRITE_CONFIRM_MARKERS = ['--confirm', 'requires --confirm', 'preview mode', 'write preview']

export const classifyError = (error: unknown): ErrorClassification => {
  if (error === null || error === undefined) {
    return { code: 'UNKNOWN', recoverable: false }
  }

  const message =
    error instanceof Error ? error.message : typeof error === 'string' ? error : String(error)

  const status = readStatus(error)

  for (const marker of WRITE_CONFIRM_MARKERS) {
    if (message.toLowerCase().includes(marker.toLowerCase())) {
      return {
        code: 'WRITE_PREVIEW_REQUIRED',
        recoverable: true,
        hint: '补加 --confirm 标志以真正执行写操作',
      }
    }
  }

  for (const marker of WRITE_DISABLED_MARKERS) {
    if (message.toLowerCase().includes(marker.toLowerCase())) {
      return {
        code: 'WRITE_DISABLED',
        recoverable: false,
        hint: '已通过环境变量禁用写操作',
      }
    }
  }

  if (message.toLowerCase().includes('config')) {
    return { code: 'CONFIG_ERROR', recoverable: true, hint: '运行 gerrit-cli setup 检查配置' }
  }

  if (status !== undefined) {
    return classifyStatus(status)
  }

  return classifyMessage(message)
}

const readStatus = (error: unknown): number | undefined => {
  if (error === null || typeof error !== 'object') return undefined
  const candidate = error as { status?: unknown; statusCode?: unknown }
  if (typeof candidate.statusCode === 'number') return candidate.statusCode
  if (typeof candidate.status === 'number') return candidate.status
  return undefined
}

export interface StructuredError {
  readonly code: ErrorCode
  readonly statusCode?: number
  readonly recoverable: boolean
  readonly message: string
  readonly hint?: string
}

export const toStructuredError = (error: unknown): StructuredError => {
  const classification = classifyError(error)
  const message =
    error instanceof Error ? error.message : typeof error === 'string' ? error : String(error)
  const statusCode = readStatus(error)
  const out: StructuredError = {
    code: classification.code,
    recoverable: classification.recoverable,
    message,
    ...(statusCode !== undefined ? { statusCode } : {}),
    ...(classification.hint ? { hint: classification.hint } : {}),
  }
  return out
}
