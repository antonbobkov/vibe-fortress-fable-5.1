# T-453 — A river that ends in a far lake can lie beyond the drink search from the wagon

**Source:** T-449, [the drink reach](../../reports/audits/2026-10-30-drink-reach.md) · **Size:** S · **Needs:** — · **Status:** open

## Why

On 10 of 120 maps with a river from the south edge into a lake, 96 × 96, the nearest bank is 64 to 73 tiles from a wagon on the north edge. That is at or past `DRINK_SEARCH_RADIUS` (64), so a thirsty dwarf at the wagon finds no water, though the bank can be walked to. The site summary and the region filter still say the site has a river. No other river shape in the measurement did this.

The distances come from the spec's arrival edge and lake centre, not from relief, so level maps should behave the same way. The measurement did not cover level maps.

## What to do

Choose one and write it into the owning spec:

- Leave it as it is, since a dwarf already nearer the river finds it, and have the site summary say the water is far from the arrival edge.
- Place the lake's centre, or the river's end, within reach of the arrival edge.

Do not change the drink rule in 10 without measuring what it does to the search's cost (`T-416`).

## Done

- The decision is in the spec, with a test on the shape above.

## Outcome (2026-11-07)

Still there on master `303a109a`: relief 1, river from the south into a lake, seeds 0 to 10 of the T-449 measurement: seeds 7, 9 and 10 find no water from the wagon, nearest bank 65 to 67 tiles. At relief 0 seed 7's nearest bank is 64, so level maps do it too.

Chosen: the lake's centre lies in the half of the map on the arrival edge's side (03 § Local map generation stage 2, `local-map-generation.md`), as a spring already keeps to the half away from its outflow. The drink rule of 10 is unchanged. Re-measured, 40 seeds of this shape at each of reliefs 1 to 3: the search finds water from the wagon on 120 of 120 maps, the nearest bank at most 35 tiles away (31, 35, 34 by relief), at most 8 levels. A test holds seeds 7, 9 and 10 at reliefs 0 and 1 and fails on the old placement. The three-year fixture and the instrument's maps have no lake; no golden moved.
