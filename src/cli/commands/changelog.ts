import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

interface ChangelogOptions {
  version?: string
  limit?: number
  json?: boolean
  xml?: boolean
}

interface ChangelogSection {
  readonly title: string
  readonly items: readonly string[]
}

interface ParsedChangelog {
  readonly latest: ChangelogSection | undefined
  readonly sections: readonly ChangelogSection[]
}

const readChangelogPath = (): string => {
  const candidates = [
    join(process.cwd(), 'CHANGELOG.md'),
    join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'CHANGELOG.md'),
  ]
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }
  return candidates[0] ?? 'CHANGELOG.md'
}

const parseChangelog = (raw: string): ParsedChangelog => {
  const lines = raw.split(/\r?\n/)
  const sections: ChangelogSection[] = []
  let current: { title: string; items: string[] } | undefined
  let inIntro = true

  for (const line of lines) {
    const heading = line.match(/^##\s+(.+?)\s*$/)
    if (heading && heading[1]) {
      if (current) sections.push({ title: current.title, items: current.items })
      current = { title: heading[1], items: [] }
      inIntro = false
      continue
    }
    if (inIntro) continue
    if (!current) continue
    if (/^\s*-\s+/.test(line)) {
      const item = line.replace(/^\s*-\s+/, '').trim()
      if (item) current.items.push(item)
    }
  }
  if (current) sections.push({ title: current.title, items: current.items })

  return { latest: sections[0], sections }
}

const readChangelog = (): string => {
  try {
    return readFileSync(readChangelogPath(), 'utf8')
  } catch {
    return ''
  }
}

const matchesVersion = (title: string, version: string): boolean =>
  title.toLowerCase().startsWith(version.toLowerCase())

const formatPlain = (
  sections: readonly ChangelogSection[],
  versionFilter: string | undefined,
): string => {
  const filtered = versionFilter
    ? sections.filter((s) => matchesVersion(s.title, versionFilter))
    : sections.slice(0, 1)

  if (filtered.length === 0) {
    return versionFilter ? `未找到版本 ${versionFilter} 的 changelog 条目。` : '暂无 changelog。'
  }

  return filtered
    .map((s) => {
      const items = s.items.length > 0 ? s.items.map((i) => `  - ${i}`).join('\n') : '  (no items)'
      return `## ${s.title}\n${items}`
    })
    .join('\n\n')
}

const formatJson = (
  sections: readonly ChangelogSection[],
  versionFilter: string | undefined,
): string => {
  const filtered = versionFilter
    ? sections.filter((s) => matchesVersion(s.title, versionFilter))
    : sections.slice(0, 1)
  return JSON.stringify(
    {
      status: 'success',
      sections: filtered.map((s) => ({ title: s.title, items: s.items })),
    },
    null,
    2,
  )
}

const formatXml = (
  sections: readonly ChangelogSection[],
  versionFilter: string | undefined,
): string => {
  const filtered = versionFilter
    ? sections.filter((s) => matchesVersion(s.title, versionFilter))
    : sections.slice(0, 1)
  const lines: string[] = [`<?xml version="1.0" encoding="UTF-8"?>`, `<changelog>`]
  for (const s of filtered) {
    lines.push(`  <section title="${s.title.replace(/"/g, '&quot;')}">`)
    for (const item of s.items) {
      lines.push(`    <item><![CDATA[${item}]]></item>`)
    }
    lines.push(`  </section>`)
  }
  lines.push(`</changelog>`)
  return lines.join('\n')
}

export function changelogCommand(options: ChangelogOptions): void {
  const raw = readChangelog()
  if (!raw) {
    console.log('未找到 CHANGELOG.md')
    return
  }
  const parsed = parseChangelog(raw)

  if (options.json) {
    console.log(formatJson(parsed.sections, options.version))
    return
  }
  if (options.xml) {
    console.log(formatXml(parsed.sections, options.version))
    return
  }
  console.log(formatPlain(parsed.sections, options.version))
}
