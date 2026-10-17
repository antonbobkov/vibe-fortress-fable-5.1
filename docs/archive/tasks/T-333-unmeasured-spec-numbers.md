# T-333 — Mark the spec numbers nobody has measured

**Closed:** 2026-10-17, in 3615046, 2ba5792, f201571.

**Source:** the process review, [`../../reports/audits/2026-10-15-process-review.md`](../../../reports/audits/2026-10-15-process-review.md) · **Size:** M · **Needs:** — · **Status:** open

## Why

22 of the 124 counted bugs were faults in the spec itself, and some of its numbers had never been measured; the pasture capacity was off by eight times (T-210) (process review § 1).

## What to do

- Read the tuning tables and numeric rules of `docs/02-systems/` and `docs/03-content/balance.md`. For each number, find whether a report under `reports/audits/` or a test measured it in the game.
- Mark each unmeasured one *unmeasured*, as `agent-workflow.md` § Working says, and list them in a dated report under `reports/audits/`, ranked by how much play depends on them.
- Write a work file for the measurement of each of the top five.

## Done

- Every unmeasured number in the tuning tables is marked; the report lists them; five measurement tasks exist.
