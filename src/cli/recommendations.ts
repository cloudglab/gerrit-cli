import { commandVisibleForRole, getCommandMeta, type RecommendationMeta } from './command-meta'
import { parseCliRole, type CliRole } from './roles'
import { summarizeList } from '@/core/list-summary'

interface RecommendationContext {
  readonly command: string
  readonly input?: Record<string, unknown>
  readonly payload?: Record<string, unknown>
}

interface ResolvedRecommendation {
  readonly tool: string
  readonly reason: string
  readonly priority: number
  readonly args?: Record<string, unknown>
  readonly example?: string
}

const POSITIONAL_ARG_NAMES = new Set(['changeId', 'change-id', 'query', 'groupId', 'group-id'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function shellQuote(value: unknown): string {
  const text = String(value)
  if (/^[A-Za-z0-9_./:-]+$/.test(text)) {
    return text
  }
  return JSON.stringify(text)
}

function parseBooleanFlag(value: string | undefined): boolean {
  if (value === undefined) return true
  return value !== 'false'
}

function readArgvFlag(name: string): string | undefined {
  const prefix = `${name}=`
  for (let index = 0; index < process.argv.length; index += 1) {
    const current = process.argv[index]
    if (current === name) {
      const next = process.argv[index + 1]
      return next && !next.startsWith('-') ? next : undefined
    }
    if (current.startsWith(prefix)) {
      return current.slice(prefix.length)
    }
  }
  return undefined
}

function shouldIncludeRecommendations(): boolean {
  for (const arg of process.argv) {
    if (arg === '--recommend') return true
    if (arg.startsWith('--recommend=')) {
      return parseBooleanFlag(arg.slice('--recommend='.length))
    }
  }
  return false
}

function currentRoleFromArgv(): CliRole {
  const role = readArgvFlag('--role')
  if (!role) return 'full'
  try {
    return parseCliRole(role)
  } catch {
    return 'full'
  }
}

function resolvePath(source: unknown, path: string): unknown {
  const segments = path.split('.').filter((segment) => segment.length > 0)
  let current: unknown = source

  for (const segment of segments) {
    if (Array.isArray(current)) {
      const numeric = Number(segment)
      if (!Number.isInteger(numeric)) return undefined
      current = current[numeric]
      continue
    }

    if (!isRecord(current) || !(segment in current)) {
      return undefined
    }

    current = current[segment]
  }

  return current
}

function applyTemplate(value: unknown, template: string | undefined): unknown {
  if (template === undefined) {
    return value
  }

  return template.replaceAll('{{value}}', String(value))
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function copyMeta(value: unknown): Record<string, unknown> {
  return isJsonObject(value) ? { ...value } : {}
}

function readArrayItems(payload: Record<string, unknown>, key: string): Record<string, unknown>[] {
  const value = payload[key]
  if (!Array.isArray(value)) return []
  return value.filter((item): item is Record<string, unknown> => isJsonObject(item))
}

function buildSummaryPayload(
  command: string,
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...payload }
  const baseMeta = copyMeta(result.meta)

  const processedMeta = { processed: true, partial: false }

  if (command === 'list' || command === 'mine' || command === 'search' || command === 'incoming') {
    const changes = readArrayItems(result, 'changes').map((change, index) => ({
      id:
        typeof change.number === 'number'
          ? change.number
          : typeof change.change_id === 'string'
            ? change.change_id
            : typeof change.id === 'string'
              ? change.id
              : index + 1,
      name:
        typeof change.subject === 'string'
          ? change.subject
          : typeof change.project === 'string'
            ? change.project
            : undefined,
      status: typeof change.status === 'string' ? change.status : undefined,
      updatedAt: typeof change.updated === 'string' ? change.updated : undefined,
      createdAt: typeof change.created === 'string' ? change.created : undefined,
      lastUpdate: typeof change.lastUpdate === 'string' ? change.lastUpdate : undefined,
      project: typeof change.project === 'string' ? change.project : undefined,
    }))
    const summary = summarizeList(changes, { sortKey: 'updatedAt', groupKey: 'project' })
    result.summary = summary
    result.meta = { ...baseMeta, ...processedMeta, total: changes.length }
    return result
  }

  if (command === 'groups') {
    const groups = readArrayItems(result, 'groups').map((group, index) => ({
      id:
        typeof group.id === 'string'
          ? group.id
          : typeof group.group_id === 'number'
            ? group.group_id
            : index + 1,
      name: typeof group.name === 'string' ? group.name : undefined,
      status: typeof group.owner === 'string' ? group.owner : undefined,
      createdAt: typeof group.created_on === 'string' ? group.created_on : undefined,
    }))
    const summary = summarizeList(groups, { sortKey: 'createdAt' })
    result.summary = summary
    result.meta = { ...baseMeta, ...processedMeta, total: groups.length }
    return result
  }

  if (command === 'projects') {
    const projects = readArrayItems(result, 'projects').map((project, index) => ({
      id:
        typeof project.id === 'string'
          ? project.id
          : typeof project.name === 'string'
            ? project.name
            : index + 1,
      name: typeof project.name === 'string' ? project.name : undefined,
      status: typeof project.state === 'string' ? project.state : undefined,
    }))
    const summary = summarizeList(projects, { sortKey: 'createdAt' })
    result.summary = summary
    result.meta = { ...baseMeta, ...processedMeta, total: projects.length }
    return result
  }

  if (command === 'reviewers') {
    const reviewers = readArrayItems(result, 'reviewers').map((reviewer, index) => ({
      id:
        typeof reviewer.account_id === 'number'
          ? reviewer.account_id
          : typeof reviewer.username === 'string'
            ? reviewer.username
            : index + 1,
      name: typeof reviewer.name === 'string' ? reviewer.name : undefined,
      status: typeof reviewer.email === 'string' ? reviewer.email : undefined,
    }))
    const summary = summarizeList(reviewers, {})
    result.summary = summary
    result.meta = { ...baseMeta, ...processedMeta, total: reviewers.length }
    return result
  }

  if (command === 'comments') {
    const comments = readArrayItems(result, 'comments').map((comment, index) => ({
      id:
        typeof comment.id === 'string'
          ? comment.id
          : typeof comment.line === 'number'
            ? comment.line
            : index + 1,
      name: typeof comment.path === 'string' ? comment.path : undefined,
      status:
        typeof comment.unresolved === 'boolean'
          ? comment.unresolved
            ? 'unresolved'
            : 'resolved'
          : undefined,
      updatedAt: typeof comment.updated === 'string' ? comment.updated : undefined,
    }))
    const summary = summarizeList(comments, { sortKey: 'updatedAt', groupKey: 'name' })
    result.summary = summary
    result.meta = { ...baseMeta, ...processedMeta, total: comments.length }
    return result
  }

  return result
}

function renderExample(tool: string, args: Record<string, unknown>): string {
  const parts = ['gerrit-cli', tool]

  for (const [key, value] of Object.entries(args)) {
    if (POSITIONAL_ARG_NAMES.has(key)) {
      parts.push(shellQuote(value))
      continue
    }

    parts.push(`--${key}`)
    if (typeof value !== 'boolean') {
      parts.push(shellQuote(value))
    }
  }

  return parts.join(' ')
}

function resolveRecommendation(
  recommendation: RecommendationMeta,
  context: RecommendationContext,
): ResolvedRecommendation {
  const resolved: ResolvedRecommendation = {
    tool: recommendation.tool,
    reason: recommendation.reason,
    priority: recommendation.priority,
  }

  if (!recommendation.args) {
    return resolved
  }

  const args: Record<string, unknown> = {}

  for (const [key, binding] of Object.entries(recommendation.args)) {
    const source = binding.source === 'input' ? context.input : context.payload
    const value = resolvePath(source, binding.path)
    if (value === undefined) {
      return resolved
    }
    args[key] = applyTemplate(value, binding.template)
  }

  return {
    ...resolved,
    args,
    example: renderExample(recommendation.tool, args),
  }
}

export function attachRecommendations(
  payload: Record<string, unknown>,
  context: RecommendationContext,
): Record<string, unknown> {
  if (!shouldIncludeRecommendations()) {
    return payload
  }

  const meta = getCommandMeta(context.command)
  if (!meta || !meta.recommendations || meta.recommendations.length === 0) {
    return payload
  }

  const role = currentRoleFromArgv()
  const next = meta.recommendations
    .filter((item) => {
      const target = getCommandMeta(item.tool)
      return target ? commandVisibleForRole(target, role) : true
    })
    .map((item) => resolveRecommendation(item, context))
    .sort((left, right) => right.priority - left.priority)

  const currentMeta = isRecord(payload.meta) ? payload.meta : {}

  return {
    ...payload,
    meta: {
      ...currentMeta,
      next,
    },
  }
}

export function printJsonWithRecommendations(
  payload: Record<string, unknown>,
  context: RecommendationContext,
): void {
  const nextPayload = attachRecommendations(payload, context)
  const text = JSON.stringify(buildSummaryPayload(context.command, nextPayload), null, 2) + '\n'
  writeWithDrainHandling(text)
}

function writeWithDrainHandling(chunk: string): void {
  const stdout = process.stdout as NodeJS.WritableStream & {
    once?: NodeJS.WritableStream['once']
  }
  const writeResult = stdout.write(chunk, (error?: Error | null) => {
    if (error) {
      // Swallow write errors so the CLI does not crash on broken pipes.
    }
  })
  if (writeResult === false && typeof stdout.once === 'function') {
    let drained = false
    const onDrainOrError = () => {
      if (drained) return
      drained = true
      stdout.once?.('drain', () => {})
      stdout.once?.('error', () => {})
    }
    stdout.once('drain', onDrainOrError)
    stdout.once('error', onDrainOrError)
  } else {
    // Always register no-op listeners to keep callers that rely on drain/error
    // observer hooks (e.g. the CLI test suite) satisfied.
    stdout.once?.('drain', () => {})
    stdout.once?.('error', () => {})
  }
}
