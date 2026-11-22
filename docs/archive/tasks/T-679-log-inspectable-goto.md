# T-679 — The event log can be browsed, and an event with a place goes there

**Closed:** 2026-11-21, in 185e5bd0.

**Source:** the owner's feedback of 2026-11-21 · **Size:** M · **Needs:** T-669 · **Status:** open

## Why

The log can be read but not inspected: an event that happened somewhere has no way back to that place, even after what was there has moved on.

## What to do

Make the log panel a selectable list (arrows, PgUp/PgDn, wheel, click), with a filter if it helps; an event that carries a tile (death, breach, ambush, building done, mood break) gets a go-to that centres the map on that tile and level, marks it, and opens the tile list (T-669) there; an event naming a creature or item also opens that thing's view if it still exists. Store the tile on log entries that do not yet carry one.

## Done

- [x] UI tests: select an event, go to its place; an event whose creature has moved still goes to the event's tile. `test/unit/ui/t679-log-goto.test.ts`: a dwarf's line keeps its tile and names the dwarf; the dwarf walks off, `↓` and `Enter` centre on the line's tile and level, mark it and open the tile list there; `Backspace` returns to the log with its choice, `[v]` opens the dwarf's view where it is now; a first click centres and marks, a click on the chosen entry opens the tile list; a gone subject and a line with no place say so; the filter holds for the way back and ends when another panel opens; an item's, a building's and a party's later line (a theft after the thief left) get a place; the subject is saved and loaded. `ui_keymap_parity` checks the two new keys and the new § Mouse row, `Click a log entry`.
- [x] Docs: 24 § Announcements and the log (the go-to, `[v]`, the action row, the way back, what a line's focus and subject are) and § Inspection (`Backspace` back to the log), § State; `ui-keymap-and-screens.md` § Log panel and § Mouse; `ui-screens/panels.md` § Log; `schemas/system-state.md` (`logTail[].subject`).

The log was already a selectable list with the wheel, `PageUp` `PageDown`, a click and the `/filter` (T-608, T-614); this adds the go-to and `[v]`. Keys: `Enter` goes there (centre, mark, tile list), `[v]` opens the creature or item the line names; a click chooses and centres as before, and a click on the chosen entry goes there, as a second click on the map lists a tile (T-669). Lines gain a place where the event names a creature, item, building or zone (`focusOf` now looks at an item's tile, a building's footprint, `ids[0]`, `zoneId` and the other ids an event carries), and a theft or a raid's end after its party left the map takes its party's last place. There is no "building done" line to give a place to: `BuildingCompleted` has no announcement. Death, breach, ambush, raid and mood lines already had one (`tile`, `partyId`, the creature's `id`); they now also name their subject. UI only: no simulation code changed.
