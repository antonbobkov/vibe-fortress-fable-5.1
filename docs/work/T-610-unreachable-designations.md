# T-610 — A designation no dwarf can reach says so when it is made

**Source:** [T-605's audit](../../reports/audits/2026-11-18-t605-first-hour-ux.md), findings 5 and 6 · **Size:** M · **Needs:** — · **Status:** open

## Why

Two first-hour designations wait for ever, and the player learns it only by opening Jobs:

- **A stair column with its top skipped.** A shaft drawn from a surface ramp tile down five levels says "Stairs: 5 designated, 1 skipped (1 ramp)." The ramp is skipped, so the column's top is a stair under solid ground with no way in; all five jobs are "no path" for ever.
- **A dig box that meets the rock only at a corner.** A 5 × 4 room drawn on a hillside whose box touches the face diagonally: a miner digs the corner tile from the diagonal, cannot walk into it, and the other 19 tiles wait "no path" while the miners stand idle ("I have nothing to do").

## Decisions

- **The status row warns when a new designation batch has no reachable start.** After a `Designate`, the tool checks, by the same reachability the jobs use (22's connectivity from a fortress dwarf), whether any tile of the batch can be worked now. If none can, the status row adds "· no dwarf can reach it yet: open a side or a stair above" and the line goes to the log as a note with the batch's first tile as focus.
- **A stair column whose top is skipped says why.** When the top tile of a multi-level stair box is skipped, the status row says "the top is a ramp: start the column a level lower or remove the ramp", in place of the bare count, whenever nothing above leads into the column.
- **The Jobs panel groups a blocked batch**: one line "Dig ×19 (59,51)–(63,53) no path" in place of nineteen rows, opening to the rows with `Enter`.
- No rule of 03 changes: a corner is still not a side.

## Spec sections

`02-systems/24-ui-and-input.md` § Input model (the designation box paragraph), `04-implementation/ui-screens/panels.md` § Jobs.

## Done

Unit tests for both cases (a corner-only dig box, a stair box topped by a ramp) find the warning on the status row; a test finds the grouped Jobs line. Designation e2e (`designate-by-drag`, `two-click-3d-designation`) pass.
