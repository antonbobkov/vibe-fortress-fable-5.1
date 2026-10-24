# T-446 — Territorial animals make their home by the fortress

**Source:** T-427's sweep and T-421's diagnosis · **Size:** M · **Needs:** — · **Status:** open (measured together with T-427)

## Why

Twice now the deaths come from territorial animals that settle beside the fortress and attack any dwarf in their ground.

- **T-421:** boars made their home chunk by p0-2's gate and killed nine dwarves in year 3.
- **T-427:** with the leave fix, wild animals stay their full lifetime (42 days). The twenty-seed sweep's deaths rise from 122 to 208, wildlife deaths from 8 to 26 (boars 15, badgers 4), and the living at year 3 fall from 919 to 674. Four fortresses die out after year 1.
- Before T-427, many of these animals got stuck "leaving" and were harmless, which hid the problem.

A wild animal that defends its ground should not choose ground the dwarves already occupy. Real wildlife avoids a busy settlement.

## Decisions

1. **Choosing ground.** A territorial animal (temperament `territorial`, 08) does not choose a home chunk within `TERRITORY_AVOID_RADIUS` tiles of the fortress. The fortress is the wagon tile, any built building, and any zone.
2. **Moving off.** If its home comes within that radius later, because the fortress grows, it moves its home to the nearest qualifying chunk at its next think.
3. **Still dangerous.** A dwarf who walks into its ground away from the fortress is still attacked, as now. Woodcutters, hunters and gatherers still meet danger.
4. **Determinism.** Choose the new chunk deterministically: nearest first, ties by index. Make the radius a constant in 08, marked unmeasured, with a starting value of 24 tiles.
5. Write 08 § Wild behavior first.

## Done

- **Unit tests:**
  - a territorial animal spawned beside the wagon chooses a home outside the radius;
  - a building placed in its ground makes it move.
- **Measured together with T-427** (branch `sim`, on bff3bc9):
  - the annual instrument passes by the T-308 rule;
  - pp_defence passes 4 of 4;
  - the whole twenty-seed three_years_seeds file passes.
- **The target:** the sweep's dwarf deaths at or below about 140, and the living at year 3 at or above about 850, near the T-425 row of 122 and 919. Report the totals by cause.
