/**
 * Klient HTTP intervals.icu.
 * Autoryzacja: HTTP Basic, username to dosłowny string `API_KEY`, hasło = klucz
 * użytkownika (docs/integrations/intervalsicu.md §1.1). Model BYO-key (ADR-006).
 * `fetch` jest wstrzykiwany — testy jadą na nagranych odpowiedziach, bez sieci.
 */
import { messages } from 'trainctl-core'

export const BASE_URL = 'https://intervals.icu/api/v1'

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>

export interface ClientOptions {
  apiKey: string
  /** `0` = atleta powiązany z kluczem (udokumentowany skrót). */
  athleteId?: string
  baseUrl?: string
  fetch?: FetchLike
}

export class IntervalsIcuError extends Error {
  // UWAGA: bez „parameter properties" (readonly w sygnaturze konstruktora) —
  // natywny type-stripping Node ich nie obsługuje, a na nim stoi CLI/MCP.
  readonly status: number
  readonly body: string | undefined

  constructor(message: string, status: number, body?: string) {
    super(message)
    this.name = 'IntervalsIcuError'
    this.status = status
    this.body = body
  }
}

export class IntervalsIcuClient {
  private readonly apiKey: string
  private readonly baseUrl: string
  private readonly doFetch: FetchLike
  readonly athleteId: string

  constructor(opts: ClientOptions) {
    if (!opts.apiKey) throw new Error('Brak klucza API intervals.icu')
    this.apiKey = opts.apiKey
    this.athleteId = opts.athleteId ?? '0'
    this.baseUrl = opts.baseUrl ?? BASE_URL
    const injected = opts.fetch ?? globalThis.fetch
    if (!injected) throw new Error('Brak implementacji fetch')
    this.doFetch = injected
  }

  private authHeader(): string {
    return 'Basic ' + Buffer.from(`API_KEY:${this.apiKey}`).toString('base64')
  }

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`
    const res = await this.doFetch(url, {
      ...init,
      headers: {
        Authorization: this.authHeader(),
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      const hint =
        res.status === 401 || res.status === 403
          ? messages().syncError.badKey
          : res.status === 429
            ? messages().syncError.rateLimit
            : ''
      throw new IntervalsIcuError(
        `intervals.icu ${res.status} ${res.statusText}${hint}`,
        res.status,
        body.slice(0, 500),
      )
    }
    if (res.status === 204) return undefined as T
    return (await res.json()) as T
  }

  athletePath(suffix: string): string {
    return `/athlete/${this.athleteId}${suffix}`
  }
}
