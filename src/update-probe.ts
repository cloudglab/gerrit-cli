import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000 // 24 hours
const LAST_CHECK_FILE = join(homedir(), '.gerrit-cli', '.last-update-check')
const PACKAGE_NAME = '@cloudglab/gerrit-cli'

function getLocalVersion(): string {
  try {
    // Resolve package.json relative to this file at runtime
    const pkgPath = join(import.meta.dirname!, '..', 'package.json')
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
    return pkg.version || '0.0.0'
  } catch {
    return '0.0.0'
  }
}

function shouldCheck(): boolean {
  if (process.env.GERRIT_SKIP_UPDATE_CHECK === 'true') return false

  try {
    if (existsSync(LAST_CHECK_FILE)) {
      const lastCheck = parseInt(readFileSync(LAST_CHECK_FILE, 'utf8'), 10)
      if (!Number.isNaN(lastCheck)) {
        return Date.now() - lastCheck > CHECK_INTERVAL_MS
      }
    }
  } catch {
    // File missing or unreadable, proceed with check
  }
  return true
}

function updateLastCheck(): void {
  try {
    const dir = join(homedir(), '.gerrit-cli')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 })
    writeFileSync(LAST_CHECK_FILE, String(Date.now()), 'utf8')
  } catch {
    // Silently ignore write failures
  }
}

/**
 * Non-blocking daily update probe.
 *
 * Checks npm registry for the latest published version. If a newer version
 * is available, prints a notice to stderr. Fails silently on network errors,
 * parse failures, or file I/O issues — it must never crash the host command.
 *
 * Respects `GERRIT_SKIP_UPDATE_CHECK=true` to disable the check entirely.
 */
export async function runDailyUpdateProbe(): Promise<void> {
  if (!shouldCheck()) return

  try {
    updateLastCheck()

    const response = await fetch(`https://registry.npmjs.org/${PACKAGE_NAME}/latest`, {
      signal: AbortSignal.timeout(5000),
    })

    if (!response.ok) return

    const data = (await response.json()) as { version?: string }
    const latestVersion = data?.version
    if (!latestVersion) return

    const localVersion = getLocalVersion()
    if (latestVersion !== localVersion) {
      process.stderr.write(
        `\n${PACKAGE_NAME} v${latestVersion} is available (currently on v${localVersion}). ` +
          `Run \`gerrit-cli update\` to upgrade.\n\n`,
      )
    }
  } catch {
    // Silently ignore all errors: network, parse, file I/O, timeout
  }
}
