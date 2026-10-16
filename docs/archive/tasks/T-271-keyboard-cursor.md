# T-271 — Keyboard parity: a tile cursor for every tool; Build chooses first and places second

**Closed:** 2026-10-16, in 41ab217, 5d66bd9, 58e2c1e.

**Source:** T-116 and its report, [`../../reports/audits/2026-10-12-ui-ux.md`](../../../reports/audits/2026-10-12-ui-ux.md) (issue 1, § 3) · **Size:** L · **Needs:** T-251 and T-270 (both change `src/ui/screens/fortress.ts`; T-251 also the ghost in `src/ui/panels/build.ts`) · **Status:** open; it changes the input model of 24, so the owner should see it. Recommendation: the cursor, as decided below

## Why

A keyboard-only player cannot point at the map. `Enter` acts on the tile at the map centre, so aiming means panning the camera, and tiles near the map edge cannot be reached at all (left of x = 22 with a panel open). In Build it is worse: the category key arms the first row, `Enter` places at once at the centre, and Up and Down change the armed building while Left and Right pan. The capture placed a carpenter's workshop by accident, then a butcher's shop in place of a carpenter's, then a coffin in place of a door.

## Reproduction

Default embark, keyboard only.
- `b`, `w`: the status row says "Bowyer's workshop · click to place". `Enter`: a bowyer's workshop is placed at the map centre ("blocked: something is built here"). `ArrowUp`: the camera does not move and the armed row changes (capture 2/62 to 2/66, 2/77; the judgement replay).
- `d`, `Shift+D`, `Shift+ArrowLeft` ×5: the centre stops at x = 22 (2/94).
- Reference fortress, `z`, pan up, `Enter`: "There is no zone at the cursor. Centre the map on a zone and press Enter." (3/15).
- Military, `Shift+K`: "Click creature to attack"; no key picks the target (3/33 to 3/35).

## What the spec says

- [`24-ui-and-input.md`](../../02-systems/24-ui-and-input.md) § Rules (input model): `Enter` with a tool starts and ends a rectangle at the look cursor, or at the map centre.
- [`fortress-screen.md`](../../04-implementation/ui-screens/fortress-screen.md) § Build tool: the ghost follows the mouse.

## What to do

**Decisions.**
- **One cursor.** The fortress screen has a keyboard cursor: a tile, drawn as a bright frame. It is today's look cursor under one name. It appears when a tool is armed, when `k` is pressed, or when a panel asks for a tile or a creature (zone selection, station, patrol point, link, kill order). It starts at the mouse tile if the pointer is over the map, else at the map centre.
- **Arrows move the cursor** while it is shown: one tile, ten with Shift. The camera scrolls to keep it at least `CURSOR_SCROLL_MARGIN` = 3 tiles from the edge of the map view, so every tile of the map can be reached with a panel open. With no cursor shown the arrows pan as now. Define the constant in 24 § Tuning constants and `src/ui/constants.ts`.
- **Mouse and keys agree.** Moving the pointer over the map moves the cursor to the pointer's tile; a key press moves it from there. The ghost, the drag count and the tile summary in status row 2 are drawn at the cursor, so the keyboard player sees what the mouse player sees. "Ghost follows the mouse" becomes "Ghost follows the cursor".
- **Enter acts at the cursor**: the first and second corner of a rectangle, placing a building, selecting a zone, picking a station, picking the creature for a kill order. `Enter` on a tile with no creature, for a kill order, says "No creature there."
- **Build chooses, then places.** A category key opens its list with a row highlighted and **no tool armed**; the status row says "↑↓ choose · Enter pick · Esc back". Up and Down move the highlight. `Enter` or a click on a row arms that building: the cursor appears and the arrows move it. `Backspace` returns to the list with the tool dropped; `Esc` cancels the tool as now. A click on the map with a list open and nothing picked places nothing.
- **Esc and `k`.** An `Esc` that closes a panel hides the cursor. `k` twice leaves no cursor behind.

1. Amend 24 § Rules (input model) and § Tuning constants, `fortress-screen.md` (§ Build tool, § Designate tool, § Look), `ui-keymap-and-screens.md` (Map keys), `panels.md` § Military (kill order by key).
2. Implement in `src/ui/screens/fortress.ts`, `src/ui/ui-state.ts`, `src/ui/panels/build.ts`, `src/ui/panels/military.ts` (the target pick only), and the strings.
3. Tests, `describe('T-271 …')`: the cursor reaches x = 0 with a panel open; a dig rectangle by keys alone; `b`, `w`, `Enter` arms and places nothing, and a second `Enter` places at the cursor; Up and Down never change an armed tool; a zone at the map edge is selected by keys; a kill order by keys. Extend the keyboard e2e to build a carpenter's workshop and a door at chosen tiles. World hashes do not move (presentation only); render goldens with a tool armed gain the cursor frame.

## Done

- Flow 2 of the audit can be played to a working fortress with no mouse and no accidental building.
- The verification commands of [`../process/agent-workflow.md`](../../process/agent-workflow.md) are green, with the browser suite.

## Owner point settled (2026-10-12, local orchestrator, under the owner's standing instruction to use judgement; the owner was told and may overrule)

**The keyboard gets a tile cursor**, as this work file recommends, and spec 24's input model is amended to say so. A game that can only act at the map centre is not playable by keyboard alone, and the mouse-and-keyboard player loses nothing.
