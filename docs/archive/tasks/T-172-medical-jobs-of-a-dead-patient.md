# T-172 — A dead patient's medical jobs are cancelled

Closed by `T-172: cancel jobs when their entity target is destroyed`.

**Source:** T-115 and its report, [`../../../reports/audits/2026-10-08-bug-hunt.md`](../../../reports/audits/2026-10-08-bug-hunt.md) (bug 13) · **Size:** S · **Needs:** — · **Status:** open

## Why

`stop_bleeding`, `feed_patient`, `water_patient`, `suture`, `clean_wound`, `diagnose` and `give_crutch` jobs stay open for ever when their patient dies. 17's `CreatureDied` handler clears its own tables and cancels nothing. The jobs panel lists them and the board keeps offering them.

## Reproduction

`raid.probe.ts` (saved with the report's data): `three-years-p4-1`, peril 4, 120 days. Patients die from day 58. On day 60, with six dwarves alive, 36 such jobs are open; on day 85 there are 78. In the long runs `job.target-dead` runs from tick 68,700 (peril 4) and 73,500 (peril 2) to the end of year 3.

## What to do

**Decision.** A job whose target entity is destroyed is cancelled by the board, whatever its producer, in the tick the entity goes: `JobCancelled { reason: 'target_gone' }`. That is one rule in 11 § The job record instead of one in each producer. 17 keeps nothing to do.

1. Amend 11 (a job with `target.kind` `entity`, `building` or `zone` ends when the target does).
2. Implement in `src/systems/jobs/board.ts` through the entity store's destroy listener or on `CreatureDied`, `BuildingRemoved` and `ZoneChanged`.
3. Tests, `describe('T-172 …')`: a bleeding dwarf with a hospital dies: no medical job remains. The deconstructed-workshop case of the report's "Suspected" list is the same rule; add it.

## Done

- The tests pass.
- `job.target-dead` is absent from the long runs.
