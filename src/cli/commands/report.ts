import { Effect } from 'effect'
import { GerritApiService } from '@/api/gerrit'
import { ApiError } from '@/api/gerrit-types'
import type { ChangeInfo } from '@/schemas/gerrit'
import { ConfigError, ConfigService, type ConfigServiceImpl } from '@/services/config'
import { colors } from '@/utils/formatters'

// ─── Types ──────────────────────────────────────────────────────────────────

export type ReportPeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly'
export type ReportStatus = 'merged' | 'open' | 'abandoned' | 'all'
export type ReportRole = 'owner' | 'reviewer'

export interface ReportOptions {
  period?: ReportPeriod
  since?: string
  until?: string
  status?: ReportStatus
  reviewer?: boolean
  user?: string
  limit?: number
  json?: boolean
  xml?: boolean
  md?: boolean
}

interface DateRange {
  readonly from: string
  readonly to: string
}

interface ChangeBuckets {
  readonly merged: readonly ChangeInfo[]
  readonly open: readonly ChangeInfo[]
  readonly abandoned: readonly ChangeInfo[]
}

interface ProjectStats {
  readonly project: string
  readonly merged: number
  readonly open: number
  readonly abandoned: number
  readonly total: number
}

interface AuthorStats {
  readonly author: string
  readonly count: number
}

interface DayStats {
  readonly day: string
  readonly merged: number
  readonly open: number
  readonly abandoned: number
  readonly total: number
}

// ─── Time window helpers ────────────────────────────────────────────────────

const pad2 = (n: number): string => String(n).padStart(2, '0')

