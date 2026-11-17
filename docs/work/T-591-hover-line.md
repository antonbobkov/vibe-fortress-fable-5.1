# T-591 — An always-on hover line, with water depth

**Source:** the owner's playtest, 2026-11-17 · **Size:** S · **Needs:** — · **Status:** open

Two things the owner hit while playing:

- "When I'm in digging menu, I lose the ability to look at a tile I'm hovering over. Have a dedicated hover line on the bottom, which is always active no matter in which menu." Today the status line shows the tile under the cursor (`tileContents` in `src/ui/panels/look.ts`) only when no tool, zone, or selection is active (`src/ui/screens/fortress.ts`, the status text); in Designate and the other menus it shows the tool's line instead.
- "When I view a tile with river I cannot seem to inspect water level." `tileContents` and the look panel say nothing about a fluid: 04's reader has `levelAt(i)` (0 to 7), and a river tile shows only its terrain.

## Decided

- A dedicated hover line at the bottom, always shown in every screen mode and menu, describing the tile under the mouse (or the keyboard cursor when the mouse is off the map): what `tileContents` gives today, plus the fluid on it ("water 5/7", "magma 2/7", frozen as "ice"). The tool's own status keeps its line; the hover line is a separate row. Update 23's layout (`STATUS_ROWS` or a new row), the UI spec of the status bar, and the look panel to show the fluid too.
- "Is there a way to view items inside a wagon?" Today only through Look (`k`) on the wagon's centre tile, Items tab (`2`): the wagon's goods lie there (02 § Arrival), with the barrels' and bags' contents. Selecting the wagon as a building says nothing of them. Give a container building's panel (the wagon, and any other `container` building) a short "holds" summary (counts by item type, like the stocks panel) with a key to open the Items tab on its tile.
