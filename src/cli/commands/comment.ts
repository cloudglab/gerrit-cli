import { ParseResult, Schema, TreeFormatter } from '@effect/schema'
import { Effect, pipe } from 'effect'
import { type ApiError, GerritApiService } from '@/api/gerrit'
import type { ReviewInput } from '@/schemas/gerrit'
import { assertWriteAllowed, type WriteGuardError } from '@/utils/write-guard'

export const COMMENT_HELP_TEXT = `
Examples:
  # Post a general comment on a change
  $ gerrit-cli comment 12345 -m "Looks good to me!"

  # Post a comment using piped input
  $ echo "This is a comment from stdin!" | gerrit-cli comment 12345

  # Post a line-specific comment
  $ gerrit-cli comment 12345 --file src/main.js --line 42 -m "Consider using const here"

  # Reply to a specific comment thread (resolves the thread by default)
  $ gerrit-cli comment 12345 --file src/main.js --line 42 --reply-to 37935b71_9e79a76c -m "Done, fixed"

  # Reply but keep the thread unresolved
  $ gerrit-cli comment 12345 --file src/main.js --line 42 --reply-to 37935b71_9e79a76c --unresolved -m "What do you think?"

  # Post multiple comments using batch mode
  $ echo '{"message": "Review complete", "comments": [
      {"file": "src/main.js", "line": 10, "message": "Good refactor"}
    ]}' | gerrit-cli comment 12345 --batch

Note: Line numbers refer to the NEW version of the file, not diff line numbers.
Note: Comment IDs for --reply-to can be found in \`gerrit-cli comments --xml\` or \`gerrit-cli comments --json\` output (<id> / "id" field).`

export interface CommentOptions {
  message?: string
  xml?: boolean
  json?: boolean
  file?: string
  line?: number
  replyTo?: string
  unresolved?: boolean
  batch?: boolean
  confirm?: boolean
}

// Schema for batch input validation - array of comments
const BatchCommentSchema = Schema.Array(
  Schema.Struct({
    file: Schema.String,
    line: Schema.optional(Schema.Number), // Optional when using range
    range: Schema.optional(
      Schema.Struct({
        start_line: Schema.Number,
        end_line: Schema.Number,
        start_character: Schema.optional(Schema.Number),
        end_character: Schema.optional(Schema.Number),
      }),
    ),
    message: Schema.String,
    path: Schema.optional(Schema.String), // Support both 'file' and 'path' for flexibility
    side: Schema.optional(Schema.Literal('PARENT', 'REVISION')),
    unresolved: Schema.optional(Schema.Boolean),
  }),
)

type BatchCommentInput = Schema.Schema.Type<typeof BatchCommentSchema>

// Effect-ified stdin reader
const readStdin = Effect.async<string, Error>((callback) => {
  let data = ''

  const onData = (chunk: Buffer | string) => {
    data += chunk
  }
  const onEnd = () => callback(Effect.succeed(data))
  const onError = (error: Error) =>
    callback(Effect.fail(new Error(`Failed to read stdin: ${error.message}`)))

  process.stdin.on('data', onData)
  process.stdin.on('end', onEnd)
  process.stdin.on('error', onError)

  // Cleanup function
  return Effect.sync(() => {
    process.stdin.removeListener('data', onData)
    process.stdin.removeListener('end', onEnd)
    process.stdin.removeListener('error', onError)
  })
})

// Helper to parse JSON with better error handling
const parseJson = (data: string): Effect.Effect<unknown, Error> =>
  Effect.try({
    try: () => JSON.parse(data),
    catch: (error) => {
      const errorMsg = error instanceof Error ? error.message : 'parse error'
      const lines = data.split('\n')
      const lineCount = lines.length

      // Show first few lines to help identify the issue
      const preview = lines.slice(0, 10).join('\n')
      const truncated = lineCount > 10 ? `\n... (${lineCount - 10} more lines)` : ''

      return new Error(
        `Invalid JSON input: ${errorMsg}\n` +
          `Input (${data.length} chars, ${lineCount} lines):\n` +
          `${preview}${truncated}\n\n` +
          `Expected format: [{"file": "path/to/file", "line": 123, "message": "comment text"}]`,
      )
    },
  })

