#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

interface BuildEntry {
  readonly input: string
  readonly outputDir: string
  readonly outputFile: string
  readonly dts?: boolean
}

const rootDir = resolve(import.meta.dirname, '..')
const distDir = join(rootDir, 'dist')
const packageJson = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf8')) as unknown
const version =
  typeof packageJson === 'object' && packageJson !== null && typeof Reflect.get(packageJson, 'version') === 'string'
    ? String(Reflect.get(packageJson, 'version'))
    : '0.0.0'

const entries: readonly BuildEntry[] = [
  { input: 'index.ts', outputDir: distDir, outputFile: 'index.js', dts: true },
  { input: 'bin/gerrit-cli-entry.ts', outputDir: join(distDir, 'bin'), outputFile: 'gerrit-cli.js' },
  { input: 'bin/gerrit-dev-entry.ts', outputDir: join(distDir, 'bin'), outputFile: 'gerrit-dev.js' },
  { input: 'bin/gerrit-reviewer-entry.ts', outputDir: join(distDir, 'bin'), outputFile: 'gerrit-reviewer.js' },
  { input: 'bin/gerrit-lead-entry.ts', outputDir: join(distDir, 'bin'), outputFile: 'gerrit-lead.js' },
  { input: 'bin/gerrit-ci-entry.ts', outputDir: join(distDir, 'bin'), outputFile: 'gerrit-ci.js' },
]

rmSync(distDir, { recursive: true, force: true })
mkdirSync(distDir, { recursive: true })

execFileSync('pnpm', ['exec', 'tsx', 'scripts/generate-manifest.ts'], {
  cwd: rootDir,
  stdio: 'inherit',
  env: { ...process.env, GERRIT_CLI_VERSION: version },
})

for (const entry of entries) {
  if (!existsSync(entry.outputDir)) mkdirSync(entry.outputDir, { recursive: true })

  const args = [
    'exec',
    'tsup',
    join(rootDir, entry.input),
    '--format',
    'esm',
    '--platform',
    'node',
    '--target',
    'node18',
    '--out-dir',
    entry.outputDir,
    '--silent',
  ]

  if (entry.dts) {
    args.push('--dts')
  } else {
    args.push('--no-dts')
  }

  execFileSync('pnpm', args, {
    cwd: rootDir,
    stdio: 'inherit',
    env: { ...process.env, GERRIT_CLI_VERSION: version },
  })

  const builtFile = join(entry.outputDir, `${baseName(entry.input)}.js`)
  const targetFile = join(entry.outputDir, entry.outputFile)
  if (builtFile !== targetFile && existsSync(builtFile)) {
    renameSync(builtFile, targetFile)
  }

  if (!entry.dts && existsSync(targetFile)) {
    const content = readFileSync(targetFile, 'utf8')
    if (!content.startsWith('#!/usr/bin/env node')) {
      writeFileSync(targetFile, `#!/usr/bin/env node\n${content}`)
    }
  }
}

for (const file of [
  'gerrit-cli.js',
  'gerrit-dev.js',
  'gerrit-reviewer.js',
  'gerrit-lead.js',
  'gerrit-ci.js',
]) {
  chmodSync(join(distDir, 'bin', file), 0o755)
}

function baseName(filePath: string): string {
  return filePath.split('/').at(-1)?.replace(/\.ts$/, '') ?? filePath
}
