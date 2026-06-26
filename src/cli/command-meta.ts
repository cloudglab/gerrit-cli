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

export interface CommandMeta {
  readonly name: string
  readonly group: CommandGroup
  readonly isWrite: boolean
  readonly roles: readonly CliRole[]
  readonly costHint?: CostHint
  readonly nextBestTools?: readonly string[]
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

  { name: 'show', group: 'review', isWrite: false, roles: ['full', 'dev', 'reviewer', 'lead'] },
  { name: 'diff', group: 'review', isWrite: false, roles: ['full', 'dev', 'reviewer', 'lead'] },
  { name: 'comments', group: 'review', isWrite: false, roles: ['full', 'dev', 'reviewer', 'lead'] },
  { name: 'comment', group: 'review', isWrite: true, roles: ['full', 'reviewer', 'lead'] },
  { name: 'vote', group: 'review', isWrite: true, roles: ['full', 'reviewer', 'lead'] },
  {
    name: 'review',
    group: 'review',
    isWrite: true,
    roles: ['full', 'reviewer', 'lead'],
    costHint: 'high',
    nextBestTools: ['show', 'diff', 'comments', 'comment', 'vote', 'incoming'],
  },
  { name: 'reviewers', group: 'review', isWrite: false, roles: ['full', 'reviewer', 'lead'] },
  { name: 'add-reviewer', group: 'review', isWrite: true, roles: ['full', 'lead'] },
  { name: 'remove-reviewer', group: 'review', isWrite: true, roles: ['full', 'lead'] },

  { name: 'list', group: 'change', isWrite: false, roles: ['full', 'dev', 'reviewer', 'lead'] },
  { name: 'mine', group: 'change', isWrite: false, roles: ['full', 'dev', 'lead'] },
  { name: 'incoming', group: 'change', isWrite: false, roles: ['full', 'reviewer', 'lead'] },
  { name: 'team', group: 'change', isWrite: false, roles: ['full', 'reviewer', 'lead'] },
  { name: 'search', group: 'change', isWrite: false, roles: ['full', 'dev', 'reviewer', 'lead'] },
  { name: 'projects', group: 'change', isWrite: false, roles: ['full', 'dev', 'lead'] },
  { name: 'files', group: 'change', isWrite: false, roles: ['full', 'dev', 'reviewer'] },
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

  { name: 'build-status', group: 'ci', isWrite: false, roles: ['full', 'dev', 'reviewer', 'ci'] },
  { name: 'failures', group: 'ci', isWrite: false, roles: ['full', 'dev', 'reviewer', 'ci'] },
  { name: 'analyze', group: 'analytics', isWrite: false, roles: ['full', 'lead', 'ci'] },
  { name: 'extract-url', group: 'ci', isWrite: false, roles: ['full', 'dev', 'reviewer', 'ci'] },
  { name: 'retrigger', group: 'ci', isWrite: true, roles: ['full', 'dev', 'ci'] },
  { name: 'install-hook', group: 'ci', isWrite: true, roles: ['full', 'dev'] },

  { name: 'groups', group: 'groups', isWrite: false, roles: ['full', 'lead'] },
  { name: 'groups-show', group: 'groups', isWrite: false, roles: ['full', 'lead'] },
  { name: 'groups-members', group: 'groups', isWrite: false, roles: ['full', 'lead'] },

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
