# T-669 — A click opens what it lands on, and a creature's view follows the creature

**Source:** [the inspection design](../../reports/designs/2026-11-21-inspection-and-follow.html), § 8 first task · **Size:** L · **Needs:** — · **Status:** open

## Why

Look is a tile panel with three tabs: a click lands on the Tile tab, a dwarf's sheet needs `3`, two dwarves on a tile share one scroll, and the panel loses its dwarf as soon as the dwarf moves (design § 1). The owner also asked that a click on a stockpile show its settings, and that a tile show its tile, items, who and stockpile.

## What to do

Build the design's first task (§ 8): one selection on the fortress screen (a tile, a creature id or an item id, with a back history; presentation state, not saved) in place of `lookTab`/`lookCreature`; the click ladder of § 2 as a pure function in `look.ts` (creatures as the map draws them, loose items, the building, the zone, bare ground; right click and a second click open the tile list; a tool or picking panel keeps its click); the tile list of § 3 with digits, Enter and the cursor; and the creature view of § 3 that holds the id, reads its place each frame and keeps the cursor on it. A zone step opens Zones with that zone selected, leaving map clicks to the ladder (§ 8). Move the Tile tab's building buttons to the building row/panel and check the lever pull survives. Keep the design's choices (§ 9). Update 24 § Inspection and § Input model, the fortress-screen wireframe, the keymap table and parity scenario, the look strings and the browser specs that press 1 2 3 in Look.

## Done

Unit tests for every rung of the ladder (a stealthed hostile is not given away), the tile list and the creature view after its creature moves; the browser specs updated.
