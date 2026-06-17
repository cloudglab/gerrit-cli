import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  test,
  vi,
} from 'vitest'

type MockFunction = (...args: any[]) => any

type CompatMock<T extends MockFunction = MockFunction> = T &
  MockInstance<T> & {
    readonly mock: MockInstance<T>['mock']
  }

type MockFactory = (<T extends MockFunction>(implementation?: T) => CompatMock<T>) & {
  readonly module: typeof vi.mock
  readonly restore: typeof vi.restoreAllMocks
}

const mock: MockFactory = Object.assign(vi.fn, {
  module: vi.mock,
  restore: vi.restoreAllMocks,
})

const spyOn: typeof vi.spyOn = vi.spyOn

export type { CompatMock as Mock }
export { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, mock, spyOn, test }
