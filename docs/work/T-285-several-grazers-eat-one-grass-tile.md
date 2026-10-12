# T-285 - Several grazers get feeding relief from one grass tile

**Source:** [Pasture capacity measurement](../../reports/audits/2026-10-12-pasture-capacity-and-winter-feeding.md), shared-grass probe. **Size:** S. **Needs:** none. **Status:** open.

## Reproduction

The [saved probe](../../reports/data/2026-10-12-t285-shared-grass-probe.test.ts.txt) places two cows, two sheep and two goats at condition 42 on one grass tile. After 20 ticks all six have condition 17, while just one GrassGrazed event removes the physical tile. AnimalsSystem queues a unique tile in grazedPending, but thinkTame grants every same-tick eater its own CONDITION_PER_GRASS relief before 07 clears it.

## Proposed resolution

One physical grass tile feeds at most one grazer before it is cleared. Pin that rule with the reproduction as a failing regression. Make the pending grass claim reject or defer additional consumers, through 08's existing pending-grazing path without having 08 write 07's grass flags. Keep pending claims deterministic across save/load and release them when the normal grass change is delivered. Add a control with two distinct grass tiles and verify later regrowth may be eaten again. Do not change condition rates, pasture capacity or long fixtures. Fold the consumption rule into 08 Pastures and feeding and 07 Grass.

## Done

The one-tile reproduction grants relief to one animal only, with one physical consumption; distinct tiles and later regrowth still work. All six static checks, npm test, whole browser suite and the twelve-seed before/after measurements pass.
