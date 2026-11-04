/** Niezależny odczyt kalendarzy oraz zachowanie wyłącznie syntetycznych eksportów. */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import ICAL from 'ical.js'
import type { SportsPlan } from '../packages/core/src/index.ts'

export function verifySportsCalendar(raw: string, plan: SportsPlan) {
  const calendar = new ICAL.Component(ICAL.parse(raw))
  assert.equal(calendar.getFirstPropertyValue('version'), '2.0')
  const events = calendar.getAllSubcomponents('vevent').map(component => new ICAL.Event(component))
  const expected = [...plan.sessions, ...plan.archive]
  assert.deepEqual(events.map(e => e.uid).sort(), expected.map(s => `trainctl-${plan.id}-${s.id}@trainctl`).sort())
  assert.equal(new Set(events.map(e => e.uid)).size, events.length)
  for (const session of expected) {
    const event = events.find(e => e.uid === `trainctl-${plan.id}-${session.id}@trainctl`)!
    const cancelled = plan.archive.some(s => s.id === session.id)
    assert.equal(event.component.getFirstPropertyValue('status') === 'CANCELLED', cancelled)
    assert.equal(event.startDate.isDate, !session.start)
    assert.equal(event.startDate.toString(), session.start ? `${session.date}T${session.start}:00` : session.date)
    assert.equal(event.duration.toSeconds(), session.start ? Math.round(session.durationSec + session.preparationSec) : 86400)
    if (session.start) assert.equal(event.startDate.zone.tzid, 'floating')
    assert(Number.isInteger(event.sequence) && event.sequence >= 0)
    for (const field of ['dtstamp', 'last-modified']) {
      const stamp = event.component.getFirstPropertyValue(field)
      assert(stamp instanceof ICAL.Time)
      assert.equal(stamp.zone.tzid, 'UTC')
    }
  }
  return events
}

export function createAcceptanceBundle(root: string, enabled: boolean) {
  if (!enabled) return undefined
  const parent = join(root, 'artifacts')
  mkdirSync(parent, { recursive: true })
  const directory = mkdtempSync(join(parent, 'multisport-'))
  const files: { path: string; bytes: number; sha256: string }[] = []
  const calendars: { path: string; planId: string; active: number; cancelled: number; events: { uid: string; sequence: number; cancelled: boolean; start: string; end: string }[] }[] = []
  const workouts: { path: string; scenario: string; sessionId: string; sport: string; purpose: string }[] = []
  function save(path: string, data: string | Buffer) {
    const target = join(directory, path)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, data, { flag: 'wx' })
    const stored = readFileSync(target)
    assert(stored.equals(Buffer.from(data)))
    files.push({ path, bytes: stored.length, sha256: createHash('sha256').update(stored).digest('hex') })
  }
  return {
    directory,
    calendar(path: string, raw: string, plan: SportsPlan) {
      const events = verifySportsCalendar(raw, plan)
      save(path, raw)
      calendars.push({ path, planId: plan.id, active: plan.sessions.length, cancelled: plan.archive.length,
        events: events.map(e => ({ uid: e.uid, sequence: e.sequence, cancelled: e.component.getFirstPropertyValue('status') === 'CANCELLED', start: e.startDate.toString(), end: e.endDate.toString() })) })
    },
    exports(scenario: string, source: string, plan: SportsPlan) {
      save(`plans/${scenario}.json`, JSON.stringify(plan, null, 2) + '\n')
      for (const file of readdirSync(source).sort()) {
        if (!/\.(fit|html|ics)$/.test(file)) continue
        const path = `exports/${scenario}/${file}`
        save(path, readFileSync(join(source, file)))
        if (file.endsWith('.fit')) {
          const session = plan.sessions.find(s => `${s.id}.fit` === file)
          assert(session, file)
          workouts.push({ path, scenario, sessionId: session.id, sport: session.sport, purpose: session.purpose })
        }
      }
    },
    finish(result: object) {
      const examples = ['run', 'bike', 'swim'].map(sport => workouts.find(w => w.sport === sport && w.scenario === (sport === 'swim' ? 'duathlon' : 'migration') && w.purpose !== 'technique')!)
      assert(examples.every(Boolean))
      const readme = `# Próby odbiorowe multisport\n\nDane są syntetyczne. Pakiet służy do sprawdzenia importu, nie jest indywidualnym planem treningowym.\n\nAutomatyczna symulacja zakończyła się PASS. FIT odczytano przez Garmin FIT SDK, a ICS przez ICAL.js. Próby w aplikacji kalendarza i na fizycznym zegarku pozostają niewykonane.\n\n## Kalendarz\n\nUtwórz osobny kalendarz testowy. Zaimportuj kolejno pliki z jednej grupy: najpierw 01, potem 02, a w grupie calendar-lifecycle także 03. Po każdym kroku sprawdź aktualizację według UID, brak duplikatów oraz poniższe liczby zdarzeń. Sposób obsługi anulowań i ponownego importu zależy od klienta; zapisz zaobserwowany wynik. Grupy mają różne plany, więc testuj je oddzielnie. Godziny są lokalne bez strefy; anulowania zachowują termin oryginału.\n\n| Plik | Aktywne | Anulowane w pliku |\n| --- | ---: | ---: |\n${calendars.map(c => `| [${c.path}](${c.path}) | ${c.active} | ${c.cancelled} |`).join('\n')}\n\nPowtórz import ostatniego pliku i sprawdź, czy klient nie dubluje zdarzeń. W grupie calendar-lifecycle wpisy wycofane w 02 powinny powrócić w 03 z tym samym UID i wyższą wersją. Lista UID, wersji i terminów znajduje się w manifest.json.\n\n## Zegarek\n\nPrzykładowe pliki FIT do przeniesienia zgodnie z instrukcją urządzenia:\n\n${examples.map(w => `- ${w.sport}: [FIT](${w.path}), [źródłowy plan](plans/${w.scenario}.json), sesja \`${w.sessionId}\`.`).join('\n')}\n\nSprawdź rozpoznaną dyscyplinę, kolejność kroków, przerwy i powtórzenia, czas/dystans oraz cele zapisane w steps źródłowej sesji. W migrowanym biegu porównuj legacyWorkout (segments), który zachowuje pełną receptę biegową. Dla roweru sprawdź cel mocy, dla basenu długość i styl. Tempo pływania przy stylu jest opisowe. Otwarty cel nie powinien zmienić się w wymyślony cel liczbowy. Wystarczy obejrzeć strukturę treningu; pakiet nie wymaga jego fizycznego wykonania.\n\n## Zapis wyniku ręcznego\n\nUzupełnij manual-results.json: aplikację/urządzenie i wersję, datę, wynik oraz uwagi. Wartość pending oznacza brak potwierdzenia. report.json zawiera wynik automatycznej symulacji, manifest.json — listę plików i SHA-256.\n`
      save('README.md', readme)
      save('report.json', JSON.stringify(result, null, 2) + '\n')
      save('manual-results.json', JSON.stringify({ calendar: { status: 'pending', client: '', version: '', testedAt: '', notes: '' }, watch: { status: 'pending', device: '', version: '', testedAt: '', notes: '' } }, null, 2) + '\n')
      writeFileSync(join(directory, 'manifest.json'), JSON.stringify({ schemaVersion: 1, synthetic: true, result: 'PASS', files, calendars, workouts }, null, 2) + '\n', { flag: 'wx' })
    },
  }
}
