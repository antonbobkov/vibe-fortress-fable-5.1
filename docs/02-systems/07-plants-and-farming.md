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
- **Light rule**: surface species need `lit` tiles; cave species need dark tiles. This is the whole reason underground farming works in winter and surface farming does not. Glowcap also needs a glowstone lamp over its dark tile.

## Rules

### Species table (content) and the properties used here

`kind`, `growSeasons` (surface species; cave species have no growing season, but still need `minC ≤ temperatureAt(tile)`), `stageDays` (days per stage at 100% growth), `minC`, `maxC`, `light: sun | dark | any | glow`, `yieldItem`, `yieldCount: [min, max]`, `seedItem` (always the `seed` item type with the species as material), `secondaryYield` (for example `flax` → `flax_fiber` plus a seed-cake food unit), `logs` (trees), `regrowDays` (shrubs), `wildSeedPermille` (chance a gathered wild shrub gives a seed), `biomes` with weights, `caverns` with weights, `glyph`, `fg`.

The species fixed by this design (properties in `plants.md`):

- Trees: `oak`, `pine`, `birch`, `willow`, `yew`, `ash`, `maple`; fungus trees: `tower_shroom`, `stalk_fern`.
- A rare cavern shrub: `glowcap_patch`.
- Shrubs: `bramble` (berries), `brightleaf` (medicine herb), `nutbush` (nuts), `wild_barley`, `wild_strawberry`, `wild_flax`, `sunfruit` (savanna), `frostberry` (tundra and taiga); cavern shrubs: `dimcap_patch`, `pale_bell_patch`, `sweetroot_patch`, `cavewheat_patch`, `sporecloth_patch`.
- Surface crops: `barley` (ale, flour), `turnip`, `cabbage`, `strawberry` (food and wine), `flax` (fiber and seed oil), `pumpkin` (autumn), `hops` (improves ale).
- Cave crops: `dimcap` (food and dimcap ale), `cavewheat` (flour and cavewheat beer), `pale_bell` (bellwine), `sweetroot` (food and rootwine), `sporecloth` (thread), `glowcap` (rune, by way of the laboratory).

### Growth

