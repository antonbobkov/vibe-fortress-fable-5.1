# T-468 — Runecraft 1: glowcap, the laboratory and rune vials

**Closed:** 2026-11-01, in e0cb7ece.

**Source:** runecraft [design](../../../reports/designs/2026-11-01-runecraft-magic-system.md) · **Size:** M · **Needs:** — · **Status:** open

The specification is [25 Runecraft](../../02-systems/25-runecraft.md). It governs, and this task needs only its sections named below. Everything marked for this task lands here and nothing else. Move this task's rows from 25 to the tables and schemas it names, and into its § Interfaces. Every number stays *unmeasured* unless this task measures it.

## What to do

25 §§ Glowcap, Workshops (`alchemist`, `alchemy`), Trade and value (the `extra` frame, seeds, glowstone).

## Decisions

- Glowcap is its own item, not `plant_food`: `plant_food` of any material is eaten and cooked.
- `quench_deepsilver` and `render_ichor` wait for T-476.
- Wild patches are converted by a separate pass on their own stream. The main terrain stream draws the same numbers.
- Caravan rows are `extra`, outside the weighted pool.

## Done

- A glowcap on a dark tile under a lamp grows. With the lamp removed, or on a lit tile, it does not. SetPlotCrop refuses it on a plot not wholly under lamps.
- Two glowcap make one vial at the laboratory, end to end through a dwarf.
- No dwarf eats a glowcap, and no kitchen takes one.
- Predicted `golden:`: the local-map hash moves for the converted shrubs, and the flat-test hashes for the grown skill arrays. Nothing else.
- The annual instrument runs once. Any move is explained, and none comes from the ordinary caravan goods.
