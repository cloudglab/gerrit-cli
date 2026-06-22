import { afterAll, afterEach, beforeAll, describe, expect, test } from '@test/compat'
import { Effect, Layer } from 'effect'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { GerritApiServiceLive } from '@/api/gerrit'
import { reportCommand } from '@/cli/commands/report'
import type { ChangeInfo } from '@/schemas/gerrit'
import { ConfigService } from '@/services/config'
import { createMockConfigService } from './helpers/config-mock'

const makeChange = (overrides: Partial<ChangeInfo> = {}): ChangeInfo => ({
  id: 'project~main~I123',
  _number: 12345,
  project: 'svc-foo',
  branch: 'main',
  change_id: 'I123',
  subject: 'Fix the important thing',
  status: 'NEW',
  created: '2025-06-16 10:00:00.000000000',
  updated: '2025-06-20 14:30:00.000000000',
  owner: { _account_id: 1, name: 'Alice', email: 'alice@x.com' },
  ...overrides,
})

const mockChanges: ChangeInfo[] = [
  makeChange({
    _number: 1,
    subject: 'Add feature',
    status: 'MERGED',
    submitted: '2025-06-18 09:15:00.000000000',
    insertions: 120,
    deletions: 30,
    labels: { 'Code-Review': { approved: { _account_id: 2 }, value: 2 } },
  }),
  makeChange({
    _number: 2,
    subject: 'WIP refactor',
    status: 'NEW',
    work_in_progress: true,
    updated: '2025-06-19 11:20:00.000000000',
    unresolved_comment_count: 2,
  }),
  makeChange({
    _number: 3,
    subject: 'Drop experiment',
    status: 'ABANDONED',
    updated: '2025-06-17 16:45:00.000000000',
  }),
  makeChange({
    _number: 4,
    subject: 'Old merged',
    status: 'MERGED',
    project: 'svc-bar',
    submitted: '2025-06-15 08:00:00.000000000',
    insertions: 50,
    deletions: 10,
  }),
]

const server = setupServer(
  http.get('*/a/accounts/self', () =>
    HttpResponse.json({ _account_id: 1, name: 'Alice', email: 'alice@x.com' }),
  ),
  http.get('*/a/changes/', () => HttpResponse.json(mockChanges)),
)

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterAll(() => server.close())
afterEach(() => server.resetHandlers())

const mockConfig = createMockConfigService()

const captureStdout = async (effect: Effect.Effect<void, unknown, unknown>): Promise<string> => {
  const logs: string[] = []
  const origLog = console.log
  console.log = (...args: unknown[]) => logs.push(String(args[0]))
  try {
    await Effect.runPromise(effect as never)
  } finally {
    console.log = origLog
  }
  return logs.join('\n')
}

