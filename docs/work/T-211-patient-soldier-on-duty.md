# T-211 — A wounded soldier stays on duty instead of becoming a patient

**Source:** T-196 and [`2026-10-10-wild-animals-and-civilians.md`](../../reports/audits/2026-10-10-wild-animals-and-civilians.md) · **Size:** S · **Needs:** T-134 (it changes the same `select()` and the duty branch) · **Status:** open

## Why

In a T-196 trace (the chain probe's `react` mode, badger, seed `s3`), a soldier took five badger bites at tick 745–793. The badger died at 807. The soldier was a patient from 746 (17 admitted it) but kept the `duty` behaviour, standing where the fight ended, until about tick 1025, when something else made it reselect. It bled to death at 1232 (one treatment had failed on a skill-0 medic). The treatment jobs reach a patient wherever it stands, so this did not stop the treatment, but a soldier that should be resting in a hospital bed stands on the battlefield.

## Reproduction

The trace probe of T-196 (`reports/data/2026-10-10-t196-probe-trace.test.ts.txt`, defaults badger and `s3`; in words: two soldiers with a kill order on a badger that bites one of them, alert `watchful`, then step after the badger dies and read the soldier's `Brain.behavior` and `C.Patient`).

## What the spec says

10 § Behavior selection puts `patient` (step 3) before `duty` (step 5), and 10 § Interfaces lists `PatientAdmitted` and `PatientDischarged` among the events it consumes. The code does not subscribe to `PatientAdmitted` (`src/systems/dwarves/index.ts`, the `subscribes` list), and the `duty` branch of `tickDwarf` reselects only for a civilian.

## What to do

What T-134 changed for this task: squad code (`stepSquads` in `src/systems/combat/squads.ts`, and a `kill` `SquadOrder`) now skips a member whose brain behavior is `need`, `flee`, `retreat` or `patient` before its kill-order step, so a soldier in `patient` is no longer given its squad's kill target or walked toward it. It does not make a soldier in `duty` reselect on admission: that is still this task. In `select()` the `patient` step still comes before the duty branch, which T-134 changed only in what holds a want back.

On `PatientAdmitted` (and `PatientDischarged`) set the dwarf's interrupt flag so the next think reselects; check that a soldier on duty then takes `patient` while its squad has no fight in sight, and returns to duty on discharge. Do it after T-134, which rewrites the same branch.

## Done

- A soldier admitted as a patient after a fight goes to a hospital bed within a few ticks, with a test that names T-211.
- 10's Interfaces and the code agree on the consumed events.
