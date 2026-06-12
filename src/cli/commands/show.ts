import { Effect } from 'effect'
import { type ApiError, GerritApiService } from '@/api/gerrit'
import type { CommentInfo, MessageInfo } from '@/schemas/gerrit'
import { getDiffContext } from '@/utils/diff-context'
import { GitError, getChangeIdFromHead, NoChangeIdError } from '@/utils/git-commit'
import { sanitizeCDATA } from '@/utils/shell-safety'
import {
  type ChangeDetails,
  formatShowJson,
  formatShowPretty,
  formatShowXml,
} from './show-formatters'

export const SHOW_HELP_TEXT = `
Examples:
  # Show specific change (using change number)
  $ gerrit-cli show 392385

  # Show specific change (using Change-ID)
  $ gerrit-cli show If5a3ae8cb5a107e187447802358417f311d0c4b1

  # Auto-detect Change-ID from HEAD commit
  $ gerrit-cli show
  $ gerrit-cli show --xml
  $ gerrit-cli show --json

  # Extract build failure URL with jq
  $ gerrit-cli show 392090 --json | jq -r '.messages[] | select(.message | contains("Build Failed")) | .message' | grep -oP 'https://[^\\s]+'

Note: When no change-id is provided, it will be automatically extracted from the
      Change-ID footer in your HEAD commit. You must be in a git repository with
      a commit that has a Change-ID.`

interface ShowOptions {
  xml?: boolean
  json?: boolean
}

const getChangeDetails = (
  changeId: string,
): Effect.Effect<ChangeDetails, ApiError, GerritApiService> =>
  Effect.gen(function* () {
    const gerritApi = yield* GerritApiService
    const change = yield* gerritApi.getChange(changeId)

    let reviewerMap = change.reviewers
    const shouldFetchReviewerFallback =
      reviewerMap === undefined ||
      (reviewerMap.REVIEWER === undefined && reviewerMap.CC === undefined)

    if (shouldFetchReviewerFallback) {
      const detailedChanges = yield* gerritApi
        .listChanges(`change:${change._number}`)
        .pipe(Effect.catchAll(() => Effect.succeed([])))
      const detailedChange =
        detailedChanges.find((candidate) => candidate._number === change._number) ||
        detailedChanges[0]
      reviewerMap = detailedChange?.reviewers
    }

    return {
      id: change.change_id,
      number: change._number,
      subject: change.subject,
      status: change.status,
      project: change.project,
      branch: change.branch,
      owner: {
        name: change.owner?.name,
        email: change.owner?.email,
      },
      created: change.created,
      updated: change.updated,
      commitMessage: change.subject, // For now, using subject as commit message
      topic: change.topic,
      reviewers: (reviewerMap?.REVIEWER ?? []).map((reviewer) => ({
        accountId: reviewer._account_id,
        name: reviewer.name,
        email: reviewer.email,
        username: reviewer.username,
      })),
      ccs: (reviewerMap?.CC ?? []).map((cc) => ({
        accountId: cc._account_id,
        name: cc.name,
        email: cc.email,
        username: cc.username,
      })),
    }
  })

const getDiffForChange = (changeId: string): Effect.Effect<string, ApiError, GerritApiService> =>
  Effect.gen(function* () {
    const gerritApi = yield* GerritApiService
    const diff = yield* gerritApi.getDiff(changeId, { format: 'unified' })
    return typeof diff === 'string' ? diff : JSON.stringify(diff, null, 2)
  })

const getCommentsAndMessagesForChange = (
  changeId: string,
): Effect.Effect<
  { comments: CommentInfo[]; messages: MessageInfo[] },
  ApiError,
  GerritApiService