// Helper to build ReviewInput from batch data
const buildBatchReview = (batchInput: BatchCommentInput): ReviewInput => {
  const commentsByFile = batchInput.reduce<
    Record<
      string,
      Array<{
        line?: number
        range?: {
          start_line: number
          end_line: number
          start_character?: number
          end_character?: number
        }
        message: string
        side?: 'PARENT' | 'REVISION'
        unresolved?: boolean
      }>
    >
  >((acc, comment) => {
    // Support both 'file' and 'path' properties
    const filePath = comment.file || comment.path || ''
    if (filePath && !acc[filePath]) {
      acc[filePath] = []
    }
    if (filePath) {
      // When range is present, don't include line (Gerrit API preference)
      const commentObj: {
        message: string
        side?: 'PARENT' | 'REVISION'
        unresolved?: boolean
        range?: BatchCommentInput[number]['range']
        line?: number
      } = {
        message: comment.message,
        side: comment.side,
        unresolved: comment.unresolved,
      }

      if (comment.range) {
        commentObj.range = comment.range
      } else if (comment.line) {
        commentObj.line = comment.line
      }

      acc[filePath].push(commentObj)
    }
    return acc
  }, {})

  return {
    comments: commentsByFile,
  }
}

// Create ReviewInput based on options
export const createReviewInputFromString = (
  content: string,
  options: CommentOptions,
): Effect.Effect<ReviewInput, Error> => {
  // Batch mode with provided content
  if (options.batch) {
    return pipe(
      parseJson(content),
      Effect.flatMap(
        Schema.decodeUnknown(BatchCommentSchema, {
          errors: 'all',
          onExcessProperty: 'ignore',
        }),
      ),
      Effect.mapError((error) => {
        let errorMessage = 'Invalid batch input format.\n'
        if (ParseResult.isParseError(error)) {
          errorMessage += TreeFormatter.formatErrorSync(error)
          errorMessage += '\n\nExpected format: [{"file": "...", "line": ..., "message": "..."}]'
        } else if (error instanceof Error) {
          errorMessage += error.message
        } else {
          errorMessage +=
            'Expected: [{"file": "...", "line": ..., "message": "...", "side"?: "PARENT|REVISION", "range"?: {...}}]'
        }
        return new Error(errorMessage)
      }),
      Effect.map(buildBatchReview),
    )
  }

  // Overall comment with provided content
  const message = content.trim()
  return message.length > 0
    ? Effect.succeed({ message })
    : Effect.fail(new Error('Message is required'))
}

const createReviewInput = (options: CommentOptions): Effect.Effect<ReviewInput, Error> => {
  // Validate --reply-to constraints early
  if (options.replyTo !== undefined) {
    if (options.batch) {
      return Effect.fail(new Error('--reply-to cannot be used with --batch'))
    }
    if (!(options.file && options.line)) {
      return Effect.fail(new Error('--reply-to requires --file and --line'))
    }
    if (options.replyTo.trim().length === 0) {
      return Effect.fail(new Error('--reply-to comment ID cannot be empty'))
    }
    // Normalize to trimmed value so the payload never contains leading/trailing whitespace
    options = { ...options, replyTo: options.replyTo.trim() }
  }

  // Batch mode
  if (options.batch) {
    return pipe(
      readStdin,
      Effect.flatMap(parseJson),
      Effect.flatMap(
        Schema.decodeUnknown(BatchCommentSchema, {
          errors: 'all',
          onExcessProperty: 'ignore',
        }),
      ),
      Effect.mapError((error) => {
        // Extract the actual schema validation errors
        let errorMessage = 'Invalid batch input format.\n'

        if (ParseResult.isParseError(error)) {
          // Format the parse error with details
          errorMessage += TreeFormatter.formatErrorSync(error)
          errorMessage += '\n\nExpected format: [{"file": "...", "line": ..., "message": "..."}]'
        } else if (error instanceof Error) {
          errorMessage += error.message
        } else {
          errorMessage +=
            'Expected: [{"file": "...", "line": ..., "message": "...", "side"?: "PARENT|REVISION", "range"?: {...}}]'
        }

        return new Error(errorMessage)
      }),
      Effect.map(buildBatchReview),
    )
  }

  // Line comment mode
  if (options.file && options.line) {
    return options.message
      ? Effect.succeed({
          comments: {
            [options.file]: [
              {
                line: options.line,
                message: options.message,
                ...(options.replyTo !== undefined ? { in_reply_to: options.replyTo } : {}),
                // When replying, default unresolved to false (resolves the thread) unless explicitly set
                ...(options.replyTo !== undefined
                  ? { unresolved: options.unresolved ?? false }
                  : options.unresolved !== undefined
                    ? { unresolved: options.unresolved }
                    : {}),
              },
            ],
          },
        })
      : Effect.fail(new Error('Message is required for line comments. Use -m "your message"'))
  }

  // Overall comment mode
  if (options.message) {
    return Effect.succeed({ message: options.message })
  }

  // If no message provided, read from stdin (for piping support)
  return pipe(
    readStdin,
    Effect.map((stdinContent) => stdinContent.trim()),
    Effect.flatMap((message) =>
      message.length > 0
        ? Effect.succeed({ message })
        : Effect.fail(
            new Error('Message is required. Use -m "your message" or pipe content to stdin'),
          ),
    ),
  )
}