Growth is accumulated once per game hour (this system's cadence) for every crop and sapling:

```
growthPerHour(plant, tile) =
  if not seasonAllows(plant, season) or not lightOk(plant, tile) or not tempOk(plant, tile): 0
  else BASE_GROWTH × weather.growthModifier() / 100        // growthModifier includes season and weather; 100 = normal
```

A stage is `stageDays × HOURS_PER_DAY × BASE_GROWTH` units long; when the accumulator crosses it the stage advances and the accumulator keeps the remainder. Stage 3 begins after three stage lengths, but its accumulator continues through the fourth. A crop is ready only once the mature stage has completed, after four stage lengths at normal growth; `plants.cropReady(tile)` is the readiness query used by harvest jobs, harvest designation and the mature-crop blink. Cave crops use a growth modifier of 100 in every season and ignore weather, but not temperature: a cave plot one or two levels below the surface in a cold region falls under a crop's `minC` in winter, and its crops stand still (dormant, not dead) until it warms, while a plot `NEAR_SURFACE_DEPTH` or more levels below the surface stays at `UNDERGROUND_BASE_C` all year (05 § Temperature model). A dimcap or cavewheat plot (`minC` 2) one level down in a taiga winter, with the surface at −12 °C, is −5 °C and does not grow; two levels down it is 2 °C at that surface temperature and below 2 °C on colder nights.

- `seasonAllows`: surface crops grow only in their `growSeasons`; outside them they are dormant (not dead). Outside their growing seasons, `temperatureAt(tile) < FROST_KILL_C` kills surface crops (`CropDied { reason: frost }`), which clears the tile for spring.
- `lightOk`: `sun` needs crop light; `dark` needs it clear; `glow` needs it clear and the tile under a lamp (`buildings.lampCoveredAt`) or in the 3×3 of a creature that wears a piece with a `light` effect (25 § Enchantments in combat: the `glowing` stone), on the same level; `any` ignores both. A worn light is read only here, at the hour's growth of a `glow` crop on a dark tile with no lamp: it moves with its wearer, so a glowcap under a glowing dwarf standing still grows and stops when the dwarf walks on; it does not make a plot a glow plot (§ Farm plots), set the `lit` flag or touch the lamp coverage of 14. `buildings.cropLitAt` reads the original light bit recorded under lamp coverage, otherwise the `lit` flag; lamp comfort light does not alter crop eligibility. A crop whose light is wrong, such as a glowcap that loses its lamp, stops growing and does not die.
- `tempOk`: `minC ≤ temperatureAt(tile) ≤ maxC`.
- Heatwave wilting (06): each heatwave hour a surface crop at stage ≥ 1 loses one stage with `WILT_PERMILLE`.

### Farm plots

- A `farm_plot` zone can be drawn over tiles that are `floor` with material class `soil`, or with the `mud` flag, or cavern `cave_loam`. Tiles that do not qualify are excluded from the zone and shown in red during placement.
- `SetPlotCrop` accepts 0 for none, or a known farmed plant id or nonnegative integer index; malformed or unknown choices reject as `not_found`, and a mismatched light requirement rejects as `light_mismatch`. The four-slot zone setting uses this same validation for every slot before storing the normalized indices.
- Settings: one crop per season (four plant indices under `Zone.settings.crop_per_season`, 0 = none), each `none` or a species whose light requirement matches the plot (the UI filters: a plot with any `lit` tile is a surface plot; a plot with no `lit` tile is a cave plot, and a glow plot when every one of its tiles is under a lamp; mixed plots are refused). `dark` species grow on cave and glow plots, `glow` species only on glow plots, `any` species on all three. One lamp in the middle of a 3×3 plot gives eight planted tiles, since the lamp stands on the ninth.
- A plot tile that a built building covers is not plantable: the producer creates no `plant` job for it and cancels one it made.
- Each hour, for each plantable plot tile without a crop, if the season's species is set and a seed exists in a stockpile or on the ground (13 `findItem(seedItem)`), the plants job producer creates `plant { tile, species }` (labor `farming`, skill `farming`); if no seed exists, the plot is marked `needsSeeds` once per season with a note.
- `plant` job: fetch the seed, walk to the tile, work `PLANT_TICKS` (skill-scaled), consume the seed, create the `Crop` entity at stage 0.
- `harvest` job: created for crops with their fourth stage complete when `autoHarvest` (11 standing order) is on, or when the player designates harvest. Work `HARVEST_TICKS`; spawn `yieldCount` of `yieldItem` (rolled, +1 per 5 farming skill levels, capped at `yieldMax + 2`) and exactly `SEEDS_PER_HARVEST` seeds, plus the secondary yield only when no registry recipe produces that item (workshop conversions such as flour are not free harvest drops); destroy the crop. Harvest by a skilled farmer gives the produce a quality tier used only for meal quality (13).
- A crop on a tile that stops qualifying (construction placed, tile dug, flooded to level ≥ 4) dies.
- Removing the zone kills its crops and returns nothing.

### Seeds

Seeds come from: harvest (always `SEEDS_PER_HARVEST`), gathering wild shrubs of crop species (`wildSeedPermille`), the embark catalog, caravans. Brewing, cooking and eating do not return seeds. This keeps the seed economy legible: one harvest, one seed, always.

### Trees

- A `tree` tile is one tile; it blocks movement and fluids; `chop` (03) turns it into `floor` and drops `logs` logs of the species (material `wood` with the species as the material row: each tree species is also a wood material with its own value and color).
- A `sapling` tile grows into a `tree` after `saplingYears` (from `saplings: Map<tile, plantedTick>`), checked daily. While any creature occupies the tile, or a building is planned on it, keep the mature sapling and its planted tick; retry growth on the next daily pass after the tile clears. A sapling is walkable. A building may be placed on it (14 § Placement): the builder uproots it, and it leaves nothing. The chop tool also takes a sapling (03).
- Regrowth: each `DayPassed`, for `REGROWTH_TRIES_PER_DAY` random outdoor soil floor tiles with `grass` and no tree or sapling within 2 tiles, plant a sapling of a species drawn from the biome's tree weights with probability `biome.treeDensity × REGROWTH_PERMILLE`. A stockpile tile is no exception: the tree that grows there takes the tile's slot (13 § Stockpiles). Cavern floors do the same for fungus trees within the cavern band.
- Trees never spread onto farm plots, roads or constructed floors.

### Shrubs

- Wild shrubs are gatherable when `mature`. `gather` (03) yields `yieldCount` of `yieldItem` and, with `wildSeedPermille`, one seed; the shrub enters `regrowing` for `regrowDays` (tracked in `shrubTimers`), then returns to `mature`. Regrowing shrubs are drawn dimmer.
- Shrubs on burning tiles are destroyed (05).
- A building may be placed on a shrub (14 § Placement): the builder uproots it, and the shrub leaves what `gather` would leave if it is `mature`, and nothing if it is `regrowing`.
- A `gather` zone (09) auto-designates mature shrubs inside it.

### Grass

- Outdoor soil floors start with `grass`. Cavern `cave_loam` floors start with `grass` (cave moss, drawn in a different color but the same flag).
- Grazing (08) clears the flag; one tile feeds one grazer, and 08 holds the tile as claimed until the flag is gone, so the tile cannot be eaten twice. Regrowth: each `DayPassed`, every tile in `bareSoil` (a sorted set maintained from grazing events and construction removal) with at least one cardinal `grass` neighbor regrows with `GRASS_REGROW_PERMILLE`, except outdoors in winter and on `ash` or `snow` tiles.
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
- `plants.plotAt(i)`, `plants.plotSettings(zoneId)`, `plants.plotKind(zoneId)` (`surface | cave | glow | mixed`)
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

Job producer `plants` (`plant`, `harvest`); inspector sections `tile › plant` and `zone › farm plot` (settings, crops by stage, seeds available, tiles too cold for the crop); announcement `PlotNeedsSeeds` as a note; announcement `CropDied` with `reason: frost` as a note, one line per plot and crop per frost, its count merged ("Frost killed 12 plants of strawberry on Farm plot #3.": the kills of one crop on one plot within `LOG_DEDUP_TICKS` or the same day count up in one line).

## Player-facing behavior

- Zones menu › Farm plot: drag a rectangle; qualifying tiles highlight green, others red; confirm. The plot panel shows four season slots with species drop-downs filtered by light, a seed count per species, and the crops on the plot by stage. When tiles of the plot are below the minimum temperature of the crop growing or chosen there for the current season, a note under the crop counts them ("Too cold to grow: 4 of 9 tiles are under 2°C for dimcap.") and, under it, says that rock `NEAR_SURFACE_DEPTH` levels below the surface stays warm all year.
- On a surface plot, a red note under those says when a season's crop cannot ripen before its growing seasons end, so that winter's frost would kill it and its seed: the current season's crop sown today ("Sown now, strawberry cannot ripen before its seasons end: it needs 28 days, 9 are left."), and each other season's crop sown on that season's first day ("Sown in summer, strawberry cannot ripen before its seasons end: it needs 28 days, 25 are left at most."), which covers a `Shift+A` that gives a crop a season it cannot ripen in. A crop needs four stages of `stageDays`; the days left are its growing seasons' days to winter, the first less `SOWING_MARGIN_DAYS` (3) for the sowing, each counted at the season's growth percent as if overcast (06 § Seasons: spring 100, summer 120, autumn 80, × 90), rounded down. A temperate reckoning: `frostmarrow`'s colder seasons are not counted. The choice stays the player's.
- A frost that kills crops is a note in the log, one line per plot and crop ("Frost killed 12 plants of strawberry on Farm plot #3.").
- Crops draw as the species glyph with foreground `grass_green` dimmed by 3, 2, 1, 0 for stages 0–3. Once ready, the foreground is `green` for one 500 ms frame per four-frame (two-second) cycle until harvested.
- Trees `♣`, `♠` and `↑` by species; saplings `τ`; shrubs `"` in species color; grass as a `grass_green` foreground on the floor glyph; cave moss uses `moss_teal`. Grass in `cold_steppe`, `tundra`, `savanna`, `desert` and `badlands` uses `grass_dry` foreground; outdoors its glyph, tint and flowers vary by tile (23 § Compositor step 2).
- Hints: "Farms need soil or mud", "Cave crops grow in the dark, but in a cold region a cave within two levels of the surface freezes in winter", "Harvest returns one seed; brewing does not".

## Tuning constants

| Name | Value | Meaning |
|---|---|---|
| `BASE_GROWTH` | 100 | Growth units per hour at 100% (measured: a dimcap takes 16.04 days from sowing to harvest, [farm yield](../../reports/audits/2026-10-18-farm-yield.md)) |
| `PLANT_TICKS` | 40 | Base work time; measured, 41 ticks normalised to skill 0 ([work pace](../../reports/audits/2026-10-18-work-pace.md)) |
| `HARVEST_TICKS` | 40 | Measured: 41 ticks normalised to skill 0 ([work pace](../../reports/audits/2026-10-18-work-pace.md)) |
| `SEEDS_PER_HARVEST` | 1 | Measured: 208 harvests returned 208 seeds ([farm yield](../../reports/audits/2026-10-18-farm-yield.md)) |
| `REGROWTH_TRIES_PER_DAY` | 40 | Candidate tiles per day for saplings (*unmeasured*) |
| `REGROWTH_PERMILLE` | 200 | Multiplied by biome tree density (0–1) (*unmeasured*) |
| `GRASS_REGROW_PERMILLE` | 120 | Per bare tile per day with a grass neighbor |
| `SAPLING_YEARS` | 2 | Default; species may override (*unmeasured*) |
| `CLEAR_PLANT_TICKS` | 20 | Work added to a build job per sapling or shrub on its footprint (*unmeasured*) |

Species stage lengths, yields, seasons, temperatures and biome weights are content.

## Extension points

- Fertilizer: a plot setting and an item; multiply growth. The growth formula has one place to add it.
- Multi-tile trees: see 03.
- Crop rotation or soil exhaustion: a per-tile counter in this system's state and a factor in the growth formula.
- Orchards: trees as a crop kind with yearly yields; the harvest job already handles per-tile yields.


## Planned: Making Do

Not yet in the game. Each block below is a rule of the Making Do content and names the task that builds it. That task moves its block into the sections above as plain specification (its constants into § Tuning constants, its events, commands and readers into § Interfaces) and deletes it here; the last one deletes this section. Every number here is *unmeasured*. The rows named are in `plants.md` § Planned rows and the other content documents' § Planned rows.

### The new species (T-548)

- Surface crops `rye` (grows from `minC` −2 in spring, summer and autumn: the cold region's grain, where barley's 4 °C fails; 2–4 a harvest against barley's 3–5) and `nettle` (a fiber crop: its harvest is `fiber` of `nettle_fiber`, no farmer's step). Shrubs `reed_bed`, `barrel_cactus`, `wild_nettle`, `wild_rye`, `rock_lichen`, `salt_crust`, `wild_wyrmtongue`; tree `ironwood`. All are placed at generation by 03's conversion passes (03 § Planned, Stage 9 conversions), never by the biome weights of stage 9 or by regrowth, so existing maps and their regrowth draw the same numbers. No ironwood sapling ever grows by itself: an ironwood felled is gone.
- **Straw.** A crop row with a `straw` count (barley, rye, cavewheat: 1) drops that many `straw` of its own material at each harvest, beside the seed, whatever recipes exist. Straw is a `stuffing` (bedding, 14 § Planned) and pallet material.
- **Wyrmtongue grows on ash.** A crop or shrub row marked `ash` (wyrmtongue) can be sown only on an *ash tile*: a tile with the `ash` flag, or a floor of material `ash_soil`. Every other crop still cannot be sown on a tile with the `ash` flag. A plot is a wyrmtongue plot when every tile is an ash tile; `SetPlotCrop` refuses wyrmtongue elsewhere (`not_on_ash`). A wyrmtongue harvest renews its tile's ash (the tile's `ashTiles` clear tick becomes `ASH_DURATION_DAYS` from now), so a field kept in wyrmtongue stays ash. Ash on `ash_soil` is the material and never clears. Burning a field to farm it is the trick (05's fire, 03's `ignite`).
- **Ironwood is hard to chop.** `chop` takes `CHOP_BASE_TICKS × max(100, hardness) / 100` of the tree's wood: every wood of today (hardness ≤ 65) chops as now, ironwood (200) at twice the time. jobs.md's `chop` row changes with it.
- **Grazable shrubs.** A shrub row with `graze` (`rock_lichen`, `salt_crust`, `barrel_cactus`) is grazing for tame grazers when mature (08 § Planned): eaten, it enters `regrowing` for its `regrowDays` (56 for lichen against grass's daily chance), as gathering does. 08 emits `ShrubGrazed { tile }`; this system sets the timer. Wild grazers do not eat shrubs.
- Events: `ShrubGrazed { tile }` (consumed). Commands: `SetPlotCrop` gains the refusal `not_on_ash`. Save: none new (`shrubTimers`, `ashTiles` exist).

### Flowers (T-555)

- `plants.flowerAt(i)` — the tile is an outdoor grass floor that carries a flower: the same test 23's compositor uses to draw one (a hash of the tile against the biome's `flowers` share, `regions-biomes-and-traits.md` § Biome surface). The test moves into a pure helper in `core/` that both call, so the simulation never reads the renderer. A grazed or snowed tile has no flower while it lacks grass or carries snow.
- Beehives count flowers (08 § Planned).

