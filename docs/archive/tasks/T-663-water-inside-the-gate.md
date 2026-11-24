# T-663 — No water inside the gate

**Closed:** 2026-11-24, in cfa1b7bb,55c0032d,fb13b0c6,a1480973,87c33e2e,75d7346d,8bcd5a02,d9a83b31,72ef0ad2,57872ce3,a6c65538.

**Source:** [T-656's report](../../../reports/data/2026-11-20-t656-thirst-under-the-alert.md) · **Size:** M · **Needs:** — · **Status:** open

## Why

A fortress out of drink has one place to drink: the brook on the surface (10 § Eating and drinking: a well with water, else a water tile within `DRINK_SEARCH_RADIUS`). The three-year fortress digs its halls at z = 26 under the soil, where no water lies, and the game has no aquifer yet (03 lists it as a later stage). A well needs open water within `WELL_DEPTH` below its tile (14), so the only well a player can build there stands over the brook, outside the gate. When the drink runs out under an alert, as it did for weeks in `three-years-p4-4` and `three-years-p4-5`, the critically thirsty go up through the gate to the brook, and the ambushes waiting there kill them. T-656's script keeps the stills supplied (barrels first, a second woodcutter), but a player who cannot keep up with the brew has no water below ground to fall back on.

## What to do

Find out whether a player can bring water inside with the game as it is: a channel from the brook into a cistern under the gate's walls, held by a floodgate (04, 14), with a well over it inside. Check that the fluids rules let it fill without flooding the halls and that 19's shelter and 10's drink search treat it as an indoor source. If it works, write it into the three-year script where the map's brook is near enough, and measure it in the sweep; if it does not, say what is missing (an aquifer, a pump, a cistern building) and decide whether to add it.

## Done

- [x] A scenario where a fortress with no drink drinks from a well inside its gate under a hearth alert: [`bd_cistern_well`](../../../test/scenarios/bd_cistern_well.scenario.ts) ([T-663's report](../../../reports/data/2026-11-20-t663-water-inside-the-gate.md)).
- [x] The sweep's verdict: with the cistern on (built as routine work once drink runs short) it cost more than it saved (report § Second pass), so `FortressState.waterInside` is off by default; sweep `45046783384` with it off matches master exactly (1097.25 living / 122.5 deaths, verdict pass, every seed green). CI 45410393455 green.
