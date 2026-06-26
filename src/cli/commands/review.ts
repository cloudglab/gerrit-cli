import { Effect } from 'effect'
import { type ApiError, GerritApiService } from '@/api/gerrit'
import type { FileDiffContent, ReviewInput } from '@/schemas/gerrit'
import { assertWriteAllowed, type WriteGuardError } from '@/utils/write-guard'

export interface ReviewOptions {
  /** 整体 review 描述（无问题路径用作整体 comment；--reject 路径用作行级 comment 内容）。 */
  readonly message?: string
  /** （仅 --reject）目标文件路径。 */
  readonly file?: string
  /** （仅 --reject）目标行号。 */
  readonly line?: number
  /** 走"严重问题"路径：不 vote / 不 verified / 不 submit / 行级 comment。 */
  readonly reject?: boolean
  /** 无问题路径：投票 + 评论但跳过 submit。 */
  readonly noSubmit?: boolean
  /** 无问题路径：跳过 Verified +1（即便项目定义了该 label）。 */
  readonly noVerified?: boolean
  /** 真正执行写操作。 */
  readonly confirm?: boolean
  /** XML 结构化输出。 */
  readonly xml?: boolean
  /** JSON 结构化输出。 */
  readonly json?: boolean
}

const truncate = (s: string, max: number): string => (s.length > max ? `${s.slice(0, max)}…` : s)

/**
 * 构造 preview 阶段展示的多步计划。
 *
 * 无需先 fetch change,使用条件式描述:
 * - Verified 一律以"如项目定义该 label"为前缀,真实执行时再做 pre-check。
 * - Submit 仅在未传 --no-submit 时列出。
 * - --reject 路径仅一行,只描述行级 comment。
 */
const buildPlan = (options: ReviewOptions): ReadonlyArray<string> => {
  if (options.reject) {
    const file = options.file ?? '?'
    const line = options.line !== undefined ? String(options.line) : '?'
    const message = options.message ? ` — "${truncate(options.message, 40)}"` : ''
    return [`行级 comment @ ${file}:${line}${message}`]
  }
  const steps: string[] = ['Code-Review +2 (vote)']
  if (!options.noVerified) {
    steps.push('Verified +1（如项目定义该 label）')
  }
  if (options.message) {
    steps.push(`整体 comment — "${truncate(options.message, 40)}"`)
  }
  if (!options.noSubmit) {
    steps.push('Submit change')
  }
  return steps
}

const escapeXml = (str: string): string =>
  str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const outputHuman = (executedSteps: ReadonlyArray<string>): void => {
  console.log('✓ Review 已完成')
  for (const step of executedSteps) {
    console.log(`  - ${step}`)
  }
}

const outputHumanReject = (file: string, line: number, message: string): void => {
  console.log('✓ 行级 comment 已发送')
  console.log(`  目标: ${file}:${line}`)
  console.log(`  说明: ${message}`)
}

const outputJson = (
  changeId: string,
  isReject: boolean,
  executedSteps: ReadonlyArray<string>,
  rejectTarget: { file: string; line: number; message: string } | undefined,
): void => {
  const output: Record<string, unknown> = {
    status: 'success',
    change_id: changeId,
    review_type: isReject ? 'reject' : 'normal',
    steps: executedSteps,
  }
  if (rejectTarget) {
    output.comment = {
      file: rejectTarget.file,
      line: rejectTarget.line,
      message: rejectTarget.message,
    }
  }
  console.log(JSON.stringify(output, null, 2))
}

const outputXml = (
  changeId: string,
  isReject: boolean,
  executedSteps: ReadonlyArray<string>,
  rejectTarget: { file: string; line: number; message: string } | undefined,
  resultTag: string,
): void => {
  console.log(`<?xml version="1.0" encoding="UTF-8"?>`)
  console.log(`<${resultTag}>`)
  console.log(`  <status>success</status>`)
  console.log(`  <change_id>${escapeXml(changeId)}</change_id>`)
  console.log(`  <review_type>${isReject ? 'reject' : 'normal'}</review_type>`)
  console.log(`  <steps>`)
  for (const step of executedSteps) {
    console.log(`    <step><![CDATA[${step}]]></step>`)
  }
  console.log(`  </steps>`)
  if (rejectTarget) {
    console.log(`  <comment>`)
    console.log(`    <file>${escapeXml(rejectTarget.file)}</file>`)
    console.log(`    <line>${rejectTarget.line}</line>`)
    console.log(`    <message><![CDATA[${rejectTarget.message}]]></message>`)
    console.log(`  </comment>`)
  }
  console.log(`</${resultTag}>`)
}

/**
 * 端到端 review 入口。封装"无问题"和"严重问题"两条路径：
 * - 默认（无问题）：vote Code-Review+2、可选 vote Verified+1、可选整体 comment、可选 submit。
 * - --reject（严重问题）：仅在 <file>:<line> 留下行级 comment，不 vote、不 verified、不 submit。
 */
