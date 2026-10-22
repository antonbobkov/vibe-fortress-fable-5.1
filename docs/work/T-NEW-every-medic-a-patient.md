# T-NEW — A fortress whose medics are all patients gets no care

**Source:** [p4-2 dies in year 1](../../reports/audits/2026-10-22-p4-2-year-one.md) (the T-113 gate on `ab4d40e`) · **Size:** M · **Needs:** — · **Status:** open

## Why

In `three-years-p4-2` (peril 4), a fire between days 36.8 and 38.8 gives 58 to 64 light burns to 9 of the 11 dwarves, among them all five with the medicine labor. A burn that is not dressed makes a dwarf a patient. A patient rests and works no job, so for five days nobody dresses or cleans a burn. Each dwarf carries 5 to 11 light burns, and each one rolls `INFECTION_PERMILLE` a day, so 5 to 8 of the 9 are infected by day 60 and 4 to 6 die of it. The weakened fortress then falls to the raid of day 67. Whether two or three dwarves are left at day 112, or none, turns on the rolls, so the year-1 assertion of `three_years_seeds` flips with timeline-only changes (dead before T-405 and through T-411, alive at T-413 and T-414, dead at T-415).

Two rules combine:
- **A light wound admits a dwarf and takes it off work** when it is a burn (an undressed burn of any severity) or bleeds, so a fire or a fight that touches every medic leaves none to treat.
- **Infection rolls per wound,** so a dwarf with ten light burns is infected in a day or two, where one with one serious wound has ten days.

## To decide

The smallest rule that gets care to a fortress whose every medic is wounded, without undoing T-405 to T-415. Candidates, to be measured on p4-2 and the wound ward before choosing:
- a light burn (or any light wound that does not bleed) admits no patient, as a light bruise does not, and is dressed and cleaned in passing;
- a conscious patient with the medicine labor treats others (or itself, with T-418) while it waits in bed;
- one infection roll a day per dwarf, not per wound.

Keep `INFECTION_PERMILLE`, `INFECTION_DEATH_PERMILLE` and the wound table unless the measurement says otherwise.

## Done

- The rule is in 17 and pinned by a unit test (a fire burns every medic, and the burns are dressed within a day).
- p4-2 and the other peril-4 seeds of `three_years_seeds` are alive at year 1. The wound ward (`reports/data/2026-10-21-wound-recovery.probe.ts.txt`) and the annual wildlife instrument are re-run with before and after rows.
