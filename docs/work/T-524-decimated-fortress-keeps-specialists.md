# T-524 — The three-year script keeps a decimated fortress's specialists on one labor

**Source:** T-488 (`reports/data/2026-11-07-t488-halls.txt`) · **Size:** S · **Needs:** — · **Status:** open

The script is `test/scenarios/three_years_economy.ts` (`checkEconomy`, `checkSpecialists`, `checkBrewer`); [testing-strategy.md](../process/testing-strategy.md) describes it.

## What was found

In `three-years-p2-4` at shift 50 raids cut the fortress from 11 dwarves to 2 by day 164. One of the two survivors was the fuel worker, dedicated to smelting alone with hauling off (T-362), and it did nothing for the last 180 days of the run: no job it could take (`hasWork` false at every sample). The specialists are chosen once the fortress has `SPECIALIST_MIN_POPULATION` (9) dwarves, and nothing gives their labors back when it falls below: `checkSpecialists` and the fuel and builder steps only return. The same holds for the brewer, and the fuel worker can be the brewer too (the fuel step skips the specialists but not `economy.brewer`), so one of them overrides the other's dedication.

## What to do

Decide when a player gives a specialist the general labors again (below `SPECIALIST_MIN_POPULATION`, or below a lower floor so a fortress hovering at nine does not flip each day), and do it for the fuel worker, the builder, the bench specialists and the brewer outside the squad's arming. Keep the brewer and the fuel worker different dwarves. Pin it with a unit test, and run the sweep: the change moves only fortresses that fall below the floor.
