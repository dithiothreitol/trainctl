# Activity files instead of a hub

`trainctl-sync-files` reads the files your watch or platform exports and turns
them into the same execution data `pull` gets from intervals.icu. Nothing leaves
your disk, and no account is needed.

```bash
trainctl pull --from ./activities          # a folder (searched recursively) or a single file
```

Or once, in `trainctl.yaml`, so `review` and `pull` use it whenever there is no
intervals.icu key:

```yaml
sync:
  files: ./activities
```

With a key configured, `review` still pulls from intervals.icu; `pull --from`
adds files at any time. Both end up in `sync.json`, merged by activity.

## Where the files come from

| source | how |
|---|---|
| Garmin Connect | activity → ⚙ → *Export Original* (`.fit`), or *Account → Export Your Data* for everything |
| Strava | *Settings → My Account → Download or Delete Your Account* — the archive's `activities/` folder holds `.fit.gz`, `.gpx.gz`, `.tcx.gz` |
| Coros, Polar, Suunto | each app's export of an activity as FIT, TCX or GPX |

The Strava archive is the way around the restriction described in
[intervalsicu.md](intervalsicu.md) §1.8.1: the hub cannot pass Strava data on,
but your own export can.

## What is read

- **FIT**: the `session` message (sport, start, distance, moving and elapsed
  time, heart rate, ascent), local date from the `activity` message's
  local timestamp; multisport files count only their running parts.
- **TCX**: laps (time, distance, heart rate), sport from the `Activity` element.
- **GPX**: track points — distance by haversine, moving time without pauses over
  60 s or below 0.5 m/s (engineering choices). Without a `type`, a pace between
  3:00 and 9:30 min/km counts as a run.

Running, trail running and treadmill sessions count as runs; everything else is
kept but not compared with the plan. Zones never come from these files — they
come from race results in `athlete.results`.

## Limits

- No wellness (sleep, resting heart rate) and no RPE: the files do not carry them.
  Log the effort with `trainctl log --rpe`.
- TCX and GPX carry UTC times; the local date uses this machine's time zone.
- Files that are not activities, are unreadable or larger than 50 MB are skipped
  and named in the output; the same activity exported twice counts once.
- `init` adds `activities/` to `.gitignore`. GPS tracks show where you live —
  keep them out of a repository you might publish.
