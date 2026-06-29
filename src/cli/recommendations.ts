import { commandVisibleForRole, getCommandMeta, type RecommendationMeta } from './command-meta'
import { parseCliRole, type CliRole } from './roles'

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
  console.log(JSON.stringify(attachRecommendations(payload, context), null, 2))
}