const toIsoDate = (d: Date): string =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`

const parseLocalDate = (s: string): Date => {
  const parts = s.split('-').map(Number)
  const y = parts[0] ?? 1970
  const m = parts[1] ?? 1
  const d = parts[2] ?? 1
  return new Date(y, m - 1, d)
}

const startOfDay = (d: Date): Date => {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

const endOfDay = (d: Date): Date => {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}

const computeRange = (
  period: ReportPeriod | undefined,
  since: string | undefined,
  until: string | undefined,
): DateRange => {
  const now = new Date()
  const hasCustom = Boolean(since || until)
  const p: ReportPeriod = period ?? (hasCustom ? 'weekly' : 'weekly')

  let start: Date
  if (p === 'daily') {
    start = startOfDay(now)
  } else if (p === 'weekly') {
    start = startOfDay(now)
    const dow = start.getDay()
    const offset = dow === 0 ? 6 : dow - 1
    start.setDate(start.getDate() - offset)
  } else if (p === 'monthly') {
    start = new Date(now.getFullYear(), now.getMonth(), 1)
  } else {
    const q = Math.floor(now.getMonth() / 3)
    start = new Date(now.getFullYear(), q * 3, 1)
  }

  const from = since ? startOfDay(parseLocalDate(since)) : start
  const to = until ? endOfDay(parseLocalDate(until)) : now
  return { from: toIsoDate(from), to: toIsoDate(to) }
}

const buildQuery = (
  user: string,
  role: ReportRole,
  range: DateRange,
  status: ReportStatus,
): string => {
  const userTerm = role === 'reviewer' ? `(reviewer:${user} OR cc:${user})` : `owner:${user}`
  const statusTerm = status === 'all' ? '' : `status:${status}`
  const timeTerm =
    status === 'merged'
      ? `mergedafter:"${range.from}" mergedbefore:"${range.to}"`
      : `after:"${range.from}" before:"${range.to}"`
  return [userTerm, statusTerm, timeTerm].filter((s) => s.length > 0).join(' ')
}

// ─── Aggregation helpers ────────────────────────────────────────────────────

const bucketByStatus = (changes: readonly ChangeInfo[]): ChangeBuckets => {
  const merged: ChangeInfo[] = []
  const open: ChangeInfo[] = []
  const abandoned: ChangeInfo[] = []
  for (const c of changes) {
    if (c.status === 'MERGED') merged.push(c)
    else if (c.status === 'ABANDONED') abandoned.push(c)
    else open.push(c)
  }
  return { merged, open, abandoned }
}

const aggregateByProject = (changes: readonly ChangeInfo[]): readonly ProjectStats[] => {
  const map = new Map<string, { merged: number; open: number; abandoned: number; total: number }>()
  for (const c of changes) {
    const cur = map.get(c.project) ?? { merged: 0, open: 0, abandoned: 0, total: 0 }
    if (c.status === 'MERGED') cur.merged += 1
    else if (c.status === 'ABANDONED') cur.abandoned += 1
    else cur.open += 1
    cur.total += 1
    map.set(c.project, cur)
  }
  return Array.from(map.entries())
    .map(([project, stats]) => ({ project, ...stats }))
    .sort((a, b) => b.total - a.total)
}

const aggregateByAuthor = (changes: readonly ChangeInfo[]): readonly AuthorStats[] => {
  const map = new Map<string, number>()
  for (const c of changes) {
    const name = c.owner?.name ?? c.owner?.email ?? 'unknown'
    map.set(name, (map.get(name) ?? 0) + 1)
  }
  return Array.from(map.entries())
    .map(([author, count]) => ({ author, count }))
    .sort((a, b) => b.count - a.count)
}

const aggregateByDay = (
  changes: readonly ChangeInfo[],
  field: 'updated' | 'submitted',
): readonly DayStats[] => {
  const map = new Map<string, { merged: number; open: number; abandoned: number; total: number }>()
  for (const c of changes) {
    const raw = (field === 'submitted' ? c.submitted : c.updated) ?? c.created ?? ''
    if (!raw) continue
    const day = raw.slice(0, 10)
    const cur = map.get(day) ?? { merged: 0, open: 0, abandoned: 0, total: 0 }
    if (c.status === 'MERGED') cur.merged += 1
    else if (c.status === 'ABANDONED') cur.abandoned += 1
    else cur.open += 1
    cur.total += 1
    map.set(day, cur)
  }
  return Array.from(map.entries())
    .map(([day, stats]) => ({ day, ...stats }))
    .sort((a, b) => a.day.localeCompare(b.day))
}

const totalLineStats = (
  changes: readonly ChangeInfo[],
): { readonly added: number; readonly deleted: number } => {
  let added = 0
  let deleted = 0
  for (const c of changes) {
    added += c.insertions ?? 0
    deleted += c.deletions ?? 0
  }
  return { added, deleted }
}

// ─── Formatting helpers ─────────────────────────────────────────────────────

const parseGerritDate = (s: string | undefined): Date | undefined => {
  if (!s) return undefined
  const normalized = s.includes('T') ? s : s.replace(' ', 'T').split('.')[0] + 'Z'
  const d = new Date(normalized)
  return Number.isNaN(d.getTime()) ? undefined : d
}

const formatHm = (s: string | undefined): string => {
  const d = parseGerritDate(s)
  if (!d) return '-'
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

const formatMdDay = (s: string | undefined): string => {
  const d = parseGerritDate(s)
  if (!d) return '-'
  return `${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

const formatDayLabel = (iso: string): string => {
  const d = parseLocalDate(iso)
  const weekdays = ['日', '一', '二', '三', '四', '五', '六']
  const dayIndex = d.getDay() < 0 || d.getDay() > 6 ? 0 : d.getDay()
  return `${iso.slice(5)} (${weekdays[dayIndex]})`
}

const escapeXml = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')

const sanitizeCDATA = (s: string): string => s.replace(/\]\]>/g, ']]]]><![CDATA[>')

const statusLabel = (c: ChangeInfo): string => {
  if (c.status === 'MERGED') return 'merged'
  if (c.status === 'ABANDONED') return 'abandoned'
  if (c.status === 'DRAFT') return 'draft'
  return 'open'
}

const formatRangeLabel = (range: DateRange, period: ReportPeriod | undefined): string => {
  if (period === 'daily') return `${range.from}`
  if (period === 'weekly') return `本周 (${range.from} ~ ${range.to})`
  if (period === 'monthly') return `${range.from.slice(0, 7)}`
  if (period === 'quarterly') {
    const q = Math.floor(new Date(range.from).getMonth() / 3) + 1
    return `${range.from.slice(0, 4)} Q${q}`
  }
  return `${range.from} ~ ${range.to}`
}

