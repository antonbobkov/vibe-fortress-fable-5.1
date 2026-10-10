# T-247 — Stockpile links can be made and removed in the editor

**Source:** T-111 and its report, [`../../reports/audits/2026-10-10-ui-audit-follow-up.md`](../../reports/audits/2026-10-10-ui-audit-follow-up.md) (7.8) · **Size:** M · **Needs:** — · **Status:** open

## Why

A stockpile can take goods only from linked stockpiles (13), but the editor only shows `Links: none`; there is no way to make or remove a link.

## Reproduction

Seed `audit-1`, default embark. Make a stockpile, run a moment, select it: the editor ends `Priority 6    Links: none` and offers no link action (report shot 08j). Code: `src/ui/panels/stockpile-editor.ts:250` shows the count; nothing in `src/ui` submits `LinkStockpile`.

## What the spec says

- [`13-items-and-storage.md`](../02-systems/13-items-and-storage.md) § Rules: `accepts` takes an item from a linked source only, when `linkedSources` is not empty; "`LinkStockpile` accepts only another stockpile zone as source"; § Interfaces: `LinkStockpile { zoneId, sourceZoneId, on }`; § Player-facing behavior: the editor has "source links".
- [`panels.md`](../04-implementation/ui-screens/panels.md) § Zones (stockpile): `Links [+]` in the wireframe.

## What to do

**Decision.** The editor's links line reads `Links: Stockpile #2, Stockpile #4  [i] link  [x] unlink` (`i` and `x` are free letters). `[i] link` puts the map in a pick mode like the lever link of the building panel: the status row says "Link Stockpile #1: click the stockpile it takes from · [Esc] cancel", a click on another stockpile sends `LinkStockpile { on: true }`, and a click on anything else says that only a stockpile can be a source. `[x] unlink` opens a list of the linked sources and `Enter` sends `LinkStockpile { on: false }` for the chosen one. A link line in the list centres the map on its source. The editor names linked sources, not just a count.

1. Amend `panels.md` § Zones (stockpile) and `ui-keymap-and-screens.md` § Zones inspector keys.
2. Implement in `src/ui/panels/stockpile-editor.ts` and the pick mode in `src/ui/screens/fortress.ts`.
3. Tests, `describe('T-247 …')`: link by click, refusal on a non-stockpile, unlink from the list, and the editor's text.

## Done

- A player can link and unlink stockpiles with keyboard and mouse.
- The verification commands of [`../process/agent-workflow.md`](../process/agent-workflow.md) are green, with the browser suite.
