import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'

const ENTRIES = [
  'gerrit-cli',
  'gerrit-dev',
  'gerrit-reviewer',
  'gerrit-lead',
  'gerrit-ci',
] as const

if (!existsSync('dist')) mkdirSync('dist')

const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
const version = pkg.version

for (const name of ENTRIES) {
  const entry = `./bin/${name}-entry.ts`
  const outfile = `dist/${name}`

  const cmd =
    `bun build --compile ${entry} --outfile ${outfile}` +
    ` --define 'process.env.GERRIT_CLI_VERSION:"${version}"'`

  try {
    execSync(cmd, { stdio: 'inherit' })
  } catch {
    console.error(`Failed to build ${entry}`)
    process.exit(1)
  }
}
