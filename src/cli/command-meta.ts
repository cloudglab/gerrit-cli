import type { Command } from 'commander'
import { CLI_ROLES, type CliRole } from './roles'

export type CommandGroup =
  | 'config'
  | 'review'
  | 'change'
  | 'workspace'
  | 'ci'
  | 'groups'
  | 'analytics'
  | 'utility'

export type CostHint = 'low' | 'medium' | 'high'

export type RecommendationArgSource = 'input' | 'payload'

export interface RecommendationArgBinding {
  readonly source: RecommendationArgSource
  readonly path: string
  readonly template?: string
}

export interface RecommendationMeta {
  readonly tool: string
  readonly reason: string
  readonly priority: number
  readonly args?: Readonly<Record<string, RecommendationArgBinding>>
}

export interface CommandMeta {
  readonly name: string
  readonly group: CommandGroup
  readonly isWrite: boolean
  readonly roles: readonly CliRole[]
  readonly costHint?: CostHint
  readonly nextBestTools?: readonly string[]
  readonly recommendations?: readonly RecommendationMeta[]
}

const allRoles: readonly CliRole[] = CLI_ROLES

const defaultNextByGroup: Readonly<Record<CommandGroup, readonly string[]>> = {
  config: ['whoami', 'doctor', 'status', 'setup'],
  review: ['show', 'diff', 'comments', 'comment', 'vote', 'incoming'],
  change: ['show', 'search', 'mine', 'incoming', 'report'],
  workspace: ['checkout', 'push', 'rebase', 'tree', 'cherry'],
  ci: ['build-status', 'failures', 'extract-url', 'retrigger'],
  groups: ['groups', 'groups-show', 'groups-members'],
  analytics: ['report', 'analyze', 'failures', 'build-status'],
  utility: ['version', 'completion', 'whoami', 'doctor'],
}

export const defaultCostHint = (meta: Pick<CommandMeta, 'group' | 'isWrite'>): CostHint => {
  if (meta.isWrite) return 'high'
  if (meta.group === 'analytics') return 'medium'
  return 'low'
}

export const defaultNextBestTools = (meta: Pick<CommandMeta, 'group'>): readonly string[] =>
  defaultNextByGroup[meta.group]

export const effectiveCostHint = (meta: CommandMeta): CostHint =>
  meta.costHint ?? defaultCostHint(meta)

export const effectiveNextBestTools = (meta: CommandMeta): readonly string[] =>
  meta.nextBestTools ?? defaultNextBestTools(meta)

