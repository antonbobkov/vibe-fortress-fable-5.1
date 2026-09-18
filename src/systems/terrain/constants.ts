/**
 * 03 Terrain & mining tuning constants: every row of `02-systems/03-terrain-and-mining.md`
 * § Tuning constants, verbatim, plus the numbers `algorithms/local-map-generation.md` fixes for the
 * generator (named after the W4 text they come from).
 *
 * `Fixed` values are thousandths (`simulation-core.md` § Fixed-point math).
 */

import type { Fixed } from '@core/fixed';

/** Chance a dug stone tile drops a stone item. */
export const MINING_STONE_DROP_PERMILLE = 300;
/** Base time to dig one wall tile of hardness 100. */
export const DIG_BASE_TICKS = 60;
export const CHANNEL_BASE_TICKS = 80;
export const SMOOTH_BASE_TICKS = 120;
export const ENGRAVE_BASE_TICKS = 300;
export const CHOP_BASE_TICKS = 90;
export const GATHER_BASE_TICKS = 40;
/** Per skill level; level 20 works at 100/(100+160) of base time. */
export const SKILL_TIME_BONUS_PERCENT = 8;
/** `CAVERN_OPEN_FRACTION` 0.25–0.55 "by deepness; see stage 6": the two ends, as `Fixed`. */
export const CAVERN_OPEN_FRACTION_MIN: Fixed = 250;
export const CAVERN_OPEN_FRACTION_MAX: Fixed = 550;
/** Tiles daylight reaches horizontally into openings. */
export const LIGHT_SPREAD = 2;
export const BATTLEFIELD_ITEM_COUNT = 30;
/** Deepsilver items in a sunken hall vault. */
export const VAULT_TREASURE = 3;
/** By species. */
export const TREE_LOGS_MIN = 1;
export const TREE_LOGS_MAX = 4;

// ---------- generator numbers of `algorithms/local-map-generation.md` and `03` stage text ----------

/** `fungal_depths`: "cavern open fraction +0.15". */
export const FUNGAL_DEPTHS_OPEN_BONUS: Fixed = 150;
/** `deep_well`: "cavern 1 open fraction 0.7". */
export const DEEP_WELL_OPEN_FRACTION: Fixed = 700;
/** Cavern floors: "if st.chance(600): material = cave_loam". */
export const CAVE_LOAM_PERMILLE = 600;
/** Cavern lakes: "noise3(..., [10], [100]) < 18"; `deep_well` cavern 1: 60. */
export const CAVERN_LAKE_PERCENT = 18;
export const DEEP_WELL_LAKE_PERCENT = 60;
/** Cavern magma pools (tiers 2 and 3): "st.chance(2)" per floor tile, radius 2–4. */
export const MAGMA_POOL_PERMILLE = 2;
export const MAGMA_POOL_RADIUS_MIN = 2;
export const MAGMA_POOL_RADIUS_MAX = 4;
/** Veins: "random-walk `length` steps … painting a 1–2 tile radius". */
export const VEIN_PAINT_RADIUS_MIN = 1;
export const VEIN_PAINT_RADIUS_MAX = 2;
/** Gems: "Clusters of radius 1–2" (`minerals-and-metals.md` § Gems). */
export const GEM_RADIUS_MIN = 1;
export const GEM_RADIUS_MAX = 2;
/** "randomWallTile … if none after 50 tries: continue". */
export const MINERAL_START_TRIES = 50;
/** Deepsilver: "within 2 of … magma"; veins "length 6, radius 1". */
export const DEEPSILVER_MAGMA_DISTANCE = 2;
export const DEEPSILVER_VEIN_LENGTH = 6;
export const DEEPSILVER_VEIN_RADIUS = 1;
/** `ironheart`: "`hematite` 12, `magnetite` 6 regardless of wealth" (counts per map). */
export const IRONHEART_HEMATITE = 12;
export const IRONHEART_MAGNETITE = 6;
/** `gemsprings`: "half within 6 levels of the surface". */
export const GEMSPRINGS_NEAR_SURFACE_LEVELS = 6;
/** Volcano: "at least 20 tiles from the arrival edge"; "the surface around it for radius 6 is obsidian". */
export const VOLCANO_EDGE_DISTANCE = 20;
export const VOLCANO_OBSIDIAN_RADIUS = 6;
/** `glasslands`: "pipe radius 3". */
export const GLASSLANDS_PIPE_RADIUS = 3;
/** `glasslands`: "two more shallow magma pools at cavern one depth". */
export const GLASSLANDS_POOLS = 2;
/** `glasslands` (07 hook): "`treeDensity` 0.01". */
export const GLASSLANDS_TREE_DENSITY: Fixed = 10;
/** "Trees are not placed within 2 tiles of the river bed except willows." */
export const RIVER_TREE_CLEARANCE = 2;
/** Cavern flora: "fungus trees with density 0.12 by cavern weights; cavern shrubs 0.08". */
export const CAVE_TREE_DENSITY: Fixed = 120;
export const CAVE_SHRUB_DENSITY: Fixed = 80;
/** `old_battlefield`: "plus 40 `bone_pile` and 6 `skull`" in "a band 15–40 tiles from the arrival edge". */
export const BATTLEFIELD_BONE_PILES = 40;
export const BATTLEFIELD_SKULLS = 6;
export const BATTLEFIELD_BAND_MIN = 15;
export const BATTLEFIELD_BAND_MAX = 40;
/** `sunken_halls`: "12 common furniture items". */
export const HALL_FURNITURE_COUNT = 12;
/** `gemsprings`: "three 2×2 warm springs on the surface". */
export const WARM_SPRING_COUNT = 3;
/** `wyrm_roost`: "a 9×9 chamber in cavern 3". */
export const WYRM_CHAMBER_SIZE = 9;
