# T-199 — The still waits for an empty barrel while every barrel holds food

**Source:** T-144 and its report, [`../../reports/audits/2026-10-10-wants-without-errands.md`](../../reports/audits/2026-10-10-wants-without-errands.md) (§ What got worse, item 4) · **Size:** S · **Needs:** — · **Status:** in progress; cloud agent on `cloud/T-199`

## Why

In `year_one` the party's five barrels hold drink, food and seed in a stockpile that accepts everything. When the drink is gone the barrels still hold food and seed. The brew order then reads `waiting for barrel` (`src/systems/workshops/operate.ts`, `problem`) with plants in stock and nobody thirsty yet. On master the wait starts on day 22 and the still makes one brew in the year. On the T-144 branch it lasted all of the first 20 days until the fixture was given a barrel order.

A new player meets this in the first season: drink runs out beside a built still and a stock of plants, and the only sign is the order's waiting reason.

## Decision

Decide between, and write into `12` § Work orders or `13` § Containers:

- **A brew may empty a barrel.** When no barrel is empty, the brewer takes the barrel with the fewest items that are not drink, and its contents are put on the stockpile floor.
- **Or the game tells the player.** A `WorkshopBlocked` announcement that names the missing empty barrel, and a hint that points at the carpenter.

The second is the smaller change and is the default if the owner does not choose.

**Decided (cloud agent, 2026-10-10): the game tells the player.** The default above, for three reasons. It is the smaller change. Dwarf Fortress players expect a brew to need an empty barrel and to make barrels for it. And a brew that tips food onto the floor would quietly break the stockpile settings the player made. The announcement names the missing empty barrel and fires once per wait, not every tick; a hint points at the carpenter's barrel recipe. The barrel order T-144 added to `year_one` stays.

## What to do

1. Scenario, written to fail first: a still, plants, five barrels each holding one stack of food, a brew order. Under the first decision a brew is made; under the second the announcement fires once and names the barrel.
2. Remove the barrel order T-144 added to `test/scenarios/year_one.scenario.ts` if the first decision is taken.

## Done

- The scenario passes, with `describe('T-199 …')`.
