/**
 * Dokumentacja zgodna z kodem — uzgodnienie jako test, nie jako pamięć.
 *
 * Powód istnienia: 0.3.0 wyszło z README, które liczyło szesnaście narzędzi MCP
 * przy siedemnastu w kodzie i bez wiersza `shorten` w tabeli komend, a przykłady
 * CI nadal klonowały silnik sprzed publikacji na npm.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf-8')

const tools = [...read('packages/mcp/src/server.ts').matchAll(/registerTool\(\s*'(trainctl_[a-z_]+)'/g)].map((m) => m[1]!)
const commands = [...read('packages/cli/src/bin.ts').matchAll(/\.command\('([a-z]+)/g)].map((m) => m[1]!)

describe('README zna wszystkie narzędzia i komendy', () => {
  it('kod rejestruje narzędzia i komendy (sanity check wyrażeń)', () => {
    expect(tools.length).toBeGreaterThan(10)
    expect(commands).toContain('shorten')
  })

  for (const file of ['README.md', 'README.pl.md', 'packages/mcp/README.md']) {
    it(`${file}: każde narzędzie MCP jest wymienione`, () => {
      const text = read(file)
      expect(tools.filter((t) => !text.includes(`\`${t}\``))).toEqual([])
    })
  }

  for (const file of ['README.md', 'README.pl.md']) {
    it(`${file}: każda komenda ma wiersz w tabeli komend`, () => {
      const text = read(file)
      expect(commands.filter((c) => !text.includes(`| \`${c}\``))).toEqual([])
    })
  }
})

describe('przykłady w docs/examples używają opublikowanej paczki', () => {
  const files = readdirSync(join(ROOT, 'docs/examples')).filter((f) => f.endsWith('.md'))
  for (const file of files) {
    it(`${file}: bez klonowania silnika i bez Node 23`, () => {
      const text = read(`docs/examples/${file}`)
      expect(text).not.toContain('.trainctl-engine')
      expect(text).not.toMatch(/node-version:\s*'23'/)
    })
  }
})
