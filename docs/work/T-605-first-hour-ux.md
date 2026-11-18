# T-605 — A new player's first hour

**Source:** the owner's playtest of 2026-11-17 · **Size:** M · **Needs:** — · **Status:** open

## Why

The owner played Deepholm for the first time on 2026-11-17 and within an hour hit confusing stair tools and a misleading stair error (T-589), terrain seen from the level above (T-590), no selection box underground (T-592), a lost tile readout in the dig menu and no water depth (T-591), no way to see the wagon's contents (T-591) and odd item names (T-595). The pattern is UI friction a new player meets in the first hour. Find more of it before the owner does.

## What to do

Play the first in-game weeks of a fresh embark through the real UI (Playwright against the Vite dev server, keys and mouse as the e2e tests drive them): embark and loadout, reading the map, z-levels, digging rooms and a stair shaft, workshops and a stockpile, work orders, zones (farm, dining, bedrooms), needs and moods, help, the log, saving and loading. Note what is confusing, missing, misleading, inconsistent or needs knowledge the UI does not give, against the UI specification (`02-systems/24-ui-and-input.md`, `04-implementation/ui-screens/`, `03-content/ui-keymap-and-screens.md`).

## Done

- `reports/audits/2026-11-18-t605-first-hour-ux.md`: numbered findings with where, what a new player sees, why it confuses, severity, a suggested fix and a screenshot reference.
- Small clear findings fixed with tests and spec edits; the rest filed as `docs/work/T-NEW-*.md` (at most six, most severe first).
