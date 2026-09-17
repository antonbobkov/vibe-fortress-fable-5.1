# M3 — Water, Fire, Sky

**Goal:** fluids, temperature, fire, weather, ice, mist, mud, and their overlays. **Gate:** `fl_*`, `ma_*`, `we_*`, e2e `fluid-overlay`, performance smoke (fluids and pathing budgets).

Spec: [`04-fluids.md`](../02-systems/04-fluids.md), [`05-materials-and-temperature.md`](../02-systems/05-materials-and-temperature.md), [`06-weather-and-seasons.md`](../02-systems/06-weather-and-seasons.md), algorithms `fluids.md`, `environment.md`.

## T-M3-01 Fluids: state, active set, fall and spread (M)

Needs: M2. Produces: `src/systems/fluids/{index,state,reader,step}.ts`: fluid byte helpers, per-chunk active arrays, idle counters, `touch/activate/deactivate`, `passable(i, type)` using `buildings.blocksFluidAt` and `blocksFallAt`, rules 1–2, sources and sinks refill/drain, parity and rotation, `FluidsChanged` per chunk, `mud`.
Spec: `04` § The four movement rules (1, 2), § Step algorithm, § Sources and sinks, § Mud; algorithm `fluids.md`.
Tests: scenarios `fl_conservation`, `fl_spread`; property `fluid conservation` (sealed basins); unit: rotation removes directional bias (a 7 in the center of a 9×9 spreads symmetrically within 2 units per side after 100 steps); settle after `FLUID_SETTLE_STEPS`; sinks drain.

## T-M3-02 Fluids: pressure, evaporation, contact (M)

Needs: 01. Produces: rules 3–4, `bfsHead` with budgets, obsidian contact, entity checks (`CreatureSubmerged`, `MagmaContact`), pathfinding water and magma passability now live.
Spec: § rules 3–4, § Water and magma contact, § Creatures and items in fluid; `22` fluid passability rows.
Tests: scenarios `fl_pressure`, `fl_obsidian`, `pf_water`; unit: pressure never lifts above the head; budget exhaustion retries next step; evaporation only for isolated level-1 water; `WADE_LARGE_SIZE` submersion exception. `fl_drown` waits for M6 (health); add it now with `it.todo('M6')` in the scenario index tagging.

## T-M3-03 Materials: property arrays, temperature function, overrides (M)

Needs: 02. Produces: `src/systems/materials/{index,state,reader,temperature}.ts`: typed property arrays, `temperatureAt`, override recompute per chunk on `FluidsChanged`/fire/snow, warm springs, `TemperatureTick`.
Spec: `05` § Material properties, § Temperature model, § Warm springs; algorithm `environment.md` § Temperature.
Tests: scenario `ma_temperature`; unit: override contributions at distances 0/1/2 and clamping; recompute limited to touched chunks (spy on chunk visits); `gemsprings` springs get `SPRING_OVERRIDE`.

## T-M3-04 Materials: fire and melting (M)

Needs: 03. Produces: `materials/fire.ts` (ignition sources, burn timers, spread with cooldown, wet/snow suppression, rain extinguish, items on burning tiles, `BurnDamage` events, burn-out transitions through the terrain API), `ItemMelted` on `MagmaContact` for meltable items; 14 destroys non-magma-safe buildings on contact; `not_magma_safe` placement rejection now real.
Spec: `05` § Fire, § Melting; `14` § Placement step 3.
Tests: scenarios `ma_fire_spread`, `ma_fire_rain`, `ma_magma_melt`; unit: burnable tile predicate over all kinds and materials; wooden constructions burn away and trigger support checks; a copper bar placed on the magma rim melts, granite survives; `PlaceBuilding` of a pine floodgate next to magma is rejected.

## T-M3-05 Freezing and thawing (S)

Needs: 02, 03. Produces: `fluids/freeze.ts`, `outdoorWaterTiles` maintenance, `frozenOriginalKind`, creature displacement on freeze, ice digging drops nothing (03 rule), well `working` now live.
Spec: `04` § Freezing and thawing; `03` transitions for ice.
Tests: scenario `fl_freeze` (temper 4 winter through `forceTemperature` and through real weather); unit: hysteresis (no flicker between −1 and 2); a dwarf on a freezing pond is moved; digging ice yields no item; well works with water 3 levels below.

## T-M3-06 Weather system (M)

Needs: 03. Produces: `src/systems/weather/{index,state,reader,transitions}.ts`: seasons table, `surfaceTempC`, transitions with temper scaling and trait rules, durations, snow cover laying and melting, wet chunks, lightning, daylight, `SeasonEffectsChanged`, modifiers (`growthModifier`, `thirstModifier`, `visibilityModifier`).
Spec: `06` (all); `regions-biomes-and-traits.md` § Weather; algorithm `environment.md` § Weather tick.
Tests: scenarios `we_transitions` (10 years at temper 0 and 4, statistics), `we_snow`; unit: transition constraints (snow↔rain by `SNOW_C`, heatwave only summer temper ≥ 2), `thunderhead` doubling, `serene_vale` removals, daylight windows, day curve table, `frostmarrow` overrides.

## T-M3-07 Mist, miasma hooks, and the movement-side effects plumbing (S)

Needs: 01, 06. Produces: `mistTiles` with expiry and `MistProduced`, `fluids.isMisty`; the 10 hook that emits `DwarfFeltMist`, `DwarfNearSpring`, `DwarfOutdoorsIn` on entering tiles (thought consumers arrive in M4; events must fire now).
Spec: `04` § Mist; `10` § Movement.
Tests: scenario `fl_waterfall_mist`; unit: mist expiry; hourly throttle for outdoor events.

## T-M3-08 Rendering: fluids, ice, fire, snow, rain, night; overlays fluid levels and temperature (M)

Needs: 01–06, M2-10. Produces: compositor step 3 and lighting; animation phases (active fluid shimmer, fire alternation); overlays `fluid levels`, `temperature`; status bar weather glyphs; the calendar panel (from the date).
Spec: `23` § Compositor step 3, 9, § Animation; `glyphs-and-colors.md` § Fluid ramps, § Status bar glyphs; `06` § Player-facing behavior.
Tests: golden render `m3-fluids.json` (a river slice with levels 1–7 and a magma pool, animation phase 0 and 1); unit: settled tiles do not animate; night dims outdoor cells only. E2E `fluid-overlay`: press `f`, toggle fluid levels, `cells()` shows digits over the river.

## T-M3-09 Performance smoke: fluids and pathing (S)

Needs: 08. Produces: `test/perf/reference-fortress.ts` (synthetic builder: standard map from `generated` with seed `perf-1`, 40-tile waterfall channel dug through `TestWorld`, 20 dwarves walking random routes), assertions per `01-testing-strategy.md`.
Tests: `fl_perf` (fluids average ≤ 3 ms on the builder, per the acceptance table) plus a pathing assertion (≤ 2 ms average) in the same file; recorded in the gate report.

## T-M3-10 Gate M3 (S)

Needs: all. `reports/M3-gate.md`; `current-milestone: 4`; command generator unchanged (no new commands this milestone).
