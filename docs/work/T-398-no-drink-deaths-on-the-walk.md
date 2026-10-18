# T-398 — Dwarves with no drink die of hunger or thirst on the way to a distant bank, sheltering or not

**Source:** T-360, [the brook measurement](../../reports/audits/2026-10-18-brook-drinking-under-wildlife.md) § The deaths that are not about water, [data](../../reports/data/2026-10-18-brook-drinking.json) · **Size:** M · **Needs:** — · **Status:** open

## Why

Twelve fortresses with no drink and a brook 38 to 49 tiles from the wagon lost 34 dwarves to `starvation` (hunger or thirst: the death record does not say which) in `dry-north`; 33 of them died 11 or more tiles from the wagon. In five of the twelve seeds the hearth alert sheltered the dwarves (300 to 68,580 ticks) and thirst reached 100, 21 of the deaths; the other 13 are one seed, `wildlife-taiga-3`, that never sheltered (first death on day 101). In the usual opening on the same maps thirst never passed 82. 10 § Behavior selection step 2 lets a sheltering civilian go for a need only at its critical threshold (85 for thirst). At 1.6 a hour that leaves 9.4 hours (470 ticks) to the point of dying; a walk of 43 tiles, in the open and in the animals' ground, does not fit in it.

## What to do

1. Diagnosis first: replay `wildlife-taiga-1` (`dry-north`: hearth held 22,900 ticks), `wildlife-taiga-4` (68,580) and `wildlife-taiga-3` (no shelter) with a probe that logs, for each dwarf that dies of `starvation`, which need was at its maximum, the tick it left the shelter, its thirst then, its path length to the bank, where it stood when the need reached 100 and where it died.
2. If the dwarves leave at 85 and die on the way, apply the decision: a civilian sheltering under a hearth alert who has no drink in reach (no drink on a stockpile or in the hall, no well) leaves for water when thirst reaches the want threshold (50), not the critical threshold. Hunger and rest keep the critical threshold. The change is to 10 § Behavior selection step 2 and its tests; the walk is the player's risk to manage (a well, a still).
3. If the deaths of `wildlife-taiga-3` are hunger (the dry opening keeps its farms and kitchen) and not thirst, file that apart. If they die for another reason (a path that fails, a search limit measured from the dwarf rather than the bank, an errand dropped each time an animal comes in sight), name it against 10 § Drink search and fix that rule instead.

## Done

- The five `dry-north` seeds above have no death by thirst while the dwarves can still reach the bank, or this file records why not; the annual instrument and `dry-west` rows are re-run before and after, and the instrument's hashes only move if the usual opening ever shelters without drink (record it).
