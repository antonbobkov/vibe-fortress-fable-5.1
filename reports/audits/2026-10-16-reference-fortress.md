# Audit: the reference fortress (T-283)

**Date:** 2026-10-16 · **Examined at:** branch `codex-a`, the commit of T-283 over `e2f0e4d` · **Source of the task:** [`T-283`](../../docs/archive/tasks/T-283-reference-fortress-is-a-fortress.md)

## What was examined

The 80-dwarf reference fixture of the performance tier had no workshop, farm plot, squad, depot, door or trap, so it could not say what a mature fortress costs. T-283 built a new reference fortress (`test/perf/scripted-reference.ts`, saved as `test/fixtures/reference-fortress.deepholm`) with every workshop that has recipes (16, twelve with a standing order), six farm plots (two surface, four cave) with crops and seeds, two squads of six with a barracks each, a hospital, a trade depot, a gate (a door set to lock on alert, a drawbridge on a lever), four cage traps, ten 5×5 stockpiles (three for drink, in barrels), and labors set by profession templates. The first fixture is kept as `test/fixtures/reference-fortress-furniture.deepholm`; the budgets stay measured on it (`performance-budget.md` § Reference fixtures).

## How

`npx vitest run -c vitest.perf.config.ts` on `reference_fortress.test.ts` (contents), `reference_fortress_figures.test.ts` (2,000 ticks after 200 of warm-up, and a season of 33,600 ticks), `perf_reference.test.ts` and `per-system.test.ts`. The machine was shared with another agent's heavy runs, so every timing here is noisy: the same `perf_reference` run on the primary working directory (master) measured worst ticks of 70 and 80 ms on the unchanged fixtures. Read the averages, not the worst ticks.

## Figures (average ms per tick over 2,000 ticks)

| | reference fortress | furniture fixture | played fortress (20 dwarves) |
|---|---|---|---|
| average tick | 28.3 | 4.4 | 0.56 |
| worst tick | 400 | 48 | 34 |
| pathing (22) | 0.46 | 0.47 | 0.04 |
| core | 2.74 | 0.30 | 0.09 |
| 03 terrain | 0.008 | 0.007 | 0.003 |
| 04 fluids | 1.07 | 1.06 | 0.004 |
| 07 plants | 0.0026 | 0.0010 | 0.0026 |
| 08 animals | 0.64 | 0.73 | 0.004 |
| 10 dwarves | 0.61 | 0.68 | 0.14 |
| 11 jobs | **22.0** | 0.70 | 0.09 |
| 12 workshops | 0.0016 | 0.0008 | 0.0005 |
| 13 items | 0.17 | 0.033 | 0.021 |
| 15 morale | 0.082 | 0.086 | 0.009 |
| 16 combat | 0.32 | 0.13 | 0.076 |
| 17 health | 0.0097 | 0.010 | 0.0078 |
| 18 threats | 0.17 | 0.15 | 0.051 |
| 19 defense | 0.0097 | 0.0078 | 0.0024 |
| 20 trade | 0.0020 | 0.0012 | 0.0009 |

Systems 07, 12, 16, 17, 19 and 20 are not exercised on the furniture fixture (no crop, workshop order, squad, wounded dwarf, trap or caravan); the reference-fortress column is their first figure. They are small. The cost of the reference fortress is in system 11.

A season (28 days, 33,600 ticks) on the reference fortress: average tick 26.5 ms, worst 415 ms; no dwarf died (ten tame animals and three others did); 245 `Starving` announcements were made and none became a death.

## What building it found

- **The job board costs 22 ms per tick, against 0.60 ms.** Wrapping the board's producers shows the `workshops` producer alone takes about 30 ms per tick (T-345: it visits every building each tick). Items that wait for a barrel or a bag stay in the haul set and are visited on every tick, about 1.9 ms per 1,000 items (T-344). With the 25,000 single items lying loose and not forbidden, the first tick after loading took 57 s. The fixture forbids them, which keeps them out of both costs.
- **The river cuts the map.** The base fixture puts dwarves on both banks; the half on the far bank could not reach any food and starved. The new builder moves them to the settlement's side.
- **Dwarves drink only from barrels in a stockpile (or from a well or water within reach).** Ale standing loose in a stockpile is not drinkable; a fortress without barrels, a well or water nearby has its dwarves thirsty from the third day with thousands of drinks in stock. This is the rule of `activities.ts`, not a defect, but the first fixture hid it because water was in reach.
- The average tick of the reference fortress (28 ms) is far above the target of 6 ms; no budget of the table is gated on it until T-345 and T-344 are done.

## New work

- T-345 [The workshops job producer visits every building every tick](../../docs/archive/tasks/T-345-workshops-producer-visits-every-building.md)
- T-344 [Item haul planning costs time in proportion to the items that wait](../../docs/archive/tasks/T-344-haul-planning-cost-scales-with-waiting-items.md)
