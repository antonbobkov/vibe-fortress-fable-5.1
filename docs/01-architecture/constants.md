# Global Constants

**Owner:** architecture · **Depends on:** none

This is the single source for constants that more than one system depends on. A constant that only one system uses lives in that system's document. Later waves may add rows here; they must not change a value without a note in the wave's commit message and a search for every use.

Names are the identifiers to use in code. Values are integers unless stated.

## World scale

| Name | Value | Meaning |
|---|---|---|
| `WORLD_SIZE_SMALL` | 32 | World map side length in regions |
| `WORLD_SIZE_STANDARD` | 64 | Default world size |
| `WORLD_SIZE_LARGE` | 96 | Largest world size |
| `LOCAL_MAP_W` | 96 | Local map width in tiles (x axis) |
| `LOCAL_MAP_H` | 96 | Local map height in tiles (y axis) |
| `LOCAL_MAP_Z` | 48 | Number of z-levels; z = 0 is the bottom |
| `CHUNK_SIZE` | 16 | Side of a chunk in tiles; chunks are one z-level thick |
| `MAGMA_SEA_TOP_Z` | 3 | z-levels 0–3 are the Sea of Fire |
| `CAVERN_3_Z_MIN` / `CAVERN_3_Z_MAX` | 5 / 8 | Band of the third (deepest) cavern |
| `CAVERN_2_Z_MIN` / `CAVERN_2_Z_MAX` | 11 / 14 | Band of the second cavern |
| `CAVERN_1_Z_MIN` / `CAVERN_1_Z_MAX` | 18 / 22 | Band of the first (shallowest) cavern |
| `SURFACE_Z_MIN` | 27 | Lowest surface elevation on any local map |
| `SURFACE_Z_MAX` | 40 | Highest surface elevation on any local map |
| `SKY_Z_MAX` | 47 | Top z-level; always air |
| `DEEPSILVER_Z_MAX` | 6 | Deepsilver veins occur only at z ≤ this value |

## Time

| Name | Value | Meaning |
|---|---|---|
| `TICKS_PER_HOUR` | 50 | |
| `HOURS_PER_DAY` | 24 | |
| `TICKS_PER_DAY` | 1200 | `TICKS_PER_HOUR × HOURS_PER_DAY` |
| `DAYS_PER_SEASON` | 28 | |
| `SEASONS_PER_YEAR` | 4 | Spring, summer, autumn, winter, in that order |
| `DAYS_PER_YEAR` | 112 | |
| `TICKS_PER_YEAR` | 134400 | |
| `SIM_TICKS_PER_SECOND` | 20 | Ticks per real second at speed 1×; one game day per real minute |
| `SPEED_MULTIPLIERS` | 1, 2, 4 | Available speeds besides pause |
| `MAX_TICKS_PER_FRAME` | 8 | Upper bound on ticks simulated in one animation frame; the game slows rather than skipping |
| `START_SEASON` | spring | Embark always happens on day 1 of spring, year 1 |
| `START_HOUR` | 8 | Hour of arrival |

## Population and entity limits

| Name | Value | Meaning |
|---|---|---|
| `EMBARK_DWARF_COUNT` | 7 | Starting dwarves |
| `POPULATION_CAP_DEFAULT` | 80 | Default immigration cap; player-configurable 20–200 |
| `MAX_CREATURES` | 600 | Hard cap on living creatures; wildlife and threats stop spawning at the cap |
| `MAX_ITEMS_SOFT` | 40000 | Above this the UI warns about performance; nothing is refused |
| `SQUAD_MAX_SIZE` | 6 | Dwarves per squad |
| `SQUAD_MAX_COUNT` | 6 | Squads per fortress |

## Fluids

These are shared by fluids, pathfinding, terrain, rendering, health and defense.

| Name | Value | Meaning |
|---|---|---|
| `FLUID_MAX_LEVEL` | 7 | Units of fluid in a full tile |
| `FLUID_WADE_LEVEL` | 3 | Water at 1–3 is passable at double movement cost |
| `FLUID_DEEP_LEVEL` | 4 | Water at 4–7 is impassable for pathfinding; non-aquatic creatures inside it drown slowly |
| `FLUID_TICK_CADENCE_WATER` | 2 | Water is simulated every 2 ticks |
| `FLUID_TICK_CADENCE_MAGMA` | 4 | Magma is simulated every 4 ticks |

## Economy

| Name | Value | Meaning |
|---|---|---|
| `CURRENCY_NAME` | marks | |
| `EMBARK_BUDGET_BASE` | 1500 | Marks available at embark |
| `EMBARK_BUDGET_PER_PERIL` | 100 | Added to the budget per point of the region's peril rating |
| `EMBARK_SKILL_POINTS_PER_DWARF` | 10 | Skill levels to distribute per starting dwarf |
| `EMBARK_SKILL_MAX_PER_SKILL` | 5 | Highest starting level in any one skill |

## Scales

| Name | Value | Meaning |
|---|---|---|
| `SKILL_MAX_LEVEL` | 20 | |
| `ATTRIBUTE_MIN` / `ATTRIBUTE_MAX` | 0 / 100 | |
| `ATTRIBUTE_BASELINE` | 50 | Average dwarf |
| `NEED_MAX` | 100 | Needs range 0 (satisfied) to 100 (desperate) |
| `MOOD_MIN` / `MOOD_MAX` | 0 / 100 | |
| `MOOD_BASELINE` | 55 | Mood with no thoughts and no unmet needs |
| `QUALITY_TIER_COUNT` | 6 | poor, common, fine, superior, exceptional, masterwork |
| `ROOM_QUALITY_TIER_COUNT` | 6 | bare, modest, decent, fine, grand, royal |
| `PRIORITY_MIN` / `PRIORITY_MAX` / `PRIORITY_DEFAULT` | 1 / 9 / 5 | 1 is most urgent |
| `RATING_MAX` | 4 | Wealth, peril and temper range 0–4 |
| `BODY_PART_COUNT` | 6 | head, torso, left arm, right arm, left leg, right leg |

## Rendering and screen

| Name | Value | Meaning |
|---|---|---|
| `CELL_PX_ZOOM_1` | 16 | Screen cell is 16×16 px at zoom 1; cells are square |
| `ZOOM_LEVELS` | 0.75, 1, 1.5 | Cell sizes 12, 16, 24 px |
| `MIN_VIEW_COLS` | 80 | Below this the canvas scales down instead of hiding cells |
| `MIN_VIEW_ROWS` | 45 | |
| `SIDEBAR_COLS` | 36 | Width of the right-hand panel when open |
| `STATUS_ROWS` | 2 | Height of the bottom status bar |
| `TARGET_FPS` | 60 | Render loop target; rendering is decoupled from simulation |
| `LEVELS_VISIBLE_BELOW` | 2 | How many z-levels below the slice show through open tiles, each dimmer |

## Text limits

| Name | Value | Meaning |
|---|---|---|
| `FORTRESS_NAME_MAX_CHARS` | 32 | Fortress rename command and its text input limit |
