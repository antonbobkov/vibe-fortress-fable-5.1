# T-306 — An open bandage job waits until a worker finishes its own job

**Closed:** 2026-10-16, in ab4e774, 75d6352.

**Source:** T-301 and [`../../reports/audits/2026-10-12-bleeding-patients-and-the-duty-guard.md`](../../../reports/audits/2026-10-12-bleeding-patients-and-the-duty-guard.md) (link 6) · **Size:** S · **Needs:** — · **Status:** open

## Why

A worker asks 11 for a job only when it has none. `stop_bleeding` is priority 1, but a dwarf carrying planks to a building site finishes that first. In `defence_year` a patient was admitted at tick 24,838. Three workers with the medicine labor went on carrying inputs for a build and two crafts, with `jobs.hasUrgent(id, 1)` true for two of them. The bandage was claimed at tick 25,020 by a dwarf that had woken up. In T-301's trace the job stood open for 140 ticks in a calm fortress of eleven. A serious cut empties a dwarf in about 700 ticks.

## Decision

An open job for a patient at priority 1 (`stop_bleeding`, `carry_patient`) calls a worker. Each tick, before 11 answers its queue, for each such job that no free queued worker could take: among the workers to whom the job is open (11 § Assignment step 1), who are in `work` behavior at an interruptible job that is not itself for a patient, and who are neither soldiers on duty nor patients, the nearest to the patient is interrupted with its progress kept and queued, to be answered in the same tick. A worker eating, drinking or asleep is not called. The constant is `PATIENT_SUMMON_PRIORITY` = 1, in 11.

The rule as written (`JobBoard.summonForPatients`), the spec paragraphs for 11, 17 and `algorithms/jobs-and-hauling.md`, and a test that fails without it are in [`2026-10-12-t306-call-a-worker-to-a-patient.patch.txt`](../../../reports/data/2026-10-12-t306-call-a-worker-to-a-patient.patch.txt).

## Measured so far

With T-301's chest fix and this rule, `defence_year` had six dwarves bleed to death by day 35 where the run before had one. The rule was taken out again, and the twelve-seed instrument was not run with it. The medics it sends at once meet the animal that made the patient (T-307). Measure it after T-307.

## Done

- A worker at interruptible work takes an open bandage job within two ticks, with a test that names T-306.
- `defence_year` passes and the twelve-seed instrument accepts the row.
