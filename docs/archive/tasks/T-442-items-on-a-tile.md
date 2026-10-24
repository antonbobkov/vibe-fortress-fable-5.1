# T-442 — Every object on a tile can be seen (dug stones not shown)

**Closed:** 2026-10-23, in 5a3ffe5.

**Source:** the owner, 2026-10-23 (first play session) · **Size:** S · **Needs:** — · **Status:** open

## Why

After digging, the owner saw stones left on the ground, but looking at the tile showed only the floor. The look panel has Items and Creatures tabs (`src/ui/panels/look.ts`, `itemsAt`), so either the stones were not items on that tile, or the panel did not show them.

## What to do

1. Reproduce: dig stone until a `raw_stone` drops (`MINING_STONE_DROP_PERMILLE`), look at its tile with the mouse and with the look key, and check what the panel and the map show.
2. Fix what the reproduction finds. Possible causes:
   - the Items tab hidden or unselected by default;
   - a map click selecting the floor and not the stack;
   - the glyph of a dropped stone looking like a boulder tile while the tile section says floor;
   - items under a creature not listed.
3. Whatever the cause, the look panel lists everything on the tile: the terrain, every item (stacked and in containers), every creature and every building. A tile with several things says so on the map hint, and the panel shows all of them.
4. If dropped stones and boulder tiles are confusable on the map, give them distinct glyphs or colours (03-content glyphs-and-colors).

## Done

- A unit test that a dug-out stone appears in the look panel for its tile.
- An e2e test that digs, looks and finds the stone.
- The gates pass.

## As done

- **Reproduced, no fault in the data.** A row of twelve granite tiles was dug in `flat-test` (unit test `t442-items-on-a-tile.test.ts`). Two stones dropped, each a `raw_stone` item on its dug tile. The look panel's Items tab listed each stone (`Items(1)`). The Tile tab, which the panel opens on, showed only `Granite floor`, and the hover line also said only `Granite floor`. The cause was discoverability: the stone was there, but only on a tab the player did not open. A dropped stone (`•`) and a boulder tile (`○`) already have distinct glyphs, so the glyphs were left as they are.
- **Fix (small, presentation only):** the Tile tab now ends with `Here:` and one line per item and creature on the tile. The status row's hover summary names what else is on the tile: `Granite floor · 1 granite stone`, or `… · 3 more here`. The hotkey strip after it already ends with `[k] look`, shown with the live key. Spec: 24 § Inspection and the look panel's wireframe in `fortress-screen.md`.
- Tests: the unit test above, and the e2e test `items-on-a-tile.spec.ts`, which digs, hovers, presses `k` and clicks, and finds the stone each time.
