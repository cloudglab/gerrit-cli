import { Schema } from '@effect/schema'

export const GerritCredentials: Schema.Schema<{
  readonly host: string
  readonly username: string
  readonly password: string
}> = Schema.Struct({
  host: Schema.String.pipe(
    Schema.pattern(/^https?:\/\/.+$/),
    Schema.annotations({ description: 'Gerrit server URL' }),
  ),
  username: Schema.String.pipe(
    Schema.minLength(1),
    Schema.annotations({ description: 'Gerrit username' }),
  ),
  password: Schema.String.pipe(
    Schema.minLength(1),
    Schema.annotations({ description: 'HTTP password or API token' }),
  ),
})
export type GerritCredentials = Schema.Schema.Type<typeof GerritCredentials>
export const FileInfo: Schema.Schema<{
  readonly status?: 'A' | 'D' | 'R' | 'C' | 'M'
  readonly lines_inserted?: number
  readonly lines_deleted?: number
  readonly size?: number
  readonly size_delta?: number
  readonly old_path?: string
  readonly binary?: boolean
}> = Schema.Struct({
  status: Schema.optional(Schema.Literal('A', 'D', 'R', 'C', 'M')), // Added, Deleted, Renamed, Copied, Modified
  lines_inserted: Schema.optional(Schema.Number),
  lines_deleted: Schema.optional(Schema.Number),
  size_delta: Schema.optional(Schema.Number),
  size: Schema.optional(Schema.Number),
  old_path: Schema.optional(Schema.String),
  binary: Schema.optional(Schema.Boolean),
})
export type FileInfo = Schema.Schema.Type<typeof FileInfo>

type PersonDate = { readonly name: string; readonly email: string; readonly date: string }
type ChangeMessage = {
  readonly id: string
  readonly message: string
  readonly date: string
  readonly _revision_number?: number
  readonly tag?: string
}
type RevisionShape = {
  readonly kind?: string
  readonly _number: number
  readonly created: string
  readonly uploader: {
    readonly _account_id: number
    readonly name?: string
    readonly email?: string
    readonly username?: string
  }
  readonly ref: string
  readonly fetch?: Record<string, unknown>
  readonly description?: string
  readonly commit?: {
    readonly commit: string
    readonly parents: ReadonlyArray<{ readonly commit: string; readonly subject: string }>
    readonly author: PersonDate
    readonly committer: PersonDate
    readonly subject: string
    readonly message: string
  }
  readonly files?: Record<string, FileInfo>
  readonly actions?: Record<string, unknown>
}

type ChangeReviewerAccount = {
  readonly _account_id?: number
  readonly name?: string
  readonly email?: string
  readonly username?: string
  readonly display_name?: string
  readonly tags?: ReadonlyArray<string>
}
const ChangeReviewerAccountInfo: Schema.Schema<ChangeReviewerAccount> = Schema.Struct({
  _account_id: Schema.optional(Schema.Number),
  name: Schema.optional(Schema.String),
  email: Schema.optional(Schema.String),
  username: Schema.optional(Schema.String),
  display_name: Schema.optional(Schema.String),
  tags: Schema.optional(Schema.Array(Schema.String)),
})
type ChangeReviewerMap = Partial<
  Record<'REVIEWER' | 'CC' | 'REMOVED', ReadonlyArray<ChangeReviewerAccount>>
>
// Account/User schema (reusable for groups and reviewers)
export const AccountInfo: Schema.Schema<{
  readonly _account_id: number
  readonly name?: string
  readonly email?: string
  readonly username?: string
  readonly display_name?: string
  readonly tags?: ReadonlyArray<string>
  readonly inactive?: boolean
  readonly status?: string
}> = Schema.Struct({
  _account_id: Schema.Number,
  name: Schema.optional(Schema.String),
  email: Schema.optional(Schema.String),
  username: Schema.optional(Schema.String),
  display_name: Schema.optional(Schema.String),
  tags: Schema.optional(Schema.Array(Schema.String)),
  inactive: Schema.optional(Schema.Boolean),
  status: Schema.optional(Schema.String),
})
export type AccountInfo = Schema.Schema.Type<typeof AccountInfo>

