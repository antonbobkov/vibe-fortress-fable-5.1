# T-508 — Idle dwarves stand on the hall tile nearest the way in, and crowd it

**Closed:** 2026-11-05, in 2dbe2e95.

**Source:** T-482's seed probes on `three-years-p0-6` ([report](../../../reports/audits/2026-11-05-t482-pets-heap.md#the-crowd-watch), [output](../../../reports/data/2026-11-05-t482-seed-probes.txt)) · **Size:** S · **Needs:** — · **Status:** open

## Why

With the animals' pile gone (T-482), the hall tiles that stay crowded for days are crowded by dwarves. On `three-years-p0-6`, from day 340 to day 1,080, almost every 10-day look finds one tile (60272) holding a dog and 4 to 17 dwarves; `p2-7`'s longest crowded stretch is the same kind. The twenty-seed file still shows 5 of 20 seeds with a hall tile crowded over a day, the longest 23,220 ticks, worst 6.

The cause, read from the code: an idle dwarf's goal (`idleGoal` in `src/systems/dwarves/index.ts`) is the reachable hall tile nearest to it by Chebyshev distance, ties by the lowest index. Every dwarf who comes in by the same way gets the same tile, the first one inside the hall, and stands there. That tile is on the hall's main walking line, so the crowd slows everyone passing in or out (22 § Crowding), and the T-463 rule keeps a dog standing there too, since passers-by do not move it.

## What to do

1. Confirm with a probe that the crowded tile is the idle goal of the dwarves on it.
2. Spread idle dwarves as T-463 spreads animals (the hall tile with the fewest creatures on it or walking to it, among the nearest few), or let them stand anywhere in the hall off its doors; put the rule in 10 § Behavior selection.
3. Measure: the twenty-seed file's crowd watch, and the annual instrument by the T-308 rule (idle dwarves stand elsewhere, so the job timeline moves).

## Done

- No hall tile crowded for more than a day in the twenty-seed file, by dwarves or animals; the instrument passes.
