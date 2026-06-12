import { Schema } from '@effect/schema'

export const DiffFileMeta: Schema.Schema<{
  readonly name: string
  readonly content_type: string
  readonly lines?: number
}> = Schema.Struct({
  name: Schema.String,
  content_type: Schema.String,
  lines: Schema.optional(Schema.Number),
})
export type DiffFileMeta = Schema.Schema.Type<typeof DiffFileMeta>

export const FileDiffContent: Schema.Schema<{
  readonly meta_a?: DiffFileMeta
  readonly meta_b?: DiffFileMeta
  readonly binary?: boolean
  readonly change_type?: 'ADDED' | 'MODIFIED' | 'DELETED' | 'RENAMED' | 'COPIED' | 'REWRITE'
  readonly diff_header?: ReadonlyArray<string>
  readonly intraline_status?: 'OK' | 'TIMEOUT' | 'ERROR'
  readonly content: ReadonlyArray<{
    readonly a?: ReadonlyArray<string>
    readonly b?: ReadonlyArray<string>
    readonly ab?: ReadonlyArray<string>
    readonly edit_list?: ReadonlyArray<{
      readonly op: 'i' | 'd' | 'r'
      readonly a: ReadonlyArray<string>
      readonly b: ReadonlyArray<string>
    }>
    readonly due_to_rebase?: boolean
    readonly skip?: number
  }>
}> = Schema.Struct({
  meta_a: Schema.optional(DiffFileMeta),
  meta_b: Schema.optional(DiffFileMeta),
  binary: Schema.optional(Schema.Boolean),
  change_type: Schema.optional(
    Schema.Literal('ADDED', 'MODIFIED', 'DELETED', 'RENAMED', 'COPIED', 'REWRITE'),
  ),
  diff_header: Schema.optional(Schema.Array(Schema.String)),
  intraline_status: Schema.optional(Schema.Literal('OK', 'TIMEOUT', 'ERROR')),
  content: Schema.Array(
    Schema.Struct({
      a: Schema.optional(Schema.Array(Schema.String)),
      b: Schema.optional(Schema.Array(Schema.String)),
      ab: Schema.optional(Schema.Array(Schema.String)),
      edit_list: Schema.optional(
        Schema.Array(
          Schema.Struct({
            op: Schema.Literal('i', 'd', 'r'),
            a: Schema.Array(Schema.String),
            b: Schema.Array(Schema.String),
          }),
        ),
      ),
      due_to_rebase: Schema.optional(Schema.Boolean),
      skip: Schema.optional(Schema.Number),
    }),
  ),
})
export type FileDiffContent = Schema.Schema.Type<typeof FileDiffContent>

export const DiffFormat: Schema.Schema<'unified' | 'json' | 'files'> = Schema.Literal(
  'unified',
  'json',
  'files',
)
export type DiffFormat = Schema.Schema.Type<typeof DiffFormat>

export const DiffOptions: Schema.Schema<{
  readonly format?: 'unified' | 'json' | 'files'
  readonly patchset?: number
  readonly file?: string
  readonly filesOnly?: boolean
  readonly fullFiles?: boolean
  readonly base?: number
  readonly target?: number
}> = Schema.Struct({
  format: Schema.optional(DiffFormat),
  patchset: Schema.optional(Schema.Number),
  file: Schema.optional(Schema.String),
  filesOnly: Schema.optional(Schema.Boolean),
  fullFiles: Schema.optional(Schema.Boolean),
  base: Schema.optional(Schema.Number),
  target: Schema.optional(Schema.Number),
})
export type DiffOptions = Schema.Schema.Type<typeof DiffOptions>

export const DiffCommandOptions: Schema.Schema<{
  readonly xml?: boolean
  readonly json?: boolean
  readonly file?: string
  readonly filesOnly?: boolean
  readonly format?: 'unified' | 'json' | 'files'
}> = Schema.Struct({
  xml: Schema.optional(Schema.Boolean),
  json: Schema.optional(Schema.Boolean),
  file: Schema.optional(Schema.String.pipe(Schema.minLength(1))),
  filesOnly: Schema.optional(Schema.Boolean),
  format: Schema.optional(DiffFormat),
})
export type DiffCommandOptions = Schema.Schema.Type<typeof DiffCommandOptions>
