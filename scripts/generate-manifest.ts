#!/usr/bin/env bun
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { COMMAND_META } from '../src/cli/command-meta'
import { CLI_ROLES, type CliRole } from '../src/cli/roles'

const rootDir = resolve(import.meta.dir, '..')
const distDir = resolve(rootDir, 'dist')
const manifestPath = resolve(distDir, 'manifest.json')
const packageJsonPath = resolve(rootDir, 'package.json')

interface PackageJson {
  readonly version: string
}

interface ManifestCommand {
  readonly name: string
  readonly group: string
  readonly isWrite: boolean
  readonly roles: readonly CliRole[]
}

interface Manifest {
  readonly schemaVersion: number
  readonly version: string
  readonly generatedAt: string
  readonly commands: readonly ManifestCommand[]
  readonly groups: Record<string, readonly string[]>
  readonly commandToGroup: Record<string, string>
  readonly roles: Record<CliRole, readonly string[]>
}

const packageJson: PackageJson = parsePackageJson(readFileSync(packageJsonPath, 'utf8'))
const groups: Record<string, string[]> = {}
const commandToGroup: Record<string, string> = {}
const roles: Record<CliRole, string[]> = createEmptyRoleMap()

for (const command of COMMAND_META) {
  groups[command.group] = groups[command.group] ?? []
  groups[command.group].push(command.name)
  commandToGroup[command.name] = command.group

  for (const role of command.roles) {
    if (!roles[role].includes(command.group)) roles[role].push(command.group)
  }
}

const manifest: Manifest = {
  schemaVersion: 1,
  version: packageJson.version,
  generatedAt: new Date().toISOString(),
  commands: COMMAND_META,
  groups,
  commandToGroup,
  roles,
}

mkdirSync(distDir, { recursive: true })
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`Generated ${manifestPath}`)

function parsePackageJson(content: string): PackageJson {
  const parsed: unknown = JSON.parse(content)
  if (!parsed || typeof parsed !== 'object') return { version: '0.0.0' }
  const version = Reflect.get(parsed, 'version')
  return { version: typeof version === 'string' ? version : '0.0.0' }
}

function createEmptyRoleMap(): Record<CliRole, string[]> {
  return CLI_ROLES.reduce<Record<CliRole, string[]>>((accumulator, role) => {
    accumulator[role] = []
    return accumulator
  }, { full: [], dev: [], reviewer: [], lead: [], ci: [] })
}
