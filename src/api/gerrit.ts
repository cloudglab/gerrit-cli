import { Schema } from '@effect/schema'
import { Context, Effect, Layer } from 'effect'
import {
  AccountInfo,
  ChangeInfo,
  CommentInfo,
  type DiffOptions,
  FileDiffContent,
  FileInfo,
  type GerritCredentials,
  GroupDetailInfo,
  GroupInfo,
  MessageInfo,
  ProjectInfo,
  type ReviewerInput,
  ReviewerResult,
  type ReviewInput,
  RevisionInfo,
  SubmitInfo,
} from '@/schemas/gerrit'
import { ReviewerListItem } from '@/schemas/reviewer'
import { ConfigService } from '@/services/config'
import { normalizeChangeIdentifier } from '@/utils/change-id'
import { convertToUnifiedDiff } from '@/utils/diff-formatters'
import { filterMeaningfulMessages } from '@/utils/message-filters'

export type { ApiErrorFields, GerritApiServiceImpl } from './gerrit-types'
export { ApiError } from './gerrit-types'

import { ApiError, type GerritApiServiceImpl } from './gerrit-types'
import { HttpClientError, send } from './http-client'

export const GerritApiService: Context.Tag<GerritApiServiceImpl, GerritApiServiceImpl> =
  Context.GenericTag<GerritApiServiceImpl>('GerritApiService')
export type GerritApiService = Context.Tag.Identifier<typeof GerritApiService>

const createAuthHeader = (credentials: GerritCredentials): string => {
  const auth = btoa(`${credentials.username}:${credentials.password}`)
  return `Basic ${auth}`
}

const wrapHttpError = (error: unknown, fallbackMessage: string): ApiError => {
  if (error instanceof ApiError) return error
  if (error instanceof HttpClientError) {
    return new ApiError({
      message: error.message || fallbackMessage,
      ...(error.statusCode !== undefined
        ? { status: error.statusCode, statusCode: error.statusCode }
        : {}),
      ...(error.responseBody !== undefined ? { responseBody: error.responseBody } : {}),
    })
  }
  const message = error instanceof Error ? error.message : String(error)
  return new ApiError({ message: `${fallbackMessage}: ${message}` })
}

const makeRequest = <T = unknown>(
  url: string,
  authHeader: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  body?: unknown,
  schema?: Schema.Schema<T>,
): Effect.Effect<T, ApiError> =>
  Effect.gen(function* () {
    const headers: Record<string, string> = {
      Authorization: authHeader,
    }

    if (body) {
      headers['Content-Type'] = 'application/json'
    }

    const result = yield* Effect.tryPromise({
      try: () =>
        send(url, {
          method,
          headers,
          ...(method !== 'GET' && body ? { body: JSON.stringify(body) } : {}),
        }),
      catch: (error) => wrapHttpError(error, 'Gerrit 请求失败'),
    })

    if (result.status < 200 || result.status >= 300) {
      yield* Effect.fail(
        new ApiError({
          message: `Gerrit 返回错误: ${result.status}`,
          status: result.status,
          statusCode: result.status,
          ...(result.body !== undefined ? { responseBody: result.body } : {}),
        }),
      )
    }

    if (method !== 'GET' && result.raw === '') {
      return undefined as unknown as T
    }

    const parsed = result.body
    if (parsed === undefined || parsed === null) return {} as unknown as T

    if (schema) {
      return yield* Schema.decodeUnknown(schema)(parsed).pipe(
        Effect.mapError(() => new ApiError({ message: 'Gerrit 响应格式不符合预期 schema' })),
      )
    }
    return parsed as T
  })

