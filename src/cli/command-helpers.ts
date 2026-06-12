import { Effect } from 'effect'

/**
 * Output error in plain text, JSON, or XML format.
 */
export function outputError(
  error: unknown,
  options: { xml?: boolean; json?: boolean },
  resultTag: string,
): void {
  const errorMessage = error instanceof Error ? error.message : String(error)
  if (options.json) {
    console.log(JSON.stringify({ status: 'error', error: errorMessage }, null, 2))
  } else if (options.xml) {
    console.log(`<?xml version="1.0" encoding="UTF-8"?>`)
    console.log(`<${resultTag}>`)
    console.log(`  <status>error</status>`)
    console.log(`  <error><![CDATA[${errorMessage}]]></error>`)
    console.log(`</${resultTag}>`)
  } else {
    console.error('✗ Error:', errorMessage)
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
