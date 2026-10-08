# T-122 — Civilians flee on their own level only, and starve in "Fighting" on a stair

**Source:** found by Codex while repairing the economy fortress for F-17, 2026-10-07 · **Size:** S–M · **Needs:** — · **Status:** open

## What was seen

In the three-year economy fortress, miners working a shaft that touched a cavern level died of thirst and hunger. The trace showed them standing on a narrow stair at the cavern level in the "Fighting" state. They did not take the stairs back to the hall, and they did not leave the state to eat or drink, until a need became lethal.

The evidence is in [the F-17 re-measure](../../reports/audits/2026-10-07-balance-after-f17.md) § Simulation findings: seed `three-years`, shaft `(31,15)`, z=21, miners `16777292` and `16777293` on one `StairsUpDown` tile with `activity=Fighting` on days 270 to 284, dead of starvation on days 285 and 288.

**The cause, read in code:** `findFleeTile` in `src/systems/dwarves/brain.ts` (about lines 79–106) scans eight horizontal rays and keeps the dwarf's own z. The `Fighting` branch (about lines 359–381) retries the same search. With no escape on the level it stays in combat and never serves a need. [`10-dwarves.md`](../02-systems/10-dwarves.md) (the `flee` rule) says a civilian paths away from the threat toward the hearth hall, which here needs the stair.

## What to do

1. Reproduce it in a small scenario test: a civilian on a stair tile at a level with no lateral escape, a hostile within the threat radius, and a hearth reachable by the stair.
2. Make fleeing use the path to the hearth (or the nearest safe tile by path), across levels, as the spec says. Check also why a critical need does not break the state.
3. Fix the code if the spec already says what should happen. If the spec is silent, decide: a civilian with no enemy in reach for N ticks leaves combat, and a critical need always interrupts a civilian's fight. Write the rule into the system spec.
4. Add the scenario as a regression test.

## Done

- The scenario test fails before the fix and passes after it.
- The spec states when a civilian leaves combat.
- The verification commands of [`../process/agent-workflow.md`](../process/agent-workflow.md) are green.
