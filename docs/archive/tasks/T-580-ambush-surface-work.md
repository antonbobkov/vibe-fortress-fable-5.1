# T-580 — The three-year fortress works on the surface where ambushes spring

**Closed:** 2026-11-17, in a7cff6fc.

**Source:** [T-576's probe and sweeps](../../../reports/data/2026-11-17-t576-hidden-ambush.md) · **Size:** L · **Needs:** — · **Status:** open

## Why

Since T-576 the three-year script answers an ambush only once it springs, as a player can. Over a sweep's four shifts about 250 ambushes spring instead of 108, and the dwarves dead while one is on the map rise from 174 to about 440: the sweep's deaths went from 104.75 to 165. The ambush springs within `SPOT_RADIUS` (6) of a dwarf at work outdoors, Gloam outrun a dwarf (165 to 180 against 150), and the dwarves caught 12 to 25 tiles from the gate are cut down or bleed out on the way in.

T-576's probe of 36 peril-4 ambushes found, at the spring, the surface dwarves mostly crafting at the surface workshops (0 to 25 tiles from the gate), eating and drinking outdoors, and hauling. A player who loses dwarves to ambushes moves that work below ground, keeps outdoor work near the gate, or posts war dogs (`SPOT_RADIUS_DOG` 10) with the dwarves who must go out; T-563's candles (`CANDLE_SPOT_BONUS` 2) reach only the gate.

## What to do

Measure what each surface activity costs in ambush deaths over a sweep (the journal's census, `three_years_ambush`, with the T-576 probe's notes of where each victim stood at the spring), and move the costliest below ground or within reach of the gate once ambushes are possible (18's schedule preview says from when), as a player could: the workshops into the halls, the food and drink the dwarves take on the surface indoors. Consider war dogs only if those are not enough.

## Done

The sweep's deaths back toward master's before T-576 (104.75 on `df4d8df2`), with the script still answering an ambush only once it springs.
