# T-442 — Every object on a tile can be seen (dug stones not shown)

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
