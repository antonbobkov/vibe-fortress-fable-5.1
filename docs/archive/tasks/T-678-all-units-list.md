# T-678 — A list of every creature on the map, not just dwarves

**Closed:** 2026-11-21, in f5701a7a,ad1eddc1.

**Source:** the owner's feedback of 2026-11-21 · **Size:** M · **Needs:** T-669 · **Status:** open

## Why

Units lists dwarves only; the owner wants to see every unit and monster on the map in one place.

## What to do

Extend Units (or add a sibling tab) with every creature the map would draw: dwarves, tame animals, wild animals, visitors (merchants, diplomats), hostiles, the dead not counted. Group or filter by kind, sort, and open a creature's view (T-669) on Enter or a click; hidden hostiles stay hidden. Keep it fast at 100+ creatures.

## Done

- [x] A UI test with each kind on the map; hidden hostiles absent: `test/unit/ui/t678-all-creatures.test.ts` (a dwarf, a tame dog, a wild deer grazing, a merchant and a caravan mule, a raider and a spotted stealthed hostile, all listed by kind with their facts; a stealthed hostile nobody has spotted is absent until spotted; `[g]` and a click on the kind line show one kind; `Enter`, `c` and a second click on the cursor's row; a dwarf key on the All tab; 121 creatures listed, scrolled to the last and opened).
- [x] The design: Units gets a tab row, `[1] Dwarves` (unchanged) and `[2] All`, every creature the map draws, ordered by kind (dwarves, tame, wild, visitors, hostile, other) then name; a line counts each kind (a click shows that kind) and `[g]` steps through them; one fact per row (a dwarf's activity, Tame/Pet, "Wild, grazing", Merchant/Caravan, "Hostile, attacking", "· hurt"); `[w]` wounded first serves both tabs. Facts are worked out for the rows on screen only.
- [x] Docs and keys: `panels.md` § Units (new, the All tab's wireframe), `fortress-screen.md` § Sidebar open (the tab row), 24 § Input model and § Inspection, `ui-keymap-and-screens.md` § Units panel (`1` `2`, `[g]`; `[c]` now "center the map on the creature"), keymap rows `units_panel/tab` and `units_panel/kind_filter`; the parity scenario checks `2`, `g`, `Enter` and `1`.
