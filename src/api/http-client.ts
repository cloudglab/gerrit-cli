import { Agent, fetch as undiciFetch } from 'undici'

/**
 * 共用 HTTP 客户端：参考 zentao-cli's `src/core/http.ts` 模式。
 *
 * 提供：
 * - 共享 undici Agent 的 keepAlive 连接池。
 * - GET 请求 15 秒内存缓存，命中注入 `cacheHit: true`。
 * - 401：清空缓存后重试一次（让上层重新拼装 Authorization 头）。
 * - 网络错误（`ECONNRESET` / `ETIMEDOUT` / `EAI_AGAIN` / timeout / socket hang up）重试一次。
 * - 错误统一包装成带 `statusCode` / `responseBody` 的 `HttpClientError`。
 */

const GET_CACHE_TTL_MS = 15_000
const NETWORK_RETRY_CODES = new Set(['ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN'])
const NETWORK_RETRY_PATTERNS = [/(?:^|\b)timeout\b/i, /socket hang up/i, /network/i]

export interface RequestOptions {
  readonly method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  readonly headers?: Record<string, string>
  readonly body?: string
  readonly signal?: AbortSignal
  readonly timeoutMs?: number
}

export interface HttpClientErrorOptions {
  readonly message: string
  readonly statusCode?: number
  readonly responseBody?: unknown
  readonly cause?: unknown
}

export class HttpClientError extends Error {
  readonly _tag = 'HttpClientError'
  readonly statusCode?: number
  readonly responseBody?: unknown
  readonly cause?: unknown

  constructor(options: HttpClientErrorOptions) {
    super(options.message)
    this.name = 'HttpClientError'
    this.statusCode = options.statusCode
    this.responseBody = options.responseBody
    this.cause = options.cause
  }
}

interface CachedEntry {
  readonly expiresAt: number
  readonly value: unknown
}

const globalDispatcher = new Agent({
  keepAliveTimeout: 30_000,
  keepAliveMaxTimeout: 60_000,
  pipelining: 1,
})

const cache = new Map<string, CachedEntry>()

const buildCacheKey = (url: string, options: RequestOptions): string => {
  const method = options.method ?? 'GET'
  return JSON.stringify({ url, method, headers: options.headers ?? {}, body: options.body ?? null })
}

const readCache = (key: string): unknown | undefined => {
  const entry = cache.get(key)
  if (!entry) return undefined
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key)
    return undefined
  }
  return attachCacheHit(entry.value)
}

const writeCache = (key: string, value: unknown): void => {
  cache.set(key, { expiresAt: Date.now() + GET_CACHE_TTL_MS, value })
}

const clearCache = (): void => {
  cache.clear()
}

const attachCacheHit = (value: unknown): unknown => {
  if (value === null || value === undefined) return value
  if (typeof value !== 'object' || Array.isArray(value)) return value
  return { ...(value as Record<string, unknown>), cacheHit: true }
}

const isNetworkError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false
  const code = (error as { code?: unknown }).code
  if (typeof code === 'string' && NETWORK_RETRY_CODES.has(code)) return true
  const message = (error as { message?: unknown }).message
  if (typeof message === 'string' && NETWORK_RETRY_PATTERNS.some((re) => re.test(message))) {
    return true
  }
  return false
}

const errorFromResponse = async (
  response: { status: number; text: () => Promise<string> },
  url: string,
): Promise<HttpClientError> => {
  const raw = await response.text().catch(() => '')
  return new HttpClientError({
    message: `HTTP 请求失败: ${response.status} - ${truncate(raw, 500)}`,
    statusCode: response.status,
    responseBody: tryParseJson(raw) ?? raw,
    cause: { url, status: response.status },
  })
}

const errorFromUnknown = (error: unknown, url: string): HttpClientError => {
  if (error instanceof HttpClientError) return error
  const message = error instanceof Error ? error.message : String(error)
  return new HttpClientError({ message: `HTTP 请求失败: ${message}`, cause: { url, error } })
}

const tryParseJson = (raw: string): unknown => {
  if (!raw) return undefined
  const trimmed = raw.replace(/^\)\]\}'\n?/, '').trim()
  if (!trimmed) return undefined
  try {
    return JSON.parse(trimmed)
  } catch {
    return undefined
  }
}

const truncate = (text: string, max: number): string =>
  text.length > max ? `${text.slice(0, max)}…` : text

interface InternalOptions extends RequestOptions {
  readonly allowCache?: boolean
}

const performRequest = async (
  url: string,
  options: InternalOptions,
): Promise<{ status: number; raw: string }> => {
  const headers: Record<string, string> = { ...(options.headers ?? {}) }
  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json'
  }

  const controller = new AbortController()
  const timeoutMs = options.timeoutMs ?? 30_000
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  if (options.signal) {
    if (options.signal.aborted) controller.abort()
    else options.signal.addEventListener('abort', () => controller.abort(), { once: true })
  }

  try {
    const response = await undiciFetch(url, {
      method: options.method ?? 'GET',
      headers,
      body: options.body,
      dispatcher: globalDispatcher,
      signal: controller.signal,
    } as Parameters<typeof undiciFetch>[1])
    const raw = await response.text()
    return { status: response.status, raw }
  } finally {
    clearTimeout(timer)
  }
}

export interface SendResult {
  readonly status: number
  readonly raw: string
  readonly body: unknown
  readonly cacheHit: boolean
}

export const send = async (url: string, options: RequestOptions = {}): Promise<SendResult> => {
  const method = options.method ?? 'GET'
  const cacheKey = buildCacheKey(url, options)
  const allowCache = method === 'GET'

  if (allowCache) {
    const cached = readCache(cacheKey)
    if (cached !== undefined) {
      const cachedResult = cached as { body: unknown }
      return {
        status: 200,
        raw: '',
        body: cachedResult.body,
        cacheHit: true,
      }
    }
  }

  const result = await sendWithRetry(url, options, false)
  const body = tryParseJson(result.raw) ?? (result.raw || {})

  if (allowCache) writeCache(cacheKey, { body })

  return { status: result.status, raw: result.raw, body, cacheHit: false }
}

const sendWithRetry = async (
  url: string,
  options: RequestOptions,
  retried: boolean,
): Promise<{ status: number; raw: string }> => {
  try {
    const result = await performRequest(url, options)

    if (result.status === 401 && !retried) {
      clearCache()
      return sendWithRetry(url, options, true)
    }

    if (!isOkStatus(result.status)) {
      const errorResponse = await errorFromResponse(
        { status: result.status, text: () => Promise.resolve(result.raw) },
        url,
      )
      throw errorResponse
    }

    return result
  } catch (error) {
    if (error instanceof HttpClientError) {
      // 业务错误（4xx/5xx）不重试，直接抛
      throw error
    }
    if (!retried && isNetworkError(error)) {
      return sendWithRetry(url, options, true)
    }
    throw errorFromUnknown(error, url)
  }
}

const isOkStatus = (status: number): boolean => status >= 200 && status < 300

export const clearHttpCache = (): void => {
  clearCache()
}

export const isNetworkLikeError: (error: unknown) => boolean = isNetworkError
