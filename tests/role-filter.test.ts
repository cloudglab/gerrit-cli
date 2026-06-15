import { describe, expect, test } from 'bun:test'
import { Command } from 'commander'
import { applyRoleFilter, getCommandMeta } from '@/cli/command-meta'
import { registerCommands } from '@/cli/register-commands'
import { InvalidCliRoleError, parseCliRole } from '@/cli/roles'

function commandNamesForRole(role: ReturnType<typeof parseCliRole>): string[] {
  const program = new Command()
  registerCommands(program)
  applyRoleFilter(program, role)
  return program.commands.map((command) => command.name())
}

describe('role filtering', () => {
  test('parses supported roles', () => {
    expect(parseCliRole('dev')).toBe('dev')
    expect(parseCliRole('reviewer')).toBe('reviewer')
    expect(() => parseCliRole('unknown')).toThrow(InvalidCliRoleError)
  })

  test('keeps all commands for full role', () => {
    const program = new Command()
    registerCommands(program)
    const before = program.commands.map((command) => command.name())

    applyRoleFilter(program, 'full')

    expect(program.commands.map((command) => command.name())).toEqual(before)
  })

  test('filters reviewer role to review commands', () => {
    const names = commandNamesForRole('reviewer')

    expect(names).toContain('comment')
    expect(names).toContain('vote')
    expect(names).toContain('incoming')
    expect(names).not.toContain('push')
    expect(names).not.toContain('submit')
    expect(names).not.toContain('groups')
  })

  test('filters ci role to CI commands', () => {
    const names = commandNamesForRole('ci')

    expect(names).toContain('build-status')
    expect(names).toContain('failures')
    expect(names).toContain('extract-url')
    expect(names).not.toContain('comment')
    expect(names).not.toContain('push')
  })

  test('exposes metadata for write commands', () => {
    expect(getCommandMeta('comment')?.isWrite).toBe(true)
    expect(getCommandMeta('build-status')?.isWrite).toBe(false)
  })
})
