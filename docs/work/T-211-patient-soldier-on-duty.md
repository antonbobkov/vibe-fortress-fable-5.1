# T-211 — A wounded soldier stays on duty instead of becoming a patient

## Progress, 2026-10-12, second measurement (still parked)

The parked patch has a fault of its own: `select` puts `patient` before `duty`, so a soldier admitted in the middle of a fight turns its back on the animal, and with no bed it stands where it is. A fifth case added to the patch's test file fails on the patch (`expected 'patient' to be 'duty'`). Decided, and to be folded into 10 § Behavior selection step 3 when this closes: a soldier on duty stays on duty while a hostile is in sight (step 5's definition) and takes `patient` on the first think after none is; the `duty` branch of `tickDwarf` checks this each tick for an admitted soldier, because the interrupt flag is spent during the fight.

With that rule, on top of T-301's chest fix, the twelve-seed instrument gives 13 / 3 / 0 / 8 of 12 / 1 / 0 (the patch alone: 13 / 0 / 0 / 8 of 12 / 2 / 0; before: 13 / 8 / 0 / 8 of 12 / 1 / 0). Extinctions are back to one; the second-worst bound of 8 still fails, on forest seed 2 (10 living to 3). In that seed the soldier that bled to death on day 47 is now treated and lives; the timeline then differs and a wolf pack kills eight civilians between days 63 and 85, each a medic that walked to the last patient (T-307). None of them is a soldier in `patient`. The hypothesis that this task fails because patients are not treated does not hold for the annual fixture, which has no hospital: [report](../../reports/audits/2026-10-12-bleeding-patients-and-the-duty-guard.md) § T-211.

The patch with the rule and the five-case test file are in [`2026-10-12-t211-fight-rule.patch.txt`](../../reports/data/2026-10-12-t211-fight-rule.patch.txt); the stash is unchanged. Next: T-307, then measure this patch again. Keep both guards.

## Progress, 2026-10-12 (parked)

The decided admission/discharge subscriptions and interrupt flags are implemented
with four failing-first stepped regressions. The focused 54 cases and six static
checks pass; the whole browser suite passes 25, with an identical full-year end
state (seven living, hash a4b660f007544cc3). The twelve-seed instrument rejects
the change: median 13, second-worst 9 -> 0, minimum 0, wildlife-free 8/12,
extinctions 1 -> 2, need deaths 0. The second-worst floor 8 and extinction cap 1
both fail. Forest seed 2 newly goes extinct at tick 132000, and a read-only repeat
confirms the same hash 99c66ca376dbd8e2. No fixture tune or guard change was made.

Patch and four regressions are preserved in stash `e1a3c9b2a35f2a6262b6190a5aa4855969740956`
(`T-211 decided admission interrupt; parked on annual second-worst/extinction guards`).
[Measurement and repeat evidence](../../reports/audits/2026-10-12-patient-duty-guard-blocker.md)
records the twelve rows and observed clinical transitions. This task remains open.
Next: resolve the annual acceptance blocker or re-measure this exact decided patch
after another accepted change that affects the failing cohort; keep both guards.


**Source:** T-196 and [`2026-10-10-wild-animals-and-civilians.md`](../../reports/audits/2026-10-10-wild-animals-and-civilians.md) · **Size:** S · **Needs:** — · **Status:** open

## Why

In a T-196 trace (the chain probe's `react` mode, badger, seed `s3`), a soldier took five badger bites at tick 745–793. The badger died at 807. The soldier was a patient from 746 (17 admitted it) but kept the `duty` behaviour, standing where the fight ended, until about tick 1025, when something else made it reselect. It bled to death at 1232 (one treatment had failed on a skill-0 medic). The treatment jobs reach a patient wherever it stands, so this did not stop the treatment, but a soldier that should be resting in a hospital bed stands on the battlefield.

## Reproduction

The trace probe of T-196 (`reports/data/2026-10-10-t196-probe-trace.test.ts.txt`, defaults badger and `s3`; in words: two soldiers with a kill order on a badger that bites one of them, alert `watchful`, then step after the badger dies and read the soldier's `Brain.behavior` and `C.Patient`).

## What the spec says

10 § Behavior selection puts `patient` (step 3) before `duty` (step 5), and 10 § Interfaces lists `PatientAdmitted` and `PatientDischarged` among the events it consumes. The code does not subscribe to `PatientAdmitted` (`src/systems/dwarves/index.ts`, the `subscribes` list), and the `duty` branch of `tickDwarf` reselects only for a civilian.

## What to do

What T-134 changed for this task: squad code (`stepSquads` in `src/systems/combat/squads.ts`, and a `kill` `SquadOrder`) now skips a member whose brain behavior is `need`, `flee`, `retreat` or `patient` before its kill-order step, so a soldier in `patient` is no longer given its squad's kill target or walked toward it. It does not make a soldier in `duty` reselect on admission: that is still this task. In `select()` the `patient` step still comes before the duty branch, which T-134 changed only in what holds a want back.

On `PatientAdmitted` (and `PatientDischarged`) set the dwarf's interrupt flag so the next think reselects; check that a soldier on duty then takes `patient` while its squad has no fight in sight, and returns to duty on discharge. T-134 has rewritten the same branch.

## Done

- A soldier admitted as a patient after a fight goes to a hospital bed within a few ticks, with a test that names T-211.
- 10's Interfaces and the code agree on the consumed events.
