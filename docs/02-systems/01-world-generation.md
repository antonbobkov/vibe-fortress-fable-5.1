# 01 World Generation

**Owner:** `systems/worldgen` · **Depends on:** [README.md](README.md), [`../01-architecture/constants.md`](../01-architecture/constants.md), [`../01-architecture/simulation-core.md`](../01-architecture/simulation-core.md)

## Purpose

Produce a world map from a seed: a grid of regions, each with the climate, geology, rivers, civilization proximity, ratings and traits that let the player choose a site and let 03 Terrain build the local map. World generation runs once per game, on demand, and is not part of the tick loop.

## Concepts

- **World**: a square grid of `size × size` regions, `size ∈ {WORLD_SIZE_SMALL, WORLD_SIZE_STANDARD, WORLD_SIZE_LARGE}`. North is row 0. Prevailing wind is from the west.
- **Region**: one grid cell. Everything the game knows about a place before embark.
- **Civilization home**: one region per civilization where its territory is centered. Distance from a home drives caravan travel and raid pressure.
- **Rating**: wealth, peril, temper as integers 0–`RATING_MAX`.
- **Trait**: a named modifier applied to a small share of regions.

## Region record

| Field | Type | Meaning |
|---|---|---|
| `id` | number | `y × size + x` |
| `elevation` | 0–255 | Sea level is `SEA_LEVEL`; mountains ≥ `MOUNTAIN_ELEVATION` |
| `tempC` | integer | Annual mean surface temperature |
| `rain` | 0–255 | Annual rainfall index |
| `biome` | `Id<biomes>` | From the lookup table |
| `geology` | `sedimentary`, `igneous`, `metamorphic`, `mixed` | Rock layer family for local generation |
| `volcano` | boolean | A magma pipe reaches the surface |
| `river` | `{ inflow: Edge[], outflow: Edge | null, class: brook | river | major } | null` | Edges are `n, e, s, w` |
| `lake` | boolean | A lake occupies part of the region |
| `deepness` | 0–255 | Noise controlling cavern size and cave fauna density |
| `wealth`, `peril`, `temper` | 0–4 | Ratings |
| `traits` | `Id<regionTraits>[]` | Zero to two |
| `civDistance` | `Record<Civ, number>` | Travel distance in regions from each civilization's home, over land |
| `nearestEdgeTo` | `Record<Civ, Edge>` | Which local-map edge faces each civilization; used for arrivals |
| `name` | string | Generated place name |

## Rules

### Stage order and rng streams

Generation is a fixed sequence of stages, each with its own rng stream (`worldgen.<stage>`), so that a change in one stage does not change the output of the others:

1. `elevation`
2. `climate` (temperature, rainfall)
3. `biomes`
4. `rivers`
5. `geology` (including volcanoes and deepness)
6. `civilizations`
7. `ratings`
8. `traits`
9. `names`

Each stage reports progress to the app so the world generation screen can draw the map as it fills in.

### Elevation

- Sum four octaves of value noise (integer lattice, fixed-point interpolation) with frequencies `1/32, 1/16, 1/8, 1/4` of the world size and amplitudes `128, 64, 32, 16`.
- Multiply by a continental mask: `1 − (distance from center / (size × 0.55))²`, clamped to `0..1`, so the edges are ocean.
- Normalize to 0–255. `SEA_LEVEL = 96`. Regions below sea level are `ocean`.
- Ensure at least `MIN_LAND_FRACTION` of regions are land and at least one 3×3 cluster of regions has elevation ≥ `MOUNTAIN_ELEVATION`; if not, reseed the stage stream with `seed + attempt` and retry (bounded to 8 attempts, then accept).

### Climate

- `tempC = TEMP_SOUTH − (TEMP_SOUTH − TEMP_NORTH) × y / size − max(0, elevation − SEA_LEVEL) × TEMP_LAPSE_PER_ELEVATION / 100`.
- Rainfall: two octaves of noise scaled 0–255, then a rain shadow: scanning each row west to east, maintain `shadow`; when a region's elevation ≥ `MOUNTAIN_ELEVATION`, set `shadow = RAIN_SHADOW_STRENGTH`; each region's rain is reduced by `shadow`, and `shadow` decays by `RAIN_SHADOW_DECAY` per region. Coastal regions (adjacent to ocean) gain `COAST_RAIN_BONUS`.

### Biomes

