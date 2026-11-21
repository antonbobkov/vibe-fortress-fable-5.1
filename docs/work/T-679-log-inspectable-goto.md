# T-679 — The event log can be browsed, and an event with a place goes there

**Source:** the owner's feedback of 2026-11-21 · **Size:** M · **Needs:** T-669 · **Status:** open

## Why

The log can be read but not inspected: an event that happened somewhere has no way back to that place, even after what was there has moved on.

## What to do

Make the log panel a selectable list (arrows, PgUp/PgDn, wheel, click), with a filter if it helps; an event that carries a tile (death, breach, ambush, building done, mood break) gets a go-to that centres the map on that tile and level, marks it, and opens the tile list (T-669) there; an event naming a creature or item also opens that thing's view if it still exists. Store the tile on log entries that do not yet carry one.

## Done

UI tests: select an event, go to its place; an event whose creature has moved still goes to the event's tile.
