# 05 Materials & Temperature

**Owner:** `systems/materials` · **Depends on:** [`../01-architecture/content-pipeline.md`](../01-architecture/content-pipeline.md), [04-fluids.md](04-fluids.md), [06-weather-and-seasons.md](06-weather-and-seasons.md), [03-terrain-and-mining.md](03-terrain-and-mining.md)

## Purpose

Be the one place that knows what matter is and how hot it is. Provide material properties to every system, compute the temperature of any tile on demand, keep the small set of hot and cold sources, run fire, and trigger freezing, thawing and melting.

## Concepts

- **Material**: a row of the materials table with a class and properties. Classes: `stone`, `soil`, `ore`, `gem`, `metal`, `wood`, `plant`, `leather`, `cloth`, `bone`, `shell`, `glass`, `ice`, `meat`, `liquid`, `obsidian` (stone but magma-safe and sharp).
- **Property**: `value` (marks per unit), `density`, `hardness` (dig time and weapon quality), `sharpness` (edge damage), `meltsAtC`, `burnable`, `burnTicks`, `magmaSafe` (derived: `meltsAtC > MAGMA_C`), `color`, `glyph`.
- **Temperature**: an integer in °C computed for a tile from its environment. Not stored per tile except for overrides.
- **Source**: a tile with a `tempOverride` contribution: magma (+), warm springs (+), fire (+), snow (−, weak).
- **Fire**: a state on burnable tiles with a timer.

## Rules

### Material properties

Loaded into typed arrays at `init` for hot use: `hardnessOf[idx]`, `meltsAtOf[idx]`, `burnableOf[idx]`, `valueOf[idx]`. Everything else is read from the registry row when needed. Derived tables: `materialsByClass`, `oreYields` (ore index → list of `{ metal, count }`), `alloyInputs`.

Quality interactions used elsewhere: weapon damage multiplier by metal tier (16), armor value by metal tier (16), item value (13), room value from smoothed stone by material value (14), dig time by hardness (03).

### Temperature model

`temperatureAt(i)`:

```
(x, y, z) = unpack(i)
if outdoor(i) or lit(i):        base = weather.surfaceTempC()                     // from 06, includes season, hour and weather
else:
  depthBelowSurface = surfaceZ(x, y) − z
  if depthBelowSurface ≤ NEAR_SURFACE_DEPTH:
      base = lerp(weather.surfaceTempC(), UNDERGROUND_BASE_C, depthBelowSurface / NEAR_SURFACE_DEPTH)
  else:
      base = UNDERGROUND_BASE_C + max(0, (DEEP_HEAT_START_Z − z)) × DEEP_HEAT_PER_Z
return base + tempOverride(i) × 5
```

`tempOverride` is an `Int8` per tile written only by this system: the sum of source contributions in units of 5 °C, clamped to ±120 °C. Sources:

- Magma tile: +`MAGMA_OVERRIDE` at the tile, +`MAGMA_OVERRIDE / 2` at distance 1, +`MAGMA_OVERRIDE / 4` at distance 2 (Chebyshev distance on the same level and the level above).
- Burning tile: +`FIRE_OVERRIDE` at the tile, half at distance 1.
- Warm spring (`gemsprings`): +`SPRING_OVERRIDE` on its tiles.
- Snow-covered tile: −`SNOW_OVERRIDE` at the tile.

Overrides are recomputed for a chunk whenever `FluidsChanged` names it, when fire starts or ends in it, or when snow cover changes in it; the recompute clears the chunk's overrides and re-adds contributions from sources in the chunk and its neighbors. This keeps the per-tick cost near zero.

### Uses of temperature

