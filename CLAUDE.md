# trainctl — notes for coding agents

Read [CONTRIBUTING.md](CONTRIBUTING.md) first; decisions live in the ADR table
of [SPEC.md](SPEC.md) §10–§11, rule IDs in
[docs/science/FOUNDATIONS.md](docs/science/FOUNDATIONS.md) §10. The current
work plan is [docs/PLAN-v0.4.md](docs/PLAN-v0.4.md).

Gate before every commit: `pnpm check` (typecheck of all packages + vitest).

Rules that break things when ignored:

1. **Native type stripping (Node ≥ 22.18).** Relative imports end in `.ts`;
   no parameter properties, enums or namespaces. The repo has no build step;
   `pnpm build` only emits `dist/` for publishing (ADR-026).
2. **Handlers return blocks, not colours.** Command handlers in
   `packages/cli/src/commands.ts` return semantic blocks (`ui/blocks.ts`) and
   `data`; only `bin.ts` renders ANSI. MCP must never receive `\x1b[`.
3. **Both languages, always.** User-facing text goes to the catalogues
   (`packages/cli/src/i18n/cli-en.ts` is the type source, `cli-pl.ts` follows;
   domain text in `packages/core/src/i18n/`). `cli-i18n.test.ts` and
   `no-leaks.test.ts` enforce it.
4. **Every engine constant cites a FOUNDATIONS rule ID** or is commented as an
   engineering choice. The engine proposes, it never silently rewrites a plan
   (ADR-011, ADR-029).
5. **Secrets and personal data never enter the repo**: no API keys, no corpus
   files, no real activity files or `init --from-intervals` output in fixtures.
   Remote deletes only touch entries prefixed `trainctl-` (ADR-016).

Comments and commit messages are written in Polish (Conventional Commits);
README and package descriptions in English, with `README.pl.md` kept in step.
