import { runCli } from '../src/cli-bootstrap'

await runCli(process.argv.slice(2), { role: 'reviewer' }).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`${message}\n`)
  process.exit(1)
})
