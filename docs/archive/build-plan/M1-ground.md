# M1 — Ground

**Goal:** generate a world and a local map, embark a default party, walk, designate and dig. **Gate:** `wg_*`, `tr_dig_room`, `tr_channel_ramp`, `tr_stairwell`, `tr_discovery`, `pf_*`, e2e `generate-and-embark`, `designate-by-drag`.

Spec: [`01-world-generation.md`](../../02-systems/01-world-generation.md), [`02-embark-and-loadout.md`](../../02-systems/02-embark-and-loadout.md), [`03-terrain-and-mining.md`](../../02-systems/03-terrain-and-mining.md), [`10-dwarves.md`](../../02-systems/10-dwarves.md) (movement and idle only), [`11-jobs-and-labor.md`](../../02-systems/11-jobs-and-labor.md), algorithms `world-generation.md`, `local-map-generation.md`, `jobs-and-hauling.md`.

## T-M1-01 Value noise and hashing utilities (S)

Needs: M0. Produces: `src/core/noise.ts` (lattice value noise 2D/3D, integer, fixed-point smoothstep; `hash64`, `hash(seed, ...salts)`).
Tests: unit: noise is a pure function of (seed, coords); range 0–amplitude; smoothness (adjacent samples differ by less than amplitude/4 at freq 1/32); 3D variant.

## T-M1-02 World generation stages 1–5 (M)

Needs: 01. Produces: `src/systems/worldgen/{index,state,reader,stages/elevation,climate,biomes,rivers,geology}.ts`.
Spec: `01-world-generation.md` § Elevation … § Geology; `algorithms/world-generation.md` steps 1–5; biome lookup and rows in `regions-biomes-and-traits.md`.
Tests: unit per stage with fixed seeds (retry logic hits on a rigged mask; rain shadow decreases east of a mountain row; biome lookup table exhaustive: every temp×rain×elev cell maps to a defined biome); scenario `wg_rivers`.

## T-M1-03 World generation stages 6–9 and the reader (M)

Needs: 02. Produces: civilizations, ratings, traits, names stages; `worldgen.reader` (`region`, `findRegions`, `civHome`, `riverOf`).
Spec: § Civilizations, § Ratings, § Traits, § Names; `names.md` § Region names; trait requirements table.
Tests: scenarios `wg_shape`, `wg_ratings`, `wg_determinism`; unit: `findRegions` filters; trait requirements honored on 50 seeds (no `wyrm_roost` below wealth 3, `serene_vale` peril 0). Golden: `world-hashes.json` entries for seeds `test-1`, `test-2`, `test-3` at standard size.

## T-M1-04 Embark spec and party generation (S)

Needs: 03. Produces: `src/systems/embark/{index,spec,party,arrival}.ts`, `makeDwarf` in `src/systems/dwarves/rules/make-dwarf.ts` (shared with M7 immigration).
Spec: `02-embark-and-loadout.md` § Party generation, § Local map specification, § Arrival (steps 3–8 wait for items and buildings: implement dwarves, calendar, title, `Embarked`; wagon/items are wired in M2); `algorithms/economy.md` § makeDwarf.
Tests: unit: attribute distribution over 10,000 rolls (mean 50 ± 1, min ≥ 26, max ≤ 74); three distinct trait pairs; names unique; `LocalMapSpec` fields from a region; Thane = highest Charm.

## T-M1-05 Local map generation: heightmap, rivers, layers, magma sea (L)

Needs: 04, 01. Produces: `src/systems/terrain/generate/{height,rivers,layers,sea}.ts`, geology templates from content.
Spec: `03-terrain-and-mining.md` § Local map generation stages 1–5; `algorithms/local-map-generation.md` steps 1–3; `minerals-and-metals.md` § Geology layer templates.
Tests: unit: surface z within bounds and matches `base` for relief 0; river bed continuous from inflow to outflow with sources and sinks marked; layer stack repeats; magma sea rim and roof; every column has exactly one surface Floor; `glasslands` obsidian soil. Property: for 20 seeds, no `Open` tile below a `Floor` in the same column except cavern bands (none yet) and river beds.

## T-M1-06 Local map generation: caverns, minerals, volcano, vegetation, traits (L)

