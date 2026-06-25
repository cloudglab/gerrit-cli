import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const rootDir = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@test/compat': fileURLToPath(new URL('./tests/helpers/test-compat.ts', import.meta.url)),
      '@test/undici-mock': fileURLToPath(new URL('./tests/helpers/undici-mock.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    globals: false,
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    root: rootDir,
    // 串行运行，避免全局状态 / 环境变量 / 模块 mock 之间互相影响。
    pool: 'forks',
    fileParallelism: false,
    maxConcurrency: 1,
    maxWorkers: 1,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      reportsDirectory: 'coverage',
    },
  },
})
