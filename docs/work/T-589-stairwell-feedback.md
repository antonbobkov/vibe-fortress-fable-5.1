# T-589 — One Stairs tool that picks the stairs itself, and designations that take what they can

**Source:** the owner's playtest, 2026-11-17 · **Size:** M · **Needs:** — · **Status:** open

## Why

The owner could not dig stairs across several levels: the status row said "A stairwell needs its bottom on another level" although the two picks were on different levels. The designate panel had four stair tools (up stairs, down stairs, up/down stairs, stairwell), and which one to use where was not clear.

The cause: a stair box over several levels made one `DesignateStairwell` per column, and dropped a whole column when any discovered tile in it failed its precondition (a top that is a wall, a middle level already dug out). With every column dropped, the tool sent nothing and showed the one-level message. A press-drag-release on one level with the stairwell tool committed the box at once and failed the same way.

## Decisions

1. **One Stairs tool (`[w]`) replaces the four stair tools in the designate panel.** There is no advanced place for the old ones; the commands (`Designate` with a stair kind, `DesignateStairwell`) stay in the command layer for scripts and scenarios.
2. **The tool picks each tile's stairs.** Over several levels each tile of the box is a stair column: every level but the bottom must lead down, every level but the top must lead up, and an end of the column also leads toward a stair directly beyond it. A floor that must lead only down takes down stairs; a wall or floor that must lead only up takes up stairs; any other wall or floor takes up/down stairs; a stair that already leads every way needed is left alone; a natural stair that lacks a way is re-carved to up/down. A stair directly beyond an end that does not lead toward the column is re-carved to up/down. Undiscovered tiles are taken blind, as rock. On one level a floor or a stair takes a column to the level below (down stairs here, the matching stairs beneath); a wall takes up/down stairs and the stairs directly above and below it connect.
3. **03's transitions allow what the tool needs.** Up and up/down stairs may be cut into a `floor` (no drop, no mineral events); up/down stairs may be re-carved from a natural `stairs_up` or `stairs_down` (no drop). Constructed stairs are not re-carved. This can move the simulation only where a stair designation meets a floor or a stair, so the sweep runs.
4. **Best effort for every designation tool.** A box designates each tile that can take the designation and skips the rest, never a whole column. When tiles are skipped the status row says how many were designated and skipped and why, counted per tile kind ("Stairs: 14 designated, 3 skipped (3 already open)."). A box where nothing qualifies keeps its "No tile here …" line.
5. The UI sends stair designations as `Designate` commands, one per stair kind, so the deepsilver confirmation and `Ctrl+Z` cover them as they cover any batch.

## Spec sections

03 § Tile transitions, § Digging as a job, § Player-facing behavior (designation menu); 24 § Input model; `ui-screens/fortress-screen.md` § Designate tool; `ui-keymap-and-screens.md` § Designate panel and the `stairs` tutorial row.

## Done

The spec says the above; unit tests for the type inference, the neighbour upgrade, the best-effort counts and reasons, and the new transitions; the e2e shaft test uses the Stairs tool; the six static checks, ci.yml and the sweep pass.
