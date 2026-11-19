# T-611 — Inspecting a dwarf from Units shows that dwarf

**Closed:** 2026-11-18, in 4dee88ca.

**Source:** [T-605's audit](../../../reports/audits/2026-11-18-t605-first-hour-ux.md), findings 7 and 8 · **Size:** S · **Needs:** — · **Status:** open

## Why

In the first days every dwarf stands at the wagon. `Enter` (inspect) on a dwarf in Units opens Look at that tile on its Tile tab: the wagon and 52 item lines. The Creatures tab, labelled `[3]Cr»`, lists all seven dwarves in id order, so the one asked about may be fourth. The Units list also shows a mood badge ("[Unhappy]") in place of one dwarf's activity, and its footer's sleep keys read "sleep 21h  [[]  []]".

## Decisions

- **Units › `Enter`, a double click on a unit row, and a click on a creature's name in a log line open Look at the Creatures tab with that creature's sub-tab first.** Look opened from the map is unchanged.
- **The tabs line fits the sidebar**: "[1]Tile [2]Items(52) [3]Creatures(7)" shortens the labels ("[1]Tile [2]Items 52 [3]Who 7") before it cuts one.
- **The Units list keeps the activity in its column**; a dwarf's mood tier is its own glyph column (as now for the others), never in place of the activity.
- **The sleep footer reads** "sleep 21h  [[] earlier  []] later".

## Spec sections

`04-implementation/ui-screens/panels.md` (Units and Look), `02-systems/10-dwarves.md` § Player-facing behavior (units panel), `02-systems/24-ui-and-input.md` § Inspection.

## Done

A unit test: seven dwarves on one tile, inspect the fourth from Units, and Look's creature section starts with its name; the tabs line has no `»`. `panels-act` and `mouse-parity` e2e pass.
