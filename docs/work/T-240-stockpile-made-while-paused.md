# T-240 — A stockpile made while paused can be set up at once

**Source:** T-111 and its report, [`../../reports/audits/2026-10-10-ui-audit-follow-up.md`](../../reports/audits/2026-10-10-ui-audit-follow-up.md) (Issue 2, M1, new finding N1) · **Size:** M · **Needs:** — · **Status:** open

## Why

The game starts paused, and paused input now takes effect at once (D-U1). A new stockpile appears at once too, but its editor does not: clicking it says "That zone is no longer available." until time runs. Every new player who makes a stockpile and then tries to choose what it holds meets this, at the first step where the old audit's walkthrough set a preset.

## Reproduction

Seed `audit-1`, hilliest region, default embark (the e2e helpers' route). Paused: `z`, `Shift+S`, drag 3×3 on floor, `Esc`, click the new zone. The zones panel shows `Selected: Stockpile #1` and "That zone is no longer available."; `Shift+P` repeats the message. Run the game for a moment (21 ticks were enough) and click again: the editor appears. Report shots 08g0 and 08g.

## What the spec says

- [`simulation-core.md`](../01-architecture/simulation-core.md) § Commands: while paused the host runs the command phase at once, but "other events emitted by commands remain queued for the normal tick dispatch".
- [`13-items-and-storage.md`](../02-systems/13-items-and-storage.md) § Interfaces (events consumed): 13 creates a stockpile's record on `ZoneChanged` (`src/systems/items/index.ts:286-296`, `StockpileStore.ensure`). So the record does not exist until the next tick.
- [`ui-screens/panels.md`](../04-implementation/ui-screens/panels.md) § Zones (stockpile) and [`ui-keymap-and-screens.md`](../03-content/ui-keymap-and-screens.md) describe the editor with no exception for a paused game.

## What to do

**Decision.** The stockpile commands make the record themselves when it is missing. `SetStockpileFilter`, `SetStockpileContainers`, `SetStockpilePriority` and `LinkStockpile` on a `stockpile` or `hospital` zone with no record first call `ensure(zoneId)`, which creates exactly the record `ZoneChanged` would create; the later `ZoneChanged` finds it and changes nothing. The editor draws a stockpile zone that has no record yet from those same defaults (an empty filter, no containers, priority `HAUL_PRIORITY`), so it can be used at once. "That zone is no longer available." stays for a zone that no longer exists. The event order and the save format do not change.

1. Amend 13 § Interfaces (the four commands create a missing record first) and the stockpile part of `panels.md` § Zones (the editor works on a zone made while paused).
2. Implement in `src/systems/items/` (the command handlers) and `src/ui/panels/stockpile-editor.ts` (defaults for a zone without a record; export the default record from `@systems/items` so the UI does not copy it).
3. Tests, `describe('T-240 …')`: paused host, `CreateZone` stockpile, then `SetStockpileFilter` to the Wood preset is accepted and visible before any tick; a replay of the same commands with and without the pause reaches the same world hash; a UI test that the editor of a just-made zone shows the preset row, not the unavailable message.

## Done

- The reproduction above shows the editor while paused, and choosing Wood applies at once.
- No golden moves, or the commit explains each one (a scenario that set a filter in the same tick as the zone was made would now succeed where it was refused).
- The verification commands of [`../process/agent-workflow.md`](../process/agent-workflow.md) are green, with the browser suite.
