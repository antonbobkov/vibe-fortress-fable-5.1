# Diagnosis: a wildfire burns the dwarves of a fortress on a map with a brook

**Task:** T-397 · **Date:** 2026-10-18 · **Commit examined:** codex-a `057089c` and the same tree with the dwarves' flight from fire · **Kind:** diagnosis with one rule change · **Source:** [the brook measurement](2026-10-18-brook-drinking-under-wildlife.md) § The deaths that are not about water

## The answer

- **A storm on day 33 lights grass 70 tiles from the fortress, and the fire crosses the map.** `wildlife-taiga-3` with a brook entering at the west edge: three lightning strikes at ticks 39,107, 39,257 and 39,407 on grass and trees at x 71 to 78, y 64 to 89 (05 ignites a strike whatever the ground's wetness). Grass and trees are one fuel over the 96 by 96 map; with 15% a neighbour every 30 ticks (`FIRE_SPREAD_PERMILLE`, `FIRE_SPREAD_COOLDOWN`) the front crosses it from east to west in about ten days, 260 to 410 tiles burning at a time, and reaches the fortress's surface patches (workshops, hospital beds, stockpiles) on days 39 to 42.
- **Nothing makes a dwarf leave.** 05 § Fire gives a creature on a burning tile `BurnDamage` and keeps creatures off burning tiles in pathfinding; 10 § Behavior selection step 1 flees only hostile creatures. Ten dwarves took 17 to 34 consecutive `BurnDamage` events on one tile each, and seven died: patients resting in the hospital beds (the squad's wounded), a carpenter at its bench. `wildlife-taiga-2` burns the same way on days 54 to 56.
- **The rule that fire spreads was working as written; the gap is the dwarves'.** Dwarves now flee fire (10 § Behavior selection, before step 1; 05 § Fire).

## What was run

`reports/data/2026-10-18-fire-deaths.probe.ts.txt` (a fixture hook added in T-398, `observe`): `playWildlifeYear('wildlife-taiga-3', 'taiga', { brook: 'west' })` from day 15, logging each `LightningStrike`, `FireStarted`, `FireSpread`, `FireOut`, every 100 ticks the burning tiles (count, extent, kinds), each `BurnDamage` with the dwarf, its tile, behaviour, activity and consciousness, and each fortress death. Before: `.vite/t397b.json`; after, the same run with the change.

## Results

| `wildlife-taiga-3`, west brook, usual opening | Before | After |
|---|---|---|
| Dwarves taking `BurnDamage` | 10 | 0 |
| Dwarf deaths by fire | 7 | 0 |
| Fire deaths of animals | 2 | 1 |

Annual instrument (usual opening, no river), before and after the change: median 13, sum of the living 143, minimum 5, second-worst 9, 8 of 12 without a wildlife dwarf death, no extinction, no hunger or thirst death; 10 of the 12 world hashes identical, two (`wildlife-temperate_forest-1`, `wildlife-temperate_grassland-4`) move with the same living counts.

The first version of the search (256 tiles, `CIVILIAN_FLEE_NODE_LIMIT`) found no ground that cannot burn from the middle of a grass field and left three patients in their beds; the search is 2048 tiles (`FIRE_FLEE_NODE_LIMIT`). The squad's soldiers on duty were the patients: excluding them left them burning.

## What this does not measure

- Why the river maps and not the others: the storm of day 33 is on this map's calendar; the twelve maps without a river have no death by fire.
- An unconscious dwarf in a burning bed: it cannot flee and no job carries it out.
- The animals: they burn as before.
- Fire reaching a dwarf in a room with a wooden floor or a wooden door: such a tile is burnable (05) and the flight applies, but no case was run.