export const reviewCommand = (
  changeId?: string,
  options: ReviewOptions = {},
): Effect.Effect<void, ApiError | WriteGuardError | Error, GerritApiService> =>
  Effect.gen(function* () {
    const gerritApi = yield* GerritApiService

    const id = changeId?.trim()
    if (!id) {
      return yield* Effect.fail(
        new Error(
          'Change ID is required. Usage: gerrit-cli review <change-id> [--reject --file <path> --line <n> -m <msg>]',
        ),
      )
    }

    // --reject 路径前置校验（不依赖网络,先于 assertWriteAllowed 抛出友好错误）。
    if (options.reject) {
      if (!options.message) {
        return yield* Effect.fail(new Error('--reject 模式必须通过 -m/--message 提供行级评论内容'))
      }
      if (!options.file) {
        return yield* Effect.fail(new Error('--reject 模式必须通过 --file 指定目标文件路径'))
      }
      if (options.line === undefined) {
        return yield* Effect.fail(new Error('--reject 模式必须通过 --line 指定目标行号'))
      }
    }

    const plan = buildPlan(options)

    // 顶层写保护：缺 --confirm 直接 fail,被 executeEffect 渲染为 preview。
    // 计划在 preview 阶段以"将要执行"的形式呈现给 Agent/脚本。
    yield* assertWriteAllowed({
      confirm: options.confirm ?? false,
      operation: 'review change',
      target: id,
      plan,
    })

    // ── --reject 路径 ─────────────────────────────────────────────────
    if (options.reject) {
      const rejectFile = options.file as string
      const rejectLine = options.line as number
      const rejectMessage = options.message as string

      // 验证 file:line 在当前 patchset 存在。
      const diffResult = yield* gerritApi
        .getDiff(id, { format: 'json', file: rejectFile })
        .pipe(
          Effect.mapError((error) =>
            error._tag === 'ApiError'
              ? new Error(
                  `无法获取文件 ${rejectFile} 的 diff：${error.message}。请确认文件路径正确并使用 "gerrit-cli diff <change-id> --file <file>" 验证。`,
                )
              : error,
          ),
        )

      const totalLines = (diffResult as FileDiffContent).meta_b?.lines
      if (totalLines !== undefined && rejectLine > totalLines) {
        return yield* Effect.fail(
          new Error(
            `行号 ${rejectLine} 超出文件 ${rejectFile} 的总行数 ${totalLines}。请用 "gerrit-cli diff <change-id> --file <file>" 确认行号。`,
          ),
        )
      }

      const lineComment: ReviewInput = {
        comments: {
          [rejectFile]: [
            {
              line: rejectLine,
              message: rejectMessage,
            },
          ],
        },
      }
      yield* gerritApi
        .postReview(id, lineComment)
        .pipe(
          Effect.mapError((error) =>
            error._tag === 'ApiError'
              ? new Error(
                  `行级 comment 发送失败：${error.message}。目标 ${rejectFile}:${rejectLine}。`,
                )
              : error,
          ),
        )

      const executedSteps = [
        `行级 comment @ ${rejectFile}:${rejectLine} — "${truncate(rejectMessage, 40)}"`,
      ]
      const rejectTarget = { file: rejectFile, line: rejectLine, message: rejectMessage }
      if (options.json) {
        yield* Effect.sync(() => outputJson(id, true, executedSteps, rejectTarget))
      } else if (options.xml) {
        yield* Effect.sync(() => outputXml(id, true, executedSteps, rejectTarget, 'review_result'))
      } else {
        yield* Effect.sync(() => outputHumanReject(rejectFile, rejectLine, rejectMessage))
      }
      return
    }

    // ── 无问题路径 ───────────────────────────────────────────────────
    const change = yield* gerritApi
      .getChange(id)
      .pipe(
        Effect.mapError((error) =>
          error._tag === 'ApiError' ? new Error(`获取 change 失败：${error.message}`) : error,
        ),
      )

    const executedSteps: string[] = []

    // Step 1: Code-Review +2（无问题路径必有 vote）
    yield* gerritApi
      .postReview(id, { labels: { 'Code-Review': 2 } })
      .pipe(
        Effect.mapError((error) =>
          error._tag === 'ApiError'
            ? new Error(`Code-Review +2 投票失败：${error.message}`)
            : error,
        ),
      )
    executedSteps.push('Code-Review: +2')

    // Step 2: Verified +1（pre-check: change.labels?.Verified；缺 --no-verified 时执行）
    const verifiedExists = change.labels !== undefined && 'Verified' in change.labels
    if (verifiedExists && !options.noVerified) {
      yield* gerritApi
        .postReview(id, { labels: { Verified: 1 } })
        .pipe(
          Effect.mapError((error) =>
            error._tag === 'ApiError' ? new Error(`Verified +1 投票失败：${error.message}`) : error,
          ),
        )
      executedSteps.push('Verified: +1')
    }

    // Step 3: 整体 comment（仅当 -m 提供）
    if (options.message) {
      yield* gerritApi
        .postReview(id, { message: options.message })
        .pipe(
          Effect.mapError((error) =>
            error._tag === 'ApiError'
              ? new Error(`整体 comment 发送失败：${error.message}`)
              : error,
          ),
        )
      executedSteps.push(`整体 comment: "${truncate(options.message, 40)}"`)
    }

    // Step 4: Submit（缺 --no-submit 时执行）
    if (!options.noSubmit) {
      const submitResult = yield* gerritApi
        .submitChange(id)
        .pipe(
          Effect.mapError((error) =>
            error._tag === 'ApiError' ? new Error(`Submit 失败：${error.message}`) : error,
          ),
        )
      executedSteps.push(`Submit: ${submitResult.status}`)
    }

    if (options.json) {
      yield* Effect.sync(() => outputJson(id, false, executedSteps, undefined))
    } else if (options.xml) {
      yield* Effect.sync(() => outputXml(id, false, executedSteps, undefined, 'review_result'))
    } else {
      yield* Effect.sync(() => outputHuman(executedSteps))
    }
  })