A lookup on three bands. Temperature bands: `frozen` (< −5), `cold` (−5..5), `temperate` (5..18), `warm` (18..26), `hot` (> 26). Rain bands: `arid` (< 60), `dry` (60..110), `moderate` (110..170), `wet` (> 170). Elevation bands: `ocean` (< `SEA_LEVEL`), `lowland`, `hills` (≥ `HILLS_ELEVATION`), `mountain` (≥ `MOUNTAIN_ELEVATION`).

The table itself is content (`regions-biomes-and-traits.md`). The biome list, fixed here:

`ocean`, `glacier`, `tundra`, `taiga`, `cold_steppe`, `temperate_grassland`, `temperate_forest`, `wetland`, `temperate_hills`, `mountain`, `alpine`, `savanna`, `desert`, `badlands`, `tropical_forest`, `dark_forest`.

`dark_forest` is not produced by the lookup; it is painted by the civilization stage around the Gloam home. `mountain` and `alpine` cover the mountain band by temperature. Local map generation, weather, plants and animals all key off the biome id.

### Rivers

- Sources: choose `RIVER_COUNT = size / 8` regions at random among those with `elevation ≥ RIVER_SOURCE_ELEVATION` and `rain ≥ RIVER_SOURCE_RAIN`, at least 4 regions apart.
- Trace: from a source, repeatedly move to the lowest cardinal neighbor with lower elevation (ties broken by the stream), stopping at ocean or at an existing river (a confluence) or when no lower neighbor exists (a lake is created there and the river ends).
- Class: the first `BROOK_LENGTH` regions of a river are `brook`; then `river`; after a confluence or beyond `MAJOR_LENGTH`, `major`.
- Each region on a river records its inflow edges and outflow edge.

### Geology, volcanoes, deepness

- Geology: one octave of noise at frequency `1/12` bucketed into the four classes with weights `sedimentary 40%`, `igneous 25%`, `metamorphic 20%`, `mixed 15%`, biased so that mountains lean igneous and metamorphic and lowlands lean sedimentary.
- Volcano: each `mountain` or `alpine` region has `VOLCANO_CHANCE_PERMILLE`; any region with a volcano gets geology `igneous`.
- Deepness: noise 0–255 at frequency `1/10`.

### Civilizations

Homes are placed in order with a preference score over regions and a minimum separation of `CIV_MIN_SEPARATION` regions:

1. **Mountainhome**: highest score for `mountain` and `alpine` regions near the largest mountain cluster.
2. **Gloam**: `badlands` or `taiga` far from the Mountainhome; the eight regions around the home become `dark_forest` if they are land.
3. **Hillfolk**: `temperate_grassland` or `savanna` with a river.
4. **Wildwood**: the largest connected `temperate_forest` or `tropical_forest` area.

Then compute `civDistance` for every region by BFS over land with cost 1 per step (2 through mountains). `nearestEdgeTo[civ]` is the edge on the straight line toward the home.

### Ratings

Each is computed as an integer score then bucketed into 0–4 by fixed thresholds (content).

- **Wealth**: `geologyScore` (sedimentary 1, mixed 2, metamorphic 3, igneous 3) + `volcano ? 2 : 0` + `deepness / 64` + stream noise 0–2.
- **Peril**: `4 − min(4, civDistance.gloam / PERIL_DISTANCE_STEP)` + `deepness / 96` + (biome ∈ {`badlands`, `dark_forest`, `wetland`} ? 1 : 0), clamped.
- **Temper**: (biome ∈ {`glacier`, `tundra`, `desert`, `alpine`} ? 2 : biome ∈ {`taiga`, `badlands`, `savanna`, `mountain`} ? 1 : 0) + (elevation ≥ `MOUNTAIN_ELEVATION` ? 1 : 0) + (rain > 200 ? 1 : 0) + stream noise 0–1, clamped.

`glacier` and `ocean` regions cannot be embarked on. All others can.

### Traits

For each land region, in id order, roll once for a trait from the trait table filtered by requirements (biome list, rating ranges, river or volcano requirements). Each trait has a permille frequency. A region gets at most two traits; a second roll happens only if the first succeeded and the trait allows a companion. The trait list, fixed here with its intent (effects are specified in the systems that implement them and quantified in Wave 3):

