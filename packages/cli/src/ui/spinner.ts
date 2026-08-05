/** Spinner dla operacji sieciowych. Cichy poza TTY (potok, agent, CI). */
import { Theme } from './theme.ts'

const FRAMES_UNICODE = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
const FRAMES_ASCII = ['|', '/', '-', '\\']

export interface Spinner {
  stop(): void
}

export function startSpinner(
  label: string,
  theme = new Theme(),
  stream: NodeJS.WriteStream = process.stderr,
): Spinner {
  if (!theme.caps.color || !stream.isTTY) {
    return { stop: () => {} }
  }
  const frames = theme.caps.unicode ? FRAMES_UNICODE : FRAMES_ASCII
  let i = 0
  const timer = setInterval(() => {
    stream.write(`\r${theme.color(frames[i % frames.length]!, 'brand')} ${theme.dim(label)}`)
    i++
  }, 80)
  timer.unref?.()
  return {
    stop: () => {
      clearInterval(timer)
      stream.write(`\r${' '.repeat(label.length + 4)}\r`)
    },
  }
}

/** Uruchamia operację ze spinnerem; zawsze go sprząta. */
export async function withSpinner<T>(label: string, fn: () => Promise<T>, theme = new Theme()): Promise<T> {
  const spinner = startSpinner(label, theme)
  try {
    return await fn()
  } finally {
    spinner.stop()
  }
}
