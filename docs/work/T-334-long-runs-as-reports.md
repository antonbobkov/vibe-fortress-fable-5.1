# T-334 — Long chaotic runs report their figures and assert only what no reordering can flip

**Source:** the process review, [`../../reports/audits/2026-10-15-process-review.md`](../../reports/audits/2026-10-15-process-review.md) · **Size:** S · **Needs:** — · **Status:** open; after the T-145 re-measure in worktree `sim`

## Why

Chaotic runs used as gates blocked correct fixes for days (T-137, T-261, T-211, T-301) (process review § 2). The rule is now in [`../process/testing-strategy.md`](../process/testing-strategy.md) § What may be a gate.

## What to do

- Go through the assertions of `test/e2e/full-year.spec.ts`, `test/perf/three_years_main.test.ts`, `test/perf/three_years_seeds.test.ts` and `test/perf/wildlife_year.test.ts`. Keep an assertion if its figure's noise is measured and the bound is wider, or if it is an invariant or an outcome no reordering of jobs can flip. Turn the others into printed figures in the run's report.
- Decide this for T-145's "no dwarf died": either measure its noise across seeds or make it a report figure, and update the T-145 work file to match.

## Done

- Each kept assertion has its reason in a comment; each removed one is printed instead; T-145's Done list matches.
