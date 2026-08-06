/**
 * Test właściwej pętli interaktywnej — na sztucznym terminalu.
 * Bez tego testowalibyśmy tylko czyste funkcje pomocnicze, a błąd w obsłudze
 * klawiszy albo w sprzątaniu trybu raw wyszedłby dopiero u użytkownika.
 */
import { EventEmitter } from 'node:events'
import { describe, expect, it } from 'vitest'
import { ui } from '../i18n/index.ts'
import { select, type Choice } from './select.ts'
import { Theme } from './theme.ts'

class FakeStdin extends EventEmitter {
  isTTY = true
  isRaw = false
  rawModeCalls: boolean[] = []
  resumed = 0
  paused = 0
  setRawMode(value: boolean) {
    this.isRaw = value
    this.rawModeCalls.push(value)
    return this
  }
  resume() {
    this.resumed++
    return this
  }
  pause() {
    this.paused++
    return this
  }
  press(name: string, extra: Record<string, unknown> = {}) {
    this.emit('keypress', '', { name, ...extra })
  }
  type(sequence: string) {
    this.emit('keypress', sequence, { sequence })
  }
}

class FakeStdout {
  isTTY = true
  columns = 80
  chunks: string[] = []
  write(chunk: string) {
    this.chunks.push(chunk)
    return true
  }
  get text() {
    return this.chunks.join('')
  }
}

const theme = new Theme({ color: false, unicode: true, width: 80 })
const choices: Choice<string>[] = [
  { label: 'WT 08-04', value: 'wt', hint: 'interwały' },
  { label: 'ŚR 08-05', value: 'sr', hint: 'spokojne' },
  { label: 'ND 08-09', value: 'nd', hint: 'START', disabled: true },
]

function run(keys: (stdin: FakeStdin) => void) {
  const stdin = new FakeStdin()
  const stdout = new FakeStdout()
  const promise = select(
    'Który trening przesunąć?',
    choices,
    theme,
    stdin as unknown as NodeJS.ReadStream,
    stdout as unknown as NodeJS.WriteStream,
  )
  setImmediate(() => keys(stdin))
  return { promise, stdin, stdout }
}

describe('select — pętla interaktywna', () => {
  it('Enter wybiera pierwszą pozycję', async () => {
    const { promise, stdin } = run((s) => s.press('return'))
    await expect(promise).resolves.toBe('wt')
    void stdin
  })

  it('strzałka w dół przesuwa zaznaczenie', async () => {
    const { promise } = run((s) => {
      s.press('down')
      s.press('return')
    })
    await expect(promise).resolves.toBe('sr')
  })

  it('pomija pozycję zablokowaną (dzień startu) przy nawigacji', async () => {
    const { promise } = run((s) => {
      s.press('down') // -> ŚR
      s.press('down') // ND zablokowane -> wraca na WT
      s.press('return')
    })
    await expect(promise).resolves.toBe('wt')
  })

  it('cyfra wybiera pozycję natychmiast', async () => {
    const { promise } = run((s) => s.type('2'))
    await expect(promise).resolves.toBe('sr')
  })

  it('cyfra wskazująca pozycję zablokowaną jest ignorowana', async () => {
    const { promise } = run((s) => {
      s.type('3')
      s.press('return')
    })
    await expect(promise).resolves.toBe('wt')
  })

  it('Esc anuluje bez wyniku', async () => {
    const { promise } = run((s) => s.press('escape'))
    await expect(promise).resolves.toBeUndefined()
  })

  it('Ctrl+C anuluje', async () => {
    const { promise } = run((s) => s.press('c', { ctrl: true }))
    await expect(promise).resolves.toBeUndefined()
  })

  it('przywraca tryb terminala i zdejmuje nasłuch po zakończeniu', async () => {
    const { promise, stdin } = run((s) => s.press('return'))
    await promise
    expect(stdin.rawModeCalls[0]).toBe(true)
    expect(stdin.rawModeCalls.at(-1)).toBe(false)
    expect(stdin.listenerCount('keypress')).toBe(0)
    expect(stdin.paused).toBeGreaterThan(0)
  })

  it('rysuje tytuł, wszystkie pozycje i podpowiedź o klawiszach', async () => {
    const { promise, stdout } = run((s) => s.press('return'))
    await promise
    expect(stdout.text).toContain('Który trening przesunąć?')
    expect(stdout.text).toContain('WT 08-04')
    expect(stdout.text).toContain('ND 08-09')
    // stopka pochodzi z katalogu — test sprawdza, że w ogóle jest, nie jej brzmienie
    expect(stdout.text).toContain(ui().picker.selectKeys.trim())
  })

  it('lista bez dostępnych pozycji kończy się od razu', async () => {
    const stdin = new FakeStdin()
    const stdout = new FakeStdout()
    const result = await select(
      'pusto',
      [{ label: 'x', value: 'x', disabled: true }],
      theme,
      stdin as unknown as NodeJS.ReadStream,
      stdout as unknown as NodeJS.WriteStream,
    )
    expect(result).toBeUndefined()
    expect(stdin.rawModeCalls).toHaveLength(0)
  })
})
