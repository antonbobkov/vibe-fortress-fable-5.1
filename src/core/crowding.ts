/**
 * Crowding: `02-systems/22-pathfinding-and-spatial.md` § Crowding, the one rule by which a crowded tile
 * slows a step, job work, eating, drinking and an attack's cooldown. What stands on a tile is the
 * movement helper's to count (`crowdPercentAt`).
 */

import { CROWD_FREE, CROWD_MAX_PERCENT, CROWD_STEP_PERCENT } from './path-constants';

/** The percent of its time anything takes on a tile holding `crowd` standing creatures. */
export function crowdPercent(crowd: number): number {
  const over = crowd - CROWD_FREE;
  return over <= 0 ? 100 : 100 + Math.min(CROWD_MAX_PERCENT, over * CROWD_STEP_PERCENT);
}

/** A timed action's ticks at that percent, rounded up. */
export function crowdTicks(ticks: number, percent: number): number {
  return percent === 100 ? ticks : Math.floor((ticks * percent + 99) / 100);
}

/** A tick's work or a step's progress at that percent, rounded down; any gain stays at least 1, so nothing stalls. */
export function crowdEffort(effort: number, percent: number): number {
  if (percent === 100 || effort <= 0) return effort;
  return Math.max(1, Math.floor((effort * 100) / percent));
}
