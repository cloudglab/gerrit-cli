import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { runDailyUpdateProbe, writeUpdateCacheAfterInstall } from '@/update-probe'

const CHECK_DIR = join(homedir(), '.gerrit-cli')
const CHECK_FILE = join(CHECK_DIR, 'update-check.json')

function ensureDir(): void {
  mkdirSync(CHECK_DIR, { recursive: true, mode: 0o700 })
}

function cleanupCheckFile(): void {
  try {
    if (existsSync(CHECK_FILE)) unlinkSync(CHECK_FILE)
  } catch {
    // ignore
  }
}

describe('update probe', () => {
  let stderrOutput: string[]
  let origStderr: typeof process.stderr.write

  beforeEach(() => {
    ensureDir()
    cleanupCheckFile()
    stderrOutput = []
    origStderr = process.stderr.write
    process.stderr.write = ((chunk: unknown) => {
      stderrOutput.push(String(chunk))
      return true
    }) as typeof process.stderr.write
  })

  afterEach(() => {
    process.stderr.write = origStderr
    cleanupCheckFile()
    delete process.env.GERRIT_SKIP_UPDATE_CHECK
  })

  test('skips check for SKIP_COMMANDS', () => {
    for (const cmd of [
      'help',
      'version',
      'install',
      'update',
      'uninstall',
      'completion',
      '--help',
      '-h',
      '--version',
      '-v',
    ]) {
      stderrOutput.length = 0
      runDailyUpdateProbe(cmd)
      expect(stderrOutput.length).toBe(0)
    }
  })

  test('skips check when GERRIT_SKIP_UPDATE_CHECK=true', () => {
    process.env.GERRIT_SKIP_UPDATE_CHECK = 'true'
    stderrOutput.length = 0
    runDailyUpdateProbe('show')
    expect(stderrOutput.length).toBe(0)
  })

  test('notifies when cached latestVersion is newer', () => {
    // Write a state with a newer version
    ensureDir()
    writeFileSync(
      CHECK_FILE,
      JSON.stringify(
        { lastCheckedDate: '2099-01-01', latestVersion: '999.0.0', currentVersion: '0.0.0' },
        null,
        2,
      ) + '\n',
      { mode: 0o600 },
    )

    stderrOutput.length = 0
    runDailyUpdateProbe('show')

    const output = stderrOutput.join('')
    expect(output).toContain('999.0.0')
    expect(output).toContain('gerrit update')
  })

  test('does not notify when cached version matches local', () => {
    ensureDir()
    // Use a version that matches local (0.0.0 is fallback)
    writeFileSync(
      CHECK_FILE,
      JSON.stringify(
        { lastCheckedDate: '2099-01-01', latestVersion: '0.0.0', currentVersion: '0.0.0' },
        null,
        2,
      ) + '\n',
      { mode: 0o600 },
    )

    stderrOutput.length = 0
    runDailyUpdateProbe('show')
    expect(stderrOutput.length).toBe(0)
  })

  test('writeUpdateCacheAfterInstall writes current date and version', () => {
    ensureDir()
    writeUpdateCacheAfterInstall('1.2.3')

    expect(existsSync(CHECK_FILE)).toBe(true)
    const raw = JSON.parse(readFileSync(CHECK_FILE, 'utf8')) as unknown
    expect(typeof raw).toBe('object')
    const state = raw as Record<string, unknown>
    expect(state.lastCheckedDate).toBe(new Date().toISOString().slice(0, 10))
    expect(state.latestVersion).toBe('1.2.3')
  })

  test('writeUpdateCacheAfterInstall uses local version when no arg', () => {
    ensureDir()
    writeUpdateCacheAfterInstall()

    const state = JSON.parse(readFileSync(CHECK_FILE, 'utf8')) as Record<string, unknown>
    expect(state.lastCheckedDate).toBe(new Date().toISOString().slice(0, 10))
    expect(typeof state.currentVersion).toBe('string')
  })
})