// ─── Renderers ──────────────────────────────────────────────────────────────

const renderJson = (
  changes: readonly ChangeInfo[],
  options: ReportOptions,
  range: DateRange,
  user: string,
  role: ReportRole,
): void => {
  const buckets = bucketByStatus(changes)
  const projects = aggregateByProject(changes)
  const authors = aggregateByAuthor(changes)
  const dayField: 'updated' | 'submitted' = options.status === 'merged' ? 'submitted' : 'updated'
  const days = aggregateByDay(changes, dayField)
  const lines = totalLineStats(changes)

  const payload = {
    period: options.period ?? 'custom',
    date_range: {
      from: `${range.from}T00:00:00`,
      to: `${range.to}T23:59:59`,
    },
    scope: {
      role,
      user,
      status: options.status ?? 'all',
    },
    summary: {
      merged: buckets.merged.length,
      open: buckets.open.length,
      abandoned: buckets.abandoned.length,
      total: changes.length,
      lines_added: lines.added,
      lines_deleted: lines.deleted,
      projects: projects.length,
    },
    merged: buckets.merged.map(serializeChange),
    open: buckets.open.map(serializeChange),
    abandoned: buckets.abandoned.map(serializeChange),
    by_project: projects,
    by_author: authors,
    by_day: days,
  }
  console.log(JSON.stringify(payload, null, 2))
}

const serializeChange = (c: ChangeInfo): Record<string, unknown> => ({
  number: c._number,
  change_id: c.change_id,
  subject: c.subject,
  project: c.project,
  branch: c.branch,
  status: statusLabel(c),
  ...(c.owner?.name ? { owner: c.owner.name } : {}),
  ...(c.created ? { created: c.created } : {}),
  ...(c.updated ? { updated: c.updated } : {}),
  ...(c.submitted ? { submitted: c.submitted } : {}),
  ...(c.insertions !== undefined ? { insertions: c.insertions } : {}),
  ...(c.deletions !== undefined ? { deletions: c.deletions } : {}),
  ...(c.work_in_progress ? { wip: true } : {}),
  ...(c.unresolved_comment_count !== undefined
    ? { unresolved_comments: c.unresolved_comment_count }
    : {}),
  ...(c.labels ? { labels: summarizeLabels(c.labels) } : {}),
})

const summarizeLabels = (labels: NonNullable<ChangeInfo['labels']>): Record<string, number> => {
  const out: Record<string, number> = {}
  for (const [name, info] of Object.entries(labels)) {
    if (info.value !== undefined) out[name] = info.value
  }
  return out
}

const renderXml = (
  changes: readonly ChangeInfo[],
  options: ReportOptions,
  range: DateRange,
  user: string,
  role: ReportRole,
): void => {
  const buckets = bucketByStatus(changes)
  const projects = aggregateByProject(changes)
  const lines = totalLineStats(changes)
  const dayField: 'updated' | 'submitted' = options.status === 'merged' ? 'submitted' : 'updated'
  const days = aggregateByDay(changes, dayField)

  const lines2: string[] = []
  lines2.push('<?xml version="1.0" encoding="UTF-8"?>')
  lines2.push(
    `<report period="${escapeXml(options.period ?? 'custom')}" generated_at="${new Date().toISOString()}">`,
  )
  lines2.push(`  <date_range from="${range.from}" to="${range.to}"/>`)
  lines2.push(
    `  <scope role="${role}" user="${escapeXml(user)}" status="${escapeXml(options.status ?? 'all')}"/>`,
  )
  lines2.push(
    `  <summary merged="${buckets.merged.length}" open="${buckets.open.length}" abandoned="${buckets.abandoned.length}" total="${changes.length}" lines_added="${lines.added}" lines_deleted="${lines.deleted}" projects="${projects.length}"/>`,
  )

  const writeBucket = (tag: string, list: readonly ChangeInfo[]): void => {
    lines2.push(`  <${tag}_changes count="${list.length}">`)
    for (const c of list) {
      lines2.push(
        `    <change number="${c._number}" project="${escapeXml(c.project)}" branch="${escapeXml(c.branch)}">`,
      )
      lines2.push(`      <subject><![CDATA[${sanitizeCDATA(c.subject)}]]></subject>`)
      lines2.push(`      <status>${statusLabel(c)}</status>`)
      if (c.owner?.name) lines2.push(`      <owner>${escapeXml(c.owner.name)}</owner>`)
      if (c.updated) lines2.push(`      <updated>${c.updated}</updated>`)
      if (c.submitted) lines2.push(`      <submitted>${c.submitted}</submitted>`)
      if (c.insertions !== undefined) lines2.push(`      <insertions>${c.insertions}</insertions>`)
      if (c.deletions !== undefined) lines2.push(`      <deletions>${c.deletions}</deletions>`)
      lines2.push('    </change>')
    }
    lines2.push(`  </${tag}_changes>`)
  }

  writeBucket('merged', buckets.merged)
  writeBucket('open', buckets.open)
  writeBucket('abandoned', buckets.abandoned)

  lines2.push(`  <by_project count="${projects.length}">`)
  for (const p of projects) {
    lines2.push(
      `    <project name="${escapeXml(p.project)}" merged="${p.merged}" open="${p.open}" abandoned="${p.abandoned}" total="${p.total}"/>`,
    )
  }
  lines2.push('  </by_project>')

  if (days.length > 0) {
    lines2.push(`  <by_day count="${days.length}">`)
    for (const d of days) {
      lines2.push(
        `    <day date="${d.day}" merged="${d.merged}" open="${d.open}" abandoned="${d.abandoned}" total="${d.total}"/>`,
      )
    }
    lines2.push('  </by_day>')
  }

  lines2.push('</report>')
  console.log(lines2.join('\n'))
}

