import chalk from 'chalk'
import { Effect } from 'effect'
import { type ApiError, GerritApiService, type GerritApiServiceImpl } from '@/api/gerrit'
import { type ConfigError, ConfigService, type ConfigServiceImpl } from '@/services/config'
import { type GitError, getChangeIdFromHead, type NoChangeIdError } from '@/utils/git-commit'
import { input } from '@/utils/prompts'
import { assertWriteAllowed, type WriteGuardError } from '@/utils/write-guard'

export const RETRIGGER_HELP_TEXT = `
Examples:
  # Retrigger CI for the change in HEAD commit (auto-detected)
  $ gerrit-cli retrigger --confirm

  # Retrigger CI for a specific change
  $ gerrit-cli retrigger 12345 --confirm

Notes:
  - The retrigger comment is saved in config (set during "gerrit-cli setup" or prompted on first use)
  - Auto-detection reads the Change-Id footer from HEAD commit
  - Retriggering posts a review comment, which is a write operation requiring --confirm`

export interface RetriggerOptions {
  xml?: boolean
  json?: boolean
  confirm?: boolean
}

export const retriggerCommand = (
  changeId: string | undefined,
  options: RetriggerOptions,
): Effect.Effect<
  void,
  ApiError | ConfigError | GitError | NoChangeIdError | Error | WriteGuardError,
  GerritApiServiceImpl | ConfigServiceImpl
> =>
  Effect.gen(function* () {
    // Resolve change ID — explicit arg or auto-detect from HEAD
    const resolvedChangeId = changeId !== undefined ? changeId : yield* getChangeIdFromHead()

    // 写保护必须放在提示/保存之前：缺 --confirm 时直接返回 preview，
    // 不交互、不保存配置、不发请求。
    yield* assertWriteAllowed({
      confirm: options.confirm ?? false,
      operation: 'retrigger CI',
      target: resolvedChangeId,
    })

    // Get retrigger comment from config
    const configService = yield* ConfigService
    let retriggerComment = yield* configService.getRetriggerComment

    // If not configured, prompt and save
    if (!retriggerComment) {
      if (!options.xml && !options.json) {
        console.log(chalk.yellow('No retrigger comment configured.'))
        console.log(
          chalk.dim('This comment will be posted to trigger CI. It will be saved to config.'),
        )
      }

      const prompted = yield* Effect.tryPromise({
        try: () =>
          input({
            message: 'CI retrigger comment',
          }),
        catch: (e) =>
          new Error(e instanceof Error ? e.message : 'Failed to read retrigger comment'),
      })

      if (!prompted.trim()) {
        return yield* Effect.fail(new Error('Retrigger comment cannot be empty'))
      }

      retriggerComment = prompted.trim()
      yield* configService.saveRetriggerComment(retriggerComment)

      if (!options.xml && !options.json) {
        console.log(chalk.dim('  Retrigger comment saved to config'))
      }
    }

    // Post the comment
    const gerritApi = yield* GerritApiService

    if (!options.xml && !options.json) {
      console.log(chalk.bold(`Retriggering CI for change ${chalk.cyan(resolvedChangeId)}...`))
    }

    yield* gerritApi.postReview(resolvedChangeId, { message: retriggerComment })

    if (options.json) {
      console.log(JSON.stringify({ status: 'success', change_id: resolvedChangeId }, null, 2))
    } else if (options.xml) {
      console.log(`<?xml version="1.0" encoding="UTF-8"?>`)
      console.log(`<retrigger>`)
      console.log(`  <status>success</status>`)
      console.log(`  <change_id><![CDATA[${resolvedChangeId}]]></change_id>`)
      console.log(`</retrigger>`)
    } else {
      console.log(chalk.green('  ✓ CI retrigger comment posted'))
    }
  })
