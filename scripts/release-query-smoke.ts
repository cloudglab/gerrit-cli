#!/usr/bin/env bun
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const rootDir = resolve(import.meta.dir, '..')
const cliPath = resolve(rootDir, 'bin/gerrit-cli')
const dryRun = process.argv.includes('--dry-run')
const continueOnError = process.argv.includes('--continue-on-error')
const live = process.env.GERRIT_SMOKE_LIVE === 'true'

const env = (name: string, fallback = '') => process.env[name] || fallback
const smoke = (name: string, fallback = '') => env(`GERRIT_SMOKE_${name}`, fallback)

const vars = {
  changeId: smoke('CHANGE_ID', '12345'),
  query: smoke('QUERY', 'status:open'),
  buildKeyword: smoke('BUILD_KEYWORD', 'jenkins'),
}

type SmokeCommand = {
  label: string
  args: string[]
  skip?: boolean
  missing?: Array<keyof typeof vars>
}

const commandSurface = [
  'setup',
  'status',
  'config',
  'version',
  'completion',
  'show',
  'diff',
  'comments',
  'search',
  'list',
  'mine',
  'incoming',
  'comment',
  'vote',
  'review',
  'add-reviewer',
  'remove-reviewer',
  'checkout',
  'push',
  'rebase',
  'submit',
  'workspace',
  'tree',
  'build-status',
  'failures',
  'analyze',
  'extract-url',
  'groups',
  'groups-show',
  'groups-members',
  'clean',
  'open',
  'cherry',
]

const schemaChecks: SmokeCommand[] = commandSurface.map((name) => cmdAs(`help:${name}`, name, '--help'))
const liveQueries = [
  cmd('version'),
  cmd('status', '--json'),
  cmdIf('show', ['changeId'], 'show', vars.changeId, '--json'),
  cmdIf('comments', ['changeId'], 'comments', vars.changeId, '--json'),
  cmdIf('build-status', ['changeId'], 'build-status', vars.changeId, '--json'),
  cmdIf('search', ['query'], 'search', vars.query, '--json'),
  cmdIf('extract-url', ['buildKeyword'], 'extract-url', vars.buildKeyword),
]
const commands = live ? [...schemaChecks, ...liveQueries] : schemaChecks

if (!existsSync(cliPath)) {
  console.error('缺少 bin/gerrit-cli，请确认 package files/bin 入口存在。')
  process.exit(1)
}

let passed = 0
let skipped = 0
let failed = 0

for (const item of commands) {
  if (item.skip) {
    const missing = item.missing ?? []
    skipped += 1
    console.log(`SKIP ${item.label}: 缺少 ${missing.map((name) => `GERRIT_SMOKE_${toEnvName(name)}`).join(', ')}`)
    continue
  }

  const printable = ['gerrit-cli', ...item.args].join(' ')
  if (dryRun) {
    passed += 1
    console.log(`DRY  ${printable}`)
    continue
  }

  console.log(`RUN  ${printable}`)
  const result = spawnSync('bun', [cliPath, ...item.args], {
    cwd: rootDir,
    env: process.env,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  })

  if (result.status === 0) {
    passed += 1
    console.log(`OK   ${item.label}`)
    continue
  }

  failed += 1
  console.error(`FAIL ${item.label}`)
  if (result.stdout) console.error(result.stdout.trim())
  if (result.stderr) console.error(result.stderr.trim())
  if (!continueOnError) break
}

console.log(`\nSummary: passed=${passed}, skipped=${skipped}, failed=${failed}, live=${live}`)
process.exit(failed > 0 ? 1 : 0)

function cmd(label: string, ...args: string[]): SmokeCommand {
  return { label, args: args.length > 0 ? [label, ...args] : [label] }
}

function cmdAs(label: string, ...args: string[]): SmokeCommand {
  return { label, args }
}

function cmdIf(label: string, required: Array<keyof typeof vars>, ...args: string[]): SmokeCommand {
  const missing = required.filter((name) => !vars[name])
  return {
    label,
    args,
    skip: missing.length > 0,
    missing,
  }
}

function toEnvName(name: string) {
  return name.replace(/[A-Z]/g, (char) => `_${char}`).toUpperCase()
}
