# T-484 — A cave plot one level down freezes through a taiga winter

**Closed:** 2026-11-02, in 529e16de.

**Source:** T-481 ([report](../../../reports/audits/2026-11-02-taiga-1-food-margin.md)) · **Size:** S to M, by the decision · **Needs:** the owner's decision below · **Status:** open (decision needed)

## Why

[plants.md](../../03-content/plants.md) § Growth arithmetic says "cave plots produce all year", and the farm hint says "cave crops grow in the dark all year". The temperature rules say otherwise for a shallow cave in a cold biome, and the game follows the rules:

- 05 § Temperature model blends the surface temperature into `UNDERGROUND_BASE_C` (10 °C) over `NEAR_SURFACE_DEPTH` (3) levels. One level down, the tile is the surface temperature plus a third of the way to 10 °C.
- A taiga winter's surface is −12 °C, with a daily swing of ±6 and weather of −1 to −4. One level down, that is about −7 °C at midnight (measured), −9 °C before dawn and −1 °C at the warmest hour of a clear day. Dimcap needs `minC` 2 (07 § Growth), so it does not grow at all from day 85 to day 112.
- Taiga has two soil layers, so its natural soil for a cave plot is one level down. Deeper soil needs mud.

In the annual instrument every taiga seed's dimcap plot is one level under the surface, and in every taiga seed the crops stand still through the winter (T-481's journals of taiga seeds 1 and 3: the same 20 crops at the same stages from day 85 to day 112). The fortress eats its autumn store. Taiga seed 3 ends the year with 6 drinks, 1 meal and 1 plant for 13 dwarves; taiga seed 2 ended at 12, 0 and 1 in the accepted T-464 row, with 11 starving notes. After T-481's opening fix, taiga seed 1 ends with 78, 36 and 22.

## Decision needed

One of these, by the owner:

1. **The rules stand; the text is wrong.** Taiga's winter is meant to be hungry. Correct plants.md and the hint ("cave plots deep enough below the surface produce all year"), and have the farm plot panel say when its tiles are too cold for its crop. Recommended: it keeps the temperature model, which is consistent, and tells the player what the game does.
2. **Shallow caves are warmer.** Change `NEAR_SURFACE_DEPTH` (marked unmeasured) or the blend so one level down stays above 2 °C in a taiga winter. This moves every cold-biome map, the surface creatures' comfort underground and the fluids' freezing, and needs its own measurement.
3. **Cave crops tolerate cold.** Lower dimcap's `minC`. This is a content tune on one figure, made because of one biome.

Whichever is chosen, the instrument's taiga player keeps its present orders until the owner decides whether a cold-biome player should store more before winter.

## Done

- The decision is in the spec, the text matches what the game does, and a unit test pins the temperature of a dimcap tile one level under a taiga winter surface and whether it grows.
- If the rules change: the annual instrument by the T-308 rule.

## Decision (orchestrator, 2026-11-02)

Keep the temperature rules; the cold is real and makes depth matter in a cold region. Correct the spec text in `plants.md` and the hint so they no longer promise "all year": say that shallow caves in a cold region freeze in winter and deeper ones stay warm, and give the depth or temperature in words a player can act on. Add a "too cold to grow" note to the farm plot panel when a plot's crop is below its minimum. No numbers change, so the instruments should not move; show that they do not.
