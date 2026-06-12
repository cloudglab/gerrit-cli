import type { Command } from 'commander'

type SupportedShell = 'bash' | 'zsh' | 'fish'

interface CompletionCommandInfo {
  readonly name: string
  readonly aliases: ReadonlyArray<string>
  readonly description: string
  readonly options: ReadonlyArray<string>
  readonly subcommands: ReadonlyArray<CompletionCommandInfo>
}

const commandName = 'gerrit-cli'

const normalizeShell = (shell: string): SupportedShell => {
  switch (shell) {
    case 'bash':
    case 'zsh':
    case 'fish':
      return shell
    default:
      throw new Error(`Unsupported shell: ${shell}. Use bash, zsh, or fish.`)
  }
}

const escapeSingleQuoted = (value: string): string => value.replace(/'/g, `'\\''`)

const shellQuote = (value: string): string => `'${escapeSingleQuoted(value)}'`

const commandOptionFlags = (command: Command): ReadonlyArray<string> =>
  command.options
    .flatMap((option) => [option.short, option.long])
    .filter((flag) => flag !== undefined)

const collectCommands = (program: Command): ReadonlyArray<CompletionCommandInfo> =>
  program.commands.map((command) => ({
    name: command.name(),
    aliases: command.aliases(),
    description: command.description(),
    options: commandOptionFlags(command),
    subcommands: collectCommands(command),
  }))

const commandNames = (command: CompletionCommandInfo): ReadonlyArray<string> => [
  command.name,
  ...command.aliases,
]

const commandPattern = (command: CompletionCommandInfo): string => commandNames(command).join('|')

const hasSubcommands = (command: CompletionCommandInfo): boolean => command.subcommands.length > 0

// ─── Bash ───────────────────────────────────────────────────────────────────

const bashCaseEntries = (commands: ReadonlyArray<CompletionCommandInfo>): string =>
  commands
    .map((command) => {
      const options = command.options.join(' ')
      return `    ${commandPattern(command)}) options=${shellQuote(options)} ;;`
    })
    .join('\n')

const bashSubcommandEntries = (commands: ReadonlyArray<CompletionCommandInfo>): string =>
  commands
    .filter(hasSubcommands)
    .map((command) => {
      const subcommands = command.subcommands.flatMap(commandNames).join(' ')
      return `    ${commandPattern(command)}) subcommands=${shellQuote(subcommands)} ;;`
    })
    .join('\n')

const bashSubcommandOptionEntries = (commands: ReadonlyArray<CompletionCommandInfo>): string =>
  commands
    .flatMap((command) =>
      command.subcommands.map((subcommand) => {
        const options = subcommand.options.join(' ')
        return `    ${command.name}:${subcommand.name}) options=${shellQuote(options)} ;;`
      }),
    )
    .join('\n')

const renderBashCompletion = (program: Command): string => {
  const commands = collectCommands(program)
  const commandWords = commands.flatMap(commandNames).join(' ')

  return `# gerrit-cli bash completion
_gerrit_cli_completion() {
  local current previous command subcommand command_key options subcommands
  current="\${COMP_WORDS[COMP_CWORD]}"
  previous="\${COMP_WORDS[COMP_CWORD-1]}"

  if [[ $COMP_CWORD -eq 1 ]]; then
    COMPREPLY=( $(compgen -W ${shellQuote(commandWords)} -- "$current") )
    return 0
  fi

  command="\${COMP_WORDS[1]}"
  subcommand="\${COMP_WORDS[2]}"

  if [[ $COMP_CWORD -eq 2 ]]; then
    case "$command" in
${bashSubcommandEntries(commands)}
      *) subcommands='' ;;
    esac

    if [[ -n "$subcommands" && "$current" != -* ]]; then
      COMPREPLY=( $(compgen -W "$subcommands" -- "$current") )
      return 0
    fi
  fi

  command_key="$command:$subcommand"
  case "$command_key" in
${bashSubcommandOptionEntries(commands)}
    *)
      case "$command" in
${bashCaseEntries(commands)}
        *) options='' ;;
      esac
      ;;
  esac

  if [[ "$current" == -* ]]; then
    COMPREPLY=( $(compgen -W "$options" -- "$current") )
    return 0
  fi

  case "$previous" in
    --file)
      COMPREPLY=( $(compgen -f -- "$current") )
      ;;
    *)
      COMPREPLY=()
      ;;
  esac
}