export const ChangeInfo: Schema.Schema<{
  readonly id: string
  readonly project: string
  readonly branch: string
  readonly change_id: string
  readonly subject: string
  readonly status: 'NEW' | 'MERGED' | 'ABANDONED' | 'DRAFT'
  readonly created?: string
  readonly updated?: string
  readonly submitted?: string
  readonly insertions?: number
  readonly deletions?: number
  readonly _number: number
  readonly owner?: AccountInfo
  readonly labels?: Record<
    string,
    {
      readonly approved?: AccountInfo
      readonly rejected?: AccountInfo
      readonly recommended?: AccountInfo
      readonly disliked?: AccountInfo
      readonly value?: number
    }
  >
  readonly submittable?: boolean
  readonly work_in_progress?: boolean
  readonly is_private?: boolean
  readonly current_revision?: string
  readonly revisions?: Record<string, RevisionShape>
  readonly topic?: string
  readonly hashtags?: ReadonlyArray<string>
  readonly reviewers?: ChangeReviewerMap
  readonly mergeable?: boolean
  readonly unresolved_comment_count?: number
  readonly total_comment_count?: number
  readonly attention_set?: Record<string, unknown>
  readonly submit_type?: string
  readonly messages?: ReadonlyArray<ChangeMessage>
  readonly _more_changes?: boolean
}> = Schema.Struct({
  id: Schema.String,
  project: Schema.String,
  branch: Schema.String,
  change_id: Schema.String,
  subject: Schema.String,
  status: Schema.Literal('NEW', 'MERGED', 'ABANDONED', 'DRAFT'),
  created: Schema.optional(Schema.String),
  updated: Schema.optional(Schema.String),
  submitted: Schema.optional(Schema.String),
  insertions: Schema.optional(Schema.Number),
  deletions: Schema.optional(Schema.Number),
  _number: Schema.Number,
  owner: Schema.optional(AccountInfo),
  labels: Schema.optional(
    Schema.Record({
      key: Schema.String,
      value: Schema.Struct({
        approved: Schema.optional(AccountInfo),
        rejected: Schema.optional(AccountInfo),
        recommended: Schema.optional(AccountInfo),
        disliked: Schema.optional(AccountInfo),
        value: Schema.optional(Schema.Number),
        default_value: Schema.optional(Schema.Number),
        blocking: Schema.optional(Schema.Boolean),
        optional: Schema.optional(Schema.Boolean),
        description: Schema.optional(Schema.String),
        values: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.String })),
        all: Schema.optional(
          Schema.Array(
            Schema.Struct({
              _account_id: Schema.optional(Schema.Number),
              name: Schema.optional(Schema.String),
              email: Schema.optional(Schema.String),
              username: Schema.optional(Schema.String),
              value: Schema.optional(Schema.Number),
              post_submit: Schema.optional(Schema.Boolean),
              permitted_voting_range: Schema.optional(
                Schema.Struct({ min: Schema.Number, max: Schema.Number }),
              ),
              date: Schema.optional(Schema.String),
              tag: Schema.optional(Schema.String),
            }),
          ),
        ),
      }),
    }),
  ),
  submittable: Schema.optional(Schema.Boolean),
  work_in_progress: Schema.optional(Schema.Boolean),
  is_private: Schema.optional(Schema.Boolean),
  current_revision: Schema.optional(Schema.String),
  revisions: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Any })),
  topic: Schema.optional(Schema.String),
  hashtags: Schema.optional(Schema.Array(Schema.String)),
  reviewers: Schema.optional(
    Schema.Struct({
      REVIEWER: Schema.optional(Schema.Array(ChangeReviewerAccountInfo)),
      CC: Schema.optional(Schema.Array(ChangeReviewerAccountInfo)),
      REMOVED: Schema.optional(Schema.Array(ChangeReviewerAccountInfo)),
    }),
  ),
  mergeable: Schema.optional(Schema.Boolean),
  unresolved_comment_count: Schema.optional(Schema.Number),
  total_comment_count: Schema.optional(Schema.Number),
  attention_set: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Any })),
  submit_type: Schema.optional(Schema.String),
  _more_changes: Schema.optional(Schema.Boolean),
  messages: Schema.optional(
    Schema.Array(
      Schema.Struct({
        id: Schema.String,
        message: Schema.String,
        date: Schema.String,
        _revision_number: Schema.optional(Schema.Number),
        tag: Schema.optional(Schema.String),
      }),
    ),
  ),
})
export type ChangeInfo = Schema.Schema.Type<typeof ChangeInfo>

