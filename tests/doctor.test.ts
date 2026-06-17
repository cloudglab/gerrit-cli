import { describe, expect, test } from '@test/compat'
import { Effect } from 'effect'
import { collectDoctorReport, outputDoctorReport } from '@/cli/commands/doctor'
import type { MaskedAppConfig } from '@/services/config'

const createMaskedConfig = (overrides?: Partial<MaskedAppConfig>): MaskedAppConfig => ({
  host: 'https://gerrit.example.com',
  username: 'tester',
  hasPassword: true,
  source: 'file',
  configPath: '/tmp/config.json',
  ...overrides,
})

describe('doctor command', () => {
  test('should report healthy environment', async () => {
    const report = await Effect.runPromise(
      collectDoctorReport({
        getMaskedConfig: Effect.succeed(createMaskedConfig()),
        testConnection: Effect.succeed(true),
        hasHook: () => Effect.succeed(true),
        hasChangeId: () => Effect.succeed(true),
        gitProbe: {
          isGitRepo: () => true,
          listRemotes: () => ['origin https://gerrit.example.com/project (fetch)'],
        },
      }),
    )

    expect(report.ok).toBe(true)
    expect(report.checks.find((check) => check.name === 'config')?.status).toBe('pass')
    expect(report.checks.find((check) => check.name === 'connection')?.status).toBe('pass')
    expect(report.checks.find((check) => check.name === 'git-remote')?.status).toBe('pass')
    expect(report.checks.find((check) => check.name === 'commit-msg-hook')?.status).toBe('pass')
    expect(report.checks.find((check) => check.name === 'head-change-id')?.status).toBe('pass')
  })

  test('should fail when config is missing', async () => {
    const report = await Effect.runPromise(
      collectDoctorReport({
        getMaskedConfig: Effect.fail(new Error('Configuration not found')),
        testConnection: Effect.succeed(true),
        hasHook: () => Effect.succeed(true),
        hasChangeId: () => Effect.succeed(true),
        gitProbe: {
          isGitRepo: () => false,
          listRemotes: () => [],
        },
      }),
    )

    expect(report.ok).toBe(false)
    expect(report.checks.find((check) => check.name === 'config')?.status).toBe('fail')
    expect(report.checks.find((check) => check.name === 'connection')?.status).toBe('warn')
  })

  test('should warn for missing hook and change id', async () => {
    const report = await Effect.runPromise(
      collectDoctorReport({
        getMaskedConfig: Effect.succeed(createMaskedConfig()),
        testConnection: Effect.succeed(true),
        hasHook: () => Effect.succeed(false),
        hasChangeId: () => Effect.succeed(false),
        gitProbe: {
          isGitRepo: () => true,
          listRemotes: () => ['origin https://gerrit.example.com/project (fetch)'],
        },
      }),
    )

    expect(report.ok).toBe(true)
    expect(report.checks.find((check) => check.name === 'commit-msg-hook')?.status).toBe('warn')
    expect(report.checks.find((check) => check.name === 'head-change-id')?.status).toBe('warn')
  })

  test('should render JSON output', () => {
    const calls: string[] = []
    const originalLog = console.log
    console.log = (value?: unknown) => {
      calls.push(String(value ?? ''))
    }

    outputDoctorReport(
      {
        ok: true,
        host: 'https://gerrit.example.com',
        username: 'tester',
        configSource: 'file',
        checks: [],
      },
      { json: true },
    )

    console.log = originalLog
    const parsed = JSON.parse(calls.join('\n'))
    expect(parsed.ok).toBe(true)
    expect(parsed.host).toBe('https://gerrit.example.com')
  })
})
