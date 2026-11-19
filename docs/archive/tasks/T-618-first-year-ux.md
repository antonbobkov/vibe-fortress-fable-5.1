# T-618 — A new player's first year

**Closed:** 2026-11-18, in 9b79f9e1.

**Source:** the owner's playtest of 2026-11-17 and T-605's first-hour audit · **Size:** M · **Needs:** — · **Status:** open

## Why

T-605 ([report](../../../reports/audits/2026-11-18-t605-first-hour-ux.md)) played the first 18 days of a fortress through the real UI and its follow-ups are fixed. The rest of the first year has not been played that way: the military, the first caravan and trade, a wounded dwarf and the hospital, the first winter, the first immigrants, workshops and work orders over a season, the Thane's whims, the Making Do things (kiln, beds, candles), and saving and loading mid-game.

## What to do

Play on from the first hour through the real UI (Playwright against the Vite dev server, keys and mouse as the e2e tests drive them), using a testing-mode embark or a fixture where reaching a moment by play would take too long. Note what is confusing, missing, misleading or inconsistent, against the UI specification (`02-systems/24-ui-and-input.md`, `04-implementation/ui-screens/`, `03-content/ui-keymap-and-screens.md`) and the owning system documents.

## Done

- `reports/audits/2026-11-18-t618-first-year-ux.md`: numbered findings with where, what a new player sees, why it confuses, severity (blocks / confuses / polish), a suggested fix and a screenshot reference.
- The small clear findings fixed with tests and spec edits; the rest filed as `docs/work/T-NEW-*.md` (at most six, most severe first) and listed in the commit's `New rows:` line.
- The Balanced loadout's missing spear (T-605 finding 29) is an open owner decision and is not changed here.
