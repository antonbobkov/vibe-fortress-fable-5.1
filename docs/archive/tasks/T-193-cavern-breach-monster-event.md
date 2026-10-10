# T-193 — Initial cavern monsters emit no MonsterSpawned event upon cavern breach

Closed by `T-193: announce cavern monsters when a breach wakes them`.

**Source:** T-154 and its run of `descent.scenario.ts` · **Size:** S · **Needs:** — · **Status:** open

## Why

[`docs/02-systems/18-threats-monsters-and-raids.md`](../../02-systems/18-threats-monsters-and-raids.md) § Cavern monsters specifies:
> Each cavern band has an initial population spawned asleep at generation and placed at random floor tiles ... A breach wakes the sleeping monsters of that cavern.
And under § Events:
> `MonsterSpawned { id, cavern }` (note if far, alert if a path to dwarves exists).

When `CavernBreached` is triggered in `src/systems/threats/caverns.ts:218–232` (`wakeCavernMonsters`), sleeping monsters have their behavior state changed from `'asleep'` to `'wander'`, but no event is emitted (neither `MonsterSpawned` nor any announcement). `MonsterSpawned` is only emitted during daily respawns in `respawnCavernMonsters` (`src/systems/threats/caverns.ts:363–367`). Consequently, when a fortress breaches a cavern, players and scenarios cannot observe a `MonsterSpawned` event for the newly awakened cavern creatures.

## Reproduction

In scenario `descent` (seed `descent`, standard-size local map, wealth 3, peril 1, igneous), breach Cavern 1 at tick ~1471 (`tile: 170135`, cavern 1). `CavernBreached` and `TilesDiscovered` events are delivered, but `events('MonsterSpawned')` is empty.

Read:
- `src/systems/threats/caverns.ts:218–232`: `wakeCavernMonsters` awakens sleeping monsters without emitting any event.
- `src/systems/threats/caverns.ts:363–367`: `respawnCavernMonsters` emits `MonsterSpawned` only on respawns.
- `docs/02-systems/18-threats-monsters-and-raids.md` § Cavern monsters & § Events.

## What to do

1. In `wakeCavernMonsters` (`src/systems/threats/caverns.ts`), emit `MonsterSpawned { id, cavern: tier }` when awakening cavern monsters upon `CavernBreached`, or emit a designated notification/event per spec § 18.
2. Add a focused unit/scenario test in `test/unit/threats/` verifying that `CavernBreached` delivers `MonsterSpawned` for the awakened monsters.
3. Update `descent.scenario.ts` / `descent_fortress.ts` to assert `MonsterSpawned`.

## Done

- `MonsterSpawned` is delivered when cavern monsters are awakened upon `CavernBreached`.
- `npm test` passes.