Needs: 05. Produces: `generate/{caverns,minerals,volcano,vegetation,traits}.ts`, discovery/outdoor/lit pass, spawn lists for 02 arrival.
Spec: stages 6–11; algorithm steps 4–9; `minerals-and-metals.md` § Ores, § Gems, § Wealth multiplier; `plants.md` tree/shrub weights; trait hooks in `regions-biomes-and-traits.md`.
Tests: unit: cavern open fraction within ±0.05 of target per deepness; cavern floors get `cave_loam` at ~60%; vein counts over 30 seeds within ±30% of expected per wealth; deepsilver only at `z ≤ DEEPSILVER_Z_MAX` within 2 of magma and only at wealth ≥ 2; volcano pipe reaches the surface; `sunken_halls` template carved with the vault sealed; outdoor and lit flags (a 2-wide pit: lit at the rim, dark at depth 3). Generation time ≤ 3 s in the test environment. Golden: local map hash for `test-1` region 0.

## T-M1-07 Terrain system: designations, tile API, discovery, support (M)

Needs: 06. Produces: `src/systems/terrain/{index,state,reader,commands,api}.ts` (terrain API `setKind/setFlag/setDesignation`, `TilesChanged` batching, `outdoor/lit` recompute, discovery on `EntitiesMoved`, support and collapse, `Designate/UndoDesignation/SetDesignationPriority/SetTraffic/DesignateStairwell/ConfirmDeepsilver` commands, inspector data).
Spec: § Tile transitions, § Support and collapse, § Discovery, § Outdoor and lit, § Restricted traffic, § Fluids and constructions interplay; `command-catalog.md` rows for 03.
Tests: unit: every transition row (precondition and result) as a table-driven test; collapse cascade order; discovery on breach flood-fills the band only; undo keeps tiles with progress; `deepsilver_unconfirmed` rejection; support rule with each of the six faces. Scenario `tr_support`, `tr_deepsilver_gate` (mining part waits for T-M1-10).

## T-M1-08 Jobs system: board, labors, assignment, steps (L)

Needs: 07, M0-09. Produces: `src/systems/jobs/{index,state,reader,commands,board,assign,steps,producers}.ts`, `Labors`/`Worker` components, standing orders store, blocked-retry triggers, the `JobProducer` registration.
Spec: `11-jobs-and-labor.md` (all); `algorithms/jobs-and-hauling.md` § Jobs tick, § Assignment, § Job steps; `jobs.md` rows (loaded as content); `skills-and-professions.md` § Labors.
Tests: unit: scoring formula on constructed cases; candidate limit; labor priority shift; claim/unclaim reservations (with an in-memory item stub until M2); interruption keeps progress; blocked reasons and retry triggers; children hauling-only. Scenarios `jb_priority`, `jb_labor_priority`, `jb_unreachable` (dig jobs only; `jb_reservation`, `jb_tool`, `jb_hauling` in M2).

## T-M1-09 Dwarves system: brain (walk, idle), skills, xp, movement speed (M)

Needs: 08. Produces: `src/systems/dwarves/{index,state,reader,brain,skills}.ts` with behaviors `work`, `idle` only; `Skills` xp ladder; `speed` composition (attributes only; wounds and carry in later milestones); `Attributes`, `Personality`, `Schedule`, `Relationships`, `Title` components created by `makeDwarf`.
Spec: `10-dwarves.md` § Skills and experience, § Behavior selection (steps 7 and 9 only), § Movement; `skills-and-professions.md` § Skill levels.
Tests: unit: xp ladder cumulative values; level-up events at 5/10/15/20; speed formula; behavior selection picks `work` when a job is assignable and `idle` otherwise. Scenario: seven dwarves walk to the hearth-hall fallback (the wagon tile) and idle.

## T-M1-10 Dig, channel, carve, smooth, engrave, chop, gather job execution (M)

Needs: 08, 09. Produces: `src/systems/terrain/producer.ts` (designation → job with `workTile` rules), `onComplete` per job type (transitions, item drops through the spawn API with a stub item spawner until M2 that records intended drops), xp, `VeinFound`/`MineralMined`/`DeepsilverMined`/`CavernBreached`/`TreeFelled`.
Spec: `03-terrain-and-mining.md` § Digging as a job; `jobs.md` § Terrain; `SKILL_TIME_BONUS_PERCENT`.
Tests: scenarios `tr_dig_room` (drop rate over 100 runs), `tr_channel_ramp`, `tr_stairwell`, `tr_discovery`, `tr_deepsilver_gate` (complete); unit: work time by hardness and skill (table cases from `balance.md` § Time and pace).

