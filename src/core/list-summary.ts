export interface ListSummaryItem {
  id: number | string
  name?: string
  sortKey?: string
  status?: string
}

export interface ListSummary {
  total: number
  byStatus: Record<string, number>
  top: ListSummaryItem[]
  highlight: string
  byGroup?: Record<string, number>
  groupKey?: string
}

export function summarizeList<
  T extends Record<string, unknown> & {
    id: number | string
    name?: string
    status?: string
    updatedAt?: string
    createdAt?: string
    lastUpdate?: string
  },
>(
  items: T[],
  options: {
    sortKey?: 'updatedAt' | 'createdAt' | 'lastUpdate'
    groupKey?: string
    topN?: number
  } = {},
): ListSummary {
  const sortKey = options.sortKey ?? 'updatedAt'
  const topN = options.topN ?? 3
  const groupKey = options.groupKey
  const byStatus: Record<string, number> = {}
  const byGroup: Record<string, number> = {}

  for (const item of items) {
    const status = item.status ?? 'unknown'
    byStatus[status] = (byStatus[status] ?? 0) + 1

    if (groupKey) {
      const groupSource = item[groupKey as keyof T]
      const groupValue =
        typeof groupSource === 'string'
          ? groupSource.trim()
          : typeof groupSource === 'number'
            ? String(groupSource)
            : ''
      if (groupValue !== '') {
        byGroup[groupValue] = (byGroup[groupValue] ?? 0) + 1
      }
    }
  }

  const sortCandidates: Array<{ item: T; sortValue: string }> = []
  for (const item of items) {
    const sortValue = item[sortKey]
    if (typeof sortValue === 'string' && sortValue !== '') {
      sortCandidates.push({ item, sortValue })
    }
  }
  sortCandidates.sort((left, right) => left.sortValue.localeCompare(right.sortValue))

  const top = sortCandidates.slice(0, topN).map(({ item, sortValue }) => ({
    id: item.id,
    name: item.name,
    status: item.status,
    sortKey: sortValue,
  }))

  const highlight =
    items.length === 0
      ? '当前无数据。'
      : `共 ${items.length} 条${groupKey ? `（按 ${groupKey} 分布）` : ''}。`

  const summary: ListSummary = { total: items.length, byStatus, top, highlight }
  if (groupKey && Object.keys(byGroup).length > 0) {
    summary.byGroup = byGroup
    summary.groupKey = groupKey
  }
  return summary
}
