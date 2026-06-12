import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

interface VersionOptions {
  json?: boolean
  xml?: boolean
}

function readPackageVersion(): string {
  try {
    const __filename = fileURLToPath(import.meta.url)
    const __dirname = dirname(__filename)
    const packageJsonPath = join(__dirname, '..', '..', 'package.json')
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
    return packageJson.version || '0.0.0'
  } catch {
    return 'unknown'
  }
}

export function versionCommand(options: VersionOptions): void {
  const version = readPackageVersion()

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          name: 'gerrit-cli',
          version,
          hint: 'Run gerrit-cli update to check for updates',
        },
        null,
        2,
      ),
    )
  } else if (options.xml) {
    console.log(`<?xml version="1.0" encoding="UTF-8"?>`)
    console.log(`<version_info>`)
    console.log(`  <name>gerrit-cli</name>`)
    console.log(`  <version>${version}</version>`)
    console.log(`  <hint>Run gerrit-cli update to check for updates</hint>`)
    console.log(`</version_info>`)
  } else {
    console.log(version)
    console.log(`Run gerrit-cli update to check for updates`)
  }
}
