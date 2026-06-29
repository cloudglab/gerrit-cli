import { afterEach, describe, expect, it, vi } from 'vitest'
import { attachRecommendations } from '@/cli/recommendations'

const originalArgv = process.argv

afterEach(() => {
  process.argv = originalArgv
  vi.restoreAllMocks()
})

describe('attachRecommendations', () => {
  it('在 --recommend 时注入 meta.next', () => {
    process.argv = ['node', 'gerrit-cli', 'show', '--json', '--recommend']

    const payload = attachRecommendations(
      { status: 'success', change: { number: 12345 } },
      {
        command: 'show',
        input: { changeId: '12345' },
        payload: { status: 'success', change: { number: 12345 } },
      },
    )

    expect(payload).toMatchObject({
      meta: {
        next: [
          { tool: 'diff', args: { changeId: '12345' }, example: 'gerrit-cli diff 12345' },
          { tool: 'comments', args: { changeId: '12345' } },
          { tool: 'build-status', args: { changeId: '12345' } },
        ],
      },
    })
  })

  it('不传 --recommend 时不注入', () => {
    process.argv = ['node', 'gerrit-cli', 'show', '--json']

    const payload = attachRecommendations(
      { status: 'success' },
      { command: 'show', input: { changeId: '12345' }, payload: { status: 'success' } },
    )

    expect(payload).toEqual({ status: 'success' })
  })

  it('--recommend=false 时不注入', () => {
    process.argv = ['node', 'gerrit-cli', 'show', '--json', '--recommend=false']

    const payload = attachRecommendations(
      { status: 'success' },
      { command: 'show', input: { changeId: '12345' }, payload: { status: 'success' } },
    )

    expect(payload).toEqual({ status: 'success' })
  })

  it('路径解析失败时保留条目但省略 args 和 example', () => {
    process.argv = ['node', 'gerrit-cli', 'search', '--json', '--recommend']

    const payload = attachRecommendations(
      { status: 'success', changes: [] },
      { command: 'search', payload: { status: 'success', changes: [] } },
    )

    expect(payload).toMatchObject({
      meta: {
        next: [{ tool: 'show' }, { tool: 'diff' }, { tool: 'comments' }],
      },
    })

    const meta = payload.meta
    expect(typeof meta).toBe('object')
    if (meta && typeof meta === 'object' && 'next' in meta && Array.isArray(meta.next)) {
      for (const item of meta.next) {
        expect(item).not.toHaveProperty('args')
        expect(item).not.toHaveProperty('example')
      }
    }
  })

  it('按角色过滤不可见推荐', () => {
    process.argv = ['node', 'gerrit-cli', 'reviewers', '--json', '--recommend', '--role', 'reviewer']

    const payload = attachRecommendations(
      { status: 'success', reviewers: [] },
      {
        command: 'reviewers',
        input: { changeId: '12345' },
        payload: { status: 'success', reviewers: [] },
      },
    )

    expect(payload).toMatchObject({
      meta: {
        next: [{ tool: 'show' }],
      },
    })
  })

  it('从 payload 预填列表第一项参数', () => {
    process.argv = ['node', 'gerrit-cli', 'list', '--json', '--recommend']

    const payload = attachRecommendations(
      { status: 'success', changes: [{ number: 67890 }] },
      {
        command: 'list',
        payload: { status: 'success', changes: [{ number: 67890 }] },
      },
    )

    expect(payload).toMatchObject({
      meta: {
        next: [
          { tool: 'show', args: { changeId: 67890 }, example: 'gerrit-cli show 67890' },
          { tool: 'diff', args: { changeId: 67890 } },
          { tool: 'build-status', args: { changeId: 67890 } },
        ],
      },
    })
  })

  it('build-status 单次查询可注入推荐', () => {
    process.argv = ['node', 'gerrit-cli', 'build-status', '--json', '--recommend']

    const payload = attachRecommendations(
      { state: 'success' },
      {
        command: 'build-status',
        input: { changeId: '12345' },
        payload: { state: 'success' },
      },
    )

    expect(payload).toMatchObject({
      meta: {
        next: [
          { tool: 'show', args: { changeId: '12345' } },
          { tool: 'failures', args: { changeId: '12345' } },
        ],
      },
    })
  })

  it('groups 从 payload 预填 groupId', () => {
    process.argv = ['node', 'gerrit-cli', 'groups', '--json', '--recommend']

    const payload = attachRecommendations(
      { status: 'success', groups: [{ id: 'dev-group' }] },
      {
        command: 'groups',
        payload: { status: 'success', groups: [{ id: 'dev-group' }] },
      },
    )

    expect(payload).toMatchObject({
      meta: {
        next: [
          {
            tool: 'groups-show',
            args: { groupId: 'dev-group' },
            example: 'gerrit-cli groups-show dev-group',
          },
          { tool: 'groups-members', args: { groupId: 'dev-group' } },
        ],
      },
    })
  })

  it('groups-show 透传 groupId 给 groups-members', () => {
    process.argv = ['node', 'gerrit-cli', 'groups-show', '--json', '--recommend']

    const payload = attachRecommendations(
      { status: 'success', group: { id: 'qa-group' } },
      {
        command: 'groups-show',
        input: { groupId: 'qa-group' },
        payload: { status: 'success', group: { id: 'qa-group' } },
      },
    )

    expect(payload).toMatchObject({
      meta: {
        next: [
          { tool: 'groups-members', args: { groupId: 'qa-group' } },
          { tool: 'groups' },
        ],
      },
    })
  })

  it('支持参数模板生成更自然的查询参数', () => {
    process.argv = ['node', 'gerrit-cli', 'projects', '--json', '--recommend']

    const payload = attachRecommendations(
      { status: 'success', projects: [{ name: 'platform/app' }] },
      {
        command: 'projects',
        payload: { status: 'success', projects: [{ name: 'platform/app' }] },
      },
    )

    expect(payload).toMatchObject({
      meta: {
        next: [
          {
            tool: 'search',
            args: { query: 'project:platform/app' },
            example: 'gerrit-cli search project:platform/app',
          },
          { tool: 'list' },
        ],
      },
    })
  })

  it('模板参数含空格时 example 会自动加引号', () => {
    process.argv = ['node', 'gerrit-cli', 'projects', '--json', '--recommend']

    const payload = attachRecommendations(
      { status: 'success', projects: [{ name: 'platform core/api' }] },
      {
        command: 'projects',
        payload: { status: 'success', projects: [{ name: 'platform core/api' }] },
      },
    )

    expect(payload).toMatchObject({
      meta: {
        next: expect.arrayContaining([
          expect.objectContaining({
            tool: 'search',
            args: { query: 'project:platform core/api' },
            example: 'gerrit-cli search "project:platform core/api"',
          }),
        ]),
      },
    })
  })
})
