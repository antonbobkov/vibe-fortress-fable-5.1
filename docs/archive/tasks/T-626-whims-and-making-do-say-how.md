# T-626 — The Thane's whim, the pallet and the candle stand say how much and where from

**Closed:** 2026-11-19, in 447c70fe.

**Source:** [T-618's first-year audit](../../../reports/audits/2026-11-18-t618-first-year-ux.md), findings 21–24 · **Size:** S · **Needs:** — · **Status:** open

## Why

- **The whim** reads "The Thane wishes for fine meals for everyone: not yet". "Everyone" is 20 fine meals in the `whims` table; the line gives no count, no progress and no hint of the kitchen recipe. A new player cannot tell how close the fortress is or what to order.
- **The straw pallet** is listed as "Straw pallet 3 fibers (0)" in Build › Furniture while barley straw and reeds are in stock, and placing it says "0 fibers in stock: 1 will wait · build a farmer's workshop". The pallet takes fiber, straw or reed, and the pallet hint says "build one from cloth or straw". The list and the warning name the first alternative only (T-605 finding 19, for the pallet the hint recommends).
- **The candle stand** panel says "Candles: 0 of 5" and "No candle: dark", not that candles are ordered at a craftsdwarf's workshop from tallow or wax; Add order lists "○ Tallow candles" with no reason for the ○.
- **A planned workshop** reads as none: with a kitchen placed and not yet built, Add order says "Easy meal · no kitchen".

## What to do

1. The Thane line and the whim notes give the count and the progress: "The Thane wishes for 20 fine meals (3 in stock): not yet"; `dwarves.whim()` returns the count and the progress.
2. Build rows and the placement warning count every input alternative, as T-605 did for the waiting reasons, and name them ("3 fiber, straw or reed (14)").
3. The candle stand's "No candle" line says where candles come from: "No candle: dark. Order tallow or wax candles at a craftsdwarf's workshop."; Add order names the missing input of a `○` row ("· no tallow").
4. A recipe whose workshop is placed but not built reads "· kitchen not built yet".

Spec: 10 § The Thane's whim and 24 § Panels (Thane line); `ui-screens/fortress-screen.md` § Build tool; 14 § Candle stands; `ui-screens/panels.md` § Add order.

## Done

Tests for each line.
