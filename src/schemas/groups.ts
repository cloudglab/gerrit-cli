import { Schema } from '@effect/schema'

const AccountInfoShape: Schema.Schema<{
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

export const GroupInfo: Schema.Schema<{
  readonly id: string
  readonly name?: string
  readonly url?: string
  readonly options?: {
    readonly visible_to_all?: boolean
  }
  readonly description?: string
  readonly group_id?: number
  readonly owner?: string
  readonly owner_id?: string
  readonly created_on?: string
}> = Schema.Struct({
  id: Schema.String,
  name: Schema.optional(Schema.String),
  url: Schema.optional(Schema.String),
  options: Schema.optional(
    Schema.Struct({
      visible_to_all: Schema.optional(Schema.Boolean),
    }),
  ),
  description: Schema.optional(Schema.String),
  group_id: Schema.optional(Schema.Number),
  owner: Schema.optional(Schema.String),
  owner_id: Schema.optional(Schema.String),
  created_on: Schema.optional(Schema.String),
})
export type GroupInfo = Schema.Schema.Type<typeof GroupInfo>

export const GroupDetailInfo: Schema.Schema<{
  readonly id: string
  readonly name?: string
  readonly url?: string
  readonly options?: {
    readonly visible_to_all?: boolean
  }
  readonly description?: string
  readonly group_id?: number
  readonly owner?: string
  readonly owner_id?: string
  readonly created_on?: string
  readonly members?: ReadonlyArray<Schema.Schema.Type<typeof AccountInfoShape>>
  readonly includes?: ReadonlyArray<{
    readonly id: string
    readonly name?: string
  }>
}> = Schema.Struct({
  id: Schema.String,
  name: Schema.optional(Schema.String),
  url: Schema.optional(Schema.String),
  options: Schema.optional(
    Schema.Struct({
      visible_to_all: Schema.optional(Schema.Boolean),
    }),
  ),
  description: Schema.optional(Schema.String),
  group_id: Schema.optional(Schema.Number),
  owner: Schema.optional(Schema.String),
  owner_id: Schema.optional(Schema.String),
  created_on: Schema.optional(Schema.String),
  members: Schema.optional(Schema.Array(AccountInfoShape)),
  includes: Schema.optional(
    Schema.Array(
      Schema.Struct({
        id: Schema.String,
        name: Schema.optional(Schema.String),
      }),
    ),
  ),
})
export type GroupDetailInfo = Schema.Schema.Type<typeof GroupDetailInfo>
