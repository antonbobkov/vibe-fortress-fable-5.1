/**
 * The held shot: `02-systems/16-combat.md` § Ranged resolution.
 *
 * A shooter with a launcher, ammunition or a channel's bolt (25 § Casting), holds its shot while a
 * creature of its own faction stands on the projectile's ray before the target, and shoots the
 * nearest other hostile it can reach with a clear line, or waits, unless it is careless this time:
 * below `CARELESS_SAFE_SKILL` in its shooting skill, one draw decides whether it fires through.
 * The line check itself draws nothing, so friendly fire after the shot stays real.
 */

import { C } from '@core/components';
import type { RngStream } from '@core/rng';
import type { TickContext } from '@core/system';
import type { EntityId, TileIndex } from '@core/types';
import { CARELESS_SAFE_SKILL, CARELESS_SHOT_PERCENT } from './constants';

/**
 * The percent chance that a shooter at `skill` fires through an ally on its line: `CARELESS_SHOT_PERCENT`
 * at skill 0, falling evenly to 0 at `CARELESS_SAFE_SKILL` (50, 45, … 5, 0 at the defaults).
 */
export function carelessPercent(skill: number): number {
  if (skill >= CARELESS_SAFE_SKILL) return 0;
  return Math.floor((CARELESS_SHOT_PERCENT * (CARELESS_SAFE_SKILL - Math.max(0, skill))) / CARELESS_SAFE_SKILL);
}

/**
 * The one draw of a shooter with an ally on its line, on the shooter's own system stream (16 for a
 * launcher with ammunition, 25 for a caster). Nothing is drawn when the chance is 0.
 */
export function carelessThisTime(rng: RngStream, skill: number): { drew: boolean; careless: boolean } {
  const percent = carelessPercent(skill);
  if (percent <= 0) return { drew: false, careless: false };
  return { drew: true, careless: rng.int(0, 99) < percent };
}

/** A candidate's tile and 16's projectile ray toward it, or null when there is no line of sight. */
export type RayTo = (target: EntityId) => { tile: TileIndex; ray: readonly TileIndex[] } | null;

/**
 * A creature of the shooter's own faction (for a fortress shooter, any fortress creature) stands on
 * a tile of `ray` before `targetTile`. `ray` is 16's projectile ray from the shooter toward the
 * target.
 */
export function allyOnLine(ctx: TickContext, shooterId: EntityId, targetTile: TileIndex, ray: readonly TileIndex[]): boolean {
  const entities = ctx.world.entities;
  const faction = entities.get(shooterId, C.Creature)?.faction;
  if (faction === undefined) return false;
  for (const tile of ray) {
    if (tile === targetTile) return false;
    for (const id of ctx.readers.spatial.at(tile)) {
      if (id === shooterId) continue;
      if (entities.get(id, C.Creature)?.faction === faction) return true;
    }
  }
  return false;
}

/**
 * The nearest other target of a held shot (distance, then id): a creature hostile to the shooter
 * other than `heldTarget`, within `range` (Chebyshev on the level, each level between counting
 * two), that `canTake` allows, in line of sight (`rayTo` not null), and, when `keepLineClear`, with
 * no ally on its line. 0 when there is none.
 */
export function nearestClearTarget(
  ctx: TickContext,
  shooterId: EntityId,
  heldTarget: EntityId,
  range: number,
  isHostile: (a: EntityId, b: EntityId) => boolean,
  canTake: (target: EntityId) => boolean,
  rayTo: RayTo,
  keepLineClear: boolean,
): EntityId {
  const entities = ctx.world.entities;
  const pos = entities.get(shooterId, C.Position);
  if (pos === undefined) return 0;
  const from = ctx.world.map.index(pos.x, pos.y, pos.z);
  let best = 0;
  let bestDist = Infinity;
  for (const id of ctx.readers.spatial.inRadius(from, range, 'creature')) {
    if (id === shooterId || id === heldTarget || !entities.alive(id) || !isHostile(shooterId, id)) continue;
    const p = entities.get(id, C.Position);
    if (p === undefined) continue;
    const dist = Math.max(Math.abs(p.x - pos.x), Math.abs(p.y - pos.y)) + Math.abs(p.z - pos.z) * 2;
    if (dist > range || dist > bestDist || (dist === bestDist && id > best)) continue;
    if (!canTake(id)) continue;
    const line = rayTo(id);
    if (line === null || (keepLineClear && allyOnLine(ctx, shooterId, line.tile, line.ray))) continue;
    best = id;
    bestDist = dist;
  }
  return best;
}
