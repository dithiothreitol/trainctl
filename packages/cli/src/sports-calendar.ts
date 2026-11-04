import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { sportMessages as msg, type SportsPlan } from 'trainctl-core'
import { sessionsToIcs, type CalendarRevision } from 'trainctl-export'
import { fingerprint, sessionText, writeTransaction } from './sports-store.ts'

interface CalendarState {
  schemaVersion: 1
  planId: string
  events: Record<string, CalendarRevision & { fingerprint: string }>
}
const STATE = 'plan/calendar.json'
const OUTPUT = 'export/plan.ics'
const MAX_SEQUENCE = 2147483647
const readOptional = (cwd: string, file: string): string | undefined => existsSync(join(cwd, file)) ? readFileSync(join(cwd, file), 'utf8') : undefined

function readState(raw: string | undefined, planId: string): CalendarState {
  if (raw === undefined) return { schemaVersion: 1, planId, events: {} }
  try {
    const state = JSON.parse(raw) as CalendarState
    if (state.schemaVersion !== 1 || typeof state.planId !== 'string' || !state.events || typeof state.events !== 'object' || Array.isArray(state.events)) throw new Error()
    for (const [id, event] of Object.entries(state.events)) {
      if (!/^[A-Za-z0-9_-]{1,181}$/.test(id) || !event || !/^[a-f0-9]{64}$/.test(event.fingerprint) || !Number.isInteger(event.sequence) || event.sequence < 0 || event.sequence > MAX_SEQUENCE || typeof event.updatedAt !== 'string' || new Date(event.updatedAt).toISOString() !== event.updatedAt) throw new Error()
    }
    return state.planId === planId ? state : { schemaVersion: 1, planId, events: {} }
  } catch { throw new Error(`${msg().invalid} ${STATE}`) }
}

/** Persist event revisions separately from the generated plan, including manual YAML edits. */
export function exportSportsCalendar(cwd: string, plan: SportsPlan): string {
  const raw = readOptional(cwd, STATE), planRaw = readOptional(cwd, 'plan/plan.yaml')
  const state = readState(raw, plan.id), now = new Date().toISOString()
  for (const [cancelled, sessions] of [[false, plan.sessions], [true, plan.archive]] as const) for (const session of sessions) {
    // Hash the actual serialized event, fixing revision fields to avoid self-triggered updates.
    const single = { ...plan, sessions: cancelled ? [] : [session], archive: cancelled ? [session] : [] }
    const digest = fingerprint(sessionsToIcs(single, sessionText, { [session.id]: { sequence: 0, updatedAt: '2000-01-01T00:00:00.000Z' } }))
    const previous = Object.hasOwn(state.events, session.id) ? state.events[session.id] : undefined
    if (previous?.fingerprint === digest) continue
    // The first persisted revision supersedes calendars exported by the old changes.length scheme.
    const sequence = previous ? previous.sequence + 1 : plan.changes.length + 2
    if (sequence > MAX_SEQUENCE) throw new Error(`${msg().invalid} ${STATE}: SEQUENCE`)
    state.events[session.id] = { fingerprint: digest, sequence, updatedAt: now }
  }
  const calendar = sessionsToIcs(plan, sessionText, state.events), json = JSON.stringify(state, null, 2) + '\n'
  if (raw !== json || readOptional(cwd, OUTPUT) !== calendar) writeTransaction(cwd, { [STATE]: json, [OUTPUT]: calendar }, () => {
    if (readOptional(cwd, STATE) !== raw || readOptional(cwd, 'plan/plan.yaml') !== planRaw) throw new Error(msg().calendarChanged)
  })
  return OUTPUT
}
