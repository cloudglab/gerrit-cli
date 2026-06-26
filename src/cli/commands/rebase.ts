import { Effect } from 'effect'
import { type ApiError, GerritApiService } from '@/api/gerrit'
import { GitError, getChangeIdFromHead, NoChangeIdError } from '@/utils/git-commit'
import { escapeXML, sanitizeCDATA } from '@/utils/shell-safety'
import { assertWriteAllowed, type WriteGuardError } from '@/utils/write-guard'

interface RebaseOptions {
  base?: string
  allowConflicts?: boolean
  xml?: boolean
  json?: boolean
  confirm?: boolean
}

/**
 * Rebases a Gerrit change onto the target branch or specified base.
 *
 * Errors propagate through the Effect channel (handled by executeEffect's
 * outputError + exit 1), rather than being swallowed into exit code 0.
 *
 * @param changeId - Change number or Change-ID to rebase (optional, auto-detects from HEAD if not provided)
 * @param options - Configuration options
 * @param options.base - Optional base revision to rebase onto (default: target branch HEAD)
 * @param options.xml - Whether to output in XML format for LLM consumption
 * @returns Effect that completes when the change is rebased
 */
export const rebaseCommand = (
  changeId?: string,
  options: RebaseOptions = {},
): Effect.Effect<void, ApiError | GitError | NoChangeIdError | WriteGuardError, GerritApiService> =>
  Effect.gen(function* () {
    // Auto-detect Change-ID from HEAD commit if not provided
    const resolvedChangeId = changeId || (yield* getChangeIdFromHead())

    // 写保护：rebase 是写操作，必须命中命令并带 --confirm
    yield* assertWriteAllowed({
      confirm: options.confirm ?? false,
      operation: 'rebase change',
      target: resolvedChangeId,
    })

    const gerritApi = yield* GerritApiService

    // Perform the rebase - this returns the rebased change info
    const change = yield* gerritApi.rebaseChange(resolvedChangeId, {
      base: options.base,
      allowConflicts: options.allowConflicts,
    })

    if (options.json) {
      console.log(
        JSON.stringify(
          {
            status: 'success',
            change_number: change._number,
            subject: change.subject,
            branch: change.branch,
            ...(options.base ? { base: options.base } : {}),
          },
          null,
          2,
        ),
      )
    } else if (options.xml) {
      console.log(`<?xml version="1.0" encoding="UTF-8"?>`)
      console.log(`<rebase_result>`)
      console.log(`  <status>success</status>`)
      console.log(`  <change_number>${change._number}</change_number>`)
      console.log(`  <subject><![CDATA[${sanitizeCDATA(change.subject)}]]></subject>`)
      console.log(`  <branch>${escapeXML(change.branch)}</branch>`)
      if (options.base) {
        console.log(`  <base><![CDATA[${sanitizeCDATA(options.base)}]]></base>`)
      }
      console.log(`</rebase_result>`)
    } else {
      console.log(`✓ Rebased change ${change._number}: ${change.subject}`)
      console.log(`  Branch: ${change.branch}`)
      if (options.base) {
        console.log(`  Base: ${options.base}`)
      }
    }
  })
