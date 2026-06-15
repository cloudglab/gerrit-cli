import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const PACKAGE_NAME = '@cloudglab/gerrit-cli'
const CHECK_FILE = join(homedir(), '.gerrit-cli', 'update-check.json')

const SKIP_COMMANDS = new Set([
  'help',
  'list',
  'version',
  'install',
  'update',
  'uninstall',
  'completion',
  '--help',
  '-h',
  '--version',
  '-v',
])

interface UpdateCheckState {
  readonly lastCheckedDate?: string
  readonly latestVersion?: string
  readonly currentVersion?: string
}

function getLocalVersion(): string {
  try {
    const pkgPath = join(import.meta.dirname!, '..', 'package.json')
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as unknown
    if (
      typeof pkg === 'object' &&
      pkg !== null &&
      !Array.isArray(pkg) &&
      'version' in pkg &&
      typeof (pkg as Record<string, unknown>).version === 'string'
    ) {
      return (pkg as Record<string, unknown>).version as string
    }
    return '0.0.0'
  } catch {
    return '0.0.0'
  }
}

function readUpdateCheckState(): UpdateCheckState {
  try {
    if (!existsSync(CHECK_FILE)) return {}
    const parsed = JSON.parse(readFileSync(CHECK_FILE, 'utf8')) as unknown
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as UpdateCheckState
    }
    return {}
  } catch {
    return {}
  }
}

export function writeUpdateCheckState(state: UpdateCheckState): void {
  const dir = join(homedir(), '.gerrit-cli')
  const data = `${JSON.stringify(state, null, 2)}\n`
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      mkdirSync(dir, { recursive: true, mode: 0o700 })
      writeFileSync(CHECK_FILE, data, { mode: 0o600 })
      return
    } catch {
      // ENOENT race: dir deleted between mkdir and write; retry once
    }
  }
}

function notifyIfUpdateAvailable(latestVersion?: string): void {
  const localVersion = getLocalVersion()
  if (!latestVersion || !isNewerVersion(latestVersion, localVersion)) return

  process.stderr.write(
    [
      `${PACKAGE_NAME} v${latestVersion} is available (currently on v${localVersion}).`,
      'Run `gerrit update` to upgrade.',
      '',
    ].join('\n'),
  )
}

function isNewerVersion(latest: string, current: string): boolean {
  const latestParts = parseVersion(latest)
  const currentParts = parseVersion(current)
  for (let i = 0; i < Math.max(latestParts.length, currentParts.length); i += 1) {
    const l = latestParts[i] ?? 0
    const c = currentParts[i] ?? 0
    if (l > c) return true
    if (l < c) return false
  }
  return false
}

function parseVersion(version: string): number[] {
  return version
    .replace(/^v/, '')
    .split(/[.-]/)
    .map((part) => Number.parseInt(part, 10))
    .map((part) => (Number.isFinite(part) ? part : 0))
}

function triggerBackgroundVersionCheck(): void {
  const script = `
    const { spawn } = require('child_process');
    const { mkdirSync, writeFileSync } = require('fs');
    const { homedir } = require('os');
    const path = require('path');

    const packageName = ${JSON.stringify(PACKAGE_NAME)};
    const cliVersion = ${JSON.stringify(getLocalVersion())};
    const shell = ${String(process.platform === 'win32')};

    const npm = spawn('npm', ['view', packageName, 'version', '--silent'], {
      shell,
      detached: true,
      stdio: ['ignore', 'pipe', 'ignore'],
    });

    let stdout = '';
    npm.stdout.on('data', (chunk) => { stdout += chunk.toString('utf8'); });

    npm.on('close', (code) => {
      if (code !== 0) return;
      const latestVersion = stdout.trim();
      if (!latestVersion) return;
      const today = new Date().toISOString().slice(0, 10);
      const checkFile = path.join(homedir(), '.gerrit-cli', 'update-check.json');
      mkdirSync(path.dirname(checkFile), { recursive: true, mode: 0o700 });
      writeFileSync(checkFile, JSON.stringify({ lastCheckedDate: today, latestVersion, currentVersion: cliVersion }, null, 2) + '\\n', { mode: 0o600 });
    });
  `

  try {
    const child = spawn(process.execPath, ['-e', script], {
      detached: true,
      stdio: 'ignore',
    })
    child.unref()
  } catch {
    // Silently ignore spawn failures
  }
}

/**
 * Non-blocking daily update probe.
 *
 * Checks npm registry for the latest published version via a detached
 * background subprocess. If a newer version is available, prints a notice
 * to stderr. Fails silently on network errors, parse failures, or file
 * I/O issues — it must never crash the host command.
 *
 * Respects `GERRIT_SKIP_UPDATE_CHECK=true` to disable the check entirely.
 * Skips check for commands in SKIP_COMMANDS (help, version, install, etc.).
 */
export function runDailyUpdateProbe(commandName?: string): void {
  if (commandName && SKIP_COMMANDS.has(commandName)) return
  if (process.env.GERRIT_SKIP_UPDATE_CHECK === 'true') return

  try {
    const today = new Date().toISOString().slice(0, 10)
    const state = readUpdateCheckState()

    notifyIfUpdateAvailable(state.latestVersion)

    if (state.lastCheckedDate === today) return

    writeUpdateCheckState({
      ...state,
      lastCheckedDate: today,
      currentVersion: getLocalVersion(),
    })
    triggerBackgroundVersionCheck()
  } catch {
    // Update check failure must not block the main command
  }
}

/**
 * Write update cache after a successful install or update.
 * Prevents the probe from immediately reporting an available update
 * right after the user just installed/updated.
 */
export function writeUpdateCacheAfterInstall(version?: string): void {
  const today = new Date().toISOString().slice(0, 10)
  writeUpdateCheckState({
    lastCheckedDate: today,
    latestVersion: version ?? getLocalVersion(),
    currentVersion: getLocalVersion(),
  })
}
