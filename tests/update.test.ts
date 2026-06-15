import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test'
import { Effect } from 'effect'
import { installCommand } from '@/cli/commands/install'
import { uninstallCommand } from '@/cli/commands/uninstall'
import { updateCommand } from '@/cli/commands/update'
import * as childProcess from '@/utils/child-process'

describe('update command', () => {
  let execSpy: ReturnType<typeof spyOn>

  afterEach(() => {
    execSpy?.mockRestore()
    global.fetch = fetch
  })

  test('skips install when already up to date', async () => {
    execSpy = spyOn(childProcess, 'execSync').mockImplementation((() =>
      Buffer.from('')) as unknown as typeof childProcess.execSync)
    global.fetch = (async () => Response.json({ version: '0.0.0' })) as unknown as typeof fetch

    const logs: string[] = []
    const origLog = console.log
    console.log = (...args: unknown[]) => logs.push(String(args[0]))

    try {
      await Effect.runPromise(updateCommand({}))
    } finally {
      console.log = origLog
    }

    expect(logs.join('\n')).toContain('Already up to date')
    expect(execSpy.mock.calls.length).toBe(0)
  })

  test('runs npm install when newer version available', async () => {
    execSpy = spyOn(childProcess, 'execSync').mockImplementation((() =>
      Buffer.from('')) as unknown as typeof childProcess.execSync)
    global.fetch = (async () => Response.json({ version: '999.0.0' })) as unknown as typeof fetch

    const logs: string[] = []
    const origLog = console.log
    console.log = (...args: unknown[]) => logs.push(String(args[0]))

    try {
      await Effect.runPromise(updateCommand({}))
    } finally {
      console.log = origLog
    }

    const calls = (execSpy.mock.calls as unknown as [string][]).map(([c]) => c)
    expect(
      calls.some(
        (c) =>
          (c.includes('npm install -g') || c.includes('bun install -g')) &&
          c.includes('@cloudglab/gerrit-cli'),
      ),
    ).toBe(true)
    expect(logs.join('\n')).toContain('更新完成')
  })

  test('--skip-pull installs without version check', async () => {
    execSpy = spyOn(childProcess, 'execSync').mockImplementation((() =>
      Buffer.from('')) as unknown as typeof childProcess.execSync)
    const fetchSpy = mock(async () => Response.json({ version: '999.0.0' }))
    global.fetch = fetchSpy as unknown as typeof fetch

    await Effect.runPromise(updateCommand({ skipPull: true }))

    expect(fetchSpy.mock.calls.length).toBe(0)
    const calls = (execSpy.mock.calls as unknown as [string][]).map(([c]) => c)
    expect(calls.some((c) => c.includes('npm install -g') || c.includes('bun install -g'))).toBe(
      true,
    )
  })

  test('fails when registry is unreachable', async () => {
    global.fetch = (async () => {
      throw new Error('network error')
    }) as unknown as typeof fetch

    const result = await Effect.runPromise(updateCommand({}).pipe(Effect.either))
    expect(result._tag).toBe('Left')
  })

  test('fails when install command fails', async () => {
    execSpy = spyOn(childProcess, 'execSync').mockImplementation((() => {
      throw new Error('bun not found')
    }) as unknown as typeof childProcess.execSync)
    global.fetch = (async () => Response.json({ version: '999.0.0' })) as unknown as typeof fetch

    const result = await Effect.runPromise(updateCommand({}).pipe(Effect.either))
    expect(result._tag).toBe('Left')
  })

  test('install command runs global npm install', async () => {
    execSpy = spyOn(childProcess, 'execSync').mockImplementation((() =>
      Buffer.from('')) as unknown as typeof childProcess.execSync)

    const logs: string[] = []
    const origLog = console.log
    console.log = (...args: unknown[]) => logs.push(String(args[0]))

    try {
      await Effect.runPromise(installCommand({ skipConfigCheck: true }))
    } finally {
      console.log = origLog
    }

    const calls = (execSpy.mock.calls as unknown as [string][]).map(([c]) => c)
    expect(
      calls.some(
        (c) =>
          (c.includes('npm install -g') || c.includes('bun install -g')) &&
          c.includes('@cloudglab/gerrit-cli'),
      ),
    ).toBe(true)
    expect(logs.join('\n')).toContain('安装完成')
  })

  test('uninstall command previews without confirm', async () => {
    execSpy = spyOn(childProcess, 'execSync').mockImplementation((() =>
      Buffer.from('')) as unknown as typeof childProcess.execSync)

    const logs: string[] = []
    const origLog = console.log
    console.log = (...args: unknown[]) => logs.push(String(args[0]))

    try {
      await Effect.runPromise(uninstallCommand({}))
    } finally {
      console.log = origLog
    }

    expect(logs.join('\n')).toContain('卸载预览')
    expect(execSpy.mock.calls.length).toBe(0)
  })

  test('uninstall command runs global bun remove with confirm', async () => {
    execSpy = spyOn(childProcess, 'execSync').mockImplementation((() =>
      Buffer.from('')) as unknown as typeof childProcess.execSync)

    const logs: string[] = []
    const origLog = console.log
    console.log = (...args: unknown[]) => logs.push(String(args[0]))

    try {
      await Effect.runPromise(uninstallCommand({ confirm: true, keepConfig: true }))
    } finally {
      console.log = origLog
    }

    const calls = (execSpy.mock.calls as unknown as [string][]).map(([c]) => c)
    expect(
      calls.some((c) => c.includes('bun remove -g') && c.includes('@cloudglab/gerrit-cli')),
    ).toBe(true)
    expect(logs.join('\n')).toContain('卸载完成')
  })
})
