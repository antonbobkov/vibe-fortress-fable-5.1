# 07 Plants & Farming

**Owner:** `systems/plants` · **Depends on:** [03-terrain-and-mining.md](03-terrain-and-mining.md), [05-materials-and-temperature.md](05-materials-and-temperature.md), [06-weather-and-seasons.md](06-weather-and-seasons.md), [11-jobs-and-labor.md](11-jobs-and-labor.md), [13-items-and-storage.md](13-items-and-storage.md), [14-buildings-and-rooms.md](14-buildings-and-rooms.md)

## Purpose

Grow things. Trees for wood, shrubs for gathering, grass for grazing, crops on farm plots for food, drink, thread and medicine, and cave flora in the dark. Give the player a farming loop that is simple to run and rewards planning around seasons and light.

## Concepts

- **Plant kind**: `tree`, `fungus_tree` (cavern wood), `shrub` (wild gatherable), `crop` (surface farm plant), `cave_crop` (underground farm plant), `grass`.
- **Wild plant**: a tile of kind `tree`, `sapling` or `shrub` whose `material` is the material-table index of the plant species. Terrain plant facts are indexed by this material index, rather than by the plants table's index. Grass is a flag.
- **Crop**: an entity on a farm plot tile with a species, a stage and growth progress.
- **Stage**: crops have four stages `0 sprout, 1 growing, 2 ripening, 3 mature`; saplings have one long stage; shrubs are `mature` or `regrowing`.
- **Farm plot**: a zone whose tiles are farmable; each tile holds at most one crop; the plot has a crop choice per season.
- **Light rule**: surface species need `lit` tiles; cave species need dark tiles. This is the whole reason underground farming works in winter and surface farming does not.

## Rules

### Species table (content) and the properties used here

`kind`, `growSeasons` (surface species; cave species grow in all seasons), `stageDays` (days per stage at 100% growth), `minC`, `maxC`, `light: sun | dark | any`, `yieldItem`, `yieldCount: [min, max]`, `seedItem` (always the `seed` item type with the species as material), `secondaryYield` (for example `flax` → `flax_fiber` plus a seed-cake food unit), `logs` (trees), `regrowDays` (shrubs), `wildSeedPermille` (chance a gathered wild shrub gives a seed), `biomes` with weights, `caverns` with weights, `glyph`, `fg`.

The species fixed by this design (properties in `plants.md`):

- Trees: `oak`, `pine`, `birch`, `willow`, `yew`, `ash`, `maple`; fungus trees: `tower_shroom`, `stalk_fern`.
- Shrubs: `bramble` (berries), `brightleaf` (medicine herb), `nutbush` (nuts), `wild_barley`, `wild_strawberry`, `wild_flax`, `sunfruit` (savanna), `frostberry` (tundra and taiga); cavern shrubs: `dimcap_patch`, `pale_bell_patch`, `sweetroot_patch`, `cavewheat_patch`, `sporecloth_patch`.
- Surface crops: `barley` (ale, flour), `turnip`, `cabbage`, `strawberry` (food and wine), `flax` (fiber and seed oil), `pumpkin` (autumn), `hops` (improves ale).
- Cave crops: `dimcap` (food and dimcap ale), `cavewheat` (flour and cavewheat beer), `pale_bell` (bellwine), `sweetroot` (food and rootwine), `sporecloth` (thread).

### Growth

