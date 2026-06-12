import type { CommentInfo, MessageInfo } from '@/schemas/gerrit'
import { formatCommentsPretty } from '@/utils/comment-formatters'
import { formatDiffPretty } from '@/utils/diff-formatters'
import { formatDate, formatRelativeTime } from '@/utils/formatters'
import { escapeXML, sanitizeCDATA } from '@/utils/shell-safety'

export interface ReviewerIdentity {
  accountId?: number
  name?: string
  email?: string
  username?: string
}

export interface ChangeDetails {
  id: string
  number: number
  subject: string
  status: string
  project: string
  branch: string
  owner: {
    name?: string
    email?: string
  }
  created?: string
  updated?: string
  commitMessage: string
  topic?: string
  reviewers: ReviewerIdentity[]
  ccs: ReviewerIdentity[]
}

export const formatReviewerLabel = (reviewer: ReviewerIdentity): string => {
  const preferredIdentity = reviewer.name || reviewer.email || reviewer.username
  if (!preferredIdentity) {
    if (reviewer.accountId !== undefined) {
      return `Account ${reviewer.accountId}`
    }
    return 'Unknown Reviewer'
  }

  if (reviewer.email && reviewer.name && reviewer.name !== reviewer.email) {
    return `${reviewer.name} <${reviewer.email}>`
  }

  return preferredIdentity
}

// Helper to remove undefined values from objects
export const removeUndefined = <T extends Record<string, any>>(obj: T): Partial<T> => {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, value]) => value !== undefined),
  ) as unknown as Partial<T>
}

export const formatShowPretty = (
  changeDetails: ChangeDetails,
  diff: string,
  commentsWithContext: Array<{ comment: CommentInfo; context?: any }>,
  messages: MessageInfo[],
): void => {
  // Change details header
  console.log('━'.repeat(80))
  console.log(`📋 Change ${changeDetails.number}: ${changeDetails.subject}`)
  console.log('━'.repeat(80))
  console.log()

  // Metadata
  console.log('📝 Details:')
  console.log(`   Project: ${changeDetails.project}`)
  console.log(`   Branch: ${changeDetails.branch}`)
  console.log(`   Status: ${changeDetails.status}`)
  if (changeDetails.topic) {
    console.log(`   Topic: ${changeDetails.topic}`)
  }
  console.log(`   Owner: ${changeDetails.owner.name || changeDetails.owner.email || 'Unknown'}`)
  console.log(
    `   Created: ${changeDetails.created ? formatRelativeTime(changeDetails.created) : 'Unknown'}`,
  )
  console.log(
    `   Updated: ${changeDetails.updated ? formatRelativeTime(changeDetails.updated) : 'Unknown'}`,
  )
  if (changeDetails.reviewers.length > 0) {
    console.log(
      `   Reviewers: ${changeDetails.reviewers.map((reviewer) => formatReviewerLabel(reviewer)).join(', ')}`,
    )
  }
  if (changeDetails.ccs.length > 0) {
    console.log(`   CCs: ${changeDetails.ccs.map((cc) => formatReviewerLabel(cc)).join(', ')}`)
  }
  console.log(`   Change-Id: ${changeDetails.id}`)
  console.log()

  // Diff section
  console.log('🔍 Diff:')
  console.log('─'.repeat(40))
  console.log(formatDiffPretty(diff))
  console.log()

  // Comments and Messages section
  const hasComments = commentsWithContext.length > 0
  const hasMessages = messages.length > 0

  if (hasComments) {
    console.log('💬 Inline Comments:')
    console.log('─'.repeat(40))
    formatCommentsPretty(commentsWithContext)
    console.log()
  }

  if (hasMessages) {
    console.log('📝 Review Activity:')
    console.log('─'.repeat(40))
    for (const message of messages) {
      const author = message.author?.name || 'Unknown'
      const date = formatDate(message.date)
      const cleanMessage = message.message.trim()

      // Skip very short automated messages
      if (
        cleanMessage.length < 10 &&
        (cleanMessage.includes('Build') || cleanMessage.includes('Patch'))
      ) {
        continue
      }

      console.log(`📅 ${date} - ${author}`)
      console.log(`   ${cleanMessage}`)
      console.log()
    }
  }

  if (!hasComments && !hasMessages) {
    console.log('💬 Comments & Activity:')
    console.log('─'.repeat(40))
    console.log('No comments or review activity found.')
  }
}

