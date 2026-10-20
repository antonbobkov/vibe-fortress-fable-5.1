# T-397 — A fire kills most of a taiga fortress on a map with a brook at the wagon

**Closed:** 2026-10-18, in 64130f0, e18f855.

**Source:** T-360, [the brook measurement](../../../reports/audits/2026-10-18-brook-drinking-under-wildlife.md) § The deaths that are not about water, [data](../../../reports/data/2026-10-18-brook-drinking.json) · **Size:** M · **Needs:** — · **Status:** open

## Why

With a brook entering at the west edge (the wagon's edge), two taiga seeds lose most of the fortress to `burnt` in two days, in both the dry and the usual opening:

| Seed | Variant | Deaths by `burnt` | Days | Others that burn |
|---|---|---:|---|---|
| `wildlife-taiga-3` | `control-west` | 7 dwarves (of 13) | 39 to 41 | a cat and a dog |
| `wildlife-taiga-3` | `dry-west` | 7 | 40 to 41 | not recorded |
| `wildlife-taiga-2` | `control-west` / `dry-west` | 4 / 6 | 54 to 56 | — |

The twelve rows of the annual instrument on the same seeds without a river have no death by fire, and neither has `control-north`. 17 § Injuries gives a `burn` wound to a creature on a burning tile (`BurnDamage`) and to anything struck by lightning; 05 and 06 own fire and lightning. A fortress of 13 that loses seven in two days to fire is either a wildfire the rules let reach the hall, or a fault.

## What to do

1. Diagnosis first: play `wildlife-taiga-3` with `playWildlifeYear(seed, biome, { brook: 'west' })` (the fixture option of T-360) to day 38, then with a probe that logs every tick from there: `BurnDamage` and `LightningStrike` events with the tile, the burning tiles and what is on them, and the weather.
2. Name the cause against 05 (fire, fuel, spread) and 06 (storms, lightning): a lightning strike on dry grass beside the wagon that spreads over the bank and the hall's approach, a hearth or forge fire that escapes onto a wooden floor, or a spread rule that burns without a fuel limit.
3. A game fault: a failing stepped test first, the fix, and the rule in 05 (for example, what may burn and how far a fire spreads over wet ground beside a brook). A rule working as written: say so in this file, and decide whether dwarves flee a burning tile (10 § Behavior selection step 1 names only hostile creatures).

## Diagnosis

Played with `playWildlifeYear(seed, biome, { brook: 'west' })` and a probe that logs every fire and burn event from day 15 ([the report](../../../reports/audits/2026-10-18-fire-deaths-diagnosis.md)). A rule working as written, with a gap in the dwarves' side of it:

1. On day 33 (tick 39,107) a storm strikes three tiles of grass and trees in the east of the map (x 71 to 78, y 64 to 89), 70 tiles from the fortress. 05 § Fire ignites a strike regardless of wet or snow, and spreads fire to every burnable neighbour at 15% per attempt every 30 ticks with nothing to stop it: grass and trees are one continuous fuel over the map, and the fire crosses the 96 by 96 map from east to west in about ten days (260 to 410 tiles burning at a time).
2. The fortress stands on that grass: workshops, the hospital's bedroom, stockpiles and farm plots are on surface patches. Every tile of the fortress burns when the front arrives.
3. Nothing makes a dwarf leave. 05 § Fire gives `BurnDamage` to a creature on a burning tile and keeps creatures off burning tiles in pathfinding, and 10 § Behavior selection step 1 flees only hostile creatures. A crafter keeps crafting, a sleeper keeps sleeping and a patient lies in its bed on the burning tile: each of the dwarves that burn takes 17 to 34 consecutive `BurnDamage` events (170 to 340 ticks) on one tile (`taiga-3`: ten dwarves, seven died; most of them patients resting in the hospital's beds, one at a carpenter's bench). `taiga-2` burns the same way on days 54 to 56.

Which map draws the storm is not determined here: the twelve annual-instrument seeds without a river have no death by fire, and a river map is a different map with the same seed.

## Decision

Dwarves flee fire. 10 § Behavior selection says so before step 1: a conscious dwarf on a burning tile, or on burnable ground with a burning cardinal neighbour or burning tile below it, drops its activity and job and walks to the nearest tile it reaches that is not burning and cannot burn (`FIRE_FLEE_NODE_LIMIT` = 2048 tiles of search), then selects again. A soldier on duty is included (the burnt patients were the squad's); an unconscious dwarf cannot move, and a patient who lost consciousness to a burn stays in its bed. Fire itself is unchanged (no firebreak, no new extinguishing rule): a wildfire still burns a fortress's farms and wooden buildings, and the player's answers (stone floors, a cleared margin, rain) stay. The animals burn as before; fleeing is the dwarves'.

Result: `wildlife-taiga-3` with the west brook plays past days 41 to 50 with no dwarf taking a single `BurnDamage` (before: ten dwarves burnt, seven dead); the one fire death left is an animal. The annual instrument keeps its median 13 and sum of the living 143; two of its twelve world hashes move (a dwarf near a fire now walks away).

## Done

- `wildlife-taiga-3` and `wildlife-taiga-2` with the west brook play past days 41 and 56 without a mass death by fire, or this file records the rule that causes it and the spec says what a player does about it. The annual instrument's hashes do not move (the fix touches only a map with a river).
