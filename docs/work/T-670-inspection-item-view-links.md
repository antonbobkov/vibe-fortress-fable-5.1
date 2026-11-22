# T-670 — An item's view, and names that open what they name

**Source:** [the inspection design](../../reports/designs/2026-11-21-inspection-and-follow.html), § 8 second task · **Size:** M · **Needs:** T-669 · **Status:** open

## Why

After T-669 a click on a loose item still has nowhere of its own to go, and a dwarf's view names the items it carries and the friends it has without a way to open them (design § 3 Item view).

## What to do

Build the design's second task: the item view of § 3 (it holds the item id, its place from `items.tileOf`, a second line for how it is held: lying, carried, worn, in a container, in a building; 13's item fields plus maker, owner and reserving job), names as links in the creature and item views (a carried item, a friend, the carrier, the container, the stockpile) and `Bksp` back through the short history. No item commands yet (§ 9).

## Done

- [x] Unit tests: an item picked up, put in a barrel and laid in a stockpile keeps its view; links open and Bksp returns. `test/unit/ui/t670-item-view.test.ts`: a lone log clicked opens its view, then carried by a dwarf, put in a bin and dropped in a stockpile it keeps the view, its second line (`Lying on the ground`, `Carried by …`, `In oak bin`, `Lying in Stockpile #n`), its `At` line and the cursor following it, and the stockpile's name opens its settings; a barrel's row in the tile list has its digit, its `Holds` link opens the drink, the drink's `In oak barrel` opens the barrel, `Backspace` steps back through them to the list; a second click on the open item's tile lists it, a destroyed item reads "Gone; last seen at …" and `[h]` lists its last tile; a dwarf's carried pick and its friend are links, `Backspace` returns, the pick's carrier opens the dwarf; `Tab` focuses the links in view and `Enter` opens the focused one.
- [x] Docs: 24 § Inspection (the item view, names as links, the ladder's item rung), § Input model (the cursor and the left click), 13's item section, `ui-keymap-and-screens.md` § Look panel and § Mouse, the fortress-screen wireframe of the item view; the browser specs `items-on-a-tile`, `runecraft-screens` and `panels-act` (a lone item now opens its view).

The links take no new keymap row: in a view they are the panel's fields, so § Panels' `Tab` / `Shift+Tab` (next / previous field) move the focus and `Enter` (activate) opens it. The `[h]` row now reads "creature or item view: the tile list where it is". The `For` line names the reserving job by its type and its worker (`Haul, Roald Deephelm`), not the mock-up's "Install bed, Bedroom #4". No item commands (design § 9).
