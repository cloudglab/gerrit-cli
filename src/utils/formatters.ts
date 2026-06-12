import type { ChangeInfo } from '@/schemas/gerrit'

export const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr)
  const now = new Date()

  // Check if today
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }

  // Check if this year
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
    })
  }

  // Otherwise show full date
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  })
}

/**
 * Format a date string as a relative time ago (e.g., "2h ago", "3d ago").
 * Falls back to YYYY-MM-DD for dates older than 8 weeks.
 */
export const formatTimeAgo = (dateStr: string): string => {
  const ms = Date.now() - new Date(dateStr.replace(' ', 'T').split('.')[0] + 'Z').getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 14) return `${days}d ago`
  const weeks = Math.floor(days / 7)
  if (weeks < 8) return `${weeks}w ago`
  return dateStr.slice(0, 10)
}

/**
 * Format a date string with both absolute and relative time.
 * e.g., "Jan 15, 2025 at 14:30 • 3d ago"
 */
export const formatRelativeTime = (dateStr: string): string => {
  const absolute = formatDate(dateStr)
  const relative = formatTimeAgo(dateStr)
  if (absolute === relative) return absolute
  return `${absolute} • ${relative}`
}

export const getStatusIndicator = (change: ChangeInfo): string => {
  const indicators: string[] = []

  // Check for labels only if they exist
  if (change.labels) {
    // Check for Code-Review
    if (change.labels['Code-Review']) {
      const cr = change.labels['Code-Review']
      if (cr.approved || cr.value === 2) {
        indicators.push(`${colors.green}✓${colors.reset}`)
      } else if (cr.rejected || cr.value === -2) {
        indicators.push(`${colors.red}✗${colors.reset}`)
      } else if (cr.recommended || cr.value === 1) {
        indicators.push(`${colors.cyan}↑${colors.reset}`)
      } else if (cr.disliked || cr.value === -1) {
        indicators.push(`${colors.yellow}↓${colors.reset}`)
      }
    }

    // Check for Verified
    if (change.labels.Verified) {
      const v = change.labels.Verified
      if (v.approved || v.value === 1) {
        indicators.push(`${colors.green}✓${colors.reset}`)
      } else if (v.rejected || v.value === -1) {
        indicators.push(`${colors.red}✗${colors.reset}`)
      }
    }
  }

  // Check if submittable (regardless of labels)
  if (change.submittable) {
    indicators.push('🚀')
  }

  // Check if WIP (regardless of labels)
  if (change.work_in_progress) {
    indicators.push('🚧')
  }

  return indicators.length > 0 ? indicators.join('  ') : '' // Double space for proper alignment
}

export const colors = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
}