describe('report command', () => {
  test('renders text with merged/open/abandoned buckets', async () => {
    const output = await captureStdout(
      reportCommand({ period: 'weekly' }).pipe(
        Effect.provide(GerritApiServiceLive),
        Effect.provide(Layer.succeed(ConfigService, mockConfig)),
      ),
    )
    expect(output).toContain('周报')
    expect(output).toContain('已合入')
    expect(output).toContain('进行中')
    expect(output).toContain('已丢弃')
    expect(output).toContain('Add feature')
    expect(output).toContain('WIP refactor')
    expect(output).toContain('Drop experiment')
    expect(output).toContain('合入 2')
    expect(output).toContain('留存 1')
    expect(output).toContain('丢弃 1')
    expect(output).toContain('新增 170')
    expect(output).toContain('删除 40')
  })

  test('outputs JSON with bucketed changes and aggregations', async () => {
    const output = await captureStdout(
      reportCommand({ period: 'monthly', json: true }).pipe(
        Effect.provide(GerritApiServiceLive),
        Effect.provide(Layer.succeed(ConfigService, mockConfig)),
      ),
    )
    const parsed = JSON.parse(output) as {
      period: string
      summary: { merged: number; open: number; abandoned: number; total: number }
      merged: { number: number; subject: string }[]
      open: { number: number }[]
      abandoned: { number: number }[]
      by_project: {
        project: string
        merged: number
        open: number
        abandoned: number
        total: number
      }[]
    }
    expect(parsed.period).toBe('monthly')
    expect(parsed.summary).toEqual({
      merged: 2,
      open: 1,
      abandoned: 1,
      total: 4,
      lines_added: 170,
      lines_deleted: 40,
      projects: 2,
    })
    expect(parsed.merged.map((c) => c.number).sort()).toEqual([1, 4])
    expect(parsed.open[0]?.number).toBe(2)
    expect(parsed.abandoned[0]?.number).toBe(3)
    expect(parsed.by_project[0]?.total).toBeGreaterThan(0)
  })

  test('outputs XML with bucketed structure', async () => {
    const output = await captureStdout(
      reportCommand({ period: 'weekly', xml: true }).pipe(
        Effect.provide(GerritApiServiceLive),
        Effect.provide(Layer.succeed(ConfigService, mockConfig)),
      ),
    )
    expect(output).toContain('<report')
    expect(output).toContain('<merged_changes count="2">')
    expect(output).toContain('<open_changes count="1">')
    expect(output).toContain('<abandoned_changes count="1">')
    expect(output).toContain('<by_project')
    expect(output).toContain('subject')
    expect(output).toContain('<change number="1"')
  })

  test('outputs Markdown suitable for emailing', async () => {
    const output = await captureStdout(
      reportCommand({ period: 'weekly', md: true }).pipe(
        Effect.provide(GerritApiServiceLive),
        Effect.provide(Layer.succeed(ConfigService, mockConfig)),
      ),
    )
    expect(output).toContain('# 周报')
    expect(output).toContain('## 本期已合入')
    expect(output).toContain('## 进行中')
    expect(output).toContain('## 已丢弃')
    expect(output).toContain('## 汇总')
    expect(output).toContain('Add feature')
    expect(output).toContain('svc-foo')
  })

  test('--status merged uses mergedafter/mergedbefore', async () => {
    let captured = ''
    server.use(
      http.get('*/a/changes/', ({ request }) => {
        captured = decodeURIComponent(request.url)
        return HttpResponse.json([])
      }),
    )

    await Effect.runPromise(
      reportCommand({ period: 'weekly', status: 'merged' }).pipe(
        Effect.provide(GerritApiServiceLive),
        Effect.provide(Layer.succeed(ConfigService, mockConfig)),
      ),
    )

    expect(captured).toContain('status:merged')
    expect(captured).toContain('mergedafter')
    expect(captured).toContain('mergedbefore')
    expect(captured).not.toContain(' after:"')
    expect(captured).not.toContain(' before:"')
  })

  test('default query uses after/before (not mergedafter)', async () => {
    let captured = ''
    server.use(
      http.get('*/a/changes/', ({ request }) => {
        captured = decodeURIComponent(request.url)
        return HttpResponse.json([])
      }),
    )

    await Effect.runPromise(
      reportCommand({ period: 'weekly' }).pipe(
        Effect.provide(GerritApiServiceLive),
        Effect.provide(Layer.succeed(ConfigService, mockConfig)),
      ),
    )

    expect(captured).toContain('after:')
    expect(captured).toContain('before:')
    expect(captured).not.toContain('mergedafter')
    expect(captured).toContain('owner:testuser')
  })

  test('--reviewer switches to reviewer query', async () => {
    let captured = ''
    server.use(
      http.get('*/a/changes/', ({ request }) => {
        captured = decodeURIComponent(request.url)
        return HttpResponse.json([])
      }),
    )

    await Effect.runPromise(
      reportCommand({ period: 'weekly', reviewer: true }).pipe(
        Effect.provide(GerritApiServiceLive),
        Effect.provide(Layer.succeed(ConfigService, mockConfig)),
      ),
    )

    expect(captured).toContain('reviewer:testuser')
    expect(captured).toContain('cc:testuser')
    expect(captured).not.toContain('owner:testuser')
  })

  test('--user overrides default username', async () => {
    let captured = ''
    server.use(
      http.get('*/a/changes/', ({ request }) => {
        captured = decodeURIComponent(request.url)
        return HttpResponse.json([])
      }),
    )

    await Effect.runPromise(
      reportCommand({ period: 'weekly', user: 'zhangsan' }).pipe(
        Effect.provide(GerritApiServiceLive),
        Effect.provide(Layer.succeed(ConfigService, mockConfig)),
      ),
    )

    expect(captured).toContain('owner:zhangsan')
    expect(captured).not.toContain('owner:testuser')
  })

  test('--period daily uses today as start', async () => {
    let captured = ''
    server.use(
      http.get('*/a/changes/', ({ request }) => {
        captured = decodeURIComponent(request.url)
        return HttpResponse.json([])
      }),
    )

    await Effect.runPromise(
      reportCommand({ period: 'daily' }).pipe(
        Effect.provide(GerritApiServiceLive),
        Effect.provide(Layer.succeed(ConfigService, mockConfig)),
      ),
    )

    const now = new Date()
    const yyyy = now.getFullYear()
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const dd = String(now.getDate()).padStart(2, '0')
    const today = `${yyyy}-${mm}-${dd}`
    expect(captured).toContain(`after:"${today}`)
    expect(captured).toContain('before:')
  })

  test('--since / --until override period defaults', async () => {
    let captured = ''
    server.use(
      http.get('*/a/changes/', ({ request }) => {
        captured = decodeURIComponent(request.url)
        return HttpResponse.json([])
      }),
    )

    await Effect.runPromise(
      reportCommand({ period: 'weekly', since: '2025-06-01', until: '2025-06-15' }).pipe(
        Effect.provide(GerritApiServiceLive),
        Effect.provide(Layer.succeed(ConfigService, mockConfig)),
      ),
    )

    expect(captured).toContain('after:"2025-06-01"')
    expect(captured).toContain('before:"2025-06-15"')
  })

  test('handles empty result set gracefully', async () => {
    server.use(http.get('*/a/changes/', () => HttpResponse.json([])))
    const output = await captureStdout(
      reportCommand({ period: 'weekly' }).pipe(
        Effect.provide(GerritApiServiceLive),
        Effect.provide(Layer.succeed(ConfigService, mockConfig)),
      ),
    )
    expect(output).toContain('已合入')
    expect(output).toContain('（无）')
    expect(output).toContain('合计 0')
  })

  test('quarterly output includes monthly trend section in MD', async () => {
    const output = await captureStdout(
      reportCommand({ period: 'quarterly', md: true }).pipe(
        Effect.provide(GerritApiServiceLive),
        Effect.provide(Layer.succeed(ConfigService, mockConfig)),
      ),
    )
    expect(output).toContain('# 季报')
    expect(output).toContain('## 按项目聚合')
    expect(output).toContain('## 月度趋势')
  })

  test('JSON output handles period without status filter', async () => {
    const output = await captureStdout(
      reportCommand({ period: 'daily', status: 'open', json: true }).pipe(
        Effect.provide(GerritApiServiceLive),
        Effect.provide(Layer.succeed(ConfigService, mockConfig)),
      ),
    )
    const parsed = JSON.parse(output) as {
      scope: { status: string; role: string; user: string }
      summary: { total: number }
    }
    expect(parsed.scope.status).toBe('open')
    expect(parsed.scope.role).toBe('owner')
    expect(parsed.scope.user).toBe('testuser')
  })
})
