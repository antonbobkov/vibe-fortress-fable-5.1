# T-663 — No water inside the gate

**Source:** [T-656's report](../../reports/data/2026-11-20-t656-thirst-under-the-alert.md) · **Size:** M · **Needs:** — · **Status:** open

## Why

A fortress out of drink has one place to drink: the brook on the surface (10 § Eating and drinking: a well with water, else a water tile within `DRINK_SEARCH_RADIUS`). The three-year fortress digs its halls at z = 26 under the soil, where no water lies, and the game has no aquifer yet (03 lists it as a later stage). A well needs open water within `WELL_DEPTH` below its tile (14), so the only well a player can build there stands over the brook, outside the gate. When the drink runs out under an alert, as it did for weeks in `three-years-p4-4` and `three-years-p4-5`, the critically thirsty go up through the gate to the brook, and the ambushes waiting there kill them. T-656's script keeps the stills supplied (barrels first, a second woodcutter), but a player who cannot keep up with the brew has no water below ground to fall back on.

## What to do

Find out whether a player can bring water inside with the game as it is: a channel from the brook into a cistern under the gate's walls, held by a floodgate (04, 14), with a well over it inside. Check that the fluids rules let it fill without flooding the halls and that 19's shelter and 10's drink search treat it as an indoor source. If it works, write it into the three-year script where the map's brook is near enough, and measure it in the sweep; if it does not, say what is missing (an aquifer, a pump, a cistern building) and decide whether to add it.

## Done

- [x] A scenario where a fortress with no drink drinks from a well inside its gate under a hearth alert: [`bd_cistern_well`](../../test/scenarios/bd_cistern_well.scenario.ts) ([T-663's report](../../reports/data/2026-11-20-t663-water-inside-the-gate.md)).
- [ ] The sweep's verdict with the script changed: sweep `44850405030` was not judged (shift 100: 19 of 20) and broke its death and peril-0 need-death bounds; the three-year cistern needs another pass (the report's § What is left).
