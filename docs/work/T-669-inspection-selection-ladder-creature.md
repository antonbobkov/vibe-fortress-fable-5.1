# T-669 — A click opens what it lands on, and a creature's view follows the creature

**Source:** [the inspection design](../../reports/designs/2026-11-21-inspection-and-follow.html), § 8 first task · **Size:** L · **Needs:** — · **Status:** open

## Why

Look is a tile panel with three tabs: a click lands on the Tile tab, a dwarf's sheet needs `3`, two dwarves on a tile share one scroll, and the panel loses its dwarf as soon as the dwarf moves (design § 1). The owner also asked that a click on a stockpile show its settings, and that a tile show its tile, items, who and stockpile.

## What to do

Build the design's first task (§ 8): one selection on the fortress screen (a tile, a creature id or an item id, with a back history; presentation state, not saved) in place of `lookTab`/`lookCreature`; the click ladder of § 2 as a pure function in `look.ts` (creatures as the map draws them, loose items, the building, the zone, bare ground; right click and a second click open the tile list; a tool or picking panel keeps its click); the tile list of § 3 with digits, Enter and the cursor; and the creature view of § 3 that holds the id, reads its place each frame and keeps the cursor on it. A zone step opens Zones with that zone selected, leaving map clicks to the ladder (§ 8). Move the Tile tab's building buttons to the building row/panel and check the lever pull survives. Keep the design's choices (§ 9). Update 24 § Inspection and § Input model, the fortress-screen wireframe, the keymap table and parity scenario, the look strings and the browser specs that press 1 2 3 in Look.

## Done

- [x] Unit tests for every rung of the ladder (a stealthed hostile is not given away): `test/unit/ui/t669-inspection-ladder.test.ts` § the click ladder covers one and several creatures, one and several loose items (a barrel counts as one), the building, the zone, bare ground, an undiscovered tile, a stealthed hostile (absent from the ladder, the list, the view and the hover line until spotted) and the dwarves-animals-rest order. Look gave such a hostile away before: `creaturesAt` had no stealth test, so the hover line and the Tile tab named it.
- [x] The tile list: its rows, glyphs, facts and digits; a crowd click, a digit, a row click, `Enter` and `Backspace`; the list following the cursor; right click and the second click; the building row and the lever pull in the building panel; a zone click opening its settings while Zones opened with `z` keeps picking.
- [x] The creature view after its creature moves: the title, the `At` line and the cursor follow it, the arrows pan, a level apart says so; `[h]` and `Backspace`; Units `Enter`; a creature gone from the map.
- [x] The browser specs updated: `panels-act` (8d opens the view with `1`), `panels-open-and-close` (Look's title), `items-on-a-tile`, `look-creature-scroll`.

The selection holds a tile or a creature; an item has no view yet, so the ladder's item rung opens the tile list and item rows carry no digit (T-670 adds the item view and its kind of selection). `Backspace` and its short history (`LOOK_BACK_MAX`) are in, for the views opened from inside Look.
