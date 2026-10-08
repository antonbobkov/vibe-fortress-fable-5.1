# T-141 — A hostile near the entrance stair traps civilians on it

**Source:** T-123 and its report, [`../../reports/audits/2026-10-08-economy-at-default-priority.md`](../../reports/audits/2026-10-08-economy-at-default-priority.md) (§ A hostile near the entrance stair traps civilians on it) · **Size:** S · **Needs:** — · **Status:** open

## Why

Seed `three-years`, rewritten fixture, day 124. A lone thief stands 5 to 6 tiles from the top of the entrance stair for 11 days. Every civilian who climbs to the surface is inside `THREAT_RADIUS`. It flees one step down the stair, forgets the threat because it is now on another level, selects its need again and climbs back. The loop repeats about every 50 ticks. Three to five dwarves are in it at any time. Food and drink are on the surface. One dwarf dies.

In the code (`src/systems/dwarves/brain.ts`):

- `findFleeTile` treats any tile on a level other than the threat's as safer (lines 83–84), so the nearest escape from a stair head is the stair itself.
- The `flee` branch treats a threat on another level as gone (lines 361–362) and clears it.
- Selection then starts the same need, with the same target beyond the threat.

`10` § Behavior selection step 1 says a threatened civilian paths "away from the threat toward the hearth hall". It does not say when the dwarf may come back.

## Decision

- **A civilian who fled remembers the hostile while it lives and stays near.** After a flee, the dwarf does not start a need or a job whose target lies within `THREAT_RADIUS` of that hostile's last seen tile, for as long as the hostile is alive and within `THREAT_RADIUS` of that tile. It serves what it can reach otherwise, or waits in the hearth hall.
- **A critical need overrides this**, as it already overrides a cornered fight. A dwarf does not starve behind a thief.
- **The escape goes to the hearth hall when one is reachable**, as the spec says, not to the first tile off the threat's level.

## What to do

1. Amend `10` § Behavior selection step 1 and its escape paragraph with the rules above. Amend `creature-brains.md` `select`.
2. Implement in `brain.ts`. The remembered hostile is already saved (`threatened`).
3. Scenario `dw_stair_threat_return`: a hall below a stair, food on the surface, a hostile held 5 tiles from the stair head. Assert that a hungry dwarf changes level at most twice in 500 ticks, and that it eats once hunger is critical.

## Done

- The scenario passes, with `describe('T-141 …')`.
- In the three-year run on seed `three-years` no dwarf is in `flee` for more than one day in a row.
