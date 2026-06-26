import { Cause, Effect, Exit } from 'effect'
import { toStructuredError } from '@/core/error-codes'
import { WriteGuardError } from '@/utils/write-guard'

/**
 * Output error in plain text, JSON, or XML format.
 *
 * JSON/XML output now includes structured fields (code, statusCode, recoverable, hint)
 * so scripts and AI agents can switch on machine-readable error type.
 */
export function outputError(
  error: unknown,
  options: { xml?: boolean; json?: boolean },
  resultTag: string,
): void {
  const structured = toStructuredError(error)
  if (options.json) {
    console.log(
      JSON.stringify(
        {
          status: 'error',
          error: structured.message,
          code: structured.code,
          recoverable: structured.recoverable,
          ...(structured.statusCode !== undefined ? { statusCode: structured.statusCode } : {}),
          ...(structured.hint ? { hint: structured.hint } : {}),
        },
        null,
        2,
      ),
    )
  } else if (options.xml) {
    console.log(`<?xml version="1.0" encoding="UTF-8"?>`)
    console.log(`<${resultTag}>`)
    console.log(`  <status>error</status>`)
    console.log(`  <code>${structured.code}</code>`)
    console.log(`  <recoverable>${structured.recoverable}</recoverable>`)
    if (structured.statusCode !== undefined) {
      console.log(`  <status_code>${structured.statusCode}</status_code>`)
    }
    if (structured.hint) {
      console.log(`  <hint><![CDATA[${structured.hint}]]></hint>`)
    }
    console.log(`  <error><![CDATA[${structured.message}]]></error>`)
    console.log(`</${resultTag}>`)
  } else {
    const codeTag = `[${structured.code}]`
    console.error(`✗ ${codeTag} ${structured.message}`)
    if (structured.hint) {
      console.error(`  Hint: ${structured.hint}`)
    }
    if (structured.statusCode !== undefined) {
      console.error(`  HTTP: ${structured.statusCode}`)
    }
  }
}

interface PreviewPayload {
  readonly ok: false
  readonly preview: true
  readonly kind: 'preview' | 'disabled' | 'unsupported'
  readonly reason: string
  readonly action: string
  readonly target: string
  readonly hint: string
}

/**
 * Render a write-guard preview/disabled response, mirroring zentao-cli's
 * design.md §7.2 return shape: `{ ok: false, preview: true, reason, action, payload }`.
 * Plain / JSON / XML outputs are kept consistent with the rest of the CLI.
 */
export function outputWriteGuardPreview(
  error: WriteGuardError,
  options: { xml?: boolean; json?: boolean },
  resultTag: string,
): void {
  const hint =
    error.kind === 'disabled'
      ? '请取消 GERRIT_DISABLE_WRITE 或使用只读命令'
      : '追加 --confirm 后重新执行以真正写入'

  const payload: PreviewPayload = {
    ok: false,
    preview: true,
    kind: error.kind,
    reason: error.message,
    action: error.operation,
    target: error.target,
    hint,
  }

  if (options.json) {
    console.log(JSON.stringify(payload, null, 2))
    return
  }

  if (options.xml) {
    console.log(`<?xml version="1.0" encoding="UTF-8"?>`)
    console.log(`<${resultTag}>`)
    console.log(`  <status>preview</status>`)
    console.log(`  <kind>${payload.kind}</kind>`)
    console.log(`  <action>${payload.action}</action>`)
    console.log(`  <target><![CDATA[${payload.target}]]></target>`)
    console.log(`  <reason><![CDATA[${payload.reason}]]></reason>`)
    console.log(`  <hint><![CDATA[${payload.hint}]]></hint>`)
    console.log(`</${resultTag}>`)
    return
  }

  const banner = error.kind === 'disabled' ? '✗ 写操作已禁用' : '⚠ 写操作预览（未执行）'
  console.log(`${banner}`)
  console.log(`  操作: ${payload.action}`)
  console.log(`  目标: ${payload.target}`)
  console.log(`  说明: ${payload.reason}`)
  console.log(`  提示: ${payload.hint}`)
}

/**
 * Execute an Effect with standard error handling.
 *
 * Uses `Effect.runPromiseExit` instead of `Effect.runPromise` because the latter
 * rejects with a `FiberFailure` wrapper — an `instanceof WriteGuardError` check on
 * the rejection would never match. Inspecting the `Cause` lets us route write-guard
 * previews to `outputWriteGuardPreview` (exit 0) and everything else to
 * `outputError` (exit 1).
 */
export async function executeEffect<E>(
  effect: Effect.Effect<void, E, never>,
  options: { xml?: boolean; json?: boolean },
  resultTag: string,
): Promise<void> {
  if (options.xml && options.json) {
    outputError(new Error('--xml and --json are mutually exclusive'), options, resultTag)
    process.exit(1)
  }
  const exit = await Effect.runPromiseExit(effect)
  if (Exit.isSuccess(exit)) return

  // `Effect.runPromise` rejects with a `FiberFailure` wrapper, so an `instanceof`
  // check on the rejection never matches. `Cause.failureOption` unwraps the typed
  // failure (from `Effect.fail`) so we can route write-guard previews correctly.
  const failureOpt = Cause.failureOption(exit.cause)
  const failure = failureOpt._tag === 'Some' ? failureOpt.value : exit.cause

  if (failure instanceof WriteGuardError) {
    outputWriteGuardPreview(failure, options, resultTag)
    return
  }

  outputError(failure, options, resultTag)
  process.exit(1)
}