> =>
  Effect.gen(function* () {
    const gerritApi = yield* GerritApiService

    // Get both inline comments and review messages concurrently
    const [comments, messages] = yield* Effect.all(
      [gerritApi.getComments(changeId), gerritApi.getMessages(changeId)],
      { concurrency: 'unbounded' },
    )

    // Flatten all inline comments from all files
    const allComments: CommentInfo[] = []
    for (const [path, fileComments] of Object.entries(comments)) {
      for (const comment of fileComments) {
        allComments.push({
          ...comment,
          path: path === '/COMMIT_MSG' ? 'Commit Message' : path,
        })
      }
    }

    // Sort inline comments by date (ascending - oldest first)
    allComments.sort((a, b) => {
      const dateA = a.updated ? new Date(a.updated).getTime() : 0
      const dateB = b.updated ? new Date(b.updated).getTime() : 0
      return dateA - dateB
    })

    // Sort messages by date (ascending - oldest first)
    const sortedMessages = [...messages].sort((a, b) => {
      const dateA = new Date(a.date).getTime()
      const dateB = new Date(b.date).getTime()
      return dateA - dateB
    })

    return { comments: allComments, messages: sortedMessages }
  })

// ─── Public API ─────────────────────────────────────────────────────────────

export const showCommand = (
  changeId: string | undefined,
  options: ShowOptions,
): Effect.Effect<void, ApiError | Error | GitError | NoChangeIdError, GerritApiService> =>
  Effect.gen(function* () {
    // Auto-detect Change-ID from HEAD commit if not provided
    const resolvedChangeId = changeId || (yield* getChangeIdFromHead())

    // Fetch all data concurrently
    const [changeDetails, diff, commentsAndMessages] = yield* Effect.all(
      [
        getChangeDetails(resolvedChangeId),
        getDiffForChange(resolvedChangeId),
        getCommentsAndMessagesForChange(resolvedChangeId),
      ],
      { concurrency: 'unbounded' },
    )

    const { comments, messages } = commentsAndMessages

    // Get context for each comment using concurrent requests
    const contextEffects = comments.map((comment) =>
      comment.path && comment.line
        ? getDiffContext(resolvedChangeId, comment.path, comment.line).pipe(
            Effect.map((context) => ({ comment, context })),
            // Graceful degradation for diff fetch failures
            Effect.catchAll(() => Effect.succeed({ comment, context: undefined })),
          )
        : Effect.succeed({ comment, context: undefined }),
    )

    // Execute all context fetches concurrently
    const commentsWithContext = yield* Effect.all(contextEffects, {
      concurrency: 'unbounded',
    })

    // Format output
    if (options.json) {
      yield* Effect.promise(() =>
        formatShowJson(changeDetails, diff, commentsWithContext, messages),
      )
    } else if (options.xml) {
      yield* Effect.promise(() => formatShowXml(changeDetails, diff, commentsWithContext, messages))
    } else {
      formatShowPretty(changeDetails, diff, commentsWithContext, messages)
    }
  }).pipe(
    // Regional error boundary for the entire command
    Effect.catchAll((error) => {
      const errorMessage =
        error instanceof GitError || error instanceof NoChangeIdError || error instanceof Error
          ? error.message
          : String(error)

      if (options.json) {
        return Effect.promise(
          () =>
            new Promise<void>((resolve, reject) => {
              const errorOutput =
                JSON.stringify(
                  {
                    status: 'error',
                    error: errorMessage,
                  },
                  null,
                  2,
                ) + '\n'
              const written = process.stdout.write(errorOutput, (err) => {
                if (err) {
                  reject(err)
                } else {
                  resolve()
                }
              })

              if (!written) {
                // Wait for drain if buffer is full
                process.stdout.once('drain', resolve)
                process.stdout.once('error', reject)
              }
            }),
        )
      } else if (options.xml) {
        return Effect.promise(
          () =>
            new Promise<void>((resolve, reject) => {
              const xmlError =
                `<?xml version="1.0" encoding="UTF-8"?>\n` +
                `<show_result>\n` +
                `  <status>error</status>\n` +
                `  <error><![CDATA[${sanitizeCDATA(errorMessage)}]]></error>\n` +
                `</show_result>\n`
              const written = process.stdout.write(xmlError, (err) => {
                if (err) {
                  reject(err)
                } else {
                  resolve()
                }
              })

              if (!written) {
                process.stdout.once('drain', resolve)
                process.stdout.once('error', reject)
              }
            }),
        )
      } else {
        console.error(`✗ Error: ${errorMessage}`)
      }
      return Effect.succeed(undefined)
    }),
  )
