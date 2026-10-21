/**
 * `trainctl completion <powłoka>` — skrypty uzupełniania generowane z drzewa
 * komend, więc nowa komenda albo flaga nie wymaga ręcznej aktualizacji czterech
 * plików. Zero zależności: statyczny tekst do wklejenia w profil powłoki.
 */
export interface CompletionSpec {
  name: string
  description: string
  options: { long: string; short?: string; description: string }[]
}

export const SHELLS = ['bash', 'zsh', 'fish', 'pwsh'] as const
export type Shell = (typeof SHELLS)[number]

const fishQuote = (text: string) => text.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
const psQuote = (text: string) => text.replace(/'/g, "''")

function bash(commands: CompletionSpec[], global: CompletionSpec['options']): string {
  const names = commands.map((c) => c.name).join(' ')
  const globals = global.map((o) => o.long).join(' ')
  const cases = commands
    .map((c) => `    ${c.name}) opts="${[...c.options.map((o) => o.long), globals].join(' ')}" ;;`)
    .join('\n')
  return `# trainctl — bash completion. Load with:  eval "$(trainctl completion bash)"
_trainctl() {
  local cur="\${COMP_WORDS[COMP_CWORD]}" opts
  if [ "$COMP_CWORD" -eq 1 ]; then
    COMPREPLY=( $(compgen -W "${names} ${globals}" -- "$cur") )
    return
  fi
  case "\${COMP_WORDS[1]}" in
${cases}
    *) opts="${globals}" ;;
  esac
  COMPREPLY=( $(compgen -W "$opts" -- "$cur") )
}
complete -F _trainctl trainctl
`
}

function fish(commands: CompletionSpec[], global: CompletionSpec['options']): string {
  const lines = ['# trainctl — fish completion. Load with:  trainctl completion fish | source', 'complete -c trainctl -f']
  for (const c of commands) {
    lines.push(`complete -c trainctl -n '__fish_use_subcommand' -a '${c.name}' -d '${fishQuote(c.description)}'`)
    for (const o of c.options) {
      const short = o.short ? ` -s ${o.short.replace(/^-/, '')}` : ''
      lines.push(`complete -c trainctl -n '__fish_seen_subcommand_from ${c.name}' -l ${o.long.replace(/^--/, '')}${short} -d '${fishQuote(o.description)}'`)
    }
  }
  for (const o of global) lines.push(`complete -c trainctl -l ${o.long.replace(/^--/, '')} -d '${fishQuote(o.description)}'`)
  return lines.join('\n') + '\n'
}

function pwsh(commands: CompletionSpec[], global: CompletionSpec['options']): string {
  const table = commands
    .map((c) => `    '${c.name}' = @(${[...c.options.map((o) => `'${o.long}'`), ...global.map((o) => `'${o.long}'`)].join(', ')})`)
    .join("\n")
  return `# trainctl — PowerShell completion. Load with:  trainctl completion pwsh | Out-String | Invoke-Expression
$trainctlOptions = @{
${table}
}
Register-ArgumentCompleter -Native -CommandName trainctl -ScriptBlock {
  param($wordToComplete, $commandAst, $cursorPosition)
  $words = @($commandAst.CommandElements | ForEach-Object { $_.ToString() })
  if ($words.Count -le 1 -or ($words.Count -eq 2 -and $wordToComplete)) {
    $candidates = @(${commands.map((c) => `'${psQuote(c.name)}'`).join(', ')})
  } else {
    $candidates = $trainctlOptions[$words[1]]
  }
  $candidates | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
    [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', $_)
  }
}
`
}

export function completionScript(shell: Shell, commands: CompletionSpec[], global: CompletionSpec['options']): string {
  switch (shell) {
    case 'bash':
      return bash(commands, global)
    case 'zsh':
      // zsh rozumie skrypty bash przez bashcompinit — jedna definicja, dwie powłoki
      return `# trainctl — zsh completion. Load with:  eval "$(trainctl completion zsh)"
autoload -U +X bashcompinit && bashcompinit
${bash(commands, global).split('\n').slice(1).join('\n')}`
    case 'fish':
      return fish(commands, global)
    case 'pwsh':
      return pwsh(commands, global)
  }
}