// Export a version that accepts direct input instead of reading stdin
export const commentCommandWithInput = (
  changeId: string,
  input: string,
  options: CommentOptions,
): Effect.Effect<void, ApiError | Error, GerritApiService> =>
  Effect.gen(function* () {
    const apiService = yield* GerritApiService

    // Build the review input from provided string
    const review = yield* createReviewInputFromString(input, options)

    // Execute the API calls in sequence
    const change = yield* pipe(
      apiService.getChange(changeId),
      Effect.mapError((error) =>
        error._tag === 'ApiError' ? new Error(`Failed to get change: ${error.message}`) : error,
      ),
    )

    yield* pipe(
      apiService.postReview(changeId, review),
      Effect.mapError((error) => {
        if (error._tag === 'ApiError') {
          // Build detailed error context for batch comments
          if (options.batch && review.comments) {
            const commentDetails = Object.entries(review.comments)
              .flatMap(([file, comments]) =>
                comments.map((comment) => {
                  const parts = [`${file}:${comment.line || 'range'}`]
                  if (comment.message?.length > 50) {
                    parts.push(`"${comment.message.slice(0, 50)}..."`)
                  } else {
                    parts.push(`"${comment.message}"`)
                  }
                  return parts.join(' ')
                }),
              )
              .join(', ')

            return new Error(
              `Failed to post comment: ${error.message}\nTried to post: ${commentDetails}`,
            )
          }

          // Single line comment context
          if (options.file && options.line) {
            return new Error(
              `Failed to post comment: ${error.message}\nTried to post to ${options.file}:${options.line}: "${options.message}"`,
            )
          }

          // Overall comment context
          if (options.message) {
            const msg =
              options.message.length > 50 ? `${options.message.slice(0, 50)}...` : options.message
            return new Error(
              `Failed to post comment: ${error.message}\nTried to post overall comment: "${msg}"`,
            )
          }

          return new Error(`Failed to post comment: ${error.message}`)
        }
        return error
      }),
    )

    // Format and display output
    yield* formatOutput(change, review, options, changeId)
  })

export const commentCommand = (
  changeId: string,
  options: CommentOptions,
): Effect.Effect<void, ApiError | Error | WriteGuardError, GerritApiService> =>
  Effect.gen(function* () {
    const apiService = yield* GerritApiService

    // Build the review input
    const review = yield* createReviewInput(options)

    yield* assertWriteAllowed({
      confirm: options.confirm ?? false,
      operation: 'post comment',
      target: changeId,
    })

    // Execute the API calls in sequence
    const change = yield* pipe(
      apiService.getChange(changeId),
      Effect.mapError((error) =>
        error._tag === 'ApiError' ? new Error(`Failed to get change: ${error.message}`) : error,
      ),
    )

    yield* pipe(
      apiService.postReview(changeId, review),
      Effect.mapError((error) => {
        if (error._tag === 'ApiError') {
          // Build detailed error context for batch comments
          if (options.batch && review.comments) {
            const commentDetails = Object.entries(review.comments)
              .flatMap(([file, comments]) =>
                comments.map((comment) => {
                  const parts = [`${file}:${comment.line || 'range'}`]
                  if (comment.message?.length > 50) {
                    parts.push(`"${comment.message.slice(0, 50)}..."`)
                  } else {
                    parts.push(`"${comment.message}"`)
                  }
                  return parts.join(' ')
                }),
              )
              .join(', ')

            return new Error(
              `Failed to post comment: ${error.message}\nTried to post: ${commentDetails}`,
            )
          }

          // Single line comment context
          if (options.file && options.line) {
            return new Error(
              `Failed to post comment: ${error.message}\nTried to post to ${options.file}:${options.line}: "${options.message}"`,
            )
          }

          // Overall comment context
          if (options.message) {
            const msg =
              options.message.length > 50 ? `${options.message.slice(0, 50)}...` : options.message
            return new Error(
              `Failed to post comment: ${error.message}\nTried to post overall comment: "${msg}"`,
            )
          }

          return new Error(`Failed to post comment: ${error.message}`)
        }
        return error
      }),
    )

    // Format and display output
    yield* formatOutput(change, review, options, changeId)
  })

import { formatOutput } from './comment-output'
