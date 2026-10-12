# T-210 — A pasture at its stated capacity is eaten bare

Closed by `T-210: pasture capacity includes a reserve for grass regrowth`.

**Source:** T-196 and [`2026-10-10-wild-animals-and-civilians.md`](../../../reports/audits/2026-10-10-wild-animals-and-civilians.md) § Livestock · **Size:** M · **Needs:** — · **Status:** open

## Why

A cow and two sheep starved on day 56 of a `defence_year` run (T-151). T-196 did not reproduce those deaths (the stage that reaches day 56 is not on master), but it measured why a pasture runs out: the numbers of 07 and 08 do not let a pasture feed the grazers 08 says it can hold, and the shared fortress fixture's pasture is smaller than that.

## Reproduction

The pasture probe saved with the report (`reports/data/2026-10-10-t196-probe-pasture.test.ts.txt`, run with `vitest.t196.config.ts` from the same folder): two cows, two sheep and two goats assigned to a pasture on a generated temperate grassland map at peril 0, from spring, 60 days.

- 20 tiles: grass gone on day 30; all six at condition 100 on day 32; 14 starving notes by day 60; no death, because eating one regrown tile resets the ten-day count.
- 36 tiles (08's capacity for six): grass fell from 35 to 4 by day 60.

## What the spec says

- 08 § Pastures and feeding: condition rises `CONDITION_PER_HOUR` (2) per hour; a grass tile lowers it by `CONDITION_PER_GRASS` (25); the pasture warns above `grass tiles / GRASS_PER_GRAZER` (6) grazers; `ANIMAL_STARVE_DAYS` (10) at 100 kills.
- 07 § Grass: a bare tile with a grass neighbour regrows with `GRASS_REGROW_PERMILLE` (120) per day, never outdoors in winter.
- So a grazer needs about 1.9 tiles a day and six tiles regrow at most 0.72 a day.

## What to do

1. Decide the intended steady state (how many tiles a grazer needs through summer, and what feeds grazers in winter, when no outdoor grass regrows) and change `GRASS_PER_GRAZER`, `GRASS_REGROW_PERMILLE` or the condition rates so the capacity rule is true; measure before and after with the probe.
2. The shared fortress fixture (`test/scenarios/three_years_fortress.ts` § Surface pasture) makes at most 20 tiles for six grazers. Its owner (T-145 / T-156) sizes it to the rule, or assigns fewer animals.

## Done

- The capacity warning of 08 is true over a summer: a pasture at capacity keeps its grazers below condition 100.
- The winter case is decided and written in 08.
- Balance numbers changed only with a before-and-after measurement in a dated report.
