# T-335 — Grazers starve beside a pasture tile they cannot reach

**Source:** T-330, the pasture player path ([`../../test/scenarios/pp_pasture.scenario.ts`](../../test/scenarios/pp_pasture.scenario.ts)) · **Size:** S · **Needs:** — · **Status:** open

## The fault

A tame grazer that is hungry walks to the nearest grass tile of its pasture (`grassForTame`, `src/systems/animals/tame.ts:131`), measured by straight distance, with no look at whether it can get there. A pasture drawn over a forest meadow can hold a grass tile shut in by trees or shrubs: walkable, so the zone takes it (08 § Pastures: "tiles must be walkable"), but in no walker's region. The walk to it fails as unreachable, and ten ticks later the next think picks the same tile again (`tame.ts:223-225`). The animal stands still beside the meadow until it starves.

## Trace

Seed `pp-pasture`, the compact 48 × 48 forest Serene Vale of `test/scenarios/player-path.ts`, the Farmstead embark (two cows, two sheep, two goats). The pasture is the 320 grass tiles nearest the wagon to its south; 2 of them are not reachable from the wagon. Every grazer is assigned to it on day 0.

- Day 3: all six are at condition 100; `AnimalStarving` for each.
- Day 12: all six die of starvation (`ANIMAL_STARVE_DAYS` 10). No `GrassGrazed` fell inside the pasture in 28 days.

A probe on the same seed, with the pasture drawn instead as the grass of the 20 × 20 square south of the wagon, shows the step: from day 1, once condition passes 40 (`CONDITION_EAT_ABOVE`), a grazer at (25, 6, 32) is given (25, 8, 32) as its grass tile on every think. `connectivity.reachable` from its tile to that one is false and `findPath` finds no route; its `Motion.pathId` stays 0 and it does not move again. Four of the six stood like this from the first day; the other two grazed twice and then did the same.

## Decision

A grazer picks only grass it can reach: `grassForTame` skips a tile whose walker region differs from the animal's (`readers.pathing` labels), and so does the unassigned grazer's `grassNear`. Spec: one clause in 08 § Pastures and feeding ("the nearest grass tile of its pasture that it can reach").

## Found while fixing (2026-10-16)

With only the region filter, `pp_pasture` still starved its herd (4 tiles grazed in 28 days). The grazers chose the nearest grass by straight distance on every think (every 10 ticks); where trees stood between, one step along the path made another tile the nearest, whose path ran the other way, and the animal turned back: a cow at (23, 6) went to (24, 6) and back for days, aiming at (21, 8) and (22, 8) in turn. Decision added: a grazer keeps walking to the grass it chose while that tile stays uneaten, unclaimed, in its pasture and in its region (08 § Pastures and feeding, `creature-brains.md`). Both parts are needed: without either, `pp_pasture` fails.

## Done

- `pp_pasture` passes and its `todo` is removed; a unit test with a grass tile shut in by trees, named T-335, fails without the change.
