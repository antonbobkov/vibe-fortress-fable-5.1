# T-NEW — Frostmarrow's wildlife hook is not implemented

**Source:** T-440 (checking each trait's effects before the region panel names them) · **Size:** S · **Needs:** — · **Status:** open

## Why

`03-content/regions-biomes-and-traits.md` § Region traits gives `frostmarrow` an 08 hook: "adds `yak` (wild, tameable, group 2–4) and `snow_leopard` cap +2", and 01 § Traits says "yaks and snow leopards". 08 does not do it: `src/systems/animals/` has no `frostmarrow` rule, and the `yak` row has no biome weights and is `fortress` by default, so no wild yak ever spawns and the snow leopard cap is the biome's. T-440's region panel therefore names only what 06 does for the trait (winter values in spring and autumn, snow for rain).

## What to do

Implement the hook in 08 § Wild spawning (a wild yak species entry on `frostmarrow` maps, the snow leopard cap +2), or remove it from the trait table and 01. Then add the yaks to the panel's line for the trait (`ui.site.trait.frostmarrow`) and to the site summary's wildlife (`02` § Site summary). Unit test in the animals spawn tests; run the annual instrument, since wildlife caps move the simulation.
