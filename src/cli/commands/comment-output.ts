import { Effect } from 'effect'
import type { ChangeInfo, ReviewInput } from '@/schemas/gerrit'
import type { CommentOptions } from './comment'

// ─── XML output ──────────────────────────────────────────────────────────────

export const formatXmlOutput = (
  change: ChangeInfo,
  review: ReviewInput,
  options: CommentOptions,
  changeId: string,
): Effect.Effect<void> =>
  Effect.sync(() => {
    const lines: string[] = [
      `<?xml version="1.0" encoding="UTF-8"?>`,
      `<comment_result>`,
      `  <status>success</status>`,
      `  <change_id>${changeId}</change_id>`,
      `  <change_number>${change._number}</change_number>`,
      `  <change_subject><![CDATA[${change.subject}]]></change_subject>`,
      `  <change_status>${change.status}</change_status>`,
    ]

    if (options.batch && review.comments) {
      lines.push(`  <comments>`)
      for (const [file, comments] of Object.entries(review.comments)) {
        for (const comment of comments) {
          lines.push(`    <comment>`)
          lines.push(`      <file>${file}</file>`)
          if (comment.line) lines.push(`      <line>${comment.line}</line>`)
          lines.push(`      <message><![CDATA[${comment.message}]]></message>`)
          if (comment.unresolved) lines.push(`      <unresolved>true</unresolved>`)
          lines.push(`    </comment>`)
        }
      }
      lines.push(`  </comments>`)
    } else if (options.file && options.line) {
      lines.push(`  <comment>`)
      lines.push(`    <file>${options.file}</file>`)
      lines.push(`    <line>${options.line}</line>`)
      if (options.replyTo) lines.push(`    <in_reply_to>${options.replyTo}</in_reply_to>`)
      lines.push(`    <message><![CDATA[${options.message}]]></message>`)
      // Always emit unresolved when replying so callers know thread resolution state
      if (options.replyTo !== undefined) {
        lines.push(`    <unresolved>${(options.unresolved ?? false).toString()}</unresolved>`)
      } else if (options.unresolved) {
        lines.push(`    <unresolved>true</unresolved>`)
      }
      lines.push(`  </comment>`)
    } else {
      lines.push(`  <message><![CDATA[${options.message}]]></message>`)
    }

    lines.push(`</comment_result>`)
    for (const line of lines) {
      console.log(line)
    }
  })

// ─── Human-readable output ───────────────────────────────────────────────────

export const formatHumanOutput = (
  change: ChangeInfo,
  review: ReviewInput,
  options: CommentOptions,
): Effect.Effect<void> =>
  Effect.sync(() => {
    console.log(`✓ Comment posted successfully!`)
    console.log(`Change: ${change.subject} (${change.status})`)

    if (options.batch && review.comments) {
      const totalComments = Object.values(review.comments).reduce(
        (sum, comments) => sum + comments.length,
        0,
      )
      console.log(`Posted ${totalComments} line comment(s)`)
    } else if (options.file && options.line) {
      console.log(`File: ${options.file}, Line: ${options.line}`)
      if (options.replyTo) {
        const resolved = !(options.unresolved ?? false)
        console.log(`Reply to: ${options.replyTo} (thread ${resolved ? 'resolved' : 'unresolved'})`)
      }
      console.log(`Message: ${options.message}`)
      if (options.unresolved) console.log(`Status: Unresolved`)
    }
    // Note: For overall review messages, we don't display the content here
    // since it was already shown in the "OVERALL REVIEW TO POST" section
  })

// ─── JSON output ─────────────────────────────────────────────────────────────

export const formatJsonOutput = (
  change: ChangeInfo,
  review: ReviewInput,
  options: CommentOptions,
  changeId: string,
): Effect.Effect<void> =>
  Effect.sync(() => {
    const output: Record<string, unknown> = {
      status: 'success',
      change_id: changeId,
      change_number: change._number,
      change_subject: change.subject,
      change_status: change.status,
    }

    if (options.batch && review.comments) {
      output.comments = Object.entries(review.comments).flatMap(([file, comments]) =>
        comments.map((comment) => ({
          file,
          ...(comment.line ? { line: comment.line } : {}),
          message: comment.message,
          ...(comment.unresolved ? { unresolved: true } : {}),
        })),
      )
    } else if (options.file && options.line) {
      output.comment = {
        file: options.file,
        line: options.line,
        ...(options.replyTo ? { in_reply_to: options.replyTo } : {}),
        message: options.message,
        // Always include unresolved when replying so callers know thread resolution state
        ...(options.replyTo !== undefined
          ? { unresolved: options.unresolved ?? false }
          : options.unresolved
            ? { unresolved: true }
            : {}),
      }
    } else {
      output.message = options.message
    }

    console.log(JSON.stringify(output, null, 2))
  })

// ─── Main output formatter ───────────────────────────────────────────────────

export const formatOutput = (
  change: ChangeInfo,
  review: ReviewInput,
  options: CommentOptions,
  changeId: string,
): Effect.Effect<void> =>
  options.json
    ? formatJsonOutput(change, review, options, changeId)
    : options.xml
      ? formatXmlOutput(change, review, options, changeId)
      : formatHumanOutput(change, review, options)