| Trait | Requirement | Effect summary |
|---|---|---|
| `serene_vale` | peril 0, temperate biomes, river | Rich soil, extra wildlife, peril fixed at 0, gentle weather |
| `wyrm_roost` | wealth ≥ 3, mountain or hills | A magma wyrm sleeps in cavern three near a deepsilver vein |
| `fungal_depths` | deepness ≥ 160 | Larger caverns, more cave crops and cave beasts |
| `glasslands` | volcano | Obsidian surface, shallow magma pools, few trees |
| `frostmarrow` | frozen or cold | Long winters, snow most of the year, yaks and snow leopards, no surface farming in winter and autumn |
| `old_battlefield` | peril ≥ 2 | Scattered weapons, armor and bones on the surface; restless dead rise on autumn nights |
| `sunken_halls` | hills or mountain | A pre-dug abandoned dwarven hall with furniture and a sealed vault |
| `ironheart` | geology igneous or metamorphic | A very large hematite and magnetite deposit |
| `gemsprings` | wealth ≥ 2, river | Gem clusters near the surface and warm springs that never freeze |
| `thunderhead` | temper ≥ 2 | Storms twice as frequent; lightning fires |
| `beastwood` | forest biomes | Dense and aggressive wildlife; bears and wolves in packs |
| `twilight_pass` | peril ≥ 3 | On the Gloam road: raids twice as frequent, thieves constant |
| `deep_well` | deepness ≥ 120 | Cavern one is mostly a lake; water is everywhere below |

### Names

Region names come from the names table: a biome-flavored word list joined to a landform word (`Coldmere`, `Ashfell`, `Greenhollow`). Names are for flavor and the legend page.

## State

The `WorldMap` record: `size`, `seed`, `regions: RegionRecord[]`, `civHomes: Record<Civ, RegionId>`, `rivers: RiverRecord[]`. It is immutable after generation and saved with the game.

## Interfaces

### Reader

- `world.size()`, `world.region(id)`, `world.regionAt(x, y)`
- `world.regions()` — frozen array in id order
- `world.civHome(civ)`, `world.riverOf(regionId)`
- `world.findRegions(filter: { biomes?, wealth?: [min, max], peril?: [min, max], temper?: [min, max], river?, volcano?, traits? })` — used by the map filter panel

### Commands

None. Generation is invoked by the app: `worldgen.generate(seed, size, onProgress): WorldMap`.

### Events emitted

`WorldGenerated { seed, size }` (dispatched by the app's flow, not by a tick).

## Player-facing behavior

- **World generation screen**: seed field (text; a random seed by default), size selector, a Generate button, a preview that fills in stage by stage, and Continue.
- **World map screen**: the map drawn with biome glyphs and colors; rivers as blue lines; civilization homes as their glyphs; the cursor moves by keyboard or mouse; a side panel shows the region record in words ("Temperate forest. Hills. A river runs east to south. Wealth 3, Peril 1, Temper 1. Trait: Gemsprings."); the filter panel highlights matching regions; Embark opens 02.
- Regions that cannot be embarked on (ocean, glacier) say so.

## Tuning constants

Values confirmed by the Wave 3 balance pass (see [`../03-content/balance.md`](../03-content/balance.md)).

| Name | Value | Meaning |
|---|---|---|
| `SEA_LEVEL` | 96 | Elevation of the sea |
| `HILLS_ELEVATION` | 130 | Start of the hills band |
| `MOUNTAIN_ELEVATION` | 165 | Start of the mountain band |
| `MIN_LAND_FRACTION` | 35% | Retry elevation if less land |
| `TEMP_SOUTH` / `TEMP_NORTH` | 30 / −12 | °C at the south and north edges at sea level |
| `TEMP_LAPSE_PER_ELEVATION` | 22 | °C lost per 100 elevation units above sea level |
| `RAIN_SHADOW_STRENGTH` | 90 | Rain removed immediately east of mountains |
| `RAIN_SHADOW_DECAY` | 18 | Shadow decay per region |
| `COAST_RAIN_BONUS` | 30 | |
| `RIVER_SOURCE_ELEVATION` | 150 | |
| `RIVER_SOURCE_RAIN` | 120 | |
| `BROOK_LENGTH` | 3 | Regions of brook before river |
| `MAJOR_LENGTH` | 12 | Regions before a river becomes major |
| `VOLCANO_CHANCE_PERMILLE` | 40 | Per mountain region |
| `CIV_MIN_SEPARATION` | 10 | Regions between homes |
| `PERIL_DISTANCE_STEP` | 6 | Regions of distance from the Gloam per peril point |
| `TRAIT_MAX_PER_REGION` | 2 | |

## Extension points

- New biome: a row in the biome table plus entries in the plant and creature spawn lists; the lookup table gets the new id.
- New trait: a row with requirements and hooks; the hooks are implemented by 03, 06, 07, 08 and 18 as documented there.
- New civilization: a row in the civilization table and a placement rule here; 20 and 18 read the table for schedules and behavior.
- Different world shapes: the continental mask is one function.
