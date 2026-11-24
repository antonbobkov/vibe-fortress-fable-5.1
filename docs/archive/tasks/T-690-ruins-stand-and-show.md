# T-690 — A ruin's furniture still stands, and the world map shows ruined sites

**Closed:** 2026-11-24, in 20b7ddf1,b831821d.

**Source:** T-686 follow-up · **Size:** M · **Needs:** T-686 · **Status:** done

## Why

T-686 leaves an ended fortress's dug halls, standing constructions and some of its items on its site (02 § Ruins). Its furniture lies there as items: a door lies in its doorway, a bed on its bedroom floor, and a workshop is gone. A ruin whose doors still hang and whose beds still stand would read more as a fortress found than as a stockpile. And the world map names a ruined site only in its region panel, so a player choosing a site cannot see at a glance where the old fortresses stood.

## What to do

Decide which built furniture a ruin keeps standing (doors, hatches, beds, tables, chairs, coffins, statues; perhaps workshops as wrecks that deconstruct for a little stone or wood) and record it compactly in the ruin (type, material, tile, orientation), placed by 14 at arrival like the wagon. Keep the record small and the placement deterministic, and keep collapse and looting as 02 § Ruins has them. Draw a ruin mark on the world map for a region with a ruin (and a legend from before T-686), with a legend entry. Spec it in 02 § Ruins, 14 and `ui-screens/menus-and-world.md` § World map.

## Done

- [x] Tests: a ruin's door and bed stand as buildings on the next embark; a fallen one is not there (`test/unit/embark/t690-ruins-stand.test.ts`: beds stand with `RUIN_FURNITURE_STAND_PERMILLE`, a quality level worse, deterministically; a door stands while its walls do, and not once a wall has fallen; a bed told on a tile with no floor is not there; another site is unchanged).
- [x] Tests: the world map marks a ruined region (same file: a region with a ruin in the world map, and one a Legends fortress names, draw a magenta `Ω` over rivers and biomes; a civilization's home keeps its glyph; the legend lists the mark).
- [x] Spec: 02 § Ruins (a Furniture bullet, the draw order, arrival, two constants), 14 § Placement (`placeRuin`), 03 stage 10b (`LocalMapResult.ruinFurniture`), 01 § Player-facing behavior and `ui-screens/menus-and-world.md` § World map (the mark and the legend), `schemas/system-state.md` (`RuinRecord.buildings`, optional).
- [x] Kept standing: furniture that links its item (doors, hatches, beds, tables, chairs, cabinets, chests, statues, lanterns, racks, targets), each with `RUIN_FURNITURE_STAND_PERMILLE` (500), at most `RUIN_FURNITURE_MAX` (40), drawn after the items on the ruin's own stream. Coffins, cages, hives, nest boxes, chain posts and memorial slabs are gone (they held something living or a name). The linked item is made anew, a quality level worse. T-686 in fact left no installed furniture at all (an installed item has no tile), so nothing that lay loose is lost. Fresh embarks draw nothing new and run nothing new beyond an empty list, so the sweep was not run.
- Follow-up: `T-692-ruin-workshop-wrecks.md` (workshops, the hearth, the depot, the well and the pallets as wrecks).
