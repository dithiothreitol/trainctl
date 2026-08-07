## What this changes

<!-- One paragraph. If it changes what the engine plans, say what a plan looks
     like before and after. -->

## Checklist

- [ ] `pnpm check` passes (typecheck + tests)
- [ ] New behaviour has a test; a fixed bug has a test that failed before the fix
- [ ] Engine rules cite a FOUNDATIONS ID, or are marked in code as an
      engineering choice rather than a finding
- [ ] User-facing strings live in both catalogues (`cli-en.ts`, `cli-pl.ts`) —
      never inline in a handler
- [ ] No corpus data, personal data, API keys or real intervals.icu output
