#!/usr/bin/env node
/**
 * PostToolUse (Edit|Write): po edycji plan/plan.yaml uruchamia `trainctl check`.
 *
 * Błąd lintu (plik niespójny) → kod 2 i opis na stderr: Claude Code pokazuje go
 * agentowi, choć edycja już się odbyła. Same ostrzeżenia → `additionalContext`
 * obok wyniku narzędzia. Każda inna edycja, brak sieci albo brak npx → cisza:
 * hook nie może blokować pracy, która nie dotyczy planu.
 *
 * Bez zależności; wersja trainctl przypięta do wersji pluginu
 * (tools/release/bump-version.mjs podnosi ją razem z paczkami).
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'

export const TRAINCTL_VERSION = '0.3.0'
const PLAN = 'plan/plan.yaml'

/** Katalog treningowy, jeśli edytowany plik to jego plan/plan.yaml; inaczej undefined. */
export function trainingDirOf(filePath) {
  const normalized = String(filePath ?? '').replace(/\\/g, '/')
  if (!new RegExp(`(^|/)${PLAN.replace('.', '\\.')}$`).test(normalized)) return undefined
  return normalized.slice(0, -PLAN.length).replace(/\/$/, '') || '.'
}

function npx(args) {
  const options = { encoding: 'utf-8', env: { ...process.env, NO_COLOR: '1' }, timeout: 110_000, windowsHide: true }
  if (process.platform !== 'win32') return spawnSync('npx', args, options)
  // Na Windows .cmd wymaga powłoki; npx-cli.js obok node.exe jej nie wymaga.
  const cli = join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npx-cli.js')
  if (existsSync(cli)) return spawnSync(process.execPath, [cli, ...args], options)
  const quoted = args.map((a) => (/[\s"&|<>^]/.test(a) ? `"${a.replace(/"/g, '""')}"` : a))
  return spawnSync('npx.cmd', quoted, { ...options, shell: true })
}

export function feedback(result) {
  if (!result || typeof result.code !== 'number') return { exit: 0 }
  if (result.code !== 0) {
    return { exit: 2, stderr: `trainctl check: ${PLAN} has problems after this edit — show them to the user before going on:\n${result.output}\n` }
  }
  if ((result.data?.warnings ?? 0) > 0) {
    return {
      exit: 0,
      stdout: JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PostToolUse',
          additionalContext: `trainctl check after this edit of ${PLAN} (warnings carry FOUNDATIONS rule IDs worth relaying):\n${result.output}`,
        },
      }),
    }
  }
  return { exit: 0 }
}

async function main() {
  let input = ''
  for await (const chunk of process.stdin) input += chunk
  let event
  try {
    event = JSON.parse(input)
  } catch {
    return 0
  }
  const dir = trainingDirOf(event?.tool_input?.file_path)
  if (!dir) return 0
  // TRAINCTL_PLUGIN_CLI: ścieżka do lokalnej binarki (np. packages/cli/src/bin.ts) —
  // do pracy nad pluginem przez --plugin-dir, zanim wersja trafi do rejestru.
  const local = process.env.TRAINCTL_PLUGIN_CLI
  const args = ['check', '--json', '-C', dir]
  const run = local
    ? spawnSync(process.execPath, [local, ...args], { encoding: 'utf-8', env: { ...process.env, NO_COLOR: '1' }, timeout: 110_000, windowsHide: true })
    : npx(['-y', `trainctl@${TRAINCTL_VERSION}`, ...args])
  let result
  try {
    result = JSON.parse(run.stdout)
  } catch {
    return 0 // check się nie uruchomił (sieć, npx) — nie blokujemy edycji
  }
  const out = feedback(result)
  if (out.stderr) process.stderr.write(out.stderr)
  if (out.stdout) process.stdout.write(out.stdout)
  return out.exit
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  process.exitCode = await main()
}