const renderMarkdown = (
  changes: readonly ChangeInfo[],
  options: ReportOptions,
  range: DateRange,
  user: string,
  role: ReportRole,
): void => {
  const buckets = bucketByStatus(changes)
  const lines = totalLineStats(changes)
  const projects = aggregateByProject(changes)
  const authors = aggregateByAuthor(changes)
  const period = options.period ?? 'custom'
  const title =
    period === 'daily'
      ? '日报'
      : period === 'weekly'
        ? '周报'
        : period === 'monthly'
          ? '月报'
          : period === 'quarterly'
            ? '季报'
            : '变更报告'

  const L: string[] = []
  L.push(`# ${title} · ${formatRangeLabel(range, options.period)}`)
  L.push('')
  L.push(`用户：${user}`)
  L.push(`视角：${role}`)
  L.push(`时间窗：${range.from} ~ ${range.to}`)
  L.push('')

  L.push(`## 本期已合入（${buckets.merged.length}）`)
  L.push('')
  if (buckets.merged.length === 0) {
    L.push('- （无）')
  } else {
    for (const c of buckets.merged) {
      const cr = summarizeLabels(c.labels ?? {})['Code-Review']
      const crLabel = cr !== undefined ? ` CR:${cr >= 0 ? '+' : ''}${cr}` : ''
      const ins = c.insertions !== undefined ? `+${c.insertions}/-${c.deletions ?? 0}` : ''
      L.push(
        `- #${c._number} ${c.project} | ${c.subject} | ${formatHm(c.submitted)} | ${ins}${crLabel}`,
      )
    }
  }
  L.push('')

  L.push(`## 进行中（${buckets.open.length}）`)
  L.push('')
  if (buckets.open.length === 0) {
    L.push('- （无）')
  } else {
    for (const c of buckets.open) {
      const wip = c.work_in_progress ? 'WIP · ' : ''
      const unresolved =
        c.unresolved_comment_count !== undefined && c.unresolved_comment_count > 0
          ? `${c.unresolved_comment_count} 条未解决评论`
          : ''
      L.push(
        `- #${c._number} ${c.project} | ${c.subject} | ${formatMdDay(c.updated)} | ${wip}${unresolved}`,
      )
    }
  }
  L.push('')

  L.push(`## 已丢弃（${buckets.abandoned.length}）`)
  L.push('')
  if (buckets.abandoned.length === 0) {
    L.push('- （无）')
  } else {
    for (const c of buckets.abandoned) {
      L.push(`- #${c._number} ${c.project} | ${c.subject} | ${formatMdDay(c.updated)}`)
    }
  }
  L.push('')

  if (
    (options.period === 'weekly' || options.period === undefined) &&
    buckets.merged.length + buckets.open.length + buckets.abandoned.length > 0
  ) {
    const dayField: 'updated' | 'submitted' = options.status === 'merged' ? 'submitted' : 'updated'
    const days = aggregateByDay(changes, dayField)
    if (days.length > 0) {
      L.push('## 按日分布')
      L.push('')
      for (const d of days) {
        L.push(`- ${formatDayLabel(d.day)}: 合 ${d.merged} / 开 ${d.open} / 弃 ${d.abandoned}`)
      }
      L.push('')
    }
  }

  if ((options.period === 'monthly' || options.period === 'quarterly') && projects.length > 0) {
    L.push('## 按项目聚合')
    L.push('')
    const top = projects.slice(0, options.period === 'quarterly' ? 20 : 10)
    for (const p of top) {
      L.push(`- ${p.project}: 合 ${p.merged} / 开 ${p.open} / 弃 ${p.abandoned}`)
    }
    L.push('')
  }

  if ((options.period === 'monthly' || options.period === 'quarterly') && authors.length > 0) {
    L.push('## 作者分布')
    L.push('')
    const top = authors.slice(0, 5)
    for (const a of top) {
      L.push(`- ${a.author}: ${a.count} 个变更`)
    }
    L.push('')
  }

  if (options.period === 'quarterly') {
    const days = aggregateByDay(changes, 'submitted')
    const monthMap = new Map<string, { merged: number; abandoned: number; open: number }>()
    for (const d of days) {
      const monthKey = d.day.slice(0, 7)
      const cur = monthMap.get(monthKey) ?? { merged: 0, abandoned: 0, open: 0 }
      cur.merged += d.merged
      cur.abandoned += d.abandoned
      cur.open += d.open
      monthMap.set(monthKey, cur)
    }
    const monthEntries = Array.from(monthMap.entries()).sort(([a], [b]) => a.localeCompare(b))
    if (monthEntries.length > 0) {
      L.push('## 月度趋势')
      L.push('')
      for (const [m, s] of monthEntries) {
        L.push(`- ${m}: 合 ${s.merged} / 弃 ${s.abandoned} / 留存 ${s.open}`)
      }
      L.push('')
    }
  }

  L.push('## 汇总')
  L.push('')
  L.push(
    `合入 ${buckets.merged.length} / 丢弃 ${buckets.abandoned.length} / 留存 ${buckets.open.length} / 合计 ${changes.length}`,
  )
  L.push(`新增 ${lines.added} / 删除 ${lines.deleted} 行 / 涉及项目 ${projects.length}`)
  console.log(L.join('\n'))
}

