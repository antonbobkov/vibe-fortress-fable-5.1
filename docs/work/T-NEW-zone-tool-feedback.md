# T-NEW — A zone answers at once, and its inspector has the keys it names

**Source:** [T-605's audit](../../reports/audits/2026-11-18-t605-first-hour-ux.md), findings 3 and 4 · **Size:** M · **Needs:** — · **Status:** open

## Why

A zone drawn while the game is paused (a new fortress starts paused) is created at once and drawn on the map, but the status row keeps "Stockpile · drag a rectangle" and no inspector opens until a tick runs: the "made" line and the selection wait for the zone's `ZoneChanged` event. A player who sees nothing happen draws it again and is told "Stockpile: none of the 20 tiles qualify (floor that no other zone holds)", a rule the tiles meet.

After a zone is made, its inspector shows ("↑↓ season · Enter choose crop") but the zone tool stays armed, so `Enter` sets a new rectangle's corner ("Farm plot 1x1 (1 tiles, 0 qualify)") and two `Esc` are needed before the inspector takes the keys.

## Decisions

- **The made line and the selection come from the command's result**, not from the event: a `CreateZone` that succeeds while paused selects its zone and writes "Stockpile #1 made: 11 tiles (1 left out: 1 not walkable)." at once (24 § Input model: commands while paused take effect immediately). The ordinal is the new zone's.
- **The refusal names the real reason**: tiles held by another zone are counted as "another zone", so a second drag over a zone says "none of the 20 tiles qualify (20 belong to another zone)".
- **The tool idles after a made zone.** After a zone is made the tool stays chosen but idle: `Enter`, the arrows and the digits go to the inspector until the pointer is dragged on the map again or the type key is pressed again. A click-drag on the map still starts the next zone, so drawing several zones in a row stays one drag each.

## Spec sections

`04-implementation/ui-screens/panels.md` § Zones (the paragraph after the wireframe), `02-systems/24-ui-and-input.md` § Input model (zone tools).

## Done

Unit tests: a stockpile made while paused writes its made line and opens its inspector before any tick; a second drag over it names "another zone"; after a farm plot is made, `Enter` opens the season's crop dropdown. `zones-editor` and `build-and-stockpile` e2e pass, updated where they stepped a tick to see the made line.
