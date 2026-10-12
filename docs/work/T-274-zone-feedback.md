# T-274 — Zones: a message when one is made, the tiles left out, zones that can be seen

**Source:** T-116 and its report, [`../../reports/audits/2026-10-12-ui-ux.md`](../../reports/audits/2026-10-12-ui-ux.md) (issue 4) · **Size:** M · **Needs:** T-245 (it changes the same zone drawing and `src/ui/panels/zones.ts`) · **Status:** open

## Why

After a zone drag nothing says a zone exists, and the zone is a 25% tint over a black cell background: a faint dark patch. A drag that overlaps another zone makes a smaller zone from the free tiles and says nothing. The selected zone is not marked on the map. The zone type list cuts two of its own labels.

## Reproduction

`?start=flat-test&embark=default`, paused. `z`, `Shift+S`, drag 4×3: the status row still reads "Stockpile · drag a rectangle · [Esc] cancel". `Shift+F`, drag 5×3 overlapping two columns of the stockpile: the same; one tick later a click shows "Farm plot #1 (9 t)" for a 15-tile drag. Screenshot: [`zone-tints-after-overlap.png`](../../reports/audits/2026-10-12-ui-ux/replay/zone-tints-after-overlap.png) (the selected plot is the barely visible rectangle at the top left). Capture 1/53, 1/63, 5/38, 5/40. Labels: "[S-d] Dining ha", "[S-m] Meeting a" (1/63).

## What the spec says

- [`23-rendering.md`](../02-systems/23-rendering.md) § Overlays: "`zones` (default on): `bg` tinted by zone type at low alpha"; `ZONE_TINT_ALPHA` = 0.25.
- [`24-ui-and-input.md`](../02-systems/24-ui-and-input.md) § Rules: an action that succeeds or fails says so.
- [`panels.md`](../04-implementation/ui-screens/panels.md) § Zones.

## What to do

**Decisions.**
- **Message.** After a zone drag the status row says what was made: "Stockpile #2 made: 12 tiles." When tiles were left out: "Farm plot #1 made: 9 tiles (6 left out: 6 belong to another zone)." The reasons are counted per kind, in the wording the zero-tile refusal already uses (another zone, not walkable, not soil). The zero-tile refusal keeps its text but is shortened to fit 80 columns: "Bedroom: none of the 4 tiles qualify (floor that no other zone holds)."
- **Selection after making.** The new zone is selected at once, so its editor shows (with T-240 this works while paused). The tool stays armed for the next drag, as now.
- **Visible zones.** A zone tile's background is the zone colour blended over the cell's own background at `ZONE_TINT_ALPHA`, but never darker than `ZONE_TINT_MIN_LUMA` = 0.18 relative luminance: on a black background the colour is lifted to that floor. Define the constant beside `ZONE_TINT_ALPHA` in 23 § Tuning constants and `src/render/constants.ts`. Glyph colours do not change.
- **Selected zone.** The tiles of the selected zone are drawn at twice the alpha (same floor), and the zone's name is in status row 2 while it is selected.
- **Labels.** The zone type list uses names that fit a 16-column cell: "Dining", "Hearth", "Meeting", "Archery", "Fishing", "Gather". The full names stay in the tool prompt ("Dining hall · drag a rectangle").
- **Colourblind palette.** The floor applies to both palettes; T-245 owns the rule that state is not shown by colour alone and is not repeated here.

1. Amend 23 § Overlays and § Tuning constants, `panels.md` § Zones, and `ui-keymap-and-screens.md` if it lists the zone names.
2. Implement in `src/ui/panels/zones.ts`, `src/render/compositor.ts`, `src/render/constants.ts`, and the strings.
3. Tests, `describe('T-274 …')`: the message for a whole and a trimmed zone; the new zone is selected; the luminance floor on a black background in both palettes; the selected zone's stronger tint. Render goldens with zones move; regenerate them with a `golden:` paragraph.

## Done

- The reproduction says "Farm plot #1 made: 9 tiles (6 left out: …)", and both zones can be seen in a screenshot without the dump.
- The verification commands of [`../process/agent-workflow.md`](../process/agent-workflow.md) are green, with the browser suite.