const renderText = (
  changes: readonly ChangeInfo[],
  options: ReportOptions,
  range: DateRange,
  user: string,
  role: ReportRole,
): void => {
  const buckets = bucketByStatus(changes)
  const lines = totalLineStats(changes)
  const projects = aggregateByProject(changes)
  const period = options.period ?? 'custom'

  const header =
    period === 'daily'
      ? `${colors.cyan}日报${colors.reset}`
      : period === 'weekly'
        ? `${colors.cyan}周报${colors.reset}`
        : period === 'monthly'
          ? `${colors.cyan}月报${colors.reset}`
          : period === 'quarterly'
            ? `${colors.cyan}季报${colors.reset}`
            : `${colors.cyan}变更报告${colors.reset}`

  console.log('')
  console.log(`${header} · ${formatRangeLabel(range, options.period)}`)
  console.log(
    `${colors.gray}用户：${user} · 视角：${role} · 窗口：${range.from} ~ ${range.to}${colors.reset}`,
  )
  console.log('')

  console.log(`${colors.green}已合入（${buckets.merged.length}）${colors.reset}`)
  if (buckets.merged.length === 0) {
    console.log(`  ${colors.gray}（无）${colors.reset}`)
  } else {
    for (const c of buckets.merged) {
      const cr = summarizeLabels(c.labels ?? {})['Code-Review']
      const crLabel = cr !== undefined ? ` · CR:${cr >= 0 ? '+' : ''}${cr}` : ''
      const ins = c.insertions !== undefined ? ` · +${c.insertions}/-${c.deletions ?? 0}` : ''
      console.log(
        `  ${colors.yellow}#${c._number}${colors.reset} ${c.project} · ${c.subject}${colors.gray}${ins}${crLabel} · ${formatHm(c.submitted)}${colors.reset}`,
      )
    }
  }
  console.log('')

  console.log(`${colors.blue}进行中（${buckets.open.length}）${colors.reset}`)
  if (buckets.open.length === 0) {
    console.log(`  ${colors.gray}（无）${colors.reset}`)
  } else {
    for (const c of buckets.open) {
      const wip = c.work_in_progress ? ' · WIP' : ''
      const unresolved =
        c.unresolved_comment_count !== undefined && c.unresolved_comment_count > 0
          ? ` · ${c.unresolved_comment_count} 条未解决评论`
          : ''
      console.log(
        `  ${colors.yellow}#${c._number}${colors.reset} ${c.project} · ${c.subject}${colors.gray}${wip}${unresolved} · ${formatMdDay(c.updated)}${colors.reset}`,
      )
    }
  }
  console.log('')

  console.log(`${colors.red}已丢弃（${buckets.abandoned.length}）${colors.reset}`)
  if (buckets.abandoned.length === 0) {
    console.log(`  ${colors.gray}（无）${colors.reset}`)
  } else {
    for (const c of buckets.abandoned) {
      console.log(
        `  ${colors.yellow}#${c._number}${colors.reset} ${c.project} · ${c.subject}${colors.gray} · ${formatMdDay(c.updated)}${colors.reset}`,
      )
    }
  }
  console.log('')

  if (period === 'weekly' || period === 'custom') {
    const dayField: 'updated' | 'submitted' = options.status === 'merged' ? 'submitted' : 'updated'
    const days = aggregateByDay(changes, dayField)
    if (days.length > 0) {
      console.log(`${colors.cyan}按日分布${colors.reset}`)
      for (const d of days) {
        console.log(`  ${formatDayLabel(d.day)}: 合 ${d.merged} / 开 ${d.open} / 弃 ${d.abandoned}`)
      }
      console.log('')
    }
  }

  if ((period === 'monthly' || period === 'quarterly') && projects.length > 0) {
    console.log(`${colors.cyan}按项目聚合${colors.reset}`)
    const top = projects.slice(0, period === 'quarterly' ? 20 : 10)
    for (const p of top) {
      console.log(`  ${p.project}: 合 ${p.merged} / 开 ${p.open} / 弃 ${p.abandoned}`)
    }
    console.log('')
  }

  console.log(`${colors.cyan}汇总${colors.reset}`)
  console.log(
    `  合入 ${buckets.merged.length} / 丢弃 ${buckets.abandoned.length} / 留存 ${buckets.open.length} / 合计 ${changes.length}`,
  )
  console.log(`  新增 ${lines.added} / 删除 ${lines.deleted} 行 / 涉及项目 ${projects.length}`)
  console.log('')
}

// ─── Command ────────────────────────────────────────────────────────────────

export const reportCommand = (
  options: ReportOptions,
): Effect.Effect<void, ApiError | ConfigError, ConfigServiceImpl | GerritApiService> =>
  Effect.gen(function* () {
    const configService = yield* ConfigService
    const credentials = yield* configService.getCredentials
    const gerritApi = yield* GerritApiService

    const role: ReportRole = options.reviewer ? 'reviewer' : 'owner'
    const user = options.user ?? credentials.username
    const period = options.period
    const status: ReportStatus = options.status ?? 'all'
    const range = computeRange(period, options.since, options.until)

    const query = buildQuery(user, role, range, status)
    const limit = options.limit ?? 500
    const limitQuery = query.includes('limit:') ? query : `${query} limit:${limit}`
    const changes = yield* gerritApi.listChanges(limitQuery)

    if (options.json) {
      renderJson(changes, options, range, user, role)
      return
    }
    if (options.xml) {
      renderXml(changes, options, range, user, role)
      return
    }
    if (options.md) {
      renderMarkdown(changes, options, range, user, role)
      return
    }
    renderText(changes, options, range, user, role)
  })