| Consumer | Reads | Effect |
|---|---|---|
| 04 fluids | outdoor water tiles vs `FREEZE_C`/`THAW_C` | Ice |
| 07 plants | tile temperature vs crop range | Growth or dormancy; frost kills surface crops below `FROST_KILL_C` |
| 10 dwarves | tile temperature of the dwarf's position | Comfort need and outdoor thoughts (15) |
| 17 health | tile temperature | Heat stroke above `HEAT_INJURY_C`, frostbite below `COLD_INJURY_C`, burn damage on burning tiles |
| 12 workshops | `fluids.isMagmaAdjacent` | Magma-powered furnaces (not temperature; listed for completeness) |
| 13 items | `MagmaContact` | Melting |

### Fire

State: `burning: Map<TileIndex, { remainingTicks, spreadCooldown }>`; the `burning` flag mirrors membership.

- **Ignition.** A burnable tile ignites when: it is adjacent (cardinal or below) to a magma tile with level ≥ 1; a `LightningStrike` names it (06); a burning neighbor spreads to it; a creature carrying a burning status enters it (not in version 1); or a magma-adjacent wooden construction is built (14 warns and refuses unless the player confirms).
- **Burnable tiles.** `tree`, `sapling`, `shrub`; `floor` with `grass`; constructed tiles whose material is `wood`; any tile with `burnable` items on it (items burn individually, see below). Cave flora is not burnable. Tiles with `wet` or `snow` flags are not ignitable by spread, only by magma or lightning.
- **Burning.** Each materials tick (every 10 ticks): `remainingTicks −= 10`. When it reaches 0: a tree becomes `floor` with `ash` (grass cleared); a sapling or shrub becomes `floor` with `ash`; a grass floor loses `grass` and gains `ash`; a wooden construction is removed through `terrain.setKind` as if deconstructed with no item returned (support re-check follows). `ash` blocks grass regrowth and planting for `ASH_DURATION_DAYS` (07 clears it).
- **Spread.** Each materials tick, each burning tile with `spreadCooldown == 0` tries each cardinal neighbor and the tile above: if burnable and not burning, ignite with `FIRE_SPREAD_PERMILLE` (`FIRE_SPREAD_WET_PERMILLE` under rain). After trying, `spreadCooldown = FIRE_SPREAD_COOLDOWN`.
- **Items.** Items on a burning tile whose material is burnable are destroyed after `ITEM_BURN_TICKS`; non-burnable items survive. Items *in containers* on a burning tile: the container burns if burnable, and then its contents follow the rule.
- **Creatures.** A creature on a burning tile receives `BurnDamage { id, amount }` every materials tick (17 applies it as burn wounds to random parts). Creatures avoid burning tiles in pathfinding (22 reads the flag).
- **Extinguish.** Rain (06 weather is `rain` or `storm`) gives each outdoor burning tile `RAIN_EXTINGUISH_PERMILLE` per tick to go out early with no ash. Water at level ≥ 1 on a burning tile puts it out immediately. Fire never burns underground except on wooden constructions and items, which spread only along other wooden constructions.

Fire is meant to be a hazard of magma, lightning and carelessness, not a weapon system; there is no way for the player to start a fire deliberately in version 1 except by channeling magma to wood.

### Melting

On `MagmaContact { entities }`, for each item: if `meltsAtOf[material] ≤ MAGMA_C` the item is destroyed with `ItemMelted { id }` (13 handles the destruction); otherwise it is unharmed and can sit in magma (magma-safe stone, obsidian, metals with a high melting point per the metals table). The same check governs buildings: 14 refuses to complete a construction or mechanism in a magma-exposed position unless every material is magma-safe, and destroys non-magma-safe buildings on contact.

### Warm springs

`gemsprings` places 2×2 water tiles flagged as springs in terrain generation; this system keeps them in `warmSprings: TileIndex[]` and applies `SPRING_OVERRIDE`. They never freeze and give a mild comfort bonus to dwarves standing adjacent (15 thought `warm_spring` on the `DwarfNearSpring` event emitted by 10).

## State

