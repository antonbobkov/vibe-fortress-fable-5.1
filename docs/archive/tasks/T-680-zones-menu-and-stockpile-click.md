# T-680 — `z` offers what zones to make, and a stockpile's settings open by clicking it

**Closed:** 2026-11-21, in 5f3688b7,90c3bca2,7363a5d6.

**Source:** the owner's feedback of 2026-11-21 · **Size:** M · **Needs:** T-669 · **Status:** open

## Why

Pressing `z` should show how to make new zones; today it opens the zone list for selecting and editing. The owner expects a stockpile's settings to open by clicking the stockpile (T-669's ladder does this for an empty stockpile tile).

## What to do

Rework `z` into a menu of zone kinds to place (stockpile, pasture, bedroom, ...), each starting the placement tool; reach existing zones' settings by clicking them (T-669) and from a list inside the menu. Keep keys consistent with T-674's proposal if it has landed. Update 24 and the keymap.

## Done

- [x] UI tests: `z` then a kind places a zone; a click on a stockpile tile opens its settings. `test/unit/ui/t680-zones-menu.test.ts`: `z s` and a drag make a stockpile whose settings then show, `b` there opens Build, `Esc` goes back to the menu and `Esc` again closes; a click on a stockpile tile opens its settings and `Esc` closes them; `z` over settings returns to the menu and over the menu closes; `Tab` `Enter` and a click on a row of the menu's list open a zone.
- [x] Zones has two views: the menu (the kinds with their letters, then "Zones (n)", a row per zone with its size: a click, or `Tab`/`Shift+Tab` and `Enter`, opens its settings and centres the map) and a zone's settings in the menu's place (`[y] zones menu`). `z` always opens the menu (it no longer reopens the last zone).
- [x] The double `Esc` (T-674's stated cost): cut. Over a zone's settings the kinds are no keys (`keyContexts` gives `zone_inspector` or `zones_panel`, never both), so right after drawing a stockpile `b` opens Build and `d` Designate; bedroom and dining hall keep `b` and `d` in the menu, where a menu of kinds should take them. The rebinding rule that kept the two contexts apart is gone. `Esc` after a zone is made drops the idle tool and goes back to the menu; from settings opened by a click on the map it closes Zones.
- [x] Docs: `panels.md` § Zones (the menu wireframe and both views), 24 § Input model, § Inspection and § Settings, `ui-keymap-and-screens.md` (the Zones row, § Zones panel, § Zone inspector, the tutorial's workshop and farm steps), Help's zones note, the tutorial texts. The parity scenario checks `z s`, `b` over settings opening Build, and `z` back to the menu. Unit tests and the browser specs (`build-and-stockpile`, `tutorial`, `farm-plot-and-orders`) that leaned on the old `Esc` follow.
