# T-579 — Loot that escapes with a raider is left inside a container that no longer exists

**Source:** the orchestrator, 2026-11-17, from T-556's runs · **Size:** S · **Needs:** — · **Status:** open

## Why

In the pooled sweep, seed `three-years-p4-5` at shift 0 breaks the invariant `item.container-missing (bag)` from tick 210000 (day 175), right after a 26-strong siege that ended "looted". It breaks on master too (run 44035076684, shift 0 only) as well as on T-556's branch (run 44035466814), so it predates T-556; the master timeline only began to reach it after the recent merges.

T-556's agent traced it: when a fleeing raider leaves the map, `removeLeavingEquipment` (`src/systems/items/leaving.ts`) destroys the containers the raider carries but spares the escaped loot, so loot that was inside those containers keeps pointing at a container that is gone.

## What to do

Decide what happens to loot inside a raider's container when the raider leaves: it leaves with the raider (the plain reading of "looted"), or it drops where the raider stood if the container is destroyed. Fix it in one place, write the rule in 13 (items leaving the map) or 18 (raid loot), and add a unit test of a raider leaving with a bag of loot.

## Done

- p4-5 at shift 0 passes its invariants in the pooled sweep, and the verdict passes. The fix moves no golden, or names the ones it moves.
