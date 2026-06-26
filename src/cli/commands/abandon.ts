import { Effect } from 'effect'
import { type ApiError, GerritApiService } from '@/api/gerrit'
import { assertWriteAllowed, type WriteGuardError } from '@/utils/write-guard'

interface AbandonOptions {
  message?: string
  xml?: boolean
  json?: boolean
  confirm?: boolean
}

export const abandonCommand = (
  changeId?: string,
  options: AbandonOptions = {},
): Effect.Effect<void, ApiError | WriteGuardError | Error, GerritApiService> =>
  Effect.gen(function* () {
    const id = changeId?.trim()
    if (!id) {
      return yield* Effect.fail(
        new Error('Change ID is required. Usage: gerrit-cli abandon <change-id>'),
      )
    }

    yield* assertWriteAllowed({
      confirm: options.confirm ?? false,
      operation: 'abandon change',
      target: id,
    })

    const gerritApi = yield* GerritApiService

    // First try to fetch the change details to show what we're abandoning.
    // Effect.either keeps this typed — a try/catch around `yield*` is dead code because
    // a failing Effect short-circuits the generator instead of throwing a JS exception.
    const changeAttempt = yield* gerritApi.getChange(id).pipe(Effect.either)

    // Perform the abandon regardless of whether getChange succeeded
    yield* gerritApi.abandonChange(id, options.message)

    if (changeAttempt._tag === 'Right') {
      const change = changeAttempt.right
      if (options.json) {
        console.log(
          JSON.stringify(
            {
              status: 'success',
              change_number: change._number,
              subject: change.subject,
              ...(options.message ? { message: options.message } : {}),
            },
            null,
            2,
          ),
        )
      } else if (options.xml) {
        console.log(`<?xml version="1.0" encoding="UTF-8"?>`)
        console.log(`<abandon_result>`)
        console.log(`  <status>success</status>`)
        console.log(`  <change_number>${change._number}</change_number>`)
        console.log(`  <subject><![CDATA[${change.subject}]]></subject>`)
        if (options.message) {
          console.log(`  <message><![CDATA[${options.message}]]></message>`)
        }
        console.log(`</abandon_result>`)
      } else {
        console.log(`✓ Abandoned change ${change._number}: ${change.subject}`)
        if (options.message) {
          console.log(`  Message: ${options.message}`)
        }
      }
    } else {
      // Could not get change details, but abandon still succeeded with just the ID
      if (options.json) {
        console.log(
          JSON.stringify(
            {
              status: 'success',
              change_id: id,
              ...(options.message ? { message: options.message } : {}),
            },
            null,
            2,
          ),
        )
      } else if (options.xml) {
        console.log(`<?xml version="1.0" encoding="UTF-8"?>`)
        console.log(`<abandon_result>`)
        console.log(`  <status>success</status>`)
        console.log(`  <change_id>${id}</change_id>`)
        if (options.message) {
          console.log(`  <message><![CDATA[${options.message}]]></message>`)
        }
        console.log(`</abandon_result>`)
      } else {
        console.log(`✓ Abandoned change ${id}`)
        if (options.message) {
          console.log(`  Message: ${options.message}`)
        }
      }
    }
  })
