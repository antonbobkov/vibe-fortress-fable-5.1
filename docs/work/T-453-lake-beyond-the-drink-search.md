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
