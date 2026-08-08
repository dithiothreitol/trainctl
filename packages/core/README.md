# trainctl-core

The engine behind [trainctl](https://www.npmjs.com/package/trainctl): a
deterministic running-plan generator. No LLM, no network, no files — pure
functions from an athlete profile and a race goal to a training plan.

```ts
import { vdotFromRace, paceZones, planMacrocycle, generateMicrocycle } from 'trainctl-core'

const vdot = vdotFromRace(21.0975, 5400)     // half marathon in 1:30
const zones = paceZones(vdot)
const macro = planMacrocycle({ today: '2026-08-05', goal, athlete })
const weeks = macro.weeks.map((skeleton) =>
  generateMicrocycle({ skeleton, athlete, zones, goal, testDistanceKm: 5 }),
)
```

Also exported: `predictRace` (a range, never a single number), `analyzeExecution`,
`reschedule` (the week re-solver), `planStrengthWeek`, `validatePlan` (the plan
lint), `planDeskDay`, heat correction, date utilities, and the English/Polish
message catalogues for domain text.

Every rule carries an ID from
[docs/science/FOUNDATIONS.md](https://github.com/dithiothreitol/trainctl/blob/main/docs/science/FOUNDATIONS.md)
(~60 sources); values with no source behind them are marked in the code as
engineering choices rather than dressed up as science. Session shapes come from
a corpus of 50 real coaching plans, which is not distributed.

Requires Node ≥ 22.18. Ships compiled JavaScript with type declarations, plus
the TypeScript sources and source maps. Zero runtime dependencies.

MIT · https://github.com/dithiothreitol/trainctl