complete -F _gerrit_cli_completion gerrit-cli gerrit
`
}

// ─── Zsh ────────────────────────────────────────────────────────────────────

const zshCommandEntries = (commands: ReadonlyArray<CompletionCommandInfo>): string =>
  commands
    .map((command) => `${command.name}:${command.description || command.name}`)
    .map(shellQuote)
    .join(' ')

const zshSubcommandEntries = (commands: ReadonlyArray<CompletionCommandInfo>): string =>
  commands
    .filter(hasSubcommands)
    .map(
      (command) =>
        `    ${command.name}) subcommands=(${zshCommandEntries(command.subcommands)}); _describe 'subcommand' subcommands ;;`,
    )
    .join('\n')

const zshOptionEntries = (commands: ReadonlyArray<CompletionCommandInfo>): string =>
  commands
    .map((command) => {
      const subLines = command.subcommands
        .map(
          (subcommand) =>
            `      ${subcommand.name}) _arguments ${subcommand.options.map(shellQuote).join(' ')} ;;`,
        )
        .join('\n')

      if (subLines.length === 0) {
        return `    ${command.name}) _arguments ${command.options.map(shellQuote).join(' ')} ;;`
      }

      return `    ${command.name})
      case "$words[3]" in
${subLines}
        *) _files ;;
      esac
      ;;`
    })
    .join('\n')

const renderZshCompletion = (program: Command): string => {
  const commands = collectCommands(program)
  return `#compdef gerrit-cli gerrit

_gerrit_cli() {
  local -a commands subcommands
  commands=(${zshCommandEntries(commands)})

  if (( CURRENT == 2 )); then
    _describe 'command' commands
    return
  fi

  if (( CURRENT == 3 )); then
    case "$words[2]" in
${zshSubcommandEntries(commands)}
    esac
    return
  fi

  case "$words[2]" in
${zshOptionEntries(commands)}
    *) _files ;;
  esac
}

_gerrit_cli "$@"
`
}

// ─── Fish ───────────────────────────────────────────────────────────────────

const fishOptionLines = (command: CompletionCommandInfo, condition: string): string =>
  command.options
    .map((option) => {
      const flag = option.replace(/^-+/, '')
      const flagOption = option.startsWith('--')
        ? `--long-option ${flag}`
        : `--short-option ${flag}`
      return `complete --command ${commandName} --condition ${shellQuote(condition)} ${flagOption}`
    })
    .join('\n')

const fishSubcommandLines = (command: CompletionCommandInfo): string =>
  command.subcommands
    .map((subcommand) => {
      const subcondition = `__fish_seen_subcommand_from ${command.name}; and __fish_seen_subcommand_from ${subcommand.name}`
      const optionLines = fishOptionLines(subcommand, subcondition)

      return [
        `complete --command ${commandName} --condition '__fish_seen_subcommand_from ${command.name}' --exclusive --arguments ${shellQuote(subcommand.name)} --description ${shellQuote(subcommand.description || subcommand.name)}`,
        optionLines,
      ]
        .filter((line) => line.length > 0)
        .join('\n')
    })
    .join('\n')

const fishLine = (command: CompletionCommandInfo): string => {
  const description = command.description || command.name
  const optionLines = fishOptionLines(command, `__fish_seen_subcommand_from ${command.name}`)
  const subcommandLines = fishSubcommandLines(command)

  return [
    `complete --command ${commandName} --exclusive --arguments ${shellQuote(command.name)} --description ${shellQuote(description)}`,
    optionLines,
    subcommandLines,
  ]
    .filter((line) => line.length > 0)
    .join('\n')
}

const renderFishCompletion = (program: Command): string =>
  `# gerrit-cli fish completion\n${collectCommands(program).map(fishLine).join('\n')}`

// ─── Public API ─────────────────────────────────────────────────────────────

export const renderCompletion = (program: Command, shell: string): string => {
  const normalizedShell = normalizeShell(shell)
  switch (normalizedShell) {
    case 'bash':
      return renderBashCompletion(program)
    case 'zsh':
      return renderZshCompletion(program)
    case 'fish':
      return renderFishCompletion(program)
  }
}
