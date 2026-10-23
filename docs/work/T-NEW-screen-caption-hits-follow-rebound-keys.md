# T-NEW — Screen captions and the hospital supply buttons measured with the rebound key

**Source:** T-428, which fixed the sidebar panels' captions ([`T-428`](T-428-caption-hits-follow-rebound-keys.md)) · **Size:** S · **Needs:** T-428 · **Status:** open

## Why

T-428 made the panels' captions clickable at the cells they are drawn in (`captionButtons` and `keyCells` in `src/ui/widgets/label.ts`). Three places outside the panels still place a click region from the caption as written:

- `src/ui/screens/settings.ts` (`[d] Reset to defaults    [Esc] Back`: regions at fixed columns 2 and 28, widths 21 and 10) and `src/ui/screens/trade_session.ts` (`[-] n [+]`: regions at fixed offsets and 3 cells), whose keys (`-`, `+`, `d`, `Esc`) are to be checked: a key that is a keymap binding is named as it is bound now when the screen has key names, and its region must follow.
- `src/ui/screens/world_gen.ts`, `embark.ts`, `load.ts` and `labor_manager.ts`, whose hit regions use fixed columns and widths beside captions that may name rebindable keys.
- The hospital supply rows of the zone inspector (`drawHospitalSettings` in `src/ui/panels/zones.ts`) draw `[-]` and `[+]` at fixed columns; a longer name for the zone inspector's `-` key makes the two captions overlap, so the `[+]` hides the end of the `[-]`.

## What to do

Check each place with a rebound key whose name is longer and shorter than the default. Where a region does not follow the drawn text, use `keyCells` or `captionButtons`; where a fixed column cannot hold a longer name, lay the captions out from the drawn width (the hospital rows draw `[-]` after the supply name and `[+]` after it, from the cells the first took).

## Done

- A unit test per screen or panel changed: with the key rebound to a longer one, a click on the last cell of the caption runs it and a click one cell past does not.
- No golden moves with the default bindings.