export const CommentInput: Schema.Schema<{
  readonly message: string
  readonly unresolved?: boolean
}> = Schema.Struct({
  message: Schema.String.pipe(
    Schema.minLength(1),
    Schema.annotations({ description: 'Comment message' }),
  ),
  unresolved: Schema.optional(Schema.Boolean),
})
export type CommentInput = Schema.Schema.Type<typeof CommentInput>

export const CommentInfo: Schema.Schema<{
  readonly id: string
  readonly path?: string
  readonly patch_set?: number
  readonly side?: 'PARENT' | 'REVISION'
  readonly line?: number
  readonly range?: {
    readonly start_line: number
    readonly end_line: number
    readonly start_character?: number
    readonly end_character?: number
  }
  readonly message: string
  readonly author?: ChangeReviewerAccount
  readonly updated?: string
  readonly unresolved?: boolean
  readonly in_reply_to?: string
  readonly tag?: string
  readonly change_message_id?: string
  readonly commit_id?: string
}> = Schema.Struct({
  id: Schema.String,
  path: Schema.optional(Schema.String),
  patch_set: Schema.optional(Schema.Number),
  side: Schema.optional(Schema.Literal('PARENT', 'REVISION')),
  line: Schema.optional(Schema.Number),
  range: Schema.optional(
    Schema.Struct({
      start_line: Schema.Number,
      end_line: Schema.Number,
      start_character: Schema.optional(Schema.Number),
      end_character: Schema.optional(Schema.Number),
    }),
  ),
  message: Schema.String,
  author: Schema.optional(ChangeReviewerAccountInfo),
  updated: Schema.optional(Schema.String),
  unresolved: Schema.optional(Schema.Boolean),
  in_reply_to: Schema.optional(Schema.String),
  tag: Schema.optional(Schema.String),
  change_message_id: Schema.optional(Schema.String),
  commit_id: Schema.optional(Schema.String),
})
export type CommentInfo = Schema.Schema.Type<typeof CommentInfo>

export const MessageInfo: Schema.Schema<{
  readonly id: string
  readonly message: string
  readonly author?: AccountInfo
  readonly real_author?: AccountInfo
  readonly date: string
  readonly _revision_number?: number
  readonly tag?: string
}> = Schema.Struct({
  id: Schema.String,
  message: Schema.String,
  author: Schema.optional(AccountInfo),
  real_author: Schema.optional(AccountInfo),
  date: Schema.String,
  _revision_number: Schema.optional(Schema.Number),
  tag: Schema.optional(Schema.String),
})
export type MessageInfo = Schema.Schema.Type<typeof MessageInfo>

export const ReviewInput: Schema.Schema<{
  readonly message?: string
  readonly labels?: Record<string, number>
  readonly comments?: Record<
    string,
    ReadonlyArray<{
      readonly line?: number
      readonly range?: {
        readonly start_line: number
        readonly end_line: number
        readonly start_character?: number
        readonly end_character?: number
      }
      readonly message: string
      readonly side?: 'PARENT' | 'REVISION'
      readonly unresolved?: boolean
      readonly in_reply_to?: string
    }>
  >
}> = Schema.Struct({
  message: Schema.optional(Schema.String),
  labels: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Number })),
  comments: Schema.optional(
    Schema.Record({
      key: Schema.String,
      value: Schema.Array(
        Schema.Struct({
          line: Schema.optional(Schema.Number),
          range: Schema.optional(
            Schema.Struct({
              start_line: Schema.Number,
              end_line: Schema.Number,
              start_character: Schema.optional(Schema.Number),
              end_character: Schema.optional(Schema.Number),
            }),
          ),
          message: Schema.String,
          side: Schema.optional(Schema.Literal('PARENT', 'REVISION')),
          unresolved: Schema.optional(Schema.Boolean),
          in_reply_to: Schema.optional(Schema.String),
        }),
      ),
    }),
  ),
})
export type ReviewInput = Schema.Schema.Type<typeof ReviewInput>

