import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

function readVersionFromPackageJson(): string {
  try {
    const __filename = fileURLToPath(import.meta.url)
    const __dirname = dirname(__filename)
    const packageJsonPath = join(__dirname, '..', 'package.json')
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as unknown
    if (typeof packageJson === 'object' && packageJson !== null) {
      const version = Reflect.get(packageJson, 'version')
      if (typeof version === 'string') return version
    }
  } catch {
    // ignore
  }

  return '0.0.0'
}

export function getCliVersion(): string {
  return process.env.GERRIT_CLI_VERSION ?? readVersionFromPackageJson()
}
