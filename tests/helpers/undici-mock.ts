/**
 * 用于让 MSW 能拦截 http-client.ts 中 `undici.fetch` 调用的 vi.mock 片段。
 *
 * 用法: 在测试文件最顶部 import 这个模块,触发其顶层 vi.mock + afterEach。
 *
 * 背景: src/api/http-client.ts 改用 undici 的 fetch,绕过了 globalThis.fetch,
 * MSW v2 默认 patch 的是 globalThis.fetch,所以 undici.fetch 走不到 mock handler。
 * 这里通过 Proxy 把 undici.fetch 重定向到 globalThis.fetch(已被 MSW patch 过),
 * 从而让 MSW 拦截到所有 HTTP 请求。
 *
 * 同时,http-client 内置了 GET 响应缓存(15s),测试间需要清空避免状态污染。
 */
import { afterEach, vi } from 'vitest'
import { clearHttpCache } from '@/api/http-client'

vi.mock('undici', async (importOriginal) => {
  const mod = await importOriginal<typeof import('undici')>()
  return new Proxy(mod, {
    get(target, prop, receiver) {
      if (prop === 'fetch') return globalThis.fetch
      return Reflect.get(target, prop, receiver)
    },
  })
})

// 在每个测试结束后清空 http-client 的 GET 缓存,
// 避免上一个测试的 mock 响应被后续测试复用。
afterEach(() => {
  clearHttpCache()
})