export const formatShowJson = async (
  changeDetails: ChangeDetails,
  diff: string,
  commentsWithContext: Array<{ comment: CommentInfo; context?: any }>,
  messages: MessageInfo[],
): Promise<void> => {
  const output = {
    status: 'success',
    change: removeUndefined({
      id: changeDetails.id,
      number: changeDetails.number,
      subject: changeDetails.subject,
      status: changeDetails.status,
      project: changeDetails.project,
      branch: changeDetails.branch,
      topic: changeDetails.topic,
      owner: removeUndefined(changeDetails.owner),
      reviewers: changeDetails.reviewers.map((reviewer) =>
        removeUndefined({
          account_id: reviewer.accountId,
          name: reviewer.name,
          email: reviewer.email,
          username: reviewer.username,
        }),
      ),
      ccs: changeDetails.ccs.map((cc) =>
        removeUndefined({
          account_id: cc.accountId,
          name: cc.name,
          email: cc.email,
          username: cc.username,
        }),
      ),
      created: changeDetails.created,
      updated: changeDetails.updated,
    }),
    diff,
    comments: commentsWithContext.map(({ comment, context }) =>
      removeUndefined({
        id: comment.id,
        path: comment.path,
        line: comment.line,
        range: comment.range,
        author: comment.author
          ? removeUndefined({
              name: comment.author.name,
              email: comment.author.email,
              account_id: comment.author._account_id,
            })
          : undefined,
        updated: comment.updated,
        message: comment.message,
        unresolved: comment.unresolved,
        in_reply_to: comment.in_reply_to,
        context,
      }),
    ),
    messages: messages.map((message) =>
      removeUndefined({
        id: message.id,
        author: message.author
          ? removeUndefined({
              name: message.author.name,
              email: message.author.email,
              account_id: message.author._account_id,
            })
          : undefined,
        date: message.date,
        message: message.message,
        revision: message._revision_number,
        tag: message.tag,
      }),
    ),
  }

  const jsonOutput = JSON.stringify(output, null, 2) + '\n'
  // Write to stdout and ensure all data is flushed before process exits
  // Using process.stdout.write with drain handling for large payloads
  return new Promise<void>((resolve, reject) => {
    const written = process.stdout.write(jsonOutput, (err) => {
      if (err) {
        reject(err)
      } else {
        resolve()
      }
    })

    if (!written) {
      // If write returned false, buffer is full, wait for drain
      process.stdout.once('drain', resolve)
      process.stdout.once('error', reject)
    }
  })
}

