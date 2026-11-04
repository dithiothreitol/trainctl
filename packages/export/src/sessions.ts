import { addDays, sportMessages, type SportsPlan, type TrainingSession } from 'trainctl-core'
import { escapeIcs, foldLine } from './ics.ts'
const escapeHtml = (s: string): string => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
function groupText(plan: SportsPlan, session: TrainingSession): string {
  const group=plan.groups.find(g=>g.id===session.groupId)
  if (!group) return ''
  const index=group.sessionIds.indexOf(session.id)
  const seconds=index<group.sessionIds.length-1 ? group.transitionsSec?.[index] ?? group.transitionSec/(group.sessionIds.length-1) : 0
  return `${group.id}${seconds ? ` · ${sportMessages().transitions}: T${index+1}=${seconds}` : ''}`
}
function timing(session: TrainingSession): string[] {
  const compact = session.date.replaceAll('-', '')
  return session.start
    ? [`DTSTART:${compact}T${session.start.replace(':', '')}00`, `DURATION:PT${Math.round(session.durationSec + session.preparationSec)}S`]
    : [`DTSTART;VALUE=DATE:${compact}`, `DTEND;VALUE=DATE:${addDays(session.date, 1).replaceAll('-', '')}`]
}
export interface CalendarRevision { sequence: number; updatedAt: string }
export function sessionsToIcs(plan: SportsPlan, describe: (s: TrainingSession) => string, revisions: Readonly<Record<string, CalendarRevision>> = {}): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//trainctl//sessions-v2//EN', 'CALSCALE:GREGORIAN']
  const version = (id: string, cancelled = false): string[] => {
    const revision = Object.hasOwn(revisions, id) ? revisions[id] : undefined
    const stamp = revision ? revision.updatedAt.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z') : `${plan.generatedAt.replaceAll('-', '')}T000000Z`
    return [`DTSTAMP:${stamp}`, `LAST-MODIFIED:${stamp}`, `SEQUENCE:${revision?.sequence ?? plan.changes.length + (cancelled ? 1 : 0)}`]
  }
  for (const s of plan.sessions) {
    lines.push('BEGIN:VEVENT', `UID:trainctl-${plan.id}-${s.id}@trainctl`, ...version(s.id),
      ...timing(s),
      `SUMMARY:${escapeIcs(`${sportMessages().sport[s.sport]}: ${plan.goal.name}`)}`, `DESCRIPTION:${escapeIcs(`${s.id}\n${describe(s)}${s.groupId ? `\n${groupText(plan,s)}` : ''}`)}`, 'END:VEVENT')
  }
  // Anulowanie zachowuje UID i termin oryginału; sposób ponownego importu zależy od kalendarza.
  for (const s of plan.archive) lines.push('BEGIN:VEVENT', `UID:trainctl-${plan.id}-${s.id}@trainctl`,
    ...version(s.id, true), ...timing(s),
    'STATUS:CANCELLED', `SUMMARY:${escapeIcs(s.id)}`, 'END:VEVENT')
  lines.push('END:VCALENDAR'); return lines.map(foldLine).join('\r\n') + '\r\n'
}
export function sessionsToHtml(plan: SportsPlan, describe: (s: TrainingSession) => string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(plan.goal.name)}</title><style>body{font:16px system-ui;max-width:1000px;margin:auto;padding:24px}article{padding:16px 0;border-bottom:1px solid #bbb}small{overflow-wrap:anywhere}p{white-space:pre-line;line-height:1.65}@media print{article{break-inside:avoid}}</style></head><body><h1>${escapeHtml(plan.goal.name)}</h1>${plan.sessions.map(s => `<article><h2>${s.date} ${s.start ?? ''} · ${escapeHtml(sportMessages().sport[s.sport])}</h2><p>${escapeHtml(describe(s))}</p>${s.groupId ? `<p>${escapeHtml(groupText(plan,s))}</p>` : ''}<small>${escapeHtml(s.id)}${s.replacesSessionId ? ` ← ${escapeHtml(s.replacesSessionId)}` : ''}</small></article>`).join('')}</body></html>`
}
