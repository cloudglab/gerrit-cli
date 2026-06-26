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
import { Cause, Effect, Layer } from 'effect'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { GerritApiServiceLive } from '@/api/gerrit'
import { outputWriteGuardPreview } from '@/cli/command-helpers'
import { reviewCommand } from '@/cli/commands/review'
import type { ChangeInfo } from '@/schemas/gerrit'
import { ConfigService } from '@/services/config'
import { WriteGuardError } from '@/utils/write-guard'
import { createMockConfigService } from '../helpers/config-mock'

// ── 共享 mock 数据 ───────────────────────────────────────────────────────

const baseChange: ChangeInfo = {
  id: 'test-project~master~I123',
  _number: 12345,
  change_id: 'I123',
  project: 'test-project',
  branch: 'master',
  subject: 'Test change for review',
  status: 'NEW',
  created: '2024-01-01 10:00:00.000000000',
  updated: '2024-01-01 12:00:00.000000000',
  owner: { _account_id: 1000, name: 'Test User', email: 'test@example.com' },
  work_in_progress: false,
  submittable: true,
}

const changeWithVerified: ChangeInfo = {
  ...baseChange,
  labels: {
    'Code-Review': { value: 0 },
    Verified: { value: 0 },
  },
}

const changeWithoutVerified: ChangeInfo = {
  ...baseChange,
  labels: {
    'Code-Review': { value: 0 },
  },
}

const submitResponse = {
  status: 'MERGED' as const,
  change_id: 'I123',
}

const fileDiffOk = {
  meta_b: { name: 'src/main.js', content_type: 'text/plain', lines: 100 },
  content: [{ b: ['line1', 'line2'] }],
}

const fileDiffShort = {
  meta_b: { name: 'src/main.js', content_type: 'text/plain', lines: 10 },
  content: [],
}

// ── 计数器 + 服务 ───────────────────────────────────────────────────────

interface CallCounters {
  getChange: number
  postReviewTotal: number
  postReviewLabels: number
  postReviewComment: number
  postReviewLineComment: number
  submitChange: number
  getFileDiff: number
}

const initCounters = (): CallCounters => ({
  getChange: 0,
  postReviewTotal: 0,
  postReviewLabels: 0,
  postReviewComment: 0,
  postReviewLineComment: 0,
  submitChange: 0,
  getFileDiff: 0,
})

let counters: CallCounters = initCounters()

