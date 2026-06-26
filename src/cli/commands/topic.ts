import { Effect } from 'effect'
import { type ApiError, GerritApiService } from '@/api/gerrit'
import { GitError, getChangeIdFromHead, NoChangeIdError } from '@/utils/git-commit'
import { sanitizeCDATA } from '@/utils/shell-safety'
import { assertWriteAllowed, type WriteGuardError } from '@/utils/write-guard'

export const TOPIC_HELP_TEXT = `
Examples:
  # View current topic (auto-detect from HEAD)
  $ gerrit-cli topic

  # View topic for specific change
  $ gerrit-cli topic 12345

  # Set topic on a change (write operation, requires --confirm)
  $ gerrit-cli topic 12345 my-feature --confirm

  # Remove topic from a change (write operation, requires --confirm)
  $ gerrit-cli topic 12345 --delete --confirm
  $ gerrit-cli topic --delete --confirm  # auto-detect from HEAD

Note: When no change-id is provided, it will be auto-detected from the HEAD commit.
Reading the topic is a read-only operation; setting or deleting the topic is a
write operation and requires --confirm to execute.`

interface TopicOptions {
  xml?: boolean
  json?: boolean
  delete?: boolean
  confirm?: boolean
}

/**
 * Manages topic for a Gerrit change.
 *
 * - No topic argument: get current topic (read-only)
 * - With topic argument: set topic (write, requires --confirm)
 * - With --delete flag: remove topic (write, requires --confirm)
 *
 * @param changeId - Change number or Change-ID (auto-detects from HEAD if not provided)
 * @param topic - Optional topic to set
 * @param options - Configuration options
 * @returns Effect that completes when the operation finishes
 */
export const topicCommand = (
  changeId: string | undefined,
  topic: string | undefined,
  options: TopicOptions = {},
): Effect.Effect<void, ApiError | GitError | NoChangeIdError | WriteGuardError, GerritApiService> =>
  Effect.gen(function* () {
    const gerritApi = yield* GerritApiService

    // Auto-detect Change-ID from HEAD commit if not provided
    const resolvedChangeId = changeId?.trim() || (yield* getChangeIdFromHead())

    // Handle delete operation
    if (options.delete) {
      yield* assertWriteAllowed({
        confirm: options.confirm ?? false,
        operation: 'delete topic',
        target: resolvedChangeId,
      })

      yield* gerritApi.deleteTopic(resolvedChangeId)

      if (options.json) {
        console.log(
          JSON.stringify(
            { status: 'success', action: 'deleted', change_id: resolvedChangeId },
            null,
            2,
          ),
        )
      } else if (options.xml) {
        console.log(`<?xml version="1.0" encoding="UTF-8"?>`)
        console.log(`<topic_result>`)
        console.log(`  <status>success</status>`)
        console.log(`  <action>deleted</action>`)
        console.log(`  <change_id><![CDATA[${sanitizeCDATA(resolvedChangeId)}]]></change_id>`)
        console.log(`</topic_result>`)
      } else {
        console.log(`✓ Removed topic from change ${resolvedChangeId}`)
      }
      return
    }

    // Handle set operation
    if (topic !== undefined && topic.trim() !== '') {
      yield* assertWriteAllowed({
        confirm: options.confirm ?? false,
        operation: 'set topic',
        target: resolvedChangeId,
      })

      const newTopic = yield* gerritApi.setTopic(resolvedChangeId, topic)

      if (options.json) {
        console.log(
          JSON.stringify(
            { status: 'success', action: 'set', change_id: resolvedChangeId, topic: newTopic },
            null,
            2,
          ),
        )
      } else if (options.xml) {
        console.log(`<?xml version="1.0" encoding="UTF-8"?>`)
        console.log(`<topic_result>`)
        console.log(`  <status>success</status>`)
        console.log(`  <action>set</action>`)
        console.log(`  <change_id><![CDATA[${sanitizeCDATA(resolvedChangeId)}]]></change_id>`)
        console.log(`  <topic><![CDATA[${sanitizeCDATA(newTopic)}]]></topic>`)
        console.log(`</topic_result>`)
      } else {
        console.log(`✓ Set topic on change ${resolvedChangeId}: ${newTopic}`)
      }
      return
    }

    // Handle get operation (default, read-only)
    const currentTopic = yield* gerritApi.getTopic(resolvedChangeId)

    if (options.json) {
      console.log(
        JSON.stringify(
          {
            status: 'success',
            action: 'get',
            change_id: resolvedChangeId,
            topic: currentTopic || null,
          },
          null,
          2,
        ),
      )
    } else if (options.xml) {
      console.log(`<?xml version="1.0" encoding="UTF-8"?>`)
      console.log(`<topic_result>`)
      console.log(`  <status>success</status>`)
      console.log(`  <action>get</action>`)
      console.log(`  <change_id><![CDATA[${sanitizeCDATA(resolvedChangeId)}]]></change_id>`)
      if (currentTopic) {
        console.log(`  <topic><![CDATA[${sanitizeCDATA(currentTopic)}]]></topic>`)
      } else {
        console.log(`  <topic />`)
      }
      console.log(`</topic_result>`)
    } else {
      if (currentTopic) {
        console.log(currentTopic)
      } else {
        console.log(`No topic set for change ${resolvedChangeId}`)
      }
    }
  })