export const COMMAND_META: readonly CommandMeta[] = [
  { name: 'setup', group: 'config', isWrite: false, roles: allRoles },
  { name: 'init', group: 'config', isWrite: false, roles: allRoles },
  { name: 'status', group: 'config', isWrite: false, roles: allRoles },
  { name: 'config', group: 'config', isWrite: false, roles: allRoles },
  { name: 'whoami', group: 'config', isWrite: false, roles: allRoles },
  { name: 'doctor', group: 'config', isWrite: false, roles: allRoles },
  { name: 'version', group: 'utility', isWrite: false, roles: allRoles },
  { name: 'changelog', group: 'utility', isWrite: false, roles: allRoles },
  { name: 'completion', group: 'utility', isWrite: false, roles: allRoles },

  {
    name: 'show',
    group: 'review',
    isWrite: false,
    roles: ['full', 'dev', 'reviewer', 'lead'],
    recommendations: [
      {
        tool: 'diff',
        reason: '继续查看该变更的代码差异',
        priority: 2,
        args: { changeId: { source: 'input', path: 'changeId' } },
      },
      {
        tool: 'comments',
        reason: '继续查看该变更的评论线程',
        priority: 1,
        args: { changeId: { source: 'input', path: 'changeId' } },
      },
      {
        tool: 'build-status',
        reason: '继续检查该变更的构建状态',
        priority: 0,
        args: { changeId: { source: 'input', path: 'changeId' } },
      },
    ],
  },
  {
    name: 'diff',
    group: 'review',
    isWrite: false,
    roles: ['full', 'dev', 'reviewer', 'lead'],
    recommendations: [
      {
        tool: 'show',
        reason: '回看该变更的完整信息',
        priority: 1,
        args: { changeId: { source: 'input', path: 'changeId' } },
      },
      {
        tool: 'comments',
        reason: '查看这份 diff 上已有评论',
        priority: 0,
        args: { changeId: { source: 'input', path: 'changeId' } },
      },
    ],
  },
  {
    name: 'comments',
    group: 'review',
    isWrite: false,
    roles: ['full', 'dev', 'reviewer', 'lead'],
    recommendations: [
      {
        tool: 'comment',
        reason: '继续对该变更追加评论',
        priority: 2,
        args: { changeId: { source: 'input', path: 'changeId' } },
      },
      {
        tool: 'vote',
        reason: '在看完评论后给出评审分数',
        priority: 1,
        args: { changeId: { source: 'input', path: 'changeId' } },
      },
      {
        tool: 'show',
        reason: '回到变更总览继续审查',
        priority: 0,
        args: { changeId: { source: 'input', path: 'changeId' } },
      },
    ],
  },
  { name: 'comment', group: 'review', isWrite: true, roles: ['full', 'reviewer', 'lead'] },
  { name: 'vote', group: 'review', isWrite: true, roles: ['full', 'reviewer', 'lead'] },
  {
    name: 'review',
    group: 'review',
    isWrite: true,
    roles: ['full', 'reviewer', 'lead'],
    recommendations: [
      {
        tool: 'show',
        reason: '执行 review 前后查看该变更的完整状态',
        priority: 1,
        args: { changeId: { source: 'input', path: 'changeId' } },
      },
      {
        tool: 'comments',
        reason: '继续查看或复核该变更的评论线程',
        priority: 0,
        args: { changeId: { source: 'input', path: 'changeId' } },
      },
    ],
  },
  {
    name: 'reviewers',
    group: 'review',
    isWrite: false,
    roles: ['full', 'reviewer', 'lead'],
    recommendations: [
      {
        tool: 'show',
        reason: '回看该变更的完整审查信息',
        priority: 1,
        args: { changeId: { source: 'input', path: 'changeId' } },
      },
      {
        tool: 'add-reviewer',
        reason: '继续为该变更补充审查人',
        priority: 0,
        args: { changeId: { source: 'input', path: 'changeId' } },
      },
    ],
  },
  { name: 'add-reviewer', group: 'review', isWrite: true, roles: ['full', 'lead'] },
  { name: 'remove-reviewer', group: 'review', isWrite: true, roles: ['full', 'lead'] },

  {
    name: 'list',
    group: 'change',
    isWrite: false,
    roles: ['full', 'dev', 'reviewer', 'lead'],
    recommendations: [
      {
        tool: 'show',
        reason: '查看列表里第一条变更详情',
        priority: 2,
        args: { changeId: { source: 'payload', path: 'changes.0.number' } },
      },
      {
        tool: 'diff',
        reason: '继续查看列表里第一条变更的 diff',
        priority: 1,
        args: { changeId: { source: 'payload', path: 'changes.0.number' } },
      },
      {
        tool: 'build-status',
        reason: '检查列表里第一条变更的构建状态',
        priority: 0,
        args: { changeId: { source: 'payload', path: 'changes.0.number' } },
      },
    ],
  },
  {
    name: 'mine',
    group: 'change',
    isWrite: false,
    roles: ['full', 'dev', 'lead'],
    recommendations: [
      {
        tool: 'show',
        reason: '查看列表里第一条变更的详细信息',
        priority: 1,
        args: { changeId: { source: 'payload', path: 'changes.0.number' } },
      },
      {
        tool: 'report',
        reason: '汇总当前账号一段时间内的变更情况',
        priority: 0,
      },
    ],
  },
  {
    name: 'incoming',
    group: 'change',
    isWrite: false,
    roles: ['full', 'reviewer', 'lead'],
    recommendations: [
      {
        tool: 'show',
        reason: '查看待审列表里第一条变更详情',
        priority: 2,
        args: { changeId: { source: 'payload', path: 'changes.0.number' } },
      },
      {
        tool: 'diff',
        reason: '继续查看待审列表里第一条变更的 diff',
        priority: 1,
        args: { changeId: { source: 'payload', path: 'changes.0.number' } },
      },
      {
        tool: 'comments',
        reason: '查看待审列表里第一条变更的评论',
        priority: 0,
        args: { changeId: { source: 'payload', path: 'changes.0.number' } },
      },
    ],
  },
  { name: 'team', group: 'change', isWrite: false, roles: ['full', 'reviewer', 'lead'] },
  {
    name: 'search',
    group: 'change',
    isWrite: false,
    roles: ['full', 'dev', 'reviewer', 'lead'],
    recommendations: [
      {
        tool: 'show',
        reason: '查看搜索结果里第一条变更详情',
        priority: 2,
        args: { changeId: { source: 'payload', path: 'changes.0.number' } },
      },
      {
        tool: 'diff',
        reason: '直接查看搜索结果里第一条变更的 diff',
        priority: 1,
        args: { changeId: { source: 'payload', path: 'changes.0.number' } },
      },
      {
        tool: 'comments',
        reason: '查看搜索结果里第一条变更的评论',
        priority: 0,
        args: { changeId: { source: 'payload', path: 'changes.0.number' } },
      },
    ],
  },
  {
    name: 'projects',
    group: 'change',
    isWrite: false,
    roles: ['full', 'dev', 'lead'],
    recommendations: [
      {
        tool: 'search',
        reason: '继续搜索该项目下的变更',
        priority: 1,
        args: {
          query: {
            source: 'payload',
            path: 'projects.0.name',
            template: 'project:{{value}}',
          },
        },
      },
      {
        tool: 'list',
        reason: '回到当前账号的变更列表继续筛选',
        priority: 0,
      },
    ],
  },
  {
    name: 'files',
    group: 'change',
    isWrite: false,
    roles: ['full', 'dev', 'reviewer'],
    recommendations: [
      {
        tool: 'diff',
        reason: '继续查看该变更的完整 diff',
        priority: 1,
        args: { changeId: { source: 'input', path: 'changeId' } },
      },
      {
        tool: 'show',
        reason: '回到该变更的完整总览',
        priority: 0,
        args: { changeId: { source: 'input', path: 'changeId' } },
      },
    ],
  },
  { name: 'open', group: 'change', isWrite: false, roles: ['full', 'dev', 'reviewer', 'lead'] },
  { name: 'report', group: 'analytics', isWrite: false, roles: ['full', 'dev', 'lead'] },
  { name: 'daily', group: 'analytics', isWrite: false, roles: ['full', 'dev', 'lead'] },
  { name: 'weekly', group: 'analytics', isWrite: false, roles: ['full', 'dev', 'lead'] },
  { name: 'monthly', group: 'analytics', isWrite: false, roles: ['full', 'dev', 'lead'] },
  { name: 'quarterly', group: 'analytics', isWrite: false, roles: ['full', 'dev', 'lead'] },
  { name: 'topic', group: 'change', isWrite: true, roles: ['full', 'dev', 'lead'] },
  { name: 'submit', group: 'change', isWrite: true, roles: ['full', 'lead'] },
  { name: 'abandon', group: 'change', isWrite: true, roles: ['full', 'lead'] },
  { name: 'restore', group: 'change', isWrite: true, roles: ['full', 'lead'] },
  { name: 'set-ready', group: 'change', isWrite: true, roles: ['full', 'dev', 'lead'] },
  { name: 'set-wip', group: 'change', isWrite: true, roles: ['full', 'dev', 'lead'] },

  { name: 'checkout', group: 'workspace', isWrite: false, roles: ['full', 'dev'] },
  { name: 'push', group: 'workspace', isWrite: true, roles: ['full', 'dev'] },
  { name: 'rebase', group: 'workspace', isWrite: true, roles: ['full', 'dev'] },
  { name: 'workspace', group: 'workspace', isWrite: false, roles: ['full', 'dev'] },
  { name: 'tree', group: 'workspace', isWrite: true, roles: ['full', 'dev'] },
  { name: 'trees', group: 'workspace', isWrite: false, roles: allRoles },
  { name: 'cherry', group: 'workspace', isWrite: false, roles: ['full', 'dev'] },
  { name: 'clean', group: 'workspace', isWrite: true, roles: ['full', 'dev'] },

  {
    name: 'build-status',
    group: 'ci',
    isWrite: false,
    roles: ['full', 'dev', 'reviewer', 'ci'],
    recommendations: [
      {
        tool: 'show',
        reason: '回看该变更的完整上下文',
        priority: 1,
        args: { changeId: { source: 'input', path: 'changeId' } },
      },
      {
        tool: 'failures',
        reason: '如果构建异常，继续提取失败信息',
        priority: 0,
        args: { changeId: { source: 'input', path: 'changeId' } },
      },
    ],
  },
  {
    name: 'failures',
    group: 'ci',
    isWrite: false,
    roles: ['full', 'dev', 'reviewer', 'ci'],
    recommendations: [
      {
        tool: 'build-status',
        reason: '回查该变更当前的构建状态',
        priority: 1,
        args: { changeId: { source: 'input', path: 'changeId' } },
      },
      {
        tool: 'show',
        reason: '回看该变更完整上下文',
        priority: 0,
        args: { changeId: { source: 'input', path: 'changeId' } },
      },
    ],
  },
  { name: 'analyze', group: 'analytics', isWrite: false, roles: ['full', 'lead', 'ci'] },
  { name: 'extract-url', group: 'ci', isWrite: false, roles: ['full', 'dev', 'reviewer', 'ci'] },
  { name: 'retrigger', group: 'ci', isWrite: true, roles: ['full', 'dev', 'ci'] },
  { name: 'install-hook', group: 'ci', isWrite: true, roles: ['full', 'dev'] },

  {
    name: 'groups',
    group: 'groups',
    isWrite: false,
    roles: ['full', 'lead'],
    recommendations: [
      {
        tool: 'groups-show',
        reason: '查看列表里第一个组的详细信息',
        priority: 2,
        args: { groupId: { source: 'payload', path: 'groups.0.id' } },
      },
      {
        tool: 'groups-members',
        reason: '查看列表里第一个组的成员',
        priority: 1,
        args: { groupId: { source: 'payload', path: 'groups.0.id' } },
      },
    ],
  },
  {
    name: 'groups-show',
    group: 'groups',
    isWrite: false,
    roles: ['full', 'lead'],
    recommendations: [
      {
        tool: 'groups-members',
        reason: '继续查看该组成员列表',
        priority: 1,
        args: { groupId: { source: 'input', path: 'groupId' } },
      },
      {
        tool: 'groups',
        reason: '返回组列表继续浏览',
        priority: 0,
      },
    ],
  },
  {
    name: 'groups-members',
    group: 'groups',
    isWrite: false,
    roles: ['full', 'lead'],
    recommendations: [
      {
        tool: 'groups-show',
        reason: '回看该组的详细信息',
        priority: 1,
        args: { groupId: { source: 'input', path: 'groupId' } },
      },
      {
        tool: 'groups',
        reason: '返回组列表继续浏览',
        priority: 0,
      },
    ],
  },

  { name: 'install', group: 'utility', isWrite: true, roles: allRoles },
  { name: 'update', group: 'utility', isWrite: true, roles: allRoles },
  { name: 'upgrade', group: 'utility', isWrite: true, roles: allRoles },
  { name: 'uninstall', group: 'utility', isWrite: true, roles: allRoles },
  { name: 'remove', group: 'utility', isWrite: true, roles: allRoles },
] as const satisfies readonly CommandMeta[]