export const GerritApiServiceLive: Layer.Layer<GerritApiService, never, ConfigService> =
  Layer.effect(
    GerritApiService,
    Effect.gen(function* () {
      const configService = yield* ConfigService

      const getCredentialsAndAuth = Effect.gen(function* () {
        const credentials = yield* configService.getCredentials.pipe(
          Effect.mapError(() => new ApiError({ message: 'Failed to get credentials' })),
        )
        const normalizedCredentials = { ...credentials, host: credentials.host.replace(/\/$/, '') }
        return {
          credentials: normalizedCredentials,
          authHeader: createAuthHeader(normalizedCredentials),
        }
      })

      const normalizeAndValidate = (changeId: string): Effect.Effect<string, ApiError> =>
        Effect.try({
          try: () => normalizeChangeIdentifier(changeId),
          catch: (error) =>
            new ApiError({
              message: error instanceof Error ? error.message : String(error),
            }),
        })

      const getChange = (changeId: string) =>
        Effect.gen(function* () {
          const { credentials, authHeader } = yield* getCredentialsAndAuth
          const normalized = yield* normalizeAndValidate(changeId)
          const url = `${credentials.host}/a/changes/${encodeURIComponent(normalized)}?o=CURRENT_REVISION&o=CURRENT_COMMIT`
          return yield* makeRequest(url, authHeader, 'GET', undefined, ChangeInfo)
        })

      const listChanges = (query = 'is:open') =>
        Effect.gen(function* () {
          const { credentials, authHeader } = yield* getCredentialsAndAuth
          const url = `${credentials.host}/a/changes/?q=${encodeURIComponent(query)}&o=LABELS&o=DETAILED_LABELS&o=DETAILED_ACCOUNTS&o=SUBMITTABLE&o=CURRENT_REVISION`
          return yield* makeRequest(url, authHeader, 'GET', undefined, Schema.Array(ChangeInfo))
        })

      const listProjects = (options?: { pattern?: string }) =>
        Effect.gen(function* () {
          const { credentials, authHeader } = yield* getCredentialsAndAuth
          let url = `${credentials.host}/a/projects/`
          if (options?.pattern) url += `?p=${encodeURIComponent(options.pattern)}`
          const schema = Schema.Record({ key: Schema.String, value: ProjectInfo })
          const projectsRecord = yield* makeRequest(url, authHeader, 'GET', undefined, schema)
          return Object.values(projectsRecord).sort((a, b) => a.name.localeCompare(b.name))
        })

      const postReview = (changeId: string, review: ReviewInput) =>
        Effect.gen(function* () {
          const { credentials, authHeader } = yield* getCredentialsAndAuth
          const normalized = yield* normalizeAndValidate(changeId)
          const url = `${credentials.host}/a/changes/${encodeURIComponent(normalized)}/revisions/current/review`
          yield* makeRequest(url, authHeader, 'POST', review)
        })

      const abandonChange = (changeId: string, message?: string) =>
        Effect.gen(function* () {
          const { credentials, authHeader } = yield* getCredentialsAndAuth
          const normalized = yield* normalizeAndValidate(changeId)
          const url = `${credentials.host}/a/changes/${encodeURIComponent(normalized)}/abandon`
          const body = message ? { message } : {}
          yield* makeRequest(url, authHeader, 'POST', body)
        })

      const restoreChange = (changeId: string, message?: string) =>
        Effect.gen(function* () {
          const { credentials, authHeader } = yield* getCredentialsAndAuth
          const normalized = yield* normalizeAndValidate(changeId)
          const url = `${credentials.host}/a/changes/${encodeURIComponent(normalized)}/restore`
          const body = message ? { message } : {}
          return yield* makeRequest(url, authHeader, 'POST', body, ChangeInfo)
        })

      const rebaseChange = (
        changeId: string,
        options?: { base?: string; allowConflicts?: boolean },
      ) =>
        Effect.gen(function* () {
          const { credentials, authHeader } = yield* getCredentialsAndAuth
          const normalized = yield* normalizeAndValidate(changeId)
          const url = `${credentials.host}/a/changes/${encodeURIComponent(normalized)}/revisions/current/rebase`
          const body: Record<string, string | boolean> = {}
          if (options?.base) body['base'] = options.base
          if (options?.allowConflicts) body['allow_conflicts'] = true
          return yield* makeRequest(url, authHeader, 'POST', body, ChangeInfo)
        })

      const submitChange = (changeId: string) =>
        Effect.gen(function* () {
          const { credentials, authHeader } = yield* getCredentialsAndAuth
          const normalized = yield* normalizeAndValidate(changeId)
          const url = `${credentials.host}/a/changes/${encodeURIComponent(normalized)}/submit`
          return yield* makeRequest(url, authHeader, 'POST', {}, SubmitInfo)
        })

      const testConnection = Effect.gen(function* () {
        const { credentials, authHeader } = yield* getCredentialsAndAuth
        const url = `${credentials.host}/a/accounts/self`
        yield* makeRequest(url, authHeader)
        return true
      }).pipe(
        Effect.catchAll((error) =>
          Effect.gen(function* () {
            if (process.env.DEBUG) {
              yield* Effect.logError(
                `Connection error: ${error instanceof Error ? error.message : String(error)}`,
              )
            }
            return false
          }),
        ),
      )

      const getRevision = (changeId: string, revisionId = 'current') =>
        Effect.gen(function* () {
          const { credentials, authHeader } = yield* getCredentialsAndAuth
          const normalized = yield* normalizeAndValidate(changeId)
          const url = `${credentials.host}/a/changes/${encodeURIComponent(normalized)}/revisions/${encodeURIComponent(revisionId)}`
          return yield* makeRequest(url, authHeader, 'GET', undefined, RevisionInfo)
        })

      const getFiles = (changeId: string, revisionId = 'current') =>
        Effect.gen(function* () {
          const { credentials, authHeader } = yield* getCredentialsAndAuth
          const normalized = yield* normalizeAndValidate(changeId)
          const url = `${credentials.host}/a/changes/${encodeURIComponent(normalized)}/revisions/${encodeURIComponent(revisionId)}/files`
          return yield* makeRequest(
            url,
            authHeader,
            'GET',
            undefined,
            Schema.Record({ key: Schema.String, value: FileInfo }),
          )
        })

      const getFileDiff = (
        changeId: string,
        filePath: string,
        revisionId = 'current',
        base?: string,
      ) =>
        Effect.gen(function* () {
          const { credentials, authHeader } = yield* getCredentialsAndAuth
          const normalized = yield* normalizeAndValidate(changeId)
          const encodedRevision = encodeURIComponent(revisionId)
          let url = `${credentials.host}/a/changes/${encodeURIComponent(normalized)}/revisions/${encodedRevision}/files/${encodeURIComponent(filePath)}/diff`
          if (base) {
            url += `?base=${encodeURIComponent(base)}`
          }
          return yield* makeRequest(url, authHeader, 'GET', undefined, FileDiffContent)
        })

      const getFileContent = (changeId: string, filePath: string, revisionId = 'current') =>
        Effect.gen(function* () {
          const { credentials, authHeader } = yield* getCredentialsAndAuth
          const normalized = yield* normalizeAndValidate(changeId)
          const url = `${credentials.host}/a/changes/${encodeURIComponent(normalized)}/revisions/${encodeURIComponent(revisionId)}/files/${encodeURIComponent(filePath)}/content`

          const result = yield* Effect.tryPromise({
            try: () =>
              send(url, {
                method: 'GET',
                headers: { Authorization: authHeader },
              }),
            catch: (error) => wrapHttpError(error, 'Gerrit 文件内容请求失败'),
          })

          if (result.status < 200 || result.status >= 300) {
            yield* Effect.fail(
              new ApiError({
                message: `Gerrit 文件内容返回错误: ${result.status}`,
                status: result.status,
                statusCode: result.status,
                ...(result.body !== undefined ? { responseBody: result.body } : {}),
              }),
            )
          }

          return yield* Effect.try({
            try: () => Buffer.from(result.raw, 'base64').toString('utf8'),
            catch: () => new ApiError({ message: 'Gerrit 文件内容 base64 解码失败' }),
          })
        })

      const getPatch = (changeId: string, revisionId = 'current') =>
        Effect.gen(function* () {
          const { credentials, authHeader } = yield* getCredentialsAndAuth
          const normalized = yield* normalizeAndValidate(changeId)
          const url = `${credentials.host}/a/changes/${encodeURIComponent(normalized)}/revisions/${encodeURIComponent(revisionId)}/patch`

          const result = yield* Effect.tryPromise({
            try: () =>
              send(url, {
                method: 'GET',
                headers: { Authorization: authHeader },
              }),
            catch: (error) => wrapHttpError(error, 'Gerrit patch 请求失败'),
          })

          if (result.status < 200 || result.status >= 300) {
            yield* Effect.fail(
              new ApiError({
                message: `Gerrit patch 返回错误: ${result.status}`,
                status: result.status,
                statusCode: result.status,
                ...(result.body !== undefined ? { responseBody: result.body } : {}),
              }),
            )
          }

          return yield* Effect.try({
            try: () => Buffer.from(result.raw, 'base64').toString('utf8'),
            catch: () => new ApiError({ message: 'Gerrit patch base64 解码失败' }),
          })
        })

      const getDiff = (changeId: string, options: DiffOptions = {}) =>
        Effect.gen(function* () {
          const format = options.format || 'unified'
          const revisionId = options.patchset ? `${options.patchset}` : 'current'

          if (format === 'files') {
            const files = yield* getFiles(changeId, revisionId)
            return Object.keys(files)
          }

          if (options.file) {
            if (format === 'json') {
              const diff = yield* getFileDiff(
                changeId,
                options.file,
                revisionId,
                options.base ? `${options.base}` : undefined,
              )
              return diff
            } else {
              const diff = yield* getFileDiff(
                changeId,
                options.file,
                revisionId,
                options.base ? `${options.base}` : undefined,
              )
              return convertToUnifiedDiff(diff, options.file)
            }
          }

          if (options.fullFiles) {
            const files = yield* getFiles(changeId, revisionId)
            const result: Record<string, string> = {}

            for (const [filePath, _fileInfo] of Object.entries(files)) {
              if (filePath === '/COMMIT_MSG' || filePath === '/MERGE_LIST') continue

              const content = yield* getFileContent(changeId, filePath, revisionId).pipe(
                Effect.catchAll(() => Effect.succeed('Binary file or permission denied')),
              )
              result[filePath] = content
            }

            return format === 'json'
              ? result
              : Object.entries(result)
                  .map(([path, content]) => `=== ${path} ===\n${content}\n`)
                  .join('\n')
          }

          if (format === 'json') {
            const files = yield* getFiles(changeId, revisionId)
            return files
          }

          return yield* getPatch(changeId, revisionId)
        })

      const getComments = (changeId: string, revisionId = 'current') =>
        Effect.gen(function* () {
          const { credentials, authHeader } = yield* getCredentialsAndAuth
          const normalized = yield* normalizeAndValidate(changeId)
          const url = `${credentials.host}/a/changes/${encodeURIComponent(normalized)}/revisions/${encodeURIComponent(revisionId)}/comments`
          return yield* makeRequest(
            url,
            authHeader,
            'GET',
            undefined,
            Schema.Record({ key: Schema.String, value: Schema.Array(CommentInfo) }),
          )
        })

      const getMessages = (changeId: string) =>
        Effect.gen(function* () {
          const { credentials, authHeader } = yield* getCredentialsAndAuth
          const normalized = yield* normalizeAndValidate(changeId)
          const url = `${credentials.host}/a/changes/${encodeURIComponent(normalized)}?o=MESSAGES`
          const MessagesResponse = Schema.Struct({
            messages: Schema.optional(Schema.Array(MessageInfo)),
          })
          const changeResponse = yield* makeRequest(
            url,
            authHeader,
            'GET',
            undefined,
            MessagesResponse,
          )
          return changeResponse.messages || []
        }).pipe(Effect.map(filterMeaningfulMessages))

      const addReviewer = (
        changeId: string,
        reviewer: string,
        options?: {
          state?: 'REVIEWER' | 'CC'
          notify?: 'NONE' | 'OWNER' | 'OWNER_REVIEWERS' | 'ALL'
        },
      ) =>
        Effect.gen(function* () {
          const { credentials, authHeader } = yield* getCredentialsAndAuth
          const normalized = yield* normalizeAndValidate(changeId)
          const url = `${credentials.host}/a/changes/${encodeURIComponent(normalized)}/reviewers`
          const body: ReviewerInput = {
            reviewer,
            ...(options?.state && { state: options.state }),
            ...(options?.notify && { notify: options.notify }),
          }
          return yield* makeRequest(url, authHeader, 'POST', body, ReviewerResult)
        })

      const listGroups = (options?: {
        owned?: boolean
        project?: string
        user?: string
        pattern?: string
        limit?: number
        skip?: number
      }) =>
        Effect.gen(function* () {
          const { credentials, authHeader } = yield* getCredentialsAndAuth
          let url = `${credentials.host}/a/groups/`
          const params: string[] = []

          if (options?.owned) {
            params.push('owned')
          }
          if (options?.project) {
            params.push(`p=${encodeURIComponent(options.project)}`)
          }
          if (options?.user) {
            params.push(`user=${encodeURIComponent(options.user)}`)
          }
          if (options?.pattern) {
            params.push(`r=${encodeURIComponent(options.pattern)}`)
          }
          if (options?.limit) {
            params.push(`n=${options.limit}`)
          }
          if (options?.skip) {
            params.push(`S=${options.skip}`)
          }

          if (params.length > 0) {
            url += `?${params.join('&')}`
          }

          const groupsRecord = yield* makeRequest(
            url,
            authHeader,
            'GET',
            undefined,
            Schema.Record({ key: Schema.String, value: GroupInfo }),
          )
          return Object.values(groupsRecord).sort((a, b) =>
            (a.name || a.id).localeCompare(b.name || b.id),
          )
        })

      const getGroup = (groupId: string) =>
        Effect.gen(function* () {
          const { credentials, authHeader } = yield* getCredentialsAndAuth
          const url = `${credentials.host}/a/groups/${encodeURIComponent(groupId)}`
          return yield* makeRequest(url, authHeader, 'GET', undefined, GroupInfo)
        })

      const getGroupDetail = (groupId: string) =>
        Effect.gen(function* () {
          const { credentials, authHeader } = yield* getCredentialsAndAuth
          const url = `${credentials.host}/a/groups/${encodeURIComponent(groupId)}/detail`
          return yield* makeRequest(url, authHeader, 'GET', undefined, GroupDetailInfo)
        })

      const getGroupMembers = (groupId: string) =>
        Effect.gen(function* () {
          const { credentials, authHeader } = yield* getCredentialsAndAuth
          const url = `${credentials.host}/a/groups/${encodeURIComponent(groupId)}/members/`
          return yield* makeRequest(url, authHeader, 'GET', undefined, Schema.Array(AccountInfo))
        })

      const getReviewers = (changeId: string) =>
        Effect.gen(function* () {
          const { credentials, authHeader } = yield* getCredentialsAndAuth
          const normalized = yield* normalizeAndValidate(changeId)
          const url = `${credentials.host}/a/changes/${encodeURIComponent(normalized)}/reviewers`
          const schema = Schema.Array(ReviewerListItem)
          return yield* makeRequest(url, authHeader, 'GET', undefined, schema)
        })

      const removeReviewer = (
        changeId: string,
        accountId: string,
        options?: { notify?: 'NONE' | 'OWNER' | 'OWNER_REVIEWERS' | 'ALL' },
      ) =>
        Effect.gen(function* () {
          const { credentials, authHeader } = yield* getCredentialsAndAuth
          const normalized = yield* normalizeAndValidate(changeId)
          const url = `${credentials.host}/a/changes/${encodeURIComponent(normalized)}/reviewers/${encodeURIComponent(accountId)}/delete`
          const body = options?.notify ? { notify: options.notify } : {}
          yield* makeRequest(url, authHeader, 'POST', body)
        })

      const getTopicUrl = (host: string, changeId: string): string =>
        `${host}/a/changes/${encodeURIComponent(changeId)}/topic`

      const getTopic = (changeId: string) =>
        Effect.gen(function* () {
          const { credentials, authHeader } = yield* getCredentialsAndAuth
          const normalized = yield* normalizeAndValidate(changeId)
          return yield* makeRequest(
            getTopicUrl(credentials.host, normalized),
            authHeader,
            'GET',
            undefined,
            Schema.String,
          ).pipe(
            Effect.map((t) => t.replace(/^"|"$/g, '') || null),
            Effect.catchIf(
              (e) => e instanceof ApiError && e.status === 404,
              () => Effect.succeed(null),
            ),
          )
        })

      const setTopic = (changeId: string, topic: string) =>
        Effect.gen(function* () {
          const { credentials, authHeader } = yield* getCredentialsAndAuth
          const normalized = yield* normalizeAndValidate(changeId)
          const result = yield* makeRequest(
            getTopicUrl(credentials.host, normalized),
            authHeader,
            'PUT',
            { topic },
            Schema.String,
          )
          return result.replace(/^"|"$/g, '')
        })

      const deleteTopic = (changeId: string) =>
        Effect.gen(function* () {
          const { credentials, authHeader } = yield* getCredentialsAndAuth
          const normalized = yield* normalizeAndValidate(changeId)
          yield* makeRequest(getTopicUrl(credentials.host, normalized), authHeader, 'DELETE')
        })

      const setReady = (changeId: string, message?: string) =>
        Effect.gen(function* () {
          const { credentials, authHeader } = yield* getCredentialsAndAuth
          const normalized = yield* normalizeAndValidate(changeId)
          const url = `${credentials.host}/a/changes/${encodeURIComponent(normalized)}/ready`
          const body = message ? { message } : {}
          yield* makeRequest(url, authHeader, 'POST', body)
        })

      const setWip = (changeId: string, message?: string) =>
        Effect.gen(function* () {
          const { credentials, authHeader } = yield* getCredentialsAndAuth
          const normalized = yield* normalizeAndValidate(changeId)
          const url = `${credentials.host}/a/changes/${encodeURIComponent(normalized)}/wip`
          const body = message ? { message } : {}
          yield* makeRequest(url, authHeader, 'POST', body)
        })

      const fetchMergedChanges = (options: {
        after: string
        before?: string
        repo?: string
        maxResults?: number
      }) =>
        Effect.gen(function* () {
          const { credentials, authHeader } = yield* getCredentialsAndAuth
          const limit = options.maxResults ?? 500
          const pageSize = Math.min(limit, 500)
          const allChanges: ChangeInfo[] = []
          let start = 0
          let hasMore = true

          while (hasMore) {
            let q = `status:merged after:${options.after}`
            if (options.before) q += ` before:${options.before}`
            if (options.repo) q += ` project:${options.repo}`
            const url = `${credentials.host}/a/changes/?q=${encodeURIComponent(q)}&o=DETAILED_ACCOUNTS&n=${pageSize}&S=${start}`
            const page = yield* makeRequest(
              url,
              authHeader,
              'GET',
              undefined,
              Schema.Array(ChangeInfo),
            )
            allChanges.push(...page)
            const remaining = limit - allChanges.length
            // Gerrit sets `_more_changes: true` on the LAST item of a page when more results exist.
            const lastItem = page[page.length - 1]
            const serverSaysMore = lastItem?._more_changes === true
            if (!serverSaysMore || remaining <= 0) {
              hasMore = false
            } else {
              start += pageSize
            }
          }

          if (allChanges.length >= limit) {
            yield* Effect.logWarning(
              `results capped at ${limit}. Use --start-date to narrow the date range.`,
            )
          }

          return allChanges as unknown as readonly ChangeInfo[]
        })

      return {
        getChange,
        listChanges,
        listProjects,
        postReview,
        abandonChange,
        restoreChange,
        rebaseChange,
        submitChange,
        testConnection,
        getRevision,
        getFiles,
        getFileDiff,
        getFileContent,
        getPatch,
        getDiff,
        getComments,
        getMessages,
        addReviewer,
        getReviewers,
        listGroups,
        getGroup,
        getGroupDetail,
        getGroupMembers,
        removeReviewer,
        getTopic,
        setTopic,
        deleteTopic,
        setReady,
        setWip,
        fetchMergedChanges,
      }
    }),
  )