export const ProjectInfo: Schema.Schema<{
  readonly id: string
  readonly name: string
  readonly parent?: string
  readonly description?: string
  readonly state?: 'ACTIVE' | 'READ_ONLY' | 'HIDDEN'
}> = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  parent: Schema.optional(Schema.String),
  description: Schema.optional(Schema.String),
  state: Schema.optional(Schema.Literal('ACTIVE', 'READ_ONLY', 'HIDDEN')),
})
export type ProjectInfo = Schema.Schema.Type<typeof ProjectInfo>

// ─── Re-exports from split schema modules ─────────────────────────────────
import {
  DiffCommandOptions,
  DiffFileMeta,
  DiffFormat,
  DiffOptions,
  FileDiffContent,
} from './diff-schemas'

export { DiffCommandOptions, DiffFileMeta, DiffFormat, DiffOptions, FileDiffContent }

export const RevisionInfo: Schema.Schema<{
  readonly kind?: string
  readonly _number: number
  readonly created: string
  readonly uploader: {
    readonly _account_id: number
    readonly name?: string
    readonly email?: string
    readonly username?: string
  }
  readonly ref: string
  readonly fetch?: Record<string, unknown>
  readonly description?: string
  readonly commit?: {
    readonly commit: string
    readonly parents: ReadonlyArray<{ readonly commit: string; readonly subject: string }>
    readonly author: PersonDate
    readonly committer: PersonDate
    readonly subject: string
    readonly message: string
  }
  readonly files?: Record<
    string,
    {
      readonly status?: 'A' | 'D' | 'R' | 'C' | 'M'
      readonly lines_inserted?: number
      readonly lines_deleted?: number
      readonly size?: number
      readonly size_delta?: number
      readonly old_path?: string
      readonly binary?: boolean
    }
  >
  readonly actions?: Record<string, unknown>
}> = Schema.Struct({
  kind: Schema.optional(Schema.String),
  _number: Schema.Number,
  created: Schema.String,
  uploader: Schema.Struct({
    _account_id: Schema.Number,
    name: Schema.optional(Schema.String),
    email: Schema.optional(Schema.String),
    username: Schema.optional(Schema.String),
  }),
  ref: Schema.String,
  fetch: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Any })),
  description: Schema.optional(Schema.String),
  commit: Schema.optional(
    Schema.Struct({
      commit: Schema.String,
      parents: Schema.Array(
        Schema.Struct({
          commit: Schema.String,
          subject: Schema.String,
        }),
      ),
      author: Schema.Struct({
        name: Schema.String,
        email: Schema.String,
        date: Schema.String,
      }),
      committer: Schema.Struct({
        name: Schema.String,
        email: Schema.String,
        date: Schema.String,
      }),
      subject: Schema.String,
      message: Schema.String,
    }),
  ),
  files: Schema.optional(Schema.Record({ key: Schema.String, value: FileInfo })),
  actions: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Any })),
})
export type RevisionInfo = Schema.Schema.Type<typeof RevisionInfo>
// Backwards-compatible alias used by mock-generator and other consumers
export type RevisionInfoType = RevisionShape

import { ReviewerInput, ReviewerResult } from './reviewer'

export type { ReviewerListItem } from './reviewer'
export { ReviewerInput, ReviewerResult }

import { GroupDetailInfo, GroupInfo } from './groups'

export { GroupDetailInfo, GroupInfo }

export const RebaseInput: Schema.Schema<{
  readonly base?: string
}> = Schema.Struct({
  base: Schema.optional(Schema.String),
})
export type RebaseInput = Schema.Schema.Type<typeof RebaseInput>

// Submit schemas
export const SubmitInfo: Schema.Schema<{
  readonly status: 'MERGED' | 'SUBMITTED'
  readonly change_id?: string
}> = Schema.Struct({
  status: Schema.Literal('MERGED', 'SUBMITTED'),
  change_id: Schema.optional(Schema.String),
})
export type SubmitInfo = Schema.Schema.Type<typeof SubmitInfo>

// API Response schemas
export const GerritError: Schema.Schema<{
  readonly message: string
  readonly status?: number
}> = Schema.Struct({
  message: Schema.String,
  status: Schema.optional(Schema.Number),
})
export type GerritError = Schema.Schema.Type<typeof GerritError>
