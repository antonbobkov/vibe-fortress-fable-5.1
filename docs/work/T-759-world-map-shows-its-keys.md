# T-759 — The world map's first screen shows no keys: the cursor starts on the ocean and the panel says only "No embark here"

**Source:** playtest 2026-11-25 (newcomer) ([report](../../reports/data/2026-11-25-playtest-5.md), finding 5) · **Size:** S · **Needs:** — · **Status:** open

## Why

New world, the default seed `deep-5589-1`, `[g]` Generate, `[Enter]` Continue to the map. The world map opens with its cursor on the region at the map's centre, which on this seed is ocean. The region panel reads "Ocean / No embark here: ocean." and nothing else. Nowhere on the screen does it say how to move the cursor, find a site or embark (`23-world-map.png`). `src/ui/screens/world_map.ts` draws the `[f] filter  [?] legend` and `[Enter] Embark here` rows only when the region has a site (`if (this.site() === null) return;`). `[?]` then shows the biome legend, still without keys. Once the cursor reaches land the panel fills in and its last two rows give `[f] filter  [?] legend` and `[Enter] Embark here` (`24-world-map-move.png`). Even then, no row says that the arrows move the cursor or that `Shift` moves it 8 regions. Arrows are the only way to get anywhere without a mouse, and a mouse click on the map does move the cursor, but nothing says so either.

## What to do

Decisions:

- **The key rows show on every region.** On an ocean or glacier the last row reads, dim, "No embark here: move to land" in place of `[Enter] Embark here`. The `[f] filter  [?] legend` row is always there.
- **One more key row above them, always shown**: "←→↑↓ move (Shift: 8) · click a region" (`ui.worldmap.move`). In a panel too short for it, it gives way before the text above it scrolls.
- **The cursor starts on the embarkable region nearest the centre** (Chebyshev distance, ties by the lowest id), not on the centre itself. With a filter set it starts on the nearest matching region.

Spec: `ui-screens/menus-and-world.md` § World map ("The cursor starts at the centre", the panel's last rows, the picture).

## Done

- [ ] Tests (`describe` with the task id): on a world whose centre is ocean, the cursor starts on the nearest embarkable region and the panel shows the move row, the filter row and `[Enter] Embark here`. Moved onto an ocean, the panel shows the move row, the filter row and the dim no-embark row. `Shift` + arrow moves 8.
- [ ] UI only: no world hash moves and no sweep is needed.
