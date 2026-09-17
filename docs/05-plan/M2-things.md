# M2 — Things

**Goal:** items, stockpiles, hauling, constructions, furniture, zones, rooms, embark supplies and the wagon, save and load. **Gate:** `jb_*`, `it_*` except `it_rot`/`it_miasma`, `bd_room_tiers`, `bd_support`, `core_save_roundtrip`, e2e `build-and-stockpile`, `panels-open-and-close`.

Spec: [`13-items-and-storage.md`](../02-systems/13-items-and-storage.md), [`14-buildings-and-rooms.md`](../02-systems/14-buildings-and-rooms.md), [`02-embark-and-loadout.md`](../02-systems/02-embark-and-loadout.md) § Arrival, algorithms `jobs-and-hauling.md` (hauling, slots, search, rot queue), `economy.md` § Room quality, `persistence.md`, `save-format.md`.

## T-M2-01 Items system: entities, item API, value, counts, wealth (M)

Needs: M1. Produces: `src/systems/items/{index,state,reader,api,value,counts}.ts`; `spawn.item` implemented; `Item`, `Container`, `Corpse` components; stacks split/merge; flags; `StocksChanged`, `WealthChanged`.
Spec: `13-items-and-storage.md` § Category tree, § Value, § Placement and pickup, § Forbid…, § Stock counts; `items.md`.
Tests: unit: value examples from `items.md` § Value examples (all seven); stack merge/split conservation; counts incremental equals recount (property `item accounting`); falling items land on the first solid-bottomed tile; `spawn.item` into a container. Scenario `it_value`, `it_wealth` (with hand-spawned items), `it_forbid`.

## T-M2-02 Item search (S)

Needs: 01. Produces: `findItem`, `findItems`, `countAvailable` per `algorithms/jobs-and-hauling.md` § Item search; `ItemFilter` matching.
Tests: unit: nearest by label-filtered radius; skips forbidden/reserved/owned; container contents found; fallback through the stock index; `excludeIds`.

## T-M2-03 Zones and stockpiles (M)

Needs: 01, 02. Produces: `src/systems/buildings/{index,state,zones}.ts` (`Zone` component, `zoneAt`, `CreateZone/ResizeZone/RemoveZone/SetZoneSetting`, overlap rules, per-type tile rules), `src/systems/items/stockpiles.ts` (`Stockpile` component, filter presets, `accepts`, `findSlot`, slot reservations, containers wanted, links, `StockpileFull`).
Spec: `14-buildings-and-rooms.md` § Zones; `13` § Stockpiles, § Containers in play; `buildings-and-furniture.md` § Zone types; `13` § Player-facing (presets).
Tests: unit: `accepts` truth table over category subtree, class, quality, rot, links; `findSlot` fills in `(y, x)` order; container slot logic (barrel wanted → haul empty barrel first); overlap rejection; farm/fishing tile rules (stubbed to soil/water kinds). Scenario `it_containers`.

## T-M2-04 Wants-hauling and haul jobs (M)

Needs: 03, M1-08. Produces: `items/hauling.ts` (wants set, `noHome`, haul job creation per tick with the limit, delivery, merge, slot release), job producer `items`, `haul_to_stockpile`/`haul_to_dump`/`strip_corpse` types, `Worker.carrying`, drop-on-interrupt.
Spec: `11` § Hauling; `13` § The "wants hauling" set; algorithm § Wants-hauling.
Tests: scenarios `jb_hauling`, `jb_reservation` (two craft-like jobs stubbed as `build` jobs needing the same log); unit: wants set transitions for every listed cause; `HAUL_JOBS_PER_TICK` cap; dump zone flag clearing.

## T-M2-05 Buildings: placement, build job, constructions, deconstruction (L)

Needs: 03, 04. Produces: `buildings/{placement,build,constructions}.ts`: `PlaceBuilding` validation (footprint, `on` rules, materials filter, magma safety hook stub true, hearth uniqueness), `build` and `deconstruct` jobs (inputs, `workTile` rules, completion through the terrain API with `constructed` flag), `buildingAt`, passability hook for 22 (`blocksMovementAt`), `BuildingPlaced/Completed/Removed/StateChanged`, wealth contribution.
Spec: `14` § Placement, § Constructions; `buildings-and-furniture.md` § Constructions; `03` § Support and collapse (already in terrain; wire the check on completion).
Tests: unit: every construction row's `on` rule; a wall build waits while a creature stands on the tile; deconstruct returns the material item; planned buildings passable; `bad_placement` and `hearth_exists` rejections. Scenarios `bd_support` (via building placement), `jb_tool` (a pick in a stockpile, a dig job). Property `connectivity consistency` extended with random wall builds.

## T-M2-06 Furniture, doors, hatches, special buildings (M)

