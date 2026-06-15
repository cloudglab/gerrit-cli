export const CLI_ROLES = ['full', 'dev', 'reviewer', 'lead', 'ci'] as const

export type CliRole = (typeof CLI_ROLES)[number]

export class InvalidCliRoleError extends Error {
  readonly _tag = 'InvalidCliRoleError'

  constructor(role: string) {
    super(`Invalid role "${role}". Expected one of: ${CLI_ROLES.join(', ')}`)
  }
}

export function isCliRole(value: string): value is CliRole {
  return CLI_ROLES.some((role) => role === value)
}

export function parseCliRole(value: string): CliRole {
  if (isCliRole(value)) return value
  throw new InvalidCliRoleError(value)
}
