# Security policy

## Reporting

Report privately through GitHub:
[Security → Report a vulnerability](https://github.com/dithiothreitol/trainctl/security/advisories/new).
Please do not open a public issue for anything that exposes credentials or user
data.

This is a single-maintainer project, so there is no response-time guarantee.
You will get an acknowledgement, and the fix and the advisory will be public
once there is something to publish.

## Supported versions

The latest `0.x` release. Below 1.0.0 fixes go forward only — there are no
backports.

## What the tool touches

Worth knowing when you assess a finding:

- **One outbound host.** `https://intervals.icu/api/v1`, and only when you run
  `push`, `pull`, `review` or `init --from-intervals`. No telemetry, no
  analytics, no other network calls.
- **Your intervals.icu API key** comes from `TRAINCTL_INTERVALS_API_KEY`, a
  `.env` file, or `.trainctl-secret` — never from `trainctl.yaml`, which is
  meant to be committed. `trainctl init` adds both files to `.gitignore`, and
  the CLI warns on every run if a secret sits unprotected inside a git
  repository. Anything that defeats those checks, or that writes a key into a
  file meant to be committed, is a vulnerability worth reporting.
- **Everything else is local files** in the working directory: `trainctl.yaml`,
  `plan/`, `log.jsonl`, `sync.json`, `export/`. The tool writes them, reads
  them and does not send them anywhere.
- **Four runtime dependencies** across the published packages: `commander`,
  `yaml`, `@modelcontextprotocol/sdk`, `zod`. The published package carries
  both the compiled `dist/` and the TypeScript sources it was built from, so
  what you audit is what runs.

Training plans are not medical advice, and the engine deliberately refuses to
compute injury risk or readiness (see the README). Disagreement with a training
rule is an issue, not a security report.