Needs: 05. Produces: furniture placement consuming items (`itemId` link, return on deconstruct), door modes and hatch modes (`SetDoorMode/SetHatchMode`, passability per faction and class, `no_pets`, `locked`), `blocksFallAt`, `chain_post`, `nest_box`, `cage_building` (occupant state only), `coffin`, `memorial_slab`, `statue`, `cabinet/chest` store tag, `archery_target`, `well` (working = water below; water arrives in M3, so `working` false until then), `trade_depot`, `wagon`.
Spec: `14` § Doors and hatches, § Special buildings; `buildings-and-furniture.md` § Furniture placements, § Special.
Tests: unit: door passability matrix (fortress/wild/hostile with and without `opensDoors`/`breaksDoors`, locked); hatch blocks vertical edges when locked (pathfinding test); furniture item round-trip; wagon container capacity. Scenario `bd_door_lock`.

## T-M2-07 Rooms (M)

Needs: 06. Produces: `buildings/rooms.ts`: `Room` component, dirty tracking, `scoreRoom`, tiers, requirements per type, enclosure, ownership and daily auto-assignment, `RoomQualityChanged`, `RoomAssigned`.
Spec: `14` § Rooms and quality, § Ownership; `algorithms/economy.md` § Room quality; `buildings-and-furniture.md` § Room quality tiers (worked examples).
Tests: scenario `bd_room_tiers` (both worked examples reproduced tile by tile); unit: enclosure with a door in the border; requirements per type; auto-assignment order (titles first, then lowest mood stub = 55).

## T-M2-08 Embark arrival: wagon, supplies, animals, initial stockpile hint (S)

Needs: 06, M1-04. Produces: arrival steps 2–5 complete (wagon site search, items into the wagon container, animals spawned `Tame` with no pasture (behavior in M4), trait spawn lists applied: battlefield items, sunken hall furniture and vault items).
Spec: `02` § Arrival; `embark-catalog.md` entries → items.
Tests: unit: wagon site within `ARRIVAL_SEARCH_DEPTH`, trees cleared to logs when needed; every catalog entry spawns the right item, material, count and container; `old_battlefield` scatters 30 items in the band. E2E `generate-and-embark` extended: after embark, `readers.items.count(pick) == 2`.

## T-M2-09 Build tool, zones tool, stockpile filter editor, stocks panel, units panel (L)

Needs: 05–07, M1-14. Produces: `panels/{build,zones,stocks,units,jobs,labors}.ts`, widgets `Tree` (tri-state), `Toggle`, `Table`; building ghost with validity colors and reasons; `r` rotate, `x` material cycle; zone drag with tile validity coloring; stockpile presets; stocks tree with forbid/dump/melt; units table and labor grid.
Spec: `ui-screens/panels.md` (Zones, Jobs, Labors, Stocks), `fortress-screen.md` § Build tool, `24` § Panels.
Tests: unit: each panel renders a golden cell buffer for a fixed state; ghost validity; tri-state tree selection semantics; labor grid shift-click. E2E `build-and-stockpile`: place a wood stockpile by drag, place a carpenter's workshop ghost (rejected on rock face: reason shown), place a wall from logs, wait, assert `BuildingCompleted`; `panels-open-and-close`: every hotkey opens its panel and `Esc` closes it; `Tab` toggles the sidebar.

## T-M2-10 Compositor: items and buildings; overlays zones and stockpile usage (S)

Needs: 06, 09. Produces: compositor steps 4–5, zone tints, stockpile usage overlay, workshop pattern rendering (patterns from content), door open/closed glyph, planned dimming.
Spec: `23` § Compositor steps 4, 5, 8; `glyphs-and-colors.md` § Buildings, § Workshop patterns, § Items.
Tests: golden render `m2-buildings-items.json`; unit: top item selection (corpses first, then value); pattern cell offsets with rotation.

## T-M2-11 Save and load: full round-trip, autosave, Load screen (M)

Needs: 01–10, M0-10. Produces: every system's `serialize/deserialize` with `stateVersion`, rebuild-on-load, `SeasonChanged` autosave with the rolling four, `Load` screen, quick save/load keys, export/import through Blob and file input (e2e-testable with Playwright's file chooser), `Continue` in the main menu.
Spec: `persistence.md`, `save-format.md` § Load procedure, § Snapshots and ids; `ui-screens/menus-and-world.md` § Load; `24` § Confirmations (`c_quickload`, `c_delete_save`).
Tests: scenario `core_save_roundtrip` (now with dwarves, jobs, items, buildings); property `save round-trip`; unit: autosave rotation keeps four; header list without inflating; import of an exported file equals the original hash. E2E: F5 then F9 restores the hash (through the hook).

## T-M2-12 Command log and replay script (S)

Needs: 11. Produces: `scripts/replay.mjs`, command log saved for the current season, `core_determinism` extended to replay a recorded log.
Spec: `simulation-core.md` § Commands (log), `tooling.md` § Debug and replay.
Tests: unit: replaying a season log from a save reproduces the end hash.

## T-M2-13 Property command generator: items and buildings (S)

Needs: 09. Extend the generator with `PlaceBuilding` (valid footprints only), `CreateZone`, `SetStockpileFilter`, `ForbidItem`, `CancelBuilding`, `RemoveZone`. Determinism and save round-trip properties must still hold.

## T-M2-14 Gate M2 (S)

Needs: all. `reports/M2-gate.md`; `current-milestone: 3`.
