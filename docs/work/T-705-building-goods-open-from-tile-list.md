# T-705 — The wagon's goods cannot be opened, and its "see the items" help promises a tab that is gone

**Source:** playtest 2026-11-24 ([report](../../reports/data/2026-11-24-playtest.md), finding 7) · **Size:** S · **Needs:** — · **Status:** open

## Why

On day 1 I clicked the wagon's tile. The tile list (`reports/data/2026-11-24-playtest/22-click-wagon-tile.png`) numbers the six dwarves and `7 ▄ Wagon #1 built · 14 inside`, and lists the fourteen stacks under it unnumbered: a click on "10 pumpkin seed" does nothing, and no key opens it. Opening the wagon (`7`) gives the Building panel (`23-wagon.png`), whose `[v] see the items` row says "Opens Look at the Items tab on the tile where they lie: each stack with its value and flags." (`ui.building.see_items_help`). Look has had no Items tab since T-669: `[v]` opens the same tile list, where the stacks still cannot be opened, and it shows no value or flag. So there is no way to see a wagon good's item view (its value, its flags, "In Wagon #1"), though `fortress-screen.md` lists "In Wagon #1" as an item view's place.

And from the Building panel opened with the tile list's `7`, `Backspace` does nothing: the panel is not one of Look's views, so it keeps no view before, while the same list's `2` (a dwarf) comes back with `Backspace`.

## What to do

Decisions:

- **The goods a building holds are rows of the tile list that open**: each stack under the building's row gets its digit after the building's (the digits number the openable rows in view, as now), and its digit, `Enter` on it as the first, or a click opens its item view, whose place line reads "In Wagon #1". The rot and flag lines under a stack stay unnumbered.
- **`see_items_help` says what happens:** "Opens Look's tile list on the tile where they lie: each stack opens with its digit."
- **A building or zone panel opened from Look keeps Look's view for `Backspace`**, as a link does: its foot shows `[Bksp] back` then, and `Backspace` returns to the tile list it came from.

Spec: `ui-screens/fortress-screen.md` § Inspection panel (the tile list's rows; `Backspace`), `ui-screens/panels.md` (building panel, `[v]`), the string in `ui-keymap-and-screens.md` if it is listed there.

## Done

- [x] Tests: the wagon's tile list numbers its stacks and the digit of one opens its item view ("In Wagon #1"); `Backspace` from that item view and from the wagon's Building panel opened with its digit returns to the tile list; the `[v]` help text.
- [x] UI only: no world hash moves.