const server = setupServer(
  // 默认 auth handler
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

const installHandlers = (
  change: ChangeInfo = changeWithVerified,
  fileDiff: object = fileDiffOk,
): void => {
  server.use(
    http.get('*/a/changes/12345', () => {
      counters.getChange++
      return HttpResponse.text(`)]}'\n${JSON.stringify(change)}`)
    }),
    http.post('*/a/changes/12345/revisions/current/review', async ({ request }) => {
      counters.postReviewTotal++
      const body = (await request.json()) as {
        labels?: Record<string, number>
        message?: string
        comments?: Record<string, Array<{ line: number; message: string }>>
      }
      if (body.labels && Object.keys(body.labels).length > 0) {
        counters.postReviewLabels++
      }
      if (typeof body.message === 'string' && body.message.length > 0) {
        counters.postReviewComment++
      }
      if (body.comments && Object.keys(body.comments).length > 0) {
        counters.postReviewLineComment++
      }
      return HttpResponse.text(`)]}'\n{}`)
    }),
    http.post('*/a/changes/12345/submit', () => {
      counters.submitChange++
      return HttpResponse.text(`)]}'\n${JSON.stringify(submitResponse)}`)
    }),
    http.get('*/a/changes/12345/revisions/current/files/:filePath/diff', () => {
      counters.getFileDiff++
      return HttpResponse.text(`)]}'\n${JSON.stringify(fileDiff)}`)
    }),
  )
}

const makeProgram = (
  changeId: string | undefined,
  options: Parameters<typeof reviewCommand>[1] = {},
) =>
  reviewCommand(changeId, options).pipe(
    Effect.provide(GerritApiServiceLive),
    Effect.provide(Layer.succeed(ConfigService, createMockConfigService())),
  )

// 提取 effect 失败原因中的 WriteGuardError 并调用生产级 preview 渲染。
// 等价于 register-reviewer-commands.ts 中 executeEffect 对 WriteGuardError 的处理路径。
const renderPreviewForFailedEffect = async (
  program: ReturnType<typeof makeProgram>,
): Promise<void> => {
  const exit = await Effect.runPromiseExit(program)
  if (exit._tag !== 'Failure') {
    throw new Error('expected the effect to fail with WriteGuardError')
  }
  const failureOpt = Cause.failureOption(exit.cause)
  if (failureOpt._tag !== 'Some' || !(failureOpt.value instanceof WriteGuardError)) {
    throw new Error(
      `expected WriteGuardError, got: ${String(failureOpt._tag === 'Some' ? failureOpt.value : exit.cause)}`,
    )
  }
  outputWriteGuardPreview(failureOpt.value, {}, 'review_result')
}

// ── 测试 ────────────────────────────────────────────────────────────────

describe('review command', () => {
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
    counters = initCounters()
  })

  afterEach(() => {
    server.resetHandlers()
    delete process.env.GERRIT_DISABLE_WRITE
  })

  // ── 写保护 ─────────────────────────────────────────────────────────

  it('写保护：未传 --confirm 时不应调用任何 handler（normal path）', async () => {
    installHandlers()

    const program = makeProgram('12345', { message: 'Looks good' })

    await expect(Effect.runPromise(program)).rejects.toThrow()

    expect(counters.getChange).toBe(0)
    expect(counters.postReviewTotal).toBe(0)
    expect(counters.postReviewLabels).toBe(0)
    expect(counters.postReviewComment).toBe(0)
    expect(counters.postReviewLineComment).toBe(0)
    expect(counters.submitChange).toBe(0)
    expect(counters.getFileDiff).toBe(0)
  })

  it('写保护：未传 --confirm 时也不应调用任何 handler（--reject path）', async () => {
    installHandlers()

    const program = makeProgram('12345', {
      reject: true,
      file: 'src/main.js',
      line: 42,
      message: 'Critical issue',
    })

    await expect(Effect.runPromise(program)).rejects.toThrow()

    expect(counters.getChange).toBe(0)
    expect(counters.postReviewTotal).toBe(0)
    expect(counters.getFileDiff).toBe(0)
  })

  it('写保护：preview 输出包含完整 4 步计划（normal path）', async () => {
    installHandlers()

    // 测试直接跑 effect,不会自动触发 outputWriteGuardPreview,
    // 这里手动渲染以验证 WriteGuardError.plan 的内容。
    await renderPreviewForFailedEffect(makeProgram('12345', { message: 'LGTM with notes' }))

    const output = mockConsoleLog.mock.calls.map((call) => call[0]).join('\n')
    expect(output).toContain('写操作预览')
    expect(output).toContain('review change')
    expect(output).toContain('计划')
    expect(output).toContain('Code-Review +2')
    expect(output).toContain('Verified +1')
    expect(output).toContain('整体 comment')
    expect(output).toContain('Submit change')
    expect(output).toContain('--confirm')
  })

  it('写保护：preview 输出包含 --reject 单步计划', async () => {
    installHandlers()

    await renderPreviewForFailedEffect(
      makeProgram('12345', {
        reject: true,
        file: 'src/main.ts',
        line: 42,
        message: 'Critical race condition',
      }),
    )

    const output = mockConsoleLog.mock.calls.map((call) => call[0]).join('\n')
    expect(output).toContain('行级 comment @ src/main.ts:42')
  })

  it('写保护：preview JSON 输出包含 plan 数组', async () => {
    installHandlers()

    const exit = await Effect.runPromiseExit(makeProgram('12345', { message: 'LGTM', json: true }))
    expect(exit._tag).toBe('Failure')
    if (exit._tag !== 'Failure') return

    // 走 JSON 分支需要传 options.json
    const failureOpt = Cause.failureOption(exit.cause)
    if (failureOpt._tag !== 'Some' || !(failureOpt.value instanceof WriteGuardError)) {
      throw new Error('expected WriteGuardError')
    }
    outputWriteGuardPreview(failureOpt.value, { json: true }, 'review_result')

    const allOutput = mockConsoleLog.mock.calls.map((call) => call[0]).join('')
    const json = JSON.parse(allOutput) as {
      preview: boolean
      plan: ReadonlyArray<string>
    }
    expect(json.preview).toBe(true)
    expect(json.plan).toContain('Code-Review +2 (vote)')
    expect(json.plan).toContain('Submit change')
  })

  it('写保护：GERRIT_DISABLE_WRITE=true 时阻止所有写操作', async () => {
    process.env.GERRIT_DISABLE_WRITE = 'true'
    installHandlers()

    const program = makeProgram('12345', { confirm: true, message: 'LGTM' })

    await expect(Effect.runPromise(program)).rejects.toThrow(/GERRIT_DISABLE_WRITE/)

    expect(counters.getChange).toBe(0)
    expect(counters.postReviewTotal).toBe(0)
    expect(counters.submitChange).toBe(0)

    // 手动渲染 preview 验证 "写操作已禁用" 文案
    const exit = await Effect.runPromiseExit(program)
    if (exit._tag !== 'Failure') return
    const failureOpt = Cause.failureOption(exit.cause)
    if (failureOpt._tag === 'Some' && failureOpt.value instanceof WriteGuardError) {
      outputWriteGuardPreview(failureOpt.value, {}, 'review_result')
    }
    const output = mockConsoleLog.mock.calls.map((call) => call[0]).join('\n')
    expect(output).toContain('写操作已禁用')
  })

  // ── 无问题 + confirmed ─────────────────────────────────────────────

  it('无问题路径：--confirm 后 vote Code-Review、Verified、整体 comment、submit 都被调用', async () => {
    installHandlers()

    const program = makeProgram('12345', { confirm: true, message: 'LGTM' })
    await Effect.runPromise(program)

    expect(counters.getChange).toBe(1)
    expect(counters.postReviewLabels).toBe(2) // Code-Review + Verified
    expect(counters.postReviewComment).toBe(1)
    expect(counters.submitChange).toBe(1)
    expect(counters.postReviewLineComment).toBe(0)

    const output = mockConsoleLog.mock.calls.map((call) => call[0]).join('\n')
    expect(output).toContain('✓ Review 已完成')
    expect(output).toContain('Code-Review: +2')
    expect(output).toContain('Verified: +1')
    expect(output).toContain('整体 comment')
    expect(output).toContain('Submit: MERGED')
  })

  it('无问题路径：无 message 时 vote + submit 也都执行（仅 labels x2）', async () => {
    installHandlers()

    const program = makeProgram('12345', { confirm: true })
    await Effect.runPromise(program)

    expect(counters.getChange).toBe(1)
    expect(counters.postReviewTotal).toBe(2) // Code-Review + Verified
    expect(counters.postReviewLabels).toBe(2)
    expect(counters.postReviewComment).toBe(0)
    expect(counters.submitChange).toBe(1)
  })

  it('输出 JSON 包含完整 steps 列表', async () => {
    installHandlers()

    const program = makeProgram('12345', { confirm: true, message: 'LGTM', json: true })
    await Effect.runPromise(program)

    const allOutput = mockConsoleLog.mock.calls.map((call) => call[0]).join('')
    const json = JSON.parse(allOutput) as {
      status: string
      review_type: string
      steps: ReadonlyArray<string>
    }
    expect(json.status).toBe('success')
    expect(json.review_type).toBe('normal')
    expect(json.steps.length).toBeGreaterThanOrEqual(3)
    expect(json.steps.some((s) => s.includes('Code-Review'))).toBe(true)
    expect(json.steps.some((s) => s.includes('Verified'))).toBe(true)
    expect(json.steps.some((s) => s.includes('Submit'))).toBe(true)
  })

  it('输出 XML 包含 review_type 和 steps', async () => {
    installHandlers()

    const program = makeProgram('12345', { confirm: true, message: 'LGTM', xml: true })
    await Effect.runPromise(program)

    const output = mockConsoleLog.mock.calls.map((call) => call[0]).join('\n')
    expect(output).toContain('<?xml version="1.0" encoding="UTF-8"?>')
    expect(output).toContain('<review_result>')
    expect(output).toContain('<review_type>normal</review_type>')
    expect(output).toContain('<steps>')
    expect(output).toContain('</review_result>')
  })

  // ── 严重问题（--reject）路径 ────────────────────────────────────────

  it('--reject 路径：仅发送行级 comment，不 vote / 不 submit', async () => {
    installHandlers()

    const program = makeProgram('12345', {
      confirm: true,
      reject: true,
      file: 'src/main.js',
      line: 42,
      message: 'Critical issue here',
    })
    await Effect.runPromise(program)

    expect(counters.getChange).toBe(0) // --reject 不走 getChange
    expect(counters.getFileDiff).toBe(1) // 走 file diff 验证
    expect(counters.postReviewLineComment).toBe(1)
    expect(counters.postReviewLabels).toBe(0)
    expect(counters.postReviewComment).toBe(0)
    expect(counters.submitChange).toBe(0)

    const output = mockConsoleLog.mock.calls.map((call) => call[0]).join('\n')
    expect(output).toContain('✓ 行级 comment 已发送')
    expect(output).toContain('目标: src/main.js:42')
  })

  it('--reject 路径：JSON 输出包含 comment 详情', async () => {
    installHandlers()

    const program = makeProgram('12345', {
      confirm: true,
      reject: true,
      file: 'src/main.js',
      line: 42,
      message: 'Critical',
      json: true,
    })
    await Effect.runPromise(program)

    const allOutput = mockConsoleLog.mock.calls.map((call) => call[0]).join('')
    const json = JSON.parse(allOutput) as {
      review_type: string
      comment?: { file: string; line: number; message: string }
    }
    expect(json.review_type).toBe('reject')
    expect(json.comment?.file).toBe('src/main.js')
    expect(json.comment?.line).toBe(42)
    expect(json.comment?.message).toBe('Critical')
  })

  // ── Verified label 探测 ────────────────────────────────────────────

  it('Verified 不存在：跳过 Verified 投票（仅 Code-Review + submit）', async () => {
    installHandlers(changeWithoutVerified)

    const program = makeProgram('12345', { confirm: true })
    await Effect.runPromise(program)

    expect(counters.getChange).toBe(1)
    expect(counters.postReviewLabels).toBe(1) // 只有 Code-Review
    expect(counters.submitChange).toBe(1)

    const output = mockConsoleLog.mock.calls.map((call) => call[0]).join('\n')
    expect(output).toContain('Code-Review: +2')
    expect(output).not.toContain('Verified: +1')
  })

  it('--no-verified：跳过 Verified 投票即便 Verified label 存在', async () => {
    installHandlers(changeWithVerified)

    const program = makeProgram('12345', { confirm: true, noVerified: true })
    await Effect.runPromise(program)

    expect(counters.postReviewLabels).toBe(1) // 只有 Code-Review
    expect(counters.submitChange).toBe(1)
  })

  // ── 行号不存在 ─────────────────────────────────────────────────────

  it('--reject 路径：行号超出文件总行数时拒绝写', async () => {
    installHandlers(changeWithVerified, fileDiffShort)

    const program = makeProgram('12345', {
      confirm: true,
      reject: true,
      file: 'src/main.js',
      line: 100, // fileDiffShort.meta_b.lines = 10
      message: 'Out of range',
    })

    await expect(Effect.runPromise(program)).rejects.toThrow(/行号 100 超出.*总行数 10/)

    // 行号验证失败,不应该发 comment
    expect(counters.postReviewLineComment).toBe(0)
  })

  it('--reject 路径：file diff 404 时给出明确 hint', async () => {
    server.use(
      http.get('*/a/changes/12345/revisions/current/files/:filePath/diff', () => {
        counters.getFileDiff++
        return HttpResponse.text('File not found', { status: 404 })
      }),
    )

    const program = makeProgram('12345', {
      confirm: true,
      reject: true,
      file: 'no-such-file.js',
      line: 1,
      message: 'Nope',
    })

    await expect(Effect.runPromise(program)).rejects.toThrow(/无法获取文件 no-such-file.js 的 diff/)
    expect(counters.postReviewLineComment).toBe(0)
  })

  // ── 中途失败 ───────────────────────────────────────────────────────

  it('中途失败：comment postReview 失败时 submitChange 不会被调用', async () => {
    server.use(
      http.get('*/a/changes/12345', () => {
        counters.getChange++
        return HttpResponse.text(`)]}'\n${JSON.stringify(changeWithVerified)}`)
      }),
      http.post('*/a/changes/12345/revisions/current/review', async ({ request }) => {
        counters.postReviewTotal++
        const body = (await request.json()) as {
          labels?: Record<string, number>
          message?: string
        }
        if (body.labels) {
          counters.postReviewLabels++
        }
        if (body.message) {
          // 整体 comment 已被调用,但返回 500
          counters.postReviewComment++
          return HttpResponse.text('Internal Server Error', { status: 500 })
        }
        return HttpResponse.text(`)]}'\n{}`)
      }),
      http.post('*/a/changes/12345/submit', () => {
        counters.submitChange++
        return HttpResponse.text(`)]}'\n${JSON.stringify(submitResponse)}`)
      }),
    )

    const program = makeProgram('12345', { confirm: true, message: 'Will fail' })

    await expect(Effect.runPromise(program)).rejects.toThrow(/整体 comment 发送失败/)

    // Code-Review + Verified 都成功,comment 失败后 submit 必须未执行
    expect(counters.postReviewLabels).toBe(2)
    expect(counters.postReviewComment).toBe(1) // 整体 comment 被尝试调用
    expect(counters.submitChange).toBe(0) // 关键断言
  })

  it('中途失败：Code-Review 投票失败时后续步骤全部跳过', async () => {
    server.use(
      http.get('*/a/changes/12345', () => {
        counters.getChange++
        return HttpResponse.text(`)]}'\n${JSON.stringify(changeWithVerified)}`)
      }),
      http.post('*/a/changes/12345/revisions/current/review', () => {
        counters.postReviewTotal++
        return HttpResponse.text('Forbidden', { status: 403 })
      }),
      http.post('*/a/changes/12345/submit', () => {
        counters.submitChange++
        return HttpResponse.text(`)]}'\n${JSON.stringify(submitResponse)}`)
      }),
    )

    const program = makeProgram('12345', { confirm: true, message: 'x' })

    await expect(Effect.runPromise(program)).rejects.toThrow(/Code-Review \+2 投票失败/)

    expect(counters.postReviewLabels).toBe(0)
    expect(counters.submitChange).toBe(0)
  })

  // ── --no-submit / --no-verified ─────────────────────────────────────

  it('--no-submit：跳过 submitChange', async () => {
    installHandlers()

    const program = makeProgram('12345', { confirm: true, noSubmit: true, message: 'LGTM' })
    await Effect.runPromise(program)

    expect(counters.getChange).toBe(1)
    expect(counters.postReviewLabels).toBe(2)
    expect(counters.postReviewComment).toBe(1)
    expect(counters.submitChange).toBe(0)

    const output = mockConsoleLog.mock.calls.map((call) => call[0]).join('\n')
    expect(output).not.toContain('Submit:')
  })

  // ── --reject 必填校验 ─────────────────────────────────────────────

  it('--reject 必填校验：缺少 -m 时拒绝执行', async () => {
    const program = makeProgram('12345', {
      confirm: true,
      reject: true,
      file: 'src/main.js',
      line: 42,
    })

    await expect(Effect.runPromise(program)).rejects.toThrow(/-m\/--message/)

    expect(counters.getChange).toBe(0)
    expect(counters.postReviewTotal).toBe(0)
    expect(counters.getFileDiff).toBe(0)
  })

  it('--reject 必填校验：缺少 --file 时拒绝执行', async () => {
    const program = makeProgram('12345', {
      confirm: true,
      reject: true,
      line: 42,
      message: 'Critical',
    })

    await expect(Effect.runPromise(program)).rejects.toThrow(/--file/)
  })

  it('--reject 必填校验：缺少 --line 时拒绝执行', async () => {
    const program = makeProgram('12345', {
      confirm: true,
      reject: true,
      file: 'src/main.js',
      message: 'Critical',
    })

    await expect(Effect.runPromise(program)).rejects.toThrow(/--line/)
  })

  // ── 错误路径覆盖 ───────────────────────────────────────────────────

  it('--reject 路径 XML 输出包含 comment 块', async () => {
    installHandlers()

    const program = makeProgram('12345', {
      confirm: true,
      reject: true,
      file: 'src/main.js',
      line: 42,
      message: 'Critical',
      xml: true,
    })
    await Effect.runPromise(program)

    const output = mockConsoleLog.mock.calls.map((call) => call[0]).join('\n')
    expect(output).toContain('<review_result>')
    expect(output).toContain('<review_type>reject</review_type>')
    expect(output).toContain('<file>src/main.js</file>')
    expect(output).toContain('<line>42</line>')
    expect(output).toContain('<message><![CDATA[Critical]]></message>')
  })

  it('无问题路径：getChange 失败时给出友好错误（带原始 message）', async () => {
    server.use(
      http.get('*/a/changes/12345', () => {
        counters.getChange++
        return HttpResponse.text('Internal Server Error', { status: 500 })
      }),
    )

    const program = makeProgram('12345', { confirm: true })
    await expect(Effect.runPromise(program)).rejects.toThrow(/获取 change 失败/)
  })

  it('无问题路径：Verified 投票失败时给出友好错误（不阻断流程外层）', async () => {
    server.use(
      http.get('*/a/changes/12345', () => {
        counters.getChange++
        return HttpResponse.text(`)]}'\n${JSON.stringify(changeWithVerified)}`)
      }),
      http.post('*/a/changes/12345/revisions/current/review', async ({ request }) => {
        counters.postReviewTotal++
        const body = (await request.json()) as { labels?: Record<string, number> }
        if (body.labels && body.labels.Verified !== undefined) {
          // Verified +1 步骤失败
          return HttpResponse.text('Forbidden', { status: 403 })
        }
        return HttpResponse.text(`)]}'\n{}`)
      }),
      http.post('*/a/changes/12345/submit', () => {
        counters.submitChange++
        return HttpResponse.text(`)]}'\n${JSON.stringify(submitResponse)}`)
      }),
    )

    const program = makeProgram('12345', { confirm: true })
    await expect(Effect.runPromise(program)).rejects.toThrow(/Verified \+1 投票失败/)

    // Verified 失败后,submit 不应被调用
    expect(counters.submitChange).toBe(0)
  })

  it('无问题路径：Submit 失败时给出友好错误', async () => {
    server.use(
      http.get('*/a/changes/12345', () => {
        counters.getChange++
        return HttpResponse.text(`)]}'\n${JSON.stringify(changeWithVerified)}`)
      }),
      http.post('*/a/changes/12345/revisions/current/review', () => {
        counters.postReviewTotal++
        return HttpResponse.text(`)]}'\n{}`)
      }),
      http.post('*/a/changes/12345/submit', () => {
        counters.submitChange++
        return HttpResponse.text('Merge conflict', { status: 409 })
      }),
    )

    const program = makeProgram('12345', { confirm: true })
    await expect(Effect.runPromise(program)).rejects.toThrow(/Submit 失败/)
  })

  it('--reject 路径：行级 comment postReview 失败时给出友好错误（带 file:line）', async () => {
    server.use(
      http.get('*/a/changes/12345/revisions/current/files/:filePath/diff', () => {
        counters.getFileDiff++
        return HttpResponse.text(`)]}'\n${JSON.stringify(fileDiffOk)}`)
      }),
      http.post('*/a/changes/12345/revisions/current/review', () => {
        counters.postReviewTotal++
        return HttpResponse.text('Bad Request', { status: 400 })
      }),
    )

    const program = makeProgram('12345', {
      confirm: true,
      reject: true,
      file: 'src/main.js',
      line: 42,
      message: 'Critical',
    })
    await expect(Effect.runPromise(program)).rejects.toThrow(
      /行级 comment 发送失败.*目标 src\/main\.js:42/,
    )
  })

  // ── changeId 校验 ─────────────────────────────────────────────────

  it('changeId 缺失时给出友好错误', async () => {
    const program = makeProgram(undefined, { confirm: true })

    await expect(Effect.runPromise(program)).rejects.toThrow(/Change ID is required/)
  })

  it('changeId 为空白字符串时给出友好错误', async () => {
    const program = makeProgram('   ', { confirm: true })

    await expect(Effect.runPromise(program)).rejects.toThrow(/Change ID is required/)
  })
})
