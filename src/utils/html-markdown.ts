import TurndownService from 'turndown'

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
})

const HTML_TAG_RE = /<\/?[a-z][^>]*>/i

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toMarkdown(html: string): string {
  try {
    return turndown.turndown(html).trim()
  } catch {
    return ''
  }
}

export function addMarkdownForAi(value: unknown): unknown {
  return transformValue(value, new WeakSet<object>(), 0)
}

function transformValue(value: unknown, seen: WeakSet<object>, depth: number): unknown {
  if (depth > 12) return value

  if (Array.isArray(value)) {
    return value.map((item) => transformValue(item, seen, depth + 1))
  }

  if (!isRecord(value)) {
    return value
  }

  if (seen.has(value)) {
    return value
  }
  seen.add(value)

  const next: Record<string, unknown> = {}
  for (const [key, fieldValue] of Object.entries(value)) {
    next[key] = transformValue(fieldValue, seen, depth + 1)

    if (typeof fieldValue === 'string' && HTML_TAG_RE.test(fieldValue)) {
      const markdown = toMarkdown(fieldValue)
      const siblingKey = `${key}Markdown`
      if (!(siblingKey in value) && markdown !== '') {
        next[siblingKey] = markdown
      }
    }
  }
  return next
}
