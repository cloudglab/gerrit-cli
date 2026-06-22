import { Effect } from 'effect'
import { toStructuredError } from '@/core/error-codes'

/**
 * Output error in plain text, JSON, or XML format.
 *
 * JSON/XML output now includes structured fields (code, statusCode, recoverable, hint)
 * so scripts and AI agents can switch on machine-readable error type.
 */
export function outputError(
  error: unknown,
  options: { xml?: boolean; json?: boolean },
  resultTag: string,
): void {
  const structured = toStructuredError(error)
  if (options.json) {
    console.log(
      JSON.stringify(
        {
          status: 'error',
          error: structured.message,
          code: structured.code,
          recoverable: structured.recoverable,
          ...(structured.statusCode !== undefined ? { statusCode: structured.statusCode } : {}),
          ...(structured.hint ? { hint: structured.hint } : {}),
        },
        null,
        2,
      ),
    )
  } else if (options.xml) {
    console.log(`<?xml version="1.0" encoding="UTF-8"?>`)
    console.log(`<${resultTag}>`)
    console.log(`  <status>error</status>`)
    console.log(`  <code>${structured.code}</code>`)
    console.log(`  <recoverable>${structured.recoverable}</recoverable>`)
    if (structured.statusCode !== undefined) {
      console.log(`  <status_code>${structured.statusCode}</status_code>`)
    }
    if (structured.hint) {
      console.log(`  <hint><![CDATA[${structured.hint}]]></hint>`)
    }
    console.log(`  <error><![CDATA[${structured.message}]]></error>`)
    console.log(`</${resultTag}>`)
  } else {
    const codeTag = `[${structured.code}]`
    console.error(`✗ ${codeTag} ${structured.message}`)
    if (structured.hint) {
      console.error(`  Hint: ${structured.hint}`)
    }
    if (structured.statusCode !== undefined) {
      console.error(`  HTTP: ${structured.statusCode}`)
    }
  }
}

/**
 * Execute an Effect with standard error handling.
 */
export async function executeEffect<E>(
  effect: Effect.Effect<void, E, never>,
  options: { xml?: boolean; json?: boolean },
  resultTag: string,
): Promise<void> {
  if (options.xml && options.json) {
    outputError(new Error('--xml and --json are mutually exclusive'), options, resultTag)
    process.exit(1)
  }
  try {
    await Effect.runPromise(effect)
  } catch (error) {
    outputError(error, options, resultTag)
    process.exit(1)
  }
}
