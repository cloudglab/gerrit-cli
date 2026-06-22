import { describe, expect, test } from '@test/compat'
import { Command } from 'commander'
import {
  applyMetaHelp,
  defaultCostHint,
  defaultNextBestTools,
  effectiveCostHint,
  effectiveNextBestTools,
  getCommandMeta,
  metaHelpText,
} from '@/cli/command-meta'

describe('defaultCostHint', () => {
  test('write commands are high cost', () => {
    expect(defaultCostHint({ group: 'change', isWrite: true })).toBe('high')
    expect(defaultCostHint({ group: 'workspace', isWrite: true })).toBe('high')
  })

  test('analytics reads are medium cost', () => {
    expect(defaultCostHint({ group: 'analytics', isWrite: false })).toBe('medium')
  })

  test('other reads are low cost', () => {
    expect(defaultCostHint({ group: 'config', isWrite: false })).toBe('low')
    expect(defaultCostHint({ group: 'review', isWrite: false })).toBe('low')
    expect(defaultCostHint({ group: 'change', isWrite: false })).toBe('low')
  })
})

describe('defaultNextBestTools', () => {
  test('returns group-specific recommendations', () => {
    expect(defaultNextBestTools({ group: 'review' })).toContain('show')
    expect(defaultNextBestTools({ group: 'ci' })).toContain('build-status')
    expect(defaultNextBestTools({ group: 'analytics' })).toContain('report')
  })
})

describe('effectiveCostHint', () => {
  test('returns explicit override when set', () => {
    const meta = {
      name: 'foo',
      group: 'change',
      isWrite: false,
      roles: [],
      costHint: 'high',
    } as const
    expect(effectiveCostHint(meta)).toBe('high')
  })

  test('falls back to default when not set', () => {
    const meta = { name: 'foo', group: 'change', isWrite: false, roles: [] } as const
    expect(effectiveCostHint(meta)).toBe('low')
  })
})

describe('effectiveNextBestTools', () => {
  test('returns explicit override when set', () => {
    const meta = {
      name: 'foo',
      group: 'change',
      isWrite: false,
      roles: [],
      nextBestTools: ['custom'],
    } as const
    expect(effectiveNextBestTools(meta)).toEqual(['custom'])
  })

  test('falls back to group default', () => {
    const meta = { name: 'foo', group: 'review', isWrite: false, roles: [] } as const
    expect(effectiveNextBestTools(meta)).toContain('show')
  })
})

describe('getCommandMeta', () => {
  test('finds known command', () => {
    const meta = getCommandMeta('comment')
    expect(meta).toBeDefined()
    expect(meta?.isWrite).toBe(true)
    expect(meta?.group).toBe('review')
  })

  test('returns undefined for unknown command', () => {
    expect(getCommandMeta('nonexistent')).toBeUndefined()
  })
})

describe('metaHelpText', () => {
  test('produces expected text for a known command', () => {
    const text = metaHelpText('comment')
    expect(text).toContain('预估成本:')
    expect(text).toContain('下一步推荐:')
  })

  test('marks write commands as high cost', () => {
    const text = metaHelpText('comment')
    expect(text).toContain('high')
  })

  test('marks analytics as medium cost', () => {
    const text = metaHelpText('report')
    expect(text).toContain('medium')
  })

  test('marks read commands as low cost', () => {
    const text = metaHelpText('show')
    expect(text).toContain('low')
  })

  test('returns empty string for unknown command', () => {
    expect(metaHelpText('nope')).toBe('')
  })
})

describe('applyMetaHelp', () => {
  test('does not throw for unknown commands', () => {
    const program = new Command()
    program
      .command('foo')
      .description('foo command')
      .action(() => {})
    program
      .command('bar')
      .description('bar command')
      .action(() => {})

    applyMetaHelp(program)

    // helpInformation() returns the standard help; addHelpText only appends
    // when --help is actually rendered. Just smoke test that the function
    // does not throw on unknown commands.
    const fooHelp = program.commands[0]?.helpInformation() ?? ''
    expect(fooHelp).toContain('foo command')
  })

  test('adds meta help text for known commands (smoke)', () => {
    // End-to-end verification happens via the CLI smoke test:
    //   pnpm exec tsx src/cli/index.ts <cmd> --help
    // which renders the after-help text correctly. Here we just confirm
    // applyMetaHelp does not throw and that the meta block is non-empty
    // for a known command.
    const program = new Command()
    program
      .command('comment')
      .description('post a comment')
      .action(() => {})

    expect(() => applyMetaHelp(program)).not.toThrow()
    expect(metaHelpText('comment')).toContain('预估成本: high')
    expect(metaHelpText('comment')).toContain('下一步推荐:')
  })
})
