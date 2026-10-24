# T-441 — Two-click rectangle designation, in 3D, and stair columns

**Source:** the owner, 2026-10-23 (first play session) · **Size:** M · **Needs:** — · **Status:** open

## Why

The owner wants designation by two clicks, not drag, with depth: dig several levels at once, and dig stairs down many levels in one order.

## Decisions

1. **Two clicks.** The first click (or Enter) sets the first corner. The cursor then shows the live rectangle. The second click (or Enter) sets the opposite corner and issues the designation. Escape cancels after the first corner. The keyboard and the mouse do the same thing.
2. **3D.** Between the two corners, the player may change z-level with the usual keys. The designation then covers the box from the first corner's level to the second's, every level in between. The preview shows the size, such as "3 × 4 × 5 levels", and the current level's slice.
3. **Stairs.** The same two-click box with the stair tool designates a stair column: the top level gets a down stair, the levels between get up/down stairs, and the bottom gets an up stair. So one order digs a shaft down ten levels. A 1×1 box is the common case.
4. **Drag.** The owner prefers clicks, so two clicks is the default. Drag may stay as an alternative only if the spec says so.
5. The command is the existing Designate with a box. If Designate takes only one level, extend the command (11 and 03). It stays deterministic.
6. Write the spec first: the designate panel doc and the hotkey table.

## Done

- Unit tests:
  - a two-click box issues one designation over all its tiles and levels;
  - Escape cancels;
  - a stair column has the right stair types at the top, middle and bottom.
- An e2e test that designates a 3-level room and a 10-level stair shaft by clicks, and the dwarves dig them.
- The gates pass.
