import { Effect } from 'effect'

/**
 * 写保护错误种类：
 * - `preview`：缺 `--confirm`，返回预览。
 * - `disabled`：环境变量 `GERRIT_DISABLE_WRITE=true` 完全禁用。
 * - `unsupported`：命令本身就不允许写。
 */
export type WriteGuardErrorKind = 'preview' | 'disabled' | 'unsupported'

export interface WriteGuardOptions {
  readonly confirm: boolean
  readonly operation: string
  readonly target: string
  /**
   * 可选的执行计划列表。preview/disabled 时随错误一起返回,
   * 由 `outputWriteGuardPreview` 渲染为"将要执行"的多步清单。
   */
  readonly plan?: ReadonlyArray<string>
}

export interface WriteGuardErrorFields {
  readonly message: string
  readonly kind: WriteGuardErrorKind
  readonly operation: string
  readonly target: string
  readonly plan?: ReadonlyArray<string>
}

/**
 * 写保护错误。`command-helpers.executeEffect` 会识别此错误并输出
 * `{ ok: false, preview: true, reason, action, payload }` 结构,
 * 不走通用 error 通道。
 */
export class WriteGuardError extends Error {
  readonly _tag = 'WriteGuardError'
  readonly kind: WriteGuardErrorKind
  readonly operation: string
  readonly target: string
  readonly plan: ReadonlyArray<string> | undefined

  constructor(fields: WriteGuardErrorFields) {
    super(fields.message)
    this.name = 'WriteGuardError'
    this.kind = fields.kind
    this.operation = fields.operation
    this.target = fields.target
    this.plan = fields.plan
  }
}

const isWriteDisabled = (): boolean => process.env.GERRIT_DISABLE_WRITE === 'true'

export const assertWriteAllowed = (
  options: WriteGuardOptions,
): Effect.Effect<void, WriteGuardError> =>
  Effect.gen(function* () {
    if (isWriteDisabled()) {
      return yield* Effect.fail(
        new WriteGuardError({
          kind: 'disabled',
          operation: options.operation,
          target: options.target,
          ...(options.plan ? { plan: options.plan } : {}),
          message: `写操作已被 GERRIT_DISABLE_WRITE=true 禁用；${options.operation} on ${options.target} 未执行。`,
        }),
      )
    }

    if (!options.confirm) {
      return yield* Effect.fail(
        new WriteGuardError({
          kind: 'preview',
          operation: options.operation,
          target: options.target,
          ...(options.plan ? { plan: options.plan } : {}),
          message: `预览：${options.operation} on ${options.target}。这是写操作,需要追加 --confirm 才会真正执行。`,
        }),
      )
    }
  })
