/**
 * Tuning constants of the pathfinding, connectivity and movement modules.
 *
 * Every row of `02-systems/22-pathfinding-and-spatial.md` § Tuning constants, plus the two values
 * the passability and cost formulas of `04-implementation/algorithms/pathfinding-and-connectivity.md`
 * borrow from other system documents. They are not in `01-architecture/constants.md`, so they may
 * not live in `core/constants.ts`: that module is pinned name-for-name to the document by
 * `test/unit/constants.test.ts`. See docs/01-architecture/constants.md.
 *
 * Systems 06 and 19 re-export `SNOW_MOVE_COST_PERCENT` and `WADE_LARGE_SIZE` from here when they
 * arrive, rather than restating the value.
 */

import type { Fixed } from './fixed';

/** `22` § A*: the per-z-level term of the heuristic. */
export const Z_HEURISTIC_COST = 1000;

/** `22` § A*: nodes expanded by one request before it fails `too_far`. */
export const PATH_NODE_LIMIT = 8000;

/** `22` § A*: nodes expanded across all requests in one tick. */
export const PATH_NODES_PER_TICK = 24000;

/** `22` § A*: in-progress searches kept across ticks. */
export const PATH_CONCURRENT = 16;

/** `22` § Path cache: number of cached routes, evicted least-recently-used first. */
export const PATH_CACHE_SIZE = 512;

/** `22` § Movement helper: ticks a mover waits when another creature blocks its next tile. */
export const REPATH_WAIT_TICKS = 5;

/** `22` § Movement helper: attempts before the brain gives up the goal. */
export const REPATH_LIMIT = 3;

/** `22` § Line of sight: longest sight line, in tiles. */
export const LOS_MAX = 30;

/**
 * `22` § Tuning constants: the dwarf species' base speed, 0.1 tiles per tick, as a `Fixed`. The
 * value that actually reaches a creature is the `speed` column of `03-content/creatures.md`; this
 * row is the documented baseline.
 */
export const DWARF_SPEED: Fixed = 100;

/** `02-systems/06-weather-and-seasons.md` § Tuning constants: movement cost on a snow tile. */
export const SNOW_MOVE_COST_PERCENT = 150;

/** `02-systems/19-defense-and-traps.md` § Tuning constants: creatures this large drown only at 7. */
export const WADE_LARGE_SIZE = 180;

/** `22` § Costs: the price of one ordinary step, and the scale every other cost is written in. */
export const STEP_COST = 1000;

/** `22` § Costs: a diagonal step, `STEP_COST * sqrt(2)` rounded to the documented integer. */
export const DIAGONAL_COST_NUMERATOR = 1414;

/** `22` § Costs: the opening delay added when a door stands on the entered tile. */
export const DOOR_COST_PENALTY = 200;

/** `22` § Costs: multiplier for water at levels 1..`FLUID_WADE_LEVEL`. */
export const WADE_COST_MULTIPLIER = 2;

/** `22` § Costs: multiplier for a `restricted` tile entered by a fortress creature. */
export const RESTRICTED_COST_MULTIPLIER = 5;

/** `22` § Costs: multiplier for a `web` tile. */
export const WEB_COST_MULTIPLIER = 3;

/** `22` § Path cache: node limit of the splice search from the requester to the cached path. */
export const PATH_CACHE_SPLICE_NODE_LIMIT = 512;

/** `04-fluids.md` fluid levels run 0..7; level 7 is the level a wading giant finally drowns at. */
export const FLUID_MAX_LEVEL = 7;
