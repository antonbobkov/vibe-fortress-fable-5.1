# 06 Weather & Seasons

**Owner:** `systems/weather` · **Depends on:** [`../01-architecture/simulation-core.md`](../01-architecture/simulation-core.md), [01-world-generation.md](01-world-generation.md), [05-materials-and-temperature.md](05-materials-and-temperature.md)

## Purpose

Turn the calendar into changing surface conditions: temperature, daylight, precipitation, snow, storms, fog, and the seasonal modifiers that plants, dwarves, animals and threats read.

## Concepts

- **Climate**: the biome's four seasonal base temperatures and daylight hours, from the biome table, adjusted by the region's `tempC` and temper.
- **Weather state**: one of `clear`, `overcast`, `rain`, `storm`, `snow`, `fog`, `heatwave`, `cold_snap`.
- **Transition table**: per season and temper, the probability of moving from each state to each other state when the current state's duration ends.
- **Snow cover**: a flag on outdoor tiles set while snowing and cleared by melt.
- **Daylight**: sunrise and sunset hours per season.

## Rules

### Seasons

The calendar defines the seasons. This system defines what they mean:

| Season | Growth multiplier (surface) | Daylight (temper 0–1) | Daylight (temper 2–4) | Notes |
|---|---|---|---|---|
| spring | 100% | 6–19 | 7–18 | Thaw; rivers run; planting |
| summer | 120% | 5–21 | 6–20 | Heatwaves possible at temper ≥ 2 |
| autumn | 80% | 6–19 | 7–18 | Harvest; the restless dead on `old_battlefield` |
| winter | 0% | 8–17 | 9–16 | Surface farming stops; snow; cold snaps at temper ≥ 2 |

The growth multipliers are measured ([farm yield](../../reports/audits/2026-10-18-farm-yield.md)): a turnip takes 20.8, 17.3 and 26.4 days from sowing to harvest when sown in spring, summer and autumn. The daylight hours are *unmeasured*.

`frostmarrow` uses winter for every seasonal lookup in autumn and spring as well (temperature, temper spread, daylight, growth, transition row and extreme-weather constraints); its summer growth multiplier is 80%, and rain or storm becomes snow.

### Surface temperature

`surfaceTempC(hour) = seasonBase + dayCurve(hour) + weatherDelta + temperSpread`:

- `seasonBase = biome.seasonTemp[season] + (region.tempC − biome.referenceTempC)`, so a warm region of a biome is warmer in every season.
- `dayCurve`: the fixed `DAY_CURVE_C` table of rounded straight lines, −6 at hour 4 rising to +6 at hour 15 over 11 hours, then falling to −6 at the next hour 4 over 13 hours.
- `weatherDelta`: clear 0, overcast −2, rain −3, storm −4, snow −2, fog −1, heatwave +10, cold_snap −12.
- `temperSpread`: temper × 1 added in summer and subtracted in winter, widening extremes for harsh regions.

The value is computed once per weather tick (every 50 ticks, one game hour) and cached; 05 reads the cache.

### Weather transitions

Each weather state has a duration rolled from its range in the content table (`4..36` hours by state). When it ends, the next state is drawn from the transition row `[season][temper][currentState]` from the content table. Constraints applied after the draw use the cached temperature of the previous hour, before computing the new hour’s temperature:

- `snow` requires `surfaceTempC ≤ SNOW_C`; otherwise it becomes `rain`.
- `rain` and `storm` with `surfaceTempC ≤ SNOW_C` become `snow`.
- `heatwave` only in summer at temper ≥ 2; `cold_snap` only in autumn and winter at temper ≥ 2.
- `thunderhead` doubles the probability mass of `storm` in every row and renormalizes.
- `serene_vale` removes `storm`, `heatwave` and `cold_snap`.

### Effects of each state

| State | Effects |
|---|---|
| `clear` | none |
| `overcast` | growth −10% for surface plants (07 reads `weather.growthModifier()`) |
| `rain` | sets `wet` on outdoor tiles (per chunk, cleared after `WET_DURATION_HOURS` of no rain); sets `mud` on outdoor soil floors; dwarves outdoors get the `caught_in_rain` trigger once per hour outside (10 emits `DwarfOutdoorsIn { weather }`); fire spread reduced (05) |
| `storm` | as rain; each hour `LIGHTNING_PER_HOUR_PERMILLE` chance of a strike at a random outdoor tile weighted toward trees and tall creatures: emit `LightningStrike { tile }` (05 ignites; 17 applies damage to a creature on the tile); caravans keep moving; outdoors thought is worse |
| `snow` | lays `snow` on outdoor tiles per chunk each hour; movement cost on snow tiles ×`SNOW_MOVE_COST_PERCENT` (22); grazing blocked on snow (08); surface crops dormant |
| `fog` | raid warning distance halved (18 reads `weather.visibilityModifier()`); hunters' effective range −2 (09) |
| `heatwave` | thirst rises ×1.5 (10 reads `weather.thirstModifier()`); surface crops have `WILT_PERMILLE` per hour to lose one growth stage (07) |
| `cold_snap` | outdoor water freezes (05 via temperature); outdoor thought `bitter_cold`; grazers lose condition faster (08) |

