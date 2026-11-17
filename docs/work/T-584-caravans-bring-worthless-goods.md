# T-584 — Caravans bring the sand, clay and brightleaf they list

**Source:** [T-583's audit of Making Do's reach](../../reports/audits/2026-11-17-t583-making-do-reach.md) § Issues, 2 · **Size:** M · **Needs:** — · **Status:** open

## Why

20 § Goods draws a caravan's goods by weight and skips a good worth nothing (`trade/goods.ts`: `good.value <= 0`), and a request stops at one. Three listed goods are worth nothing: the Mountainhome's sand and the Hillfolk's clay (`soil_load` of `sand` and `clay`, soil of value 0, with no container to add value) and the Wildwood's brightleaf (the `brightleaf` plant has value 0, so its item, multiplier 4000, is worth 0; both of its entries, the herbs and the sundries). None of them came in T-583's twenty three-year fortresses, sixty caravan-years, nor can a request bring them. A site without sand can make no glass, lantern or skylight at all, since the Mountainhome's sand is its only other source; the Wildwood's herbs, the old cure for infection, never arrive.

T-583 tried the plain fix, a value of 1 for sand, clay and peat and 1 for brightleaf (*unmeasured*), with a test that a request brings every good of every list. It moved the simulation more than expected: brightleaf is in the default embark (wealth +20, so the embark's prices and renown move too), and `defence_year` (M8) ended with its squad below three. So it is its own task with its own measurement, not a fix in passing.

## What to do

Give the three materials a value (or price a zero-value good at a floor in the draw only, if their worth in the fortress should stay nothing), and decide what the embark's brightleaf costs. Add the test that every good of every caravan list can be brought by a request and is worth more than nothing (`generateGoods` with each entry's item and material, at a renown whose budget holds the dearest). Run `defence_year`, `defence_seeds`, the sweep and the instrument, and take their references by their rules if they move.

## Done

The values in `materials.md` and `plants.md` (*unmeasured*), the test, the gates and any new references.
