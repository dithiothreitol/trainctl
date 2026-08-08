# trainctl-sync-intervalsicu

The [intervals.icu](https://intervals.icu) adapter for
[trainctl](https://www.npmjs.com/package/trainctl): planned sessions out to the
watch, completed activities and wellness back in.

- `toWorkoutSyntax` / `toPushableWorkout` — a planned session rendered in
  intervals.icu workout syntax, ready to sync to Garmin, Coros or Wahoo.
- Client and provider for activities and wellness, with an API key you pass in —
  never read from a committed file.
- Every entry the tool creates carries the `trainctl-` external-id prefix, and
  the cleanup path refuses to touch anything without it. Entries you wrote
  yourself stay yours.

**Activities that reach intervals.icu through Strava carry no data through its
API** (since December 2024). The adapter reports how many records were held
back and why, instead of pretending there were no runs.

Requires Node ≥ 22.18. Ships compiled JavaScript with type declarations. Depends only
on `trainctl-core`; HTTP goes through the platform `fetch`.

MIT · https://github.com/dithiothreitol/trainctl
