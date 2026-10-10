# T-192 — Wild animals never spawn in year >= 1

Closed by `T-192: wild animals spawn`.

**Source:** T-153 and its run of `homestead_year.scenario.ts` · **Size:** S · **Needs:** — · **Status:** open

## Why

[`docs/02-systems/08-animals-and-domestication.md`](../../02-systems/08-animals-and-domestication.md) § Wild spawning specifies:
> "Each day at dawn (`TICK_HOUR === 6`), for each biome present on the surface and each eligible species from `creatures` whose `season` includes the current season..."

In `src/systems/animals/index.ts:476` (`daily(ctx)`):
```ts
const season = ctx.readers.calendar.year * 4 + ctx.readers.calendar.season;
```
In year 1, this evaluates to `season = 4` (Spring), `5` (Summer), `6` (Autumn), `7` (Winter).

However, in `src/systems/animals/facts.ts:144` (`surfaceSpecies(biome, season)`):
```ts
if (row.season !== undefined && !row.season.includes(season)) continue;
```
In `src/content/creatures.json`, all seasonal wild animals (`badger`, `deer`, `fox`, `rabbit`, `wild_horse`) specify seasons within `[0, 1, 2, 3]` (the four season indices: 0 = Spring, 1 = Summer, 2 = Autumn, 3 = Winter).

Because `row.season.includes(season)` checks whether `[0, 1, 2, 3]` includes `4`, `5`, `6`, or `7`, it always evaluates to `false`. As a result, `surfaceSpecies` returns an empty array `[]` for all biomes in year 1 and later.

Consequently, `dailySpawn` never spawns any wild animals during year 1 or any subsequent year. Because no wild animals spawn, no `hunt` jobs are produced and no `HuntKill` events can occur.

## Reproduction

In scenario `homestead_year` (seed `homestead-year`), simulating throughout year 1 (112 days = 134,400 ticks) results in 0 wild animal spawns across the entire year. Calling `facts.surfaceSpecies('temperate_grassland', 4)` returns `[]`, whereas `facts.surfaceSpecies('temperate_grassland', 0)` returns `['badger', 'deer', 'fox', 'rabbit', 'wild_horse']`.

## What to do

1. In `src/systems/animals/index.ts:476`, compute season modulo 4 (`ctx.readers.calendar.season`) when passing season to `surfaceSpecies`, or ensure `surfaceSpecies` compares against `season % 4`.
2. Verify that wild animals spawn daily according to their biome and season in year >= 1.
3. Add a unit test verifying that wild animals spawn in year 1 and year 2.

## Done

- Wild animals spawn in year >= 1.
- `npm test` passes.
