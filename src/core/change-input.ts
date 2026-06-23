/**
 * Unified change input parsing for the CLI.
 *
 * Replaces the duplicated `parseChangeInput` / `parseChangeSpec` helpers that
 * used to live in checkout.ts, cherry.ts, tree-setup.ts, tree-rebase.ts and
 * workspace.ts. Also centralises:
 *
 *   - buildChangeUrl(...) — single source of truth for `${host}/c/<project>/+/<n>`
 *   - extractPushOutputChangeUrl(...) — pulled out of push.ts
 *   - parseRemoteHost(...) — extract hostname from SSH / HTTPS remote URLs
 *   - resolveChangeId(...) — Effect wrapper that prefers the input and falls
 *     back to HEAD's `Change-Id:` when the input is missing/unparseable.
 *
 * Every helper is a pure function or a small Effect so it can be reused from
 * commands, the future `url-intent` command, and tests without dragging in
 * commander, git, or network state.
 */
import { Effect } from 'effect'
import { ApiError } from '@/api/gerrit-types'
import { GitError, getChangeIdFromHead, NoChangeIdError } from '@/utils/git-commit'
import { normalizeGerritHost } from '@/utils/url-parser'

/** Discriminated source for a parsed change input. */
export type ChangeInputKind = 'url' | 'number' | 'change-id' | 'spec' | 'invalid'

export interface ChangeInput {
  /** Original raw input, trimmed. */
  readonly raw: string
  /** Discriminated kind after parsing. */
  readonly kind: ChangeInputKind
  /** Change number (`"12345"`) or Change-ID (`"I...40-hex"`). */
  readonly changeId: string
  /** Optional patchset number, if the input carried one. */
  readonly patchset?: number
  /** Optional project name, if the URL carried one. */
  readonly project?: string
  /** Optional host, if the input was a URL. */
  readonly host?: string
  /** True when the input did not carry a usable identifier. */
  readonly empty: boolean
}

/** Regex fragments used by {@link parseChangeInput}. Kept local for clarity. */
const URL_CHANGE_PATH = /\/c\/([^/]+)\/\+\/(\d+)(?:\/(\d+))?(?:\/|$)/

/**
 * Parse any user-supplied change identifier into a normalised {@link ChangeInput}.
 *
 * Accepted forms:
 *   - URL: `https://gerrit.example.com/c/proj/+/12345[/3]`
 *   - URL with hash: `https://gerrit.example.com/#/c/proj/+/12345`
 *   - Plain numeric change number: `12345`
 *   - Change-ID: `If5a3ae8cb5a107e187447802358417f311d0c4b1`
 *   - Change / patchset: `12345/3` or `12345:3`
 *
 * Always returns a value: invalid input is represented with
 * `{ kind: 'invalid', changeId: raw, empty: true }` so callers can decide
 * whether to error out, suggest a command, or fall back to HEAD.
 */
export const parseChangeInput = (raw: string): ChangeInput => {
  const trimmed = raw.trim()
  if (trimmed.length === 0) {
    return { raw: trimmed, kind: 'invalid', changeId: '', empty: true }
  }

  // 1. URL form: extract change number, optional patchset, project, host.
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const url = new URL(trimmed)
      const searchSpace = url.pathname + url.hash
      const m = searchSpace.match(URL_CHANGE_PATH)
      if (m) {
        const [, project, changeId, patchsetStr] = m
        const patchset = patchsetStr ? Number.parseInt(patchsetStr, 10) : undefined
        return {
          raw: trimmed,
          kind: 'url',
          changeId,
          ...(Number.isFinite(patchset) && patchset !== undefined && patchset > 0
            ? { patchset }
            : {}),
          project,
          host: normalizeGerritHost(`${url.protocol}//${url.host}`),
          empty: false,
        }
      }
      // URL was a Gerrit host but no change page — still useful for callers.
      return {
        raw: trimmed,
        kind: 'url',
        changeId: '',
        host: normalizeGerritHost(`${url.protocol}//${url.host}`),
        empty: true,
      }
    } catch {
      return { raw: trimmed, kind: 'invalid', changeId: trimmed, empty: true }
    }
  }

  // 2. Change-ID (I + 40 hex). We deliberately do NOT accept partial Change-IDs
  //    here; callers that want to treat `Iabc` as a topic name should pass the
  //    identifier explicitly to whatever command needs that semantics.
  if (/^I[0-9a-f]{40}$/.test(trimmed)) {
    return { raw: trimmed, kind: 'change-id', changeId: trimmed, empty: false }
  }

  // 3. Numeric change number.
  if (/^\d+$/.test(trimmed)) {
    return { raw: trimmed, kind: 'number', changeId: trimmed, empty: false }
  }

  // 4. `12345/3` or `12345:3` — change + patchset in one token.
  const slashIdx = trimmed.search(/[/:]/)
  if (slashIdx > 0) {
    const sep = trimmed[slashIdx]
    const parts = trimmed.split(sep)
    if (parts.length === 2) {
      const [changeId, patchsetStr] = parts
      if (/^\d+$/.test(changeId) && /^\d+$/.test(patchsetStr)) {
        return {
          raw: trimmed,
          kind: 'spec',
          changeId,
          patchset: Number.parseInt(patchsetStr, 10),
          empty: false,
        }
      }
    }
  }

  return { raw: trimmed, kind: 'invalid', changeId: trimmed, empty: true }
}

