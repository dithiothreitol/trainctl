# trainctl-sync-files

Exported activity files for [trainctl](https://www.npmjs.com/package/trainctl):
compare what you ran with the plan, without an account anywhere.

- Reads `.fit`, `.tcx` and `.gpx` files and their `.gz` variants — what a Strava
  bulk export or a Garmin Connect export contains — from a directory (searched
  recursively) or a single file.
- `FileActivitySource` implements trainctl's `ActivitySource` port. It only
  reads: nothing is pushed anywhere, and activity files carry no wellness data.
- An activity's id is a hash of the file's content, so renaming a file or
  exporting the same activity twice gives one entry.
- A broken or foreign file never stops the scan. It is reported in `skipped`
  with a reason: `unreadable`, `not-an-activity` or `unsupported`.
- Multisport files count the running legs only.

```ts
import { FileActivitySource } from 'trainctl-sync-files'

const source = new FileActivitySource({ path: './activities' })
const september = await source.listActivities('2026-09-01', '2026-09-30')
console.log(source.lastSkipped)
```

**Dates.** FIT files record the device's UTC offset, so their local date is
exact. TCX and GPX files usually hold UTC times only (`…Z`); those are converted
with the time zone of the machine running trainctl. A run at 23:30 in Lisbon,
read on a machine set to Warsaw time, lands on the next day. Timestamps written
with an explicit non-zero offset are taken as written.

**GPX** has no summary, so distance (haversine), moving time (pauses over 60 s
and speeds under 0.5 m/s left out) and ascent (1 m noise threshold) come from
the track points. A track without a sport type counts as a run when its pace
falls between 3:00 and 9:30 min/km. These are engineering choices for comparing
execution with the plan; pace zones are never derived from activity files.

Activity files contain GPS tracks. Keep them out of public repositories.

Requires Node ≥ 22.18. Ships compiled JavaScript with type declarations. Depends
only on `trainctl-core`; the FIT decoder and the XML reading are built in.

MIT · https://github.com/dithiothreitol/trainctl
