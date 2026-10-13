# T-307 — A medic walks to a patient that has its attacker beside it

**Source:** T-301, T-211 and [`../../reports/audits/2026-10-12-bleeding-patients-and-the-duty-guard.md`](../../reports/audits/2026-10-12-bleeding-patients-and-the-duty-guard.md) (link 7) · **Size:** M · **Needs:** — · **Status:** open (diagnosis first)

## Why

Care continues under a `hearth` alert (17 § Patients and hospitals), and "a hostile near the patient keeps the medic away by the ordinary `flee` rule". The `flee` rule works on a hostile the medic itself has within `THREAT_RADIUS`, and 11 keeps a job from a civilian only for a hostile that civilian remembers. A medic that has not seen the animal walks to the patient, comes within the animal's reach, is bitten and is the next patient. The next medic follows.

In the annual seed `wildlife-temperate_forest-2` with T-211's patch, a wolf wounds a hauler at tick 74,907. Four dwarves claim its four treatment jobs and walk toward it. The hauler dies at 75,122. The wolf turns on the nearest medic at 75,163, and that one dies at 75,357 with four new medics on the way. Eight die by day 85 ([trace](../../reports/data/2026-10-12-t211-forest-2-wolf-trace.txt)). Three soldiers stand on duty at the wagon through it, 22 tiles away.

This is the likely reason that T-301's fixes, T-305, T-306 and T-211 do not pass the annual guards: each makes a medic more likely to set out, or to set out sooner. It is shown in one seed; step 1 below measures it over the twelve.

## What to do

1. Measure how many of the dwarf deaths of the twelve-seed row are a medic or a carrier wounded within `THREAT_RADIUS` of its patient while it holds the patient's job. The per-seed rows already name every death; a probe adds the job each victim held.
2. The rule to try first: 11 offers a job for a patient (`isPatientCare`) to nobody while a creature hostile to the patient (16 `isHostile`: it holds a fortress creature as its target, or is a wild animal in `attack`) is within `THREAT_RADIUS` of the patient on its level, and a worker that holds such a job is interrupted when one comes that near. The patient is treated when the animal has left or the squad has killed it. Fold into 17 § Patients and hospitals (the last bullet), 11 § Assignment step 1 and 10 § Behavior selection step 2.
3. Find why the three soldiers do not move: the fixture's response gives the squad a kill order only for some threats.
4. Re-run the twelve-seed instrument. Then T-301's commit, T-305, T-306 and T-211 in turn, each with its own row.

## Measured so far, 2026-10-13

The rule of step 2 was written with a stepped test that fails without it, on top of T-301's commit `a88d3cd`, and taken out again ([patch and test](../../reports/data/2026-10-13-t307-endangered-patient.patch.txt)):

- `defence_year`: six dwarves bleed to death by day 35 (three on `a88d3cd`, one on `28e2eab`). The first dies on day 5 unbandaged: the boar stays within `THREAT_RADIUS` of it in `attack`, so nobody is sent. On `a88d3cd` the same dwarf was bandaged 365 ticks after admission.
- Twelve-seed instrument: 13 / 0 / 0 / 8 of 12 / 2 / 0, rejected ([rows](../../reports/data/2026-10-13-t307-endangered-patient-wildlife.json)). Taiga seed 2 goes extinct, forest seed 4 goes from 12 living to 9, forest seed 2 from 6 to 9. The sum of the living is 126 (133 on `a88d3cd`, 135 on `28e2eab`).

So the rule as stated is not the answer: an animal that stays beside its victim keeps the medic away until the victim is dead. Step 1 (the measurement over the twelve seeds) was not done and comes first. A rule to weigh after it: the squad's kill order, not the medic, is what goes to a patient with its attacker beside it.

## Done

- A medic does not walk into the reach of the animal that wounded its patient, with a stepped test that names T-307.
- The twelve-seed instrument accepts the row.