Growth is accumulated once per game hour (this system's cadence) for every crop and sapling:

```
growthPerHour(plant, tile) =
  if not seasonAllows(plant, season) or not lightOk(plant, tile) or not tempOk(plant, tile): 0
  else BASE_GROWTH × weather.growthModifier() / 100        // growthModifier includes season and weather; 100 = normal
```

A stage is `stageDays × HOURS_PER_DAY × BASE_GROWTH` units long; when the accumulator crosses it the stage advances and the accumulator keeps the remainder. Stage 3 begins after three stage lengths, but its accumulator continues through the fourth. A crop is ready only once the mature stage has completed, after four stage lengths at normal growth; `plants.cropReady(tile)` is the readiness query used by harvest jobs, harvest designation and the mature-crop blink. Cave crops use a growth modifier of 100 in every season and ignore weather.

- `seasonAllows`: surface crops grow only in their `growSeasons`; outside them they are dormant (not dead). Outside their growing seasons, `temperatureAt(tile) < FROST_KILL_C` kills surface crops (`CropDied { reason: frost }`), which clears the tile for spring.
- `lightOk`: `sun` needs crop light; `dark` needs it clear; `any` ignores it. `buildings.cropLitAt` reads the original light bit recorded under lamp coverage, otherwise the `lit` flag; lamp comfort light does not alter crop eligibility.
- `tempOk`: `minC ≤ temperatureAt(tile) ≤ maxC`.
- Heatwave wilting (06): each heatwave hour a surface crop at stage ≥ 1 loses one stage with `WILT_PERMILLE`.

### Farm plots

- A `farm_plot` zone can be drawn over tiles that are `floor` with material class `soil`, or with the `mud` flag, or cavern `cave_loam`. Tiles that do not qualify are excluded from the zone and shown in red during placement.
- Settings: one crop per season (four plant indices under `Zone.settings.crop_per_season`, 0 = none), each `none` or a species whose light requirement matches the plot (the UI filters: a plot with any `lit` tile is a surface plot; a plot with no `lit` tile is a cave plot; mixed plots are refused).
- Each hour, for each plot tile without a crop, if the season's species is set and a seed exists in a stockpile or on the ground (13 `findItem(seedItem)`), the plants job producer creates `plant { tile, species }` (labor `farming`, skill `farming`); if no seed exists, the plot is marked `needsSeeds` once per season with a note.
- `plant` job: fetch the seed, walk to the tile, work `PLANT_TICKS` (skill-scaled), consume the seed, create the `Crop` entity at stage 0.
- `harvest` job: created for crops with their fourth stage complete when `autoHarvest` (11 standing order) is on, or when the player designates harvest. Work `HARVEST_TICKS`; spawn `yieldCount` of `yieldItem` (rolled, +1 per 5 farming skill levels, capped at `yieldMax + 2`) and exactly `SEEDS_PER_HARVEST` seeds, plus the secondary yield only when no registry recipe produces that item (workshop conversions such as flour are not free harvest drops); destroy the crop. Harvest by a skilled farmer gives the produce a quality tier used only for meal quality (13).
- A crop on a tile that stops qualifying (construction placed, tile dug, flooded to level ≥ 4) dies.
- Removing the zone kills its crops and returns nothing.

### Seeds

Seeds come from: harvest (always `SEEDS_PER_HARVEST`), gathering wild shrubs of crop species (`wildSeedPermille`), the embark catalog, caravans. Brewing, cooking and eating do not return seeds. This keeps the seed economy legible: one harvest, one seed, always.

### Trees

- A `tree` tile is one tile; it blocks movement and fluids; `chop` (03) turns it into `floor` and drops `logs` logs of the species (material `wood` with the species as the material row: each tree species is also a wood material with its own value and color).
- A `sapling` tile grows into a `tree` after `saplingYears` (from `saplings: Map<tile, plantedTick>`), checked daily. A sapling is walkable and is trampled (removed) if a building is placed on it.
- Regrowth: each `DayPassed`, for `REGROWTH_TRIES_PER_DAY` random outdoor soil floor tiles with `grass` and no tree or sapling within 2 tiles, plant a sapling of a species drawn from the biome's tree weights with probability `biome.treeDensity × REGROWTH_PERMILLE`. Cavern floors do the same for fungus trees within the cavern band.
- Trees never spread onto farm plots, roads or constructed floors.

### Shrubs

- Wild shrubs are gatherable when `mature`. `gather` (03) yields `yieldCount` of `yieldItem` and, with `wildSeedPermille`, one seed; the shrub enters `regrowing` for `regrowDays` (tracked in `shrubTimers`), then returns to `mature`. Regrowing shrubs are drawn dimmer.
- Shrubs on burning tiles are destroyed (05).
- A `gather` zone (09) auto-designates mature shrubs inside it.

### Grass

- Outdoor soil floors start with `grass`. Cavern `cave_loam` floors start with `grass` (cave moss, drawn in a different color but the same flag).
- Grazing (08) clears the flag. Regrowth: each `DayPassed`, every tile in `bareSoil` (a sorted set maintained from grazing events and construction removal) with at least one cardinal `grass` neighbor regrows with `GRASS_REGROW_PERMILLE`, except outdoors in winter and on `ash` or `snow` tiles.
- Constructions, roads and farm plots clear `grass` permanently while they exist.

### Ash

05 sets `ash`; this system clears it after `ASH_DURATION_DAYS` (checked daily on the `ashTiles` set) and restores nothing else; grass regrows afterwards by the normal rule.

## State

- `crops`: entities with `Crop`; index `cropAtTile: Map<TileIndex, EntityId>`.
- `plots`: zone ids indexed here. `SetPlotCrop` is applied by 07 and stores four plant indices (0 = none) in the zone's `crop_per_season` setting; it rejects a light mismatch. This system stores `plotIndex` and `needsSeedsAnnounced`, not a second copy of the zone's choices.
- `saplings: Map<TileIndex, plantedTick>`, `shrubTimers: Map<TileIndex, matureTick>`, `bareSoil: SortedSet<TileIndex>`, `ashTiles: Map<TileIndex, clearTick>`.
- Rng stream.

## Interfaces

### Reader

- `plants.cropAt(i)`, `plants.cropInfo(id)` (species, stage, progress percent)
- `plants.plotAt(i)`, `plants.plotSettings(zoneId)`, `plants.plotKind(zoneId)` (`surface | cave`)
- `plants.speciesAt(i)` for tree, sapling, shrub tiles; `plants.shrubReady(i)`
- `plants.hasGrass(i)`
- `plants.def(speciesId)`
- `plants.crops()` — every crop, ascending id; `plants.cropReady(i)` — the crop on the tile is ready to harvest
- `plants.plots()` — the farm plot zones, ascending id
- `plants.saplings()` — the sapling tiles, ascending
- `plants.grassIsDry()` — the region's biome has dry grass (`03-content/plants.md` § Grass)
- `plants.bareSoil()` — the tiles waiting for grass to regrow, ascending; `plants.ashTiles()` — the tiles whose ash has not expired, ascending

### Commands

`SetPlotCrop { zoneId, season, speciesId | none }`, `DesignateHarvest { tiles }` (also reachable through 03's designation menu as `harvest`).

### Events consumed

`HourPassed` (growth), `DayPassed` (saplings, regrowth, grass, ash), `SeasonEffectsChanged`, `TilesChanged` (crop validity, bare soil), `ZoneChanged` (plots), `GrassGrazed { tile }` (from 08), `JobCompleted` for `plant`, `harvest`.

### Events emitted

`CropPlanted { tile, species }`, `CropHarvested { tile, species, count, farmerId }`, `CropDied { tile, reason }`, `PlotNeedsSeeds { zoneId, species }`, `SaplingGrew { tile, species }`, `ShrubRegrown { tile }`, `GrassRegrown { tiles[] }` (batched).

### Registrations

Job producer `plants` (`plant`, `harvest`); inspector sections `tile › plant` and `zone › farm plot` (settings, crops by stage, seeds available); announcement `PlotNeedsSeeds` as a note.

## Player-facing behavior

- Zones menu › Farm plot: drag a rectangle; qualifying tiles highlight green, others red; confirm. The plot panel shows four season slots with species drop-downs filtered by light, a seed count per species, and the crops on the plot by stage.
- Crops draw as the species glyph with foreground `grass_green` dimmed by 3, 2, 1, 0 for stages 0–3. Once ready, the foreground is `green` for one 500 ms frame per four-frame (two-second) cycle until harvested.
- Trees `♣`, `♠` and `↑` by species; saplings `τ`; shrubs `"` in species color; grass as a `grass_green` foreground on the floor glyph; cave moss uses `moss_teal`. Grass in `cold_steppe`, `tundra` and `savanna` uses `grass_dry` foreground.
- Hints: "Farms need soil or mud", "Cave crops grow in the dark all year", "Harvest returns one seed; brewing does not".

## Tuning constants

| Name | Value | Meaning |
|---|---|---|
| `BASE_GROWTH` | 100 | Growth units per hour at 100% |
| `PLANT_TICKS` | 40 | Base work time |
| `HARVEST_TICKS` | 40 | |
| `SEEDS_PER_HARVEST` | 1 | |
| `REGROWTH_TRIES_PER_DAY` | 40 | Candidate tiles per day for saplings |
| `REGROWTH_PERMILLE` | 200 | Multiplied by biome tree density (0–1) |
| `GRASS_REGROW_PERMILLE` | 120 | Per bare tile per day with a grass neighbor |
| `SAPLING_YEARS` | 2 | Default; species may override |

Species stage lengths, yields, seasons, temperatures and biome weights are content.

## Extension points

- Fertilizer: a plot setting and an item; multiply growth. The growth formula has one place to add it.
- Multi-tile trees: see 03.
- Crop rotation or soil exhaustion: a per-tile counter in this system's state and a factor in the growth formula.
- Orchards: trees as a crop kind with yearly yields; the harvest job already handles per-tile yields.
