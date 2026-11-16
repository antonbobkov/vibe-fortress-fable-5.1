# T-555: flowers in a hive's reach, by biome

Making Do (§ 6, Hives) asks for 8 flower tiles within 6 of a hive. The flowers are the biome's `flowers` share of outdoor grass (`regions-biomes-and-traits.md` § Biome surface), at most 3% (temperate grassland). Measured on two generated local maps a biome (`regionSpec('probe-a' | 'probe-b', { biome })`, `generateLocalMap`): for every outdoor soil floor a hive could stand on, the flower tiles within 6 (Chebyshev, its level), counted with 07's `plants.flowerAt` rule (the compositor's test, `core/flowers.ts`).

| Biome | share (‰) | mean flowers in reach | ≥ 3 | ≥ 4 | ≥ 6 | ≥ 8 | most |
|---|---|---|---|---|---|---|---|
| temperate_grassland | 30 | 4.08 / 3.91 | 74.1% / 72.7% | 55.6% / 53.3% | 25.2% / 20.9% | 7.5% / 5.3% | 12 / 11 |
| temperate_hills | 20 | 2.53 / 2.50 | 45.0% / 44.1% | 25.0% / 23.6% | 5.1% / 4.1% | 0.4% / 0.7% | 8 / 9 |
| tropical_forest | 20 | 1.92 / 1.80 | 29.9% / 27.0% | 14.4% / 12.5% | 2.8% / 0.9% | 0.1% / 0.0% | 9 / 7 |
| wetland | 15 | 1.89 / 1.98 | 28.6% / 29.8% | 13.6% / 14.6% | 1.5% / 2.9% | 0.1% / 0.1% | 8 / 8 |
| temperate_forest | 12 | 1.35 / 1.40 | 19.6% / 18.1% | 5.7% / 6.3% | 0.0% / 0.4% | 0.0% / 0.0% | 5 / 7 |
| savanna | 10 | 1.41 / 1.52 | 16.2% / 20.0% | 4.0% / 6.2% | 0.0% / 0.0% | 0.0% / 0.0% | 6 / 5 |
| tundra | 10 | 1.56 / 1.48 | 20.8% / 18.2% | 7.3% / 5.7% | 0.1% / 0.0% | 0.0% / 0.0% | 6 / 5 |
| taiga | 6 | 0.90 / 0.82 | 6.3% / 4.8% | 2.0% / 1.8% | 0.0% / 0.0% | 0.0% / 0.0% | 5 / 4 |
| desert | 0 | 0 / 0 | 0% | 0% | 0% | 0% | 0 |

At 8 a hive works on one soil tile in fifteen of the richest meadow and almost nowhere else: the savanna and the temperate forest, which the design names as honey country, never. `HIVE_FLOWERS_MIN` is 3: a grassland hive works on three tiles in four, a hills hive on nearly half, a forest or savanna hive where the player looks for a meadow (the hive's panel counts the flowers in reach), a taiga hive rarely, and a desert one never. The radius stays 6.