### Under a skylight (T-558)

- A surface (`sun`) crop on a `skylit` tile (03 § Planned) ignores `seasonAllows`, uses a growth modifier of 100 and ignores weather, as a cave crop does; it still needs `minC ≤ temperatureAt ≤ maxC`. Outside its seasons it is not killed by frost, and heatwave wilting passes it by. The plot of such tiles is a surface plot (its tiles are `lit`).
- The greenhouse is these rules with 05's: one level under a skylight in a temperate winter a plot is 3 °C (cabbage grows, barley does not); inside the hearth's square 5 °C (barley and flax grow); beside a magma channel anything grows; three levels down every surface crop grows all year at `UNDERGROUND_BASE_C`.
- The ripening note of § Player-facing behavior says nothing for a plot whose tiles are all skylit.

### The beetle jar (T-556)

- `lightOk` for a `glow` crop on a dark tile with no lamp and no worn light: the tile is beetle-lit when one of its four cardinal neighbours on its level holds a built cage building whose occupant's species has the flag `glows` (the `glow_beetle`). A beetle-lit tile grows at `BEETLE_GROWTH_PERCENT` of the rate. Beetle light is crop light only: no `lit`, no comfort.
- A plot is a glow plot when every tile is under a lamp or beetle-lit (`buildings.beetleLitAt`, 14 § Planned).
- Constants: `BEETLE_GROWTH_PERCENT` 50.

### Fertilizer (T-NEW (compost))

- Farm plot setting `fertilize` (boolean, default off; `SetZoneSetting` and the plot panel). While it is on, each `plant` job takes one item tagged `fertilizer` (`dung`, `compost`, `guano`, `bone_ash`) as a second input when one is available, and plants without one when none is (the job does not wait). The crop records it (`Crop.fertilized`), and its harvest yields `FERTILIZER_YIELD_BONUS` more, beyond the skill cap too.
- Constants: `FERTILIZER_YIELD_BONUS` 1. Save: `Crop.fertilized` (absent: false). UI: the plot panel's `Fertilize: on/off` and the count of fertilizer in stock.
- The extension point "Fertilizer" is taken: a plot setting and an item, adding to the yield, not to growth.