## T-M1-11 Spawn API and creature/dwarf spawning (S)

Needs: 09. Produces: `src/core/spawn.ts` (`spawn.creature`, `spawn.item` stub until M2) ensuring every required component per kind; `Creature`, `Body` (with plan-derived parts, hp only; wounds unused until M6) creation.
Spec: `module-interfaces.md` § The spawn API; `components.md` § Component ownership.
Tests: unit: a spawned dwarf has every component in the ownership table's dwarf set; a spawned animal has `Wild`; ids alive; positions indexed.

## T-M1-12 World gen and world map screens (M)

Needs: 03, M0-13. Produces: `src/ui/screens/{main_menu,world_gen,world_map}.ts`, widgets `List`, `Menu`, `Text`, `Button`, `Tabs`, `Label`, `Separator`, `Bar` in `src/ui/widgets/`, the keymap loader (`keymap.json` from `ui-keymap-and-screens.md`), the world-map compositor.
Spec: `ui-screens/menus-and-world.md` (main menu, world gen, world map), `24-ui-and-input.md` § Screens outside the fortress, keymap tables.
Tests: unit: widget layout in cells for each widget with fixed inputs (golden cell buffers); keymap parsing; main menu hides `Continue` without saves. E2E `generate-and-embark` (part 1): New world → generate with seed `e2e-1` → world map → cursor moves → region panel text contains "Wealth".

## T-M1-13 Embark screen (M)

Needs: 04, 12. Produces: `src/ui/screens/embark.ts` with the Dwarves tab complete, Supplies and Animals tabs listing the catalog with quantities (purchases materialize in M2), presets, budget validation, `Number`/`Dropdown` widgets (the `Text` field widget comes from T-M1-12).
Spec: `ui-screens/embark.md`, `02-embark-and-loadout.md` § Presets, § Player-facing behavior, `embark-catalog.md`.
Tests: unit: budget arithmetic for the four presets equals the documented totals; skill point limits enforced; over-budget disables Embark with the reason. E2E `generate-and-embark` (part 2): Embark with the Balanced preset → fortress screen shows seven `☺` cells near the arrival edge.

## T-M1-14 Designate tool, look panel, log strip, status bar (M)

Needs: 07, 12. Produces: `src/ui/screens/fortress.ts` layout, `src/ui/panels/{designate,look,log}.ts`, status bar, announcement registry (`register.announcement`) with the 03 rows, mouse model (click, drag rectangle, right-click cancel, wheel z, middle-drag pan), `UiState` save section.
Spec: `ui-screens/fortress-screen.md`, `24-ui-and-input.md` § Fortress screen layout, § Input model, § Inspection, § Announcements; `ui-keymap-and-screens.md` § Mouse.
Tests: unit: drag rectangle → `Designate` command with the right tile set and priority; right-click cancels; wheel changes z; status bar strings for a fixed state; announcement severity mapping. E2E `designate-by-drag`: press `d`, `d`, drag a 4×3 rectangle on the rock face, wait 3,000 ticks at 4×, assert ≥ 10 `Floor` tiles via readers, screenshot.

## T-M1-15 Compositor: creatures and designation/zone overlays (S)

Needs: 11, 14. Produces: compositor steps 6 and 8 (designations, priority digits, zones stub), state colors for dwarves.
Spec: `23-rendering.md` § Compositor steps 6, 8; `glyphs-and-colors.md` § Designation tints.
Tests: golden render `m1-designations.json`; scenarios `rd_snapshot_surface` (seed `test-1` region 0 at z=32 against a stored golden) and `rd_overlay_priority`; unit: creature glyph priority order; overlay never hides a creature glyph.

## T-M1-16 Gate M1 (S)

Needs: all. `npm run gate` → `reports/M1-gate.md`; `current-milestone: 2`. Also: extend the property command generator with `Designate`, `UndoDesignation`, `SetTraffic`, `SetLabor`.
