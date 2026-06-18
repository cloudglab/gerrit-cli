import { afterEach, describe, expect, mock, spyOn, test } from '@test/compat'
import { Effect } from 'effect'
import { installCommand } from '@/cli/commands/install'
import { uninstallCommand } from '@/cli/commands/uninstall'
import { updateCommand } from '@/cli/commands/update'
import * as childProcess from '@/utils/child-process'

describe('update command', () => {
  let execSpy: ReturnType<typeof spyOn>
  let execFileSpy: ReturnType<typeof spyOn>

  afterEach(() => {
    execSpy?.mockRestore()
    execFileSpy?.mockRestore()
    global.fetch = fetch
  })

  test('skips install when already up to date', async () => {
    execSpy = spyOn(childProcess, 'execSync').mockImplementation((() =>
      Buffer.from('')) as unknown as typeof childProcess.execSync)
    global.fetch = (async () => Response.json({ version: '0.0.16' })) as unknown as typeof fetch

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
          (c.includes('npm install -g') || c.includes('pnpm add -g')) &&
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
    expect(calls.some((c) => c.includes('npm install -g') || c.includes('pnpm add -g'))).toBe(true)
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
      throw new Error('install command failed')
    }) as unknown as typeof childProcess.execSync)
    global.fetch = (async () => Response.json({ version: '999.0.0' })) as unknown as typeof fetch

    const result = await Effect.runPromise(updateCommand({}).pipe(Effect.either))
    expect(result._tag).toBe('Left')
  })

  test('install command installs skill globally from package source by default', async () => {
    execFileSpy = spyOn(childProcess, 'execFileSync').mockImplementation(((
      command: string,
      args?: readonly string[],
    ) => {
      if (command === 'npm' && Array.isArray(args) && args.join(' ') === 'root -g') {
        return '/tmp/gerrit-cli-node-modules\n'
      }
      return Buffer.from('')
    }) as unknown as typeof childProcess.execFileSync)

    const logs: string[] = []
    const origLog = console.log
    console.log = (...args: unknown[]) => logs.push(String(args[0]))

    try {
      await Effect.runPromise(installCommand({ skipConfigCheck: true, skillSource: 'git' }))
    } finally {
      console.log = origLog
    }

    const calls = (execFileSpy.mock.calls as unknown as [string, string[]][]).map(
      ([command, args]) => `${command} ${args.join(' ')}`,
    )
    expect(
      calls.some((c) => c.includes('npm install -g') && c.includes('@cloudglab/gerrit-cli')),
    ).toBe(true)
    expect(
      calls.some((c) =>
        c.includes('npx -y skills add cloudglab/gerrit-cli --global --agent universal --yes'),
      ),
    ).toBe(true)
    expect(logs.join('\n')).toContain('安装完成')
  })

  test('install command can disable global scope explicitly', async () => {
    execFileSpy = spyOn(childProcess, 'execFileSync').mockImplementation(((
      command: string,
      args?: readonly string[],
    ) => {
      if (command === 'npm' && Array.isArray(args) && args.join(' ') === 'root -g') {
        return '/tmp/gerrit-cli-node-modules\n'
      }
      return Buffer.from('')
    }) as unknown as typeof childProcess.execFileSync)

    await Effect.runPromise(
      installCommand({ skipConfigCheck: true, skillSource: 'git', skillGlobal: false }),
    )

    const calls = (execFileSpy.mock.calls as unknown as [string, string[]][]).map(
      ([command, args]) => `${command} ${args.join(' ')}`,
    )
    expect(calls.some((c) => c.includes('npx -y skills add cloudglab/gerrit-cli --yes'))).toBe(true)
    expect(
      calls.some((c) =>
        c.includes('npx -y skills add cloudglab/gerrit-cli --global --agent universal --yes'),
      ),
    ).toBe(false)
  })

  test('install command can disable global scope with string option', async () => {
    execFileSpy = spyOn(childProcess, 'execFileSync').mockImplementation(((
      command: string,
      args?: readonly string[],
    ) => {
      if (command === 'npm' && Array.isArray(args) && args.join(' ') === 'root -g') {
        return '/tmp/gerrit-cli-node-modules\n'
      }
      return Buffer.from('')
    }) as unknown as typeof childProcess.execFileSync)

    await Effect.runPromise(
      installCommand({ skipConfigCheck: true, skillSource: 'git', skillGlobal: 'false' }),
    )

    const calls = (execFileSpy.mock.calls as unknown as [string, string[]][]).map(
      ([command, args]) => `${command} ${args.join(' ')}`,
    )
    expect(calls.some((c) => c.includes('npx -y skills add cloudglab/gerrit-cli --yes'))).toBe(true)
    expect(calls.some((c) => c.includes('--global'))).toBe(false)
    expect(calls.some((c) => c.includes('--agent universal'))).toBe(false)
  })

  test('install command falls back to npm package extraction when bundled skill path is missing', async () => {
    execFileSpy = spyOn(childProcess, 'execFileSync').mockImplementation(((
      command: string,
      args?: readonly string[],
    ) => {
      if (command === 'npm' && Array.isArray(args) && args.join(' ') === 'root -g') {
        return '/tmp/gerrit-cli-node-modules\n'
      }
      if (
        command === 'npm' &&
        Array.isArray(args) &&
        args[0] === 'pack' &&
        args[1] === '@cloudglab/gerrit-cli@latest'
      ) {
        return 'cloudglab-gerrit-cli-0.0.14.tgz\n'
      }
      return Buffer.from('')
    }) as unknown as typeof childProcess.execFileSync)

    const logs: string[] = []
    const origWrite = process.stdout.write.bind(process.stdout)
    process.stdout.write = ((chunk: string | Uint8Array) => {
      logs.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'))
      return true
    }) as typeof process.stdout.write

    try {
      await Effect.runPromise(installCommand({ skipConfigCheck: true, skillSource: 'local' }))
    } finally {
      process.stdout.write = origWrite
    }

    const calls = (execFileSpy.mock.calls as unknown as [string, string[]][]).map(
      ([command, args]) => `${command} ${args.join(' ')}`,
    )
    expect(calls.some((c) => c.includes('npm pack @cloudglab/gerrit-cli@latest'))).toBe(true)
    expect(calls.some((c) => c.includes('tar -xzf'))).toBe(true)
    expect(
      calls.some(
        (c) => c.includes('npx -y skills add') && c.includes('--global --agent universal --yes'),
      ),
    ).toBe(true)
    expect(logs.join('')).toContain('自动回退到 npm 包解压安装')
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

  test('uninstall command runs global npm uninstall with confirm', async () => {
    execFileSpy = spyOn(childProcess, 'execFileSync').mockImplementation(((
      command: string,
      args?: readonly string[],
    ) => {
      if (command === 'npm' && Array.isArray(args) && args.join(' ') === 'root -g') {
        return '/tmp/gerrit-cli-node-modules\n'
      }
      return Buffer.from('')
    }) as unknown as typeof childProcess.execFileSync)

    const logs: string[] = []
    const origLog = console.log
    console.log = (...args: unknown[]) => logs.push(String(args[0]))

    try {
      await Effect.runPromise(uninstallCommand({ confirm: true, keepConfig: true }))
    } finally {
      console.log = origLog
    }

    const calls = (execFileSpy.mock.calls as unknown as [string, string[]][]).map(
      ([command, args]) => `${command} ${args.join(' ')}`,
    )
    expect(
      calls.some((c) => c.includes('npm uninstall -g') && c.includes('@cloudglab/gerrit-cli')),
    ).toBe(true)
    expect(calls.some((c) => c.includes('npx -y skills remove gerrit-cli --yes'))).toBe(true)
    expect(logs.join('\n')).toContain('卸载完成')
  })
})