- `tempOverride` grid (owned here, stored in `Map3D`).
- `burning` map; `warmSprings`; `magmaSourceChunks` (chunks containing magma, maintained from `FluidsChanged`).
- Property typed arrays (rebuilt from the registry on load; not saved).

## Interfaces

Implementation note: Additional public queries and secondary emitters implement the rules above; reader additions: `materials.isWarmSpring`, `materials.surfaceTempC`; audited in DECISIONS D-220.

### Reader

- `materials.temperatureAt(i)`
- `materials.isBurning(i)`, `materials.burningTiles()`
- `materials.propertyOf(materialIdx, property)` and the typed accessors `hardness(idx)`, `meltsAt(idx)`, `burnable(idx)`, `value(idx)`, `classOf(idx)`, `isMagmaSafe(idx)`
- `materials.yieldsOf(oreIdx)`, `materials.alloyInputs(metalIdx)`

### Commands

None.

### Events consumed

`FluidsChanged` (override recompute, ignition by magma), `LightningStrike`, `MagmaContact`, `SnowCoverChanged`, `TilesChanged` (a burning tile that stops being burnable stops burning), `WeatherChanged` (rain state for spread and extinguish).

### Events emitted

`TemperatureTick { }` (each materials tick; 04 processes freeze and thaw on it), `FireStarted { tile }`, `FireSpread { tiles[] }`, `FireOut { tiles[] }`, `BurnDamage { id, amount }`, `ItemMelted { id }`.

### Registrations

Overlay `temperature` (a color ramp per tile, computed lazily for visible tiles only); inspector section `tile › temperature`; announcements for `FireStarted` (alert, "Fire on the surface" or "Fire in the hall").

## Player-facing behavior

- Fire renders as `^` or `‼` in yellow-red alternating each half second on burning tiles; ash as a dark gray floor.
- The temperature overlay uses blue to red; the look cursor shows "−4 °C, freezing" in words.
- Announcements: first fire of a burn event as an alert that centers the view; fire out as a note.

## Tuning constants

| Name | Value | Meaning |
|---|---|---|
| `UNDERGROUND_BASE_C` | 10 | Constant temperature at depth |
| `NEAR_SURFACE_DEPTH` | 3 | z-levels over which surface temperature blends into the base |
| `DEEP_HEAT_START_Z` | 12 | Below this z, temperature rises toward the magma sea |
| `DEEP_HEAT_PER_Z` | 3 | °C per level below `DEEP_HEAT_START_Z` |
| `MAGMA_OVERRIDE` | 16 | ×5 °C = +80 at the magma tile |
| `FIRE_OVERRIDE` | 12 | +60 at the burning tile |
| `SPRING_OVERRIDE` | 5 | +25 |
| `SNOW_OVERRIDE` | 1 | −5 |
| `FIRE_SPREAD_PERMILLE` | 150 | Per neighbor per attempt |
| `FIRE_SPREAD_WET_PERMILLE` | 20 | Under rain |
| `FIRE_SPREAD_COOLDOWN` | 30 | Ticks between spread attempts |
| `ITEM_BURN_TICKS` | 100 | |
| `BURN_TICK_DAMAGE` | 6 | Damage units per materials tick to a creature on a burning tile |
| `RAIN_EXTINGUISH_PERMILLE` | 30 | Per tick |
| `ASH_DURATION_DAYS` | 28 | |
| `FROST_KILL_C` | −2 | Surface crops die below this |
| `HEAT_INJURY_C` | 55 | Heat stroke |
| `COLD_INJURY_C` | −25 | Frostbite |

Burn durations per material (`burnTicks`) and all property values are content.

## Extension points

- Stored temperature grid: if a future feature needs heat diffusion (a heated hall), replace `temperatureAt` with a grid updated by diffusion at this system's cadence; consumers do not change.
- Deliberate fire: a `torch` item or an `ignite` designation calls the same ignition path.
- Smoke: a transient per-chunk counter like mist, rendered as a gray tint.
