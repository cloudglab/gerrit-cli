import { Schema } from '@effect/schema'

export const ReviewerListItem: Schema.Schema<{
  readonly _account_id?: number
  readonly name?: string
  readonly email?: string
  readonly username?: string
  readonly approvals?: { readonly [x: string]: string }
}> = Schema.Struct({
  _account_id: Schema.optional(Schema.Number),
  name: Schema.optional(Schema.String),
  email: Schema.optional(Schema.String),
  username: Schema.optional(Schema.String),
  approvals: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.String })),
})
export type ReviewerListItem = Schema.Schema.Type<typeof ReviewerListItem>

export const ReviewerInput: Schema.Schema<{
  readonly reviewer: string
  readonly state?: 'REVIEWER' | 'CC' | 'REMOVED'
  readonly confirmed?: boolean
  readonly notify?: 'NONE' | 'OWNER' | 'OWNER_REVIEWERS' | 'ALL'
}> = Schema.Struct({
  reviewer: Schema.String,
  state: Schema.optional(Schema.Literal('REVIEWER', 'CC', 'REMOVED')),
  confirmed: Schema.optional(Schema.Boolean),
  notify: Schema.optional(Schema.Literal('NONE', 'OWNER', 'OWNER_REVIEWERS', 'ALL')),
})
export type ReviewerInput = Schema.Schema.Type<typeof ReviewerInput>

const ReviewerAccountInfo = Schema.Struct({
  _account_id: Schema.Number,
  name: Schema.optional(Schema.String),
  email: Schema.optional(Schema.String),
  username: Schema.optional(Schema.String),
})

export const ReviewerResult: Schema.Schema<{
  readonly input: string
  readonly reviewers?: ReadonlyArray<{
    readonly _account_id: number
    readonly name?: string
    readonly email?: string
    readonly username?: string
  }>
  readonly ccs?: ReadonlyArray<{
    readonly _account_id: number
    readonly name?: string
    readonly email?: string
    readonly username?: string
  }>
  readonly error?: string
  readonly confirm?: boolean
}> = Schema.Struct({
  input: Schema.String,
  reviewers: Schema.optional(Schema.Array(ReviewerAccountInfo)),
  ccs: Schema.optional(Schema.Array(ReviewerAccountInfo)),
  error: Schema.optional(Schema.String),
  confirm: Schema.optional(Schema.Boolean),
})
export type ReviewerResult = Schema.Schema.Type<typeof ReviewerResult>
