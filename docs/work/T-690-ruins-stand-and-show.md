# T-690 — A ruin's furniture still stands, and the world map shows ruined sites

**Source:** T-686 follow-up · **Size:** M · **Needs:** T-686 · **Status:** open

## Why

T-686 leaves an ended fortress's dug halls, standing constructions and some of its items on its site (02 § Ruins). Its furniture lies there as items: a door lies in its doorway, a bed on its bedroom floor, and a workshop is gone. A ruin whose doors still hang and whose beds still stand would read more as a fortress found than as a stockpile. And the world map names a ruined site only in its region panel, so a player choosing a site cannot see at a glance where the old fortresses stood.

## What to do

Decide which built furniture a ruin keeps standing (doors, hatches, beds, tables, chairs, coffins, statues; perhaps workshops as wrecks that deconstruct for a little stone or wood) and record it compactly in the ruin (type, material, tile, orientation), placed by 14 at arrival like the wagon. Keep the record small and the placement deterministic, and keep collapse and looting as 02 § Ruins has them. Draw a ruin mark on the world map for a region with a ruin (and a legend from before T-686), with a legend entry. Spec it in 02 § Ruins, 14 and `ui-screens/menus-and-world.md` § World map.

## Done

- [ ] Tests: a ruin's door and bed stand as buildings on the next embark; a fallen one is not there.
- [ ] Tests: the world map marks a ruined region.