/**
 * Best-effort Effect that resolves a user-supplied change identifier to the
 * final string suitable for the Gerrit REST API. Order of resolution:
 *
 *   1. If `raw` parses to a usable input, return its `changeId`.
 *   2. If `allowHead` is true, fall back to the current HEAD commit's
 *      `Change-Id:` footer (via {@link getChangeIdFromHead}).
 *
 * @throws InvalidChangeInputError — `raw` is non-empty but unparseable and
 *         `allowHead` is false.
 * @throws NoChangeIdError / GitError — passthrough from HEAD fallback.
 * @throws ApiError — reserved for future REST validation; never raised today.
 */
export class InvalidChangeInputError extends Error {
  readonly _tag = 'InvalidChangeInputError' as const
  constructor(message: string) {
    super(message)
    this.name = 'InvalidChangeInputError'
  }
}

export const resolveChangeId = (
  raw: string,
  options: { allowHead?: boolean } = {},
): Effect.Effect<string, InvalidChangeInputError | NoChangeIdError | GitError | ApiError> =>
  Effect.gen(function* () {
    const parsed = parseChangeInput(raw)
    if (!parsed.empty) {
      return parsed.changeId
    }
    if (options.allowHead) {
      return yield* getChangeIdFromHead()
    }
    return yield* Effect.fail(
      new InvalidChangeInputError(
        raw.trim().length === 0
          ? 'Missing change identifier. Provide a number, Change-ID, or URL.'
          : `Cannot interpret "${raw}" as a change number, Change-ID, or Gerrit URL.`,
      ),
    )
  })

/**
 * Build the canonical Gerrit web URL for a change. All callers that used to
 * format `${host}/c/${project}/+/${_number}` should now go through this so
 * `incoming.ts` and `open.ts` stop disagreeing on the project segment.
 */
export interface ChangeUrlParts {
  readonly host: string
  readonly project?: string
  readonly changeNumber: number | string
  readonly patchset?: number | string
}

export const buildChangeUrl = (parts: ChangeUrlParts): string => {
  const host = normalizeGerritHost(parts.host).replace(/\/$/, '')
  const number = encodeURIComponent(String(parts.changeNumber))
  const projectSegment = parts.project ? `/${encodeURI(parts.project)}` : ''
  const base = `${host}/c${projectSegment}/+/${number}`
  if (parts.patchset === undefined || parts.patchset === null) {
    return base
  }
  return `${base}/${encodeURIComponent(String(parts.patchset))}`
}

/** Extract a Change-URL from `git push` output. Returns null when not found. */
const PUSH_CHANGE_URL = /remote:\s+(https?:\/\/\S+\/c\/\S+\/\+\/\d+)/

export const extractPushOutputChangeUrl = (output: string): string | null => {
  const match = output.match(PUSH_CHANGE_URL)
  return match && match[1] ? match[1] : null
}

/**
 * Extract a hostname from a git remote URL — SSH (`git@host:path`) or HTTPS
 * (`https://host/...`). Returns null when the remote string does not match a
 * known shape.
 */
export const parseRemoteHost = (url: string): string | null => {
  const trimmed = url.trim()
  if (trimmed.startsWith('git@')) {
    const m = trimmed.split('@')[1]?.split(':')[0]
    return m ? m : null
  }
  if (trimmed.includes('://')) {
    try {
      return new URL(trimmed).hostname
    } catch {
      return null
    }
  }
  return null
}
