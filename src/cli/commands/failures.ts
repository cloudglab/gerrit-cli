import { Console, Effect } from 'effect'
import { type ApiError, GerritApiService, type GerritApiServiceImpl } from '@/api/gerrit'
import { attachRecommendations } from '@/cli/recommendations'
import type { MessageInfo } from '@/schemas/gerrit'
import { type ConfigError, ConfigService, type ConfigServiceImpl } from '@/services/config'

export interface FailuresOptions {
  json?: boolean
  xml?: boolean
}

export type FailuresErrors = ConfigError | ApiError

const JENKINS_LINK_RE =
  /https:\/\/jenkins\.inst-ci\.net\/job\/Canvas\/job\/[^/]+\/\d+\/\/build-summary-report\//

const isServiceCloudJenkins = (msg: MessageInfo): boolean => {
  const author = msg.author
  if (!author) return false
  const name = (author.name ?? author.username ?? author.email ?? '').toLowerCase()
  return name.includes('service cloud jenkins')
}

const findMostRecentFailureLink = (messages: readonly MessageInfo[]): string | null => {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    if (!isServiceCloudJenkins(msg)) continue
    if (!msg.message.includes('Verified-1')) continue
    const match = JENKINS_LINK_RE.exec(msg.message)
    if (match) return match[0]
  }
  return null
}

export const failuresCommand = (
  changeId: string,
  options: FailuresOptions,
): Effect.Effect<void, FailuresErrors, ConfigServiceImpl | GerritApiServiceImpl> =>
  Effect.gen(function* () {
    const _config = yield* ConfigService
    const api = yield* GerritApiService

    const messages = yield* api.getMessages(changeId)
    const link = findMostRecentFailureLink(messages)

    if (!link) {
      if (options.json) {
        yield* Console.log(
          JSON.stringify(
            attachRecommendations(
              { status: 'not_found', change_id: changeId },
              {
                command: 'failures',
                input: { changeId },
                payload: { status: 'not_found', change_id: changeId },
              },
            ),
            null,
            2,
          ),
        )
      } else if (options.xml) {
        yield* Console.log(`<?xml version="1.0" encoding="UTF-8"?>`)
        yield* Console.log(`<failures>`)
        yield* Console.log(`  <status>not_found</status>`)
        yield* Console.log(`  <change_id>${changeId}</change_id>`)
        yield* Console.log(`</failures>`)
      } else {
        yield* Console.log('No build failure links found from Service Cloud Jenkins')
      }
      return
    }

    if (options.json) {
      const payload = { status: 'found', change_id: changeId, url: link }
      yield* Console.log(
        JSON.stringify(
          attachRecommendations(payload, {
            command: 'failures',
            input: { changeId },
            payload,
          }),
          null,
          2,
        ),
      )
    } else if (options.xml) {
      yield* Console.log(`<?xml version="1.0" encoding="UTF-8"?>`)
      yield* Console.log(`<failures>`)
      yield* Console.log(`  <status>found</status>`)
      yield* Console.log(`  <change_id>${changeId}</change_id>`)
      yield* Console.log(`  <url>${link}</url>`)
      yield* Console.log(`</failures>`)
    } else {
      yield* Console.log(link)
    }
  })
