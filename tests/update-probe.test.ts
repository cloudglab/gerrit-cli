import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  runDailyUpdateProbe,
  writeUpdateCacheAfterInstall,
  writeUpdateCheckState,
} from '@/update-probe'

let testCounter = 0
function makeTestFile(): string {
  testCounter += 1
  return join(
    tmpdir(),
    `gerrit-update-probe-test-${process.pid}-${testCounter}`,
    'update-check.json',
  )
}

function readState(checkFile: string): Record<string, unknown> {
  try {
    return JSON.parse(readFileSync(checkFile, 'utf8')) as Record<string, unknown>
  } catch {
    return {}
  }
}

describe('update probe', () => {
  let stderrOutput: string[]
  let origStderr: typeof process.stderr.write

  beforeEach(() => {
    stderrOutput = []
    origStderr = process.stderr.write
    process.stderr.write = ((chunk: unknown) => {
      stderrOutput.push(String(chunk))
      return true
    }) as typeof process.stderr.write
  })

  afterEach(() => {
    process.stderr.write = origStderr
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
    const testFile = makeTestFile()
    mkdirSync(join(testFile, '..'), { recursive: true })
    try {
      writeUpdateCheckState(
        {
          lastCheckedDate: '2099-01-01',
          latestVersion: '999.0.0',
          currentVersion: '0.0.0',
        },
        testFile,
      )

      stderrOutput.length = 0
      runDailyUpdateProbe('show', { checkFile: testFile })

      const output = stderrOutput.join('')
      expect(output).toContain('999.0.0')
      expect(output).toContain('gerrit update')
    } finally {
      rmSync(join(testFile, '..'), { recursive: true, force: true })
    }
  })

  test('does not notify when cached version matches local', () => {
    const testFile = makeTestFile()
    mkdirSync(join(testFile, '..'), { recursive: true })
    try {
      writeUpdateCheckState(
        {
          lastCheckedDate: '2099-01-01',
          latestVersion: '0.0.0',
          currentVersion: '0.0.0',
        },
        testFile,
      )

      stderrOutput.length = 0
      runDailyUpdateProbe('show', { checkFile: testFile })
      expect(stderrOutput.length).toBe(0)
    } finally {
      rmSync(join(testFile, '..'), { recursive: true, force: true })
    }
  })

  test('writeUpdateCacheAfterInstall writes current date and version', () => {
    const testFile = makeTestFile()
    mkdirSync(join(testFile, '..'), { recursive: true })
    try {
      writeUpdateCacheAfterInstall('1.2.3', testFile)

      const state = readState(testFile)
      expect(state.lastCheckedDate).toBe(new Date().toISOString().slice(0, 10))
      expect(state.latestVersion).toBe('1.2.3')
    } finally {
      rmSync(join(testFile, '..'), { recursive: true, force: true })
    }
  })

  test('writeUpdateCacheAfterInstall uses local version when no arg', () => {
    const testFile = makeTestFile()
    mkdirSync(join(testFile, '..'), { recursive: true })
    try {
      writeUpdateCacheAfterInstall(undefined, testFile)

      const state = readState(testFile)
      expect(state.lastCheckedDate).toBe(new Date().toISOString().slice(0, 10))
      expect(typeof state.currentVersion).toBe('string')
    } finally {
      rmSync(join(testFile, '..'), { recursive: true, force: true })
    }
  })
})
