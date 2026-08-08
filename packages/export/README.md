# trainctl-export

Export formats for [trainctl](https://www.npmjs.com/package/trainctl) — the
plan leaving the terminal for a device, a calendar or a sheet of paper.

- `encodeWorkoutFit` / `toFitSteps` — `.fit` workout files for Garmin and
  compatible watches. Own encoder (~330 lines, no Garmin SDK), verified in
  tests byte by byte and confirmed by uploading generated files to an
  independent parser: step structure, repeat loops and pace targets all read
  back correctly.
- `toIcs` — `.ics` calendar entries for Google Calendar, Outlook or a phone.
- `toPrintableHtml` — an A4 sheet with a tick box per session.
- `toRacePackHtml`, `buildSplits`, `bandPoints` — race-day pack: split table, a
  paper pace band for your wrist, and a temperature correction table.

Hill repeats are exported **without** a pace target on purpose: uphill, a flat
pace is unreachable and the watch would alarm through the whole rep.

Requires Node ≥ 22.18. Ships compiled JavaScript with type declarations. Depends only
on `trainctl-core`.

MIT · https://github.com/dithiothreitol/trainctl