export const formatShowXml = async (
  changeDetails: ChangeDetails,
  diff: string,
  commentsWithContext: Array<{ comment: CommentInfo; context?: any }>,
  messages: MessageInfo[],
): Promise<void> => {
  // Build complete XML output as a single string to avoid multiple writes
  const xmlParts: string[] = []
  xmlParts.push(`<?xml version="1.0" encoding="UTF-8"?>`)
  xmlParts.push(`<show_result>`)
  xmlParts.push(`  <status>success</status>`)
  xmlParts.push(`  <change>`)
  xmlParts.push(`    <id>${escapeXML(changeDetails.id)}</id>`)
  xmlParts.push(`    <number>${changeDetails.number}</number>`)
  xmlParts.push(`    <subject><![CDATA[${sanitizeCDATA(changeDetails.subject)}]]></subject>`)
  xmlParts.push(`    <status>${escapeXML(changeDetails.status)}</status>`)
  xmlParts.push(`    <project>${escapeXML(changeDetails.project)}</project>`)
  xmlParts.push(`    <branch>${escapeXML(changeDetails.branch)}</branch>`)
  if (changeDetails.topic) {
    xmlParts.push(`    <topic><![CDATA[${sanitizeCDATA(changeDetails.topic)}]]></topic>`)
  }
  xmlParts.push(`    <owner>`)
  if (changeDetails.owner.name) {
    xmlParts.push(`      <name><![CDATA[${sanitizeCDATA(changeDetails.owner.name)}]]></name>`)
  }
  if (changeDetails.owner.email) {
    xmlParts.push(`      <email>${escapeXML(changeDetails.owner.email)}</email>`)
  }
  xmlParts.push(`    </owner>`)
  xmlParts.push(`    <reviewers>`)
  xmlParts.push(`      <count>${changeDetails.reviewers.length}</count>`)
  for (const reviewer of changeDetails.reviewers) {
    xmlParts.push(`      <reviewer>`)
    if (reviewer.accountId !== undefined) {
      xmlParts.push(`        <account_id>${reviewer.accountId}</account_id>`)
    }
    if (reviewer.name) {
      xmlParts.push(`        <name><![CDATA[${sanitizeCDATA(reviewer.name)}]]></name>`)
    }
    if (reviewer.email) {
      xmlParts.push(`        <email>${escapeXML(reviewer.email)}</email>`)
    }
    if (reviewer.username) {
      xmlParts.push(`        <username>${escapeXML(reviewer.username)}</username>`)
    }
    xmlParts.push(`      </reviewer>`)
  }
  xmlParts.push(`    </reviewers>`)
  xmlParts.push(`    <ccs>`)
  xmlParts.push(`      <count>${changeDetails.ccs.length}</count>`)
  for (const cc of changeDetails.ccs) {
    xmlParts.push(`      <cc>`)
    if (cc.accountId !== undefined) {
      xmlParts.push(`        <account_id>${cc.accountId}</account_id>`)
    }
    if (cc.name) {
      xmlParts.push(`        <name><![CDATA[${sanitizeCDATA(cc.name)}]]></name>`)
    }
    if (cc.email) {
      xmlParts.push(`        <email>${escapeXML(cc.email)}</email>`)
    }
    if (cc.username) {
      xmlParts.push(`        <username>${escapeXML(cc.username)}</username>`)
    }
    xmlParts.push(`      </cc>`)
  }
  xmlParts.push(`    </ccs>`)
  xmlParts.push(`    <created>${escapeXML(changeDetails.created || '')}</created>`)
  xmlParts.push(`    <updated>${escapeXML(changeDetails.updated || '')}</updated>`)
  xmlParts.push(`  </change>`)
  xmlParts.push(`  <diff><![CDATA[${sanitizeCDATA(diff)}]]></diff>`)

  // Comments section
  xmlParts.push(`  <comments>`)
  xmlParts.push(`    <count>${commentsWithContext.length}</count>`)
  for (const { comment } of commentsWithContext) {
    xmlParts.push(`    <comment>`)
    if (comment.id) xmlParts.push(`      <id>${escapeXML(comment.id)}</id>`)
    if (comment.path) xmlParts.push(`      <path><![CDATA[${sanitizeCDATA(comment.path)}]]></path>`)
    if (comment.line) xmlParts.push(`      <line>${comment.line}</line>`)
    if (comment.author?.name) {
      xmlParts.push(`      <author><![CDATA[${sanitizeCDATA(comment.author.name)}]]></author>`)
    }
    if (comment.updated) xmlParts.push(`      <updated>${escapeXML(comment.updated)}</updated>`)
    if (comment.message) {
      xmlParts.push(`      <message><![CDATA[${sanitizeCDATA(comment.message)}]]></message>`)
    }
    if (comment.unresolved) xmlParts.push(`      <unresolved>true</unresolved>`)
    xmlParts.push(`    </comment>`)
  }
  xmlParts.push(`  </comments>`)

  // Messages section
  xmlParts.push(`  <messages>`)
  xmlParts.push(`    <count>${messages.length}</count>`)
  for (const message of messages) {
    xmlParts.push(`    <message>`)
    xmlParts.push(`      <id>${escapeXML(message.id)}</id>`)
    if (message.author?.name) {
      xmlParts.push(`      <author><![CDATA[${sanitizeCDATA(message.author.name)}]]></author>`)
    }
    if (message.author?._account_id) {
      xmlParts.push(`      <author_id>${message.author._account_id}</author_id>`)
    }
    xmlParts.push(`      <date>${escapeXML(message.date)}</date>`)
    if (message._revision_number) {
      xmlParts.push(`      <revision>${message._revision_number}</revision>`)
    }
    if (message.tag) {
      xmlParts.push(`      <tag>${escapeXML(message.tag)}</tag>`)
    }
    xmlParts.push(`      <message><![CDATA[${sanitizeCDATA(message.message)}]]></message>`)
    xmlParts.push(`    </message>`)
  }
  xmlParts.push(`  </messages>`)
  xmlParts.push(`</show_result>`)

  const xmlOutput = xmlParts.join('\n') + '\n'
  // Write to stdout with proper drain handling for large payloads
  return new Promise<void>((resolve, reject) => {
    const written = process.stdout.write(xmlOutput, (err) => {
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
  })
}
