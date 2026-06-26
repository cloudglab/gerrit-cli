import { Effect, pipe } from 'effect'
import { type ApiError, GerritApiService } from '@/api/gerrit'
import { sanitizeCDATA } from '@/utils/shell-safety'
import { assertWriteAllowed, type WriteGuardError } from '@/utils/write-guard'

interface SetReadyOptions {
  message?: string
  xml?: boolean
  json?: boolean
  confirm?: boolean
}

export const setReadyCommand = (
  changeId?: string,
  options: SetReadyOptions = {},
): Effect.Effect<void, ApiError | WriteGuardError | Error, GerritApiService> =>
  Effect.gen(function* () {
    const id = changeId?.trim()
    if (!id) {
      return yield* Effect.fail(
        new Error('Change ID is required. Usage: gerrit-cli set-ready <change-id>'),
      )
    }

    // 写保护：set-ready 是写操作，必须命中命令并带 --confirm
    yield* assertWriteAllowed({
      confirm: options.confirm ?? false,
      operation: 'mark change ready',
      target: id,
    })

    const gerritApi = yield* GerritApiService

    // Try to fetch change details for richer output; if that fails, proceed without details
    // rather than crashing. Effect.either keeps the failure channel typed (no dead try/catch
    // around yield*, which can never throw a JS exception).
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

    yield* gerritApi.setReady(id, options.message)

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
      console.log(`<set_ready_result>`)
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
      console.log(`</set_ready_result>`)
    } else {
      const label = changeNumber !== undefined ? `${changeNumber}` : id
      const suffix = subject !== undefined ? `: ${subject}` : ''
      console.log(`✓ Marked change ${label} as ready for review${suffix}`)
      if (options.message) {
        console.log(`  Message: ${options.message}`)
      }
    }
  })
