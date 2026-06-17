import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from '@test/compat'
import { runDailyUpdateProbe, writeUpdateCacheAfterInstall } from '@/update-probe'

describe('update probe', () => {
  let stderrOutput: string[]
  let origStderr: typeof process.stderr.write
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'gerrit-update-probe-'))
    stderrOutput = []
    origStderr = process.stderr.write
    process.stderr.write = ((chunk: unknown) => {
      stderrOutput.push(String(chunk))
      return true
    }) as typeof process.stderr.write
  })

  afterEach(() => {
    process.stderr.write = origStderr
    try {
      rmSync(tempDir, { recursive: true, force: true })
    } catch {
      // ignore
    }
    delete process.env.GERRIT_SKIP_UPDATE_CHECK
  })

  function checkFile(): string {
    return join(tempDir, 'update-check.json')
  }

  function readState(file: string): Record<string, unknown> {
    try {
      return JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>
    } catch {
      return {}
    }
  }

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
    const file = checkFile()
    writeFileSync(
      file,
      JSON.stringify({
        lastCheckedDate: '2099-01-01',
        latestVersion: '999.0.0',
        currentVersion: '0.0.0',
      }),
    )

    stderrOutput.length = 0
    runDailyUpdateProbe('show', { checkFile: file })

    const output = stderrOutput.join('')
    expect(output).toContain('999.0.0')
    expect(output).toContain('gerrit update')
  })

  test('does not notify when cached version matches local', () => {
    const file = checkFile()
    writeFileSync(
      file,
      JSON.stringify({
        lastCheckedDate: '2099-01-01',
        latestVersion: '0.0.0',
        currentVersion: '0.0.0',
      }),
    )

    stderrOutput.length = 0
    runDailyUpdateProbe('show', { checkFile: file })
    expect(stderrOutput.length).toBe(0)
  })

  test('writeUpdateCacheAfterInstall writes current date and version', () => {
    const file = checkFile()
    const today = new Date().toISOString().slice(0, 10)
    writeUpdateCacheAfterInstall('1.2.3', file)

    const state = readState(file)
    expect(state.lastCheckedDate).toBe(today)
    expect(state.latestVersion).toBe('1.2.3')
  })

  test('writeUpdateCacheAfterInstall uses local version when no arg', () => {
    const file = checkFile()
    const today = new Date().toISOString().slice(0, 10)
    writeUpdateCacheAfterInstall(undefined, file)

    const state = readState(file)
    expect(state.lastCheckedDate).toBe(today)
    expect(typeof state.currentVersion).toBe('string')
  })
})
