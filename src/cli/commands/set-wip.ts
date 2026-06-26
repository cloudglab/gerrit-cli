import { Effect, pipe } from 'effect'
import { type ApiError, GerritApiService } from '@/api/gerrit'
import { sanitizeCDATA } from '@/utils/shell-safety'
import { assertWriteAllowed, type WriteGuardError } from '@/utils/write-guard'

interface SetWipOptions {
  message?: string
  xml?: boolean
  json?: boolean
  confirm?: boolean
}

export const setWipCommand = (
  changeId?: string,
  options: SetWipOptions = {},
): Effect.Effect<void, ApiError | WriteGuardError | Error, GerritApiService> =>
  Effect.gen(function* () {
    const id = changeId?.trim()
    if (!id) {
      return yield* Effect.fail(
        new Error('Change ID is required. Usage: gerrit-cli set-wip <change-id>'),
      )
    }

    // 写保护：set-wip 是写操作，必须命中命令并带 --confirm
    yield* assertWriteAllowed({
      confirm: options.confirm ?? false,
      operation: 'mark change wip',
      target: id,
    })

    const gerritApi = yield* GerritApiService

    // Try to fetch change details for richer output; Effect.either keeps the failure
    // channel typed (no dead try/catch around yield*).
    let changeNumber: number | undefined
    let subject: string | undefined
    const changeAttempt = yield* pipe(
      gerritApi.getChange(id),
      Effect.map((change) => ({ changeNumber: change._number, subject: change.subject }) as const),
      Effect.either,
    )
    if (changeAttempt._tag === 'Right') {
      changeNumber = changeAttempt.right.changeNumber
      subject = changeAttempt.right.subject
    }

    yield* gerritApi.setWip(id, options.message)

    if (options.json) {
      console.log(
        JSON.stringify(
          {
            status: 'success',
            ...(changeNumber !== undefined ? { change_number: changeNumber } : { change_id: id }),
            ...(subject !== undefined ? { subject } : {}),
            ...(options.message ? { message: options.message } : {}),
          },
          null,
          2,
        ),
      )
    } else if (options.xml) {
      console.log(`<?xml version="1.0" encoding="UTF-8"?>`)
      console.log(`<set_wip_result>`)
      console.log(`  <status>success</status>`)
      if (changeNumber !== undefined) {
        console.log(`  <change_number>${changeNumber}</change_number>`)
      } else {
        console.log(`  <change_id>${id}</change_id>`)
      }
      if (subject !== undefined) {
        console.log(`  <subject><![CDATA[${sanitizeCDATA(subject)}]]></subject>`)
      }
      if (options.message) {
        console.log(`  <message><![CDATA[${sanitizeCDATA(options.message)}]]></message>`)
      }
      console.log(`</set_wip_result>`)
    } else {
      const label = changeNumber !== undefined ? `${changeNumber}` : id
      const suffix = subject !== undefined ? `: ${subject}` : ''
      console.log(`✓ Marked change ${label} as work-in-progress${suffix}`)
      if (options.message) {
        console.log(`  Message: ${options.message}`)
      }
    }
  })