Weather visits exposed tiles in ascending chunk index, then ascending tile index within each chunk. A chunk column groups the 16×16 map columns at every level. An exposed tile is outdoor, not `open`, and has no unfrozen liquid; sky tiles are excluded. Rain wets every exposed tile, and mud begins on exposed soil floors from the second consecutive rain or storm hour. Lightning weights a tree by `LIGHTNING_TREE_WEIGHT`, otherwise a tile with a creature of size class at least `WADE_LARGE_SIZE` by `LIGHTNING_TALL_WEIGHT`, otherwise by 1; the tree weight takes precedence over a creature on it.

### Snow cover

- While `snow`, each weather tick sets `snow` on all outdoor tiles in `SNOW_CHUNKS_PER_HOUR` randomly chosen uncovered chunk columns (so cover builds over a few hours), marking every chunk of each selected column that has an exposed tile until all such columns are covered.
- Snow lying on the map when it is generated (03 stage 9) is snow cover: at start, every chunk with an exposed tile that has `snow` is a covered chunk.
- Each weather tick, if `surfaceTempC > MELT_C`, clear `snow` in `SNOW_CHUNKS_PER_HOUR` randomly chosen covered chunk columns. Melting snow sets `mud` on soil floors.
- Emit `SnowCoverChanged { chunks[] }` for 05 (overrides) and 23 (redraw).

### Rivers and lakes

Freezing is 05's decision; this system only provides the temperature. In winter at temper ≥ 1 the river freezes for most of the season; at temper 0 it freezes only during cold snaps, which do not occur, so it never freezes. A frozen river is walkable and blocks fishing.

### Daylight

`calendar.isDaylight` is set by this system each weather tick from the daylight table, with `sunrise ≤ hour < sunset`. Night effects: dwarves prefer to sleep (10 schedule), outdoor visibility for hunting and for spotting scouts is halved (18), wild nocturnal species are active (08).

The cached surface temperature, growth modifier and daylight are recomputed each weather tick and once more when the arrival sets the calendar to its starting hour, which happens after this system's `init`.

## State

- `state`, `stateEndsTick`, `surfaceTempCached`, `growthModifierCached`, `isDaylightCached`, `snowCoveredChunks: SortedSet`, `wetChunks: Map<chunk, lastRainTick>` (both use chunk indices).
- `started` records the first duration roll; `rainHours` counts consecutive rain/storm hours; `forced` holds a test-forced state, or `null` to release it for transition at the next weather tick. The local map spec supplies `tempC`, falling back to the biome’s `referenceTempC` when absent.
- Rng stream.

## Interfaces

### Reader

- `weather.state()`, `weather.surfaceTempC()`, `weather.isDaylight()`
- `weather.growthModifier()` (percent, season × state), `weather.thirstModifier()`, `weather.visibilityModifier()`
- `weather.isSnowCovered(i)` (reads the flag), `weather.isWet(i)`
- `weather.forecast()` — the current state's remaining hours (shown to the player; no true forecast)
- `weather.daylightHours()` — today's daylight window `[sunrise, sunset)` in hours, for the calendar panel
- `weather.snowCoveredChunks()` — the chunks with snow cover, ascending (23 redraws them)

### Commands

None.

### Events consumed

`HourPassed` (drives the tick logic at cadence 50, aligned to the hour), `SeasonChanged`.

### Events emitted

`WeatherChanged { from, to }` (only when the state changes), `LightningStrike { tile }`, `SnowCoverChanged { chunks[] }`, `SeasonEffectsChanged { season }` (after `SeasonChanged`, once modifiers are recomputed; 07 and 18 subscribe to this rather than to `SeasonChanged` so they see updated modifiers).

### Registrations

Announcements: `WeatherChanged` to `storm`, `snow`, `heatwave`, `cold_snap` as notes ("A storm rolls in from the west."); `SeasonChanged` as a note with the season line ("Spring, Year 2. The river runs again."); inspector section `tile › weather` for outdoor tiles.

## Player-facing behavior

- Status bar: a weather glyph and word (`☼ clear`, `≡ fog`, `* snow`, `↯ storm`) and the temperature in °C.
- Surface rendering: rain draws `'` glyphs on a few random outdoor open cells per frame (presentation-only animation); snow cover draws white backgrounds on floors; fog dims the surface by one shade; night dims outdoor tiles by two shades.
- The calendar panel (from the status bar date) shows the season, the day, daylight hours, and the current weather with its remaining hours.

## Tuning constants

| Name | Value | Meaning |
|---|---|---|
| `SNOW_C` | 0 | At or below this, precipitation is snow |
| `MELT_C` | 2 | Above this snow melts (*unmeasured*) |
| `WET_DURATION_HOURS` | 6 | *unmeasured* |
| `LIGHTNING_PER_HOUR_PERMILLE` | 250 | Per storm hour (*unmeasured*) |
| `SNOW_CHUNKS_PER_HOUR` | 8 | Of 36 outdoor chunks per level at standard size (*unmeasured*) |
| `SNOW_MOVE_COST_PERCENT` | 150 | *unmeasured* |
| `WILT_PERMILLE` | 50 | Per heatwave hour per surface crop (*unmeasured*) |

Biome climate rows, state durations and transition tables are content (`regions-biomes-and-traits.md` and `weatherTables`).

## Extension points

- Wind: a direction and strength field read by fire spread and projectiles; add to the state and the transition table.
- Multi-year climate drift: a yearly offset added to `seasonBase`.
- Weather forecasting as a skill: expose the next drawn state one day ahead when a dwarf with a skill exists.
