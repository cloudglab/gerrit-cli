import { Effect } from 'effect'

export interface WriteGuardOptions {
  readonly confirm: boolean
  readonly operation: string
  readonly target: string
}

export class WriteGuardError extends Error {
  readonly _tag = 'WriteGuardError'
}

export const assertWriteAllowed = (
  options: WriteGuardOptions,
): Effect.Effect<void, WriteGuardError> =>
  Effect.gen(function* () {
    if (process.env.GERRIT_DISABLE_WRITE) {
      return yield* Effect.fail(
        new WriteGuardError(
          `Write disabled by GERRIT_DISABLE_WRITE. ${options.operation} on ${options.target} was not executed.`,
        ),
      )
    }

    if (!options.confirm) {
      return yield* Effect.fail(
        new WriteGuardError(
          `Preview: ${options.operation} on ${options.target}. This is a write operation; add --confirm to execute.`,
        ),
      )
    }
  })
