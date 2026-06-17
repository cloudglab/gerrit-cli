#!/usr/bin/env node
// Gerrit CLI entry (tsx dev entry point) — delegates to cli-bootstrap

import { runCli } from '../cli-bootstrap'

runCli(process.argv.slice(2)).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`${message}\n`)
  process.exit(1)
})