export function getCommandMeta(name: string): CommandMeta | undefined {
  return COMMAND_META.find((command) => command.name === name)
}

export function commandVisibleForRole(command: CommandMeta, role: CliRole): boolean {
  return command.roles.includes(role)
}

export function applyRoleFilter(program: Command, role: CliRole): void {
  if (role === 'full') return

  const visibleCommands = program.commands.filter((command) => {
    const meta = getCommandMeta(command.name())
    return meta ? commandVisibleForRole(meta, role) : true
  })
  Object.assign(program, { commands: visibleCommands })
}

/**
 * Build the help text block (预估成本 / 下一步推荐) for a given command name.
 * Returns empty string if no metadata is registered for the command.
 */
export function metaHelpText(name: string): string {
  const meta = getCommandMeta(name)
  if (!meta) return ''
  const cost = effectiveCostHint(meta)
  const next = effectiveNextBestTools(meta)
  let text = '\n预估成本: '
  text += cost
  text += '\n'
  if (next.length > 0) {
    text += `下一步推荐: ${next.join(', ')}\n`
  }
  return text
}

/**
 * Apply the meta help text (cost / next) to every registered subcommand.
 * Idempotent: addHelpText('after', ...) appends, so we only call once per command.
 */
export function applyMetaHelp(program: Command): void {
  for (const command of program.commands) {
    const block = metaHelpText(command.name())
    if (block) {
      command.addHelpText('after', block)
    }
  }
}
